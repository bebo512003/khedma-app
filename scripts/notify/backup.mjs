// Weekly full copy of each church's data, in the same shape as «نسخة كاملة» from the app's backup screen,
// so it can be restored there. The workflow keeps the files as a private run artifact.
import { mkdirSync, writeFileSync } from 'node:fs';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault() });
const db = getFirestore();
const LISTS = ['levels', 'members', 'hymns', 'books', 'terms', 'sessions'];
const day = new Date().toISOString().slice(0, 10);
mkdirSync('out', { recursive: true });

for (const church of (await db.collection('churches').get()).docs) {
  const c = church.ref;
  const data = { version: 1, curricula: {}, templates: { absence: '' }, nextCode: 1 };
  for (const k of LISTS) data[k] = (await c.collection(k).get()).docs.map(d => d.data());
  data.progress = Object.fromEntries((await c.collection('progress').get()).docs.map(d => [d.id, d.data()]));
  Object.assign(data, (await c.collection('meta').doc('app').get()).data() ?? {});
  const file = `out/backup-${church.id}-${day}.json`;
  writeFileSync(file, JSON.stringify(data));
  console.log(church.id, LISTS.map(k => `${k} ${data[k].length}`).join(', '), '->', file);
}
