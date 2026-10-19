import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import Icon from './Icon';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const BARS = 36;
/** A fixed "waveform" per note, so each one looks like a voice message without decoding the audio. */
const shape = (seed: string) => {
  let h = 0; for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return Array.from({ length: BARS }, () => { h = (h * 1103515245 + 12345) >>> 0; return 0.25 + ((h >>> 16) % 1000) / 1333; });
};
const SPEEDS = [1, 1.5, 2];

/** Plays a voice note in place, like a WhatsApp voice message: play, scrub, speed. It loads on first play. */
export function VoiceNote({ id, ms, getBlob }: { id: string; ms: number; getBlob: () => Promise<Blob> }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState<string>();
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'paused' | 'error'>('idle');
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(ms / 1000);
  const [speed, setSpeed] = useState(1);
  const bars = useRef(shape(id)).current;
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const ensure = async () => {
    if (url) return true;
    setState('loading');
    try {
      const u = URL.createObjectURL(await getBlob());
      setUrl(u);
      audio.current!.src = u;
      return true;
    } catch { setState('error'); return false; }
  };
  const toggle = async () => {
    const a = audio.current!;
    if (state === 'playing') { a.pause(); return; }
    if (!(await ensure())) return;
    a.playbackRate = speed;
    a.play().catch(() => setState('error'));
  };
  const seek = async (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    // Right-to-left page, but audio runs left-to-right in the bar, like WhatsApp in Arabic.
    const f = Math.min(1, Math.max(0, (r.right - e.clientX) / r.width));
    if (!(await ensure())) return;
    const a = audio.current!;
    const d = Number.isFinite(a.duration) ? a.duration : dur;
    a.currentTime = f * d; setPos(f * d);
  };
  const nextSpeed = () => { const s = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; setSpeed(s); if (audio.current) audio.current.playbackRate = s; };
  const f = dur ? Math.min(1, pos / dur) : 0;

  return (
    <div className={`voice${state === 'playing' ? ' on' : ''}`}>
      <button className="vplay" onClick={toggle} aria-label={state === 'playing' ? 'وقف' : 'شغّل التسجيل'} disabled={state === 'loading'}>
        {state === 'loading' ? <span className="spin" /> : <Icon name={state === 'playing' ? 'pause' : 'play'} size={18} />}
      </button>
      <div className="vbody">
        <div className="wave" onClick={seek} role="slider" aria-label="مكان التشغيل" aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(pos)} tabIndex={0}>
          {bars.map((b, i) => <i key={i} style={{ height: `${Math.round(b * 100)}%` }} className={(BARS - 1 - i) / BARS < f ? 'p' : ''} />)}
        </div>
        <div className="vmeta"><span>{state === 'error' ? 'مش قادرين نشغّله دلوقتي' : clock(state === 'idle' ? dur : pos || 0)}</span>
          <span>{state !== 'idle' && state !== 'error' ? clock(dur) : ''}</span></div>
      </div>
      <button className="vspeed" onClick={nextSpeed} aria-label="سرعة التشغيل">{speed}×</button>
      <audio ref={audio} preload="none"
        onPlay={() => setState('playing')} onPause={() => setState(s => s === 'error' ? s : 'paused')}
        onEnded={() => { setState('paused'); setPos(0); }}
        onTimeUpdate={e => setPos(e.currentTarget.currentTime)}
        onLoadedMetadata={e => Number.isFinite(e.currentTarget.duration) && setDur(e.currentTarget.duration)}
        onError={() => url && setState('error')} />
    </div>
  );
}

const MIME = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
const MAX_MS = 10 * 60_000;
/** Biggest audio file a servant can pick (it's stored in pieces in Firestore). */
const MAX_FILE = 8 * 1024 * 1024;

/** Records a voice note in place (or takes an audio file), then hands back the audio and its length. */
export function Recorder({ onDone }: { onDone: (blob: Blob, ms: number) => void }) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [start, setStart] = useState(0);
  const [now, setNow] = useState(0);
  const [error, setError] = useState('');
  const cancelled = useRef(false);
  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => { setNow(Date.now()); if (Date.now() - start > MAX_MS) rec.stop(); }, 250);
    return () => clearInterval(t);
  }, [rec, start]);
  useEffect(() => () => { rec?.stream.getTracks().forEach(t => t.stop()); }, [rec]);

  const begin = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } });
      const mimeType = MIME.find(m => MediaRecorder.isTypeSupported?.(m));
      const r = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32000 });
      const chunks: Blob[] = [];
      const t0 = Date.now();
      cancelled.current = false;
      r.ondataavailable = e => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        setRec(null);
        if (!cancelled.current) onDone(new Blob(chunks, { type: r.mimeType || mimeType || 'audio/webm' }), Date.now() - t0);
      };
      r.start(1000);
      setStart(t0); setNow(t0); setRec(r);
    } catch { setError('مش قادرين نفتح المايك. اسمح للتطبيق يستخدم المايك من إعدادات المتصفح.'); }
  };
  const stop = (cancel = false) => { cancelled.current = cancel; rec?.stop(); };
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > MAX_FILE) { setError('الملف كبير. اختار تسجيل أقل من 8 ميجا.'); return; }
    const a = new Audio(); const u = URL.createObjectURL(f);
    const done = (d: number) => { URL.revokeObjectURL(u); onDone(f, Number.isFinite(d) ? Math.round(d * 1000) : 0); };
    a.onloadedmetadata = () => done(a.duration); a.onerror = () => done(0);
    a.src = u;
  };

  if (rec) return (
    <div className="voice rec">
      <span className="dot" aria-hidden /><b className="grow">بيسجّل… {clock((now - start) / 1000)}</b>
      <button className="btn" style={{ minHeight: 40 }} onClick={() => stop(true)}>إلغاء</button>
      <button className="btnp" style={{ minHeight: 40 }} onClick={() => stop()}>خلاص</button>
    </div>
  );
  return (
    <>
      <div className="row" style={{ gap: 8 }}>
        <button className="btnp grow" onClick={begin}><Icon name="mic" size={18} /> سجّل</button>
        <label className="btn" htmlFor="voice-file" style={{ cursor: 'pointer' }}>اختار ملف صوت</label>
        <input id="voice-file" type="file" accept="audio/*" hidden onChange={pick} />
      </div>
      {error && <div className="alert-t" role="alert">{error}</div>}
    </>
  );
}
