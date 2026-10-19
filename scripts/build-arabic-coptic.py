#!/usr/bin/env python3
"""Builds public/dict/arabic-coptic.json for translating Arabic into Coptic, from Osama Thabet's
"Machine Assisted Translation Ar. - Cpt" (v1.1, August 2019, archive.org, Public Domain Mark).

Its Access databases (export each table to CSV first, e.g. with mdbtools' mdb-export):
  coptic complement 1  -> nouns:  Coptic word, its article (ⲡⲓ / ϯ / ⲛⲓ = gender), Arabic meaning
  coptic verbs         -> verbs:  Coptic verb, how it takes its object (ⲛ̀ / ⲉ̀ⲣⲟϥ / directly), Arabic meaning ("يكتب")
  Coptic prepositions  -> words:  prepositions, also with their pronoun (ⲛⲉⲙⲁⲕ = معك), from "coptic translator.mdb"
The Coptic is typed in a Greek-letter font: α → ⲁ ... and ` before a letter is its jinkim.

Usage: python3 scripts/build-arabic-coptic.py nouns.csv verbs.csv prepositions.csv [--out public/dict/arabic-coptic.json]
"""
import csv, json, re, sys

args = sys.argv[1:]
out = args[args.index('--out') + 1] if '--out' in args else 'public/dict/arabic-coptic.json'
GREEK = 'αβγδεϛζηθικλμνξοπρστυφχψω'
COPTIC = 'ⲁⲃⲅⲇⲉⲋⲍⲏⲑⲓⲕⲗⲙⲛⲝⲟⲡⲣⲥⲧⲩⲫⲭⲯⲱ'
MAP = {g: c for g, c in zip(GREEK, COPTIC)}
MAP.update({g.upper(): chr(ord(c) - 1) for g, c in zip(GREEK, COPTIC) if g.upper() != g})
MAP.update({'ς': 'ⲥ', 'ϲ': 'ⲥ'})
ACCENT = {'ὲ': 'ⲉ', 'ὶ': 'ⲓ', 'ὼ': 'ⲱ', 'ὸ': 'ⲟ', 'ὴ': 'ⲏ', 'ὰ': 'ⲁ', 'ή': 'ⲏ'}


def coptic(s):
    """Greek-font Coptic → Unicode Coptic; ` and accented vowels become a combining jinkim."""
    s = re.sub(r'\s+', ' ', s or '').strip()
    o, jinkim = [], False
    for ch in s:
        if ch == '`':
            jinkim = True
            continue
        if ch in ACCENT:
            o.append(ACCENT[ch] + '̀')
            continue
        o.append(MAP.get(ch, ch))
        if jinkim and ch.strip():
            o.append('̀')
            jinkim = False
    return ''.join(o)


def arabic(s):
    """Each Arabic meaning, without notes in brackets."""
    s = re.sub(r'\([^()]*\)', ' ', s or '')
    parts = (re.sub(r'\s+', ' ', x).strip(' .-') for x in re.split(r'[،,؛;/]', s))
    return [m for m in parts if m and len(m.split()) <= 3 and not re.match(r'^(لل|ل)(مذكر|مؤنث|جمع)', m) and re.search('[ء-ي]', m)]


nouns, verbs = [], []
for r in csv.DictReader(open(args[0], encoding='utf-8')):
    w = coptic(r['coptic complement'])
    art = re.sub(r'\s+', '', r['article'] or '').split('،')[0]
    gender = {'πι': 'm', 'ϯ': 'f', 'νι': 'p'}.get(art)
    if not w or not gender or r['noun'].strip() != 'ρν' or ' ' in w:
        continue
    for a in arabic(r['translation']):
        nouns.append([a, w, gender])
for r in csv.DictReader(open(args[1], encoding='utf-8')):
    w = coptic(r['Coptic Verbs'])
    obj = (r['complement article'] or '').strip()
    # ⲛ̀: the object follows with ⲛ̀ / ⲙ̀ⲙⲟ- ; ⲉϥ: with ⲉ̀ / ⲉ̀ⲣⲟ- ; without: straight after the verb.
    how = 'n' if obj == '`ν' else 'e' if obj == 'εϥ' else '-' if obj == 'without `ν' else ''
    if not w or not how:
        continue
    for a in arabic(r['translation']):
        verbs.append([a, w, how])

words = []
for r in csv.DictReader(open(args[2], encoding='utf-8')):
    w = coptic(r['Coptic Preposition'])
    if w and r['translation'] and not re.search('[a-zA-Z]', r['translation']):
        for a in arabic(r['translation']):
            words.append([a, w])

data = {
    'source': 'الترجمة المساعدة آليًا عربي ← قبطي - أسامة ثابت 2019 (archive.org)',
    # [Arabic, Coptic, gender m/f/p]
    'nouns': nouns,
    # [Arabic "he does" form, Coptic, object: n (ⲙ̀ⲙⲟ-) / e (ⲉ̀ⲣⲟ-) / - (directly)]
    'verbs': verbs,
    # [Arabic, Coptic]: prepositions, with or without their pronoun
    'words': words,
}
json.dump(data, open(out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(f'{out}: {len(nouns)} nouns, {len(verbs)} verbs, {len(words)} prepositions')
