import { useState } from 'react';
import { useData } from '../data/store';

/** Which member is signed in on this device. Local only until Firebase Auth replaces it. */
const KEY = 'khedma.member';
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

export function useMember() {
  const [data] = useData();
  const [id, setId] = useState(read);
  const member = data.members.find(m => m.id === id) ?? null;
  const signIn = (memberId: string) => { try { localStorage.setItem(KEY, memberId); } catch { /* private mode */ } setId(memberId); };
  const signOut = () => { try { localStorage.removeItem(KEY); } catch { /* private mode */ } setId(null); };
  return { member, signIn, signOut };
}
