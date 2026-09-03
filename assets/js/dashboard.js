/*
 * dashboard.js — index.html
 */
(function () {
  'use strict';

  var sparkCharts = {};

  function renderSummary(summary) {
    summary = summary || PortfolioEngine.getAccountSummary();
    setText('#sum-cash', VTA.fmtMoney(summary.cash));
    setText('#sum-equity', VTA.fmtMoney(summary.equity));

    var pnlEl = document.getElementById('sum-pnl');
    pnlEl.textContent = VTA.fmtMoney(summary.totalPnl, { forceSign: true }) + ' (' + VTA.fmtPct(summary.totalPnl / summary.startingCash * 100) + ')';
    pnlEl.className = 'value mono ' + VTA.pnlClass(summary.totalPnl);

    var dayEl = document.getElementById('sum-day-pnl');
    dayEl.textContent = VTA.fmtMoney(summary.dayPnl, { forceSign: true });
    dayEl.className = 'value mono ' + VTA.pnlClass(summary.dayPnl);

    var openCount = summary.positions.length;
    document.getElementById('sum-positions-sub').textContent = openCount + ' open position' + (openCount === 1 ? '' : 's');
  }

  function setText(sel, text) {
    var el = document.querySelector(sel);
    if (el) el.textContent = text;
  }

  function tickerCardHtml(q) {
    var badge = VTA.volBadge(q.category);
    return (
      '<div class="ticker-card" data-symbol="' + q.symbol + '" role="link" tabindex="0">' +
      '  <div class="ticker-card-top">' +
      '    <div>' +
      '      <div class="ticker-symbol">' + q.symbol + '</div>' +
      '      <div class="ticker-name">' + q.name + '</div>' +
      '    </div>' +
      '    <span class="badge ' + badge.cls + '">' + badge.label + '</span>' +
      '  </div>' +
      '  <canvas class="ticker-spark" id="spark-' + q.symbol + '"></canvas>' +
      '  <div class="ticker-card-top">' +
      '    <span class="ticker-price mono" id="price-' + q.symbol + '">' + VTA.fmtPrice(q.price) + '</span>' +
      '    <span class="ticker-change mono ' + VTA.pnlClass(q.change) + '" id="change-' + q.symbol + '">' + VTA.fmtPct(q.changePct) + '</span>' +
      '  </div>' +
      '</div>'
    );
  }

  function renderWatchlist() {
    var mount = document.getElementById('watchlist');
    var quotes = PriceEngine.getAllQuotes();
    mount.innerHTML = quotes.map(tickerCardHtml).join('');

    quotes.forEach(function (q) {
      var canvas = document.getElementById('spark-' + q.symbol);
      var history = PriceEngine.getHistory(q.symbol, '1D').slice(-60);
      sparkCharts[q.symbol] = VTACharts.makeSparkline(canvas, history);
    });

    mount.addEventListener('click', function (e) {
      var card = e.target.closest('.ticker-card');
      if (!card) return;
      window.location.href = 'trade.html?symbol=' + card.getAttribute('data-symbol');
    });
    mount.addEventListener('keypress', function (e) {
      if (e.key !== 'Enter') return;
      var card = e.target.closest('.ticker-card');
      if (!card) return;
      window.location.href = 'trade.html?symbol=' + card.getAttribute('data-symbol');
    });

    PriceEngine.subscribeAll(function (q) {
      var priceEl = document.getElementById('price-' + q.symbol);
      var changeEl = document.getElementById('change-' + q.symbol);
      if (!priceEl) return;
      var prevText = priceEl.textContent;
      priceEl.textContent = VTA.fmtPrice(q.price);
      changeEl.textContent = VTA.fmtPct(q.changePct);
      changeEl.className = 'ticker-change mono ' + VTA.pnlClass(q.change);
      if (prevText !== priceEl.textContent) {
        VTA.flash(priceEl.closest('.ticker-card'), q.change >= 0 ? 1 : -1);
      }
      var history = PriceEngine.getHistory(q.symbol, '1D').slice(-60);
      if (sparkCharts[q.symbol]) VTACharts.updateSparkline(sparkCharts[q.symbol], history);
    });
  }

  function renderStrategyLinks() {
    var mount = document.getElementById('lesson-links');
    var html = VTAStrategies.list.map(function (s) {
      var done = VTAStrategies.isComplete(s.id);
      return (
        '<a class="strategy-card" href="' + s.href + '">' +
        '  <div class="strategy-meta">' +
        '    <span class="pill">Lesson ' + s.order + '</span>' +
        (done ? '<span class="strategy-complete">&#10003; Complete</span>' : '') +
        '  </div>' +
        '  <h3>' + s.title + '</h3>' +
        '  <p>' + s.summary + '</p>' +
        '</a>'
      );
    }).join('');
    mount.innerHTML = html;
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderSummary();
    renderWatchlist();
    renderStrategyLinks();
    PortfolioEngine.subscribe(renderSummary);
  });
})();
