import { useEffect, useState } from 'react';
import { useStore } from '../data/store';

/** A small sign while saves from this phone haven't reached the server yet, so nobody closes the app thinking it's all saved. */
export default function SyncBadge() {
  const { unsynced, cloud } = useStore();
  const [online, setOnline] = useState(navigator.onLine);
  // Quick saves finish in a moment; only show the sign if one is still waiting after a second.
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    addEventListener('online', on); addEventListener('offline', off);
    return () => { removeEventListener('online', on); removeEventListener('offline', off); };
  }, []);
  useEffect(() => {
    if (!unsynced) { setShow(false); return; }
    const t = setTimeout(() => setShow(true), 1000);
    return () => clearTimeout(t);
  }, [unsynced]);
  if (!cloud || !show) return null;
  return (
    <span className="sync-badge" role="status" title="التعديلات محفوظة على الموبايل وهتترفع لوحدها أول ما النت يرجع. ما تمسحش بيانات المتصفح قبلها.">
      {online ? '⟳ بيترفع…' : '⚠ مفيش نت: لسه مترفعش'}
    </span>
  );
}
