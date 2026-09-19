'use strict';

// ── إعدادات وبيانات الحالة ──
let TARGET_HOST = localStorage.getItem('ichadmin.targetHost') || 'https://ichance.vercel.app';
let GATE_TOKEN = localStorage.getItem('ichadmin.gateToken') || '6a546f34f797ed19196b0d9392ae8979';
let CURRENT_GENERATED_KEY = '';

const el = (id) => document.getElementById(id);

// ── إشعار توست سريع ──
function toast(message, duration = 3000) {
  const t = el('toast');
  t.textContent = message;
  t.hidden = false;
  setTimeout(() => { t.hidden = true; }, duration);
}

// ── تحديث الروابط السريعة بناءً على الخادم المستهدف ──
function updateQuickLinks() {
  const base = TARGET_HOST.replace(/\/+$/, '');
  el('linkAdmin').href = `${base}/admin`;
  el('linkCashier').href = `${base}/cashier`;
  el('linkMainSite').href = `${base}/`;
}

// ── فحص حالة الخادم الهدف ──
async function checkServerHealth() {
  const dot = el('serverStatusDot');
  const txt = el('serverStatusText');
  const meta = el('serverMetaBox');
  
  dot.className = 'status-indicator status--checking';
  txt.textContent = 'جارٍ التحقق من الخادم...';
  
  const startTime = performance.now();
  const base = TARGET_HOST.replace(/\/+$/, '');

  try {
    const res = await fetch(`${base}/api/state`, { cache: 'no-store' });
    const latency = Math.round(performance.now() - startTime);

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      dot.className = 'status-indicator status--online';
      txt.textContent = `متصل بالخادم (${latency}ms)`;
      meta.hidden = false;
      el('metaPingMs').textContent = `${latency}ms`;
      el('metaGamesCount').textContent = '3 ألعاب نشطة';
    } else {
      throw new Error(`حالة الخادم: ${res.status}`);
    }
  } catch (err) {
    dot.className = 'status-indicator status--offline';
    txt.textContent = 'تعذّر الاتصال بالخادم';
    meta.hidden = true;
  }
}

// ── استدعاء بوابة التوليد (مع دعم fallback إلى proxy عند الحاجة) ──
async function callGateApi(actionPath = '/api/admin/gate') {
  const base = TARGET_HOST.replace(/\/+$/, '');
  const gate = el('gateTokenInput').value.trim() || GATE_TOKEN;

  // المحاولة الأولى: اتصال مباشر
  try {
    const directRes = await fetch(`${base}${actionPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Gate': gate
      },
      body: JSON.stringify({})
    });

    const directData = await directRes.json().catch(() => null);
    if (directRes.ok && directData) {
      return directData;
    }
    if (directData && directData.error) {
      throw new Error(directData.error);
    }
  } catch (directErr) {
    console.warn('[Direct call failed, trying proxy]', directErr.message);
  }

  // المحاولة الثانية: عبر Vercel Serverless Function Proxy المحلي
  const hostParam = encodeURIComponent(base.replace(/^https?:\/\//, ''));
  const isPathRotate = actionPath.includes('path') ? '&path=path' : '';
  const proxyUrl = `/api/gate?host=${hostParam}&gate=${encodeURIComponent(gate)}${isPathRotate}`;

  const proxyRes = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  const proxyData = await proxyRes.json().catch(() => null);
  if (!proxyRes.ok || !proxyData) {
    throw new Error((proxyData && proxyData.error) || `فشل الاتصال: ${proxyRes.status}`);
  }
  return proxyData;
}

// ── توليد مفتاح الإدارة ──
async function generateAdminKey() {
  const btn = el('generateKeyBtn');
  const resBox = el('keyResultBox');
  const errBox = el('errorBox');

  btn.disabled = true;
  btn.innerHTML = '<span class="btn-icon">⏳</span><span>جارٍ التوليد والمصادقة...</span>';
  resBox.hidden = true;
  errBox.hidden = true;

  try {
    const result = await callGateApi('/api/admin/gate');
    if (!result || !result.key) {
      throw new Error((result && result.error) || 'لم يرجع الخادم مفتاحاً صالحاً');
    }

    CURRENT_GENERATED_KEY = result.key;
    el('generatedKeyVal').textContent = result.key;
    resBox.hidden = false;

    // حفظ في الذاكرة المحلية لتسهيل الدخول
    try {
      localStorage.setItem('ichance.adminKey', result.key);
    } catch (e) {}

    toast('🎉 تم توليد المفتاح بنجاح!');
  } catch (err) {
    errBox.textContent = `❌ خطأ في التوليد: ${err.message}`;
    errBox.hidden = false;
    toast(`خطأ: ${err.message}`, 4000);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">⚡</span><span>توليد مفتاح الإدارة الآن</span>';
  }
}

// ── نسخ المفتاح إلى الحافظة ──
async function copyKeyToClipboard() {
  if (!CURRENT_GENERATED_KEY) return;
  try {
    await navigator.clipboard.writeText(CURRENT_GENERATED_KEY);
    el('copyKeyIcon').textContent = '✔️';
    el('copyKeyText').textContent = 'تم النسخ!';
    toast('📋 تم نسخ مفتاح الإدارة بنجاح!');
    setTimeout(() => {
      el('copyKeyIcon').textContent = '📋';
      el('copyKeyText').textContent = 'نسخ المفتاح';
    }, 2000);
  } catch {
    toast('تعذّر النسخ تلقائياً — انسخه يدوياً');
  }
}

// ── نسخ رمز البوابة ──
async function copyGateToken() {
  const val = el('gateTokenInput').value.trim();
  if (!val) return;
  try {
    await navigator.clipboard.writeText(val);
    toast('📋 تم نسخ رمز البوابة!');
  } catch {}
}

// ── فتح لوحة الإدارة مباشرة مع المفتاح ──
function launchAdminPanel() {
  if (!CURRENT_GENERATED_KEY) return;
  const base = TARGET_HOST.replace(/\/+$/, '');
  const gate = el('gateTokenInput').value.trim() || GATE_TOKEN;
  
  const adminUrl = `${base}/admin?gate=${encodeURIComponent(gate)}&key=${encodeURIComponent(CURRENT_GENERATED_KEY)}`;
  window.open(adminUrl, '_blank');
}

// ── تدوير رمز البوابة ──
async function rotateGateToken() {
  if (!confirm('هل أنت متأكد من رغبتك بتغيير رمز البوابة السرية؟ سيتعطل الرمز القديم فوراً.')) return;
  const btn = el('rotateGateBtn');
  btn.disabled = true;

  try {
    const result = await callGateApi('/api/admin/gate/path');
    if (result && result.path) {
      el('gateTokenInput').value = result.path;
      GATE_TOKEN = result.path;
      localStorage.setItem('ichadmin.gateToken', result.path);
      toast('🔒 تم تدوير رمز البوابة بنجاح! احفظ الرمز الجديد.');
    }
  } catch (err) {
    toast(`فشل تدوير البوابة: ${err.message}`, 4000);
  } finally {
    btn.disabled = false;
  }
}

// ── تهيئة الأحداث عند تحميل الصفحة ──
document.addEventListener('DOMContentLoaded', () => {
  el('targetHostInput').value = TARGET_HOST;
  el('gateTokenInput').value = GATE_TOKEN;

  updateQuickLinks();
  checkServerHealth();

  // أحداث العناصر
  el('targetHostInput').addEventListener('change', (e) => {
    let val = e.target.value.trim();
    if (!val.startsWith('http://') && !val.startsWith('https://')) {
      val = 'https://' + val;
    }
    TARGET_HOST = val;
    localStorage.setItem('ichadmin.targetHost', val);
    updateQuickLinks();
    checkServerHealth();
  });

  el('checkServerBtn').addEventListener('click', () => {
    checkServerHealth();
    toast('🔄 جرى فحص اتصال الخادم');
  });

  el('gateTokenInput').addEventListener('change', (e) => {
    GATE_TOKEN = e.target.value.trim();
    localStorage.setItem('ichadmin.gateToken', GATE_TOKEN);
  });

  el('copyGateBtn').addEventListener('click', copyGateToken);
  el('generateKeyBtn').addEventListener('click', generateAdminKey);
  el('copyGeneratedKeyBtn').addEventListener('click', copyKeyToClipboard);
  el('launchAdminBtn').addEventListener('click', launchAdminPanel);
  el('rotateGateBtn').addEventListener('click', rotateGateToken);
});
