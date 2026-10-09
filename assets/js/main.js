/* ============================================================
   main.js — الوظائف العامة للمنصة (تعمل في كل الصفحات)
   - تسجيل Service Worker
   - نظام تنبيهات Toast
   - القائمة الجوالة + الهيدر
   - مراقبة حالة الاتصال
   ============================================================ */

(() => {
  'use strict';

  const qs  = (sel, ctx = document) => ctx.querySelector(sel);
  const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ============ نظام التنبيهات (Toast) ============ */
  function ensureToastWrap() {
    let wrap = qs('#toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    return wrap;
  }

  const TOAST_ICONS = {
    info:    'i-alert',
    success: 'i-check-circle',
    warning: 'i-alert',
    error:   'i-alert'
  };

  function toast(message, type = 'info', duration = 3500) {
    const wrap = ensureToastWrap();
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.setAttribute('role', 'status');
    el.innerHTML =
      `<svg class="icon" aria-hidden="true">` +
      `<use href="/assets/icons/sprite.svg#${TOAST_ICONS[type] || 'i-alert'}"></use></svg>` +
      `<span></span>`;
    el.querySelector('span').textContent = message;
    wrap.appendChild(el);
    setTimeout(() => {
      el.classList.add('hide');
      setTimeout(() => el.remove(), 350);
    }, duration);
  }

  /* ============ الهيدر عند التمرير ============ */
  function initHeader() {
    const header = qs('#siteHeader');
    if (!header) return;
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ============ القائمة الجوالة ============ */
  function initMobileMenu() {
    const toggle = qs('#menuToggle');
    const nav = qs('#mainNav');
    if (!toggle || !nav) return;

    const close = () => {
      nav.classList.remove('open');
      toggle.classList.remove('active');
      toggle.setAttribute('aria-expanded', 'false');
    };

    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.classList.toggle('active', open);
      toggle.setAttribute('aria-expanded', String(open));
    });

    nav.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
    document.addEventListener('click', (e) => {
      if (!nav.contains(e.target) && !toggle.contains(e.target)) close();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  /* ============ حالة الاتصال ============ */
  function initConnectionStatus() {
    window.addEventListener('offline', () =>
      toast('انقطع الاتصال بالإنترنت — سيتم تحميل الصفحات من الذاكرة المؤقتة', 'warning'));
    window.addEventListener('online', () =>
      toast('تم استعادة الاتصال بالإنترنت', 'success'));
  }

  /* ============ تسجيل Service Worker ============ */
  function initServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          reg.addEventListener('updatefound', () => {
            const worker = reg.installing;
            if (!worker) return;
            worker.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                toast('يتوفر تحديث جديد للمنصة — أعد تحميل الصفحة', 'info', 6000);
              }
            });
          });
        })
        .catch(() => { /* التسجيل اختياري */ });
    });
  }

  /* ============ متفرقات ============ */
  function initMisc() {
    qsa('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));
  }

  /* ============ التشغيل ============ */
  document.addEventListener('DOMContentLoaded', () => {
    initHeader();
    initMobileMenu();
    initConnectionStatus();
    initServiceWorker();
    initMisc();
  });

  /* واجهة عامة لكل الصفحات */
  window.AFA = { toast, qs, qsa };
})();
