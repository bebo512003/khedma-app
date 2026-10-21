/**
 * One Unicode for all Coptic in the app. Keep in sync with scripts/coptic_unicode.py.
 * - Greek letters inside Coptic words (α for ⲁ, Π for Ⲡ) become Coptic letters; a Greek accent on them becomes jinkim.
 * - A backtick before a letter (old way of typing jinkim) becomes U+0300 after it.
 * - Text typed in the old CS fonts (Avva Shenouda and the other Coptic Standard fonts: Latin keys drawn as Coptic)
 *   becomes Unicode with the CS keyboard table.
 */
const GREEK = 'αβγδεζηθικλμνξοπρστυφχψωςϛΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩϚ';
const COPTIC = 'ⲁⲃⲅⲇⲉⲍⲏⲑⲓⲕⲗⲙⲛⲝⲟⲡⲣⲥⲧⲩⲫⲭⲯⲱⲥⲋⲀⲂⲄⲆⲈⲌⲎⲐⲒⲔⲖⲘⲚⲜⲞⲠⲢⲤⲦⲨⲪⲬⲮⲰⲊ';
const G2C = new Map([...GREEK].map((g, i) => [g, [...COPTIC][i]]));
const IS_COPTIC = /[Ⲁ-⳿Ϣ-ϯ]/;
const JINKIM = new Set(['̀', '́', '͂']);
const DROP = new Set(['̓', '̔', '̈', 'ͅ']);

// CS (Coptic Standard) keyboard → Unicode.
const CS_FROM = 'ABGDE^ZY:IKLMNXOPRCTUV<"WSFQHJ{}abgde^zy;iklmnxoprctuv,\'wsfqhj[]&~@>|';
const CS_TO = 'ⲀⲂⲄⲆⲈⲊⲌⲎⲐⲒⲔⲖⲘⲚⲜⲞⲠⲢⲤⲦⲨⲪⲬⲮⲰϢϤϦϨϪϬϮⲁⲃⲅⲇⲉⲋⲍⲏⲑⲓⲕⲗⲙⲛⲝⲟⲡⲣⲥⲧⲩⲫⲭⲯⲱϣϥϧϩϫϭϯ;.:,ⳉ';
const CS = new Map([...CS_FROM].map((c, i) => [c, [...CS_TO][i]]));
const CS_WORDS: Record<string, string> = { '\\': 'ⲟⲩ', '£': 'ⲙⲉⲛⲉⲛⲥⲁ', '¦': 'ⲡⲁⲣⲑⲉⲛⲟⲥ' };

/** Text pasted from Word in an old Coptic font comes out as Latin letters. */
export const looksLikeLegacyFont = (s?: string) => !!s && !IS_COPTIC.test(s) && !/[Ͱ-Ͽ؀-ۿ]/.test(s) && /[a-z]{3}/i.test(s);

export function fromCS(s: string) {
  let out = '', mark = '';
  for (const ch of s) {
    if (ch === '`' || ch === '=') { mark = ch === '`' ? '̀' : '̅'; continue; }
    out += (CS_WORDS[ch] ?? CS.get(ch) ?? ch) + mark;
    mark = '';
  }
  return out;
}

const word = (w: string) => [...w.normalize('NFD')]
  .map(ch => G2C.get(ch) ?? (JINKIM.has(ch) ? '̀' : DROP.has(ch) ? '' : ch)).join('')
  .replace(/`\s*(.)/g, '$1̀').normalize('NFC');

/** `copticField`: the whole string is Coptic (so its Greek-looking words are Coptic too, and CS text is converted). */
export function unifyCoptic(s: string, copticField = false): string {
  if (!s) return s;
  if (copticField && looksLikeLegacyFont(s)) return fromCS(s);
  return s.replace(/[^\s,،;:.()[\]/=+-]+/g, w => copticField || IS_COPTIC.test(w) ? word(w) : w);
}
