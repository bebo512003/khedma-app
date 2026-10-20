/**
 * Coptic in Arabic letters (قبطي معرّب), the way it is read in church (Greco-Bohairic), for people who can't read
 * the Coptic letters yet: ⲫⲛⲟⲩϯ → إفنوتي, ⲭⲉⲣⲉ → شيري, ⲡⲓⲁⲅⲅⲉⲗⲟⲥ → بي انجيلوس.
 * It is a guide to reading, not a rule book: some words are said differently in different churches.
 */

const VOWELS = new Set('ⲁⲉⲏⲓⲟⲱⲩ');
const FRONT = new Set('ⲉⲓⲏⲩ');
const JINKIM = '̀';
const MARKS = /[̣̅̄̈́̂̃̇⳯-⳱︤-︦]/g;

/** Words written short under a line (ⲡⲟ̅ⲥ̅, ⲓⲏ̅ⲥ̅, ⲡⲭ̅ⲥ̅), said in full. */
const ABBREV: Record<string, string> = {
  ⲟⲥ: 'ϭⲟⲓⲥ', ⲡⲟⲥ: 'ⲡϭⲟⲓⲥ', ⲡⲉⲛⲟⲥ: 'ⲡⲉⲛϭⲟⲓⲥ', ⲡϭⲥ: 'ⲡϭⲟⲓⲥ', ⲡⲉⲛϭⲥ: 'ⲡⲉⲛϭⲟⲓⲥ', ⲓⲏⲥ: 'ⲓⲏⲥⲟⲩⲥ', ⲓⲥ: 'ⲓⲏⲥⲟⲩⲥ', ⲡⲭⲥ: 'ⲡⲭⲣⲓⲥⲧⲟⲥ', ⲭⲥ: 'ⲭⲣⲓⲥⲧⲟⲥ',
  ⲫϯ: 'ⲫⲛⲟⲩϯ', ⲡⲛⲁ: 'ⲡⲛⲉⲩⲙⲁ', ⲓⲗⲏⲙ: 'ⲓⲉⲣⲟⲩⲥⲁⲗⲏⲙ', ⲓⲥⲗ: 'ⲓⲥⲣⲁⲏⲗ', ⲁⲗ: 'ⲁⲗⲗⲏⲗⲟⲩⲓⲁ', ⲁⲗⲗ: 'ⲁⲗⲗⲏⲗⲟⲩⲓⲁ',
};
const lower = (ch: string) => {
  const c = ch.codePointAt(0)!;
  return (c >= 0x2c80 && c <= 0x2ce3 && c % 2 === 0) || (c >= 0x03e2 && c <= 0x03ef && c % 2 === 0) ? String.fromCodePoint(c + 1) : ch;
};

/** One Coptic word in Arabic letters. */
function word(w: string): string {
  if (w.includes('\u0305')) {
    const bare = [...w.normalize('NFD')].map(lower).join('').replace(/[^Ⲁ-⳿Ϣ-ϯ]/g, '');
    if (ABBREV[bare]) w = ABBREV[bare];
  }
  // Lowercase, keeping the jinkim right after its letter.
  const s = [...w.normalize('NFD').replace(MARKS, '')].map(lower);
  const letters: { ch: string; jinkim: boolean }[] = [];
  for (const ch of s) {
    if (ch === JINKIM) { if (letters.length) letters[letters.length - 1].jinkim = true; continue; }
    if (/[Ⲁ-⳿Ϣ-ϯ]/.test(ch)) letters.push({ ch, jinkim: false });
  }
  let out = '';
  // The article is said apart in church books: ⲡⲓⲁⲅⲅⲉⲗⲟⲥ → بي انجيلوس, ϯⲡⲁⲣⲑⲉⲛⲟⲥ → تي بارثينوس.
  const head = letters.slice(0, 2).map(l => l.ch).join('');
  let start = 0;
  if (letters.length >= 6 && (head === 'ⲡⲓ' || head === 'ⲛⲓ')) { out = head === 'ⲡⲓ' ? 'بي ' : 'ني '; start = 2; }
  else if (letters.length >= 4 && letters[0].ch === 'ϯ' && !letters[0].jinkim) { out = 'تي '; start = 1; }
  // Two consonants to begin with take a short "e" before them: ⲫⲛⲟⲩϯ → إفنوتي.
  else if (letters.length > 2 && 'ⲫⲥⲙⲛϣϥⲑϩ'.includes(letters[0].ch) && !letters[0].jinkim && !VOWELS.has(letters[1].ch)) out = 'إ';
  for (let i = start; i < letters.length; i++) {
    const { ch, jinkim } = letters[i];
    const prev = i > start ? letters[i - 1]?.ch : undefined, next = letters[i + 1]?.ch, first = i === start && !out.endsWith('إ');
    // A jinkim on a consonant is read as a short "e" before it, said apart: ⲙ̀ⲫ̀ⲓⲱⲧ → إم إفيوت.
    if (jinkim && !VOWELS.has(ch)) out += !out || out.endsWith(' ') ? 'إ' : ' إ';
    switch (ch) {
      case 'ⲁ': out += first ? 'أ' : 'ا'; break;
      case 'ⲉ': out += first ? 'إ' : prev && VOWELS.has(prev) ? 'ئي' : 'ي'; break;
      case 'ⲏ': out += first ? 'إي' : 'ي'; break;
      case 'ⲓ':
        if (first) out += next && 'ⲁⲟⲱ'.includes(next) ? 'ي' : next === 'ⲏ' ? 'إ' : 'إي';
        else out += prev && 'ⲉⲏⲓ'.includes(prev) ? 'ئ' : 'ي';
        break;
      case 'ⲟ':
        // ⲟⲩ before a vowel is a w: ⲉⲑⲟⲩⲁⲃ → إثؤواب.
        if (next === 'ⲩ') { const v = letters[i + 2]?.ch; out += first ? 'أو' : v && VOWELS.has(v) ? 'ؤو' : 'و'; i++; break; }
        out += first ? 'أو' : 'و'; break;
      case 'ⲱ': out += first ? 'أو' : 'و'; break;
      // After a vowel ⲩ is a v (ⲡⲛⲉⲩⲙⲁ بنيفما), otherwise an i.
      case 'ⲩ': out += prev === 'ⲁ' || prev === 'ⲉ' ? 'ف' : first ? 'إي' : 'ي'; break;
      // ⲃ is a v between vowels (ⲛⲓⲃⲉⲛ نيفين) and a b at the end or before a consonant (ⲉⲑⲟⲩⲁⲃ إثؤواب).
      case 'ⲃ': out += next && VOWELS.has(next) ? 'ف' : 'ب'; break;
      case 'ⲅ': out += next && 'ⲅⲕⲭⲝ'.includes(next) ? 'ن' : next && FRONT.has(next) ? 'ج' : 'غ'; break;
      case 'ⲇ': out += 'ذ'; break;
      case 'ⲍ': out += 'ز'; break;
      case 'ⲑ': out += 'ث'; break;
      case 'ⲕ': out += 'ك'; break;
      case 'ⲗ': out += 'ل'; break;
      case 'ⲙ': out += 'م'; break;
      case 'ⲛ': out += 'ن'; break;
      case 'ⲝ': out += 'كس'; break;
      case 'ⲡ': out += 'ب'; break;
      case 'ⲣ': out += 'ر'; break;
      case 'ⲥ': out += next === 'ⲙ' && prev === 'ⲟ' ? 'ز' : 'س'; break;
      case 'ⲧ': out += 'ت'; break;
      case 'ⲫ': out += 'ف'; break;
      case 'ⲭ': out += next && FRONT.has(next) ? 'ش' : next && !VOWELS.has(next) ? 'خ' : 'ك'; break;
      case 'ⲯ': out += 'إبس'; break;
      case 'ϣ': out += 'ش'; break;
      case 'ϥ': out += 'ف'; break;
      case 'ϧ': out += 'خ'; break;
      case 'ϩ': out += 'ه'; break;
      case 'ϫ': out += 'ج'; break;
      case 'ϭ': out += 'تش'; break;
      case 'ϯ': out += 'تي'; break;
    }
  }
  return out;
}

/** A Coptic word or line in Arabic letters; anything that isn't Coptic (punctuation, numbers) stays as it is. */
export function arabize(text: string) {
  return text.split(/(\s+|[:.,;·⳹⳾⳿+]+)/).map(part => /[Ⲁ-⳿Ϣ-ϯ]/.test(part) ? word(part) : part).join('').replace(/\s+/g, ' ').trim();
}

/** What we compare Arabized Coptic on: no hamza or harakat, one spelling per sound. */
export const arabizedKey = (s: string) => s.replace(/[ً-ْٰ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/[ئؤء]/g, '').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[ثص]/g, 'س').replace(/[ذضظ]/g, 'د').replace(/ط/g, 'ت').replace(/ق/g, 'ك').replace(/ح/g, 'ه').replace(/غ/g, 'ج').replace(/ڤ/g, 'ف')
  .replace(/[^ء-ي]/g, '');
/** Only the consonants: vowels are where people spell Arabized Coptic most differently. */
export const consonantKey = (s: string) => arabizedKey(s).replace(/[اوي]/g, '').replace(/(.)\1+/g, '$1');

/** Edit distance, giving up (returning max + 1) once it is clearly over max. */
export function editDistance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let low = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < low) low = cur[j];
    }
    if (low > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
