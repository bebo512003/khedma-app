"""One Unicode for all Coptic text in the app.

- Greek letters written inside Coptic words (old fonts and some sources used α for ⲁ, Π for Ⲡ) become the Coptic
  letters, and a Greek grave/acute on them becomes the jinkim (U+0300 after the letter).
- A backtick before a letter (how jinkim was typed in some sources) becomes U+0300 after it.
- Text typed in the old CS fonts (Avva Shenouda and the other "CS" Coptic Standard fonts: Latin keys drawn as Coptic)
  becomes Unicode with the CS keyboard table. Keep in sync with src/data/unicodeCoptic.ts.
"""
import re
import unicodedata

GREEK = 'αβγδεζηθικλμνξοπρστυφχψωςϛΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩϚ'
COPTIC = 'ⲁⲃⲅⲇⲉⲍⲏⲑⲓⲕⲗⲙⲛⲝⲟⲡⲣⲥⲧⲩⲫⲭⲯⲱⲥⲋⲀⲂⲄⲆⲈⲌⲎⲐⲒⲔⲖⲘⲚⲜⲞⲠⲢⲤⲦⲨⲪⲬⲮⲰⲊ'
G2C = dict(zip(GREEK, COPTIC))
IS_COPTIC = re.compile('[\u2c80-\u2cff\u03e2-\u03ef]')
# Accents that mean jinkim on a Coptic letter; breathings and the rest are dropped.
JINKIM = {'\u0300': '\u0300', '\u0301': '\u0300', '\u0342': '\u0300'}
DROP = {'\u0313', '\u0314', '\u0308', '\u0345'}

# CS (Coptic Standard) keyboard → Unicode, from the CS layout (as in E-Sid/Coptic CS2Utf8).
CS_FROM = 'ABGDE^ZY:IKLMNXOPRCTUV<"WSFQHJ{}abgde^zy;iklmnxoprctuv,\'wsfqhj[]&~@>|'
CS_TO = 'ⲀⲂⲄⲆⲈⲊⲌⲎⲐⲒⲔⲖⲘⲚⲜⲞⲠⲢⲤⲦⲨⲪⲬⲮⲰϢϤϦϨϪϬϮⲁⲃⲅⲇⲉⲋⲍⲏⲑⲓⲕⲗⲙⲛⲝⲟⲡⲣⲥⲧⲩⲫⲭⲯⲱϣϥϧϩϫϭϯ;.:,ⳉ'
CS = dict(zip(CS_FROM, CS_TO))
CS_WORDS = {'\\': 'ⲟⲩ', '£': 'ⲙⲉⲛⲉⲛⲥⲁ', '¦': 'ⲡⲁⲣⲑⲉⲛⲟⲥ'}


def looks_like_cs(s: str) -> bool:
    return bool(s) and not IS_COPTIC.search(s) and not re.search('[\u0370-\u03ff\u0600-\u06ff]', s) and bool(re.search('[a-z]{3}', s, re.I))


def from_cs(s: str) -> str:
    out, mark = [], ''
    for ch in s:
        if ch in '`=':  # jinkim / overline typed before the letter
            mark = '\u0300' if ch == '`' else '\u0305'
            continue
        out.append(CS_WORDS.get(ch, CS.get(ch, ch)) + mark)
        mark = ''
    return ''.join(out)


def _word(w: str) -> str:
    out = []
    for ch in unicodedata.normalize('NFD', w):
        if ch in G2C: out.append(G2C[ch])
        elif ch in JINKIM: out.append(JINKIM[ch])
        elif ch in DROP: continue
        else: out.append(ch)
    s = ''.join(out)
    s = re.sub('`\\s*(.)', '\\1\u0300', s)
    return unicodedata.normalize('NFC', s)


def unify(s: str, coptic_field: bool = False) -> str:
    """coptic_field: the whole string is Coptic (so Greek-only words in it are Coptic too, and CS text is converted)."""
    if not isinstance(s, str) or not s: return s
    if coptic_field and looks_like_cs(s): return from_cs(s)
    return re.sub(r'[^\s,،;:.()\[\]/=+\-]+', lambda m: _word(m.group(0)) if coptic_field or IS_COPTIC.search(m.group(0)) else m.group(0), s)


def unify_tree(x, coptic_paths=()):
    """Every string in a JSON tree: words that hold Coptic letters are unified."""
    if isinstance(x, str): return unify(x)
    if isinstance(x, list): return [unify_tree(v) for v in x]
    if isinstance(x, dict): return {k: unify_tree(v) for k, v in x.items()}
    return x
