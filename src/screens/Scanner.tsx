import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

/** Pulls the member code out of a card's QR (a login link with ?code=…, or the bare code). */
export function codeFromQr(text: string): string | null {
  const m = text.match(/[?&]code=(\d{1,6})/) ?? text.trim().match(/^(\d{1,6})$/);
  return m ? m[1].padStart(4, '0') : null;
}

/**
 * Continuous camera scanner: the servant holds up one card after another.
 * jsQR decodes in plain JS, so it works on iPhone, Android and laptops alike.
 */
export default function Scanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const recent = useRef(new Map<string, number>());
  const cb = useRef(onCode);
  cb.current = onCode;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let last = 0;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const v = video.current;
      if (!v || v.readyState < 2 || t - last < 120) return;
      last = t;
      const scale = Math.min(1, 640 / v.videoWidth);
      canvas.width = Math.round(v.videoWidth * scale); canvas.height = Math.round(v.videoHeight * scale);
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const hit = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
      const code = hit && codeFromQr(hit.data);
      if (!code) return;
      // The same card stays in view for a moment; count it once.
      const now = Date.now();
      if (now - (recent.current.get(code) ?? 0) < 2500) return;
      recent.current.set(code, now);
      cb.current(code);
    };
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(s => { stream = s; if (video.current) { video.current.srcObject = s; video.current.play().catch(() => {}); } raf = requestAnimationFrame(tick); })
      .catch(() => setError('مش قادرين نفتح الكاميرا. اسمح للتطبيق يستخدم الكاميرا من إعدادات المتصفح.'));
    return () => { cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()); };
  }, []);

  if (error) return <div className="card alert"><div className="alert-t">{error}</div></div>;
  return (
    <div className="scanner">
      <video ref={video} playsInline muted aria-label="الكاميرا" />
      <div className="scanner-frame" aria-hidden />
    </div>
  );
}
