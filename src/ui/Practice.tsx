import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const SPEEDS = [0.5, 0.75, 1];

/**
 * Practice player: slow the recording down and repeat one part (from A to B) as many times as needed.
 * Everything stays on the page, no outside player.
 */
export default function Practice({ ms, getBlob }: { ms: number; getBlob: () => Promise<Blob> }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState<string>();
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'paused' | 'error'>('idle');
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(ms / 1000);
  const [speed, setSpeed] = useState(1);
  const [a, setA] = useState<number | null>(null);
  const [b, setB] = useState<number | null>(null);
  const [loops, setLoops] = useState(0);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const ensure = async () => {
    if (url) return true;
    setState('loading');
    try { const u = URL.createObjectURL(await getBlob()); setUrl(u); audio.current!.src = u; return true; }
    catch { setState('error'); return false; }
  };
  const toggle = async () => {
    const el = audio.current!;
    if (state === 'playing') { el.pause(); return; }
    if (!(await ensure())) return;
    el.playbackRate = speed;
    if (a !== null && b !== null && (el.currentTime < a || el.currentTime >= b)) el.currentTime = a;
    el.play().catch(() => setState('error'));
  };
  const seek = async (t: number) => { if (!(await ensure())) return; audio.current!.currentTime = t; setPos(t); };
  const onTime = () => {
    const el = audio.current!;
    if (a !== null && b !== null && el.currentTime >= b) { el.currentTime = a; setLoops(n => n + 1); }
    setPos(el.currentTime);
  };
  const markA = () => { setA(pos); if (b !== null && b <= pos) setB(null); setLoops(0); };
  const markB = () => { if (pos > (a ?? 0) + 0.5) { setB(pos); if (a === null) setA(0); setLoops(0); if (audio.current) audio.current.currentTime = a ?? 0; } };
  const clear = () => { setA(null); setB(null); setLoops(0); };
  const pct = (t: number) => `${dur ? (100 * t) / dur : 0}%`;

  return (
    <div className="practice">
      <div className="row" style={{ gap: 10 }}>
        <button className="vplay" onClick={toggle} aria-label={state === 'playing' ? 'وقف' : 'شغّل'} disabled={state === 'loading'}>
          {state === 'loading' ? <span className="spin" /> : <Icon name={state === 'playing' ? 'pause' : 'play'} size={18} />}
        </button>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="ptrack" dir="ltr">
            {a !== null && <div className="pseg" style={{ left: pct(a), width: b !== null ? `calc(${pct(b)} - ${pct(a)})` : 2 }} />}
            <input type="range" min={0} max={dur || 1} step={0.1} value={pos} onChange={e => seek(+e.target.value)} aria-label="مكان التشغيل" />
          </div>
          <div className="vmeta"><span>{clock(pos)}</span><span>{state === 'error' ? 'مش قادرين نشغّله دلوقتي' : clock(dur)}</span></div>
        </div>
      </div>
      <div className="row between" style={{ gap: 6, flexWrap: 'wrap' }}>
        <div className="chips">{SPEEDS.map(s => <button key={s} className="chip" aria-pressed={speed === s}
          onClick={() => { setSpeed(s); if (audio.current) audio.current.playbackRate = s; }}>{s === 1 ? 'عادي' : `${s}×`}</button>)}</div>
        <div className="chips">
          <button className="chip" onClick={markA} aria-pressed={a !== null}>بداية الجزء</button>
          <button className="chip" onClick={markB} aria-pressed={b !== null}>نهايته</button>
          {(a !== null || b !== null) && <button className="chip" onClick={clear}>الكل</button>}
        </div>
      </div>
      {a !== null && b !== null
        ? <div className="note">بيكرر من {clock(a)} لـ {clock(b)}{loops ? ` • اتكرر ${loops} مرة` : ''}</div>
        : <div className="note">علشان تكرر ربع معين: شغّل، ودوس «بداية الجزء» عند أوله و«نهايته» عند آخره.</div>}
      <audio ref={audio} preload="none" onPlay={() => setState('playing')} onPause={() => setState(s => s === 'error' ? s : 'paused')}
        onEnded={() => setState('paused')} onTimeUpdate={onTime}
        onLoadedMetadata={e => Number.isFinite(e.currentTarget.duration) && setDur(e.currentTarget.duration)} />
    </div>
  );
}
