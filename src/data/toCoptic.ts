import { copticKey } from './dictionary';
import { nameVariant, standardArabic } from './arabicVariants';
import { conjugatePast, conjugatePresent, libraryArabic, overlap, pastFromPresent, type Match, type Translator } from './translator';

/** Osama Thabet's Arabic → Coptic word lists (scripts/build-arabic-coptic.py): nouns with gender, verbs with how they take an object, prepositions. */
export interface ArabicLexicon {
  source: string;
  nouns: [string, string, Gender][];
  verbs: [string, string, 'n' | 'e' | '-'][];
  words: [string, string][];
}
let lexLoading: Promise<ArabicLexicon> | null = null;
export function loadArabicLexicon() {
  lexLoading ??= fetch('dict/arabic-coptic.json?v=1').then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<ArabicLexicon>; });
  lexLoading.catch(() => { lexLoading = null; });
  return lexLoading;
}

/**
 * Arabic → Coptic (Bohairic), the other way round from translator.ts, on the same hymn library.
 * 1. A line or half-line of a hymn's Arabic comes back as the hymn's own Coptic.
 * 2. Otherwise each Arabic word is looked up as the hymns translate it (المسيح → Ⲡⲓⲭ̀ⲣⲓⲥⲧⲟⲥ, دفنوه → ⲁⲩⲕⲟⲥϥ),
 *    or taken apart (و، بـ، لـ، الـ، possessive and object pronouns, the person and tense of a verb) and rebuilt
 *    from a Coptic stem with the matching Coptic pieces. Last, the dictionary's Arabic meanings.
 */

/** Arabic as we compare it: no harakat or tatweel, one alef, ى → ي, ة → ه. */
export const arKey = (s: string) => s
  .replace(/[ً-ْٰـ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[^ء-ي\s]/g, ' ').replace(/\s+/g, ' ').trim();

type Pos = 'noun' | 'verb' | 'other';
type Gender = 'm' | 'f' | 'p';
export interface CPiece { form: string; gloss: string }
export interface CWord {
  /** The Arabic word(s) this answers. */
  text: string;
  coptic: string;
  pieces: CPiece[];
  how: 'hymns' | 'grammar' | 'dictionary' | 'unknown';
  pos: Pos;
  /** Noun with an article or possessive in front: it can head a genitive or be a subject. */
  definite?: boolean;
  /** Bare noun: becomes definite when a definite noun follows it (إضافة). */
  bare?: { stem: string; gender: Gender };
  /** Verb in the past, third person: a definite noun after it is its subject and takes ⲛ̀ϫⲉ. */
  past3?: boolean;
  /** و in front, to be ⲛⲉⲙ before a noun and ⲟⲩⲟϩ before anything else. */
  and?: boolean;
  /** How we read a word we didn't know as typed: colloquial (عايز → يريد), another spelling of a name (ماركو → مرقس), or the closest known word. */
  as?: string;
  near?: boolean;
  /** Other Coptic words with this meaning (a Greek and a Coptic word for الله: ⲑⲉⲟⲥ and ⲫ̀ⲛⲟⲩϯ). */
  alts?: string[];
}
export interface CPhrase { text: string; words: CWord[]; coptic: string; match?: Match }
export interface CTranslation { phrases: CPhrase[]; coptic: string; whole?: Match }

const ART = { def: { m: 'ⲡⲓ', f: 'ϯ', p: 'ⲛⲓ' }, indef: { m: 'ⲟⲩ', f: 'ⲟⲩ', p: 'ϩⲁⲛ' } };
const ART_GENDER: Record<string, Gender> = { 'ⲡⲓ': 'm', 'ⲡ': 'm', 'ⲫ': 'm', 'ϯ': 'f', 'ⲧ': 'f', 'ⲑ': 'f', 'ⲛⲓ': 'p', 'ⲛ': 'p', 'ϩⲁⲛ': 'p' };
/** Arabic possessive ending → Coptic possessive article, masculine / feminine / plural. */
const POSS: [string, string, [string, string, string]][] = [
  ['كم', 'ـكم', ['ⲡⲉⲧⲉⲛ', 'ⲧⲉⲧⲉⲛ', 'ⲛⲉⲧⲉⲛ']], ['هم', 'ـهم', ['ⲡⲟⲩ', 'ⲧⲟⲩ', 'ⲛⲟⲩ']], ['ها', 'ـها', ['ⲡⲉⲥ', 'ⲧⲉⲥ', 'ⲛⲉⲥ']],
  ['نا', 'ـنا', ['ⲡⲉⲛ', 'ⲧⲉⲛ', 'ⲛⲉⲛ']], ['ه', 'ـه', ['ⲡⲉϥ', 'ⲧⲉϥ', 'ⲛⲉϥ']], ['ك', 'ـك', ['ⲡⲉⲕ', 'ⲧⲉⲕ', 'ⲛⲉⲕ']], ['ي', 'ـي', ['ⲡⲁ', 'ⲧⲁ', 'ⲛⲁ']],
];
/** Arabic object ending → ⲙ̀ⲙⲟ- with the pronoun (the direct object that fits any verb). */
const OBJ: [string, string, string][] = [
  ['كم', 'ـكم', 'ⲙ̀ⲙⲱⲧⲉⲛ'], ['هم', 'ـهم', 'ⲙ̀ⲙⲱⲟⲩ'], ['ها', 'ـها', 'ⲙ̀ⲙⲟⲥ'], ['نا', 'ـنا', 'ⲙ̀ⲙⲟⲛ'], ['ني', 'ـني', 'ⲙ̀ⲙⲟⲓ'], ['ه', 'ـه', 'ⲙ̀ⲙⲟϥ'], ['ك', 'ـك', 'ⲙ̀ⲙⲟⲕ'],
];
/** The same with ⲉ̀ⲣⲟ-, for verbs that take their object with ⲉ̀. */
const ERO: Record<string, string> = { 'ⲙ̀ⲙⲱⲧⲉⲛ': 'ⲉ̀ⲣⲱⲧⲉⲛ', 'ⲙ̀ⲙⲱⲟⲩ': 'ⲉ̀ⲣⲱⲟⲩ', 'ⲙ̀ⲙⲟⲥ': 'ⲉ̀ⲣⲟⲥ', 'ⲙ̀ⲙⲟⲛ': 'ⲉ̀ⲣⲟⲛ', 'ⲙ̀ⲙⲟⲓ': 'ⲉ̀ⲣⲟⲓ', 'ⲙ̀ⲙⲟϥ': 'ⲉ̀ⲣⲟϥ', 'ⲙ̀ⲙⲟⲕ': 'ⲉ̀ⲣⲟⲕ' };
const PERSONS = ['3ms', '3fs', '3p', '1s', '1p', '2ms', '2p', '2fs'] as const;
const PAST: Record<string, string> = { '1s': 'ⲁⲓ', '2ms': 'ⲁⲕ', '2fs': 'ⲁⲣⲉ', '3ms': 'ⲁϥ', '3fs': 'ⲁⲥ', '1p': 'ⲁⲛ', '2p': 'ⲁⲣⲉⲧⲉⲛ', '3p': 'ⲁⲩ' };
const PRESENT: Record<string, string> = { '1s': 'ϯ', '2ms': 'ⲭ̀', '2fs': 'ⲧⲉ', '3ms': 'ϥ', '3fs': 'ⲥ', '1p': 'ⲧⲉⲛ', '2p': 'ⲧⲉⲧⲉⲛ', '3p': 'ⲥⲉ' };
const FUTURE: Record<string, string> = { '1s': 'ϯⲛⲁ', '2ms': 'ⲭ̀ⲛⲁ', '2fs': 'ⲧⲉⲣⲉⲛⲁ', '3ms': 'ϥⲛⲁ', '3fs': 'ⲥⲛⲁ', '1p': 'ⲧⲉⲛⲛⲁ', '2p': 'ⲧⲉⲧⲉⲛⲛⲁ', '3p': 'ⲥⲉⲛⲁ' };
/** Negative past: ⲙ̀ⲡⲉϥ instead of ⲁϥ. */
const NEG_PAST: Record<string, string> = { 'ⲁⲓ': 'ⲙ̀ⲡⲓ', 'ⲁⲕ': 'ⲙ̀ⲡⲉⲕ', 'ⲁⲣⲉ': 'ⲙ̀ⲡⲉ', 'ⲁϥ': 'ⲙ̀ⲡⲉϥ', 'ⲁⲥ': 'ⲙ̀ⲡⲉⲥ', 'ⲁⲛ': 'ⲙ̀ⲡⲉⲛ', 'ⲁⲣⲉⲧⲉⲛ': 'ⲙ̀ⲡⲉⲧⲉⲛ', 'ⲁⲩ': 'ⲙ̀ⲡⲟⲩ' };
const WHO: Record<string, string> = { '1s': 'أنا', '2ms': 'أنت', '2fs': 'أنتِ', '3ms': 'هو', '3fs': 'هي', '1p': 'نحن', '2p': 'أنتم', '3p': 'هم' };
/** Particles the hymns gloss too many ways to pick by count. */
const FIXED: Record<string, [string, Pos]> = {
  'في': ['ϧⲉⲛ', 'other'], 'على': ['ϩⲓϫⲉⲛ', 'other'], 'علي': ['ϩⲓϫⲉⲛ', 'other'], 'مع': ['ⲛⲉⲙ', 'other'], 'من': ['ⲉ̀ⲃⲟⲗ ϧⲉⲛ', 'other'],
  'الي': ['ϣⲁ', 'other'], 'لان': ['ϫⲉ', 'other'], 'يا': ['ⲱ̀', 'other'], 'ايها': ['ⲱ̀', 'other'], 'لاجل': ['ⲉⲑⲃⲉ', 'other'], 'من اجل': ['ⲉⲑⲃⲉ', 'other'],
  'هذا': ['ⲫⲁⲓ', 'other'], 'هذه': ['ⲑⲁⲓ', 'other'], 'هولاء': ['ⲛⲁⲓ', 'other'], 'الذي': ['ⲫⲏⲉⲧ', 'other'], 'التي': ['ⲑⲏⲉⲧ', 'other'], 'الذين': ['ⲛⲏⲉⲧ', 'other'],
  'انا': ['ⲁ̀ⲛⲟⲕ', 'other'], 'انت': ['ⲛ̀ⲑⲟⲕ', 'other'], 'هو': ['ⲛ̀ⲑⲟϥ', 'other'], 'هي': ['ⲛ̀ⲑⲟⲥ', 'other'], 'نحن': ['ⲁ̀ⲛⲟⲛ', 'other'], 'انتم': ['ⲛ̀ⲑⲱⲧⲉⲛ', 'other'], 'هم': ['ⲛ̀ⲑⲱⲟⲩ', 'other'],
  'كل': ['ⲛⲓⲃⲉⲛ', 'other'], 'جدا': ['ⲉ̀ⲙⲁϣⲱ', 'other'], 'ايضا': ['ⲟⲛ', 'other'], 'الان': ['ϯⲛⲟⲩ', 'other'], 'لا': ['ⲁⲛ', 'other'], 'ليس': ['ⲁⲛ', 'other'],
  'و': ['ⲟⲩⲟϩ', 'other'], 'قد': ['', 'other'], 'كما': ['ⲕⲁⲧⲁ ⲫ̀ⲣⲏϯ', 'other'], 'مثل': ['ⲙ̀ⲫ̀ⲣⲏϯ', 'other'], 'امين': ['ⲁ̀ⲙⲏⲛ', 'other'], 'القدس': ['ⲉⲑⲟⲩⲁⲃ', 'other'], 'القدوس': ['ⲉⲑⲟⲩⲁⲃ', 'other'], 'هللويا': ['ⲁⲗⲗⲏⲗⲟⲩⲓⲁ', 'other'],
};

interface Lex { coptic: string; n: number; pos: Pos; gender?: Gender; stem?: string; gloss: string; past3?: boolean }
interface Verb { stem: string; n: number; person: string; tense: 'past' | 'present' }
export interface Reverse {
  lex: Map<string, Lex>;
  nouns: Map<string, { stem: string; n: number; gender: Gender }>;
  verbs: Map<string, Verb>;
  /** Present forms only: نحب is "we love" after بـ, though alone it reads as the past "he sobbed". */
  present: Map<string, Verb>;
  dict: Map<string, string>;
  /** Every Coptic word for one Arabic meaning, the ones the hymns use first. */
  alts: Map<string, string[]>;
  /** Prepositions, also with their pronoun (معك → ⲛⲉⲙⲁⲕ). */
  words: Map<string, string>;
  /** Verbs (by stem key) that take their object with ⲉ̀ⲣⲟ- rather than ⲙ̀ⲙⲟ-. */
  ero: Set<string>;
  /** Built with Osama Thabet's word lists. */
  full: boolean;
  tm: Map<string, number>;
  tmIndex: Map<string, number[]>;
  /** Arabic line key, Coptic as written, Arabic as printed. */
  tmList: [string, string, string][];
  refs: Map<number, string>;
}

/** The written form minus its first n Coptic letters (jinkim after them goes with them). */
function dropLetters(written: string, n: number) {
  let i = 0;
  const chars = [...written];
  while (n > 0 && i < chars.length) { if (copticKey(chars[i])) n--; i++; while (chars[i] === '̀') i++; }
  return chars.slice(i).join('');
}
const better = <T extends { n: number }>(m: Map<string, T>, k: string, v: T) => { const o = m.get(k); if (!o || v.n > o.n) m.set(k, v); };
/** Prepositions the library glues to the next word (ϧⲉⲛⲂⲏⲑⲗⲉⲉⲙ) are written apart. */
const APART = new Set(['ϧⲉⲛ', 'ⲛⲉⲙ', 'ϩⲓϫⲉⲛ', 'ⲉⲃⲟⲗ', 'ϩⲓⲧⲉⲛ', 'ⲉⲑⲃⲉ', 'ⲛⲁϩⲣⲉⲛ', 'ⲕⲁⲧⲁ']);
/** One Arabic word, bare: no "ال", no harakat. */
const oneWord = (s: string) => /^[ء-ي]{2,}$/.test(s);

const cache = new WeakMap<Translator, Reverse>();
export function reverseOf(t: Translator, extra?: ArabicLexicon): Reverse {
  const dict = t.dict;
  const hit = cache.get(t);
  if (hit && (hit.full || !extra)) { addLines(t, hit); return hit; }
  const lex = new Map<string, Lex>(), nouns = new Map<string, { stem: string; n: number; gender: Gender }>(), verbs = new Map<string, Verb>();
  const genders = new Map<string, Record<Gender, number>>();
  const pastVerbs = new Map<string, { stem: string; n: number }>(), presentVerbs = new Map<string, { stem: string; n: number }>();
  for (const [seg, gloss, n, written] of t.forms.values()) {
    const segs = seg.split('-');
    const ar = arKey(libraryArabic(gloss, segs.length));
    const parts = segs.length > 1 ? gloss.replace(/\s*\([^()]*\)\s*$/, '').split(/\s+-\s+/).map(arKey) : [arKey(gloss)];
    const first = t.prefixes.get(segs[0]);
    const pos: Pos = segs.length > 1 && first?.cls === 'art' ? 'noun' : segs.length > 1 && first?.cls === 'conj' ? 'verb' : 'other';
    const past3 = segs.length > 1 && (segs[0] === 'ⲁϥ' || segs[0] === 'ⲁⲥ' || segs[0] === 'ⲁⲩ');
    const coptic = segs.length > 1 && APART.has(segs[0]) ? apart(written, segs[0].length) : written;
    // ⲛ̀ / ⲙ̀ in front (genitive, object) has no Arabic word: the word on its own goes under that Arabic, below forms seen without it.
    const linked = segs.length > 1 && (segs[0] === 'ⲛ' || segs[0] === 'ⲙ') && /ربط|إضافة|مفعول/.test(gloss.split(' - ')[0]);
    if (ar && ar.split(' ').length <= 3) better(lex, ar, linked ? { coptic: dropLetters(written, 1), n: n / 4, pos, gloss, past3 } : { coptic, n, pos, gloss, past3 });
    if (segs.length === 2 && parts.length === 2 && oneWord(parts[1])) {
      const stem = dropLetters(written, segs[0].length);
      const g = ART_GENDER[segs[0]];
      if (g) {
        const c = genders.get(segs[1]) ?? { m: 0, f: 0, p: 0 };
        c[g] += n; genders.set(segs[1], c);
        better(nouns, parts[1].replace(/^ال(?=..)/, ''), { stem, n, gender: g });
      }
      if (segs[0] === 'ⲁϥ') better(pastVerbs, parts[1], { stem, n });
      if (segs[0] === 'ϥ') better(presentVerbs, parts[1], { stem, n });
    }
  }
  // Stems the hymns use after "he did" pieces with other persons too.
  for (const [m, v] of Object.entries(t.morphs)) {
    const g = v.V?.[0];
    if (g && m.length >= 2) { const ar = arKey(g[0].replace(/\s*\(.*\)$/, '')); if (oneWord(ar)) better(pastVerbs, ar, { stem: m, n: g[1] }); }
  }
  // The Bible's nouns (with the gender of their article) and verbs, after the hymns.
  for (const [a, c, g] of t.bible?.nouns ?? []) { const k = arKey(a); if (oneWord(k)) better(nouns, k, { stem: c, n: 0.55, gender: g }); }
  for (const [a, c] of t.bible?.verbs ?? []) { const k = arKey(a); if (oneWord(k)) better(pastVerbs, k, { stem: c, n: 0.55 }); }
  // Osama Thabet's Arabic → Coptic lists, after the hymns; a Coptic word the hymns use wins over one they don't.
  const words = new Map<string, string>(), ero = new Set<string>();
  if (extra) {
    const inHymns = (c: string) => t.stems.has(copticKey(c)) ? 0.6 : 0.5;
    // A plural entry is only taken when nothing singular has the same Arabic.
    for (const [a, c, g] of extra.nouns) { const k = arKey(a); if (oneWord(k)) better(nouns, k, { stem: c, n: inHymns(c) - (g === 'p' ? 0.2 : 0), gender: g }); }
    for (const [a, c, how] of extra.verbs) {
      const k = arKey(a);
      if (!oneWord(k) || c.includes(' ')) continue;
      better(presentVerbs, k, { stem: c, n: inHymns(c) });
      const past = pastFromPresent(k);
      if (past) better(pastVerbs, past, { stem: c, n: inHymns(c) });
      if (how === 'e') ero.add(copticKey(c));
    }
    for (const [a, c] of extra.words) { const k = arKey(a); if (k && !words.has(k)) words.set(k, c); }
  }
  // The dictionary's verbs ("يفتح": the absolute state) and nouns with their gender, below anything the hymns show.
  for (const e of dict) {
    const ar = arKey((e.meanings[0] ?? '').split(/[،,;؛/(]/)[0]);
    if (!oneWord(ar) || copticKey(e.word).length < 2) continue;
    if (/^فعل/.test(e.kind) && (!e.form || /مصدرية/.test(e.form))) {
      if (!presentVerbs.has(ar)) presentVerbs.set(ar, { stem: copticKey(e.word), n: 0 });
      const past = pastFromPresent(ar);
      if (past && !pastVerbs.has(past)) pastVerbs.set(past, { stem: copticKey(e.word), n: 0 });
    } else if (/^اسم/.test(e.kind) && /^(مذكر|مؤنث|جمع)$/.test(e.form) && !nouns.has(ar)) {
      nouns.set(ar, { stem: e.word, n: 0, gender: e.form === 'مذكر' ? 'm' : e.form === 'مؤنث' ? 'f' : 'p' });
    }
  }
  // A noun's gender is the article it takes most in the hymns, not the one it happened to take with this Arabic word.
  for (const [ar, v] of nouns) {
    const c = genders.get(copticKey(v.stem));
    if (c) v.gender = (Object.entries(c) as [Gender, number][]).sort((a, b) => b[1] - a[1])[0][0];
    nouns.set(ar, v);
  }
  for (const [ar, v] of pastVerbs) for (const p of PERSONS) {
    const f = conjugatePast(ar, p);
    if (f) better(verbs, arKey(f), { stem: v.stem, n: v.n, person: p, tense: 'past' });
  }
  const present = new Map<string, Verb>();
  for (const [ar, v] of presentVerbs) for (const p of PERSONS) {
    const f = conjugatePresent(ar, p);
    if (!f) continue;
    if (!verbs.has(arKey(f))) verbs.set(arKey(f), { stem: v.stem, n: v.n, person: p, tense: 'present' });
    better(present, arKey(f), { stem: v.stem, n: v.n, person: p, tense: 'present' });
  }
  // The dictionary: each meaning's first wording → the shortest Coptic word with it.
  const dmap = new Map<string, string>();
  for (const e of dict) for (const m of e.meanings.slice(0, 3)) {
    const k = arKey(m.split(/[،,;؛/(]/)[0]);
    if (!k || k.split(' ').length > 2) continue;
    const o = dmap.get(k);
    if (!o || copticKey(e.word).length < copticKey(o).length) dmap.set(k, e.word);
  }
  // How many dictionaries give each word for a meaning: the word most of them give comes first.
  const altCount = new Map<string, Map<string, { word: string; n: number }>>();
  for (const e of dict) for (const m of e.meanings.slice(0, 4)) {
    const k = arKey(m.split(/[،,;؛/(]/)[0]).replace(/^ال(?=...)/, '');
    const ck = copticKey(e.word);
    if (!k || k.split(' ').length > 2 || ck.length < 2 || ck === 'ⲫϯ') continue;
    const per = altCount.get(k) ?? new Map();
    const o = per.get(ck);
    per.set(ck, { word: o?.word ?? e.word, n: (o?.n ?? 0) + 1 });
    altCount.set(k, per);
  }
  const hymnFirst = (c: string) => t.stems.has(copticKey(c)) ? 0 : 1;
  const alts = new Map<string, string[]>();
  for (const [k, per] of altCount) alts.set(k, [...per.values()].sort((a, b) => hymnFirst(a.word) - hymnFirst(b.word) || b.n - a.n || copticKey(a.word).length - copticKey(b.word).length).slice(0, 6).map(x => x.word));
  const r: Reverse = { lex, nouns, verbs, present, dict: dmap, alts, words, ero, full: !!extra, tm: new Map(), tmIndex: new Map(), tmList: [], refs: t.refs };
  addLines(t, r);
  cache.set(t, r);
  return r;
}

/** The translator's lines (hymns, then Bible verses once loaded) keyed by their Arabic. */
function addLines(t: Translator, r: Reverse) {
  for (let i = r.tmList.length; i < t.tmList.length; i++) {
    const [, ar, cop] = t.tmList[i], k = arKey(ar);
    r.tmList.push([k, cop, ar]);
    if (!r.tm.has(k)) r.tm.set(k, i);
    for (const w of new Set(k.split(' '))) { const l = r.tmIndex.get(w); if (l) l.push(i); else r.tmIndex.set(w, [i]); }
  }
}
function apart(written: string, n: number) { const rest = dropLetters(written, n); return written.slice(0, written.length - rest.length) + ' ' + rest; }

/** ⲛ̀ before a labial is ⲙ̀. */
const linkN = (w: string) => (/^[ⲡⲃⲙⲫⲯ]/.test(copticKey(w[0] ?? '')) ? 'ⲙ̀' : 'ⲛ̀') + w;

function noun(r: Reverse, w: string): { stem: string; gender: Gender } | undefined {
  return r.nouns.get(w) ?? (w.endsWith('ت') ? r.nouns.get(w.slice(0, -1) + 'ه') : undefined);
}

/** fromDict: also verbs only the dictionary knows, which are tried after every other reading. */
function verb(r: Reverse, w: string, future: boolean, fromDict = false): CWord | null {
  const v = r.verbs.get(w);
  if (!v || (!v.n && !fromDict)) return null;
  return verbWord(v, w, future);
}
function verbWord(v: Verb, w: string, future: boolean): CWord {
  const pre = v.tense === 'past' ? PAST[v.person] : future ? FUTURE[v.person] : PRESENT[v.person];
  return {
    text: w, coptic: pre + v.stem, pos: 'verb', how: 'grammar', past3: v.tense === 'past' && v.person.startsWith('3'),
    pieces: [{ form: pre, gloss: `${WHO[v.person]} ${v.tense === 'past' ? '(ماضي)' : future ? 'سوف' : '(مضارع)'}` }, { form: v.stem, gloss: w }],
  };
}

const objectOf = (r: Reverse, v: CWord, mmo: string) => r.ero.has(copticKey(v.pieces[1]?.form ?? '')) ? ERO[mmo] ?? mmo : mmo;

/** One Arabic word (already arKey'd) → Coptic. */
export function wordToCoptic(r: Reverse, w: string, future = false): CWord {
  const fixed = FIXED[w];
  if (fixed) return { text: w, coptic: fixed[0], pieces: [{ form: fixed[0], gloss: w }], how: 'grammar', pos: fixed[1] };
  const l = r.lex.get(w);
  if (l) {
    // A bare noun (not a name) can still become the head of a genitive.
    const n = l.pos === 'other' && !w.startsWith('ال') && copticKey(l.coptic[0]) === l.coptic[0] ? noun(r, w) : undefined;
    return { text: w, coptic: l.coptic, pieces: [{ form: l.coptic, gloss: l.gloss }], how: 'hymns', pos: n ? 'noun' : l.pos, bare: n, definite: l.pos === 'noun' && !/^(ⲟⲩ|ϩⲁⲛ)/.test(copticKey(l.coptic)), past3: l.past3 };
  }
  const pw = r.words.get(w);
  if (pw) return { text: w, coptic: pw, pieces: [{ form: pw, gloss: w }], how: 'dictionary', pos: 'other' };
  // و / ف in front.
  if (/^[وف]/.test(w) && w.length > 2) {
    const rest = wordToCoptic(r, w.slice(1), future);
    if (rest.how !== 'unknown') return { ...rest, text: w, and: true };
  }
  // بـ / لـ / كـ, with or without "ال" (بال، لل).
  const prep = w.match(/^(ب|ك|ل)(?=..)/);
  if (prep) {
    const rest = w.startsWith('لل') ? 'ال' + w.slice(2) : w.slice(1);
    const inner = r.lex.get(rest) ? wordToCoptic(r, rest) : definiteNoun(r, rest) ?? possessed(r, rest);
    if (inner && inner.how !== 'unknown' && inner.pos !== 'verb') {
      const [form, gloss] = prep[1] === 'ب' ? ['ϧⲉⲛ ', 'بـ / في'] : prep[1] === 'ك' ? ['ⲙ̀ⲫ̀ⲣⲏϯ ', 'مثل'] : ['ⲉ̀', 'لـ'];
      return { ...inner, text: w, coptic: form + inner.coptic, pieces: [{ form: form.trim(), gloss }, ...inner.pieces], how: 'grammar' };
    }
  }
  const d = definiteNoun(r, w);
  if (d) return d;
  // Verbs: س for the future, then an object pronoun at the end.
  if (w.startsWith('س') && w.length > 3) { const v = verb(r, w.slice(1), true); if (v && !v.past3 && v.pieces[0].form !== PAST['1s']) return { ...v, text: w }; }
  const v = verb(r, w, future);
  if (v) return v;
  // رأيته / كتبتها: a past ending before the pronoun means a verb, not a noun with a possessive.
  const withObject = (strict: boolean): CWord | null => {
    for (const [end, gloss, obj] of OBJ) {
      if (!w.endsWith(end) || w.length < end.length + 3) continue;
      const base = w.slice(0, -end.length);
      if (strict && !/(ت|تم|نا|و)$/.test(base)) continue;
      // دفنوه ← دفنوا، أعطاني ← أعطى
      const v2 = verb(r, base, future) ?? verb(r, base + 'ا', future) ?? (base.endsWith('ا') ? verb(r, base.slice(0, -1) + 'ي', future) : null);
      if (v2) { const o = objectOf(r, v2, obj); return { ...v2, text: w, coptic: v2.coptic + ' ' + o, pieces: [...v2.pieces, { form: o, gloss }] }; }
    }
    return null;
  };
  const vo = withObject(true) ?? possessed(r, w) ?? withObject(false);
  if (vo) return vo;
  // Tanween alif: خبزا ← خبز.
  if (w.endsWith('ا') && w.length > 3 && noun(r, w.slice(0, -1))) return wordToCoptic(r, w.slice(0, -1), future);
  const n = noun(r, w);
  if (n) {
    const art = ART.indef[n.gender];
    return { text: w, coptic: art + n.stem, pieces: [{ form: art, gloss: 'نكرة' }, { form: n.stem, gloss: w }], how: 'grammar', pos: 'noun', bare: n };
  }
  const dw = r.dict.get(w) ?? r.dict.get(w.replace(/^ال/, ''));
  if (dw) return { text: w, coptic: dw, pieces: [{ form: dw, gloss: w }], how: 'dictionary', pos: 'other' };
  const dv = verb(r, w, future, true) ?? (w.startsWith('س') && w.length > 3 ? verb(r, w.slice(1), true, true) : null);
  if (dv) return { ...dv, text: w, how: 'dictionary' };
  for (const [end, gloss, obj] of OBJ) {
    if (!w.endsWith(end) || w.length < end.length + 3) continue;
    const v2 = verb(r, w.slice(0, -end.length), future, true);
    if (v2) { const o = objectOf(r, v2, obj); return { ...v2, text: w, how: 'dictionary', coptic: v2.coptic + ' ' + o, pieces: [...v2.pieces, { form: o, gloss }] }; }
  }
  return { text: w, coptic: '', pieces: [], how: 'unknown', pos: 'other' };
}

function definiteNoun(r: Reverse, w: string): CWord | null {
  if (!w.startsWith('ال') || w.length < 4) return null;
  const n = noun(r, w.slice(2));
  if (!n) return null;
  const art = ART.def[n.gender];
  return { text: w, coptic: art + n.stem, pieces: [{ form: art, gloss: 'الـ' }, { form: n.stem, gloss: w.slice(2) }], how: 'grammar', pos: 'noun', definite: true };
}

function possessed(r: Reverse, w: string): CWord | null {
  for (const [end, gloss, arts] of POSS) {
    if (!w.endsWith(end) || w.length < end.length + 2) continue;
    const n = noun(r, w.slice(0, -end.length));
    if (!n) continue;
    const art = arts[n.gender === 'm' ? 0 : n.gender === 'f' ? 1 : 2];
    return { text: w, coptic: art + n.stem, pieces: [{ form: art, gloss }, { form: n.stem, gloss: w.slice(0, -end.length) }], how: 'grammar', pos: 'noun', definite: true };
  }
  return null;
}

/** The closest Arabic line in the hymns, with its Coptic. */
export function nearestArabic(r: Reverse, k: string, min = 0.6): Match | undefined {
  const exact = r.tm.get(k);
  if (exact !== undefined) return { coptic: r.tmList[exact][1], arabic: r.tmList[exact][2], score: 1, ref: r.refs.get(exact) };
  const words = k.split(' ').filter(Boolean);
  if (words.length < 2) return undefined;
  const hits = new Map<number, number>();
  for (const w of new Set(words)) for (const i of (r.tmIndex.get(w) ?? []).slice(0, 4000)) hits.set(i, (hits.get(i) ?? 0) + 1);
  let best: Match | undefined;
  for (const [i, n] of hits) {
    if (n < 2) continue;
    const [ak, cop, ar] = r.tmList[i];
    const other = ak.split(' ');
    const score = (2 * overlap(words, other)) / (words.length + other.length);
    if (score >= min && score < 1 && (!best || score > best.score)) best = { coptic: cop, arabic: ar, score, ref: r.refs.get(i) };
  }
  return best;
}

/** A run of Arabic words → Coptic words, longest hymn wording first (يا سيدي → ⲡⲁϭⲟⲓⲥ). */
export function phraseToCoptic(r: Reverse, text: string): CWord[] {
  const toks = arKey(text).split(' ').filter(Boolean);
  const out: CWord[] = [];
  let future = false;
  for (let i = 0; i < toks.length;) {
    if (toks[i] === 'سوف') { future = true; i++; continue; }
    let done = false;
    for (let n = Math.min(3, toks.length - i); n >= 2 && !done; n--) {
      const k = toks.slice(i, i + n).join(' ');
      const l = FIXED[k] ? null : r.lex.get(k);
      if (l || FIXED[k]) { out.push(FIXED[k] ? { text: k, coptic: FIXED[k][0], pieces: [{ form: FIXED[k][0], gloss: k }], how: 'grammar', pos: FIXED[k][1] } : { text: k, coptic: l!.coptic, pieces: [{ form: l!.coptic, gloss: l!.gloss }], how: 'hymns', pos: l!.pos, definite: l!.pos === 'noun', past3: l!.past3 }); i += n; done = true; }
    }
    if (done) continue;
    // Names and colloquial words first, unless the hymns themselves use the word (روح is a spirit there).
    const u = r.lex.has(toks[i]) && !nameVariant(toks[i]) ? undefined : understood(r, toks[i], future);
    const w = u ?? wordToCoptic(r, toks[i], future);
    out.push(w.how === 'unknown' ? nearest(r, toks[i], future) ?? w : w);
    future = false;
    i++;
  }
  // إضافة: a bare noun before a definite one takes the article, and the second is joined with ⲛ̀.
  for (let i = 0; i + 1 < out.length; i++) {
    const a = out[i], b = out[i + 1];
    if (a.bare && !a.and && b.pos === 'noun' && b.definite && !b.and) {
      const art = ART.def[a.bare.gender];
      out[i] = { ...a, coptic: art + a.bare.stem, pieces: [{ form: art, gloss: 'الـ' }, ...a.pieces.slice(1)], definite: true, bare: undefined };
      out[i + 1] = { ...b, coptic: linkN(b.coptic), pieces: [{ form: 'ⲛ̀', gloss: 'للإضافة' }, ...b.pieces] };
    }
  }
  // و: ⲛⲉⲙ joins nouns, ⲟⲩⲟϩ joins sentences. A definite subject after a verb in the past takes ⲛ̀ϫⲉ.
  const final: CWord[] = [];
  out.forEach((w, i) => {
    if (w.and) final.push({ text: 'و', coptic: w.pos === 'noun' ? 'ⲛⲉⲙ' : 'ⲟⲩⲟϩ', pieces: [], how: 'grammar', pos: 'other' });
    if (w.pos === 'noun' && w.definite && !w.and && out[i - 1]?.past3 && !/^ⲛ̀|^ⲙ̀/.test(w.coptic)) final.push({ text: '', coptic: 'ⲛ̀ϫⲉ', pieces: [], how: 'grammar', pos: 'other' });
    final.push(w);
  });
  return final;
}

/** A name spelled another way (ماركو → مرقس) or colloquial Arabic (عايز، بيصلي، ماشافش), read as the Arabic we know. */
function understood(r: Reverse, w: string, future: boolean): CWord | undefined {
  const name = nameVariant(w);
  if (name) return { text: w, coptic: name.coptic, pieces: [{ form: name.coptic, gloss: name.name }], how: 'grammar', pos: 'noun', definite: true, as: name.name !== w ? name.name : undefined };
  const std = standardArabic(w);
  if (!std) return undefined;
  const words = std.text.split(' ');
  const not = words[0] === 'لا' && words.length > 1;
  if (not) words.shift();
  const parts = words.map(x => {
    // بيصلي / هيصلي: only a present verb will do (بيده is not "his hand" here).
    if (!std.verb) return wordToCoptic(r, x, future);
    const fut = x.startsWith('س');
    const v = r.present.get(fut ? x.slice(1) : x);
    return v ? verbWord(v, x, fut || future) : null;
  });
  if (parts.some(p => !p || p.how === 'unknown')) return undefined;
  const ps = parts as CWord[];
  let coptic = ps.map(p => p.coptic).filter(Boolean).join(' ');
  let pieces = ps.flatMap(p => p.pieces);
  if (not && ps.length === 1 && ps[0].pos === 'verb') {
    // ماشافش → ⲙ̀ⲡⲉϥⲛⲁⲩ، مابيصليش → ⲛ̀ϥϣⲗⲏⲗ ⲁⲛ
    const past = Object.keys(NEG_PAST).sort((x, y) => y.length - x.length).find(p => coptic.startsWith(p));
    if (past) { coptic = NEG_PAST[past] + coptic.slice(past.length); pieces = [{ form: NEG_PAST[past], gloss: 'لم (نفي الماضي)' }, ...(pieces[0]?.form === past ? pieces.slice(1) : pieces)]; }
    else { coptic = 'ⲛ̀' + coptic + ' ⲁⲛ'; pieces = [{ form: 'ⲛ̀', gloss: 'نفي' }, ...pieces, { form: 'ⲁⲛ', gloss: 'نفي' }]; }
  } else if (not) { coptic = 'ⲁⲛ ' + coptic; pieces = [{ form: 'ⲁⲛ', gloss: 'لا' }, ...pieces]; }
  const last = ps[ps.length - 1];
  return { ...last, text: w, coptic, pieces, how: ps.some(p => p.how === 'dictionary') ? 'dictionary' : 'grammar', past3: not ? false : last.past3, as: std.text };
}

/** A word we still don't know: the known word one letter away, if there is one. */
function nearest(r: Reverse, w: string, future: boolean): CWord | undefined {
  const near = nearWord(r, w);
  if (!near) return undefined;
  const k = wordToCoptic(r, near, future);
  return k.how === 'unknown' ? undefined : { ...k, text: w, as: near, near: true };
}

/** Known words one letter away (one added, missing or different), found through their one-letter deletions. */
const deletions = new WeakMap<Reverse, Map<string, string>>();
const dels = (w: string) => [...w].map((_, i) => w.slice(0, i) + w.slice(i + 1));
function nearWord(r: Reverse, w: string): string | undefined {
  if (w.length < 5) return undefined;
  let m = deletions.get(r);
  if (!m) {
    m = new Map();
    for (const [k, l] of r.lex) if (k.length >= 4 && !k.includes(' ') && l.n >= 1) {
      if (!m.has(k)) m.set(k, k);
      for (const d of dels(k)) if (!m.has(d)) m.set(d, k);
    }
    deletions.set(r, m);
  }
  return m.get(w) ?? dels(w).map(d => m!.get(d)).find(Boolean);
}

export const joinCoptic = (words: CWord[]) => words.map(w => w.coptic || (w.how === 'unknown' ? `(${w.text})` : '')).filter(Boolean).join(' ');

export function toCoptic(t: Translator, text: string, extra?: ArabicLexicon): CTranslation {
  const r = reverseOf(t, extra);
  const phrases = text.split(/\s*[:.،,؛;\n]+\s*/).map(s => s.trim()).filter(s => arKey(s));
  const result: CPhrase[] = phrases.map(p => {
    const words = phraseToCoptic(r, p).map(w => {
      if (arKey(w.text).length < 3 || !w.coptic) return w;
      const k = arKey(w.as ?? w.text).replace(/^و(?=...)/, '').replace(/^ال(?=...)/, '');
      const mine = new Set([copticKey(w.coptic), ...w.pieces.map(x => copticKey(x.form))]);
      const others = (r.alts.get(k) ?? []).filter(c => !mine.has(copticKey(c)));
      return others.length ? { ...w, alts: others.slice(0, 4) } : w;
    });
    const m = nearestArabic(r, arKey(p), 0.75);
    return { text: p, words, coptic: m?.score === 1 ? m.coptic : joinCoptic(words), match: m };
  });
  const whole = phrases.length > 1 ? nearestArabic(r, arKey(phrases.join(' ')), 0.6) : undefined;
  return { phrases: result, coptic: whole?.score === 1 ? whole.coptic : result.map(x => x.coptic).filter(Boolean).join(' : '), whole };
}
