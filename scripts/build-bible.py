#!/usr/bin/env python3
"""Builds the translator's Bible files from two public sources, matched verse by verse:
  - the Bohairic Bible of Coptic SCRIPTORIUM (github.com/copticscriptorium/corpora, bohairic.nt / bohairic.ot,
    CONLLU files: one sentence per verse, each word split into its pieces with lemma and part of speech; CC BY 4.0);
  - the Smith & Van Dyck Arabic Bible (1865, public domain), exported from the SWORD module AraSVD:
      diatheke -b AraSVD -f plain -k "Gen 1:1 - Rev 22:21" > svd.txt
A chapter is used only when both sides have the same number of verses (the Coptic Psalms follow the Greek numbering,
so a psalm is also tried against the next and previous Arabic one).

Writes
  public/dict/bible-lex.json     what each Coptic word means in Arabic, learned from the matched verses (IBM model 1),
                                 and Arabic → Coptic nouns (with gender) and verbs for the other direction;
  public/dict/bible-verses.json  the matched verses themselves, for whole-verse lookups.

Usage: python3 scripts/build-bible.py path/to/corpora path/to/svd.txt
"""
import collections, glob, json, math, os, re, sys

corpora, svd = sys.argv[1], sys.argv[2]

BOOKS = {
    'Matthew': 'Matthew', 'Mark': 'Mark', 'Luke': 'Luke', 'John': 'John', 'Acts': 'Acts', 'Romans': 'Romans',
    'I_Corinthians': 'I Corinthians', 'II_Corinthians': 'II Corinthians', 'Galathians': 'Galatians', 'Ephesians': 'Ephesians',
    'Philippians': 'Philippians', 'Colossians': 'Colossians', 'I_Thessalonians': 'I Thessalonians', 'II_Thessalonians': 'II Thessalonians',
    'I_Timothy': 'I Timothy', 'II_Timothy': 'II Timothy', 'Titus': 'Titus', 'Philemon': 'Philemon', 'Hebrews': 'Hebrews', 'James': 'James',
    'I_Peter': 'I Peter', 'II_Peter': 'II Peter', 'I_John': 'I John', 'II_John': 'II John', 'III_John': 'III John', 'Jude': 'Jude',
    'Revelation': 'Revelation of John',
    'Genesis': 'Genesis', 'Exodus': 'Exodus', 'Leviticus': 'Leviticus', 'Numeri': 'Numbers', 'Deuteronomium': 'Deuteronomy', 'Iob': 'Job',
    'Psalmi': 'Psalms', 'Isaias': 'Isaiah', 'Ieremias': 'Jeremiah', 'Lamentationes': 'Lamentations', 'Ezechiel': 'Ezekiel', 'Daniel': 'Daniel',
    'Osee': 'Hosea', 'Ioel': 'Joel', 'Amos': 'Amos', 'Abdias': 'Obadiah', 'Ionas': 'Jonah', 'Michaeas': 'Micah', 'Nahum': 'Nahum',
    'Habacuc': 'Habakkuk', 'Sophonias': 'Zephaniah', 'Aggaeus': 'Haggai', 'Zacharias': 'Zechariah', 'Malachias': 'Malachi',
}
ARABIC_BOOK = {
    'Matthew': 'مت', 'Mark': 'مر', 'Luke': 'لو', 'John': 'يو', 'Acts': 'أع', 'Romans': 'رو', 'I Corinthians': '1كو', 'II Corinthians': '2كو',
    'Galatians': 'غل', 'Ephesians': 'أف', 'Philippians': 'في', 'Colossians': 'كو', 'I Thessalonians': '1تس', 'II Thessalonians': '2تس',
    'I Timothy': '1تي', 'II Timothy': '2تي', 'Titus': 'تي', 'Philemon': 'فل', 'Hebrews': 'عب', 'James': 'يع', 'I Peter': '1بط', 'II Peter': '2بط',
    'I John': '1يو', 'II John': '2يو', 'III John': '3يو', 'Jude': 'يه', 'Revelation of John': 'رؤ', 'Genesis': 'تك', 'Exodus': 'خر',
    'Leviticus': 'لا', 'Numbers': 'عد', 'Deuteronomy': 'تث', 'Job': 'أي', 'Psalms': 'مز', 'Isaiah': 'إش', 'Jeremiah': 'إر', 'Lamentations': 'مرا',
    'Ezekiel': 'حز', 'Daniel': 'دا', 'Hosea': 'هو', 'Joel': 'يؤ', 'Amos': 'عا', 'Obadiah': 'عو', 'Jonah': 'يون', 'Micah': 'مي', 'Nahum': 'نا',
    'Habakkuk': 'حب', 'Zephaniah': 'صف', 'Haggai': 'حج', 'Zechariah': 'زك', 'Malachi': 'ملا',
}

# ---------- Arabic ----------
arabic = collections.defaultdict(dict)  # (book, chapter) -> {verse: text}
for line in open(svd, encoding='utf-8'):
    m = re.match(r'^(.+?) (\d+):(\d+): (.*)$', line.strip())
    if m:
        arabic[(m[1], int(m[2]))][int(m[3])] = re.sub(r'[‎‏]', '', m[4]).strip()

def ar_key(s):
    s = re.sub(r'[ً-ْٰـ]', '', s)
    s = re.sub(r'[أإآٱ]', 'ا', s).replace('ى', 'ي').replace('ة', 'ه')
    return re.sub(r'\s+', ' ', re.sub(r'[^ء-ي\s]', ' ', s)).strip()

STOP = set(ar_key(w) for w in '''في من على الى الي عن ان لا لم لن ما هو هي هم هذا هذه ذلك التي الذي الذين كل قد ثم او اما بل حتى لكي كي اذا اذ مع لان لكن يا ايها انا انت نحن انتم كان كانت'''.split())

def ar_stem(w):
    """A rough stem for counting: no ال / بال / لل in front, no pronoun or plural ending (كتابه، الكتاب، كتب → كتاب، كتاب، كتب)."""
    w = re.sub(r'^(بال|كال|فال|لل|ال)(?=...)', '', w)
    w = re.sub(r'(هما|كما|هم|كم|هن|ها|نا|ون|ين|وا|ات|ه|ك|ي)$', '', w) if len(w) > 4 else w
    return w

def ar_tokens(s):
    """Arabic words for matching, as (stem, word as printed): و / ف in front taken off, stop words left out."""
    out = []
    plain = re.sub(r'[\u064b-\u0652\u0670\u0640]', '', s)
    for w in re.sub(r'[^\u0621-\u064a\s]', ' ', plain).split():
        k = ar_key(w)
        if len(k) > 3 and k[0] in 'وف' and k[1:] not in STOP:
            k, w = k[1:], w[1:]
        if k in STOP or len(k) < 2:
            continue
        out.append((ar_stem(k), w))
    return out

# ---------- Coptic ----------
def read_conllu(path):
    sents, cur = [], None
    for line in open(path, encoding='utf-8'):
        line = line.rstrip('\n')
        if line.startswith('# text = '):
            cur = {'text': line[9:], 'toks': []}
            sents.append(cur)
        elif line and not line.startswith('#') and cur is not None:
            c = line.split('\t')
            if '-' in c[0] or '.' in c[0]:
                continue
            cur['toks'].append({'form': c[1], 'lemma': c[2], 'upos': c[3], 'xpos': c[4], 'feats': c[5], 'head': c[6]})
    return sents

CONTENT = {'NOUN', 'VERB', 'ADJ', 'PROPN', 'ADV'}

def contexts(toks):
    """Each content word with what it needs to mean in Arabic: N (singular noun), M (plural), V (he did), S (anything)."""
    out = []
    for i, t in enumerate(toks):
        if t['upos'] not in CONTENT or len(t['lemma']) < 2:
            continue
        prev = toks[i - 1] if i else None
        prev2 = toks[i - 2] if i > 1 else None
        ctx = 'S'
        if t['upos'] in ('NOUN', 'ADJ') and prev and prev['upos'] == 'DET':
            ctx = 'M' if 'Number=Plur' in prev['feats'] else 'N'
        elif t['upos'] == 'VERB' and prev and prev2 and prev2['xpos'] == 'APST' and prev['upos'] == 'PRON' and 'Person=3' in prev['feats'] and 'Number=Sing' in prev['feats'] and 'Gender=Masc' in prev['feats']:
            ctx = 'V'
        gender = None
        if t['upos'] == 'NOUN' and prev and prev['upos'] == 'DET':
            f = prev['feats']
            gender = 'p' if 'Number=Plur' in f else 'f' if 'Gender=Fem' in f else 'm' if 'Gender=Masc' in f else None
        out.append((t['lemma'], t['form'], ctx, t['upos'], gender))
    return out

pairs = []  # (ref, coptic text, arabic text, coptic contexts, arabic tokens)
used = skipped = 0
for testament in ('bohairic.nt', 'bohairic.ot'):
    for path in sorted(glob.glob(os.path.join(corpora, testament, testament + '_CONLLU', '*.conllu'))):
        m = re.match(r'\d+_(.+)_(\d+)\.conllu$', os.path.basename(path))
        book = BOOKS.get(m[1])
        if not book:
            continue
        ch = int(m[2])
        sents = read_conllu(path)
        cands = [ch] + ([ch + 1, ch - 1] if book == 'Psalms' else [])
        target = next((c for c in cands if len(arabic.get((book, c), {})) == len(sents)), None)
        if target is None:
            skipped += 1
            continue
        used += 1
        verses = arabic[(book, target)]
        for i, s in enumerate(sents, 1):
            if not s['toks']:
                continue
            pairs.append((f'{ARABIC_BOOK[book]} {target}: {i}', s['text'].replace(' .', '').strip(), verses[i], contexts(s['toks']), ar_tokens(verses[i])))
print(f'chapters matched {used}, skipped {skipped}, verses {len(pairs)}', file=sys.stderr)
# HOLDOUT=n (testing only): every n-th verse is left out of the learning and written to bible-test.json.
if os.environ.get('HOLDOUT'):
    n = int(os.environ['HOLDOUT'])
    json.dump([[c, a, r] for i, (r, c, a, _, _) in enumerate(pairs) if i % n == 0], open(os.environ.get('TEST_OUT', 'bible-test.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    pairs = [p for i, p in enumerate(pairs) if i % n]

# ---------- IBM model 1: P(Arabic word | Coptic lemma) ----------
t = collections.defaultdict(dict)
for _, _, _, cs, ars in pairs:
    for lem, *_ in cs:
        for a, _ in ars:
            t[lem][a] = 1.0
for lem in t:
    n = len(t[lem])
    for a in t[lem]:
        t[lem][a] = 1.0 / n
for it in range(6):
    count = collections.defaultdict(lambda: collections.defaultdict(float))
    total = collections.defaultdict(float)
    for _, _, _, cs, ars in pairs:
        lems = [c[0] for c in cs] + ['<null>']
        for a, _ in ars:
            z = sum(t[l].get(a, 1e-6) if l != '<null>' else 0.05 for l in lems)
            for l in lems:
                if l == '<null>':
                    continue
                p = t[l].get(a, 1e-6) / z
                count[l][a] += p
                total[l] += p
    for l in count:
        t[l] = {a: c / total[l] for a, c in count[l].items() if c / total[l] > 1e-4}
    print('iteration', it + 1, file=sys.stderr)

# How many verses each lemma and each Arabic stem are in, and together: a link must be more than chance (Dice).
cv_c, cv_a, cv_ca = collections.Counter(), collections.Counter(), collections.Counter()
for _, _, _, cs, ars in pairs:
    lset, aset = {c[0] for c in cs}, {a for a, _ in ars}
    cv_c.update(lset); cv_a.update(aset)
    for l in lset:
        for a in aset:
            if t[l].get(a, 0) > 0.01:
                cv_ca[(l, a)] += 1
dice = lambda l, a: 2 * cv_ca[(l, a)] / (cv_c[l] + cv_a[a])

# Viterbi links: each Coptic word goes to the Arabic word of its verse it most likely means.
links = collections.defaultdict(lambda: collections.defaultdict(collections.Counter))  # lemma -> ctx -> arabic counts
forms_of = collections.defaultdict(collections.Counter)
genders = collections.defaultdict(collections.Counter)
upos_of = collections.defaultdict(collections.Counter)
freq = collections.Counter()
for _, _, _, cs, ars in pairs:
    if not ars:
        continue
    for lem, form, ctx, upos, gender in cs:
        stem, surface = max(ars, key=lambda a: t[lem].get(a[0], 0))
        if t[lem].get(stem, 0) < 0.05 or dice(lem, stem) < 0.12:
            continue
        links[lem][ctx][surface] += 1
        links[lem]['*'][stem] += 1
        freq[lem] += 1
        forms_of[lem][form] += 1
        upos_of[lem][upos] += 1
        if gender:
            genders[lem][gender] += 1

lemmas = {}
nouns, verbs = [], []
for lem, by in links.items():
    allc = by['*']
    a, n = allc.most_common(1)[0]
    if n < 3 or n / freq[lem] < 0.3:
        continue
    e = {}
    for ctx in 'NMVS':
        # The usual wording of the main meaning in this place: nouns without ال, the verb as "he did".
        forms = collections.Counter()
        for g, c in (by.get(ctx) or {}).items():
            if ar_stem(ar_key(g)) == a:
                forms[re.sub(r'^(بال|فال|لل|ال)(?=...)', '', g) if ctx != 'V' else g] += c
        if forms:
            g, c = forms.most_common(1)[0]
            if c >= 2 or ctx == 'S':
                e[ctx] = g
    if not e:
        continue
    e['n'] = n
    lemmas[lem] = e
    upos = upos_of[lem].most_common(1)[0][0]
    # Arabic → Coptic: nouns with their usual article's gender, verbs by their "he did" form.
    if upos == 'NOUN' and genders[lem]:
        g = genders[lem].most_common(1)[0][0]
        ar = e.get('M' if g == 'p' else 'N')
        if ar:
            nouns.append([ar, lem, g, n])
    if upos == 'VERB' and e.get('V'):
        verbs.append([e['V'], lem, n])
# Other spellings of a lemma in the text (ϫⲫⲉ for ϫⲫⲟ) point to it.
alias = {}
for lem in lemmas:
    for f, c in forms_of[lem].items():
        if f != lem and c >= 2 and f not in lemmas:
            alias[f] = lem

src = 'الكتاب المقدس: النص البحيري من Coptic SCRIPTORIUM (CC BY 4.0) وترجمة فاندايك العربية (1865، ملك عام)'
json.dump({'source': src, 'lemmas': lemmas, 'alias': alias, 'nouns': nouns, 'verbs': verbs},
          open('public/dict/bible-lex.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
json.dump({'source': src, 'verses': [[c, a, r] for r, c, a, _, _ in pairs]},
          open('public/dict/bible-verses.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(f'{len(lemmas)} lemmas, {len(alias)} other spellings, {len(nouns)} nouns, {len(verbs)} verbs, {len(pairs)} verses', file=sys.stderr)
