import { copticKey, loadDictionary, type Entry } from './dictionary';

/**
 * Coptic → Arabic sentence translator (Bohairic).
 * 1. A line or half-line found in the hymn library is answered with its printed Arabic.
 * 2. Otherwise each word is analysed: a word form seen in the hymn library keeps its analysis; a new form is split into
 *    the grammar pieces glued to it (articles, possessives, tense and person prefixes, prepositions, object pronouns)
 *    and a stem from the library or the dictionary. The Arabic is put together from those pieces.
 */
const URL_ = 'dict/hymn-corpus.json?v=1';

type Gloss = [string, number][];
interface Corpus {
  source: string;
  forms: [string, string, string, number][];
  morphs: Record<string, { P?: Gloss; L?: Gloss; S?: Gloss; V?: Gloss; N?: Gloss; M?: Gloss }>;
  /** How often one glued piece follows another in the library ("^" = word start, "$" = the stem comes next). */
  trans: Record<string, Record<string, number>>;
  tm: [string, string][];
  /** Grammar pieces (scripts/translator-grammar.json): [form, Arabic, class] and object pronouns [form, Arabic]. */
  grammar: { prefixes: [string, string, string][]; suffixes: [string, string][]; words?: [string, string][] };
}
export interface Piece { form: string; gloss: string; role: 'prefix' | 'stem' | 'suffix' | 'word'; base?: 'past' | 'present' }
export interface WordResult {
  text: string;
  key: string;
  pieces: Piece[];
  arabic: string;
  /** hymns: this exact word form is analysed in the hymn library; grammar: split here; unknown: no stem found. */
  how: 'hymns' | 'grammar' | 'unknown';
  /** ⲛ̀ⲧⲉ / ⲛ̀ of the genitive ("of"): the word before it loses its "ال" in Arabic. */
  genitive?: boolean;
  /** Possessive, demonstrative or other article: the word is already definite. */
  definite?: boolean;
}
export interface Match { coptic: string; arabic: string; score: number }
export interface PhraseResult { text: string; words: WordResult[]; arabic: string; match?: Match }
export interface Translation { phrases: PhraseResult[]; arabic: string; whole?: Match }

/** What a stem means: in the hymns as a whole word (S), after a past-tense piece (V), after a singular / plural article (N / M); in the dictionary. */
interface Stem { S?: string; V?: string; N?: string; M?: string; verb?: string; noun?: string; other?: string }

export interface Translator {
  source: string;
  forms: Map<string, [string, string, number]>;
  morphs: Corpus['morphs'];
  prefixes: Map<string, { gloss: string; cls: string }>;
  suffixes: Map<string, string>;
  stems: Map<string, Stem>;
  trans: Corpus['trans'];
  transTotal: Map<string, number>;
  tm: Map<string, string>;
  tmList: [string, string][];
  tmIndex: Map<string, number[]>;
}

const top = (g?: Gloss, min = 1) => g && g[0] && g[0][1] >= min ? g[0][0] : undefined;

let loading: Promise<Translator> | null = null;
export function loadTranslator() {
  loading ??= Promise.all([fetch(URL_).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<Corpus>; }), loadDictionary()])
    .then(([c, dict]) => buildTranslator(c, dict.entries));
  loading.catch(() => { loading = null; });
  return loading;
}

export function buildTranslator(c: Corpus, dict: Entry[]): Translator {
  const prefixes = new Map<string, { gloss: string; cls: string }>(), suffixes = new Map<string, string>();
  const stems = new Map<string, Stem>();
  for (const [p, gloss, cls] of c.grammar.prefixes) prefixes.set(copticKey(p), { gloss, cls });
  for (const [p, g] of c.grammar.suffixes) suffixes.set(copticKey(p), g);
  for (const [m, v] of Object.entries(c.morphs)) {
    // The library's own wording for grammar pieces it uses often.
    const p = top(v.P, 5), pre = prefixes.get(m);
    if (p && pre && (pre.cls === 'link' || pre.cls === 'deriv') && !/^\(/.test(pre.gloss)) pre.gloss = p.replace(/\s*\(.*\)$/, '') || pre.gloss;
    if (m.length >= 2 && (v.S || v.V || v.N || v.M)) stems.set(m, { S: top(v.S), V: top(v.V), N: top(v.N), M: top(v.M) });
  }
  // The dictionary fills stems the hymns never use: its first verb meaning and first noun meaning.
  for (const e of dict) {
    const k = copticKey(e.word);
    if (k.length < 2 || !e.meanings[0]) continue;
    const first = e.meanings[0].split(/[،,;؛/]/)[0].trim();
    const s = stems.get(k) ?? {};
    if (/فعل/.test(e.kind)) s.verb ??= first; else if (/اسم|صفة/.test(e.kind)) s.noun ??= first; else s.other ??= first;
    stems.set(k, s);
  }
  // Pronoun-suffixed prepositions, verb states and particles from the grammar books, where the hymns and dictionary say nothing.
  for (const [k, a] of c.grammar.words ?? []) { const st = stems.get(k) ?? {}; if (!st.S && !st.verb && !st.noun) st.other ??= a; stems.set(k, st); }
  // "ⲛⲁϩⲱⲥ" is the future ⲛⲁ + ϩⲱⲥ, not a word of its own, even where the library left it unsplit.
  for (const k of [...stems.keys()]) if (k.startsWith('ⲛⲁ') && stems.has(k.slice(2)) && k.length > 4) stems.delete(k);
  const tmIndex = new Map<string, number[]>();
  c.tm.forEach(([k], i) => { for (const w of new Set(k.split(' '))) { const l = tmIndex.get(w); if (l) l.push(i); else tmIndex.set(w, [i]); } });
  return {
    source: c.source, morphs: c.morphs, prefixes, suffixes, stems, trans: c.trans,
    transTotal: new Map(Object.entries(c.trans).map(([k, v]) => [k, Object.values(v).reduce((a, b) => a + b, 0)])),
    forms: new Map(c.forms.map(([k, seg, gloss, n]) => [k, [seg, gloss, n]])),
    tm: new Map(c.tm), tmList: c.tm, tmIndex,
  };
}

const PERSON: Record<string, string> = { 'أنا': '1s', 'أنت': '2ms', 'أنتِ': '2fs', 'هو': '3ms', 'هي': '3fs', 'نحن': '1p', 'أنتم': '2p', 'هم': '3p', 'هما': '3p', 'هن': '3p' };
const PRONOUN = Object.fromEntries(Object.entries(PERSON).map(([k, v]) => [v, k]));
const ENDINGS: Record<string, string> = { '1s': 'تُ', '2ms': 'تَ', '2fs': 'تِ', '1p': 'نا', '2p': 'تم', '3fs': 'ت', '3p': 'وا' };

/** Past tense of an Arabic verb given in its "he did" form (ربط، قام، أعطى). */
export function conjugatePast(verb: string, person: string): string | null {
  if (person === '3ms') return verb;
  if (!/^[ء-ي]{2,6}$/.test(verb)) return null;
  const end = ENDINGS[person];
  // Already inflected by the library for this person.
  if (verb.endsWith(end.replace(/[ُ َ ِ]/g, '')) && verb.length > 3) return verb;
  if (/[ىا]$/.test(verb)) {
    const stem = verb.slice(0, -1);
    return person === '3fs' ? stem + 'ت' : person === '3p' ? stem + 'وا' : stem + 'ي' + end;
  }
  // Hollow verbs (قام، صار): the long vowel drops before a consonant ending.
  if (verb.length === 3 && verb[1] === 'ا' && !['3fs', '3p'].includes(person)) return verb[0] + verb[2] + end;
  return verb + end;
}

/** Present tense from the "he does" form (يسجد → نسجد، يسجدون). */
export function conjugatePresent(verb: string, person: string): string | null {
  verb = verb.replace(/^ت(?=[ء-ي]{3}$)/, 'ي');
  if (!/^ي[ء-ي]{2,6}$/.test(verb)) return null;
  const s = verb.slice(1);
  return ({ '1s': 'أ' + s, '2ms': 'ت' + s, '3fs': 'ت' + s, '1p': 'ن' + s, '3ms': verb, '2fs': 'ت' + s + 'ين', '2p': 'ت' + s + 'ون', '3p': 'ي' + s + 'ون' } as Record<string, string>)[person] ?? null;
}

/** "he did" from "he does" for the common verb shapes: يسجد → سجد، يقول → قال، يدعو → دعا. */
export function pastFromPresent(verb: string): string | null {
  verb = verb.replace(/^ت(?=[ء-ي]{3}$)/, 'ي');
  if (!/^ي[ء-ي]{3}$/.test(verb)) return null;
  const s = verb.slice(1);
  if (s[1] === 'و' || s[1] === 'ي') return s[0] + 'ا' + s[2];
  if (s[2] === 'و') return s.slice(0, 2) + 'ا';
  if (s[2] === 'ي') return s.slice(0, 2) + 'ى';
  return s;
}

const isNote = (s: string) => /^\(.*\)$/.test(s.trim());
const strip = (s: string) => s.replace(/\([^()]*\)/g, '').replace(/\s+/g, ' ').trim();

/** A gloss to render; `base` says which form a stem's Arabic verb is in, so it can take the right person and tense. */
export type RenderPart = string | { gloss: string; base?: 'past' | 'present' };

/** Arabic for one word from its pieces' glosses, in Coptic order. */
export function renderGlosses(parts: RenderPart[]): string {
  const out: string[] = [];
  let al = false, poss: string | null = null, person: string | null = null, tense: 'past' | 'present' | 'future' | null = null, lead = '';
  const verbs = new Set<number>();
  const glossOf = (p: RenderPart) => typeof p === 'string' ? p : p.gloss;
  for (let i = 0; i < parts.length; i++) {
    const raw = glossOf(parts[i]).trim(), base = typeof parts[i] === 'string' ? undefined : (parts[i] as { base?: 'past' | 'present' }).base;
    if (!raw || isNote(raw)) continue;
    let t = strip(raw);
    if (!t) continue;
    if (t === 'الـ' || t === 'ال') { al = true; continue; }
    if (t.startsWith('ـ')) {
      const rest = parts.slice(i + 1).some(p => strip(glossOf(p)) && !strip(glossOf(p)).startsWith('ـ'));
      if (rest) { poss = t.slice(1); continue; }
      if (out.length) { out[out.length - 1] = attach(out[out.length - 1], t.slice(1), verbs.has(out.length - 1)); continue; }
      out.push(t); continue;
    }
    // Subject and tense pieces: "هو قد" (past), "نحن" (present), "هو سوف" / "سوف" (future), "وهو" (while he…), "الذي هو قد".
    const m = t.match(/^(الذي |التي |الذين |لكي |قبل أن |إذا |بعد أن )?(و)?(أنا|أنت|أنتِ|هو|هي|نحن|أنتم|هم|هما|هن)?\s*(قد|سوف)?$/);
    if (m && (m[3] || m[4])) {
      lead = (m[1] ?? '') + (m[2] ?? '');
      if (m[3]) person = PERSON[m[3]];
      tense = m[4] === 'قد' ? 'past' : m[4] === 'سوف' ? 'future' : tense ?? 'present';
      continue;
    }
    let w = t;
    if (person || tense) {
      const p = person ?? '3ms', one = w.split(' ');
      let v: string | null = null;
      if (tense === 'past') v = conjugatePast(base === 'present' ? pastFromPresent(one[0]) ?? '' : one[0], p) || (base === 'present' ? conjugatePresent(one[0], p) : null);
      else if (base === 'present' || /^ي/.test(one[0])) { v = conjugatePresent(one[0], p); if (v && tense === 'future') v = 'سـ' + v; }
      if (v) { w = [v.replace('سـ', 'س'), ...one.slice(1)].join(' '); verbs.add(out.length); }
      else w = `${person ? PRONOUN[person] + ' ' : ''}${tense === 'future' ? 'سوف ' : ''}${w}`;
      w = lead + w;
      person = tense = null; lead = '';
    }
    w = w.replace(/الـ\s*/g, 'ال');
    if (al) { w = w.startsWith('ال') ? w : 'ال' + w; al = false; }
    if (poss) { w = attach(w.replace(/^ال/, ''), poss); poss = null; }
    out.push(w);
  }
  if (person || tense) out.push(lead + (person ? PRONOUN[person] : '') + (tense === 'past' ? ' قد' : tense === 'future' ? ' سوف' : ''));
  if (al && out.length === 0) out.push('الـ');
  return out.join(' ').trim();
}

/** "قلب" + "ه" → "قلبه"; "كلمة" + "ي" → "كلمتي". Only the last word takes the pronoun. */
function attach(word: string, suffix: string, verb = false) {
  const words = word.split(' ');
  let w = words.pop()!;
  // On a verb the pronoun is its object: ضربوا + ه → ضربوه، ضرب + ي → ضربني.
  if (verb) { if (w.endsWith('وا')) w = w.slice(0, -1); if (suffix === 'ي') suffix = 'ني'; if (w.endsWith('تُ') || w.endsWith('تَ') || w.endsWith('تِ')) w = w.slice(0, -1); }
  if (w.endsWith('ة')) w = w.slice(0, -1) + 'ت';
  else if (w.endsWith('ى') && suffix !== 'ي') w = w.slice(0, -1) + 'ا';
  return [...words, w + suffix].join(' ');
}

/** The natural rendering a library analysis gives in brackets, e.g. "هو قد - ربط - ـه (ربطه)". */
export function libraryArabic(gloss: string, pieces: number) {
  const m = gloss.match(/\(([^()]*)\)\s*$/);
  if (pieces > 1 && m && !/أداة|ضمير|علامة|مقطع|صيغة|جمع|مفرد|مذكر|مؤنث/.test(m[1]) && gloss.includes(' - ')) return m[1].trim();
  const bare = pieces > 1 ? gloss.replace(/\s*\([^()]*\)\s*$/, '') : gloss;
  return renderGlosses(pieces > 1 ? bare.split(/\s+-\s+/) : [bare.replace(/\s*\([^()]*\)\s*$/, '').trim() || bare]);
}

function fromLibrary(t: Translator, text: string, k: string): WordResult | null {
  const f = t.forms.get(k);
  if (!f) return null;
  const [seg, gloss] = f;
  const segs = seg.split('-');
  const glosses = segs.length > 1 ? gloss.replace(/\s*\([^()]*\)\s*$/, '').split(/\s+-\s+/) : [gloss];
  const pieces: Piece[] = segs.map((form, i) => ({
    form, gloss: glosses.length === segs.length ? glosses[i] : i === 0 ? gloss : '',
    role: segs.length === 1 ? 'word' : i === segs.length - 1 && t.suffixes.has(form) && i > 0 ? 'suffix' : i < segs.length - 1 && t.prefixes.has(form) ? 'prefix' : 'stem',
  }));
  return finish({ text, key: k, pieces, arabic: libraryArabic(gloss, segs.length), how: 'hymns' });
}

interface Cand { pieces: Piece[]; cost: number }

/** Bits it costs for piece `next` to follow `prev` in a word, from how often the hymns do it. */
function step(t: Translator, prev: string, next: string) {
  const n = t.trans[prev]?.[next] ?? 0, total = t.transTotal.get(prev) ?? 0;
  return Math.min(10, -Math.log2((n + 0.2) / (total + 1)));
}

/** A stem's meaning where it stands: the "he did" form after a past tense, the noun after an article. */
function stemGloss(t: Translator, s: string, before: Piece[]): { gloss: string; cost: number; base?: 'past' | 'present' } | null {
  const st = t.stems.get(s);
  if (!st) return null;
  const last = before[before.length - 1], cls = last ? t.prefixes.get(last.form)?.cls : undefined;
  const past = !!last && /قد$/.test(last.gloss);
  const plural = cls === 'art' && /^(ⲛ|ϩⲁⲛ)/.test(last!.form);
  // No plain "he did" form: a past form the library inflected (ولدت، سبحوا) loses its ending and is inflected again.
  const pastS = st.S && /^[ء-ي]{3,6}$/.test(st.S) && !/^[يتن]/.test(st.S) ? deinflect(st.S) : undefined;
  if (past && !st.V && pastS) return { gloss: pastS, base: 'past', cost: 1 + (s.length < 3 ? 3 : 0) };
  const pick = past ? st.V ?? st.verb ?? st.S : cls === 'art' ? (plural ? st.M ?? st.S ?? st.N : st.N ?? st.noun ?? st.S) : cls === 'conj' || cls === 'fut' || cls === 'rel' ? st.S ?? st.V ?? st.verb : st.S ?? st.N ?? st.V;
  const gloss = pick ?? st.verb ?? st.noun ?? st.other;
  if (!gloss) return null;
  const fromHymns = !!(st.S || st.V || st.N || st.M);
  const base = gloss === st.V ? 'past' as const : gloss === st.verb || /^[يت][ء-ي]{3}$|^ي[ء-ي]{2,6}$/.test(gloss) ? 'present' : undefined;
  return { gloss, base, cost: (fromHymns ? 1 : 3) + (s.length < 3 ? 3 : 0) };
}

function deinflect(v: string) {
  const m = v.match(/^(.{3,})(وا|نا|تم|ت)$/);
  return m ? m[1] : v;
}

/** Splits a word nobody analysed yet: up to three glued pieces in front, a stem, and maybe an object pronoun. */
function analyse(t: Translator, k: string): Cand | null {
  let best: Cand | null = null;
  const consider = (c: Cand) => { if (!best || c.cost < best.cost) best = c; };
  const stemOf = (s: string, before: Piece[], cost: number) => {
    const end = cost + step(t, before.length ? before[before.length - 1].form : '^', '$');
    const lib = t.forms.get(s);
    if (lib && s.length >= 2 && before.length && lib[0].includes('-')) {
      const r = fromLibrary(t, s, s)!;
      consider({ pieces: [...before, ...r.pieces], cost: end + 0.5 });
    }
    const g = stemGloss(t, s, before);
    if (g) consider({ pieces: [...before, { form: s, gloss: g.gloss, role: 'stem', base: g.base }], cost: end + g.cost });
    for (const [suf, sg] of t.suffixes) {
      if (s.length - suf.length < 2 || !s.endsWith(suf)) continue;
      const st = s.slice(0, -suf.length), g2 = stemGloss(t, st, before);
      if (g2) consider({ pieces: [...before, { form: st, gloss: g2.gloss, role: 'stem', base: g2.base }, { form: suf, gloss: sg, role: 'suffix' }], cost: end + g2.cost + 2.5 });
    }
  };
  const walk = (rest: string, before: Piece[], cost: number) => {
    stemOf(rest, before, cost);
    if (before.length >= 4) return;
    const prev = before.length ? before[before.length - 1].form : '^';
    for (const [p, { gloss }] of t.prefixes) {
      if (rest.length - p.length < 2 || !rest.startsWith(p)) continue;
      walk(rest.slice(p.length), [...before, { form: p, gloss, role: 'prefix' }], cost + step(t, prev, p));
    }
  };
  walk(k, [], 0);
  return best;
}

function finish(w: WordResult): WordResult {
  const first = w.pieces[0];
  if (w.pieces.some(p => /للإضافة/.test(p.gloss)) && !strip(w.arabic)) w.genitive = true;
  if (first && first.role !== 'word' && /^ـ|^(هذا|هذه|هؤلاء|ذاك|تلك|أولئك)$/.test(strip(first.gloss))) w.definite = true;
  return w;
}

/** ⲛⲉ on its own closes a plural nominal sentence ("are"); the library sometimes glosses it as a possessive. ⲡⲉ / ⲧⲉ keep the library's "هو / هي". */
const COPULA: Record<string, string> = { 'ⲛⲉ': 'هم (رابط جمع)' };

export function translateWord(t: Translator, text: string): WordResult {
  const k = copticKey(text);
  if (COPULA[k]) return { text, key: k, pieces: [{ form: k, gloss: COPULA[k], role: 'word' }], arabic: '', how: 'grammar' };
  const lib = fromLibrary(t, text, k);
  if (lib) return lib;
  const a = analyse(t, k);
  if (!a) return { text, key: k, pieces: [{ form: k, gloss: '', role: 'word' }], arabic: '', how: 'unknown' };
  return finish({ text, key: k, pieces: a.pieces, arabic: renderGlosses(a.pieces.map(p => ({ gloss: p.gloss, base: p.base }))), how: 'grammar' });
}

/** Line key the hymn memory is stored under: Coptic letters only, one space between words. */
export const lineKey = (s: string) => s.split(/\s+/).map(copticKey).filter(Boolean).join(' ');

/** The closest line in the hymn library (by shared words), if it is close enough to be useful. */
export function nearest(t: Translator, k: string, min = 0.6): Match | undefined {
  const exact = t.tm.get(k);
  if (exact) return { coptic: k, arabic: exact, score: 1 };
  const words = k.split(' ').filter(Boolean);
  if (words.length < 2) return undefined;
  const hits = new Map<number, number>();
  for (const w of new Set(words)) for (const i of (t.tmIndex.get(w) ?? []).slice(0, 4000)) hits.set(i, (hits.get(i) ?? 0) + 1);
  let best: Match | undefined;
  for (const [i, n] of hits) {
    if (n < 2) continue;
    const [ck, ar] = t.tmList[i];
    const other = ck.split(' ');
    const score = (2 * overlap(words, other)) / (words.length + other.length);
    if (score >= min && (!best || score > best.score)) best = { coptic: ck, arabic: ar, score };
  }
  return best;
}
function overlap(a: string[], b: string[]) {
  const c = new Map<string, number>();
  for (const w of b) c.set(w, (c.get(w) ?? 0) + 1);
  let n = 0;
  for (const w of a) { const x = c.get(w) ?? 0; if (x) { n++; c.set(w, x - 1); } }
  return n;
}

/** Arabic for a run of analysed words: genitive markers vanish and the word before them loses "ال" (إضافة). */
export function joinWords(words: WordResult[]) {
  const out: string[] = [];
  words.forEach((w, i) => {
    let a = w.arabic;
    if (!a) return;
    if (words[i + 1]?.genitive && !a.includes(' ')) a = a.replace(/^ال(?=..)/, '');
    out.push(a);
  });
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

export function translate(t: Translator, text: string): Translation {
  const clean = text.replace(/[̅̀́̄̈]/g, '').trim();
  const phrases = clean.split(/\s*[:.،,؛;\n]+\s*|\s+\/\s+/).map(s => s.trim()).filter(Boolean);
  const result: PhraseResult[] = phrases.map(p => {
    const words = p.split(/\s+/).filter(w => copticKey(w)).map(w => translateWord(t, w));
    const k = lineKey(p);
    const m = nearest(t, k, 0.75);
    return { text: p, words, arabic: m?.score === 1 ? m.arabic : joinWords(words), match: m };
  });
  const allKey = lineKey(clean.replace(/[:.،,؛;\n/]/g, ' '));
  const whole = phrases.length > 1 ? nearest(t, allKey, 0.6) : undefined;
  return {
    phrases: result,
    arabic: whole?.score === 1 ? whole.arabic : result.map(r => r.arabic).filter(Boolean).join('، '),
    whole,
  };
}
