// lesson.js
import { db, auth } from './firebase-config.js';
import { doc, getDoc, collection, getDocs, query, orderBy, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

let currentUser = null;
let currentCourseId = null;
let currentLessonData = null;
let ytPlayer = null;

// 1. التحقق من المستخدم والحصول على Course ID من الرابط
const urlParams = new URLSearchParams(window.location.search);
currentCourseId = urlParams.get('courseId');

onAuthStateChanged(auth, (user) => {
    if (user && currentCourseId) {
        currentUser = user;
        loadCourseData();
    } else {
        window.location.href = "courses.html";
    }
});

// 2. تحميل بيانات الكورس وقائمة الدروس
async function loadCourseData() {
    try {
        const courseRef = doc(db, "courses", currentCourseId);
        const courseSnap = await getDoc(courseRef);

        if (!courseSnap.exists()) {
            alert("الكورس غير موجود.");
            return;
        }

        const courseData = courseSnap.data();
        document.getElementById('course-title').innerText = courseData.title;
        document.getElementById('page-title').innerText = `${courseData.title} | أكاديمية عرب فريلانسر`;

        // جلب الدروس (نفترض أنها مخزنة في Subcollection تسمى 'lessons' داخل الكورس)
        const lessonsRef = collection(db, "courses", currentCourseId, "lessons");
        const q = query(lessonsRef, orderBy("order", "asc")); // ترتيب الدروس
        const lessonsSnap = await getDocs(q);

        const lessonListEl = document.getElementById('lesson-list');
        lessonListEl.innerHTML = '';

        if (lessonsSnap.empty) {
            lessonListEl.innerHTML = '<li>لا توجد دروس حالياً</li>';
            return;
        }

        // جلب بيانات تقدم الطالب الحالية لمعرفة الدروس المكتملة
        const studentRef = doc(db, "students", currentUser.uid);
        const studentSnap = await getDoc(studentRef);
        const completedLessons = studentSnap.data().completedLessons || [];

        let isFirstLesson = true;

        lessonsSnap.forEach((docSnap) => {
            const lesson = docSnap.data();
            lesson.id = docSnap.id;

            const li = document.createElement('li');
            li.className = 'lesson-item';
            
            // علامة صح إذا كان مكتمل
            const isCompleted = completedLessons.includes(lesson.id) ? '✅ ' : '';
            li.innerHTML = `<span>${isCompleted}${lesson.title}</span>`;
            
            li.onclick = () => loadLessonContent(lesson, li);

            lessonListEl.appendChild(li);

            // تحميل أول درس تلقائياً
            if (isFirstLesson) {
                loadLessonContent(lesson, li);
                isFirstLesson = false;
            }
        });

    } catch (error) {
        console.error("خطأ:", error);
    }
}

// 3. عرض محتوى الدرس المحدد
function loadLessonContent(lesson, listItemElement) {
    currentLessonData = lesson;
    
    // تمييز الدرس النشط في القائمة
    document.querySelectorAll('.lesson-item').forEach(el => el.classList.remove('active'));
    if(listItemElement) listItemElement.classList.add('active');

    document.getElementById('lesson-title').innerText = lesson.title;
    document.getElementById('lesson-desc').innerText = lesson.description || '';

    // تحميل الفيديو باستخدام YouTube API
    loadYouTubeVideo(lesson.videoId);
    
    // تحميل الملاحظات الخاصة بهذا الدرس
    loadNotes(lesson.id);
}

// 4. إعداد YouTube Player
function loadYouTubeVideo(videoId) {
    if (ytPlayer) {
        ytPlayer.loadVideoById(videoId);
    } else {
        // سيتم استدعاؤها تلقائياً بواسطة مكتبة يوتيوب إذا لم تكن موجودة
        window.onYouTubeIframeAPIReady = () => {
            ytPlayer = new YT.Player('player', {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: { 'rel': 0 } // لمنع الفيديوهات المقترحة من قنوات أخرى
            });
        };
        // إذا كانت المكتبة محملة مسبقاً
        if(typeof YT !== 'undefined' && YT.Player) {
            window.onYouTubeIframeAPIReady();
        }
    }
}

// 5. حفظ التقدم (إكمال الدرس)
document.getElementById('mark-complete-btn').addEventListener('click', async () => {
    if(!currentLessonData) return;
    const btn = document.getElementById('mark-complete-btn');
    btn.disabled = true;
    btn.innerText = "جاري الحفظ...";

    try {
        const studentRef = doc(db, "students", currentUser.uid);
        // إضافة معرف الدرس لمصفوفة الدروس المكتملة في حساب الطالب
        await updateDoc(studentRef, {
            completedLessons: arrayUnion(currentLessonData.id),
            // إضافة نقاط للطالب (Gamification)
            points: arrayUnion({ lessonId: currentLessonData.id, points: 10 }) 
        });

        btn.innerText = "تم الإكمال بنجاح! +10 نقاط";
        btn.style.backgroundColor = "green";
        
        // تحديث القائمة لإظهار علامة الصح
        setTimeout(() => loadCourseData(), 1500);

    } catch (error) {
        console.error("خطأ في الحفظ:", error);
        btn.innerText = "خطأ في الحفظ";
        btn.disabled = false;
    }
});

// 6. نظام الملاحظات الزمنية (Timestamped Notes)
document.getElementById('save-note-btn').addEventListener('click', async () => {
    const noteText = document.getElementById('note-text').value;
    if (!noteText.trim() || !ytPlayer || !currentLessonData) return;

    // الحصول على الوقت الحالي للفيديو بالثواني
    const currentTime = Math.floor(ytPlayer.getCurrentTime());
    
    // تنسيق الوقت (مثال: 02:15)
    const minutes = Math.floor(currentTime / 60);
    const seconds = currentTime - minutes * 60;
    const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const newNote = {
        lessonId: currentLessonData.id,
        text: noteText,
        time: currentTime,
        timeStr: timeString,
        createdAt: new Date().toISOString()
    };

    try {
        const studentRef = doc(db, "students", currentUser.uid);
        // حفظ الملاحظة في مصفوفة الملاحظات داخل حساب الطالب
        await updateDoc(studentRef, {
            notes: arrayUnion(newNote)
        });

        document.getElementById('note-text').value = '';
        loadNotes(currentLessonData.id); // إعادة تحميل الملاحظات لعرض الجديدة
    } catch (error) {
        alert("حدث خطأ أثناء حفظ الملاحظة.");
    }
});

// تحميل وعرض الملاحظات
async function loadNotes(lessonId) {
    const notesListEl = document.getElementById('notes-list');
    notesListEl.innerHTML = '';

    const studentRef = doc(db, "students", currentUser.uid);
    const docSnap = await getDoc(studentRef);
    const allNotes = docSnap.data().notes || [];

    // فلترة الملاحظات الخاصة بهذا الدرس فقط
    const lessonNotes = allNotes.filter(n => n.lessonId === lessonId);

    if (lessonNotes.length === 0) {
        notesListEl.innerHTML = '<p style="color: var(--text-muted);">لا توجد ملاحظات لك في هذا الدرس.</p>';
        return;
    }

    lessonNotes.forEach(note => {
        const div = document.createElement('div');
        div.className = 'note-item';
        div.innerHTML = `
            <button class="timestamp-btn" onclick="seekVideo(${note.time})">⏱ ${note.timeStr}</button>
            <p style="margin-top: 0.5rem; white-space: pre-wrap;">${note.text}</p>
        `;
        notesListEl.appendChild(div);
    });
}

// دالة لجعل الأزرار الزمنية تقفز بالفيديو للوقت المحدد
window.seekVideo = function(seconds) {
    if (ytPlayer) {
        ytPlayer.seekTo(seconds, true);
        ytPlayer.playVideo();
        // التمرير لأعلى لرؤية الفيديو
        window.scrollTo({ top: 0, behavior: 'smooth' }); 
    }
};
