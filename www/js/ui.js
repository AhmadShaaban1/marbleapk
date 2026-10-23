'use strict';
function toast(msg, bad) {
  const t = h('div', { class: 'toast' + (bad ? ' bad' : '') }, msg);
  document.body.append(t); setTimeout(() => t.remove(), 2600);
}
function modal(title, body, buttons) {
  const close = () => ov.remove();
  const ov = h('div', { class: 'overlay', onclick: e => { if (e.target === ov) close(); } },
    h('div', { class: 'sheet' },
      h('div', { class: 'sheet-h' }, h('b', {}, title), h('button', { class: 'x', onclick: close }, '✕')),
      h('div', { class: 'sheet-b' }, body),
      buttons ? h('div', { class: 'sheet-f' }, buttons.map(b => h('button', { class: 'btn ' + (b.cls || ''), onclick: async () => { if ((await b.fn(close)) !== false && !b.keep) close(); } }, b.t))) : null));
  document.body.append(ov);
  return { close, el: ov };
}
function confirmBox(msg, onYes, yesText = 'تأكيد') {
  modal('تأكيد', h('p', {}, msg), [{ t: 'إلغاء', cls: 'ghost', fn: () => { } }, { t: yesText, cls: 'danger', fn: () => { onYes(); } }]);
}
const field = (label, input, hint) => h('label', { class: 'fld' }, h('span', {}, label), input, hint ? h('small', {}, hint) : null);
const inp = (o = {}) => h('input', Object.assign({ type: 'text', autocomplete: 'off' }, o));
const numInp = (o = {}) => inp(Object.assign({ inputmode: 'decimal' }, o));
const sel = (opts, val, o = {}) => h('select', o, opts.map(x => {
  const [v, t] = Array.isArray(x) ? x : [x, x];
  return h('option', { value: v, selected: String(v) === String(val) }, t);
}));
const row = (...c) => h('div', { class: 'row' }, ...c);
const card = (...c) => h('div', { class: 'card' }, ...c);
const kv = (k, v, cls) => h('div', { class: 'kv ' + (cls || '') }, h('span', {}, k), h('b', {}, v));
const chip = (t, on, fn) => h('button', { class: 'chip' + (on ? ' on' : ''), onclick: fn }, t);
const badge = (t, k) => h('span', { class: 'badge ' + (k || '') }, t);
const emptyMsg = t => h('div', { class: 'empty' }, t);

// ------- نظام التنقل -------
const NAV = { stack: [], root: null };
function view() { return $('#view'); }
function go(title, build, opts = {}) {
  NAV.stack.push({ title, build, opts });
  draw();
}
function replace(title, build, opts = {}) {
  NAV.stack.pop(); go(title, build, opts);
}
function back() {
  if (NAV.stack.length > 1) { NAV.stack.pop(); draw(); return true; }
  return false;
}
function refresh() { draw(true); }
function resetTo(title, build, opts) { NAV.stack = []; go(title, build, opts); }
function draw(keepScroll) {
  const top = NAV.stack[NAV.stack.length - 1]; if (!top) return;
  const v = view(), sc = v.scrollTop;
  $('#title').textContent = top.title;
  $('#backBtn').style.visibility = NAV.stack.length > 1 ? 'visible' : 'hidden';
  v.innerHTML = '';
  let el;
  try { el = top.build(); } catch (e) { console.error(e); el = h('div', { class: 'card' }, 'خطأ: ' + e.message); }
  v.append(el);
  v.scrollTop = keepScroll ? sc : 0;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.k === (NAV.stack[0] || {}).opts?.tab));
}
function fab(t, fn) { return h('button', { class: 'fab', onclick: fn }, t); }
function listItem(title, sub, right, fn, extra) {
  return h('div', { class: 'item', onclick: fn }, h('div', { class: 'grow' }, h('b', {}, title), sub ? h('div', { class: 'sub' }, sub) : null, extra), right ? h('div', { class: 'right' }, right) : null);
}
function searchBox(ph, onInput, val = '') {
  return h('input', { class: 'search', placeholder: ph, value: val, oninput: e => onInput(e.target.value) });
}
