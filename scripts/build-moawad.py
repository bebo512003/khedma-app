#!/usr/bin/env python3
"""Builds public/dict/moawad.json from Moawad Dawoud Abdel-Nour's Coptic dictionary (Bohairic and Sahidic, Coptic
Cultural Center, 2013), used with the author's permission (2026-10-19).

The book is a low-resolution scan with no text layer, so its pages were read by AI vision into one JSON file per
page (see scripts/moawad-prompt.txt): headword forms, dialects, Arabic meanings, examples. Coptic spellings can have
a wrong letter here and there, so the app labels every entry as a machine reading.

Usage: python3 scripts/build-moawad.py dir-of-page-json
"""
import json, os, re, sys

DIALECT = {'ب': 'بحيري', 'ص': 'صعيدي', 'ف': 'فيومي', 'ع': 'أخميمي', 'ش': 'صعيدي', 'م': 'مصري أوسط'}
POS = {'ت': 'مؤنث', 'ⲧ': 'مؤنث', 'ϯ': 'مؤنث', 'ذ': 'مذكر', 'ⲡ': 'مذكر', 'ⲟⲩ': 'نكرة', 'ϩⲉⲛ': 'جمع', 'ⲛ': 'جمع', 'ⲛⲓ': 'جمع', 'ى': 'يوناني', 'ي': 'يوناني'}
COPTIC = re.compile(r'[Ⲁ-⳿Ϣ-ϯ]')

def clean(s):
    if isinstance(s, list):
        s = '، '.join(str(x) for x in s)
    return re.sub(r'\s+', ' ', str(s or '').strip())

def coptic_ok(s):
    """A form worth indexing: mostly Coptic letters, no unreadable marks."""
    s = s.replace('=', '').replace(' ', '')
    return s and '?' not in s and sum(bool(COPTIC.match(c)) for c in s) >= len(s) * .8

src = sys.argv[1]
out, pages, skipped = [], 0, 0
for f in sorted(os.listdir(src)):
    if not re.fullmatch(r'\d{4}\.json', f):
        continue
    pages += 1
    page = int(f[:4])
    for e in json.load(open(os.path.join(src, f), encoding='utf-8')):
        coptic = e.get('coptic') or []
        forms = [clean(c).lower() for c in ([coptic] if isinstance(coptic, str) else coptic) if clean(c)]
        # Numbered senses come as "1. ..." and Bible references as "[...]".
        arabic = [re.sub(r'^[\d١-٩]+\s*[.\-]\s*', '', clean(a)) for a in ([e['arabic']] if isinstance(e.get('arabic'), str) else e.get('arabic') or [])]
        arabic = [re.sub(r'\s*\.\s+', '، ', re.sub(r'\s*\[[^\]]*\]?', '', a)).strip(' ،.') for a in arabic]
        arabic = [a for a in arabic if a and not a.endswith(':')]
        if not forms or not arabic or not coptic_ok(forms[0]):
            skipped += 1
            continue
        forms = [forms[0]] + [x for x in forms[1:] if coptic_ok(x) and x != forms[0]]
        dialects = []
        for d in e.get('dialects') or []:
            name = DIALECT.get(clean(d))
            if name and name not in dialects:
                dialects.append(name)
        examples = [[clean(x.get('coptic')).lower(), DIALECT.get(clean(x.get('dialect')), ''), clean(x.get('arabic')), clean(x.get('ref'))]
                    for x in e.get('examples') or [] if isinstance(x, dict) and clean(x.get('coptic')) and clean(x.get('arabic'))]
        out.append([forms[:8], dialects, ' • '.join(dict.fromkeys(POS[t] for t in re.split(r'[\s(),.]+', clean(e.get('pos'))) if t in POS)), arabic[:6], examples[:4], 1 if e.get('unsure') else 0, page])

json.dump({'source': 'قاموس اللغة القبطية للهجتين البحيرية والصعيدية، معوض داود عبد النور (المركز الثقافي القبطي، 2013)، قراءة آلية بإذن المؤلف',
           'entries': out}, open('public/dict/moawad.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(f'{pages} pages, {len(out)} entries, {sum(e[5] for e in out)} unsure, {skipped} skipped', file=sys.stderr)
