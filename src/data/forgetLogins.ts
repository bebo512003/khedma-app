import type { Member } from './types';

/** After members are deleted: their login and the copy the member app reads go too, so old codes and PINs stop working. */
export function forgetLogins(members: Member[]) {
  Promise.all([import('../firebase/app'), import('firebase/firestore'), import('../firebase/paths')]).then(([{ servantFb }, { deleteDoc }, paths]) => {
    const db = servantFb().db;
    for (const m of members)
      for (const r of [paths.ref(db, 'memberViews', m.id), paths.ref(db, 'logins', m.code), ...(m.account ? [paths.ref(db, 'accounts', m.account.uid)] : [])]) deleteDoc(r).catch(() => undefined);
  });
}
