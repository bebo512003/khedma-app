import { copticKey } from './dictionary';
import { conjugatePast, conjugatePresent, libraryArabic, overlap, pastFromPresent, type Match, type Translator } from './translator';

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
const PERSONS = ['3ms', '3fs', '3p', '1s', '1p', '2ms', '2p', '2fs'] as const;
const PAST: Record<string, string> = { '1s': 'ⲁⲓ', '2ms': 'ⲁⲕ', '2fs': 'ⲁⲣⲉ', '3ms': 'ⲁϥ', '3fs': 'ⲁⲥ', '1p': 'ⲁⲛ', '2p': 'ⲁⲣⲉⲧⲉⲛ', '3p': 'ⲁⲩ' };
const PRESENT: Record<string, string> = { '1s': 'ϯ', '2ms': 'ⲭ̀', '2fs': 'ⲧⲉ', '3ms': 'ϥ', '3fs': 'ⲥ', '1p': 'ⲧⲉⲛ', '2p': 'ⲧⲉⲧⲉⲛ', '3p': 'ⲥⲉ' };
const FUTURE: Record<string, string> = { '1s': 'ϯⲛⲁ', '2ms': 'ⲭ̀ⲛⲁ', '2fs': 'ⲧⲉⲣⲉⲛⲁ', '3ms': 'ϥⲛⲁ', '3fs': 'ⲥⲛⲁ', '1p': 'ⲧⲉⲛⲛⲁ', '2p': 'ⲧⲉⲧⲉⲛⲛⲁ', '3p': 'ⲥⲉⲛⲁ' };
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
  dict: Map<string, string>;
  tm: Map<string, number>;
  tmIndex: Map<string, number[]>;
  /** Arabic line key, Coptic as written, Arabic as printed. */
  tmList: [string, string, string][];
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
export function reverseOf(t: Translator): Reverse {
  const dict = t.dict;
  const hit = cache.get(t);
  if (hit) return hit;
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
    if (ar && ar.split(' ').length <= 3) better(lex, ar, { coptic, n, pos, gloss, past3 });
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
  for (const [ar, v] of presentVerbs) for (const p of PERSONS) {
    const f = conjugatePresent(ar, p);
    if (f && !verbs.has(arKey(f))) verbs.set(arKey(f), { stem: v.stem, n: v.n, person: p, tense: 'present' });
  }
  // The dictionary: each meaning's first wording → the shortest Coptic word with it.
  const dmap = new Map<string, string>();
  for (const e of dict) for (const m of e.meanings.slice(0, 3)) {
    const k = arKey(m.split(/[،,;؛/(]/)[0]);
    if (!k || k.split(' ').length > 2) continue;
    const o = dmap.get(k);
    if (!o || copticKey(e.word).length < copticKey(o).length) dmap.set(k, e.word);
  }
  const tmList = t.tmList.map(([, ar, cop]) => [arKey(ar), cop, ar] as [string, string, string]);
  const tm = new Map<string, number>(), tmIndex = new Map<string, number[]>();
  tmList.forEach(([k], i) => {
    if (!tm.has(k)) tm.set(k, i);
    for (const w of new Set(k.split(' '))) { const l = tmIndex.get(w); if (l) l.push(i); else tmIndex.set(w, [i]); }
  });
  const r: Reverse = { lex, nouns, verbs, dict: dmap, tm, tmIndex, tmList };
  cache.set(t, r);
  return r;
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
  const pre = v.tense === 'past' ? PAST[v.person] : future ? FUTURE[v.person] : PRESENT[v.person];
  return {
    text: w, coptic: pre + v.stem, pos: 'verb', how: 'grammar', past3: v.tense === 'past' && v.person.startsWith('3'),
    pieces: [{ form: pre, gloss: `${WHO[v.person]} ${v.tense === 'past' ? '(ماضي)' : future ? 'سوف' : '(مضارع)'}` }, { form: v.stem, gloss: w }],
  };
}

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
  const d = definiteNoun(r, w) ?? possessed(r, w);
  if (d) return d;
  // Verbs: س for the future, then an object pronoun at the end.
  if (w.startsWith('س') && w.length > 3) { const v = verb(r, w.slice(1), true); if (v && !v.past3 && v.pieces[0].form !== PAST['1s']) return { ...v, text: w }; }
  const v = verb(r, w, future);
  if (v) return v;
  for (const [end, gloss, obj] of OBJ) {
    if (!w.endsWith(end) || w.length < end.length + 3) continue;
    const base = w.slice(0, -end.length);
    const v2 = verb(r, base, future) ?? verb(r, base + 'ا', future);
    if (v2) return { ...v2, text: w, coptic: v2.coptic + ' ' + obj, pieces: [...v2.pieces, { form: obj, gloss }] };
  }
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
    if (v2) return { ...v2, text: w, how: 'dictionary', coptic: v2.coptic + ' ' + obj, pieces: [...v2.pieces, { form: obj, gloss }] };
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
  if (exact !== undefined) return { coptic: r.tmList[exact][1], arabic: r.tmList[exact][2], score: 1 };
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
    if (score >= min && score < 1 && (!best || score > best.score)) best = { coptic: cop, arabic: ar, score };
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
    out.push(wordToCoptic(r, toks[i], future));
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

export const joinCoptic = (words: CWord[]) => words.map(w => w.coptic || (w.how === 'unknown' ? `(${w.text})` : '')).filter(Boolean).join(' ');

export function toCoptic(t: Translator, text: string): CTranslation {
  const r = reverseOf(t);
  const phrases = text.split(/\s*[:.،,؛;\n]+\s*/).map(s => s.trim()).filter(s => arKey(s));
  const result: CPhrase[] = phrases.map(p => {
    const words = phraseToCoptic(r, p);
    const m = nearestArabic(r, arKey(p), 0.75);
    return { text: p, words, coptic: m?.score === 1 ? m.coptic : joinCoptic(words), match: m };
  });
  const whole = phrases.length > 1 ? nearestArabic(r, arKey(phrases.join(' ')), 0.6) : undefined;
  return { phrases: result, coptic: whole?.score === 1 ? whole.coptic : result.map(x => x.coptic).filter(Boolean).join(' : '), whole };
}
