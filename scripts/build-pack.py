"""Builds public/packs/<pack>.json from the transcribed hymns in scripts/packs/<pack>/.

Each hymn file: {"nameAr", "pages", "note", "verses": [{"section"?, "coptic", "arabicCoptic", "meaning"}]}.
The order, liturgical placement and audio links live here in META.

    python3 scripts/build-pack.py nativity-shabab
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SAMAN = 'https://stgeorgesaman.com/libraries/hymns-library/occasionsandfeasts/nativity/liturgy-nativity/'

# Hymn names as in the booklet's index.
NAMES = {
    "nakous": "أرباع الناقوس الفرايحي لعيد الميلاد",
    "seven-ways": "لحن السبع طرائق",
    "doxology": "الذكصولوجية الأولى لعيد الميلاد",
    "baker-end": "ختام باكر عيد الميلاد",
    "abouro": "لحن أبؤرو",
    "hitenyat": "هيتينيات عيد الميلاد",
    "katholikon": "مرد الكاثوليكون لعيد الميلاد",
    "praxis": "مرد الإبركسيس لعيد الميلاد",
    "iparthenos": "إي بارثينوس",
    "piginmici": "بي جين ميسي",
    "mohaier": "محير عيد الميلاد",
    "agios": "أجيوس الفرايحي لعيد الميلاد",
    "psalm-response": "مرد المزمور لعيد الميلاد",
    "gospel-response": "مرد إنجيل قداس عيد الميلاد",
    "psalm150": "المزمور 150 الفرايحي (توزيع عيد الميلاد)"
}

PACKS = {
    'nativity-shabab': {
        'title': 'ألحان عيد الميلاد',
        'levelId': 'l3',
        'source': 'منقولة من ملف "ألحان الميلاد - شباب" بتاع المدرسة. النصوص ولينكات التسجيلات أصلها من مكتبة ألحان كنيسة مارجرجس بنزلة السمان.',
        # file, prayer, when, audio (from the booklet's QR codes)
        'hymns': [
            ('nakous', 'رفع البخور', 'أرباع الناقوس في رفع بخور باكر العيد', 'https://www.youtube.com/watch?v=8xl3iwWgUaQ'),
            ('seven-ways', 'رفع البخور', 'رفع بخور باكر العيد', None),
            ('doxology', 'رفع البخور', 'رفع بخور باكر العيد', 'https://www.youtube.com/watch?v=5fmR_KRFZy4'),
            ('baker-end', 'رفع البخور', 'ختام رفع بخور باكر', 'https://www.youtube.com/watch?v=3ahkStPIcGE'),
            ('abouro', 'القداس', None, 'https://stgeorgesaman.com/libraries/hymns-library/divine-liturgy/offertory/people-hymns/king-of-peace'),
            ('hitenyat', 'القداس', None, SAMAN + 'nativity-hitens'),
            ('katholikon', 'القداس', 'بعد قراءة الكاثوليكون', SAMAN + 'katholikon-response'),
            ('praxis', 'القداس', 'بعد قراءة الإبركسيس', SAMAN + 'nativity-praxis-response'),
            ('iparthenos', 'القداس', None, SAMAN + 'hparthenos/'),
            ('piginmici', 'القداس', None, SAMAN + 'piginmici'),
            ('mohaier', 'القداس', None, SAMAN + 'mohaier-nativity'),
            ('agios', 'القداس', None, SAMAN + 'agios-festive'),
            ('psalm-response', 'القداس', 'بعد المزمور', 'https://stgeorgesaman.com/hymn/liturgy_c/psalm-response_c/psalm-response-nativity'),
            ('gospel-response', 'القداس', 'بعد الإنجيل', SAMAN + 'bible-response-liturgy-nativity'),
            ('psalm150', 'القداس', 'التوزيع', SAMAN + 'nativity-psalm-150'),
        ],
    },
}


def column(verses, key):
    lines, section = [], None
    for v in verses:
        if v.get('section') and v['section'] != section:
            section = v['section']
            lines.append('§ ' + section)
        lines.append(' '.join((v.get(key) or '—').split()))
    return '\n'.join(lines)


def main(name):
    meta = PACKS[name]
    src = ROOT / 'scripts' / 'packs' / name
    hymns = []
    for file, prayer, when, audio in meta['hymns']:
        h = json.loads((src / f'{file}.json').read_text(encoding='utf-8'))
        out = {'nameAr': NAMES[file], 'prayer': prayer, 'occasion': 'عيد الميلاد'}
        if when:
            out['when'] = when
        if audio:
            out['audioUrl'] = audio
        if h.get('note'):
            out['notes'] = h['note'].strip()
        for key, field in (('coptic', 'copticText'), ('arabicCoptic', 'arabicCoptic'), ('meaning', 'meaning')):
            out[field] = column(h['verses'], key)
        hymns.append(out)
    pack = {'id': name, 'title': meta['title'], 'levelId': meta['levelId'], 'source': meta['source'], 'hymns': hymns}
    dest = ROOT / 'public' / 'packs' / f'{name}.json'
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(pack, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(dest, len(hymns), 'hymns', sum(len(h['meaning'].splitlines()) for h in hymns), 'lines')


if __name__ == '__main__':
    main(sys.argv[1])
