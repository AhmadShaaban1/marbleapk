'use strict';
const COLS = ['users', 'parties', 'blocks', 'jobs', 'slabs', 'sales', 'payments', 'expenses'];
const S = { meta: {} };
COLS.forEach(c => S[c] = []);
let _idb, _dirty = new Set(), _t, _ver = 0;

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('marble-erp', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function dbLoad() {
  _idb = await openDB();
  const st = _idb.transaction('kv').objectStore('kv');
  for (const k of [...COLS, 'meta']) {
    const v = await new Promise(r => { const q = st.get(k); q.onsuccess = () => r(q.result); q.onerror = () => r(null); });
    if (v) S[k] = v;
  }
  if (!S.meta.dev) {
    S.meta.dev = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + Math.floor(Math.random() * 10);
    S.meta.seq = {};
    persist('meta');
  }
}
function persist(k) {
  _ver++; _dirty.add(k);
  clearTimeout(_t); _t = setTimeout(dbFlush, 40);
}
function dbFlush() {
  if (!_idb || !_dirty.size) return Promise.resolve();
  const keys = [..._dirty]; _dirty.clear();
  return new Promise(res => {
    const tx = _idb.transaction('kv', 'readwrite'), st = tx.objectStore('kv');
    keys.forEach(k => st.put(JSON.parse(JSON.stringify(S[k])), k));
    tx.oncomplete = res; tx.onerror = res; tx.onabort = res;
  });
}
document.addEventListener('visibilitychange', () => { if (document.hidden) dbFlush(); });
window.addEventListener('pagehide', dbFlush);

const L = c => S[c].filter(x => !x.del);
const get = (c, id) => { const o = S[c].find(x => x.id === id); return o && !o.del ? o : null; };
function add(c, o) {
  o.id = o.id || uid(); o.upd = Date.now(); o.by = o.by || (CUR && CUR.id) || '';
  S[c].push(o); persist(c); return o;
}
function edit(c, id, p) {
  const o = S[c].find(x => x.id === id); if (!o) return null;
  Object.assign(o, p, { upd: Date.now() }); persist(c); return o;
}
function rm(c, id) {
  const o = S[c].find(x => x.id === id);
  if (o) { o.del = true; o.upd = Date.now(); persist(c); }
}
function nextCode(prefix, pad = 3) {
  S.meta.seq = S.meta.seq || {};
  const n = (S.meta.seq[prefix] || 0) + 1; S.meta.seq[prefix] = n; persist('meta');
  return `${prefix}-${S.meta.dev}-${String(n).padStart(pad, '0')}`;
}
let CUR = null; // current logged-in user

// دمج ملف مزامنة (آخر تعديل يكسب)
function mergeIn(data) {
  if (!data || data.app !== 'marble-erp' || !data.cols) throw new Error('ملف غير صالح');
  const st = { added: 0, updated: 0, same: 0 };
  for (const c of COLS) {
    const mine = new Map(S[c].map(x => [x.id, x]));
    for (const r of (data.cols[c] || [])) {
      const m = mine.get(r.id);
      if (!m) { S[c].push(r); st.added++; }
      else if ((r.upd || 0) > (m.upd || 0)) { Object.keys(m).forEach(k => delete m[k]); Object.assign(m, r); st.updated++; }
      else st.same++;
    }
    persist(c);
  }
  if (data.meta && data.meta.company && !S.meta.company) S.meta.company = data.meta.company;
  persist('meta');
  return st;
}
function exportAll() {
  const cols = {}; COLS.forEach(c => cols[c] = S[c]);
  return { app: 'marble-erp', v: 1, at: new Date().toISOString(), dev: S.meta.dev, meta: { company: S.meta.company || '' }, cols };
}
