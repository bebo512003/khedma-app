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
  rank?: string;
  parentPhone?: string;
  photo?: string;
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
}

export interface Templates {
  absence: string;
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
