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

  /* ============ قائمة الحساب الجانبية ============ */
  function initAccountDrawer() {
    const chip = qs('[data-auth-user]');
    const actions = qs('.header-actions');
    if (!chip || !actions) return;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'account-menu-toggle';
    toggle.setAttribute('aria-label', 'فتح قائمة الحساب');
    toggle.setAttribute('aria-controls', 'accountDrawer');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-user"></use></svg>';
    actions.insertBefore(toggle, actions.querySelector('[data-theme-toggle]'));

    const backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'account-drawer-backdrop';
    backdrop.setAttribute('aria-label', 'إغلاق قائمة الحساب');
    backdrop.hidden = true;

    const drawer = document.createElement('aside');
    drawer.id = 'accountDrawer';
    drawer.className = 'account-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-labelledby', 'accountDrawerTitle');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.inert = true;
    drawer.innerHTML = `
      <div class="account-drawer-head">
        <h2 id="accountDrawerTitle">حسابي</h2>
        <button type="button" class="icon-btn" data-account-drawer-close aria-label="إغلاق القائمة">
          <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-x"></use></svg>
        </button>
      </div>
      <div class="account-drawer-profile"></div>
      <nav class="account-drawer-nav" aria-label="روابط الحساب">
        <a href="/profile.html"><svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-user"></use></svg><span>ملفي الشخصي</span></a>
        <a href="/dashboard.html"><svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-book-open"></use></svg><span>لوحتي</span></a>
        <a href="/notifications.html"><svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-bell"></use></svg><span>الإشعارات</span></a>
      </nav>`;
    drawer.querySelector('.account-drawer-profile').appendChild(chip);
    document.body.append(backdrop, drawer);

    const close = () => {
      if (!drawer.classList.contains('open')) return;
      drawer.classList.remove('open');
      backdrop.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
      drawer.inert = true;
      toggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('account-drawer-open');
      toggle.focus();
      window.setTimeout(() => { backdrop.hidden = true; }, 220);
    };

    toggle.addEventListener('click', () => {
      if (chip.hidden) return;
      backdrop.hidden = false;
      drawer.classList.add('open');
      backdrop.classList.add('open');
      drawer.setAttribute('aria-hidden', 'false');
      drawer.inert = false;
      toggle.setAttribute('aria-expanded', 'true');
      document.body.classList.add('account-drawer-open');
      drawer.querySelector('[data-account-drawer-close]').focus();
    });
    backdrop.addEventListener('click', close);
    drawer.querySelector('[data-account-drawer-close]').addEventListener('click', close);
    drawer.addEventListener('click', (event) => {
      if (event.target.closest('a, [data-logout]')) close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });

    const syncToggle = () => { toggle.hidden = chip.hidden; };
    new MutationObserver(syncToggle).observe(chip, { attributes: true, attributeFilter: ['hidden'] });
    syncToggle();
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
    initAccountDrawer();
    initConnectionStatus();
    initServiceWorker();
    initMisc();
  });

  /* واجهة عامة لكل الصفحات */
  window.AFA = { toast, qs, qsa };
})();
