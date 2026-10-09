/* ============================================================
   lesson.js — صفحة الدرس
   مشغل يوتيوب (IFrame API) + ملاحظات زمنية + تقدم + نقاط
   ============================================================ */

import { db, functions } from './firebase-config.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { requireAuth, initHeaderAuth } from './auth.js';
import { fetchCourseById, escapeHtml, formatDuration, getYoutubeId, safeLinkUrl } from './courses-data.js';
import { fetchProgress, saveLastLesson, toggleLessonComplete, POINTS_PER_LESSON } from './progress.js';
import { listenLessonNotes, addNote, updateNoteText, deleteNote } from './notes.js';

const $ = (s) => document.querySelector(s);
const toast = (m, t) => window.AFA?.toast(m, t);

/* ---------- حالة الصفحة ---------- */
const S = {
  user: null, course: null, flat: [],
  lessonId: null, current: null,
  completed: [], points: 0,
  quiz: null,
  editingNoteId: null
};
let latestNotes = [];
let player = null, playerReady = false, hasVideo = false;

const ctx = await requireAuth();
if (ctx) main(ctx);

async function main({ user, profile }) {
  S.user = user;
  S.points = Number(profile?.points || 0);
  initHeaderAuth({ user, profile });

  const courseId = new URLSearchParams(location.search).get('course');
  if (!courseId) { location.replace('/courses.html'); return; }

  /* الكورس */
  let course = null;
  try { course = await fetchCourseById(courseId); } catch { /* مسودة أو محذوف */ }
  if (!course || course.status !== 'published')
    return showError('هذا الكورس غير متوفر', 'قد يكون قيد الإعداد أو أن الرابط غير صحيح.');

  /* قائمة الدروس المرتبة من المخطط */
  (course.outline || []).forEach((mod, mi) => {
    (mod.lessons || []).forEach((l) => {
      S.flat.push({
        id: l.id,
        title: l.title || 'درس',
        durationSec: l.durationSec || 0,
        moduleTitle: mod.title || `الفصل ${mi + 1}`
      });
    });
  });
  if (!S.flat.length)
    return showError('لا توجد دروس بعد', 'يعمل الفريق على نشر محتوى هذا الكورس قريباً.');

  /* التقدم */
  let progress = null;
  try {
    progress = await fetchProgress(user.uid, courseId);
  } catch (err) {
    console.error('تعذر تحميل تقدم الطالب:', err);
    toast('تعذر تحميل تقدمك المحفوظ.', 'error');
  }
  S.completed = progress?.completedLessons || [];

  S.course = { ...course, id: courseId };

  /* الدرس الحالي: الرابط ← آخر درس متابع ← أول درس */
  const wanted = new URLSearchParams(location.search).get('lesson');
  let current = S.flat.find((l) => l.id === wanted);
  if (!current) {
    const last = progress?.lastLessonId ? S.flat.find((l) => l.id === progress.lastLessonId) : null;
    current = last || S.flat[0];
    history.replaceState(null, '', `/lesson.html?course=${courseId}&lesson=${current.id}`);
  }
  S.lessonId = current.id;
  S.current = current;

  /* محتوى الدرس */
  let lesson = null;
  try {
    const snap = await getDoc(doc(db, 'courses', courseId, 'lessons', S.lessonId));
    if (snap.exists()) lesson = snap.data();
  } catch { /* غير منشور أو محذوف */ }
  if (!lesson || lesson.isPublished !== true)
    return showError('هذا الدرس غير متاح حالياً', 'قد لا يكون منشوراً بعد — جرّب لاحقاً.');

  let quiz = null, quizAttempt = null;
  try {
    const quizSnap = await getDoc(doc(db, 'courses', courseId, 'lessons', S.lessonId, 'quiz', 'current'));
    if (quizSnap.exists() && quizSnap.data().enabled === true) {
      quiz = quizSnap.data();
      const attemptId = `${courseId}__${S.lessonId}`;
      const attemptSnap = await getDoc(doc(db, 'users', user.uid, 'quizAttempts', attemptId));
      if (attemptSnap.exists()) quizAttempt = attemptSnap.data();
    }
  } catch (err) {
    console.error('تعذر تحميل اختبار الحلقة:', err);
  }

  /* تسجيل آخر درس متابع (فقط عند التغيير — لتوفير الكتابات) */
  if (progress?.lastLessonId !== S.lessonId) {
    try {
      await saveLastLesson(user.uid, courseId, S.lessonId);
    } catch (err) {
      console.error('تعذر حفظ آخر درس تمت متابعته:', err);
      toast('تعذر حفظ تقدمك الآن. سيظل بإمكانك متابعة الدرس.', 'error');
    }
  }

  renderSidebar();
  renderHead(lesson);
  renderVideo(lesson.videoId);
  renderAttachments(lesson.attachments);
  renderLessonQuiz(quiz, quizAttempt);
  renderActions();
  renderCompleteState();
  renderProgressUI();
  initNotes();
  bindGlobalUI();

  $('#lessonSkeleton').hidden = true;
  $('#lessonLayout').hidden = false;
}

/* ==================== الشريط الجانبي ==================== */
function renderSidebar() {
  $('#sidebarCourseTitle').textContent = S.course.title;

  const nav = $('#curriculumNav');
  nav.innerHTML = (S.course.outline || []).map((mod, mi) => `
    <div class="curr-module">
      <div class="curr-module-title">
        <span class="module-num">${mi + 1}</span>
        <span class="curr-module-name">${escapeHtml(mod.title || `الفصل ${mi + 1}`)}</span>
      </div>
      ${(mod.lessons || []).map((l) => {
        const done = S.completed.includes(l.id);
        const active = l.id === S.lessonId;
        return `
        <a class="curr-lesson ${done ? 'done' : ''} ${active ? 'active' : ''}"
           href="/lesson.html?course=${S.course.id}&lesson=${l.id}"
           ${active ? 'aria-current="page"' : ''}>
          <svg class="icon l-icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#${done ? 'i-check-circle' : 'i-play-circle'}"></use></svg>
          <span class="l-title">${escapeHtml(l.title || 'درس')}</span>
          ${l.durationSec ? `<span class="l-dur">${formatDuration(l.durationSec)}</span>` : ''}
        </a>`;
      }).join('')}
    </div>`).join('');

  /* تمرير الدرس الحالي لمنتصف القائمة (دون تحريك الصفحة) */
  const active = nav.querySelector('.curr-lesson.active');
  if (active) nav.scrollTop = active.offsetTop - nav.clientHeight / 2;
}

/* ==================== الترويسة ==================== */
function renderHead(lesson) {
  $('#crumbCourse').textContent = S.course.title;
  $('#crumbCourse').href = `/course.html?id=${S.course.id}`;
  $('#crumbModule').textContent = S.current.moduleTitle;
  $('#lessonTitle').textContent = lesson.title || S.current.title;
  $('#descText').textContent = lesson.description || 'لا يوجد وصف مفصّل لهذا الدرس.';
  updatePointsChip(false);
}

function updatePointsChip(pop = true) {
  const chip = $('#pointsChip');
  chip.querySelector('b').textContent = S.points;
  if (pop) { chip.classList.remove('pop'); void chip.offsetWidth; chip.classList.add('pop'); }
}

/* ==================== مشغل اليوتيوب ==================== */
function loadYT() {
  return new Promise((resolve) => {
    if (window.YT?.Player) return resolve();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    document.head.appendChild(s);
  });
}

function renderVideo(videoId) {
  const vid = getYoutubeId(String(videoId || ''));
  hasVideo = !!vid;
  const frame = $('#videoFrame');

  if (!hasVideo) {
    frame.innerHTML = `
      <div class="video-none">
        <svg class="icon icon-xl" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-video"></use></svg>
        <p>هذا الدرس لا يحتوي فيديو — راجع الوصف والمرفقات أدناه.</p>
      </div>`;
    onVideoReady(); /* تفعيل الملاحظات بلا فيديو (الوقت = 0) */
    return;
  }

  loadYT().then(() => {
    $('#videoLoading')?.remove();
    player = new YT.Player('playerMount', {
      videoId: vid,
      host: 'https://www.youtube-nocookie.com', /* وضع الخصوصية المحسّن */
      playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
      events: { onReady: onVideoReady }
    });
  });
}

function onVideoReady() {
  playerReady = true;
  $('#addNoteBtn').disabled = false;
  /* تحديث حي لوقت الفيديو بجانب زر الإضافة */
  setInterval(() => {
    if (hasVideo && player?.getCurrentTime) {
      $('#liveTime').textContent = formatDuration(player.getCurrentTime());
    }
  }, 1000);
}

function seekTo(sec) {
  if (!hasVideo || !playerReady) return toast('الفيديو غير جاهز بعد.', 'warning');
  player.seekTo(sec, true);
  player.playVideo();
  $('#videoFrame').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ==================== المرفقات ==================== */
function renderAttachments(list) {
  const arr = Array.isArray(list) ? list.filter((a) => a?.url) : [];
  if (!arr.length) return;
  $('#attachmentsWrap').hidden = false;
  $('#attachmentsList').innerHTML = arr.map((a) => {
    const url = safeLinkUrl(a.url, '');
    if (!url) return `<div class="attachment is-disabled" aria-disabled="true"><svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-file"></use></svg><span>${escapeHtml(a.title || 'مرفق')}</span><svg class="icon dl" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-download"></use></svg></div>`;
    return `
      <a class="attachment" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
        <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-file"></use></svg>
        <span>${escapeHtml(a.title || 'مرفق')}</span>
        <svg class="icon dl" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-download"></use></svg>
      </a>`;
  }).join('');
}

function renderLessonQuiz(quiz, previousAttempt) {
  if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length !== 4) return;
  S.quiz = quiz;

  const section = $('#lessonQuizSection');
  const form = $('#lessonQuizForm');
  const questions = $('#lessonQuizQuestions');
  section.hidden = false;
  questions.innerHTML = quiz.questions.map((question, index) => `
    <fieldset class="quiz-question">
      <legend>${index + 1}. ${escapeHtml(question.prompt || '')}</legend>
      <div class="quiz-answer-options">
        ${(question.options || []).map((option) => `
          <label class="quiz-option">
            <input type="radio" name="quiz-${escapeHtml(question.id)}" data-question-id="${escapeHtml(question.id)}" value="${escapeHtml(option.id)}" required>
            <span>${escapeHtml(option.text || '')}</span>
          </label>`).join('')}
      </div>
    </fieldset>`).join('');

  if (previousAttempt) {
    showQuizResult(previousAttempt);
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const answers = Object.fromEntries(Array.from(
      form.querySelectorAll('input[type="radio"]:checked')
    ).map((input) => [input.dataset.questionId, input.value]));
    if (Object.keys(answers).length !== quiz.questions.length)
      return showQuizMessage('أجب عن الأسئلة الخمسة قبل التسليم.', true);

    const button = $('#submitLessonQuiz');
    button.disabled = true;
    button.classList.add('loading');
    try {
      const submit = httpsCallable(functions, 'submitLessonQuiz');
      const response = await submit({ courseId: S.course.id, lessonId: S.lessonId, answers });
      showQuizResult(response.data);
    } catch (err) {
      if (err.code === 'functions/already-exists') {
        try {
          const attemptId = `${S.course.id}__${S.lessonId}`;
          const snap = await getDoc(doc(db, 'users', S.user.uid, 'quizAttempts', attemptId));
          if (snap.exists()) return showQuizResult(snap.data());
        } catch (readError) {
          console.error('تعذر تحميل نتيجة الاختبار السابقة:', readError);
        }
      }
      console.error('تعذر تصحيح الاختبار:', err);
      showQuizMessage(err.code === 'functions/not-found'
        ? 'خدمة تصحيح الاختبارات لم تُفعّل بعد.'
        : 'تعذر تصحيح الاختبار الآن. لم تُحفظ محاولة؛ حاول مجدداً.', true);
      button.disabled = false;
      button.classList.remove('loading');
    }
  });
}

function showQuizResult(result) {
  $('#lessonQuizForm').hidden = true;
  const feedback = $('#lessonQuizResult');
  feedback.className = `quiz-result ${result.passed ? 'passed' : 'failed'}`;
  feedback.textContent = `نتيجتك ${result.correct} من ${result.total} (${result.percentage}%). ${result.passed ? 'ناجح، تجاوزت حد النجاح 50%.' : 'لم تصل إلى حد النجاح 50%.'} تم استخدام المحاولة الوحيدة.`;
  feedback.hidden = false;
}

function showQuizMessage(message, isError = false) {
  const feedback = $('#lessonQuizResult');
  feedback.className = `quiz-result ${isError ? 'failed' : ''}`;
  feedback.textContent = message;
  feedback.hidden = false;
}

/* ==================== التنقل والإتمام ==================== */
function renderActions() {
  const idx = S.flat.findIndex((l) => l.id === S.lessonId);
  const prev = S.flat[idx - 1], next = S.flat[idx + 1];
  const go = (id) => { location.href = `/lesson.html?course=${S.course.id}&lesson=${id}`; };

  $('#prevBtn').disabled = !prev;
  $('#nextBtn').disabled = !next;
  $('#prevBtn').onclick = () => prev && go(prev.id);
  $('#nextBtn').onclick = () => next && go(next.id);
}

function renderCompleteState() {
  const done = S.completed.includes(S.lessonId);
  const btn = $('#completeBtn');
  btn.classList.toggle('done', done);
  btn.innerHTML = done
    ? `<svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-check-circle"></use></svg> مكتمل — إلغاء الإتمام؟`
    : `<svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-check"></use></svg> إتمام الدرس (+${POINTS_PER_LESSON} نقاط)`;
}

function renderProgressUI() {
  const done = S.completed.length, total = S.flat.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  $('#sidebarProgressBar').style.width = pct + '%';
  $('#sidebarPercent').textContent = `${done} من ${total} دروس — ${pct}%`;
}

 $('#completeBtn').addEventListener('click', () => {
  if (S.completed.includes(S.lessonId)) {
    askConfirm(
      'إلغاء إتمام الدرس؟',
      `سيتم خصم ${POINTS_PER_LESSON} نقاط من رصيدك.`,
      'نعم، إلغاء الإتمام',
      doToggle
    );
  } else {
    doToggle();
  }
});

async function doToggle() {
  const btn = $('#completeBtn');
  btn.disabled = true;
  try {
    const res = await toggleLessonComplete({
      uid: S.user.uid,
      courseId: S.course.id,
      lessonId: S.lessonId,
      completedLessons: S.completed,
      totalLessons: S.flat.length
    });
    const wasDone = res.wasDone;
    S.completed = res.completedLessons;
    S.points += wasDone ? -POINTS_PER_LESSON : POINTS_PER_LESSON;

    updatePointsChip(true);
    renderCompleteState();
    renderSidebar();
    renderProgressUI();

    if (!wasDone) {
      toast(`أحسنت! حصلت على ${POINTS_PER_LESSON} نقاط`, 'success');
      if (res.percent === 100) {
        $('#doneCourseLink').href = `/course.html?id=${S.course.id}`;
        $('#doneModal').classList.add('open');
      }
    } else {
      toast('تم إلغاء إتمام الدرس.', 'info');
    }
  } catch (err) {
    console.error(err);
    toast('تعذر تحديث التقدم — تحقق من اتصالك.', 'error');
  } finally {
    btn.disabled = false;
  }
}

/* ==================== الملاحظات الزمنية ==================== */
function initNotes() {
  listenLessonNotes(
    { uid: S.user.uid, courseId: S.course.id, lessonId: S.lessonId },
    (notes) => renderNotes(notes),
    (err) => { console.error(err); toast('تعذر تحميل الملاحظات.', 'error'); }
  );

  const input = $('#noteInput'), btn = $('#addNoteBtn');

  btn.addEventListener('click', submitNote);
  input.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submitNote();
  });

  async function submitNote() {
    const text = input.value.trim();
    if (!text) return toast('اكتب نص الملاحظة أولاً.', 'warning');
    const t = hasVideo && playerReady ? (player.getCurrentTime() || 0) : 0;
    btn.disabled = true;
    try {
      await addNote({ uid: S.user.uid, courseId: S.course.id, lessonId: S.lessonId, videoTime: t, text });
      input.value = '';
      toast(`تم حفظ ملاحظتك عند الثانية ${formatDuration(t)}`, 'success');
    } catch (err) {
      console.error(err);
      toast('تعذر حفظ الملاحظة.', 'error');
    } finally { btn.disabled = false; }
  }
}

function renderNotes(notes) {
  latestNotes = notes;
  const list = $('#notesList'), empty = $('#notesEmpty');
  const badge = $('#notesCountBadge');
  badge.hidden = !notes.length;
  badge.textContent = notes.length ? `${notes.length} ملاحظة` : '';

  if (!notes.length) { list.innerHTML = ''; empty.hidden = false; return; }
  empty.hidden = true;

  list.innerHTML = notes.map((n) => {
    const time = formatDuration(n.videoTime || 0);
    if (n.id === S.editingNoteId) {
      return `
      <div class="note-item" data-id="${n.id}">
        <button type="button" class="note-time" data-seek="${n.videoTime || 0}">${time}</button>
        <div class="note-body note-edit">
          <textarea data-edit-input aria-label="تعديل الملاحظة">${escapeHtml(n.text)}</textarea>
          <div class="note-edit-actions">
            <button type="button" class="btn btn-primary btn-sm" data-act="save">حفظ</button>
            <button type="button" class="btn btn-ghost btn-sm" data-act="cancel">إلغاء</button>
          </div>
        </div>
      </div>`;
    }
    return `
    <div class="note-item" data-id="${n.id}">
      <button type="button" class="note-time" data-seek="${n.videoTime || 0}" title="انتقل إلى هذه اللحظة">${time}</button>
      <div class="note-body">
        <p class="note-text">${escapeHtml(n.text)}</p>
        ${n.updatedAt?.seconds ? `<p class="note-foot">${new Date(n.updatedAt.seconds * 1000).toLocaleDateString('ar-EG')}</p>` : ''}
      </div>
      <div class="note-actions">
        <button type="button" data-act="edit" aria-label="تعديل"><svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-edit"></use></svg></button>
        <button type="button" data-act="del" class="danger" aria-label="حذف"><svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-trash"></use></svg></button>
      </div>
    </div>`;
  }).join('');
}

const rerenderNotes = () => renderNotes(latestNotes);

 $('#notesList').addEventListener('click', async (e) => {
  /* الانتقال إلى لحظة الفيديو */
  const timeBtn = e.target.closest('[data-seek]');
  if (timeBtn) return seekTo(Number(timeBtn.dataset.seek));

  const item = e.target.closest('.note-item');
  if (!item) return;
  const id = item.dataset.id;
  const act = e.target.closest('[data-act]')?.dataset.act;

  if (act === 'edit') { S.editingNoteId = id; rerenderNotes(); }
  else if (act === 'cancel') { S.editingNoteId = null; rerenderNotes(); }
  else if (act === 'save') {
    const text = item.querySelector('[data-edit-input]').value.trim();
    if (!text) return toast('لا يمكن حفظ ملاحظة فارغة.', 'warning');
    try {
      await updateNoteText(id, text);
      S.editingNoteId = null;
      toast('تم تحديث الملاحظة.', 'success');
    } catch { toast('تعذر التحديث.', 'error'); }
  }
  else if (act === 'del') {
    askConfirm('حذف الملاحظة؟', 'لا يمكن التراجع عن هذه العملية.', 'نعم، احذف', async () => {
      try { await deleteNote(id); toast('تم حذف الملاحظة.', 'success'); }
      catch { toast('تعذر الحذف.', 'error'); }
    });
  }
});

/* ==================== النوافذ والأخطاء ==================== */
function bindGlobalUI() {
  document.querySelectorAll('.modal-overlay').forEach((ov) => {
    ov.addEventListener('click', (e) => { if (e.target === ov) ov.classList.remove('open'); });
    ov.querySelectorAll('[data-close-modal]').forEach((b) =>
      b.addEventListener('click', () => ov.classList.remove('open')));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape')
      document.querySelectorAll('.modal-overlay.open').forEach((m) => m.classList.remove('open'));
  });
}

let confirmFn = null;
function askConfirm(title, text, yesLabel, fn) {
  $('#confirmTitle').textContent = title;
  $('#confirmText').textContent = text;
  $('#confirmYes').textContent = yesLabel;
  confirmFn = fn;
  $('#confirmModal').classList.add('open');
}
 $('#confirmYes').addEventListener('click', () => {
  $('#confirmModal').classList.remove('open');
  confirmFn?.();
  confirmFn = null;
});

function showError(title, text) {
  $('#lessonSkeleton').hidden = true;
  $('#errorTitle').textContent = title;
  $('#errorText').textContent = text;
  $('#lessonError').hidden = false;
}
