'use strict';
function slabItem(s, onClick) {
  const b = get('blocks', s.blockId) || {};
  return listItem(`${s.code}`, `${blockTitle(b)} • ${fmt(s.l, 0)}×${fmt(s.w, 0)}×${fmt(s.t, 1)} سم • درجة ${s.grade || '-'}`,
    fmt(s.area) + ' م²', onClick || (() => slabView(s.id)), badge(s.status === 'stock' ? 'متاح' : 'مباع', s.status === 'stock' ? 'ok' : 'sold'));
}

function screenStock() {
  let q = '', stone = 'all', status = 'stock', limit = 60;
  const list = h('div', {}), sumBox = h('div', { class: 'card' });
  const draw = () => {
    const sl = L('slabs').filter(s => {
      const b = get('blocks', s.blockId) || {};
      return (stone === 'all' || b.stone === stone) && (status === 'all' || s.status === status) && (!q || (s.code + ' ' + blockTitle(b)).includes(q));
    }).reverse();
    sumBox.innerHTML = '';
    // ملخص حسب الصنف
    const by = {};
    sl.forEach(s => { const b = get('blocks', s.blockId) || {}; const k = blockTitle(b); by[k] = by[k] || { n: 0, a: 0 }; by[k].n++; by[k].a += s.area; });
    sumBox.append(kv('إجمالي العرض', `${sl.length} لوح — ${fmt(sum(sl, s => s.area))} م²`, 'big'));
    Object.entries(by).forEach(([k, v]) => sumBox.append(kv(k, `${v.n} لوح — ${fmt(v.a)} م²`)));
    list.innerHTML = '';
    if (!sl.length) list.append(emptyMsg('لا توجد ألواح'));
    sl.slice(0, limit).forEach(s => list.append(slabItem(s)));
    if (sl.length > limit) list.append(h('button', { class: 'btn ghost block', onclick: () => { limit += 60; draw(); } }, `عرض المزيد (${sl.length - limit})`));
  };
  const c1 = h('div', { class: 'chips' }), c2 = h('div', { class: 'chips' });
  const dc = () => {
    c1.innerHTML = ''; c2.innerHTML = '';
    [['all', 'الكل'], ['marble', 'رخام'], ['granite', 'جرانيت']].forEach(([k, t]) => c1.append(chip(t, stone === k, () => { stone = k; dc(); draw(); })));
    [['stock', 'متاح'], ['sold', 'مباع'], ['all', 'الكل']].forEach(([k, t]) => c2.append(chip(t, status === k, () => { status = k; dc(); draw(); })));
  };
  dc(); draw();
  const el = h('div', {}, searchBox('بحث بكود اللوح / الصنف', v => { q = v; limit = 60; draw(); }), c1, c2, sumBox, list);
  el.append(fab('📷 مسح', () => scanScreen()));
  return el;
}

function slabView(id) {
  go('لوح', () => {
    const s = get('slabs', id); if (!s) return emptyMsg('غير موجود');
    const b = get('blocks', s.blockId) || {};
    const el = h('div', {});
    el.append(card(h('h3', {}, s.code, badge(s.status === 'stock' ? 'متاح' : 'مباع', s.status === 'stock' ? 'ok' : 'sold')),
      kv('الخامة', blockTitle(b)), kv('المقاس', `${fmt(s.l, 0)}×${fmt(s.w, 0)}×${fmt(s.t, 1)} سم`), kv('المساحة', fmt(s.area, 3) + ' م²'), kv('الدرجة', s.grade || '-'),
      kv('البلوك', b.code || '-'), isAdmin() ? kv('التكلفة', money(C.slabCost(s)) + ` (${money(C.perM2Map()[s.blockId])}/م²)`) : null));
    if (s.status === 'sold' && s.saleId) { const sa = get('sales', s.saleId); if (sa) el.append(card(kv('فاتورة البيع', sa.no), kv('تاريخ البيع', sa.date), h('button', { class: 'btn ghost block', onclick: () => saleView(sa.id) }, 'فتح الفاتورة'))); }
    el.append(h('div', { class: 'qrbox card' }, h('img', { src: qrImg(qrSlab(s), 7) }), h('div', { style: 'direction:ltr' }, s.code)));
    const btns = h('div', { class: 'btns' });
    if (s.status === 'stock' && (isAdmin() || CUR.role === 'sales')) btns.append(h('button', { class: 'btn', onclick: () => saleForm({ slabIds: [s.id] }) }, '🧾 بيع هذا اللوح'));
    btns.append(h('button', { class: 'btn ghost', onclick: () => labelsPdf([{ qr: qrSlab(s), l1: s.code, l2: `${blockTitle(b)} • ${fmt(s.l, 0)}×${fmt(s.w, 0)}×${fmt(s.t, 1)}` }], 'label-' + s.code) }, '🏷 ملصق PDF'),
      h('button', { class: 'btn ghost', onclick: () => blockView(b.id) }, 'فتح البلوك'));
    el.append(btns);
    return el;
  });
}
