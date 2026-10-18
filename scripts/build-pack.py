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
        # Bump 'version' when the booklet changes, so books added from an older edition get an update button.
        'version': 2,
        'book': {'title': 'ألحان عيد الميلاد المجيد (الهزات) - شباب', 'pagesBase': 'books/nativity-shabab-2/', 'pageCount': 41},
        # Booklet pages per hymn, from the booklet's own index (page images are public/<pagesBase>NN.webp, rendered from the PDF).
        'pages': {'nakous': (2, 7), 'seven-ways': (8, 20), 'doxology': (21, 22), 'baker-end': (23, 23), 'abouro': (24, 25),
                  'hitenyat': (26, 28), 'katholikon': (29, 30), 'praxis': (31, 32), 'iparthenos': (33, 33), 'piginmici': (34, 34),
                  'mohaier': (34, 35), 'agios': (36, 37), 'psalm-response': (37, 37), 'gospel-response': (38, 38), 'psalm150': (39, 40)},
        'source': 'منقولة من كتاب "ألحان عيد الميلاد المجيد" بتاع المدرسة (كنيسة مارجرجس دروة). النصوص ولينكات التسجيلات أصلها من مكتبة ألحان كنيسة مارجرجس بنزلة السمان.',
        # file, prayer, when, audio (from the booklet's QR codes)
        'hymns': [
            ('nakous', 'رفع البخور', 'أرباع الناقوس في رفع بخور باكر العيد', 'https://www.youtube.com/watch?v=8xl3iwWgUaQ'),
            ('seven-ways', 'رفع البخور', 'رفع بخور باكر العيد', None),
            ('doxology', 'رفع البخور', 'رفع بخور باكر العيد', 'https://www.youtube.com/watch?v=5fmR_KRFZy4'),
            ('baker-end', 'رفع البخور', 'ختام رفع بخور باكر', 'https://www.youtube.com/watch?v=3ahkStPIcGE'),
            ('abouro', 'القداس', None, 'https://stgeorgesaman.com/libraries/hymns-library/divine-liturgy/offertory/people-hymns/king-of-peace'),
            ('hitenyat', 'القداس', None, 'https://www.youtube.com/watch?v=Vbgma9SHH7c'),
            ('katholikon', 'القداس', 'بعد قراءة الكاثوليكون', SAMAN + 'katholikon-response'),
            ('praxis', 'القداس', 'بعد قراءة الإبركسيس', 'https://www.youtube.com/watch?v=8Iou_tkwMdU'),
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
        out['from'], out['to'] = meta['pages'][file]
        for key, field in (('coptic', 'copticText'), ('arabicCoptic', 'arabicCoptic'), ('meaning', 'meaning')):
            out[field] = column(h['verses'], key)
        hymns.append(out)
    pack = {'id': name, 'version': meta['version'], 'title': meta['title'], 'levelId': meta['levelId'], 'source': meta['source'], 'book': meta['book'], 'hymns': hymns}
    dest = ROOT / 'public' / 'packs' / f'{name}.json'
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(pack, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(dest, len(hymns), 'hymns', sum(len(h['meaning'].splitlines()) for h in hymns), 'lines')


if __name__ == '__main__':
    main(sys.argv[1])
