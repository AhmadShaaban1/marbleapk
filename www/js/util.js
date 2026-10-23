'use strict';
const $ = (s, r = document) => r.querySelector(s);
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const k in (attrs || {})) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'value') e.value = v;
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, v);
  }
  for (const c of kids.flat(9)) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c).replace(/\d[\d.,]*(?:\s?×\s?\d[\d.,]*)+/g, m => '⁦' + m + '⁩')));
  }
  return e;
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const AR = '٠١٢٣٤٥٦٧٨٩';
const num = v => {
  v = parseFloat(String(v == null ? '' : v).replace(/[٠-٩]/g, d => AR.indexOf(d)).replace('٫', '.').replace(',', '.'));
  return isFinite(v) ? v : 0;
};
const fmt = (n, d = 2) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: d });
const money = n => fmt(n, 2) + ' ج.م';
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const sum = (arr, f) => arr.reduce((s, x) => s + (f ? f(x) : x), 0);
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 8) + '01';
const inRange = (d, from, to) => (!from || d >= from) && (!to || d <= to);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function sha(s) {
  try {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('mrb:' + s));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    let x = 5381; for (const c of 'mrb:' + s) x = ((x << 5) + x + c.charCodeAt(0)) | 0; return 'h' + x;
  }
}
