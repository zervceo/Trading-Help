/*
 * strategies.js — strategies.html
 */
(function () {
  'use strict';

  function volDots(level) {
    var html = '<span class="vol-dots">';
    for (var i = 1; i <= 5; i++) {
      html += '<span class="vol-dot' + (i <= level ? ' on' : '') + '"></span>';
    }
    return html + '</span>';
  }

  function renderProgress() {
    var done = VTAStrategies.completedCount();
    var total = VTAStrategies.total;
    var pct = total ? Math.round((done / total) * 100) : 0;
    document.getElementById('progress-count').textContent = done + ' / ' + total + ' lessons complete';
    document.getElementById('progress-pct').textContent = pct + '%';
    document.getElementById('progress-fill').style.width = pct + '%';
  }

  function renderGrid() {
    var mount = document.getElementById('strategy-grid');
    mount.innerHTML = VTAStrategies.list.map(function (s) {
      var done = VTAStrategies.isComplete(s.id);
      return (
        '<a class="strategy-card" href="' + s.href + '">' +
        '  <div class="strategy-meta">' +
        '    <span class="pill">Lesson ' + s.order + '</span>' +
        volDots(s.volatility) +
        '  </div>' +
        '  <h3>' + s.title + '</h3>' +
        '  <p>' + s.summary + '</p>' +
        '  <div class="strategy-meta" style="justify-content:space-between; margin-top:auto;">' +
        '    <span class="pill">Drill ticker: ' + s.ticker + '</span>' +
        (done ? '<span class="strategy-complete">&#10003; Complete</span>' : '<span class="pill">Not started</span>') +
        '  </div>' +
        '</a>'
      );
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderProgress();
    renderGrid();
  });
})();
