import { useCan, useIsLead, useStore } from '../data/store';

export type Item = [to: string, icon: string, label: string];
export type Group = { title: string; items: Item[] };

/**
 * The servant app's menu in groups, shared by the phone "more" sheet and the computer top bar,
 * so both show the same things in the same places. Account and school settings live on /settings.
 */
export function useMenu(): Group[] {
  const canReports = useCan('reports'), canMembers = useCan('members');
  const groups: Group[] = [
    { title: 'الحصص', items: [['/sessions', 'clock', 'سجل الحصص'], ['/reviews', 'mic', 'التسميع'], ['/followup', 'heart', 'الافتقاد']] },
    { title: 'المخدومين', items: [['/members', 'people', 'المخدومين'], ['/ranking', 'chart', 'الترتيب'], ['/reports', 'chart', 'التقارير'], ['/cards', 'qr', 'كروت QR']] },
    { title: 'الألحان', items: [['/library', 'book', 'المكتبة'], ['/curriculum', 'list', 'المنهج'], ['/books', 'books', 'الكتب']] },
    { title: 'القبطي', items: [['/dictionary', 'dict', 'القاموس'], ['/translate', 'dict', 'ترجمة جملة']] },
  ];
  return groups.map(g => ({ ...g, items: g.items.filter(([to]) => (to !== '/reports' || canReports) && (to !== '/cards' || canMembers)) }));
}

/** What goes on the settings page, by section. */
export function useSettingsMenu(): Group[] {
  const { cloud } = useStore();
  const lead = useIsLead();
  const out: Group[] = [];
  if (cloud) out.push({ title: 'حسابي', items: [['/profile', 'user', 'بروفايلي']] });
  const school: Item[] = [];
  if (lead) school.push(['/levels', 'layers', 'المستويات']);
  if (cloud) school.push(['/team', 'team', 'الفريق'], ['/notify', 'bell', 'التنبيهات والتذكيرات']);
  if (lead) school.push(['/backup', 'download', 'نسخة احتياطية']);
  if (school.length) out.push({ title: 'المدرسة', items: school });
  out.push({ title: 'عن الأبلكيشن', items: [['/install', 'download', 'إزاي أنزّل التطبيق']] });
  return out;
}
