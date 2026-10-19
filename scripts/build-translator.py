#!/usr/bin/env python3
"""Builds public/dict/hymn-corpus.json for the sentence translator.

Input: corpus.json extracted from the St. George Nazlet El Seman hymn library (stgeorgesaman.com):
each hymn page has a word-by-word analysis table (segmented word, gloss) and the hymn text,
Coptic and Arabic line by line. We keep:
  forms: every analysed word form -> its most common segmentation and gloss
  morphs: every segment -> its glosses as a prefix (P), last piece (L) or whole word / stem (S)
  tm: Coptic line -> Arabic line, for exact and near matches (both ways)
  grammar: pieces from the grammar books (scripts/translator-grammar.json) the corpus never shows

Usage: python3 scripts/build-translator.py path/to/corpus.json [--holdout 10] [--out public/dict/hymn-corpus.json]
--holdout N leaves out every Nth hymn page and writes them to <out>.test.json, for measuring.
"""
import collections, json, re, sys, os

args = sys.argv[1:]
src = args[0]
holdout = int(args[args.index('--holdout') + 1]) if '--holdout' in args else 0
out = args[args.index('--out') + 1] if '--out' in args else 'public/dict/hymn-corpus.json'


def key(s, keep='-'):
    """Same as copticKey() in src/data/dictionary.ts: lowercase Coptic letters only."""
    chars = []
    for ch in s:
        o = ord(ch)
        if (0x2C80 <= o <= 0x2CE3 or 0x3E2 <= o <= 0x3EF) and o % 2 == 0:
            ch = chr(o + 1)
        chars.append(ch)
    return re.sub('[^Ⲁ-⳿Ϣ-ϯ' + re.escape(keep) + ']', '', ''.join(chars))


HARAKAT = re.compile('[ً-ْٰ]')
pages = json.load(open(src, encoding='utf-8'))
train, test = [], []
for i, p in enumerate(pages):
    (test if holdout and i % holdout == 0 else train).append(p)

gram = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'translator-grammar.json'), encoding='utf-8'))
PRE = {key(f): cls for f, g, cls in gram['prefixes']}
SUF = {key(f) for f, g in gram['suffixes']}
# Only after "he did" pieces is the stem glossed in the plain past form (ربط), which the app can inflect.
PAST = {key(f) for f, g, cls in gram['prefixes'] if g in ('هو قد', 'الذي هو قد')}
# Articles of the plural: the stem after them is glossed in the plural.
PLURAL = {key(f) for f, g, cls in gram['prefixes'] if cls == 'art' and (f.startswith('ⲛ') or f == 'ϩⲁⲛ')}

forms = collections.defaultdict(collections.Counter)
# How each form is written in the hymns (jinkim, capitals): shown when translating into Coptic.
spell = collections.defaultdict(collections.Counter)
# Per piece: P (glued in front), S (stem), L (glued at the end), V (stem right after a past-tense piece: the "he did" form),
# N / M (stem right after a singular / plural article or possessive: the noun).
morphs = collections.defaultdict(lambda: collections.defaultdict(collections.Counter))
trans = collections.defaultdict(collections.Counter)
tm = {}
for p in train:
    for u in p['units']:
        for r in u['analysis']:
            seg = '-'.join(x for x in key(r[0]).split('-') if x)
            gloss = r[-1].strip()
            if not seg or not gloss or gloss == '-':
                continue
            forms[seg.replace('-', '')][(seg, gloss)] += 1
            spell[seg.replace('-', '')][re.sub(r'[^Ⲁ-⳿Ϣ-ϯ̀]', '', r[0])] += 1
            parts = seg.split('-')
            bare = re.sub(r'\s*\(([^()]*)\)\s*$', '', gloss) if len(parts) > 1 else gloss
            gp = [x.strip() for x in re.split(r'\s+-\s+', bare)] if len(parts) > 1 else [gloss]
            if len(gp) != len(parts):
                continue
            stem = 0
            while stem < len(parts) - 1 and parts[stem] in PRE:
                stem += 1
            prev = '^'
            for j in range(stem):
                trans[prev][parts[j]] += 1
                prev = parts[j]
            trans[prev]['$'] += 1
            for j, (m, g) in enumerate(zip(parts, gp)):
                pos = 'P' if j < stem else 'S' if j == stem else 'L' if m in SUF else 'S'
                morphs[m][pos][g] += 1
                if pos == 'S' and j == stem and stem > 0:
                    before = parts[stem - 1]
                    if before in PAST:
                        morphs[m]['V'][g] += 1
                    elif PRE.get(before) == 'art':
                        morphs[m]['M' if before in PLURAL else 'N'][g] += 1
        cop, ara = u['coptic'], u['arabic']
        if cop and len(cop) == len(ara):
            for c, a in zip(cop, ara):
                c = re.sub(r'^[+/\d\s]+', '', c).strip()
                a = HARAKAT.sub('', re.sub(r'^[+/\d\s]+', '', a)).strip()
                pairs = [(c, a)]
                # Halves too, when both sides have the same number of ':' pauses.
                cs, as_ = c.split(':'), a.split(':')
                if len(cs) > 1 and len(cs) == len(as_):
                    pairs += zip(cs, as_)
                for cc, aa in pairs:
                    k = ' '.join(x for x in (key(w, '') for w in cc.split()) if x)
                    aa = aa.strip(' .:')
                    if k and aa and (len(k) > 6 or ' ' in k):
                        tm.setdefault(k, (' '.join(cc.split()).strip(' .:'), aa))

def written(f):
    """The usual spelling, lowercase unless the hymns always capitalise it (a name). Left out when it is the key itself."""
    c = spell[f]
    w = c.most_common(1)[0][0] if c else f
    if any(key(x[:1]) == x[:1] for x in c):
        w = key(w[:1]) + w[1:]
    return w if w != f else ''


data = {
    'source': 'مكتبة ألحان كنيسة مارجرجس نزلة السمان (stgeorgesaman.com)',
    'forms': sorted([[f, *c.most_common(1)[0][0], sum(c.values()), *([written(f)] if written(f) else [])] for f, c in forms.items()], key=lambda x: x[0]),
    'morphs': {m: {pos: [[g, n] for g, n in c.most_common(3)] for pos, c in v.items()} for m, v in sorted(morphs.items())},
    'trans': {a: dict(c.most_common()) for a, c in trans.items()},
    # Coptic line as written in the hymns, Arabic line.
    'tm': sorted([[c, a] for c, a in tm.values()]),
    'grammar': gram,
}
os.makedirs(os.path.dirname(out), exist_ok=True)
json.dump(data, open(out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(f"{out}: {len(data['forms'])} forms, {len(data['morphs'])} pieces, {len(data['tm'])} lines, {os.path.getsize(out) // 1024} KB")
if holdout:
    json.dump(test, open(out + '.test.json', 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'{len(test)} pages held out')
