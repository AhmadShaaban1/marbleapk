'use strict';
const ROLES = { admin: 'مدير', cutter: 'مشغل تقطيع', sales: 'مبيعات' };
const isAdmin = () => CUR && CUR.role === 'admin';
const TABS = {
  admin: [['home', '🏠', 'الرئيسية'], ['blocks', '🪨', 'البلوكات'], ['stock', '📦', 'المخزون'], ['sales', '🧾', 'المبيعات'], ['more', '☰', 'المزيد']],
  cutter: [['home', '🏠', 'الرئيسية'], ['blocks', '🪨', 'البلوكات'], ['jobs', '⚙️', 'التقطيع'], ['stock', '📦', 'المخزون'], ['more', '☰', 'المزيد']],
  sales: [['home', '🏠', 'الرئيسية'], ['stock', '📦', 'المخزون'], ['sales', '🧾', 'المبيعات'], ['parties', '👥', 'العملاء'], ['more', '☰', 'المزيد']],
};
const TITLES = { home: 'الرئيسية', blocks: 'البلوكات', jobs: 'عمليات التقطيع', stock: 'مخزون الألواح', sales: 'المبيعات', parties: 'العملاء والموردين', more: 'المزيد' };
const SCREENS = () => ({ home: screenHome, blocks: screenBlocks, jobs: screenJobs, stock: screenStock, sales: screenSales, parties: screenParties, more: screenMore });

function openTab(k) { resetTo(TITLES[k], SCREENS()[k], { tab: k }); }
function buildTabs() {
  const t = $('#tabs'); t.innerHTML = ''; t.style.display = 'flex';
  TABS[CUR.role].forEach(([k, i, n]) => t.append(h('button', { 'data-k': k, onclick: () => openTab(k) }, h('i', {}, i), n)));
}

async function showAuth() {
  $('#tabs').style.display = 'none'; NAV.stack = []; $('#backBtn').style.visibility = 'hidden';
  $('#title').textContent = S.meta.company || 'إدارة الرخام والجرانيت';
  const v = view(); v.innerHTML = '';
  const users = L('users').filter(u => u.active !== false);
  if (!users.length) return v.append(setupView());
  const name = sel(users.map(u => [u.id, u.name + ' (' + ROLES[u.role] + ')']), S.meta.lastUser);
  const pin = numInp({ type: 'password', placeholder: 'الرقم السري', inputmode: 'numeric' });
  const doLogin = async () => {
    const u = get('users', name.value);
    if (u && u.pin === await sha(pin.value)) { S.meta.lastUser = u.id; persist('meta'); CUR = u; startApp(); }
    else toast('الرقم السري غير صحيح', true);
  };
  pin.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  v.append(h('div', { class: 'login' }, h('h2', {}, '🪨 ' + (S.meta.company || 'إدارة الرخام والجرانيت')),
    card(field('المستخدم', name), field('الرقم السري', pin), h('button', { class: 'btn block', id: 'loginBtn', onclick: doLogin }, 'دخول')),
    h('button', { class: 'btn ghost block', onclick: () => importDialog(() => showAuth()) }, 'استيراد ملف مزامنة')));
}

function setupView() {
  const company = inp({ placeholder: 'مثال: مصنع النور للرخام' });
  const name = inp({ placeholder: 'اسمك' });
  const pin = numInp({ type: 'password', inputmode: 'numeric', placeholder: '4 أرقام على الأقل' });
  return h('div', { class: 'login' }, h('h2', {}, 'إعداد أول مرة'),
    h('div', { class: 'note' }, 'أول جهاز: أنشئ حساب المدير. بعدها من "المزيد ← المستخدمين" أضف مشغل التقطيع والمبيعات، ثم صدّر ملف مزامنة وافتحه على باقي الأجهزة.'),
    card(field('اسم المصنع / الشركة', company), field('اسم المدير', name), field('الرقم السري', pin),
      h('button', { class: 'btn block', id: 'setupBtn', onclick: async () => {
        if (!name.value.trim() || pin.value.length < 4) return toast('أدخل الاسم ورقم سري 4 أرقام على الأقل', true);
        S.meta.company = company.value.trim(); persist('meta');
        CUR = add('users', { name: name.value.trim(), role: 'admin', pin: await sha(pin.value) });
        S.meta.lastUser = CUR.id; persist('meta'); startApp();
      } }, 'إنشاء الحساب والبدء')),
    h('div', { class: 'note' }, 'عندك ملف مزامنة من جهاز تاني؟'),
    h('button', { class: 'btn ghost block', onclick: () => importDialog(() => showAuth()) }, 'استيراد ملف مزامنة'));
}

function startApp() { buildTabs(); openTab('home'); }
function logout() { CUR = null; showAuth(); }

// ---------- الرئيسية ----------
function screenHome() {
  const sv = C.stockValue(), m = C.pl(monthStart(), today());
  const el = h('div', {});
  el.append(h('div', { class: 'note' }, '👋 أهلًا ' + CUR.name + ' — ' + ROLES[CUR.role]));
  const stats = [];
  stats.push(h('div', { class: 'stat' }, h('small', {}, 'بلوكات خام بالمخزن'), h('b', {}, sv.nRaw + ' بلوك'), h('small', {}, fmt(sv.volRaw) + ' م³')));
  stats.push(h('div', { class: 'stat' }, h('small', {}, 'ألواح بالمخزن'), h('b', {}, fmt(sv.area) + ' م²'), h('small', {}, sv.nSlabs + ' لوح')));
  if (isAdmin()) {
    stats.push(h('div', { class: 'stat' }, h('small', {}, 'قيمة المخزون (بالتكلفة)'), h('b', {}, money(sv.raw + sv.slabs))));
    stats.push(h('div', { class: 'stat' }, h('small', {}, 'رصيد الخزينة'), h('b', { class: C.cashBalance() < 0 ? 'neg' : '' }, money(C.cashBalance()))));
    stats.push(h('div', { class: 'stat' }, h('small', {}, 'مبيعات الشهر'), h('b', {}, money(m.revenue)), h('small', {}, m.n + ' فاتورة')));
    stats.push(h('div', { class: 'stat ' + (m.net >= 0 ? 'good' : 'badc') }, h('small', {}, 'صافي ربح الشهر'), h('b', {}, money(m.net))));
  } else if (CUR.role === 'sales') {
    stats.push(h('div', { class: 'stat' }, h('small', {}, 'مبيعاتي هذا الشهر'), h('b', {}, money(sum(L('sales').filter(s => s.by === CUR.id && s.date >= monthStart()), s => s.total)))));
  }
  el.append(h('div', { class: 'grid2' }, stats), h('div', { style: 'height:10px' }));
  const q = [];
  if (isAdmin() || CUR.role === 'cutter') q.push(['➕ بلوك جديد', () => blockForm()], ['⚙️ تسجيل تقطيع', () => jobForm()]);
  if (isAdmin() || CUR.role === 'sales') q.push(['🧾 فاتورة بيع', () => saleForm()]);
  if (isAdmin()) q.push(['💸 مصروف', () => expenseForm()]);
  q.push(['📷 مسح QR', () => scanScreen()]);
  el.append(h('div', { class: 'btns' }, q.map(([t, f]) => h('button', { class: 'btn', onclick: f }, t))));
  const recent = L('blocks').filter(b => b.status === 'raw').slice(-3).reverse();
  if (recent.length) { el.append(h('h3', {}, 'آخر البلوكات الخام')); recent.forEach(b => el.append(blockItem(b))); }
  return el;
}

// ---------- المزيد ----------
function screenMore() {
  const items = [['📷', 'مسح QR لبلوك/لوح', () => scanScreen()]];
  if (isAdmin() || CUR.role === 'sales') items.push(['👥', 'العملاء والموردين', () => go('العملاء والموردين', screenParties)]);
  if (isAdmin()) items.push(['💸', 'المصروفات', () => go('المصروفات', screenExpenses)], ['📊', 'التقارير والحسابات', () => go('التقارير والحسابات', screenReports)],
    ['⚙️', 'عمليات التقطيع', () => go('عمليات التقطيع', screenJobs)], ['👤', 'المستخدمين', () => go('المستخدمين', screenUsers)]);
  items.push(['🔄', 'المزامنة والنسخ الاحتياطي', () => go('المزامنة', screenSync)]);
  items.push(['🚪', 'تسجيل الخروج', logout]);
  return h('div', {}, items.map(([i, t, f]) => h('div', { class: 'item', onclick: f }, h('span', { style: 'font-size:24px' }, i), h('b', { class: 'grow' }, t), '‹')),
    h('p', { class: 'sub', style: 'text-align:center;color:#888' }, 'رمز الجهاز: ' + S.meta.dev + ' — الإصدار 1.0'));
}

// ---------- المستخدمين ----------
function screenUsers() {
  const el = h('div', {});
  L('users').forEach(u => el.append(listItem(u.name, ROLES[u.role], u.active === false ? badge('موقوف', 'bad') : null, () => userForm(u))));
  el.append(fab('+ مستخدم', () => userForm()));
  return el;
}
function userForm(u) {
  const name = inp({ value: u ? u.name : '' }), role = sel(Object.entries(ROLES), u ? u.role : 'cutter'), pin = numInp({ type: 'password', inputmode: 'numeric', placeholder: u ? 'اتركه فارغًا بدون تغيير' : '4 أرقام على الأقل' });
  const active = sel([['1', 'نشط'], ['0', 'موقوف']], u && u.active === false ? '0' : '1');
  modal(u ? 'تعديل مستخدم' : 'مستخدم جديد', h('div', {}, field('الاسم', name), field('الصلاحية', role), field('الرقم السري', pin), field('الحالة', active)), [
    { t: 'حفظ', fn: async () => {
      if (!name.value.trim()) { toast('الاسم مطلوب', true); return false; }
      if (!u && pin.value.length < 4) { toast('الرقم السري 4 أرقام على الأقل', true); return false; }
      if (pin.value && pin.value.length < 4) { toast('الرقم السري 4 أرقام على الأقل', true); return false; }
      if (u && u.id === CUR.id && (role.value !== 'admin' || active.value === '0')) { toast('لا يمكنك تقييد حسابك الحالي', true); return false; }
      const p = { name: name.value.trim(), role: role.value, active: active.value === '1' };
      if (pin.value) p.pin = await sha(pin.value);
      if (u) edit('users', u.id, p); else add('users', p);
      refresh();
    } }]);
}

// ---------- المزامنة ----------
function screenSync() {
  const el = h('div', {});
  el.append(h('div', { class: 'note' }, 'التطبيق يعمل بدون إنترنت. لتبادل البيانات بين الأجهزة: صدّر ملف مزامنة وأرسله (واتساب / بلوتوث / كابل) ثم افتحه على الجهاز الآخر من "استيراد". الدمج يعتمد على آخر تعديل لكل سجل ولا يحذف شيئًا.'));
  el.append(card(h('h3', {}, 'تصدير'), h('button', { class: 'btn block', onclick: async () => {
    S.meta.lastExport = new Date().toLocaleString('ar-EG'); persist('meta');
    await saveShare(`sync-${S.meta.dev}-${today()}.json`, 'application/json', { text: JSON.stringify(exportAll()) }); refresh();
  } }, '📤 تصدير ملف مزامنة / نسخة احتياطية'), h('p', { class: 'sub' }, S.meta.lastExport ? 'آخر تصدير: ' + S.meta.lastExport : 'لم يتم التصدير بعد')));
  el.append(card(h('h3', {}, 'استيراد'), h('button', { class: 'btn acc block', onclick: () => importDialog(() => refresh()) }, '📥 استيراد ملف مزامنة')));
  el.append(card(h('h3', {}, 'إحصائيات'), kv('بلوكات', L('blocks').length), kv('ألواح', L('slabs').length), kv('فواتير', L('sales').length), kv('مصروفات', L('expenses').length)));
  return el;
}
function importDialog(done) {
  const f = h('input', { type: 'file', accept: '.json,application/json,text/plain' });
  const ta = h('textarea', { rows: 3, placeholder: 'أو الصق محتوى الملف هنا' });
  const run = async txt => {
    try {
      const st = mergeIn(JSON.parse(txt)); await dbFlush();
      if (CUR) { const u = get('users', CUR.id); if (u) CUR = u; }
      toast(`تم الدمج: جديد ${st.added} — محدّث ${st.updated} — بدون تغيير ${st.same}`); done && done();
    } catch (e) { toast('فشل الاستيراد: ' + e.message, true); return false; }
  };
  modal('استيراد ملف مزامنة', h('div', {}, field('اختر الملف', f), ta), [{ t: 'استيراد', fn: async () => {
    if (f.files[0]) return run(await f.files[0].text());
    if (ta.value.trim()) return run(ta.value);
    toast('اختر ملفًا أولًا', true); return false;
  } }]);
}

// ---------- مسح QR ----------
function scanScreen() {
  scanner(text => {
    const r = resolveCode(text);
    if (!r) { toast('الكود غير موجود في هذا الجهاز — جرّب المزامنة أولًا', true); return false; }
    r.kind === 'slab' ? slabView(r.rec.id) : blockView(r.rec.id);
  });
}
