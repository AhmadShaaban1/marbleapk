'use strict';
// كل الحسابات المحاسبية والمخزنية هنا
let _memo = { v: -1, d: {} };
function memo(key, fn) {
  if (_memo.v !== _ver) _memo = { v: _ver, d: {} };
  return key in _memo.d ? _memo.d[key] : (_memo.d[key] = fn());
}
const C = {
  vol: b => (b.l * b.w * b.h) / 1e6,
  blockExp: b => sum(L('expenses').filter(e => e.blockId === b.id), e => e.amount),
  blockCost: b => (b.price || 0) + C.blockExp(b),
  slabsOf: b => L('slabs').filter(s => s.blockId === b.id),
  // تكلفة المتر المربع لكل بلوك (التكلفة الكلية ÷ مساحة الألواح الناتجة)
  perM2Map: () => memo('perM2', () => {
    const area = {};
    L('slabs').forEach(s => area[s.blockId] = (area[s.blockId] || 0) + s.area);
    const m = {};
    L('blocks').forEach(b => m[b.id] = area[b.id] ? C.blockCost(b) / area[b.id] : 0);
    return m;
  }),
  slabCost: s => s.area * (C.perM2Map()[s.blockId] || 0),
  blockSlabStats: b => {
    const sl = C.slabsOf(b);
    const area = sum(sl, s => s.area);
    const vol = sum(sl, s => s.area * s.t / 100);
    const stock = sl.filter(s => s.status === 'stock');
    return { n: sl.length, area, vol, nStock: stock.length, areaStock: sum(stock, s => s.area),
      yield: C.vol(b) ? vol / C.vol(b) * 100 : 0 };
  },
  blockState: b => {
    if (b.status === 'sold') return { t: 'مباع (بلوك خام)', k: 'sold' };
    if (b.status === 'raw') return { t: 'خام - لم يُقطّع', k: 'raw' };
    const st = C.blockSlabStats(b);
    return st.nStock === 0 && st.n > 0 ? { t: 'تم بيع كل الألواح', k: 'sold' } : { t: 'تم التقطيع', k: 'cut' };
  },
  supplierPaidForBlock: b => sum(L('payments').filter(p => p.blockId === b.id && p.dir === 'out'), p => p.amount),
  // أرصدة الأطراف: موجب = علينا للمورد / له علينا للعميل
  partyBalance: p => {
    let bal = p.opening || 0;
    if (p.type === 'customer') {
      bal += sum(L('sales').filter(s => s.customerId === p.id), s => s.total);
      bal -= sum(L('payments').filter(x => x.partyId === p.id && x.dir === 'in'), x => x.amount);
      bal += sum(L('payments').filter(x => x.partyId === p.id && x.dir === 'out'), x => x.amount);
    } else {
      bal += sum(L('blocks').filter(b => b.supplierId === p.id), b => b.price || 0);
      bal -= sum(L('payments').filter(x => x.partyId === p.id && x.dir === 'out'), x => x.amount);
      bal += sum(L('payments').filter(x => x.partyId === p.id && x.dir === 'in'), x => x.amount);
    }
    return r2(bal);
  },
  saleNetFactor: s => (s.subtotal ? s.total / s.subtotal : 1),
  cashIn: (from, to) => L('payments').filter(p => p.dir === 'in' && inRange(p.date, from, to)),
  cashOut: (from, to) => L('payments').filter(p => p.dir === 'out' && inRange(p.date, from, to)),
  expenses: (from, to) => L('expenses').filter(e => inRange(e.date, from, to)),
  pl: (from, to) => {
    const sales = L('sales').filter(s => inRange(s.date, from, to));
    const revenue = sum(sales, s => s.total);
    const cogs = sum(sales, s => sum(s.lines, l => l.cost || 0));
    const general = sum(C.expenses(from, to).filter(e => !e.blockId), e => e.amount);
    return { revenue, cogs, gross: revenue - cogs, general, net: revenue - cogs - general, n: sales.length };
  },
  stockValue: () => {
    const raw = L('blocks').filter(b => b.status === 'raw');
    const slabs = L('slabs').filter(s => s.status === 'stock');
    return { raw: sum(raw, C.blockCost), slabs: sum(slabs, C.slabCost), nRaw: raw.length, volRaw: sum(raw, C.vol),
      nSlabs: slabs.length, area: sum(slabs, s => s.area) };
  },
  cashBalance: () => sum(C.cashIn(), p => p.amount) - sum(C.cashOut(), p => p.amount) - sum(C.expenses(), e => e.amount),
};
