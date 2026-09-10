/* ============================================================
   freelanceARAB - app.js
   عرض الدورات من Firestore + التفاعلات
   ============================================================ */

// ====== إعدادات Firebase ======
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ====== متغيرات عامة ======
let allCourses = [];
let allCategories = [];

const coursesGrid = document.getElementById('coursesGrid');
const categoriesGrid = document.getElementById('categoriesGrid');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

// ====== أيقونات SVG مساعدة ======
const icons = {
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  play: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10z"/><path d="M21 21v-2a7 7 0 0 0-14 0v2"/></svg>`,
  star: `<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  starEmpty: `<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" class="star-empty"/></svg>`
};

// ====== توليد النجوم ======
function generateStars(rating) {
  let html = '';
  const full = Math.floor(rating);
  const hasHalf = (rating % 1) >= 0.5;
  for (let i = 0; i < 5; i++) {
    if (i < full) html += icons.star;
    else if (i === full && hasHalf) html += icons.star; // بسيط - يمكن تحسينه
    else html += icons.starEmpty;
  }
  return html;
}

// ====== تحميل الدورات ======
async function loadCourses() {
  try {
    const snapshot = await db.collection('courses')
      .orderBy('createdAt', 'desc')
      .get();

    allCourses = [];
    snapshot.forEach(doc => {
      allCourses.push({ id: doc.id, ...doc.data() });
    });

    // حفظ في الذاكرة المحلية للاستخدام لاحقاً
    localStorage.setItem('coursesCache', JSON.stringify(allCourses));

    if (allCourses.length === 0) {
      coursesGrid.innerHTML = `
        <div class="loading-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:80px;height:80px;stroke:var(--accent);opacity:0.5;">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <h3 style="margin:1rem 0 0.5rem;">🚀 لا توجد دورات حالياً</h3>
          <p>سيتم إضافة دورات جديدة قريباً. تابعنا للحصول على التحديثات!</p>
        </div>
      `;
      return;
    }

    renderCourses(allCourses);
    updateStats();
  } catch (error) {
    console.error('خطأ في تحميل الدورات:', error);
    coursesGrid.innerHTML = `
      <div class="loading-state">
        <h3 style="color:#dc2626;">⚠️ حدث خطأ أثناء التحميل</h3>
        <p>${error.message}</p>
        <p style="font-size:0.85rem;opacity:0.7;margin-top:1rem;">تأكد من إعدادات Firebase وقواعد الأمان.</p>
      </div>
    `;
  }
}

// ====== عرض الدورات ======
function renderCourses(courses) {
  if (courses.length === 0) {
    coursesGrid.innerHTML = `
      <div class="loading-state">
        <h3>🔍 لا توجد نتائج مطابقة</h3>
        <p>جرّب كلمة بحث أخرى</p>
      </div>
    `;
    return;
  }

  let html = '';
  courses.forEach(c => {
    const stars = generateStars(c.rating || 0);
    const image = c.image || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=300&fit=crop';
    const title = c.title || 'دورة بدون عنوان';
    const instructor = c.instructor || 'مدرب معتمد';
    const language = c.language || 'عربي';
    const duration = c.duration || '0:00';
    const lessons = c.lessons || 0;
    const price = c.price ? `$${c.price}` : 'مجاني';

    html += `
      <div class="course-card" data-id="${c.id}">
        <div class="course-cover">
          <img src="${image}" alt="${title}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=300&fit=crop'"/>
          <span class="lang-badge">${language}</span>
          <span class="price-badge">${price}</span>
          <div class="instructor-badge">
            ${icons.user}
            ${instructor}
          </div>
        </div>
        <div class="course-body">
          <h4>${title}</h4>
          <div class="meta-row">
            <span>${icons.clock} ${duration}</span>
            <span>${icons.play} ${lessons} درس</span>
          </div>
          <div class="rating">${stars}</div>
        </div>
      </div>
    `;
  });

  coursesGrid.innerHTML = html;
}

// ====== تحميل التصنيفات ======
async function loadCategories() {
  try {
    const snapshot = await db.collection('categories')
      .orderBy('order', 'asc')
      .get();

    allCategories = [];
    snapshot.forEach(doc => {
      allCategories.push({ id: doc.id, ...doc.data() });
    });

    if (allCategories.length === 0) {
      renderDefaultCategories();
      return;
    }

    renderCategories(allCategories);
  } catch (error) {
    console.warn('لا توجد تصنيفات في Firestore، استخدام الافتراضية:', error.message);
    renderDefaultCategories();
  }
}

// ====== عرض التصنيفات من Firestore ======
function renderCategories(categories) {
  let html = '';
  categories.forEach(cat => {
    html += `
      <div class="category-card" data-category="${cat.name}">
        <div class="cover" style="background-image: url('${cat.image || ''}');">
          <div class="overlay">
            <div class="icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                ${cat.iconSvg || '<path d="M4 4h16v16H4z"/><polyline points="22,6 12,13 2,6"/>'}
              </svg>
            </div>
            <div class="cat-name">${cat.name}</div>
          </div>
        </div>
      </div>
    `;
  });
  categoriesGrid.innerHTML = html;
  attachCategoryFilters();
}

// ====== التصنيفات الافتراضية ======
function renderDefaultCategories() {
  const defaults = [
    { name: 'البرمجة', image: 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=400&h=300&fit=crop', icon: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>' },
    { name: 'التصميم', image: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&h=300&fit=crop', icon: '<rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="8" y1="2" x2="8" y2="22"/><line x1="16" y1="2" x2="16" y2="22"/>' },
    { name: 'لغات', image: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&h=300&fit=crop', icon: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>' },
    { name: 'شبكات', image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=300&fit=crop', icon: '<circle cx="12" cy="4" r="2"/><circle cx="4" cy="20" r="2"/><circle cx="20" cy="20" r="2"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="4" y1="20" x2="20" y2="20"/>' },
    { name: 'أمن المعلومات', image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&h=300&fit=crop', icon: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>' },
    { name: 'قواعد بيانات', image: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=400&h=300&fit=crop', icon: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>' },
    { name: 'أنظمة تشغيل', image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&h=300&fit=crop', icon: '<rect x="4" y="4" width="16" height="16" rx="2"/><line x1="9" y1="4" x2="9" y2="20"/><line x1="15" y1="4" x2="15" y2="20"/>' },
    { name: 'تطوير الويب', image: 'https://images.unsplash.com/photo-1547658719-da2b51169166?w=400&h=300&fit=crop', icon: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>' }
  ];

  let html = '';
  defaults.forEach(cat => {
    html += `
      <div class="category-card" data-category="${cat.name}">
        <div class="cover" style="background-image: url('${cat.image}');">
          <div class="overlay">
            <div class="icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                ${cat.icon}
              </svg>
            </div>
            <div class="cat-name">${cat.name}</div>
          </div>
        </div>
      </div>
    `;
  });
  categoriesGrid.innerHTML = html;
  attachCategoryFilters();
}

// ====== فلترة حسب التصنيف ======
function attachCategoryFilters() {
  document.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', () => {
      const category = card.dataset.category;
      const filtered = allCourses.filter(c => 
        (c.category || '').trim() === category.trim()
      );
      renderCourses(filtered);
      document.getElementById('courses').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

// ====== تحديث الإحصائيات ======
function updateStats() {
  const coursesCount = allCourses.length;
  const lessonsCount = allCourses.reduce((sum, c) => sum + (parseInt(c.lessons) || 0), 0);
  const studentsCount = coursesCount * 520; // رقم تقديري
  const hoursCount = allCourses.reduce((sum, c) => {
    const parts = (c.duration || '0:0').split(':');
    return sum + (parseFloat(parts[0]) || 0);
  }, 0);

  animateNumber('statCourses', coursesCount);
  animateNumber('statStudents', studentsCount);
  animateNumber('statLessons', lessonsCount);
  animateNumber('statHours', Math.round(hoursCount));
}

// ====== تحريك الأرقام ======
function animateNumber(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const duration = 1500;
  const start = 0;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const current = Math.floor(start + (target - start) * progress);
    el.textContent = formatNumber(current);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function formatNumber(num) {
  if (num >= 1000) return (num / 1000).toFixed(1) + 'أ';
  return num.toString();
}

// ====== البحث ======
let searchTimeout;
function handleSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) {
      renderCourses(allCourses);
      return;
    }
    const filtered = allCourses.filter(c =>
      (c.title || '').toLowerCase().includes(query) ||
      (c.description || '').toLowerCase().includes(query) ||
      (c.instructor || '').toLowerCase().includes(query) ||
      (c.category || '').toLowerCase().includes(query)
    );
    renderCourses(filtered);
  }, 250);
}

searchInput?.addEventListener('input', handleSearch);
searchBtn?.addEventListener('click', handleSearch);

// ====== تبديل الوضع ======
const toggleBtn = document.getElementById('themeToggle');
const icon = document.getElementById('themeIcon');

function initTheme() {
  const theme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  updateIcon(theme);
}

function updateIcon(theme) {
  if (!icon) return;
  if (theme === 'dark') {
    icon.innerHTML = `<path d="M12 3a6 6 0 0 0 9 9 6 6 0 1 1-9-9Z"/>`;
  } else {
    icon.innerHTML = `
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    `;
  }
}

toggleBtn?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateIcon(next);
});

initTheme();

// ====== القائمة المحمولة ======
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const navLinks = document.getElementById('navLinks');

mobileMenuBtn?.addEventListener('click', () => {
  navLinks.classList.toggle('active');
});

navLinks?.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('active');
  });
});

// ====== زر العودة للأعلى ======
const scrollTopBtn = document.getElementById('scrollTop');

window.addEventListener('scroll', () => {
  if (window.scrollY > 400) {
    scrollTopBtn?.classList.add('visible');
  } else {
    scrollTopBtn?.classList.remove('visible');
  }
});

scrollTopBtn?.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ====== زر CTA ======
document.getElementById('ctaBtn')?.addEventListener('click', () => {
  document.getElementById('courses').scrollIntoView({ behavior: 'smooth' });
});

// ====== التشغيل عند البدء ======
document.addEventListener('DOMContentLoaded', () => {
  loadCategories();
  loadCourses();
});

console.log('🚀 freelanceARAB - الصفحة الرئيسية جاهزة');
