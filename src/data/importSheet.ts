import { unzipSync, strFromU8 } from 'fflate';
import { RANKS, type Gender } from './types';
import { GRADES } from './logic';

/** Reads the first sheet of an .xlsx, or a .csv, into rows of text. */
export async function readSheet(file: File): Promise<string[][]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (/\.csv$/i.test(file.name) || buf[0] !== 0x50) return parseCsv(new TextDecoder().decode(buf).replace(/^﻿/, ''));
  const zip = unzipSync(buf);
  const xml = (path: string) => zip[path] ? new DOMParser().parseFromString(strFromU8(zip[path]), 'application/xml') : null;
  const strings = [...(xml('xl/sharedStrings.xml')?.getElementsByTagName('si') ?? [])]
    .map(si => [...si.getElementsByTagName('t')].map(t => t.textContent ?? '').join(''));
  const sheetPath = Object.keys(zip).filter(p => /^xl\/worksheets\/sheet\d+\.xml$/.test(p)).sort()[0];
  const sheet = sheetPath ? xml(sheetPath) : null;
  if (!sheet) throw new Error('no sheet');
  const rows: string[][] = [];
  for (const row of sheet.getElementsByTagName('row')) {
    const out: string[] = [];
    for (const c of row.getElementsByTagName('c')) {
      const col = colIndex(c.getAttribute('r') ?? '') ?? out.length;
      const type = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
      out[col] = type === 's' ? strings[Number(v)] ?? ''
        : type === 'inlineStr' ? [...c.getElementsByTagName('t')].map(t => t.textContent).join('')
        : v;
    }
    rows.push(Array.from(out, x => x ?? ''));
  }
  return rows;
}

const colIndex = (ref: string) => {
  const letters = ref.match(/^[A-Z]+/)?.[0];
  return letters ? [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1 : null;
};

function parseCsv(text: string): string[][] {
  const sep = (text.split('\n')[0].match(/;/g)?.length ?? 0) > (text.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = []; let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** Arabic spelling differences (أ/ا، ى/ي، ة/ه) and Arabic-Indic digits shouldn't matter when matching. */
export const norm = (s: string) => s.trim().toLowerCase()
  .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ً-ْ]/g, '')
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\s+/g, ' ');

export type Field = 'name' | 'gender' | 'grade' | 'birthdate' | 'parentPhone' | 'phone' | 'rank';
export const FIELD_LABELS: Record<Field, string> = {
  name: 'الاسم', gender: 'النوع', grade: 'السنة الدراسية', birthdate: 'تاريخ الميلاد',
  parentPhone: 'موبايل ولي الأمر', phone: 'موبايل المخدوم', rank: 'الرتبة',
};

/** Which column holds which field, guessed from the header row. */
export function guessColumns(header: string[]): Partial<Record<Field, number>> {
  const out: Partial<Record<Field, number>> = {};
  const take = (f: Field, test: (h: string) => boolean) => {
    const i = header.findIndex((h, i) => test(norm(h)) && !Object.values(out).includes(i));
    if (i >= 0 && out[f] === undefined) out[f] = i;
  };
  take('parentPhone', h => /ولي|والد|الاب|الام|parent/.test(h));
  take('phone', h => /موبايل|تليفون|هاتف|رقم|phone|mobile|واتس/.test(h) && !/كود|قومي/.test(h));
  take('birthdate', h => /ميلاد|birth/.test(h));
  take('grade', h => /سنه|صف|مرحله|دراس|grade|class/.test(h));
  take('gender', h => /نوع|جنس|gender/.test(h));
  take('rank', h => /رتبه|شماس|rank/.test(h));
  take('name', h => /اسم|name/.test(h));
  return out;
}

const ORD: Record<string, number> = { اول: 1, اولي: 1, اولى: 1, تاني: 2, ثاني: 2, تانيه: 2, ثانيه: 2, تالت: 3, ثالث: 3, تالته: 3, ثالثه: 3, رابع: 4, رابعه: 4, خامس: 5, خامسه: 5, سادس: 6, سادسه: 6 };

/** "3 اعدادي", "تالتة إعدادي", "الصف الثالث الإعدادي", "9", "جامعة" → one of GRADES. */
export function parseGrade(raw: string): string | null {
  const s = norm(raw);
  if (!s) return null;
  const exact = GRADES.find(g => norm(g) === s); if (exact) return exact;
  if (/جامع|كليه|university/.test(s)) return 'جامعة';
  if (/خريج|متخرج|graduate/.test(s)) return 'خريج';
  const n = Number(s.match(/\d+/)?.[0] ?? s.split(' ').map(w => ORD[w.replace(/^ال/, '')]).find(Boolean) ?? NaN);
  // [offset into GRADES, highest year in that stage]; a bare number counts from first primary.
  const [offset, max] = /ابتدا/.test(s) ? [0, 6] : /اعداد/.test(s) ? [6, 3] : /ثانو/.test(s) ? [9, 3] : [0, 12];
  return n >= 1 && n <= max ? GRADES[offset + n - 1] : null;
}

export function parseGender(raw: string): Gender | null {
  const s = norm(raw);
  if (/^(ولد|ذكر|م|m|male|boy|شاب)$/.test(s)) return 'm';
  if (/^(بنت|انثي|ف|f|female|girl|شابه)$/.test(s)) return 'f';
  return null;
}

/** Excel serial numbers, 15/3/2015, 2015-03-15. */
export function parseDate(raw: string): string | null {
  const s = norm(raw);
  if (!s) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const ok = (y: number, m: number, d: number) => y > 1930 && y < 2030 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : null;
  if (/^\d{4,5}(\.\d+)?$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000);
    return ok(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/); if (m) return ok(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return ok(y, +m[2], +m[1]); }
  return null;
}

/** Excel drops the leading 0 of numbers stored as numbers: 1012345678 → 01012345678. */
export function parsePhone(raw: string): string | undefined {
  let d = norm(raw).replace(/\D/g, '');
  if (/^1\d{9}$/.test(d)) d = '0' + d;
  if (/^201\d{9}$/.test(d)) d = '0' + d.slice(2);
  return d || undefined;
}

export function parseRank(raw: string): string | undefined {
  const s = norm(raw);
  return RANKS.find(r => s && (norm(r) === s || s.includes(norm(r)))) ?? undefined;
}

/** Template the servant can fill in Excel and upload back (header row, then two examples). */
export function templateRows() {
  return [
    Object.values(FIELD_LABELS),
    ['كيرلس مينا', 'ولد', 'تالتة ابتدائي', '15/3/2017', '01012345678', '', 'أبصالتس'],
    ['مريم جرجس', 'بنت', 'أولى إعدادي', '2/11/2013', '01112345678', '01212345678', ''],
  ];
}
