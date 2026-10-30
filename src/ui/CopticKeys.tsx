import type { RefObject } from 'react';
import { COPTIC_KEYS } from '../data/dictionary';

type Field = HTMLInputElement | HTMLTextAreaElement;

/** On-screen Coptic keyboard. Types where the cursor is (or over the selected text), not always at the end. */
export default function CopticKeys({ field, value, onChange }: { field: RefObject<Field | null>; value: string; onChange: (v: string) => void }) {
  const edit = (ch: string | null) => {
    const el = field.current;
    const start = el?.selectionStart ?? value.length, end = el?.selectionEnd ?? value.length;
    // ⌫ with nothing selected removes the letter before the cursor.
    const before = ch === null && start === end ? [...value.slice(0, start)].slice(0, -1).join('') : value.slice(0, start);
    const next = before + (ch ?? '') + value.slice(end);
    onChange(next);
    const at = before.length + (ch ?? '').length;
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at, at); });
  };
  /** A mark goes after the letter before the cursor; over a selection, the abbreviation stroke goes on every letter. */
  const mark = (m: string) => {
    const el = field.current;
    const start = el?.selectionStart ?? value.length, end = el?.selectionEnd ?? value.length;
    if (start === end) return edit(m);
    const sel = [...value.slice(start, end)].filter(c => c !== m).map(c => /\S/.test(c) && !/[\u0300-\u036f]/.test(c) ? c + m : c).join('');
    const next = value.slice(0, start) + sel + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + sel.length, start + sel.length); });
  };
  // Pressing a key mustn't take the focus (and the cursor) away from the field.
  const keep = (e: { preventDefault: () => void }) => e.preventDefault();
  return (
    <div className="ckeys coptic-font" dir="ltr" role="group" aria-label="كيبورد قبطي">
      {COPTIC_KEYS.map(k => <button key={k} onMouseDown={keep} onClick={() => edit(k)}>{k}</button>)}
      <button className="wide" onMouseDown={keep} onClick={() => mark('\u0300')} aria-label="چينكم على الحرف اللي قبله">ⲉ̀ چينكم</button>
      <button className="wide" onMouseDown={keep} onClick={() => mark('\u0305')} aria-label="شرطة اختصار على الحرف اللي قبله أو على المتحدد">ⲡ̅ⲟ̅ⲥ̅ شرطة</button>
      <button className="wide" onMouseDown={keep} onClick={() => edit(' ')} aria-label="مسافة">مسافة</button>
      <button className="wide" onMouseDown={keep} onClick={() => edit(null)} aria-label="امسح حرف">⌫</button>
    </div>
  );
}
