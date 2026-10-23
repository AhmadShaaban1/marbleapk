'use strict';
(async function boot() {
  try { await dbLoad(); } catch (e) { document.body.prepend(h('div', { class: 'toast bad' }, 'تعذر فتح قاعدة البيانات: ' + e.message)); }
  $('#backBtn').addEventListener('click', () => back());
  const app = PLG('App');
  if (app) app.addListener('backButton', () => {
    if (document.querySelector('.overlay')) { document.querySelector('.overlay').remove(); return; }
    if (!back()) { if (CUR && NAV.stack[0] && NAV.stack[0].opts.tab !== 'home') openTab('home'); else app.exitApp(); }
  });
  window.addEventListener('error', e => console.error(e.message));
  showAuth();
})();
