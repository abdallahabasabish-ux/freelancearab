/* ============================================================
   courses.js — صفحة الكتالوج
   جلب واحد من Firestore → بحث وفلترة وترقيم كامل بالمتصفح
   (تكلفة مجانية + استجابة فورية بدون أي قراءات إضافية)
   ============================================================ */

import {
  fetchPublishedCourses, renderCourseCard, normalizeAr, escapeHtml
} from './courses-data.js';
import { onSentinelVisible } from './lazy.js';
import { initHeaderAuth } from './auth.js';

const $ = (s) => document.querySelector(s);

const grid         = $('#coursesGrid');
const emptyState   = $('#emptyState');
const errorState   = $('#errorState');
const sentinel     = $('#sentinel');
const resultsCount = $('#resultsCount');
const searchInput  = $('#searchInput');
const clearBtn     = $('#clearSearch');
const catSelect    = $('#categorySelect');

const BATCH = 6;
const state = { all: [], filtered: [], shown: 0, q: '', level: 'all', cat: 'all' };

initHeaderAuth();

/* ============ استعادة الفلاتر من الرابط (قابل للمشاركة) ============ */
const params = new URLSearchParams(location.search);
state.q     = params.get('q') || '';
state.level = params.get('level') || 'all';
state.cat   = params.get('cat') || 'all';

searchInput.value = state.q;
clearBtn.hidden = !state.q;
document.querySelectorAll('#levelChips .chip').forEach((ch) =>
  ch.classList.toggle('active', ch.dataset.level === state.level));

function syncURL() {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  if (state.level !== 'all') p.set('level', state.level);
  if (state.cat !== 'all') p.set('cat', state.cat);
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

/* ============ الأحداث ============ */
let debounceTimer;
searchInput.addEventListener('input', () => {
  clearBtn.hidden = !searchInput.value;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    state.q = searchInput.value;
    applyFilters(); syncURL();
  }, 250);
});

clearBtn.addEventListener('click', () => {
  searchInput.value = '';
  state.q = '';
  clearBtn.hidden = true;
  applyFilters(); syncURL();
  searchInput.focus();
});

 $('#levelChips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('#levelChips .chip').forEach((c) => c.classList.remove('active'));
  chip.classList.add('active');
  state.level = chip.dataset.level;
  applyFilters(); syncURL();
});

catSelect.addEventListener('change', () => {
  state.cat = catSelect.value;
  applyFilters(); syncURL();
});

 $('#clearFilters').addEventListener('click', () => {
  state.q = ''; state.level = 'all'; state.cat = 'all';
  searchInput.value = ''; clearBtn.hidden = true;
  catSelect.value = 'all';
  document.querySelectorAll('#levelChips .chip').forEach((c) =>
    c.classList.toggle('active', c.dataset.level === 'all'));
  applyFilters(); syncURL();
});

 $('#retryBtn').addEventListener('click', () => location.reload());

/* التمرير اللانهائي: عند ظهور الحارس اعرض الدفعة التالية */
onSentinelVisible(sentinel, () => {
  if (state.shown < state.filtered.length) renderMore();
});

/* ============ التحميل ============ */
load();

async function load() {
  try {
    state.all = await fetchPublishedCourses();
    buildCategories();
    applyFilters();
  } catch (err) {
    console.error(err);
    grid.innerHTML = '';
    sentinel.hidden = true;
    errorState.hidden = false;
  }
}

function buildCategories() {
  const cats = [...new Set(state.all.map((c) => c.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'ar'));
  catSelect.innerHTML = '<option value="all">كل التصنيفات</option>' +
    cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

  if (state.cat !== 'all' && cats.includes(state.cat)) {
    catSelect.value = state.cat;
  } else {
    state.cat = 'all';
    catSelect.value = 'all';
  }
}

/* ============ الفلترة والعرض ============ */
function applyFilters() {
  const q = normalizeAr(state.q);

  state.filtered = state.all.filter((c) => {
    if (state.level !== 'all' && (c.level || '') !== state.level) return false;
    if (state.cat !== 'all' && (c.category || 'عام') !== state.cat) return false;
    if (q) {
      const hay = normalizeAr(`${c.title} ${c.shortDesc || ''} ${c.category || ''} ${c.instructor || ''}`);
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  grid.innerHTML = '';
  state.shown = 0;

  const hasResults = state.filtered.length > 0;
  emptyState.hidden = hasResults;
  sentinel.hidden = !hasResults || state.filtered.length <= BATCH;
  resultsCount.textContent = hasResults ? '' : '';

  if (!hasResults) {
    $('#emptyTitle').textContent = state.all.length ? 'لا توجد نتائج مطابقة' : 'لا توجد كورسات منشورة بعد';
    $('#emptyDesc').textContent  = state.all.length
      ? 'جرّب كلمات بحث أو فلاتر مختلفة.'
      : 'نعمل على تجهيز الكورسات — تابعنا قريباً!';
    $('#clearFilters').hidden = !state.all.length;
  }

  renderMore();
  updateCount();
}

function renderMore() {
  const next = state.filtered.slice(state.shown, state.shown + BATCH);
  next.forEach((c) => grid.appendChild(renderCourseCard(c)));
  state.shown += next.length;
  sentinel.hidden = state.shown >= state.filtered.length;
  updateCount();
}

function updateCount() {
  resultsCount.textContent = state.filtered.length
    ? `عرض ${Math.min(state.shown, state.filtered.length)} من ${state.filtered.length} كورساً`
    : '';
}
