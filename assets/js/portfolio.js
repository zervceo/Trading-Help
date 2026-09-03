/*
 * portfolio.js — portfolio.html
 */
(function () {
  'use strict';

  var equityChart = null;

  function renderSummary(summary) {
    summary = summary || PortfolioEngine.getAccountSummary();
    setText('#p-cash', VTA.fmtMoney(summary.cash));
    setText('#p-equity', VTA.fmtMoney(summary.equity));
    setClass('#p-realized', VTA.fmtMoney(summary.realizedPnl, { forceSign: true }), VTA.pnlClass(summary.realizedPnl));
    setClass('#p-unrealized', VTA.fmtMoney(summary.unrealizedPnl, { forceSign: true }), VTA.pnlClass(summary.unrealizedPnl));
  }

  function setText(sel, text) { var el = document.querySelector(sel); if (el) el.textContent = text; }
  function setClass(sel, text, cls) {
    var el = document.querySelector(sel);
    if (!el) return;
    el.textContent = text;
    el.className = 'value mono ' + cls;
  }

  function positionRow(p) {
    return (
      '<tr>' +
      '<td><b>' + p.symbol + '</b></td>' +
      '<td class="mono">' + VTA.fmtQty(p.qty) + '</td>' +
      '<td class="mono">' + VTA.fmtPrice(p.avgCost) + '</td>' +
      '<td class="mono">' + VTA.fmtPrice(p.mark) + '</td>' +
      '<td class="mono">' + VTA.fmtMoney(p.marketValue) + '</td>' +
      '<td class="mono ' + VTA.pnlClass(p.unrealizedPnl) + '">' + VTA.fmtMoney(p.unrealizedPnl, { forceSign: true }) + '</td>' +
      '<td class="mono ' + VTA.pnlClass(p.unrealizedPnl) + '">' + VTA.fmtPct(p.unrealizedPct) + '</td>' +
      '<td><a class="btn btn-sm btn-ghost" href="trade.html?symbol=' + p.symbol + '">Trade</a></td>' +
      '</tr>'
    );
  }

  function renderPositions(summary) {
    summary = summary || PortfolioEngine.getAccountSummary();
    var longs = summary.positions.filter(function (p) { return p.side === 'long'; });
    var shorts = summary.positions.filter(function (p) { return p.side === 'short'; });

    var longBody = document.getElementById('long-body');
    longBody.innerHTML = longs.length
      ? longs.map(positionRow).join('')
      : '<tr class="empty-row"><td colspan="8">No long positions.</td></tr>';

    var shortBody = document.getElementById('short-body');
    shortBody.innerHTML = shorts.length
      ? shorts.map(positionRow).join('')
      : '<tr class="empty-row"><td colspan="8">No short positions.</td></tr>';
  }

  function renderOrders(summary) {
    summary = summary || PortfolioEngine.getAccountSummary();
    var body = document.getElementById('orders-body');
    if (!summary.orders.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="7">No orders yet. <a href="trade.html" style="color:var(--accent);">Place your first trade &rarr;</a></td></tr>';
      return;
    }
    body.innerHTML = summary.orders.map(function (o) {
      var statusCls = o.status === 'filled' ? 'pos' : (o.status === 'rejected' ? 'neg' : 'flat');
      var priceStr = o.status === 'open' || o.type === 'limit'
        ? (o.fillPrice != null ? VTA.fmtPrice(o.fillPrice) : 'limit ' + VTA.fmtPrice(o.limitPrice))
        : VTA.fmtPrice(o.fillPrice);
      return (
        '<tr>' +
        '<td class="mono" style="color:var(--text-faint);">' + VTA.fmtDateTime(o.ts) + '</td>' +
        '<td><b>' + o.symbol + '</b></td>' +
        '<td style="text-transform:capitalize;">' + o.side + '</td>' +
        '<td style="text-transform:capitalize;">' + o.type + '</td>' +
        '<td class="mono">' + VTA.fmtQty(o.qty) + '</td>' +
        '<td class="mono">' + priceStr + '</td>' +
        '<td class="' + statusCls + '" style="text-transform:capitalize;">' + o.status + (o.status === 'open' ? ' <button class="btn btn-sm btn-ghost cancel-order" data-id="' + o.id + '">Cancel</button>' : '') + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function renderEquityChart(summary) {
    summary = summary || PortfolioEngine.getAccountSummary();
    var canvas = document.getElementById('equity-chart');
    if (!equityChart) {
      equityChart = VTACharts.makeEquityChart(canvas, summary.equityHistory);
    } else {
      var values = summary.equityHistory.map(function (p) { return p.equity; });
      var labels = summary.equityHistory.map(function (p) { return new Date(p.t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); });
      equityChart.data.labels = labels;
      equityChart.data.datasets[0].data = values;
      equityChart.update('none');
    }
  }

  function refresh(summary) {
    summary = summary || PortfolioEngine.getAccountSummary();
    renderSummary(summary);
    renderPositions(summary);
    renderOrders(summary);
    renderEquityChart(summary);
  }

  document.addEventListener('DOMContentLoaded', function () {
    refresh();
    PortfolioEngine.subscribe(refresh);
    document.getElementById('orders-body').addEventListener('click', function (e) {
      var btn = e.target.closest('.cancel-order');
      if (!btn) return;
      PortfolioEngine.cancelOrder(parseInt(btn.getAttribute('data-id'), 10));
    });
  });
})();
