import { norm } from './importSheet';
import { searchVariants } from './arabicVariants';

/**
 * Two dictionaries, searched together:
 * Osama Thabet's Coptic-Arabic dictionary (Bohairic), built by scripts/build-dictionary.py;
 * the Coptic dictionary of St. George church, Nazlet El Seman, with the sources it lists per word (scripts/build-stgeorge-dict.py);
 * Coptic Dictionary Online (KELLIA), for each word's forms in every dialect, with English and the Arabic of its Bohairic form (scripts/build-kellia.py);
 * Moawad Dawoud Abdel-Nour's dictionary (Bohairic and Sahidic, with examples), read from its scanned pages (scripts/build-moawad.py).
 */
const URL_ = 'dict/coptic-arabic.json?v=1';
const URL_SG = 'dict/stgeorge-dict.json?v=1';
const URL_KELLIA = 'dict/kellia.json?v=2';
const URL_MOAWAD = 'dict/moawad.json?v=1';

export interface Entry {
  word: string;
  latin: string;
  kind: string;
  form: string;
  origin: string;
  meanings: string[];
  /** Where the entry comes from, when it isn't Osama Thabet's dictionary. */
  source?: string;
  english?: string;
  dialects?: string[];
  /** The word in other dialects and spellings: [form, dialects]. */
  forms?: [string, string[]][];
  /** Only for looking up, not for the translators (its Arabic already comes from the other dictionaries). */
  lookupOnly?: boolean;
  /** Phrases using the word, with their Arabic and Bible reference. */
  examples?: { coptic: string; arabic: string; ref: string }[];
  /** Read by machine from a scanned page: a letter may be off. */
  machineRead?: boolean;
}
interface Indexed extends Entry { cKey: string; lKey: string; mKeys: string[]; alt?: string[] }
export interface Hit { entry: Entry; note?: string }

/** Entries the translators use: Bohairic ones (the other dictionary's Sahidic, Akhmimic... words are for looking up only), meanings without the machine-translation star. */
export const bohairic = (dict: Entry[]) => dict
  .filter(e => !e.lookupOnly && (!e.dialects || e.dialects.includes('بحيري')))
  .map(e => e.source ? { ...e, meanings: e.meanings.map(m => m.replace(/ \*$/, '')) } : e);

type SgWord = [string, string, number, number, number, string[], string, number[], number[]];
type KelliaEntry = [[string, string[]][], string, string, string[], string];
type MoawadEntry = [string[], string[], string, string[], [string, string, string, string][], number, number];
let loading: Promise<{ source: string; entries: Indexed[] }> | null = null;
export function loadDictionary() {
  const json = (u: string) => fetch(u).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
  loading ??= Promise.all([
    json(URL_),
    // The other dictionaries are extra: without them the first still works.
    json(URL_SG).catch(() => null),
    json(URL_KELLIA).catch(() => null),
    json(URL_MOAWAD).catch(() => null),
  ]).then(([d, sg, kl, mw]: [{ source: string; labels: string[]; words: [string, string, number, number, number, string[]][] }, { labels: string[]; words: SgWord[] } | null, { entries: KelliaEntry[] } | null, { entries: MoawadEntry[] } | null]) => ({
    source: d.source,
    entries: [
      ...d.words.map(([word, latin, k, f, o, meanings]) => ({
        word: display(word), latin, kind: d.labels[k], form: d.labels[f], origin: d.labels[o], meanings,
        cKey: copticKey(word), lKey: latinKey(latin), mKeys: meanings.map(m => norm(m)),
      })),
      ...(sg?.words ?? []).map(([word, greek, k, f, o, meanings, english, dialects, sources]) => ({
        word, latin: greek, kind: sg!.labels[k], form: sg!.labels[f], origin: sg!.labels[o], meanings, english,
        dialects: dialects.map(i => sg!.labels[i]),
        source: ['نزلة السمان', ...sources.map(i => sg!.labels[i])].join('، '),
        cKey: copticKey(word), lKey: '', mKeys: meanings.map(m => norm(m.replace(/ \*$/, ''))),
      })),
      ...(kl?.entries ?? []).map(([forms, kind, english, arabic]) => ({
        word: forms[0][0], latin: '', kind, form: '', origin: '', meanings: arabic, english, forms, lookupOnly: true,
        dialects: [...new Set(forms.flatMap(f => f[1]))],
        source: 'Coptic Dictionary Online' + (arabic.length ? '، والمعنى العربي من الكلمة البحيري' : ''),
        cKey: copticKey(forms[0][0]), lKey: '', mKeys: arabic.map(m => norm(m)), alt: forms.slice(1).map(f => copticKey(f[0])).filter(Boolean),
      })),
      // Only the clearly read Bohairic words go to the translators.
      ...(mw?.entries ?? []).map(([forms, dialects, pos, arabic, examples, unsure, page]) => ({
        word: forms[0], latin: '', kind: pos, form: '', origin: '', meanings: arabic, dialects, machineRead: true, lookupOnly: !!unsure,
        forms: forms.length > 1 ? forms.map(f => [f, []] as [string, string[]]) : undefined,
        examples: examples.map(([coptic, , arabic, ref]) => ({ coptic, arabic, ref })),
        source: `معوض داود عبد النور، ص ${page}`,
        cKey: copticKey(forms[0]), lKey: '', mKeys: arabic.map(m => norm(m)), alt: forms.slice(1).map(copticKey).filter(Boolean),
      })),
    ],
  }));
  loading.catch(() => { loading = null; });
  return loading;
}

/** Greek letters with a grave accent stand in for jinkim in the source; jinkim is shown as a combining grave. */
const JINKIM: Record<string, string> = { 'ὲ': 'ⲉ', 'ὶ': 'ⲓ', 'ὼ': 'ⲱ', 'ὸ': 'ⲟ', 'ὴ': 'ⲏ', 'ὰ': 'ⲁ', 'ή': 'ⲏ' };
export const display = (w: string) => w
  .replace(/[ὲὶὼὸὴὰή]/g, ch => JINKIM[ch] + '̀')
  .replace(/`\s*(.)/g, '$1̀');

/** Lowercase Coptic, no jinkim, spaces or punctuation: what we compare on. */
export function copticKey(s: string) {
  return [...s.replace(/[ὲὶὼὸὴὰή]/g, ch => JINKIM[ch])].map(ch => {
    const c = ch.codePointAt(0)!;
    // Capitals sit on even code points, lowercase right after, in both Coptic ranges.
    if ((c >= 0x2c80 && c <= 0x2ce3 && c % 2 === 0) || (c >= 0x03e2 && c <= 0x03ef && c % 2 === 0)) return String.fromCodePoint(c + 1);
    return ch;
  }).join('').replace(/[^Ⲁ-⳿Ϣ-ϯ]/g, '');
}
const latinKey = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const stripAl = (s: string) => s.replace(/^ال(?=...)/, '');

/** Prefixes glued to Bohairic words: if the whole word isn't found, we look up what's left. */
const PREFIXES: [string, string][] = [
  ['ⲛⲧⲉ', 'ⲛⲧⲉ = بتاع / الخاص بـ'], ['ⲛⲉⲙ', 'ⲛⲉⲙ = مع / و'], ['ϧⲉⲛ', 'ϧⲉⲛ = في'], ['ϩⲁⲛ', 'ϩⲁⲛ = أداة نكرة للجمع'],
  ['ⲡⲓ', 'ⲡⲓ = أداة تعريف للمذكر'], ['ⲛⲓ', 'ⲛⲓ = أداة تعريف للجمع'], ['ⲟⲩ', 'ⲟⲩ = أداة نكرة'],
  ['ⲁϥ', 'ⲁϥ = ماضي (هو)'], ['ⲁⲥ', 'ⲁⲥ = ماضي (هي)'], ['ⲁⲩ', 'ⲁⲩ = ماضي (هم)'], ['ⲁⲕ', 'ⲁⲕ = ماضي (أنت)'], ['ⲁⲓ', 'ⲁⲓ = ماضي (أنا)'], ['ⲁⲛ', 'ⲁⲛ = ماضي (إحنا)'],
  ['ϯ', 'ϯ = أداة تعريف للمؤنث'], ['ⲡ', 'ⲡ = أداة تعريف للمذكر'], ['ⲫ', 'ⲫ = أداة تعريف للمذكر'],
  ['ⲧ', 'ⲧ = أداة تعريف للمؤنث'], ['ⲑ', 'ⲑ = أداة تعريف للمؤنث'], ['ⲛ', 'ⲛ = أداة تعريف للجمع'],
];

export type Script = 'coptic' | 'arabic' | 'latin' | null;
export const scriptOf = (q: string): Script =>
  /[Ⲁ-⳿Ϣ-ϯ]/.test(q) ? 'coptic' : /[؀-ۿ]/.test(q) ? 'arabic' : /[a-z]/i.test(q) ? 'latin' : null;

export function search(entries: Indexed[], q: string, limit = 60): { hits: Hit[]; total: number } {
  const script = scriptOf(q);
  if (!script) return { hits: [], total: 0 };
  const scored: { e: Indexed; s: number; note?: string }[] = [];

  if (script === 'arabic') {
    const k = norm(q), bare = stripAl(k);
    if (!bare) return { hits: [], total: 0 };
    for (const e of entries) {
      let best = 9;
      for (const m of e.mKeys) {
        const words = m.split(/[\s،,؛;()/]+/).filter(Boolean).map(stripAl);
        const s = m === k || stripAl(m) === bare ? 0 : words.length > 0 && words[0] === bare ? 1 : words.includes(bare) ? 2 : m.includes(bare) ? 3 : 9;
        if (s < best) best = s;
      }
      if (best < 9) scored.push({ e, s: best + e.meanings.length / 100 });
    }
    // Nothing for ماركو or عايز: look up مرقس or يريد.
    if (!scored.length) for (const v of searchVariants(q).slice(1)) {
      const r = search(entries, v, limit);
      if (r.total) return { hits: r.hits.map(h => ({ ...h, note: h.note ?? `«${q.trim()}» = «${v}»` })), total: r.total };
    }
  } else {
    const k = script === 'coptic' ? copticKey(q) : latinKey(q);
    if (!k) return { hits: [], total: 0 };
    const field = (e: Indexed) => script === 'coptic' ? e.cKey : e.lKey;
    for (const e of entries) {
      const f = field(e);
      let s = f === k ? 0 : f.startsWith(k) ? 2 : k.length >= 2 && f.includes(k) ? 4 : 9;
      // The same word in another dialect or spelling.
      if (s > 0 && script === 'coptic' && e.alt?.includes(k)) s = 0.5;
      if (s < 9) scored.push({ e, s: s + f.length / 1000 });
    }
    // Not in the dictionary as typed: try it without a glued article or preposition.
    if (script === 'coptic' && !scored.some(x => x.s < 1)) {
      const byKey = new Map<string, Indexed[]>();
      for (const e of entries) byKey.set(e.cKey, [...(byKey.get(e.cKey) ?? []), e]);
      const found = new Set<Indexed>();
      // Up to two glued prefixes, e.g. ϧⲉⲛ + ⲫ + ⲣⲁⲛ.
      const strip = (rest: string, notes: string[]) => {
        for (const [p, note] of PREFIXES) {
          if (!rest.startsWith(p) || rest.length - p.length < 2) continue;
          const r = rest.slice(p.length), n = [...notes, note];
          for (const e of byKey.get(r) ?? []) if (!found.has(e)) { found.add(e); scored.push({ e, s: n.length, note: n.join(' + ') }); }
          if (n.length < 2) strip(r, n);
        }
      };
      strip(k, []);
    }
  }
  scored.sort((a, b) => a.s - b.s);
  return { hits: scored.slice(0, limit).map(x => ({ entry: x.e, note: x.note })), total: scored.length };
}

/** On-screen Coptic keyboard, in alphabet order. */
export const COPTIC_KEYS = 'ⲁⲃⲅⲇⲉⲍⲏⲑⲓⲕⲗⲙⲛⲝⲟⲡⲣⲥⲧⲩⲫⲭⲯⲱϣϥϧϩϫϭϯ'.split('');
