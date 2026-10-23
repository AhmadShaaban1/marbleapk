'use strict';
const VARIETIES = ['جلالة', 'سلفيا', 'صني', 'بيج مصري', 'عجمي', 'كرارة', 'تريستا', 'مرمر', 'أسواني أحمر', 'رمادي', 'أسود أسواني', 'جراند فيرد'];
const stoneName = s => (s === 'granite' ? 'جرانيت' : 'رخام');
const blockTitle = b => `${stoneName(b.stone)} ${b.variety || ''}`.trim();

function blockItem(b) {
  const st = C.blockState(b), ss = C.blockSlabStats(b);
  return listItem(`${b.code} — ${blockTitle(b)}`,
    `${fmt(b.l, 0)}×${fmt(b.w, 0)}×${fmt(b.h, 0)} سم • ${fmt(C.vol(b), 2)} م³` + (b.status !== 'raw' && ss.n ? ` • ${ss.nStock}/${ss.n} لوح بالمخزن` : ''),
    isAdmin() ? money(C.blockCost(b)) : null, () => blockView(b.id), badge(st.t, st.k));
}

function screenBlocks() {
  let q = '', f = 'all';
  const list = h('div', {});
  const draw = () => {
    list.innerHTML = '';
    const bs = L('blocks').filter(b => (f === 'all' || (f === 'raw' && b.status === 'raw') || (f === 'cut' && C.blockState(b).k === 'cut') || (f === 'sold' && C.blockState(b).k === 'sold')) &&
      (!q || (b.code + ' ' + blockTitle(b) + ' ' + ((get('parties', b.supplierId) || {}).name || '')).includes(q))).reverse();
    if (!bs.length) list.append(emptyMsg('لا توجد بلوكات'));
    bs.forEach(b => list.append(blockItem(b)));
  };
  const chips = h('div', { class: 'chips' });
  const drawChips = () => { chips.innerHTML = ''; [['all', 'الكل'], ['raw', 'خام'], ['cut', 'تم تقطيعه'], ['sold', 'مباع']].forEach(([k, t]) => chips.append(chip(t, f === k, () => { f = k; drawChips(); draw(); }))); };
  drawChips(); draw();
  const el = h('div', {}, searchBox('بحث بالكود / النوع / المورد', v => { q = v; draw(); }), chips, list);
  if (isAdmin() || CUR.role === 'cutter') el.append(fab('+ بلوك', () => blockForm()));
  return el;
}

function supplierSelect(val) {
  const s = sel([['', '— بدون مورد (شراء نقدي) —'], ...L('parties').filter(p => p.type === 'supplier').map(p => [p.id, p.name])], val);
  return s;
}

function blockForm(b) {
  const isNew = !b;
  const stone = sel([['marble', 'رخام'], ['granite', 'جرانيت']], b ? b.stone : 'marble');
  const dl = h('datalist', { id: 'varDl' }, VARIETIES.map(v => h('option', { value: v })));
  const variety = inp({ value: b ? b.variety : '', list: 'varDl', placeholder: 'مثال: جلالة' });
  const sup = supplierSelect(b ? b.supplierId : '');
  const addSup = h('button', { class: 'btn ghost sm', onclick: () => partyForm('supplier', null, p => { sup.append(h('option', { value: p.id }, p.name)); sup.value = p.id; }) }, '+ مورد');
  const date = inp({ type: 'date', value: b ? b.date : today() });
  const l = numInp({ value: b ? b.l : '', placeholder: 'الطول' }), w = numInp({ value: b ? b.w : '', placeholder: 'العرض' }), hh = numInp({ value: b ? b.h : '', placeholder: 'الارتفاع' });
  const weight = numInp({ value: b ? b.weight || '' : '', placeholder: 'اختياري' });
  const price = numInp({ value: b ? b.price : '' });
  const tExp = b && L('expenses').find(e => e.blockId === b.id && e.auto === 'transport');
  const transport = numInp({ value: tExp ? tExp.amount : '' });
  const paid = numInp({ value: '', placeholder: '0' });
  const note = inp({ value: b ? b.note || '' : '' });
  const volTxt = h('small', {});
  const upVol = () => { volTxt.textContent = 'الحجم: ' + fmt(num(l.value) * num(w.value) * num(hh.value) / 1e6, 3) + ' م³'; };
  [l, w, hh].forEach(i => i.addEventListener('input', upVol)); upVol();
  const body = h('div', {}, dl,
    row(field('الخامة', stone), field('النوع / الصنف', variety)),
    field('المورد', h('div', { class: 'row' }, sup, addSup)),
    field('تاريخ الشراء', date),
    h('div', { class: 'fld' }, h('span', {}, 'الأبعاد بالسنتيمتر (طول × عرض × ارتفاع)'), row(l, w, hh), volTxt),
    field('الوزن (طن)', weight),
    row(field('سعر البلوك', price), field('مصاريف النقل', transport)),
    isNew ? field('المدفوع الآن للمورد', paid, 'لو بدون مورد يُعتبر الشراء نقدي بالكامل') : null,
    field('ملاحظات', note));
  go(isNew ? 'بلوك جديد' : 'تعديل بلوك ' + b.code, () => h('div', {}, card(body), h('button', { class: 'btn block', id: 'saveBlock', onclick: () => {
    if (num(l.value) <= 0 || num(w.value) <= 0 || num(hh.value) <= 0) return toast('أدخل أبعاد البلوك', true);
    const price_ = num(price.value);
    const d = { stone: stone.value, variety: variety.value.trim(), supplierId: sup.value || null, date: date.value, l: num(l.value), w: num(w.value), h: num(hh.value), weight: num(weight.value), price: price_, note: note.value.trim() };
    let blk;
    if (isNew) { d.code = nextCode('B'); d.status = 'raw'; blk = add('blocks', d); }
    else blk = edit('blocks', b.id, d);
    const tr = num(transport.value);
    const te = L('expenses').find(e => e.blockId === blk.id && e.auto === 'transport');
    if (te) edit('expenses', te.id, { amount: tr, date: d.date }); else if (tr > 0) add('expenses', { date: d.date, cat: 'نقل', desc: 'نقل بلوك ' + blk.code, amount: tr, blockId: blk.id, auto: 'transport' });
    if (isNew) {
      const pd = d.supplierId ? num(paid.value) : price_;
      if (pd > 0) add('payments', { date: d.date, dir: 'out', partyId: d.supplierId, amount: pd, blockId: blk.id, method: 'نقدي', note: 'دفعة شراء بلوك ' + blk.code });
    }
    toast('تم الحفظ'); back(); if (isNew) blockView(blk.id); else refresh();
  } }, 'حفظ')));
}

function blockView(id) {
  go('بلوك', () => {
    const b = get('blocks', id); if (!b) return emptyMsg('غير موجود');
    const st = C.blockState(b), ss = C.blockSlabStats(b), sup = get('parties', b.supplierId);
    const el = h('div', {});
    el.append(card(h('h3', {}, `${b.code} — ${blockTitle(b)}`, badge(st.t, st.k)),
      kv('الأبعاد', `${fmt(b.l, 0)}×${fmt(b.w, 0)}×${fmt(b.h, 0)} سم`), kv('الحجم', fmt(C.vol(b), 3) + ' م³'),
      b.weight ? kv('الوزن', fmt(b.weight) + ' طن') : null, kv('المورد', sup ? sup.name : 'شراء نقدي'), kv('تاريخ الشراء', b.date), b.note ? kv('ملاحظات', b.note) : null));
    if (isAdmin()) {
      const exps = L('expenses').filter(e => e.blockId === b.id), paid = C.supplierPaidForBlock(b);
      el.append(card(h('h3', {}, 'التكلفة'), kv('سعر البلوك', money(b.price)),
        ...exps.map(e => kv(`${e.cat}${e.desc ? ' - ' + e.desc : ''}`, money(e.amount))),
        kv('إجمالي التكلفة', money(C.blockCost(b)), 'big'),
        ss.n ? kv('تكلفة المتر المربع', money(C.perM2Map()[b.id])) : null,
        b.supplierId || b.price ? kv('مدفوع للمورد', money(paid)) : null,
        b.supplierId && b.price - paid > 0.005 ? kv('متبقي للمورد', money(b.price - paid), 'neg') : null));
    }
    if (ss.n) el.append(card(h('h3', {}, 'نتيجة التقطيع'), kv('عدد الألواح', ss.n), kv('إجمالي المساحة', fmt(ss.area) + ' م²'), kv('المتبقي بالمخزن', `${ss.nStock} لوح — ${fmt(ss.areaStock)} م²`),
      kv('نسبة الاستفادة', fmt(ss.yield, 1) + '%', 'big'), kv('الفاقد (نشر + كسر)', fmt(100 - ss.yield, 1) + '%')));
    const btns = h('div', { class: 'btns' });
    if (isAdmin() || CUR.role === 'cutter') btns.append(h('button', { class: 'btn', onclick: () => jobForm(b.id) }, '⚙️ تسجيل تقطيع'));
    if (isAdmin()) btns.append(h('button', { class: 'btn acc', onclick: () => expenseForm(b.id) }, '💸 مصروف على البلوك'),
      b.supplierId ? h('button', { class: 'btn ghost', onclick: () => paymentForm(b.supplierId, 'out', b.id) }, 'دفع للمورد') : null);
    if ((isAdmin() || CUR.role === 'sales') && b.status === 'raw') btns.append(h('button', { class: 'btn ghost', onclick: () => saleForm({ blockId: b.id }) }, 'بيع كبلوك خام'));
    btns.append(h('button', { class: 'btn ghost', onclick: () => labelModal(qrBlock(b), b.code, blockTitle(b)) }, '🏷 ملصق QR'));
    if (ss.n) btns.append(h('button', { class: 'btn ghost', onclick: () => labelsPdf(C.slabsOf(b).map(s => ({ qr: qrSlab(s), l1: s.code, l2: `${blockTitle(b)} • ${fmt(s.l, 0)}×${fmt(s.w, 0)}×${fmt(s.t, 1)}` })), 'labels-' + b.code) }, '🏷 ملصقات كل الألواح (PDF)'));
    if (isAdmin()) btns.append(h('button', { class: 'btn ghost', onclick: () => blockForm(b) }, '✏️ تعديل'), h('button', { class: 'btn danger', onclick: () => delBlock(b) }, '🗑 حذف'));
    el.append(btns);
    const jobs = L('jobs').filter(j => j.blockId === b.id);
    if (jobs.length) { el.append(h('h3', {}, 'عمليات التقطيع')); jobs.forEach(j => el.append(jobItem(j))); }
    if (ss.n) {
      el.append(h('h3', {}, 'الألواح'));
      C.slabsOf(b).forEach(s => el.append(slabItem(s)));
    }
    return el;
  });
}

function labelModal(qr, l1, l2) {
  modal('ملصق QR', h('div', { class: 'qrbox' }, h('img', { src: qrImg(qr, 8) }), h('h3', { style: 'direction:ltr' }, l1), h('div', {}, l2)),
    [{ t: 'PDF للطباعة', fn: () => { labelsPdf([{ qr, l1, l2 }], 'label-' + l1); return false; } }, { t: 'إغلاق', cls: 'ghost', fn: () => { } }]);
}

function delBlock(b) {
  const slabs = C.slabsOf(b);
  if (b.status === 'sold' || slabs.some(s => s.status === 'sold')) return toast('لا يمكن حذف بلوك تم بيع منه — احذف/ألغِ فاتورة البيع أولًا', true);
  confirmBox(`حذف البلوك ${b.code} وكل ألواحه ومصروفاته ودفعاته؟`, () => {
    slabs.forEach(s => rm('slabs', s.id));
    L('jobs').filter(j => j.blockId === b.id).forEach(j => rm('jobs', j.id));
    L('expenses').filter(e => e.blockId === b.id).forEach(e => rm('expenses', e.id));
    L('payments').filter(p => p.blockId === b.id).forEach(p => rm('payments', p.id));
    rm('blocks', b.id); toast('تم الحذف'); back();
  }, 'حذف');
}

// ---------- التقطيع ----------
const JOB_COSTS = [['labor', 'أجور التقطيع'], ['power', 'كهرباء / سولار'], ['blades', 'أسلاك / ديسكات / كاشطات'], ['other', 'مصاريف أخرى']];

function jobItem(j) {
  const b = get('blocks', j.blockId) || {};
  const area = sum(j.lines, x => x.count * x.l * x.w / 1e4), cnt = sum(j.lines, x => x.count);
  return listItem(`${b.code || '?'} — ${j.machine}`, `${j.date} • ${cnt} لوح • ${fmt(area)} م²` + (j.operator ? ' • ' + j.operator : ''),
    isAdmin() ? money(sum(JOB_COSTS, ([k]) => j[k] || 0)) : null, () => jobView(j.id));
}
function screenJobs() {
  const el = h('div', {});
  const js = L('jobs').slice().reverse();
  if (!js.length) el.append(emptyMsg('لا توجد عمليات تقطيع'));
  js.forEach(j => el.append(jobItem(j)));
  if (isAdmin() || CUR.role === 'cutter') el.append(fab('+ تقطيع', () => jobForm()));
  return el;
}
function jobView(id) {
  const j = get('jobs', id); if (!j) return;
  const b = get('blocks', j.blockId) || {};
  const slabs = L('slabs').filter(s => s.jobId === j.id);
  const body = h('div', {}, kv('البلوك', b.code), kv('التاريخ', j.date), kv('الماكينة', j.machine), kv('المشغل', j.operator || '-'),
    kv('عدد الألواح', slabs.length), kv('المساحة', fmt(sum(slabs, s => s.area)) + ' م²'),
    ...(isAdmin() ? JOB_COSTS.filter(([k]) => j[k]).map(([k, t]) => kv(t, money(j[k]))) : []),
    h('h4', {}, 'تفاصيل المقاسات'), ...j.lines.map(x => kv(`${fmt(x.l, 0)}×${fmt(x.w, 0)}×${fmt(x.t, 1)} سم (${x.grade})`, x.count + ' لوح')));
  const btns = [{ t: 'فتح البلوك', cls: 'ghost', fn: () => { blockView(b.id); } }];
  if (isAdmin()) btns.push({ t: 'حذف العملية', cls: 'danger', fn: () => {
    if (slabs.some(s => s.status === 'sold')) { toast('تم بيع ألواح من هذه العملية', true); return false; }
    slabs.forEach(s => rm('slabs', s.id));
    L('expenses').filter(e => e.jobId === j.id).forEach(e => rm('expenses', e.id));
    rm('jobs', j.id);
    if (!L('jobs').some(x => x.blockId === j.blockId)) edit('blocks', j.blockId, { status: 'raw' });
    toast('تم الحذف'); refresh();
  } });
  modal('عملية تقطيع', body, btns);
}

function jobForm(blockId) {
  const blocks = L('blocks').filter(b => b.status !== 'sold' && (b.status === 'raw' || C.blockState(b).k !== 'sold')).reverse();
  if (!blocks.length) return toast('لا توجد بلوكات متاحة للتقطيع — أضف بلوك أولًا', true);
  const bsel = sel(blocks.map(b => [b.id, `${b.code} — ${blockTitle(b)} (${fmt(C.vol(b), 2)} م³)`]), blockId || blocks[0].id);
  const date = inp({ type: 'date', value: today() });
  const machine = sel(['جنج سو', 'بلوك كاتر', 'أخرى'], 'جنج سو');
  const operator = inp({ value: CUR.role === 'cutter' ? CUR.name : '', placeholder: 'اسم المشغل' });
  let rows = [{ l: '', w: '', t: '2', count: '', grade: 'أول' }];
  const rowsBox = h('div', {}), sumBox = h('div', { class: 'note' });
  const costs = {}; JOB_COSTS.forEach(([k]) => costs[k] = numInp({ placeholder: '0' }));
  const calc = () => {
    const b = get('blocks', bsel.value);
    const area = sum(rows, r => num(r.count) * num(r.l) * num(r.w) / 1e4), vol = sum(rows, r => num(r.count) * num(r.l) * num(r.w) * num(r.t) / 1e6);
    const pct = b && C.vol(b) ? vol / C.vol(b) * 100 : 0;
    sumBox.textContent = `الألواح: ${sum(rows, r => num(r.count))} • المساحة: ${fmt(area)} م² • الاستفادة: ${fmt(pct, 1)}%` + (pct > 100 ? ' ⚠ أكبر من حجم البلوك!' : '');
  };
  const drawRows = () => {
    rowsBox.innerHTML = '';
    rows.forEach((r, i) => {
      const mk = (k, ph, w) => { const x = numInp({ value: r[k], placeholder: ph }); x.addEventListener('input', () => { r[k] = x.value; calc(); }); return x; };
      const g = sel(['أول', 'ثاني', 'ثالث'], r.grade); g.addEventListener('change', () => r.grade = g.value);
      rowsBox.append(h('div', { class: 'card' }, row(mk('l', 'طول سم'), mk('w', 'عرض سم'), mk('t', 'سمك سم')), h('div', { style: 'height:6px' }), row(mk('count', 'العدد'), g,
        rows.length > 1 ? h('button', { class: 'btn danger sm', onclick: () => { rows.splice(i, 1); drawRows(); } }, 'حذف') : null)));
    });
    calc();
  };
  bsel.addEventListener('change', calc);
  drawRows();
  go('تسجيل تقطيع', () => h('div', {},
    card(field('البلوك', bsel), row(field('التاريخ', date), field('الماكينة', machine)), field('المشغل', operator)),
    h('h3', {}, 'الألواح الناتجة (قاسات وعدد)'), rowsBox,
    h('button', { class: 'btn ghost block', onclick: () => { rows.push({ l: rows.at(-1).l, w: rows.at(-1).w, t: rows.at(-1).t, count: '', grade: 'أول' }); drawRows(); } }, '+ مقاس آخر'), sumBox,
    isAdmin() ? card(h('h3', {}, 'تكلفة التقطيع'), JOB_COSTS.map(([k, t]) => field(t, costs[k]))) : null,
    h('button', { class: 'btn block', id: 'saveJob', onclick: () => {
      const b = get('blocks', bsel.value);
      const lines = rows.filter(r => num(r.count) > 0 && num(r.l) > 0 && num(r.w) > 0).map(r => ({ l: num(r.l), w: num(r.w), t: num(r.t) || 2, count: Math.round(num(r.count)), grade: r.grade }));
      if (!lines.length) return toast('أدخل مقاسات وأعداد الألواح', true);
      const vol = sum(lines, x => x.count * x.l * x.w * x.t / 1e6), already = C.blockSlabStats(b).vol;
      if (vol + already > C.vol(b) * 1.001) return toast('حجم الألواح أكبر من حجم البلوك — راجع المقاسات', true);
      const job = add('jobs', Object.assign({ blockId: b.id, date: date.value, machine: machine.value, operator: operator.value.trim(), lines }, ...JOB_COSTS.map(([k]) => ({ [k]: isAdmin() ? num(costs[k].value) : 0 }))));
      let seq = S.slabs.filter(s => s.blockId === b.id).length;
      lines.forEach(x => { for (let i = 0; i < x.count; i++) { seq++; add('slabs', { code: `${b.code}-${String(seq).padStart(2, '0')}`, blockId: b.id, jobId: job.id, l: x.l, w: x.w, t: x.t, area: x.l * x.w / 1e4, grade: x.grade, status: 'stock' }); } });
      JOB_COSTS.forEach(([k, t]) => { const a = isAdmin() ? num(costs[k].value) : 0; if (a > 0) add('expenses', { date: date.value, cat: 'تقطيع', desc: t + ' - ' + b.code, amount: a, blockId: b.id, jobId: job.id, auto: 'job' }); });
      edit('blocks', b.id, { status: 'cut' });
      toast('تم تسجيل التقطيع وإنشاء الألواح'); back(); blockView(b.id);
    } }, 'حفظ التقطيع وإنشاء الألواح')));
}
