'use strict';
const EXP_CATS = ['كهرباء', 'سولار / وقود', 'أجور عمال', 'صيانة', 'أدوات وقطع غيار', 'إيجار', 'نقل', 'مصاريف إدارية', 'أخرى'];

function balText(p) {
  const b = C.partyBalance(p);
  if (Math.abs(b) < 0.005) return h('span', {}, 'مسدد');
  return h('span', { class: p.type === 'customer' ? (b > 0 ? 'neg' : 'pos') : (b > 0 ? 'neg' : 'pos') }, (p.type === 'customer' ? (b > 0 ? 'عليه ' : 'له ') : (b > 0 ? 'علينا ' : 'لنا ')) + money(Math.abs(b)));
}

function screenParties() {
  let type = CUR.role === 'sales' ? 'customer' : (NAV.partyType || 'customer'), q = '';
  const list = h('div', {}), chips = h('div', { class: 'chips' });
  const draw = () => {
    list.innerHTML = '';
    const ps = L('parties').filter(p => p.type === type && (!q || (p.name + ' ' + (p.phone || '')).includes(q)));
    if (!ps.length) list.append(emptyMsg('لا يوجد'));
    ps.forEach(p => list.append(listItem(p.name, p.phone || '', balText(p), () => partyView(p.id))));
  };
  const dc = () => { chips.innerHTML = ''; if (CUR.role === 'sales') return; [['customer', 'العملاء'], ['supplier', 'الموردين']].forEach(([k, t]) => chips.append(chip(t, type === k, () => { type = k; NAV.partyType = k; dc(); draw(); }))); };
  dc(); draw();
  return h('div', {}, chips, searchBox('بحث بالاسم / التليفون', v => { q = v; draw(); }), list, fab(type === 'customer' ? '+ عميل' : '+ مورد', () => partyForm(type, null, () => refresh())));
}

function partyForm(type, p, cb) {
  const name = inp({ value: p ? p.name : '' }), phone = inp({ value: p ? p.phone || '' : '', inputmode: 'tel' });
  const opening = numInp({ value: p ? p.opening || '' : '', placeholder: '0' });
  modal((p ? 'تعديل ' : 'جديد: ') + (type === 'customer' ? 'عميل' : 'مورد'), h('div', {}, field('الاسم', name), field('التليفون', phone),
    field('رصيد افتتاحي', opening, type === 'customer' ? 'مبلغ مستحق على العميل قبل استخدام التطبيق' : 'مبلغ مستحق للمورد قبل استخدام التطبيق')), [{ t: 'حفظ', fn: () => {
    if (!name.value.trim()) { toast('الاسم مطلوب', true); return false; }
    const d = { name: name.value.trim(), phone: phone.value.trim(), opening: num(opening.value) };
    const r = p ? edit('parties', p.id, d) : add('parties', Object.assign({ type }, d));
    cb && cb(r);
  } }]);
}

function partyView(id) {
  go('حساب', () => {
    const p = get('parties', id); if (!p) return emptyMsg('غير موجود');
    const el = h('div', {});
    el.append(card(h('h3', {}, p.name, badge(p.type === 'customer' ? 'عميل' : 'مورد')), p.phone ? kv('التليفون', p.phone) : null, p.opening ? kv('رصيد افتتاحي', money(p.opening)) : null,
      h('div', { class: 'kv big' }, h('span', {}, 'الرصيد الحالي'), h('b', {}, balText(p)))));
    const btns = h('div', { class: 'btns' });
    if (p.type === 'customer') btns.append(h('button', { class: 'btn', onclick: () => paymentForm(p.id, 'in') }, '💵 استلام دفعة'), h('button', { class: 'btn acc', onclick: () => saleForm({}) }, '🧾 فاتورة'));
    else btns.append(h('button', { class: 'btn', onclick: () => paymentForm(p.id, 'out') }, '💸 سداد للمورد'));
    if (isAdmin()) btns.append(h('button', { class: 'btn ghost', onclick: () => partyForm(p.type, p, () => refresh()) }, '✏️ تعديل'), h('button', { class: 'btn danger', onclick: () => {
      const used = L('sales').some(s => s.customerId === p.id) || L('blocks').some(b => b.supplierId === p.id) || L('payments').some(x => x.partyId === p.id);
      if (used) return toast('عليه حركات — لا يمكن حذفه', true);
      confirmBox('حذف ' + p.name + '؟', () => { rm('parties', p.id); back(); }, 'حذف');
    } }, '🗑 حذف'));
    el.append(btns, h('h3', {}, 'كشف الحساب'));
    const ev = [];
    if (p.type === 'customer') L('sales').filter(s => s.customerId === p.id).forEach(s => ev.push({ d: s.date, t: 'فاتورة ' + s.no, dr: s.total, cr: 0, fn: () => saleView(s.id) }));
    else L('blocks').filter(b => b.supplierId === p.id).forEach(b => ev.push({ d: b.date, t: 'شراء بلوك ' + b.code, dr: b.price || 0, cr: 0, fn: () => blockView(b.id) }));
    L('payments').filter(x => x.partyId === p.id).forEach(x => {
      const reduces = (p.type === 'customer') === (x.dir === 'in');
      ev.push({ d: x.date, t: (x.dir === 'in' ? 'استلام ' : 'سداد ') + (x.method || '') + (x.note ? ' - ' + x.note : ''), dr: reduces ? 0 : x.amount, cr: reduces ? x.amount : 0, pay: x });
    });
    ev.sort((a, b) => a.d.localeCompare(b.d));
    let run = p.opening || 0;
    const rows = ev.map(e => { run += e.dr - e.cr; return h('tr', { onclick: () => { if (e.fn) e.fn(); else if (isAdmin()) confirmBox('حذف هذه الدفعة؟', () => { rm('payments', e.pay.id); refresh(); }, 'حذف'); } }, h('td', {}, e.d), h('td', {}, e.t), h('td', {}, e.dr ? fmt(e.dr) : ''), h('td', {}, e.cr ? fmt(e.cr) : ''), h('td', {}, fmt(run))); });
    el.append(h('div', { class: 'card tw' }, h('table', {}, h('thead', {}, h('tr', {}, ['التاريخ', 'البيان', 'مدين', 'دائن', 'الرصيد'].map(t => h('th', {}, t)))), h('tbody', {}, rows))));
    if (!rows.length) el.append(emptyMsg('لا توجد حركات'));
    return el;
  });
}

function paymentForm(partyId, dir, blockId, saleId) {
  const p = get('parties', partyId); if (!p) return;
  let rem = 0;
  if (blockId) { const b = get('blocks', blockId); rem = (b.price || 0) - C.supplierPaidForBlock(b); }
  else { rem = Math.max(0, C.partyBalance(p)); }
  const amount = numInp({ value: rem > 0 ? r2(rem) : '' }), date = inp({ type: 'date', value: today() });
  const method = sel(['نقدي', 'تحويل بنكي', 'شيك', 'فودافون كاش / انستاباي']), note = inp({ placeholder: 'ملاحظة' });
  modal((dir === 'in' ? 'استلام دفعة من ' : 'سداد إلى ') + p.name, h('div', {}, h('div', { class: 'note' }, 'الرصيد الحالي: ', balText(p)), field('المبلغ', amount), field('التاريخ', date), field('الطريقة', method), field('ملاحظة', note)), [{ t: 'حفظ', fn: () => {
    if (!(num(amount.value) > 0)) { toast('أدخل المبلغ', true); return false; }
    add('payments', { date: date.value, dir, partyId, amount: r2(num(amount.value)), blockId: blockId || null, saleId: saleId || null, method: method.value, note: note.value.trim() });
    toast('تم التسجيل'); refresh();
  } }]);
}

// ---------- المصروفات ----------
function screenExpenses() {
  let from = monthStart(), to = today();
  const box = h('div', {});
  const draw = () => {
    box.innerHTML = '';
    const ex = C.expenses(from, to).slice().sort((a, b) => b.date.localeCompare(a.date));
    const cats = {}; ex.forEach(e => cats[e.cat] = (cats[e.cat] || 0) + e.amount);
    box.append(card(kv('إجمالي المصروفات', money(sum(ex, e => e.amount)), 'big'), kv('مصروفات عامة (تُخصم من الربح)', money(sum(ex.filter(e => !e.blockId), e => e.amount))), kv('مصروفات محمّلة على بلوكات', money(sum(ex.filter(e => e.blockId), e => e.amount))),
      ...Object.entries(cats).map(([k, v]) => kv(k, money(v)))));
    if (!ex.length) box.append(emptyMsg('لا توجد مصروفات'));
    ex.slice(0, 200).forEach(e => { const b = get('blocks', e.blockId); box.append(listItem(e.cat + (e.desc ? ' - ' + e.desc : ''), e.date + (b ? ' • على بلوك ' + b.code : ' • عام'), money(e.amount), () => expenseActions(e))); });
  };
  const f = inp({ type: 'date', value: from }), t = inp({ type: 'date', value: to });
  f.addEventListener('change', () => { from = f.value; draw(); }); t.addEventListener('change', () => { to = t.value; draw(); });
  draw();
  return h('div', {}, row(field('من', f), field('إلى', t)), box, fab('+ مصروف', () => expenseForm()));
}
function expenseActions(e) {
  if (e.auto) return toast('مصروف تلقائي من البلوك/التقطيع — عدّله من شاشة البلوك', false);
  modal('مصروف', h('div', {}, kv('البند', e.cat), kv('المبلغ', money(e.amount)), kv('التاريخ', e.date), e.desc ? kv('تفاصيل', e.desc) : null), [{ t: 'تعديل', cls: 'ghost', fn: () => { expenseForm(e.blockId, e); } }, { t: 'حذف', cls: 'danger', fn: () => { rm('expenses', e.id); refresh(); } }]);
}
function expenseForm(blockId, e) {
  const date = inp({ type: 'date', value: e ? e.date : today() }), cat = sel(EXP_CATS, e ? e.cat : 'كهرباء'), amount = numInp({ value: e ? e.amount : '' }), desc = inp({ value: e ? e.desc || '' : '', placeholder: 'تفاصيل (اختياري)' });
  const bl = sel([['', 'مصروف عام (على المصنع)'], ...L('blocks').filter(b => b.status !== 'sold').map(b => [b.id, 'على البلوك ' + b.code + ' — ' + blockTitle(b)])], e ? e.blockId || '' : blockId || '');
  go(e ? 'تعديل مصروف' : 'مصروف جديد', () => h('div', {}, card(field('التاريخ', date), field('البند', cat), field('المبلغ', amount), field('تفاصيل', desc), field('تحميل على', bl, 'المصروف المحمّل على بلوك يدخل في تكلفته ولا يُخصم من الربح إلا عند البيع')),
    h('button', { class: 'btn block', id: 'saveExp', onclick: () => {
      if (!(num(amount.value) > 0)) return toast('أدخل المبلغ', true);
      const d = { date: date.value, cat: cat.value, amount: r2(num(amount.value)), desc: desc.value.trim(), blockId: bl.value || null };
      if (e) edit('expenses', e.id, d); else add('expenses', d);
      toast('تم الحفظ'); back(); refresh();
    } }, 'حفظ')));
}
