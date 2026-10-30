"""Verse of the day: hand-picked verses about praise, taken from public/dict/bible-verses.json
(Bohairic from Coptic SCRIPTORIUM, CC BY 4.0; Arabic Van Dyck 1865, public domain). Writes src/data/praiseVerses.json."""
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
REFS = """مز 146: 1|مز 146: 2|مز 96: 1|مز 96: 2|مز 98: 1|مز 98: 4|مز 98: 5|مز 100: 1|مز 47: 1|مز 47: 6|مز 47: 7|مز 57: 7|مز 57: 9|مز 61: 8
|مز 84: 4|مز 111: 1|مز 118: 1|مز 118: 15|مز 118: 21|مز 126: 2|مز 138: 1|مز 149: 1|مز 52: 9|مز 146: 10
|خر 15: 1|خر 15: 21|أي 38: 7|إش 6: 3|إش 12: 1|إش 12: 4|إش 12: 5|إش 24: 15|إش 42: 10|إش 44: 23|إش 49: 13|إش 55: 12|إش 61: 3|إش 63: 7
|إر 17: 14|إر 20: 13|دا 2: 23|حب 3: 3|صف 3: 14|زك 2: 10
|مت 11: 25|مت 21: 16|مت 26: 30|لو 1: 46|لو 1: 47|لو 1: 68|لو 2: 13|لو 2: 14|لو 2: 20|لو 19: 37|أع 2: 47|أع 3: 8|أع 16: 25
|رو 15: 11|1كو 14: 15|أف 5: 19|كو 3: 16|في 4: 4|1تس 5: 18|عب 2: 12|عب 13: 15|يع 5: 13
|رؤ 4: 8|رؤ 5: 9|رؤ 5: 12|رؤ 5: 13|رؤ 7: 12|رؤ 15: 3|رؤ 19: 1|رؤ 19: 5|رؤ 19: 6"""
refs = [r.strip() for r in REFS.replace('\n', '').split('|') if r.strip()]
verses = json.load(open(ROOT / 'public/dict/bible-verses.json', encoding='utf-8'))['verses']
first = {}
for c, a, r in verses: first.setdefault(r, (c, a))
missing = [r for r in refs if r not in first]
assert not missing, missing
out = [[first[r][0], first[r][1], r] for r in refs]
(ROOT / 'src/data/praiseVerses.json').write_text(json.dumps(out, ensure_ascii=False), encoding='utf-8')
print(len(out), 'verses')
