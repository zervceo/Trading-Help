/*
 * common.js
 * Shared header/nav component, formatting helpers, and live header ticker.
 * Expects window.SITE_BASE ('' at root, '../' inside /strategies/) and
 * window.ACTIVE_NAV (one of: dashboard, trade, portfolio, strategies, about)
 * to be set by an inline script before this file loads.
 */
(function (global) {
  'use strict';

  var BASE = global.SITE_BASE || '';
  var ACTIVE = global.ACTIVE_NAV || '';

  function fmtMoney(n, opts) {
    opts = opts || {};
    var sign = n < 0 ? '-' : (opts.forceSign && n > 0 ? '+' : '');
    var abs = Math.abs(n);
    return sign + '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtPrice(n) {
    if (n == null || isNaN(n)) return '--';
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtPct(n, opts) {
    opts = opts || {};
    var sign = n > 0 ? '+' : '';
    return sign + n.toFixed(opts.digits != null ? opts.digits : 2) + '%';
  }
  function fmtQty(n) { return Number(n).toLocaleString('en-US'); }
  function pnlClass(n) { return n > 0.0001 ? 'pos' : (n < -0.0001 ? 'neg' : 'flat'); }
  function fmtTime(ts) {
    var d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  function fmtDateTime(ts) {
    var d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  function flash(el, direction) {
    if (!el) return;
    el.classList.remove('flash-up', 'flash-down');
    void el.offsetWidth; // restart animation
    el.classList.add(direction > 0 ? 'flash-up' : 'flash-down');
  }

  var NAV_ITEMS = [
    { key: 'dashboard', label: 'Dashboard', href: 'index.html' },
    { key: 'trade', label: 'Trade', href: 'trade.html' },
    { key: 'portfolio', label: 'Portfolio', href: 'portfolio.html' },
    { key: 'strategies', label: 'Strategies', href: 'strategies.html' },
    { key: 'progress', label: 'Learn Progress', href: 'strategies.html#progress' }
  ];

  function renderHeader() {
    var mount = document.getElementById('site-header');
    if (!mount) return;

    var navHtml = NAV_ITEMS.map(function (item) {
      var isActive = ACTIVE === item.key;
      return '<a class="nav-link' + (isActive ? ' active' : '') + '" href="' + BASE + item.href + '">' + item.label + '</a>';
    }).join('');

    mount.innerHTML =
      '<header class="site-header">' +
      '  <div class="header-row">' +
      '    <a class="brand" href="' + BASE + 'index.html">' +
      '      <span class="brand-mark">VTA</span>' +
      '      <span class="brand-name">Volatility Trading Academy</span>' +
      '    </a>' +
      '    <nav class="site-nav" id="site-nav">' + navHtml + '</nav>' +
      '    <div class="header-stats">' +
      '      <div class="stat"><span class="stat-label">Cash</span><span class="stat-value mono" id="hdr-cash">--</span></div>' +
      '      <div class="stat"><span class="stat-label">Equity</span><span class="stat-value mono" id="hdr-equity">--</span></div>' +
      '      <div class="stat"><span class="stat-label">Total P&amp;L</span><span class="stat-value mono" id="hdr-pnl">--</span></div>' +
      '    </div>' +
      '    <button class="nav-toggle" id="nav-toggle" aria-label="Toggle navigation" aria-expanded="false">' +
      '      <span></span><span></span><span></span>' +
      '    </button>' +
      '  </div>' +
      '  <div class="header-stats header-stats-mobile">' +
      '    <div class="stat"><span class="stat-label">Cash</span><span class="stat-value mono" id="hdr-cash-m">--</span></div>' +
      '    <div class="stat"><span class="stat-label">Equity</span><span class="stat-value mono" id="hdr-equity-m">--</span></div>' +
      '    <div class="stat"><span class="stat-label">P&amp;L</span><span class="stat-value mono" id="hdr-pnl-m">--</span></div>' +
      '  </div>' +
      '</header>';

    var toggle = document.getElementById('nav-toggle');
    var nav = document.getElementById('site-nav');
    if (toggle && nav) {
      toggle.addEventListener('click', function () {
        var open = nav.classList.toggle('open');
        toggle.classList.toggle('open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
  }

  function updateHeaderStats(summary) {
    var cashEl = document.getElementById('hdr-cash');
    var equityEl = document.getElementById('hdr-equity');
    var pnlEl = document.getElementById('hdr-pnl');
    var cashElM = document.getElementById('hdr-cash-m');
    var equityElM = document.getElementById('hdr-equity-m');
    var pnlElM = document.getElementById('hdr-pnl-m');
    if (!cashEl) return;

    cashEl.textContent = fmtMoney(summary.cash);
    equityEl.textContent = fmtMoney(summary.equity);
    pnlEl.textContent = fmtMoney(summary.totalPnl, { forceSign: true }) + ' (' + fmtPct(summary.totalPnl / summary.startingCash * 100) + ')';
    pnlEl.className = 'stat-value mono ' + pnlClass(summary.totalPnl);

    if (cashElM) cashElM.textContent = fmtMoney(summary.cash);
    if (equityElM) equityElM.textContent = fmtMoney(summary.equity);
    if (pnlElM) {
      pnlElM.textContent = fmtMoney(summary.totalPnl, { forceSign: true });
      pnlElM.className = 'stat-value mono ' + pnlClass(summary.totalPnl);
    }
  }

  function initHeaderLiveUpdates() {
    if (!global.PortfolioEngine) return;
    updateHeaderStats(global.PortfolioEngine.getAccountSummary());
    global.PortfolioEngine.subscribe(updateHeaderStats);
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderHeader();
    initHeaderLiveUpdates();
  });

  var VOL_BADGE = {
    'blue-chip': { label: 'Low Vol', cls: 'badge-vol-low' },
    'mid-vol': { label: 'Mid Vol', cls: 'badge-vol-mid' },
    'momentum': { label: 'High Vol', cls: 'badge-vol-high' },
    'short-target': { label: 'High Vol', cls: 'badge-vol-high' },
    'earnings': { label: 'High Vol', cls: 'badge-vol-high' },
    'leveraged-etf': { label: 'Extreme Vol', cls: 'badge-vol-high' },
    'penny': { label: 'Extreme Vol', cls: 'badge-vol-high' }
  };
  function volBadge(category) { return VOL_BADGE[category] || { label: 'Vol', cls: 'badge-vol-mid' }; }

  global.VTA = {
    fmtMoney: fmtMoney,
    volBadge: volBadge,
    fmtPrice: fmtPrice,
    fmtPct: fmtPct,
    fmtQty: fmtQty,
    fmtTime: fmtTime,
    fmtDateTime: fmtDateTime,
    pnlClass: pnlClass,
    flash: flash,
    BASE: BASE
  };
})(window);
