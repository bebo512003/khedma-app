"""Builds public/dict/coptic-arabic.json from Osama Thabet's Coptic-Arabic dictionary
(archive.org/details/CopticArabicDictionary, Public Domain Mark), file
"coptic dictionary northern dialect unicode complete.xlsx".

Usage: python3 scripts/build-dictionary.py <path to xlsx>

Columns 0-4 are the word (Coptic, Greek letters, pronunciation, Latin letters, phonetic).
From column 5 on the sheet is not aligned: word kind, then optional form/gender and origin
labels, then one or more meanings. Labels are told apart from meanings by how often they repeat.
"""
import collections, json, re, sys
import openpyxl

ORIGINS = {'يوناني', 'عبري', 'يوناني ، عبري', 'لاتيني', 'أرامي', 'سرياني'}
clean = lambda v: re.sub(r'\s+', ' ', str(v)).strip() if v not in (None, '') else ''

rows = list(openpyxl.load_workbook(sys.argv[1], read_only=True).worksheets[0].iter_rows(values_only=True))[1:]
# Form/gender labels: values that repeat a lot in column 6 (مذكر، مؤنث، صيغة مصدرية...).
form_counts = collections.Counter(clean(r[6]) for r in rows if len(r) > 6)
FORMS = {v for v, n in form_counts.items() if v and n >= 8 and v not in ORIGINS}

out, seen = [], set()
for r in rows:
    r = [clean(v) for v in r]
    word = r[0]
    if not word:
        continue
    kind = r[5] if len(r) > 5 else ''
    form, origin, meanings = '', '', []
    for v in r[6:]:
        if not v:
            continue
        if v in ORIGINS and not origin:
            origin = v
        elif v in FORMS and not form and not meanings:
            form = v
        elif v not in meanings:
            meanings.append(v)
    if not meanings:
        continue
    key = (word, '|'.join(meanings))
    if key in seen:
        continue
    seen.add(key)
    out.append([word, r[4] or r[3], kind, form, origin, meanings])

# Repeated labels are stored once and referenced by index to keep the file small.
labels = sorted({w[i] for w in out for i in (2, 3, 4)})
index = {v: i for i, v in enumerate(labels)}
# Each word: [coptic, latin phonetic, kind, form, origin, meanings]; kind/form/origin index into labels.
words = [[w[0], w[1], index[w[2]], index[w[3]], index[w[4]], w[5]] for w in out]
json.dump({'source': 'قاموس قبطي عربي - أسامة ثابت (archive.org/details/CopticArabicDictionary)', 'labels': labels, 'words': words},
          open('public/dict/coptic-arabic.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'words;', len(FORMS), 'form labels')
