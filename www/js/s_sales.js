'use strict';
function screenSales() {
  let q = '';
  const list = h('div', {});
  const draw = () => {
    list.innerHTML = '';
    const ss = L('sales').filter(s => !q || (s.no + ' ' + ((get('parties', s.customerId) || {}).name || 'نقدي')).includes(q)).reverse();
    if (!ss.length) list.append(emptyMsg('لا توجد فواتير'));
    ss.slice(0, 100).forEach(s => {
      const c = get('parties', s.customerId);
      list.append(listItem(`${s.no} — ${c ? c.name : 'عميل نقدي'}`, `${s.date} • ${s.lines.length} بند`, money(s.total), () => saleView(s.id)));
    });
  };
  draw();
  return h('div', {}, searchBox('بحث برقم الفاتورة / العميل', v => { q = v; draw(); }), list, fab('+ فاتورة', () => saleForm()));
}

function lastPrice(b) { return ((S.meta.lastPrice || {})[b.stone + ':' + (b.variety || '')]) || ''; }

function saleForm(pre = {}) {
  const lines = [];
  const addSlab = id => {
    const s = get('slabs', id); if (!s || s.status !== 'stock' || lines.some(l => l.slabId === id)) return false;
    const b = get('blocks', s.blockId) || {};
    lines.push({ kind: 'slab', slabId: id, price: String(lastPrice(b)) }); return true;
  };
  (pre.slabIds || []).forEach(addSlab);
  if (pre.blockId) lines.push({ kind: 'block', blockId: pre.blockId, price: '' });

  const cust = sel([['', 'عميل نقدي (بدون اسم)'], ...L('parties').filter(p => p.type === 'customer').map(p => [p.id, p.name])], '');
  const addC = h('button', { class: 'btn ghost sm', onclick: () => partyForm('customer', null, p => { cust.append(h('option', { value: p.id }, p.name)); cust.value = p.id; }) }, '+ عميل');
  const date = inp({ type: 'date', value: today() });
  const discount = numInp({ placeholder: '0' }), paid = numInp({ placeholder: '0' });
  const method = sel(['نقدي', 'تحويل بنكي', 'شيك', 'فودافون كاش / انستاباي']);
  const note = inp({ placeholder: 'ملاحظات' });
  const unit = numInp({ placeholder: 'سعر المتر لكل الألواح' });
  const linesBox = h('div', {}), totBox = h('div', { class: 'card' });
  let totals = { sub: 0 };
  const resolve = l => {
    if (l.kind === 'slab') { const s = get('slabs', l.slabId), b = s && get('blocks', s.blockId); return { s, b, area: s ? s.area : 0, total: s ? s.area * num(l.price) : 0 }; }
    const b = get('blocks', l.blockId); return { b, area: 0, total: num(l.price) };
  };
  const recalc = () => {
    totals.sub = 0;
    lines.forEach(l => { const r = resolve(l); l.total = r.total; totals.sub += r.total; if (l.el) l.el.textContent = money(r.total); });
    const total = Math.max(0, totals.sub - num(discount.value));
    totals.total = total;
    totBox.innerHTML = '';
    totBox.append(kv('الإجمالي قبل الخصم', money(totals.sub)), kv('بعد الخصم', money(total), 'big'), kv('المتبقي على العميل', money(total - num(paid.value)), total - num(paid.value) > 0.005 ? 'neg' : ''));
  };
  [discount, paid].forEach(i => i.addEventListener('input', recalc));
  const drawLines = () => {
    linesBox.innerHTML = '';
    if (!lines.length) linesBox.append(emptyMsg('أضف ألواحًا بالمسح أو الاختيار'));
    lines.forEach((l, i) => {
      const r = resolve(l);
      const p = numInp({ value: l.price, placeholder: l.kind === 'slab' ? 'سعر المتر' : 'سعر البلوك كامل' });
      p.addEventListener('input', () => { l.price = p.value; recalc(); });
      l.el = h('b', {}, '');
      const title = l.kind === 'slab' ? `${r.s.code} — ${blockTitle(r.b || {})}` : `بلوك ${r.b.code} — ${blockTitle(r.b)}`;
      const sub = l.kind === 'slab' ? `${fmt(r.s.l, 0)}×${fmt(r.s.w, 0)}×${fmt(r.s.t, 1)} سم = ${fmt(r.area)} م²` : `${fmt(C.vol(r.b), 2)} م³ — يُباع بسعر إجمالي`;
      linesBox.append(h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', {}, title), h('button', { class: 'btn danger sm', onclick: () => { lines.splice(i, 1); drawLines(); } }, 'حذف')),
        h('div', { class: 'sub' }, sub), h('div', { style: 'height:6px' }), row(p, l.el)));
    });
    recalc();
  };
  const picker = () => {
    let q = '', chosen = new Set();
    const box = h('div', {}), info = h('div', { class: 'sub' });
    const dr = () => {
      box.innerHTML = '';
      const sl = L('slabs').filter(s => s.status === 'stock' && !lines.some(l => l.slabId === s.id) && (!q || (s.code + ' ' + blockTitle(get('blocks', s.blockId) || {})).includes(q))).slice(0, 150);
      if (!sl.length) box.append(emptyMsg('لا توجد ألواح متاحة'));
      sl.forEach(s => {
        const cb = h('input', { type: 'checkbox' }); cb.checked = chosen.has(s.id);
        cb.addEventListener('change', () => { cb.checked ? chosen.add(s.id) : chosen.delete(s.id); info.textContent = chosen.size + ' محدد'; });
        box.append(h('label', { class: 'item sel-row' }, cb, h('div', { class: 'grow' }, h('b', {}, s.code), h('div', { class: 'sub' }, `${blockTitle(get('blocks', s.blockId) || {})} • ${fmt(s.l, 0)}×${fmt(s.w, 0)} • ${fmt(s.area)} م²`))));
      });
    };
    dr();
    modal('اختيار ألواح', h('div', {}, searchBox('بحث بالكود / الصنف (مثال: اسم البلوك)', v => { q = v; dr(); }), info, box), [
      { t: 'تحديد الكل', cls: 'ghost', keep: true, fn: () => { L('slabs').filter(s => s.status === 'stock' && !lines.some(l => l.slabId === s.id) && (!q || (s.code + ' ' + blockTitle(get('blocks', s.blockId) || {})).includes(q))).slice(0, 150).forEach(s => chosen.add(s.id)); info.textContent = chosen.size + ' محدد'; dr(); return false; } },
      { t: 'إضافة', fn: () => { chosen.forEach(addSlab); drawLines(); } }]);
  };
  const scan = () => scanner(text => {
    const r = resolveCode(text);
    if (!r || r.kind !== 'slab') return false;
    if (r.rec.status !== 'stock') { toast('اللوح مباع بالفعل', true); return false; }
    if (lines.some(l => l.slabId === r.rec.id)) { toast('مضاف بالفعل'); return true; }
    addSlab(r.rec.id); drawLines(); return true;
  }, { continuous: true, hint: 'امسح ألواح متتالية — اضغط إغلاق عند الانتهاء' });

  drawLines();
  go('فاتورة بيع', () => h('div', {},
    card(field('العميل', h('div', { class: 'row' }, cust, addC)), field('التاريخ', date)),
    h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: picker }, '+ اختيار ألواح'), h('button', { class: 'btn acc', onclick: scan }, '📷 مسح QR')),
    linesBox,
    card(field('سعر موحد للمتر (للبنود الفارغة)', row(unit, h('button', { class: 'btn ghost', onclick: () => { lines.forEach(l => { if (l.kind === 'slab' && !num(l.price)) l.price = unit.value; }); drawLines(); } }, 'تطبيق')))),
    card(row(field('الخصم', discount), field('المدفوع الآن', paid)), field('طريقة الدفع', method), field('ملاحظات', note)),
    totBox,
    h('button', { class: 'btn block', id: 'saveSale', onclick: () => {
      if (!lines.length) return toast('أضف بندًا واحدًا على الأقل', true);
      if (lines.some(l => !(num(l.price) > 0))) return toast('أدخل السعر لكل البنود', true);
      recalc();
      const total = totals.total, pd = num(paid.value);
      if (num(discount.value) > totals.sub) return toast('الخصم أكبر من الإجمالي', true);
      if (!cust.value && pd + 0.005 < total) return toast('العميل النقدي لازم يدفع كامل المبلغ — أو اختر عميل مسجل', true);
      if (pd > total + 0.005) return toast('المدفوع أكبر من إجمالي الفاتورة', true);
      const out = lines.map(l => {
        const r = resolve(l);
        if (l.kind === 'slab') return { kind: 'slab', slabId: l.slabId, blockId: r.s.blockId, code: r.s.code, desc: `${blockTitle(r.b || {})} ${fmt(r.s.l, 0)}×${fmt(r.s.w, 0)}×${fmt(r.s.t, 1)}`, area: r.s.area, price: num(l.price), total: r2(l.total), cost: r2(C.slabCost(r.s)) };
        return { kind: 'block', blockId: l.blockId, code: r.b.code, desc: 'بلوك خام ' + blockTitle(r.b), area: 0, price: num(l.price), total: r2(l.total), cost: r2(C.blockCost(r.b)) };
      });
      const sale = add('sales', { no: nextCode('INV'), date: date.value, customerId: cust.value || null, lines: out, subtotal: r2(totals.sub), discount: r2(num(discount.value)), total: r2(total), note: note.value.trim() });
      out.forEach(l => {
        if (l.kind === 'slab') edit('slabs', l.slabId, { status: 'sold', saleId: sale.id });
        else edit('blocks', l.blockId, { status: 'sold', saleId: sale.id });
      });
      lines.forEach(l => { if (l.kind === 'slab') { const s = get('slabs', l.slabId), b = get('blocks', s.blockId); S.meta.lastPrice = S.meta.lastPrice || {}; S.meta.lastPrice[b.stone + ':' + (b.variety || '')] = num(l.price); } });
      persist('meta');
      if (pd > 0) add('payments', { date: date.value, dir: 'in', partyId: cust.value || null, amount: r2(pd), saleId: sale.id, method: method.value, note: 'دفعة فاتورة ' + sale.no });
      toast('تم حفظ الفاتورة'); back(); saleView(sale.id);
    } }, 'حفظ الفاتورة')));
}

function saleView(id) {
  go('فاتورة', () => {
    const s = get('sales', id); if (!s) return emptyMsg('غير موجودة');
    const c = get('parties', s.customerId);
    const paid = sum(L('payments').filter(p => p.saleId === s.id), p => p.amount);
    const paper = h('div', { class: 'paper', id: 'invoicePaper' },
      h('h2', {}, S.meta.company || 'إدارة الرخام والجرانيت'), h('div', { class: 'sub' }, 'فاتورة بيع'),
      h('div', { class: 'row' }, h('div', {}, 'رقم: ', h('b', { style: 'direction:ltr;display:inline-block' }, s.no)), h('div', {}, 'التاريخ: ' + s.date)),
      h('div', {}, 'العميل: ', h('b', {}, c ? c.name : 'عميل نقدي'), c && c.phone ? ' — ' + c.phone : ''),
      h('div', { class: 'tw' }, h('table', {}, h('thead', {}, h('tr', {}, ['#', 'البند', 'م²', 'السعر', 'الإجمالي'].map(t => h('th', {}, t)))),
        h('tbody', {}, s.lines.map((l, i) => h('tr', {}, h('td', {}, i + 1), h('td', {}, h('div', { style: 'direction:ltr;text-align:right' }, l.code), h('small', {}, l.desc)), h('td', {}, l.kind === 'slab' ? fmt(l.area) : '-'), h('td', {}, fmt(l.price) + (l.kind === 'slab' ? '/م²' : '')), h('td', {}, fmt(l.total))))))),
      h('div', { style: 'height:8px' }),
      kv('الإجمالي', money(s.subtotal)), s.discount ? kv('الخصم', money(s.discount)) : null, kv('الصافي', money(s.total), 'big'),
      kv('المدفوع', money(paid)), kv('المتبقي', money(s.total - paid), s.total - paid > 0.005 ? 'neg' : ''),
      s.note ? h('p', {}, 'ملاحظات: ' + s.note) : null);
    const btns = h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => exportPDF(paper, 'invoice-' + s.no) }, '📄 PDF / مشاركة'));
    if (c && s.total - paid > 0.005) btns.append(h('button', { class: 'btn acc', onclick: () => paymentForm(c.id, 'in', null, s.id) }, 'تسجيل دفعة'));
    if (isAdmin()) btns.append(h('button', { class: 'btn danger', onclick: () => confirmBox(`حذف الفاتورة ${s.no}؟ سترجع الألواح للمخزن وتُحذف دفعاتها.`, () => {
      s.lines.forEach(l => { if (l.kind === 'slab') edit('slabs', l.slabId, { status: 'stock', saleId: null }); else edit('blocks', l.blockId, { status: 'raw', saleId: null }); });
      L('payments').filter(p => p.saleId === s.id).forEach(p => rm('payments', p.id));
      rm('sales', s.id); toast('تم الحذف'); back();
    }, 'حذف') }, '🗑 حذف الفاتورة'));
    return h('div', {}, paper, btns);
  });
}
