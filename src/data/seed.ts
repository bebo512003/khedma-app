import type { AppData, Member, Session } from './types';

const LEVELS = [
  { id: 'l1', name: 'ابتدائي 1', grades: 'أولى وتانية ابتدائي', order: 1 },
  { id: 'l2', name: 'ابتدائي 2', grades: 'من تالتة لسادسة ابتدائي', order: 2 },
  { id: 'l3', name: 'شباب', grades: 'إعدادي وأنت طالع', order: 3 },
];

const HYMNS = [
  { id: 'h1', nameAr: 'أسبسمس آدام', prayer: 'القداس', occasion: 'سنوي' },
  { id: 'h2', nameAr: 'مرد الإنجيل السنوي', prayer: 'القداس', occasion: 'سنوي' },
  { id: 'h3', nameAr: 'الهوس الأول', prayer: 'التسبحة', occasion: 'سنوي' },
];

const NAMES: [string, 'm' | 'f'][] = [
  ['مينا', 'm'], ['كيرلس', 'm'], ['مريم', 'f'], ['بيشوي', 'm'], ['يوستينا', 'f'], ['أبانوب', 'm'],
  ['مارينا', 'f'], ['جورج', 'm'], ['كاترين', 'f'], ['ديفيد', 'm'], ['ماريو', 'm'], ['فيلوباتير', 'm'],
];

/** Example data so the app opens in a working state. Every example member is flagged and can be removed in one tap. */
export function seedData(): AppData {
  const members: Member[] = NAMES.map(([name, gender], i) => ({
    id: `ex${i + 1}`,
    code: String(i + 1).padStart(4, '0'),
    name,
    gender,
    levelId: 'l2',
    grade: 'خامسة ابتدائي',
    rank: gender === 'm' && i % 3 === 0 ? 'أبصالتس' : undefined,
    example: true,
  }));

  // Two earlier Fridays where أبانوب and كاترين were absent, so the follow-up list has something real to compute.
  const past = (id: string, date: string): Session => ({
    id, date, levelId: 'l2', termId: 't1', hymnIds: ['h1', 'h2'],
    attendance: Object.fromEntries(members.map(m => [m.id, m.name === 'أبانوب' || m.name === 'كاترين' ? 'a' : 'p'])),
    ratings: Object.fromEntries(members.filter(m => m.name !== 'أبانوب' && m.name !== 'كاترين').map(m => [m.id, [3, 3, 3]])),
  });

  return {
    version: 1,
    levels: LEVELS,
    members,
    hymns: HYMNS,
    terms: [{ id: 't1', name: 'أكتوبر – ديسمبر 2026', start: '2026-10-01', end: '2026-12-31' }],
    curricula: { 't1:l2': ['h1', 'h2'], 't1:l1': ['h3'], 't1:l3': ['h1', 'h2', 'h3'] },
    progress: {},
    sessions: [past('ex-s1', '2026-10-02'), past('ex-s2', '2026-10-09')],
    templates: {
      absence: 'إزيك يا {الاسم}، وحشتنا في مدرسة الشمامسة. بقالك {الغياب} مرات مش بتيجي، إن شاء الله تكون بخير. مستنيينك الجمعة الجاية.',
    },
    nextCode: NAMES.length + 1,
  };
}
