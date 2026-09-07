// admin.js - إدارة الدورات (CRUD)

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ===== عناصر الصفحة =====
const authSection = document.getElementById('authSection');
const adminPanel = document.getElementById('adminPanel');
const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

const courseForm = document.getElementById('courseForm');
const formTitle = document.getElementById('formTitle');
const courseIdField = document.getElementById('courseId');
const titleField = document.getElementById('title');
const descriptionField = document.getElementById('description');
const imageField = document.getElementById('image');
const priceField = document.getElementById('price');
const durationField = document.getElementById('duration');
const lessonsField = document.getElementById('lessons');
const ratingField = document.getElementById('rating');
const instructorField = document.getElementById('instructor');
const languageField = document.getElementById('language');
const categoryField = document.getElementById('category');
const submitBtn = document.getElementById('submitBtn');

const coursesList = document.getElementById('coursesList');

// ===== المصادقة =====
auth.onAuthStateChanged(user => {
  if (user) {
    authSection.style.display = 'none';
    adminPanel.style.display = 'block';
    loadCoursesForAdmin();
  } else {
    authSection.style.display = 'block';
    adminPanel.style.display = 'none';
  }
});

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const email = loginEmail.value.trim();
  const password = loginPassword.value.trim();

  auth.signInWithEmailAndPassword(email, password)
    .catch(error => {
      loginError.textContent = '❌ ' + error.message;
    });
});

logoutBtn.addEventListener('click', () => {
  auth.signOut();
});

// ===== إضافة / تعديل دورة =====
courseForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = {
    title: titleField.value.trim(),
    description: descriptionField.value.trim(),
    image: imageField.value.trim() || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=300&fit=crop',
    price: parseFloat(priceField.value) || 0,
    duration: durationField.value.trim() || '0:00',
    lessons: parseInt(lessonsField.value) || 0,
    rating: parseFloat(ratingField.value) || 0,
    instructor: instructorField.value.trim() || 'مدرب معتمد',
    language: languageField.value.trim() || 'عربي',
    category: categoryField.value.trim() || 'عام'
  };

  const id = courseIdField.value;

  try {
    if (id) {
      // تحديث
      await db.collection('courses').doc(id).update(data);
      alert('✅ تم تحديث الدورة بنجاح!');
    } else {
      // إضافة جديدة
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('courses').add(data);
      alert('✅ تم إضافة الدورة بنجاح!');
    }
    courseForm.reset();
    courseIdField.value = '';
    formTitle.textContent = 'إضافة دورة جديدة';
    submitBtn.textContent = 'إضافة الدورة';
    loadCoursesForAdmin();
  } catch (error) {
    alert('❌ حدث خطأ: ' + error.message);
  }
});

// ===== تحميل الدورات للوحة التحكم =====
async function loadCoursesForAdmin() {
  try {
    const snapshot = await db.collection('courses')
      .orderBy('createdAt', 'desc')
      .get();

    if (snapshot.empty) {
      coursesList.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;">لا توجد دورات حالياً</td></tr>';
      return;
    }

    let html = '';
    snapshot.forEach(doc => {
      const c = doc.data();
      html += `
        <tr>
          <td>${c.title || 'بدون عنوان'}</td>
          <td>${c.instructor || '-'}</td>
          <td>${c.price || 0} $</td>
          <td>
            <button class="btn-edit" onclick="editCourse('${doc.id}')">✏️ تعديل</button>
            <button class="btn-delete" onclick="deleteCourse('${doc.id}')">🗑️ حذف</button>
          </td>
        </tr>
      `;
    });
    coursesList.innerHTML = html;

  } catch (error) {
    coursesList.innerHTML = `<tr><td colspan="5" style="text-align:center;color:red;">خطأ: ${error.message}</td></tr>`;
  }
}

// ===== تعديل دورة =====
window.editCourse = async function(id) {
  try {
    const doc = await db.collection('courses').doc(id).get();
    if (!doc.exists) return;

    const c = doc.data();
    courseIdField.value = id;
    titleField.value = c.title || '';
    descriptionField.value = c.description || '';
    imageField.value = c.image || '';
    priceField.value = c.price || '';
    durationField.value = c.duration || '';
    lessonsField.value = c.lessons || '';
    ratingField.value = c.rating || '';
    instructorField.value = c.instructor || '';
    languageField.value = c.language || '';
    categoryField.value = c.category || '';

    formTitle.textContent = 'تعديل الدورة';
    submitBtn.textContent = 'تحديث الدورة';

    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (error) {
    alert('❌ حدث خطأ: ' + error.message);
  }
};

// ===== حذف دورة =====
window.deleteCourse = async function(id) {
  if (!confirm('هل أنت متأكد من حذف هذه الدورة؟')) return;

  try {
    await db.collection('courses').doc(id).delete();
    alert('✅ تم الحذف بنجاح!');
    loadCoursesForAdmin();
  } catch (error) {
    alert('❌ حدث خطأ: ' + error.message);
  }
};

// ===== زر إلغاء التعديل =====
document.getElementById('cancelEdit')?.addEventListener('click', () => {
  courseForm.reset();
  courseIdField.value = '';
  formTitle.textContent = 'إضافة دورة جديدة';
  submitBtn.textContent = 'إضافة الدورة';
});
