import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

const OUT = 256;

/**
 * Square crop like WhatsApp's: drag to move, pinch or the slider to zoom. Resolves to a small JPEG data URL,
 * or rejects with an AbortError when the person cancels.
 */
export function cropSquare(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const url = URL.createObjectURL(file);
    const close = () => { root.unmount(); host.remove(); URL.revokeObjectURL(url); };
    root.render(<Cropper src={url}
      onDone={d => { close(); resolve(d); }}
      onCancel={() => { close(); reject(new DOMException('cancelled', 'AbortError')); }}
      onError={() => { close(); reject(new Error('bad image')); }} />);
  });
}

function Cropper({ src, onDone, onCancel, onError }: { src: string; onDone: (d: string) => void; onCancel: () => void; onError: () => void }) {
  const img = useRef<HTMLImageElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [size, setSize] = useState(300);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; z: number } | null>(null);

  useEffect(() => {
    const fit = () => setSize(Math.min(window.innerWidth - 32, window.innerHeight - 220, 420));
    fit(); window.addEventListener('resize', fit);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('resize', fit); document.body.style.overflow = ''; };
  }, []);

  // At zoom 1 the image just covers the square; position is the image centre's offset from the square's centre.
  const base = nat ? size / Math.min(nat.w, nat.h) : 1;
  const w = nat ? nat.w * base * zoom : size, h = nat ? nat.h * base * zoom : size;
  const clamp = (p: { x: number; y: number }, z = zoom) => {
    const mx = nat ? Math.max(0, (nat.w * base * z - size) / 2) : 0, my = nat ? Math.max(0, (nat.h * base * z - size) / 2) : 0;
    return { x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)) };
  };
  const setZ = (z: number) => { const nz = Math.min(4, Math.max(1, z)); setZoom(nz); setPos(p => clamp(p, nz)); };

  const down = (e: React.PointerEvent) => { (e.target as Element).setPointerCapture(e.pointerId); pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); };
  const move = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (!pinch.current) pinch.current = { d, z: zoom };
      else setZ(pinch.current.z * d / pinch.current.d);
      return;
    }
    setPos(p => clamp({ x: p.x + e.clientX - prev.x, y: p.y + e.clientY - prev.y }));
  };
  const up = (e: React.PointerEvent) => { pointers.current.delete(e.pointerId); if (pointers.current.size < 2) pinch.current = null; };

  const done = () => {
    if (!nat || !img.current) return;
    const scale = base * zoom;
    // The square's top-left in the image's own pixels.
    const sx = (w / 2 - pos.x - size / 2) / scale, sy = (h / 2 - pos.y - size / 2) / scale, side = size / scale;
    const c = document.createElement('canvas'); c.width = OUT; c.height = OUT;
    c.getContext('2d')!.drawImage(img.current, sx, sy, side, side, 0, 0, OUT, OUT);
    onDone(c.toDataURL('image/jpeg', 0.75));
  };

  return (
    <div className="cropper" role="dialog" aria-label="قص الصورة">
      <div className="crop-top"><b>حرّك الصورة وكبّرها</b></div>
      <div ref={box} className="crop-box" style={{ width: size, height: size }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onWheel={e => setZ(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}>
        <img ref={img} src={src} alt="" draggable={false}
          onLoad={e => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} onError={onError}
          style={{ width: w, height: h, transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))` }} />
        <div className="crop-mask" />
      </div>
      <input type="range" className="crop-zoom" min={1} max={4} step={0.01} value={zoom} onChange={e => setZ(+e.target.value)} aria-label="تكبير" />
      <div className="crop-bar">
        <button className="btn grow" onClick={onCancel}>إلغاء</button>
        <button className="btnp grow" onClick={done} disabled={!nat}>تمام</button>
      </div>
    </div>
  );
}
