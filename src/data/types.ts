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
}

export interface Invite {
  email: string;
  role: 'lead' | 'servant';
  levelIds: string[];
  invitedBy: string;
}
