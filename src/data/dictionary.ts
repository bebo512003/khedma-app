import { norm } from './importSheet';

/** Osama Thabet's Coptic-Arabic dictionary (Bohairic), built by scripts/build-dictionary.py. */
const URL_ = 'dict/coptic-arabic.json?v=1';

export interface Entry {
  word: string;
  latin: string;
  kind: string;
  form: string;
  origin: string;
  meanings: string[];
}
interface Indexed extends Entry { cKey: string; lKey: string; mKeys: string[] }
export interface Hit { entry: Entry; note?: string }

let loading: Promise<{ source: string; entries: Indexed[] }> | null = null;
export function loadDictionary() {
  loading ??= fetch(URL_).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }).then((d: { source: string; labels: string[]; words: [string, string, number, number, number, string[]][] }) => ({
    source: d.source,
    entries: d.words.map(([word, latin, k, f, o, meanings]) => ({
      word: display(word), latin, kind: d.labels[k], form: d.labels[f], origin: d.labels[o], meanings,
      cKey: copticKey(word), lKey: latinKey(latin), mKeys: meanings.map(m => norm(m)),
    })),
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
  } else {
    const k = script === 'coptic' ? copticKey(q) : latinKey(q);
    if (!k) return { hits: [], total: 0 };
    const field = (e: Indexed) => script === 'coptic' ? e.cKey : e.lKey;
    for (const e of entries) {
      const f = field(e);
      const s = f === k ? 0 : f.startsWith(k) ? 2 : k.length >= 2 && f.includes(k) ? 4 : 9;
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
