"""Rewrites the built JSON data so all Coptic is one Unicode (see coptic_unicode.py). Run after any build-*.py."""
import glob, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from coptic_unicode import unify, unify_tree

changed = {}
for f in sorted(glob.glob('public/dict/*.json') + glob.glob('public/packs/*.json')):
    raw = open(f, encoding='utf-8').read()
    d = json.loads(raw)
    out = unify_tree(d)
    # The Coptic headword column of the Osama Thabet dictionary also has Greek-only words (ὲ for ⲉ̀).
    if f.endswith('coptic-arabic.json'):
        out['words'] = [[unify(w[0], True), *w[1:]] for w in out['words']]
    # Hymn texts: the Coptic field is all Coptic.
    if f.startswith('public/packs/'):
        for h in out.get('hymns', []):
            if h.get('copticText'): h['copticText'] = unify(h['copticText'], True)
    new = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
    if json.dumps(d, ensure_ascii=False, separators=(',', ':')) != new:
        changed[f] = sum(a != b for a, b in zip(json.dumps(d, ensure_ascii=False).split(), json.dumps(out, ensure_ascii=False).split()))
        open(f, 'w', encoding='utf-8').write(new)
print(changed)
