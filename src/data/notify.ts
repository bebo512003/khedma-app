/** Reminder schedule the lead servant sets; the scheduled job reads it from settings/notify (Cairo time). */
export interface Reminder { on: boolean; days: number[]; hour: number; title: string; body: string }
/** One the lead adds: who gets it, and either every week on `days` or once on `date`. */
export interface CustomReminder extends Reminder {
  id: string;
  to: 'members' | 'servants' | 'all';
  /** Empty: every level. */
  levelIds: string[];
  /** YYYY-MM-DD: sent once that day; otherwise weekly. */
  date?: string;
}
export interface NotifySettings { hymn: Reminder; session: Reminder; custom?: CustomReminder[]; testAt?: number; testUid?: string }

/** {الألحان} becomes the member's own hymns they haven't finished yet. Keep in sync with scripts/notify/send.mjs. */
export const HYMNS_TAG = '{الألحان}';

export const DEFAULT_NOTIFY: NotifySettings = {
  hymn: { on: true, days: [0, 2], hour: 19, title: 'وقت المراجعة 🎶', body: `خد ١٠ دقايق النهاردة وراجع ${HYMNS_TAG}` },
  session: { on: true, days: [4], hour: 21, title: 'بكرة حصة الألحان', body: `متنساش حصة بكرة، وراجع ${HYMNS_TAG} قبلها 🙏` },
};

export const newReminder = (): CustomReminder => ({
  id: Math.random().toString(36).slice(2, 10), on: true, days: [5], hour: 18, title: '', body: '', to: 'members', levelIds: [],
});

export const withDefaults = (s?: Partial<NotifySettings> | null): NotifySettings => ({
  ...s, custom: s?.custom ?? [], hymn: { ...DEFAULT_NOTIFY.hymn, ...s?.hymn }, session: { ...DEFAULT_NOTIFY.session, ...s?.session },
});

export const DAY_NAMES = ['الأحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];

export const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? 'الصبح' : h < 17 ? 'الضهر' : 'بالليل'}`;
