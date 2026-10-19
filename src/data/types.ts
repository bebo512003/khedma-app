export type Gender = 'm' | 'f';

/** Hymn progress, in order: لسه مبدأش → بيتعلمه → حافظه → بيقوله لوحده */
export type HymnStatus = 0 | 1 | 2 | 3;

/** p = حاضر, a = غايب, e = اعتذر */
export type Attendance = 'p' | 'a' | 'e';

/** Rating criteria in order: حفظ، أداء، التزام (1 to 5) */
export type Rating = [number, number, number];

export interface Level {
  id: string;
  name: string;
  grades: string;
  order: number;
}

export interface Member {
  id: string;
  code: string;
  name: string;
  gender: Gender;
  levelId: string;
  grade: string;
  /** YYYY-MM-DD */
  birthdate?: string;
  rank?: string;
  parentPhone?: string;
  /** The member's own mobile, for older members. Messages go here first when it's set. */
  phone?: string;
  photo?: string;
  /** Offline mode: SHA-256 of `${id}:${pin}`; never the PIN itself. */
  pinHash?: string;
  /** Cloud mode: the member's Firebase login (uid) and how many times its PIN was reset (n). */
  account?: { uid: string; n: number };
  example?: boolean;
}

/** What a member may change about themselves from the member app. */
export interface MemberEdit {
  name?: string;
  photo?: string;
  birthdate?: string;
  phone?: string;
  parentPhone?: string;
}

/** Applies a member's own edit, keeping only the fields they're allowed to change. */
export const applyMemberEdit = (m: Member, e: MemberEdit): Member => {
  const str = (x: unknown, max: number) => typeof x === 'string' && x.trim() ? x.trim().slice(0, max) : undefined;
  const photo = typeof e.photo === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(e.photo) && e.photo.length < 100000 ? e.photo : undefined;
  const birthdate = str(e.birthdate, 10);
  const phone = (x: unknown) => { const p = str(x, 20); return p && /^[+\d\s-]+$/.test(p) ? p : undefined; };
  return {
    ...m,
    ...(str(e.name, 80) ? { name: str(e.name, 80)! } : {}),
    photo: photo ?? m.photo,
    birthdate: birthdate && /^\d{4}-\d{2}-\d{2}$/.test(birthdate) ? birthdate : undefined,
    phone: phone(e.phone),
    parentPhone: phone(e.parentPhone),
  };
};

export interface Hymn {
  id: string;
  nameAr: string;
  nameCoptic?: string;
  pdfUrl?: string;
  audioUrl?: string;
  prayer?: string;
  when?: string;
  occasion?: string;
  /** Hymn text, one line per verse; the three are matched line by line. */
  copticText?: string;
  /** The Coptic in Arabic letters (قبطي معرّب). */
  arabicCoptic?: string;
  /** Arabic meaning. */
  meaning?: string;
  /** Servant notes shown above the text, e.g. order rules. */
  notes?: string;
}

/** A hymn's place in a book: the pages it spans. */
export interface BookEntry {
  hymnId: string;
  from?: number;
  to?: number;
}

/** The school's booklet for a level and term; its index is where the curriculum comes from. */
export interface Book {
  id: string;
  title: string;
  levelId?: string;
  termId?: string;
  pdfUrl?: string;
  /** Page images hosted with the app, e.g. 'books/nativity-shabab-2/' holding 01.webp, 02.webp… */
  pagesBase?: string;
  /** Pages of a PDF a servant uploaded, stored as images in the bookPages collection. */
  uploaded?: boolean;
  pageCount?: number;
  /** Set when the book came from a ready pack, so a newer edition can replace it. */
  packId?: string;
  packVersion?: number;
  entries: BookEntry[];
}

export interface Term {
  id: string;
  name: string;
  start: string;
  end: string;
}

export interface Session {
  id: string;
  date: string;
  levelId: string;
  termId: string;
  hymnIds: string[];
  attendance: Record<string, Attendance>;
  ratings: Record<string, Rating>;
  /** Hymns that reached حافظه / بيقوله لوحده during this session, per member (drives milestone points). */
  milestones?: Record<string, { memorized: number; solo: number }>;
  durationMs?: number;
  /** Servant's short note to a member, shown in their ratings. */
  notes?: Record<string, string>;
}

export interface Templates {
  absence: string;
  birthday?: string;
}

export interface AppData {
  version: 1;
  levels: Level[];
  members: Member[];
  hymns: Hymn[];
  books: Book[];
  terms: Term[];
  /** key: `${termId}:${levelId}` → ordered hymn ids */
  curricula: Record<string, string[]>;
  /** memberId → hymnId → status */
  progress: Record<string, Record<string, HymnStatus>>;
  sessions: Session[];
  templates: Templates;
  nextCode: number;
}

export const STATUS_LABELS = ['لسه مبدأش', 'بيتعلمه', 'حافظه', 'بيقوله لوحده'] as const;
export const CRITERIA = ['حفظ', 'أداء', 'التزام'] as const;
export const RANKS = ['أبصالتس', 'أغنسطس', 'إيبودياكون', 'دياكون', 'أرشيدياكون'] as const;

/** A servant's access. levelIds ['*'] means every level. */
export interface Servant {
  uid: string;
  name: string;
  email: string;
  role: 'lead' | 'servant';
  levelIds: string[];
  /** Profile the servant fills in themselves (see SERVANT_PROFILE_KEYS). */
  photo?: string;
  phone?: string;
  birthdate?: string;
  rank?: string;
  /** e.g. what they serve or teach, shown on the team page. */
  about?: string;
}

/** Fields a servant may change on their own record; everything else is the lead's. Mirrored in firestore.rules. */
export const SERVANT_PROFILE_KEYS = ['name', 'photo', 'phone', 'birthdate', 'rank', 'about'] as const;

export interface Invite {
  email: string;
  role: 'lead' | 'servant';
  levelIds: string[];
  invitedBy: string;
}
