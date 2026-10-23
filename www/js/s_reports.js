'use strict';
const REPORTS = [['pl', 'الأرباح والخسائر'], ['cash', 'الخزينة: وارد وصادر'], ['inventory', 'حركة المخزون'], ['blocks', 'ربحية البلوكات'], ['debts', 'المديونيات والمستحقات'], ['sales', 'سجل المبيعات']];

function reportData(kind, from, to) {
  const out = { title: REPORTS.find(r => r[0] === kind)[1], summary: [], sections: [], allTime: false };
  if (kind === 'pl') {
    const p = C.pl(from, to);
    out.summary = [['إيرادات المبيعات (بعد الخصم)', p.revenue], ['تكلفة البضاعة المباعة', p.cogs], ['مجمل الربح', p.gross], ['المصروفات العامة', p.general], ['صافي الربح', p.net]];
    const cats = {}; C.expenses(from, to).filter(e => !e.blockId).forEach(e => cats[e.cat] = (cats[e.cat] || 0) + e.amount);
    out.sections.push({ title: 'المصروفات العامة حسب البند', head: ['البند', 'المبلغ'], rows: Object.entries(cats), foot: ['الإجمالي', p.general] });
    const by = {};
    L('sales').filter(s => inRange(s.date, from, to)).forEach(s => { const f = C.saleNetFactor(s); s.lines.forEach(l => { const b = get('blocks', l.blockId) || {}; const k = blockTitle(b) + (l.kind === 'block' ? ' (بلوك خام)' : ''); const o = by[k] = by[k] || { a: 0, r: 0, c: 0 }; o.a += l.area || 0; o.r += l.total * f; o.c += l.cost || 0; }); });
    out.sections.push({ title: 'المبيعات حسب الصنف', head: ['الصنف', 'م²', 'الإيراد', 'التكلفة', 'الربح'], rows: Object.entries(by).map(([k, o]) => [k, r2(o.a), r2(o.r), r2(o.c), r2(o.r - o.c)]) });
    out.note = 'المصروفات المحمّلة على بلوكات تدخل في تكلفة الألواح وتظهر ضمن "تكلفة البضاعة المباعة" عند بيعها.';
  } else if (kind === 'cash') {
    const before = sum(C.cashIn(null, dayBefore(from)), p => p.amount) - sum(C.cashOut(null, dayBefore(from)), p => p.amount) - sum(C.expenses(null, dayBefore(from)), e => e.amount);
    const ins = C.cashIn(from, to), outs = C.cashOut(from, to), exps = C.expenses(from, to);
    const nm = id => (get('parties', id) || {}).name || '';
    const ev = [...ins.map(p => ({ d: p.date, t: 'وارد', s: 'استلام من ' + (nm(p.partyId) || 'عميل نقدي') + (p.note ? ' - ' + p.note : ''), i: p.amount, o: 0 })),
      ...outs.map(p => ({ d: p.date, t: 'صادر', s: 'سداد ' + (nm(p.partyId) || 'شراء نقدي') + (p.note ? ' - ' + p.note : ''), i: 0, o: p.amount })),
      ...exps.map(e => ({ d: e.date, t: 'صادر', s: 'مصروف: ' + e.cat + (e.desc ? ' - ' + e.desc : ''), i: 0, o: e.amount }))].sort((a, b) => a.d.localeCompare(b.d));
    out.summary = [['رصيد أول المدة', before], ['إجمالي الوارد (مدخلات)', sum(ins, p => p.amount)], ['إجمالي الصادر (مخرجات)', sum(outs, p => p.amount) + sum(exps, e => e.amount)], ['رصيد آخر المدة', before + sum(ins, p => p.amount) - sum(outs, p => p.amount) - sum(exps, e => e.amount)]];
    let run = before;
    out.sections.push({ title: 'حركة الخزينة', head: ['التاريخ', 'النوع', 'البيان', 'وارد', 'صادر', 'الرصيد'], rows: ev.map(e => { run += e.i - e.o; return [e.d, e.t, e.s, e.i || '', e.o || '', r2(run)]; }) });
  } else if (kind === 'inventory') {
    const bl = L('blocks').filter(b => inRange(b.date, from, to)), jobs = L('jobs').filter(j => inRange(j.date, from, to));
    const sales = L('sales').filter(s => inRange(s.date, from, to)), sl = sum(sales, s => sum(s.lines.filter(l => l.kind === 'slab'), l => l.area));
    const produced = sum(jobs, j => sum(j.lines, x => x.count * x.l * x.w / 1e4)), sv = C.stockValue();
    out.summary = [['بلوكات مشتراة (عدد)', bl.length + ' بلوك'], ['حجم البلوكات المشتراة', fmt(sum(bl, C.vol), 2) + ' م³'], ['تكلفة البلوكات المشتراة', sum(bl, b => b.price || 0)],
      ['ألواح منتجة (تقطيع)', fmt(produced) + ' م²'], ['ألواح مباعة', fmt(sl) + ' م²'], ['بلوكات خام حاليًا', sv.nRaw + ' بلوك'], ['ألواح بالمخزن حاليًا', fmt(sv.area) + ' م²'], ['قيمة المخزون الحالي (بالتكلفة)', sv.raw + sv.slabs]];
    out.sections.push({ title: 'مشتريات البلوكات', head: ['الكود', 'الصنف', 'المورد', 'التاريخ', 'م³', 'السعر'], rows: bl.map(b => [b.code, blockTitle(b), (get('parties', b.supplierId) || {}).name || 'نقدي', b.date, r2(C.vol(b)), b.price || 0]) });
    out.sections.push({ title: 'عمليات التقطيع', head: ['البلوك', 'التاريخ', 'الماكينة', 'ألواح', 'م²'], rows: jobs.map(j => [(get('blocks', j.blockId) || {}).code, j.date, j.machine, sum(j.lines, x => x.count), r2(sum(j.lines, x => x.count * x.l * x.w / 1e4))]) });
    const st = {}; L('slabs').filter(s => s.status === 'stock').forEach(s => { const b = get('blocks', s.blockId) || {}; const k = blockTitle(b); const o = st[k] = st[k] || { n: 0, a: 0, c: 0 }; o.n++; o.a += s.area; o.c += C.slabCost(s); });
    out.sections.push({ title: 'رصيد الألواح بالمخزن الآن', head: ['الصنف', 'عدد', 'م²', 'التكلفة'], rows: Object.entries(st).map(([k, o]) => [k, o.n, r2(o.a), r2(o.c)]) });
  } else if (kind === 'blocks') {
    out.allTime = true;
    const rows = L('blocks').map(b => {
      const cost = C.blockCost(b); const sold = L('sales').flatMap(s => s.lines.filter(l => l.blockId === b.id).map(l => ({ l, f: C.saleNetFactor(s) })));
      const rev = sum(sold, x => x.l.total * x.f), cogs = sum(sold, x => x.l.cost || 0);
      const ss = C.blockSlabStats(b), remain = b.status === 'cut' ? ss.areaStock * (C.perM2Map()[b.id] || 0) : (b.status === 'raw' ? cost : 0);
      return [b.code, blockTitle(b), r2(cost), r2(rev), r2(cogs), r2(rev - cogs), r2(remain), r2(ss.yield)];
    });
    out.summary = [['إجمالي التكلفة', sum(rows, r => r[2])], ['إجمالي الإيراد', sum(rows, r => r[3])], ['الربح المحقق', sum(rows, r => r[5])]];
    out.sections.push({ title: 'كل البلوكات (منذ البداية)', head: ['الكود', 'الصنف', 'التكلفة', 'الإيراد', 'تكلفة المباع', 'الربح المحقق', 'مخزون متبقٍ (تكلفة)', 'استفادة %'], rows });
  } else if (kind === 'debts') {
    out.allTime = true;
    const cu = L('parties').filter(p => p.type === 'customer').map(p => [p.name, p.phone || '', C.partyBalance(p)]).filter(r => Math.abs(r[2]) > 0.005);
    const su = L('parties').filter(p => p.type === 'supplier').map(p => [p.name, p.phone || '', C.partyBalance(p)]).filter(r => Math.abs(r[2]) > 0.005);
    out.summary = [['مستحق لنا عند العملاء', sum(cu, r => Math.max(0, r[2]))], ['مستحق علينا للموردين', sum(su, r => Math.max(0, r[2]))]];
    out.sections.push({ title: 'العملاء (موجب = عليه)', head: ['الاسم', 'التليفون', 'الرصيد'], rows: cu }, { title: 'الموردين (موجب = علينا)', head: ['الاسم', 'التليفون', 'الرصيد'], rows: su });
  } else if (kind === 'sales') {
    const ss = L('sales').filter(s => inRange(s.date, from, to)).sort((a, b) => a.date.localeCompare(b.date));
    const paid = s => sum(L('payments').filter(p => p.saleId === s.id), p => p.amount);
    out.summary = [['عدد الفواتير', ss.length + ''], ['إجمالي المبيعات', sum(ss, s => s.total)], ['المحصل وقت البيع', sum(ss, paid)]];
    out.sections.push({ title: 'الفواتير', head: ['الرقم', 'التاريخ', 'العميل', 'م²', 'الإجمالي', 'الخصم', 'الصافي', 'المدفوع'], rows: ss.map(s => [s.no, s.date, (get('parties', s.customerId) || {}).name || 'نقدي', r2(sum(s.lines, l => l.area || 0)), s.subtotal, s.discount || 0, s.total, r2(paid(s))]) });
  }
  return out;
}
function dayBefore(d) { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); }
const cell = v => (typeof v === 'number' ? fmt(v) : (v == null ? '' : v));

function renderReport(r, from, to) {
  const el = h('div', { class: 'paper' }, h('h2', {}, S.meta.company || 'إدارة الرخام والجرانيت'), h('div', { class: 'sub' }, r.title + (r.allTime ? ' — منذ البداية' : ` — من ${from} إلى ${to}`)));
  if (r.summary.length) r.summary.forEach(([k, v]) => el.append(kv(k, typeof v === 'number' ? money(v) : v, /صافي|رصيد آخر|الربح/.test(k) ? 'big' : '')));
  r.sections.forEach(s => {
    el.append(h('h4', {}, s.title));
    el.append(h('div', { class: 'tw' }, h('table', {}, h('thead', {}, h('tr', {}, s.head.map(t => h('th', {}, t)))),
      h('tbody', {}, s.rows.length ? s.rows.map(rw => h('tr', {}, rw.map(c => h('td', {}, cell(c))))) : h('tr', {}, h('td', { colspan: s.head.length }, 'لا توجد بيانات'))),
      s.foot ? h('tfoot', {}, h('tr', {}, s.foot.map(c => h('td', {}, cell(c))))) : null)));
  });
  if (r.note) el.append(h('p', { class: 'sub' }, r.note));
  return el;
}
function reportSheets(r, from, to) {
  const sheets = [{ name: 'الملخص', rows: [[S.meta.company || '', r.title], ['الفترة', r.allTime ? 'منذ البداية' : `${from} إلى ${to}`], [], ...r.summary.map(([k, v]) => [k, v])] }];
  r.sections.forEach((s, i) => sheets.push({ name: s.title.slice(0, 28), rows: [s.head, ...s.rows, ...(s.foot ? [s.foot] : [])] }));
  return sheets;
}

function screenReports() {
  let kind = NAV.repKind || 'pl', from = monthStart(), to = today();
  const out = h('div', {}), chips = h('div', { class: 'chips' });
  let cur;
  const draw = () => { out.innerHTML = ''; cur = reportData(kind, from, to); out.append(renderReport(cur, from, to)); };
  const dc = () => { chips.innerHTML = ''; REPORTS.forEach(([k, t]) => chips.append(chip(t, kind === k, () => { kind = k; NAV.repKind = k; dc(); draw(); }))); };
  const f = inp({ type: 'date', value: from }), t = inp({ type: 'date', value: to });
  f.addEventListener('change', () => { from = f.value; draw(); }); t.addEventListener('change', () => { to = t.value; draw(); });
  const presets = h('div', { class: 'chips' }, [['اليوم', () => [today(), today()]], ['الشهر', () => [monthStart(), today()]], ['السنة', () => [today().slice(0, 4) + '-01-01', today()]], ['الكل', () => ['2000-01-01', today()]]].map(([n, fn]) => chip(n, false, () => { [from, to] = fn(); f.value = from; t.value = to; draw(); })));
  dc(); draw();
  return h('div', {}, chips, row(field('من', f), field('إلى', t)), presets, h('div', { class: 'btns' },
    h('button', { class: 'btn', id: 'xlsxBtn', onclick: () => exportXLSX(reportSheets(cur, from, to), `${kind}-${today()}`) }, '📊 Excel'),
    h('button', { class: 'btn acc', id: 'pdfBtn', onclick: () => exportPDF(out.firstChild, `${kind}-${today()}`) }, '📄 PDF')), out);
}
