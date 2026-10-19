#!/usr/bin/env python3
"""Builds public/dict/stgeorge-dict.json from the Coptic dictionary of St. George church, Nazlet El Seman
(stgeorgesaman.com/coptic/coptic-dictionary), as parsed by parse_dict.py from its list pages.
Each word keeps the sources the site lists for it (قاموس أبونا أندرياس، مشروع كيليا، قاموس كروم، ...).

Usage: python3 scripts/build-stgeorge-dict.py path/to/dict.json
"""
import json, re, sys

words = json.load(open(sys.argv[1], encoding='utf-8'))
KIND = [('أسم مذكر', 'اسم', 'مذكر'), ('أسم مؤنث', 'اسم', 'مؤنث'), ('أسم جمع', 'اسم', 'جمع'), ('أسم', 'اسم', ''), ('فعل', 'فعل', ''),
        ('صفة', 'صفة', ''), ('الصيغة الوصفية', 'فعل', 'صيغة وصفية'), ('ظرف', 'ظرف', ''), ('أداة تعريف', 'أداة تعريف', ''),
        ('حرف جر', 'حرف جر', ''), ('ضمير', 'ضمير', ''), ('أداة ربط', 'أداة ربط', '')]
ORIGIN = {'أصل يوناني': 'يوناني', 'أصل قبطي': '', 'أصل عبري': 'عبري', 'أصل لاتيني': 'لاتيني', 'أصل عربي': 'عربي'}

labels, out = [''], []
def label(v):
    if v not in labels:
        labels.append(v)
    return labels.index(v)

for w in words:
    meanings = []
    for a in w['arabic']:
        machine = '(ترجمة آلية)' in a
        for m in re.split(r'\s*،\s*', a.replace('(ترجمة آلية)', '').strip()):
            m = m.strip(' ،,.')
            if m and m not in meanings:
                meanings.append(m + (' *' if machine else ''))
    if not meanings or not w['coptic']:
        continue
    kind, form = '', ''
    for k in w['kind']:
        for prefix, kd, fm in KIND:
            if k.startswith(prefix):
                kind, form = kd, fm
                break
        if kind:
            break
    origin = ORIGIN.get(w['origin'], w['origin'].replace('أصل ', ''))
    # The list pages cut the English off ("...|(noun"): drop the cut, unfinished part.
    english = ' | '.join(p for p in (x.strip() for x in re.sub(r'\.\.\.$', '', w['english']).split('|')) if p and p.count('(') == p.count(')'))
    # [coptic, greek letters, kind, form, origin, meanings, english, dialects, sources]
    out.append([w['coptic'], w['greek'], label(kind), label(form), label(origin), meanings, english,
                [label(d) for d in w['dialects']], [label(s) for s in w['sources']]])

json.dump({
    'source': 'قاموس اللغة القبطية - كنيسة الشهيد العظيم مارجرجس بنزلة السمان (stgeorgesaman.com)',
    'note': 'المعاني المعلّمة بنجمة (*) ترجمة آلية حسب الموقع.',
    'labels': labels, 'words': out,
}, open('public/dict/stgeorge-dict.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'words,', len(labels), 'labels')
