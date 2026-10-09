/* ============================================================
   theme.js — إدارة الوضع الليلي/النهاري
   يُطبَّق الوضع مبكراً عبر سكربت داخل <head> لمنع وميض الألوان،
   وهذا الملف مسؤول عن التبديل والحفظ ومزامنة تفضيل النظام.
   ============================================================ */

(() => {
  'use strict';

  const KEY = 'afa-theme';
  const root = document.documentElement;
  const THEME_COLORS = { light: '#ffffff', dark: '#0a101f' };

  const getSaved = () => {
    try { return localStorage.getItem(KEY); } catch { return null; }
  };

  const save = (theme) => {
    try { localStorage.setItem(KEY, theme); } catch { /* الوضع الخاص */ }
  };

  const getSystemTheme = () =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

  /* تطبيق الوضع على الصفحة بالكامل */
  function apply(theme, animate = true) {
    root.setAttribute('data-theme', theme);

    /* تحديث لون شريط المتصفح/التطبيق */
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[theme]);

    /* تحديث حالة أزرار التبديل (وصولية) */
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(theme === 'dark'));
      btn.setAttribute('aria-label',
        theme === 'dark' ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي');
    });

    /* انتقال ناعم للألوان لحظة التبديل فقط */
    if (animate) {
      root.classList.add('theme-switching');
      setTimeout(() => root.classList.remove('theme-switching'), 400);
    }
  }

  /* التبديل وحفظ الاختيار */
  function toggle() {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    save(next);
    apply(next);
  }

  function init() {
    /* الوضع طُبّق مسبقاً من السكربت المضمّن — نزامن الأزرار فقط */
    apply(root.getAttribute('data-theme') || getSystemTheme(), false);

    /* ربط أزرار التبديل */
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.addEventListener('click', toggle);
    });

    /* تتبّع تفضيل النظام فقط إذا لم يختر المستخدم بنفسه */
    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (e) => {
        if (!getSaved()) apply(e.matches ? 'dark' : 'light', false);
      });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
