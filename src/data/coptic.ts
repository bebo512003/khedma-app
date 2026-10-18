/**
 * Coptic calendar: date conversion, feasts, fasts and the liturgical tune of the day.
 * Everything is computed (no data file), so it works offline for any year.
 */

export const COPTIC_MONTHS = ['توت', 'بابه', 'هاتور', 'كيهك', 'طوبة', 'أمشير', 'برمهات', 'برمودة', 'بشنس', 'بؤونة', 'أبيب', 'مسرى', 'النسيء'];

const COPTIC_EPOCH = 1825030; // Julian Day Number of 1 توت 1 (29 August 284 AD, Julian)
const DAY = 86400000;

/** Julian Day Number of a local calendar date (time of day ignored). */
const jdn = (d: Date) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY) + 2440588;
const fromJdn = (n: number) => { const u = new Date((n - 2440588) * DAY); return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()); };
const copticJdn = (y: number, m: number, d: number) => COPTIC_EPOCH - 1 + 365 * (y - 1) + Math.floor(y / 4) + 30 * (m - 1) + d;

export interface CopticDate { year: number; month: number; day: number }

export function toCoptic(date: Date): CopticDate {
  const n = jdn(date);
  const year = Math.floor((4 * (n - COPTIC_EPOCH) + 1463) / 1461);
  const month = Math.floor((n - copticJdn(year, 1, 1)) / 30) + 1;
  return { year, month, day: n - copticJdn(year, month, 1) + 1 };
}

export const fromCoptic = (y: number, m: number, d: number) => fromJdn(copticJdn(y, m, d));
export const formatCoptic = (c: CopticDate) => `${c.day} ${COPTIC_MONTHS[c.month - 1]} ${c.year} ش`;

/** Orthodox Easter (Julian computus), as a Gregorian date. Valid 1900 to 2099 (13-day offset). */
export function easter(year: number): Date {
  const a = year % 4, b = year % 7, c = year % 19;
  const d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31), day = ((d + e + 114) % 31) + 1;
  return new Date(year, month - 1, day + 13);
}

export type Kind = 'major' | 'minor' | 'fast' | 'saint';
export interface Occasion { name: string; kind: Kind; start: Date; end: Date }

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const one = (name: string, kind: Kind, d: Date): Occasion => ({ name, kind, start: d, end: d });

/** Fixed feasts on Coptic dates. */
const FIXED: [number, number, string, Kind][] = [
  [1, 1, 'عيد النيروز (رأس السنة القبطية)', 'minor'],
  [1, 17, 'عيد الصليب', 'minor'],
  [4, 1, 'بداية شهر كيهك', 'minor'],
  [5, 1, 'استشهاد القديس اسطفانوس رئيس الشمامسة، شفيع المدرسة', 'saint'],
  [5, 11, 'عيد الغطاس (الظهور الإلهي)', 'major'],
  [5, 13, 'عيد عرس قانا الجليل', 'minor'],
  [6, 8, 'عيد دخول المسيح الهيكل', 'minor'],
  [7, 29, 'عيد البشارة', 'major'],
  [8, 23, 'استشهاد مارجرجس، شفيع الكنيسة', 'saint'],
  [9, 24, 'عيد دخول المسيح أرض مصر', 'minor'],
  [11, 5, 'عيد الرسل', 'minor'],
  [12, 13, 'عيد التجلي', 'minor'],
  [12, 16, 'عيد صعود جسد العذراء', 'minor'],
];

/** Every occasion overlapping the Gregorian year `gy` (plus the edges of its neighbours). */
export function occasions(gy: number): Occasion[] {
  const out: Occasion[] = [];
  for (const y of [gy - 1, gy, gy + 1]) {
    const e = easter(y);
    out.push(
      { name: 'صوم يونان (نينوى)', kind: 'fast', start: addDays(e, -69), end: addDays(e, -67) },
      one('فصح يونان', 'minor', addDays(e, -66)),
      { name: 'الصوم الكبير', kind: 'fast', start: addDays(e, -55), end: addDays(e, -8) },
      one('أحد الشعانين', 'major', addDays(e, -7)),
      { name: 'أسبوع الآلام', kind: 'fast', start: addDays(e, -6), end: addDays(e, -1) },
      one('خميس العهد', 'minor', addDays(e, -3)),
      one('الجمعة العظيمة', 'minor', addDays(e, -2)),
      one('سبت النور', 'minor', addDays(e, -1)),
      one('عيد القيامة المجيد', 'major', e),
      one('أحد توما', 'minor', addDays(e, 7)),
      one('عيد الصعود', 'major', addDays(e, 39)),
      one('عيد العنصرة (حلول الروح القدس)', 'major', addDays(e, 49)),
      // Apostles' fast runs from the day after Pentecost to the eve of عيد الرسل (5 أبيب).
      { name: 'صوم الرسل', kind: 'fast', start: addDays(e, 50), end: addDays(copticOn(y, 11, 5), -1) },
      { name: 'صوم العذراء', kind: 'fast', start: copticOn(y, 12, 1), end: copticOn(y, 12, 15) },
      { name: 'صوم الميلاد', kind: 'fast', start: new Date(y, 10, 25), end: new Date(y + 1, 0, 5) },
      one('برامون الميلاد', 'fast', new Date(y + 1, 0, 6)),
      // The church keeps Christmas on 7 January every year.
      one('عيد الميلاد المجيد', 'major', new Date(y, 0, 7)),
      one('عيد الختان', 'minor', new Date(y, 0, 14)),
    );
    for (const [m, d, name, kind] of FIXED) out.push(one(name, kind, copticOn(y, m, d)));
    out.push(one('برامون الغطاس', 'fast', addDays(copticOn(y, 5, 11), -1)));
  }
  return out.filter(o => o.end >= new Date(gy - 1, 11, 1) && o.start <= new Date(gy + 1, 1, 1));
}

/** The Gregorian date of Coptic month/day that falls in Gregorian year `gy`. */
function copticOn(gy: number, m: number, d: number) {
  const cy = toCoptic(new Date(gy, 0, 1)).year;
  const a = fromCoptic(cy, m, d);
  return a.getFullYear() === gy ? a : fromCoptic(cy + 1, m, d);
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const within = (d: Date, o: Occasion) => d >= o.start && d <= o.end;

export interface Today {
  date: Date;
  coptic: CopticDate;
  /** Feasts and saints on this day. */
  feasts: Occasion[];
  /** The fast this day is in, if any (Wednesday/Friday included). */
  fast: string | null;
  /** Liturgical tune for the day. */
  tune: string;
  /** Next major or minor feast after today. */
  next: { occasion: Occasion; days: number } | null;
}

export function copticDay(date = new Date()): Today {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const all = occasions(d.getFullYear());
  const on = all.filter(o => within(d, o));
  const feasts = on.filter(o => o.kind !== 'fast');
  const seasonFast = on.find(o => o.kind === 'fast' && o.start.getTime() !== o.end.getTime()) ?? on.find(o => o.kind === 'fast');

  const e = easter(d.getFullYear());
  const inFifty = d >= e && d <= addDays(e, 49);
  // No Wednesday/Friday fast in the Fifty Days, or from Christmas to Theophany.
  const xmasToEpiphany = d >= new Date(d.getFullYear(), 0, 7) && d <= copticOn(d.getFullYear(), 5, 11);
  const c = toCoptic(d);
  // Nayrouz to the Feast of the Cross (1 to 19 توت) is a festive season, like the Fifty Days.
  const nayrouz = c.month === 1 && c.day <= 19;
  const weekdayFast = !inFifty && !xmasToEpiphany && !nayrouz && (d.getDay() === 3 || d.getDay() === 5) ? (d.getDay() === 3 ? 'صوم الأربعاء' : 'صوم الجمعة') : null;
  const majorFeast = feasts.some(f => f.kind === 'major');
  const fast = majorFeast ? null : seasonFast?.name ?? weekdayFast;

  const tune =
    d >= addDays(e, -6) && d <= addDays(e, -1) ? 'الطقس الحزايني (البصخة)'
    : sameDay(d, addDays(e, -7)) || (c.month === 1 && c.day >= 17 && c.day <= 19) ? 'الطقس الشعانيني'
    : inFifty || majorFeast || nayrouz || (d >= new Date(d.getFullYear(), 0, 7) && d <= new Date(d.getFullYear(), 0, 14)) ? 'الطقس الفرايحي'
    : (seasonFast?.name === 'الصوم الكبير' || seasonFast?.name === 'صوم يونان (نينوى)') && d.getDay() !== 0 && d.getDay() !== 6 ? 'الطقس الصيامي'
    : c.month === 4 ? 'الطقس الكيهكي'
    : 'الطقس السنوي';

  // What's coming: feasts by their day, fasts by the day they begin.
  const upcoming = [...all, ...occasions(d.getFullYear() + 1)]
    .filter(o => o.start > d && o.name !== 'بداية شهر كيهك' && !(o.kind === 'fast' && sameDay(o.start, o.end)))
    .map(o => o.kind === 'fast' ? { ...o, name: `بداية ${o.name}` } : o)
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0];
  const next = upcoming ? { occasion: upcoming, days: Math.round((upcoming.start.getTime() - d.getTime()) / DAY) } : null;

  return { date: d, coptic: c, feasts, fast, tune, next };
}
