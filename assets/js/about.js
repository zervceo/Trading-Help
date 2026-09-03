/*
 * about.js — about.html reset-account control
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('reset-btn');
    var msg = document.getElementById('reset-msg');
    btn.addEventListener('click', function () {
      var ok = window.confirm('Reset your paper trading account back to $100,000? This clears all positions and order history and cannot be undone.');
      if (!ok) return;
      PortfolioEngine.resetAccount();
      msg.innerHTML = '<div class="alert alert-success">Account reset to $100,000. Redirecting to the dashboard…</div>';
      setTimeout(function () { window.location.href = 'index.html'; }, 1400);
    });
  });
})();
