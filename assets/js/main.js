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
      const accountToggle = qs('.account-menu-toggle');
      const accountChip = qs('[data-auth-user]');
      if (window.matchMedia('(max-width: 991px)').matches && accountToggle && accountChip && !accountChip.hidden) {
        const drawer = qs('#accountDrawer');
        if (drawer?.classList.contains('open')) {
          drawer.querySelector('[data-account-drawer-close]').click();
        } else {
          accountToggle.dataset.returnFocus = 'menuToggle';
          accountToggle.click();
          toggle.classList.add('active');
          toggle.setAttribute('aria-expanded', 'true');
        }
        return;
      }
      const open = nav.classList.toggle('open');
      toggle.classList.toggle('active', open);
      toggle.setAttribute('aria-expanded', String(open));
    });

    nav.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
    document.addEventListener('click', (e) => {
      if (qs('#accountDrawer')?.classList.contains('open')) return;
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
      <nav class="account-drawer-nav" aria-label="صفحات الموقع"></nav>
      <div class="account-drawer-settings">
        <h3>الإعدادات</h3>
        <div class="account-setting-row">
          <span>المظهر</span>
        </div>
      </div>`;
    drawer.querySelector('.account-drawer-profile').appendChild(chip);
    const drawerNav = drawer.querySelector('.account-drawer-nav');
    qs('#mainNav')?.querySelectorAll('a').forEach((link) => {
      const copy = link.cloneNode(true);
      copy.classList.remove('nav-link');
      drawerNav.appendChild(copy);
    });
    const notificationsLink = document.createElement('a');
    notificationsLink.href = '/notifications.html';
    notificationsLink.innerHTML = '<svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-bell"></use></svg><span>الإشعارات</span>';
    drawerNav.appendChild(notificationsLink);

    const themeToggle = qs('[data-theme-toggle]');
    const themePlaceholder = themeToggle ? document.createComment('theme-toggle') : null;
    if (themePlaceholder) themeToggle.after(themePlaceholder);
    document.body.append(backdrop, drawer);
    qs('#menuToggle')?.setAttribute('aria-controls', 'accountDrawer');

    let returnFocus = toggle;

    const close = () => {
      if (!drawer.classList.contains('open')) return;
      drawer.classList.remove('open');
      backdrop.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
      drawer.inert = true;
      toggle.setAttribute('aria-expanded', 'false');
      const menuToggle = qs('#menuToggle');
      menuToggle?.classList.remove('active');
      menuToggle?.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('account-drawer-open');
      returnFocus.focus();
      window.setTimeout(() => { backdrop.hidden = true; }, 220);
    };

    toggle.addEventListener('click', () => {
      if (chip.hidden) return;
      returnFocus = toggle.dataset.returnFocus === 'menuToggle' ? qs('#menuToggle') : toggle;
      delete toggle.dataset.returnFocus;
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

    const syncToggle = () => {
      toggle.hidden = chip.hidden;
      const menuToggle = qs('#menuToggle');
      if (menuToggle) {
        menuToggle.setAttribute('aria-controls', chip.hidden ? 'mainNav' : 'accountDrawer');
        menuToggle.setAttribute('aria-label', chip.hidden ? 'فتح القائمة' : 'فتح القائمة الجانبية');
      }
      if (themeToggle && themePlaceholder?.parentNode) {
        if (chip.hidden) themePlaceholder.parentNode.insertBefore(themeToggle, themePlaceholder);
        else drawer.querySelector('.account-setting-row').appendChild(themeToggle);
      }
    };
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
