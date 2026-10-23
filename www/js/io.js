'use strict';
// حفظ/مشاركة الملفات + تصدير Excel/PDF + QR + مسح الكاميرا
const CAP = () => window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
const PLG = n => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[n];

async function saveShare(filename, mime, { text, base64 }) {
  if (CAP() && PLG('Filesystem') && PLG('Share')) {
    try {
      const w = await PLG('Filesystem').writeFile(text != null ? { path: filename, data: text, directory: 'CACHE', encoding: 'utf8' } : { path: filename, data: base64, directory: 'CACHE' });
      await PLG('Share').share({ title: filename, url: w.uri, dialogTitle: 'مشاركة / حفظ' });
      return true;
    } catch (e) { if (String(e.message || e).toLowerCase().includes('cancel')) return false; toast('تعذر المشاركة: ' + (e.message || e), true); return false; }
  }
  const blob = text != null ? new Blob([text], { type: mime }) : new Blob([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], { type: mime });
  const a = h('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  return true;
}

// sheets: [{name, rows:[[...]]}]
async function exportXLSX(sheets, filename) {
  const wb = XLSX.utils.book_new();
  sheets.forEach((s, i) => {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    ws['!cols'] = (s.rows[0] || []).map((_, ci) => ({ wch: Math.min(40, Math.max(10, ...s.rows.map(r => String(r[ci] == null ? '' : r[ci]).length + 2))) }));
    XLSX.utils.book_append_sheet(wb, ws, (s.name || 'Sheet' + (i + 1)).replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31));
  });
  wb.Workbook = { Views: [{ RTL: true }] };
  const b64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  return saveShare(filename + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', { base64: b64 });
}

async function elToPdfBase64(el) {
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pw = 210, ph = 297, imgH = canvas.height * pw / canvas.width;
  const pagePx = Math.floor(canvas.width * ph / pw);
  let y = 0, first = true;
  while (y < canvas.height) {
    const hh = Math.min(pagePx, canvas.height - y);
    const c = document.createElement('canvas'); c.width = canvas.width; c.height = hh;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, hh); g.drawImage(canvas, 0, y, canvas.width, hh, 0, 0, canvas.width, hh);
    if (!first) pdf.addPage();
    pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pw, hh * pw / canvas.width);
    y += hh; first = false;
  }
  return pdf.output('datauristring').split(',')[1];
}
async function exportPDF(el, filename) {
  try {
    toast('جاري تجهيز PDF...');
    const b64 = await elToPdfBase64(el);
    return saveShare(filename + '.pdf', 'application/pdf', { base64: b64 });
  } catch (e) { toast('تعذر إنشاء PDF: ' + e.message, true); }
}

function qrImg(text, cell = 5) {
  const q = qrcode(0, 'M'); q.addData(text, 'Byte'); q.make();
  return q.createDataURL(cell, 2);
}
const qrSlab = s => `MRB|S|${s.code}`;
const qrBlock = b => `MRB|B|${b.code}`;

// ورقة ملصقات QR للطباعة (PDF)
async function labelsPdf(items, filename) {
  const wrap = h('div', { class: 'labels-sheet' }, items.map(it =>
    h('div', { class: 'label' }, h('img', { src: qrImg(it.qr, 6) }), h('div', { class: 'l1' }, it.l1), h('div', { class: 'l2' }, it.l2))));
  document.body.append(wrap);
  try { await sleep(100); return await exportPDF(wrap, filename); } finally { wrap.remove(); }
}

// ------- ماسح QR -------
function scanner(onCode, { continuous = false, hint = 'وجّه الكاميرا على كود QR' } = {}) {
  let stream, stop = false, last = '', lastT = 0;
  const video = h('video', { playsinline: true, muted: true, autoplay: true });
  const msg = h('div', { class: 'scan-msg' }, hint);
  const manual = inp({ placeholder: 'أو اكتب الكود يدويًا' });
  const close = () => { stop = true; if (stream) stream.getTracks().forEach(t => t.stop()); ov.remove(); };
  const ov = h('div', { class: 'overlay scan' }, h('div', { class: 'scan-box' }, video, h('div', { class: 'scan-frame' })), msg,
    h('div', { class: 'row', style: 'width:92%;max-width:420px' }, manual, h('button', { class: 'btn', onclick: () => { if (manual.value.trim()) handle(manual.value.trim()); } }, 'تم')),
    h('button', { class: 'btn danger', onclick: close }, 'إغلاق'));
  document.body.append(ov);
  function handle(text) {
    const now = Date.now(); if (text === last && now - lastT < 2500) return; last = text; lastT = now;
    const r = onCode(text.startsWith('MRB|') ? text : text);
    if (!continuous && r !== false) close(); else { msg.textContent = r === false ? '⚠ كود غير معروف' : '✓ تم: ' + text; }
  }
  (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      video.srcObject = stream; await video.play();
      const cv = document.createElement('canvas'), g = cv.getContext('2d', { willReadFrequently: true });
      const tick = () => {
        if (stop) return;
        if (video.readyState >= 2 && video.videoWidth) {
          const w = Math.min(640, video.videoWidth), hh = Math.round(w * video.videoHeight / video.videoWidth);
          cv.width = w; cv.height = hh; g.drawImage(video, 0, 0, w, hh);
          const r = jsQR(g.getImageData(0, 0, w, hh).data, w, hh, { inversionAttempts: 'attemptBoth' });
          if (r && r.data) handle(r.data);
        }
        setTimeout(tick, 120);
      };
      tick();
    } catch (e) { msg.textContent = 'لا يمكن تشغيل الكاميرا (' + (e.message || e) + ') — اكتب الكود يدويًا'; }
  })();
  return close;
}
// يحلل نص QR ويرجع {kind:'slab'|'block', rec}
function resolveCode(text) {
  const m = /^MRB\|([SB])\|(.+)$/.exec(text.trim());
  const code = m ? m[2] : text.trim();
  if (!m || m[1] === 'S') { const s = L('slabs').find(x => x.code === code); if (s) return { kind: 'slab', rec: s }; }
  if (!m || m[1] === 'B') { const b = L('blocks').find(x => x.code === code); if (b) return { kind: 'block', rec: b }; }
  return null;
}
