/* ============================================================
   admin-courses.js — CRUD الكورسات + محرر الفصول والدروس
   الحفظ: مستند الكورس (مع outline) + Batch لدروس subcollection
   معرفات الدروس ثابتة → روابط الطلاب لا تنكسر بعد التعديل
   ============================================================ */

import { db } from './firebase-config.js';
import {
  collection, getDocs, getDoc, setDoc, doc,
  writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { requireAdmin } from './admin-guard.js';
import { getYoutubeId, escapeHtml, LEVELS, durationText } from './courses-data.js';

const $ = (s) => document.querySelector(s);
const toast = (m, t) => window.AFA?.toast(m, t);
const esc = escapeHtml;

const ctx = await requireAdmin();
if (ctx) init();

/* ==================== الحالة ==================== */
const S = {
  courseId: null,           /* null = كورس جديد */
  modules: [],
  saving: false
};

const newId    = () => crypto.randomUUID();
const newModule = () => ({ _id: newId(), title: '', lessons: [] });
const newLesson = () => ({ _id: newId(), title: '', durationMin: '', videoURL: '', description: '', attachments: [], quizQuestions: [] });

async function commitInChunks(operations) {
  const batchSize = 450;
  for (let start = 0; start < operations.length; start += batchSize) {
    const batch = writeBatch(db);
    operations.slice(start, start + batchSize).forEach((operation) => operation(batch));
    await batch.commit();
  }
}

function defaultQuizQuestions() {
  return Array.from({ length: 4 }, (_, index) => {
    const type = index < 2 ? 'choice' : 'boolean';
    const options = type === 'boolean'
      ? [{ id: 'true', text: 'صح' }, { id: 'false', text: 'خطأ' }]
      : Array.from({ length: 4 }, (_, optionIndex) => ({ id: `option-${optionIndex + 1}`, text: '' }));
    return { id: newId(), type, prompt: '', options, correctOptionId: '' };
  });
}

function isQuizComplete(questions = []) {
  return questions.length === 4 && questions.every((question) =>
    typeof question.prompt === 'string' && question.prompt.trim() &&
    Array.isArray(question.options) && question.options.length >= 2 &&
    question.options.every((option) => typeof option.text === 'string' && option.text.trim()) &&
    question.options.some((option) => option.id === question.correctOptionId)
  );
}

async function init() {
  $('#newCourseBtn').addEventListener('click', () => openEditor(null));
  $('#newCourseBtn2').addEventListener('click', () => openEditor(null));
  $('#backToList').addEventListener('click', showList);
  $('#cancelEdit').addEventListener('click', showList);
  $('#addModuleBtn').addEventListener('click', () => {
    S.modules.push(newModule());
    renderBuilder();
  });

  $('#courseForm').addEventListener('submit', (e) => { e.preventDefault(); saveCourse(); });
  bindBuilderEvents();
  bindConfirm();
  await loadList();
  $('#adminSkeleton').hidden = true;
  $('#adminContent').hidden = false;
}

/* ==================== القائمة ==================== */
async function loadList() {
  try {
    const snap = await getDocs(collection(db, 'courses'));
    const courses = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));

    $('#coursesEmpty').hidden = courses.length > 0;
    $('#coursesList').innerHTML = courses.map((c) => {
      const published = c.status === 'published';
      const level = LEVELS[c.level]?.label || '—';
      return `
      <div class="row-card card">
        <div class="row-main">
          <span class="row-title">${esc(c.title)}</span>
          <span class="badge ${published ? 'badge-success' : 'badge-warning'}">${published ? 'منشور' : 'مسودة'}</span>
        </div>
        <div class="row-meta">
          <span><svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-play-circle"></use></svg>${c.lessonsCount || 0} درساً</span>
          <span><svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-target"></use></svg>${esc(level)}</span>
          <span><svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-book-open"></use></svg>${esc(c.category || 'عام')}</span>
          <span><svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-clock"></use></svg>${esc(durationText(c))}</span>
        </div>
        <div class="row-actions">
          <button type="button" class="btn btn-outline btn-sm" data-edit="${c.id}">
            <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-edit"></use></svg>
            تعديل
          </button>
          ${published ? `<a class="btn btn-ghost btn-sm" href="/course.html?id=${c.id}" target="_blank" rel="noopener">
            <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-eye"></use></svg>
            معاينة
          </a>` : ''}
          <button type="button" class="btn btn-ghost btn-sm" data-delete="${c.id}" style="color:var(--danger);">
            <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-trash"></use></svg>
            حذف
          </button>
        </div>
      </div>`;
    }).join('');
  } catch (err) {
    console.error(err);
    toast('تعذر تحميل الكورسات.', 'error');
  }
}

 $('#coursesList').addEventListener('click', (e) => {
  const editBtn = e.target.closest('[data-edit]');
  const delBtn  = e.target.closest('[data-delete]');
  if (editBtn) openEditor(editBtn.dataset.edit);
  if (delBtn)  askDeleteCourse(delBtn.dataset.delete);
});

/* ==================== المحرر: فتح ==================== */
async function openEditor(courseId) {
  S.courseId = courseId || null;
  $('#editorTitle').textContent = courseId ? 'تعديل الكورس' : 'كورس جديد';

  /* إعادة ضبط النموذج */
  ['fTitle','fShortDesc','fDesc','fCategory','fInstructor','fThumb','fPromo','fHours'].forEach((id) => ($('#' + id).value = ''));
  $('#fLevel').value = 'beginner';
  $('#fStatus').value = 'draft';
  S.modules = [newModule()];

  if (courseId) {
    try {
      const snap = await getDoc(doc(db, 'courses', courseId));
      if (!snap.exists()) return toast('الكورس غير موجود.', 'error');
      const c = snap.data();

      $('#fTitle').value       = c.title || '';
      $('#fShortDesc').value   = c.shortDesc || '';
      $('#fDesc').value        = c.description || '';
      $('#fLevel').value       = c.level || 'beginner';
      $('#fCategory').value    = c.category || '';
      $('#fInstructor').value  = c.instructor || '';
      $('#fThumb').value       = c.thumbnailURL || '';
      $('#fPromo').value       = c.promoVideoURL || '';
      $('#fHours').value       = c.durationHours || '';
      $('#fStatus').value      = c.status || 'draft';

      /* محتوى الدروس من subcollection */
      const ls = await getDocs(collection(db, 'courses', courseId, 'lessons'));
      const byId = new Map(ls.docs.map((d) => [d.id, d.data()]));
      const quizRows = await Promise.all(ls.docs.map(async (lessonDoc) => {
        const quizRef = doc(db, 'courses', courseId, 'lessons', lessonDoc.id, 'quiz', 'current');
        const keysRef = doc(db, 'courses', courseId, 'lessons', lessonDoc.id, 'answerKeys', 'current');
        const [quizSnap, keysSnap] = await Promise.all([getDoc(quizRef), getDoc(keysRef)]);
        const quizQuestions = quizSnap.exists() ? quizSnap.data().questions || [] : [];
        const correctAnswers = keysSnap.exists() ? keysSnap.data().correctByQuestionId || {} : {};
        return [lessonDoc.id, quizQuestions.map((question) => ({
          ...question,
          correctOptionId: correctAnswers[question.id] || ''
        }))];
      }));
      const quizById = new Map(quizRows);

      S.modules = (c.outline || []).map((m) => ({
        _id: m.id || newId(),
        title: m.title || '',
        lessons: (m.lessons || []).map((l) => {
          const full = byId.get(l.id) || {};
          return {
            _id: l.id,
            title: l.title || full.title || '',
            durationMin: (l.durationSec ?? full.durationSec ?? 0) / 60 || '',
            videoURL: full.videoURL || (full.videoId ? `https://youtu.be/${full.videoId}` : ''),
            description: full.description || '',
            attachments: (full.attachments || []).map((a) => ({ title: a.title || '', url: a.url || '' })),
            quizQuestions: quizById.get(l.id) || []
          };
        })
      }));
      if (!S.modules.length) S.modules = [newModule()];
    } catch (err) {
      console.error(err);
      return toast('تعذر تحميل بيانات الكورس.', 'error');
    }
  }

  $('#listView').hidden = true;
  $('#editorView').hidden = false;
  renderBuilder();
  window.scrollTo({ top: 0 });
}

function showList() {
  $('#editorView').hidden = true;
  $('#listView').hidden = false;
  loadList();
  window.scrollTo({ top: 0 });
}

/* ==================== محرر الفصول ==================== */
function renderBuilder() {
  const wrap = $('#modulesWrap');
  wrap.innerHTML = S.modules.map((m, mi) => `
    <div class="module-card" data-m="${mi}">
      <div class="module-head">
        <span class="module-num">${mi + 1}</span>
        <input class="input" data-f="mtitle" data-m="${mi}" value="${esc(m.title)}" placeholder="عنوان الفصل ${mi + 1}">
        <button type="button" class="icon-btn" data-act="del-module" data-m="${mi}" title="حذف الفصل" style="color:var(--danger);">
          <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-trash"></use></svg>
        </button>
      </div>
      <div class="module-lessons">
        ${m.lessons.map((l, li) => lessonHTML(l, mi, li)).join('') || '<p class="mini-empty">لا توجد دروس في هذا الفصل بعد.</p>'}
        <div>
          <button type="button" class="btn btn-outline btn-sm" data-act="add-lesson" data-m="${mi}">
            <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-plus"></use></svg>
            إضافة درس
          </button>
        </div>
      </div>
    </div>`).join('') || '<p class="mini-empty">اضغط "إضافة فصل" لبدء بناء المحتوى.</p>';
}

function lessonHTML(l, mi, li) {
  return `
  <div class="lesson-card" data-m="${mi}" data-l="${li}">
    <div class="lesson-row1">
      <input class="input" data-f="ltitle" data-m="${mi}" data-l="${li}" value="${esc(l.title)}" placeholder="عنوان الدرس">
      <input class="input l-dur" type="number" min="0" step="1" data-f="ldur" data-m="${mi}" data-l="${li}" value="${esc(String(l.durationMin ?? ''))}" placeholder="دقائق" title="مدة الفيديو بالدقائق">
      <button type="button" class="icon-btn" data-act="toggle-extra" title="تفاصيل الدرس">
        <svg class="icon chev" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-chevron-down"></use></svg>
      </button>
      <button type="button" class="icon-btn" data-act="del-lesson" data-m="${mi}" data-l="${li}" title="حذف الدرس" style="color:var(--danger);">
        <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-trash"></use></svg>
      </button>
    </div>
    <div class="lesson-extra" hidden>
      <div class="field">
        <label class="label">رابط فيديو يوتيوب</label>
        <input class="input" dir="ltr" data-f="lvideo" data-m="${mi}" data-l="${li}" value="${esc(l.videoURL)}" placeholder="https://www.youtube.com/watch?v=...">
      </div>
      <div class="field">
        <label class="label">وصف الدرس</label>
        <textarea class="textarea" rows="3" data-f="ldesc" data-m="${mi}" data-l="${li}">${esc(l.description)}</textarea>
      </div>
      <div class="field">
        <label class="label">مرفقات قابلة للتحميل</label>
        ${(l.attachments || []).map((a, ai) => attHTML(a, mi, li, ai)).join('')}
        <button type="button" class="btn btn-ghost btn-sm" data-act="add-att" data-m="${mi}" data-l="${li}">
          <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-plus"></use></svg>
          إضافة مرفق
        </button>
      </div>
      <div class="quiz-editor">
        <div class="quiz-editor-head">
          <strong>اختبار الحلقة · سؤالان اختيار وسؤالان صح/خطأ · النجاح من 50%</strong>
          ${l.quizQuestions?.length ? '' : `<button type="button" class="btn btn-outline btn-sm" data-act="add-quiz" data-m="${mi}" data-l="${li}">إنشاء الاختبار</button>`}
        </div>
        ${(l.quizQuestions || []).map((question, qi) => quizQuestionHTML(question, mi, li, qi)).join('')}
      </div>
    </div>
  </div>`;
}

function quizQuestionHTML(question, mi, li, qi) {
  const isBoolean = question.type === 'boolean';
  return `
  <div class="quiz-question">
    <label class="label" for="quiz-${mi}-${li}-${qi}">السؤال ${qi + 1}</label>
    <textarea class="textarea" id="quiz-${mi}-${li}-${qi}" rows="2" data-f="quiz-prompt" data-m="${mi}" data-l="${li}" data-q="${qi}" placeholder="اكتب نص السؤال">${esc(question.prompt || '')}</textarea>
    <div class="quiz-question-type">
      <select class="select" data-f="quiz-type" data-m="${mi}" data-l="${li}" data-q="${qi}" aria-label="نوع السؤال">
        <option value="choice" ${!isBoolean ? 'selected' : ''}>اختيار من متعدد</option>
        <option value="boolean" ${isBoolean ? 'selected' : ''}>صح أو خطأ</option>
      </select>
      <select class="select" data-f="quiz-correct" data-m="${mi}" data-l="${li}" data-q="${qi}" aria-label="الإجابة الصحيحة">
        <option value="">اختر الإجابة الصحيحة</option>
        ${(question.options || []).map((option) => `<option value="${esc(option.id)}" ${question.correctOptionId === option.id ? 'selected' : ''}>${esc(option.text || `خيار ${option.id.split('-').pop()}`)}</option>`).join('')}
      </select>
    </div>
    <div class="quiz-options">
      ${(question.options || []).map((option, oi) => isBoolean
        ? `<span class="quiz-boolean-option">${esc(option.text)}</span>`
        : `<input class="input" data-f="quiz-option" data-m="${mi}" data-l="${li}" data-q="${qi}" data-o="${oi}" value="${esc(option.text)}" placeholder="الخيار ${oi + 1}">`).join('')}
    </div>
  </div>`;
}

function attHTML(a, mi, li, ai) {
  return `
  <div class="att-row">
    <input class="input" data-f="att-title" data-m="${mi}" data-l="${li}" data-a="${ai}" value="${esc(a.title)}" placeholder="اسم الملف">
    <input class="input" dir="ltr" data-f="att-url" data-m="${mi}" data-l="${li}" data-a="${ai}" value="${esc(a.url)}" placeholder="https://رابط-التحميل">
    <button type="button" class="icon-btn" data-act="del-att" data-m="${mi}" data-l="${li}" data-a="${ai}" style="color:var(--danger);">
      <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-x"></use></svg>
    </button>
  </div>`;
}

/* ---------- أحداث البناء (تفويض) ---------- */
function bindBuilderEvents() {
  const wrap = $('#modulesWrap');

  wrap.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === 'toggle-extra') {
      const card = btn.closest('.lesson-card');
      const extra = card?.querySelector('.lesson-extra');
      if (!extra) {
        console.error('تعذر فتح تفاصيل الدرس: عنصر التفاصيل غير موجود.');
        return;
      }
      extra.hidden = !extra.hidden;
      card.classList.toggle('open', !extra.hidden);
      return;
    }

    const mi = btn.dataset.m !== undefined ? Number(btn.dataset.m) : -1;
    const li = btn.dataset.l !== undefined ? +btn.dataset.l : null;
    const ai = btn.dataset.a !== undefined ? +btn.dataset.a : null;
    const module = S.modules[mi];

    if (!Number.isInteger(mi) || !module) {
      console.error('تعذر تنفيذ إجراء محرر الكورس: مؤشر الفصل غير صالح.', {
        act, mi, availableModules: S.modules.length
      });
      return;
    }

    if (act === 'add-lesson')   { module.lessons.push(newLesson()); renderBuilder(); }
    else if (act === 'del-lesson' && Number.isInteger(li) && module.lessons[li])   { module.lessons.splice(li, 1); renderBuilder(); }
    else if (act === 'del-module')   { S.modules.splice(mi, 1); renderBuilder(); }
    else if (Number.isInteger(li) && module.lessons[li] && act === 'add-att') { module.lessons[li].attachments.push({ title: '', url: '' }); renderBuilder(); }
    else if (Number.isInteger(li) && module.lessons[li] && Number.isInteger(ai) && act === 'del-att') { module.lessons[li].attachments.splice(ai, 1); renderBuilder(); }
    else if (Number.isInteger(li) && module.lessons[li] && act === 'add-quiz') { module.lessons[li].quizQuestions = defaultQuizQuestions(); renderBuilder(); }
  });

  /* تحديث الحالة دون إعادة رسم (لا فقدان تركيز) */
  const updateField = (e) => {
    const el = e.target;
    const f = el.dataset.f;
    if (!f) return;
    const mi = +el.dataset.m;
    const li = el.dataset.l !== undefined ? +el.dataset.l : null;
    const ai = el.dataset.a !== undefined ? +el.dataset.a : null;
    const qi = el.dataset.q !== undefined ? +el.dataset.q : null;

    if (f === 'mtitle')        S.modules[mi].title = el.value;
    else if (f === 'ltitle')   S.modules[mi].lessons[li].title = el.value;
    else if (f === 'ldur')     S.modules[mi].lessons[li].durationMin = el.value;
    else if (f === 'lvideo')   S.modules[mi].lessons[li].videoURL = el.value;
    else if (f === 'ldesc')    S.modules[mi].lessons[li].description = el.value;
    else if (f === 'att-title') S.modules[mi].lessons[li].attachments[ai].title = el.value;
    else if (f === 'att-url')   S.modules[mi].lessons[li].attachments[ai].url = el.value;
    else if (f === 'quiz-prompt') S.modules[mi].lessons[li].quizQuestions[qi].prompt = el.value;
    else if (f === 'quiz-option') S.modules[mi].lessons[li].quizQuestions[qi].options[+el.dataset.o].text = el.value;
    else if (f === 'quiz-correct') S.modules[mi].lessons[li].quizQuestions[qi].correctOptionId = el.value;
    else if (f === 'quiz-type') {
      const question = S.modules[mi].lessons[li].quizQuestions[qi];
      question.type = el.value;
      question.options = el.value === 'boolean'
        ? [{ id: 'true', text: 'صح' }, { id: 'false', text: 'خطأ' }]
        : Array.from({ length: 4 }, (_, index) => ({ id: `option-${index + 1}`, text: '' }));
      question.correctOptionId = '';
      renderBuilder();
    }
  };
  wrap.addEventListener('input', updateField);
  wrap.addEventListener('change', updateField);
}

/* ==================== الحفظ ==================== */
async function saveCourse() {
  if (S.saving) return;
  const title = $('#fTitle').value.trim();
  if (!title) { toast('عنوان الكورس مطلوب.', 'warning'); $('#fTitle').focus(); return; }

  const status = $('#fStatus').value;
  const lessonsWithQuizzes = S.modules.flatMap((module) => module.lessons)
    .filter((lesson) => lesson.quizQuestions?.length);
  if (status === 'published' && lessonsWithQuizzes.some((lesson) => !isQuizComplete(lesson.quizQuestions))) {
    return toast('أكمل الأسئلة الأربعة وحدد الإجابة الصحيحة لكل سؤال قبل النشر.', 'warning');
  }
  const outline = S.modules.map((m, mi) => ({
    id: m._id,
    title: m.title.trim() || `الفصل ${mi + 1}`,
    lessons: m.lessons.map((l, li) => ({
      id: l._id,
      title: l.title.trim() || `درس ${li + 1}`,
      durationSec: Math.max(0, Math.round((+l.durationMin || 0) * 60))
    }))
  }));
  const lessonsCount = outline.reduce((n, m) => n + m.lessons.length, 0);

  const payload = {
    title,
    shortDesc: $('#fShortDesc').value.trim(),
    description: $('#fDesc').value.trim(),
    level: $('#fLevel').value,
    category: $('#fCategory').value.trim() || 'عام',
    instructor: $('#fInstructor').value.trim(),
    thumbnailURL: $('#fThumb').value.trim(),
    promoVideoURL: $('#fPromo').value.trim(),
    durationHours: +$('#fHours').value || 0,
    status,
    outline,
    lessonsCount,
    updatedAt: serverTimestamp()
  };

  S.saving = true;
  const btn = $('#saveBtn');
  btn.classList.add('loading');
  let saveStage = 'قراءة دروس الكورس الحالية';

  try {
    /* احتفظ بمعرف الكورس لاستخدامه عند إعادة المحاولة بعد فشل الحفظ */
    if (!S.courseId) {
      const ref = doc(collection(db, 'courses'));
      S.courseId = ref.id;
      payload.createdAt = serverTimestamp();
    }

    const existing = await getDocs(collection(db, 'courses', S.courseId, 'lessons'));
    const keep = new Set(S.modules.flatMap((m) => m.lessons.map((l) => l._id)));
    const operations = [];

    S.modules.forEach((m, mi) => {
      m.lessons.forEach((l, li) => {
        operations.push((batch) => batch.set(doc(db, 'courses', S.courseId, 'lessons', l._id), {
          moduleId: m._id,
          moduleTitle: m.title.trim() || `الفصل ${mi + 1}`,
          title: l.title.trim() || `درس ${li + 1}`,
          videoId: getYoutubeId(l.videoURL) || '',
          videoURL: (l.videoURL || '').trim(),
          description: (l.description || '').trim(),
          attachments: (l.attachments || [])
            .filter((a) => (a.url || '').trim())
            .map((a) => ({ title: (a.title || 'مرفق').trim(), url: a.url.trim() })),
          durationSec: Math.max(0, Math.round((+l.durationMin || 0) * 60)),
          order: li,
          isPublished: status === 'published',
          updatedAt: serverTimestamp()
        }, { merge: true }));

        const questions = l.quizQuestions || [];
        const quizRef = doc(db, 'courses', S.courseId, 'lessons', l._id, 'quiz', 'current');
        const keysRef = doc(db, 'courses', S.courseId, 'lessons', l._id, 'answerKeys', 'current');
        if (questions.length) {
          const version = newId();
          const complete = isQuizComplete(questions);
          operations.push((batch) => batch.set(quizRef, {
            version,
            enabled: status === 'published' && complete,
            passPercent: 50,
            questions: questions.map((question) => ({
              id: question.id,
              type: question.type,
              prompt: question.prompt.trim(),
              options: question.options.map((option) => ({ id: option.id, text: option.text.trim() }))
            })),
            updatedAt: serverTimestamp()
          }));
          operations.push((batch) => batch.set(keysRef, {
            version,
            correctByQuestionId: Object.fromEntries(questions
              .filter((question) => question.correctOptionId)
              .map((question) => [question.id, question.correctOptionId]))
          }));
        } else {
          operations.push((batch) => batch.delete(quizRef));
          operations.push((batch) => batch.delete(keysRef));
        }
      });
    });

    const removed = existing.docs.filter((d) => !keep.has(d.id));
    removed.forEach((lesson) => {
      operations.push((batch) => batch.delete(doc(db, 'courses', S.courseId, 'lessons', lesson.id, 'quiz', 'current')));
      operations.push((batch) => batch.delete(doc(db, 'courses', S.courseId, 'lessons', lesson.id, 'answerKeys', 'current')));
      operations.push((batch) => batch.delete(lesson.ref));
    });

    const courseRef = doc(db, 'courses', S.courseId);
    operations.push((batch) => batch.set(courseRef, payload, { merge: true }));
    saveStage = 'حفظ الكورس والدروس والاختبارات في Firestore';
    await commitInChunks(operations);

    const quizLessons = S.modules.flatMap((module) => module.lessons)
      .filter((lesson) => lesson.quizQuestions?.length);
    const quizNotice = quizLessons.length
      ? ` تم حفظ ${quizLessons.length} اختباراً في courses/${S.courseId}/lessons/${quizLessons[0]._id}/quiz/current (حقل questions).`
      : '';
    toast(`تم حفظ الكورس بنجاح ✅${quizNotice}`, 'success', 8000);
    showList();
  } catch (err) {
    console.error(`تعذر حفظ الكورس في المشروع freelance-arab للمدير ${ctx?.user?.uid || 'غير معروف'} أثناء ${saveStage}:`, err);
    const code = err?.code || 'unknown';
    const message = code === 'permission-denied'
      ? `رفضت قواعد Firestore الحفظ. تحقق من نشر firestore.rules على مشروع freelance-arab ومن وجود admins/${ctx?.user?.uid || '{UID حسابك}'}.`
      : 'تحقق من اتصال الإنترنت ثم حاول مجدداً.';
    toast(`تعذر الحفظ أثناء ${saveStage}. ${message} (${code})`, 'error');
  } finally {
    S.saving = false;
    btn.classList.remove('loading');
  }
}

/* ==================== حذف كورس ==================== */
function askDeleteCourse(id) {
  askConfirm(
    'حذف الكورس نهائياً؟',
    'سيُحذف الكورس وجميع دروسه ومرفقاته. تقدم الطلاب سيبقى في حساباتهم لكن الكورس سيختفي من المنصة.',
    'نعم، احذف نهائياً',
    async () => {
      try {
        const ls = await getDocs(collection(db, 'courses', id, 'lessons'));
        const operations = [];
        ls.docs.forEach((lesson) => {
          operations.push((batch) => batch.delete(doc(db, 'courses', id, 'lessons', lesson.id, 'quiz', 'current')));
          operations.push((batch) => batch.delete(doc(db, 'courses', id, 'lessons', lesson.id, 'answerKeys', 'current')));
          operations.push((batch) => batch.delete(lesson.ref));
        });
        operations.push((batch) => batch.delete(doc(db, 'courses', id)));
        await commitInChunks(operations);
        toast('تم حذف الكورس.', 'success');
        await loadList();
      } catch (err) {
        console.error(err);
        toast('تعذر الحذف.', 'error');
      }
    }
  );
}

/* ==================== نافذة تأكيد ==================== */
let confirmFn = null;
function askConfirm(title, text, yesLabel, fn) {
  $('#confirmTitle').textContent = title;
  $('#confirmText').textContent = text;
  $('#confirmYes').textContent = yesLabel;
  confirmFn = fn;
  $('#confirmModal').classList.add('open');
}
function bindConfirm() {
  const ov = $('#confirmModal');
  ov.addEventListener('click', (e) => { if (e.target === ov) ov.classList.remove('open'); });
  ov.querySelectorAll('[data-close-modal]').forEach((b) =>
    b.addEventListener('click', () => ov.classList.remove('open')));
  $('#confirmYes').addEventListener('click', () => {
    ov.classList.remove('open');
    confirmFn?.();
    confirmFn = null;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') ov.classList.remove('open');
  });
}
