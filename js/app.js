// app.js - عرض البيانات من Firestore

// إعدادات Firebase (انسخها من Firebase Console)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// تهيئة Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ===== عرض الدورات من Firestore =====
const coursesGrid = document.getElementById('coursesGrid');

async function loadCourses() {
  try {
    const snapshot = await db.collection('courses')
      .orderBy('createdAt', 'desc')
      .get();

    if (snapshot.empty) {
      coursesGrid.innerHTML = `
        <div style="text-align:center;padding:3rem;color:var(--text-secondary);grid-column:1/-1;">
          <h3>🚀 لا توجد دورات حالياً</h3>
          <p>سيتم إضافة دورات قريباً. تابعنا!</p>
        </div>
      `;
      return;
    }

    let html = '';
    snapshot.forEach(doc => {
      const c = doc.data();
      const id = doc.id;

      // توليد النجوم
      let stars = '';
      const fullStars = Math.floor(c.rating || 0);
      const hasHalf = (c.rating || 0) % 1 >= 0.5;
      for (let i = 0; i < 5; i++) {
        if (i < fullStars) {
          stars += `<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
        } else if (i === fullStars && hasHalf) {
          stars += `<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" style="clip-path: inset(0 50% 0 0); fill: var(--accent);"/></svg>`;
        } else {
          stars += `<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" class="star-empty"/></svg>`;
        }
      }

      html += `
        <div class="course-card">
          <div class="course-cover">
            <img src="${c.image || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=300&fit=crop'}" alt="${c.title}" />
            <span class="lang-badge">${c.language || 'عربي'}</span>
            <div class="instructor-badge">
              <svg viewBox="0 0 24 24"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10z"/><path d="M21 21v-2a7 7 0 0 0-14 0v2"/></svg>
              ${c.instructor || 'مدرب معتمد'}
            </div>
          </div>
          <div class="course-body">
            <h4>${c.title}</h4>
            <div class="meta-row">
              <span><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${c.duration || '0:00'}</span>
              <span><svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg> ${c.lessons || 0} درس</span>
            </div>
            <div class="rating">${stars}</div>
          </div>
        </div>
      `;
    });

    coursesGrid.innerHTML = html;

  } catch (error) {
    console.error("خطأ في تحميل الدورات:", error);
    coursesGrid.innerHTML = `
      <div style="text-align:center;padding:3rem;color:red;grid-column:1/-1;">
        <h3>⚠️ حدث خطأ أثناء تحميل الدورات</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
}

// ===== وظيفة البحث =====
const searchInput = document.getElementById('searchInput');
let searchTimeout;

searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const query = e.target.value.trim().toLowerCase();

  searchTimeout = setTimeout(() => {
    const cards = document.querySelectorAll('.course-card');
    let found = false;

    cards.forEach(card => {
      const title = card.querySelector('h4')?.textContent?.toLowerCase() || '';
      const match = title.includes(query);
      card.style.display = match ? '' : 'none';
      if (match) found = true;
    });

    // عرض رسالة إذا لم يتم العثور على نتائج
    const noResult = document.getElementById('noResult');
    if (!found && cards.length > 0) {
      if (!noResult) {
        const msg = document.createElement('div');
        msg.id = 'noResult';
        msg.style.cssText = 'text-align:center;padding:2rem;grid-column:1/-1;color:var(--text-secondary);';
        msg.innerHTML = '<h4>🔍 لا توجد نتائج مطابقة</h4>';
        coursesGrid.appendChild(msg);
      }
    } else {
      if (noResult) noResult.remove();
    }
  }, 300);
});

// ===== تبديل الوضع (Dark/Light) =====
const toggleBtn = document.getElementById('themeToggle');
const icon = document.getElementById('themeIcon');
const currentTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', currentTheme);
updateIcon(currentTheme);

toggleBtn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateIcon(next);
});

function updateIcon(theme) {
  if (theme === 'dark') {
    icon.innerHTML = `<path d="M12 3a6 6 0 0 0 9 9 6 6 0 1 1-9-9Z"/>`;
  } else {
    icon.innerHTML = `<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`;
  }
}

// ===== تحميل البيانات عند بدء الصفحة =====
document.addEventListener('DOMContentLoaded', loadCourses);
