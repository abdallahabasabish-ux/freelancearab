// app.js
import { db, auth } from './firebase-config.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

const coursesContainer = document.getElementById('courses-container');

// 1. التحقق من صلاحية الوصول
onAuthStateChanged(auth, (user) => {
    if (user) {
        // المستخدم مسجل دخول، قم بتحميل الكورسات
        loadCourses();
    } else {
        // غير مسجل دخول، توجيهه لصفحة التسجيل
        alert("يجب عليك تسجيل الدخول أولاً لتصفح الكورسات.");
        window.location.href = "index.html";
    }
});

// 2. دالة جلب وعرض الكورسات
async function loadCourses() {
    try {
        // جلب الكورسات المنشورة فقط (status == 'published')
        const q = query(collection(db, "courses"), where("status", "==", "published"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            coursesContainer.innerHTML = '<div class="loading-text">لا توجد كورسات متاحة حالياً. سيتم إضافة محتوى قريباً!</div>';
            return;
        }

        coursesContainer.innerHTML = ''; // تفريغ رسالة التحميل

        querySnapshot.forEach((doc) => {
            const course = doc.data();
            const courseId = doc.id;

            // إنشاء كرت الكورس
            const card = document.createElement('div');
            card.className = 'course-card';
            
            // استخدام loading="lazy" لتحميل الصورة فقط عند وصول المستخدم إليها
            card.innerHTML = `
                <img src="${course.thumbnailUrl || 'https://via.placeholder.com/400x225?text=Course+Thumbnail'}" alt="صورة ${course.title}" loading="lazy">
                <h3>${course.title}</h3>
                <p>${course.description}</p>
                <a href="lesson.html?courseId=${courseId}" class="btn btn-primary" style="width: 100%; text-align: center;">ابدأ التعلم</a>
            `;
            
            coursesContainer.appendChild(card);
        });

        // 3. تحديث الـ SEO ديناميكياً بناءً على محتوى الصفحة
        updateSEO("الكورسات المتاحة | أكاديمية عرب فريلانسر", "تصفح مجموعة من أفضل الكورسات التعليمية في مجالات العمل الحر.");

    } catch (error) {
        console.error("خطأ في جلب الكورسات:", error);
        coursesContainer.innerHTML = '<div class="loading-text" style="color: red;">حدث خطأ أثناء تحميل الكورسات. يرجى المحاولة لاحقاً.</div>';
    }
}

// دالة لتحديث Meta Tags
function updateSEO(title, description) {
    document.title = title;
    const metaDescription = document.getElementById('meta-description');
    if (metaDescription) {
        metaDescription.setAttribute('content', description);
    }
}
