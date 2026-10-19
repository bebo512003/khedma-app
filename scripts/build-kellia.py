#!/usr/bin/env python3
"""Builds public/dict/kellia.json from the Comprehensive Coptic Lexicon (BBAW / KELLIA, coptic-dictionary.org;
github.com/KELLIA/dictionary, xml/Comprehensive_Coptic_Lexicon-v1.2-2020.xml; CC BY-SA 4.0).

Every word with its forms in each dialect (Sahidic, Bohairic, Fayyumic, Akhmimic, Lycopolitan, Middle Egyptian...)
and its English meaning. Where one of its Bohairic forms is in our Arabic dictionaries, it takes their Arabic too,
so a Sahidic or Fayyumic word leads to the Arabic of its Bohairic form. This file is shared under CC BY-SA 4.0 too.

Usage: python3 scripts/build-kellia.py path/to/Comprehensive_Coptic_Lexicon.xml
"""
import json, re, sys
import xml.etree.ElementTree as ET

NS = {'t': 'http://www.tei-c.org/ns/1.0'}
DIALECT = {'S': 'صعيدي', 'B': 'بحيري', 'F': 'فيومي', 'A': 'أخميمي', 'L': 'أسيوطي (ليكوبوليتي)', 'M': 'أوكسيرينخي (مصري أوسط)',
           'Ak': 'أخميمي', 'Sa': 'صعيدي', 'Sf': 'صعيدي فيومي', 'Fb': 'فيومي', 'P': 'بروتوطيبي', 'V': 'فيومي', 'W': 'فيومي', 'K': 'كلاسيكي'}
POS = {'Subst.': 'اسم', 'Vb.': 'فعل', 'Adj.': 'صفة', 'Adv.': 'ظرف', 'Präp.': 'حرف جر', 'Konj.': 'أداة ربط', 'Partikel': 'أداة',
       'Zahlzeichen': 'عدد', 'Zahlwort': 'عدد', 'Interjektion': 'تعجب', 'Selbst. Pers. Pron.': 'ضمير', 'Pron.': 'ضمير',
       'Verbalpräfix': 'أداة فعل', 'Nominalpräfix': 'أداة اسم', 'Satzkonverter': 'أداة'}

def key(s):
    """Same as copticKey in src/data/dictionary.ts: lowercase Coptic letters only."""
    out = []
    for ch in s:
        c = ord(ch)
        if (0x2c80 <= c <= 0x2ce3 or 0x03e2 <= c <= 0x03ef) and c % 2 == 0:
            ch = chr(c + 1)
        out.append(ch)
    return re.sub(r'[^Ⲁ-⳿Ϣ-ϯ]', '', ''.join(out))

# Arabic of Bohairic words we already have (Osama Thabet's dictionary, then Nazlet El Seman's Bohairic entries).
JINKIM = {'ὲ': 'ⲉ', 'ὶ': 'ⲓ', 'ὼ': 'ⲱ', 'ὸ': 'ⲟ', 'ὴ': 'ⲏ', 'ὰ': 'ⲁ', 'ή': 'ⲏ'}
arabic = {}
d = json.load(open('public/dict/coptic-arabic.json', encoding='utf-8'))
for w in d['words']:
    k = key(''.join(JINKIM.get(c, c) for c in w[0]))
    if k and w[5]:
        arabic.setdefault(k, w[5][:3])
sg = json.load(open('public/dict/stgeorge-dict.json', encoding='utf-8'))
for w in sg['words']:
    dialects = [sg['labels'][i] for i in w[7]]
    k = key(w[0])
    if k and w[5] and (not dialects or 'بحيري' in dialects):
        arabic.setdefault(k, [m.replace(' *', '') for m in w[5][:3]])

root = ET.parse(sys.argv[1]).getroot()
out, linked = [], 0
for e in root.iter('{http://www.tei-c.org/ns/1.0}entry'):
    forms = {}
    for f in e.findall('t:form', NS):
        orth, geo = f.find('t:orth', NS), f.find('t:usg', NS)
        if orth is None or not (orth.text or '').strip():
            continue
        o = orth.text.strip()
        if not key(o):
            continue
        dial = DIALECT.get((geo.text or '').strip(), '') if geo is not None else ''
        forms.setdefault(o, [])
        if dial and dial not in forms[o]:
            forms[o].append(dial)
    if not forms:
        continue
    pos = e.find('.//t:gramGrp/t:pos', NS)
    pos = POS.get((pos.text or '').strip(), '') if pos is not None else ''
    english = []
    for q in e.findall('.//t:sense/t:cit/t:quote', NS):
        if q.get('{http://www.w3.org/XML/1998/namespace}lang') == 'en' and q.text and q.text.strip() not in english:
            english.append(re.sub(r'\s+', ' ', q.text.strip()))
    ar = []
    for o, dl in forms.items():
        if 'بحيري' in dl and key(o) in arabic:
            for m in arabic[key(o)]:
                if m not in ar:
                    ar.append(m)
    if ar:
        linked += 1
    # Bohairic form first when there is one, then the rest.
    fs = sorted(forms.items(), key=lambda x: 'بحيري' not in x[1])
    out.append([[[o, dl] for o, dl in fs[:24]], pos, '; '.join(english[:4])[:300], ar[:4], e.get('{http://www.w3.org/XML/1998/namespace}id')])

json.dump({'source': 'Coptic Dictionary Online / Comprehensive Coptic Lexicon (BBAW, KELLIA)، رخصة CC BY-SA 4.0', 'entries': out},
          open('public/dict/kellia.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(f'{len(out)} entries, {linked} with Arabic from their Bohairic form', file=sys.stderr)
