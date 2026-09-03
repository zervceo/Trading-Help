/*
 * trade.js — trade.html (the trading desk)
 */
(function () {
  'use strict';

  var state = {
    symbol: null,
    range: '1D',
    side: 'buy',
    type: 'market'
  };
  var mainChart = null;
  var priceUnsub = null;

  function qs(name) {
    var m = new RegExp('[?&]' + name + '=([^&]+)').exec(window.location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function populateTickerSelect() {
    var sel = document.getElementById('ticker-select');
    var byCategory = {};
    PriceEngine.tickers.forEach(function (t) {
      byCategory[t.category] = byCategory[t.category] || [];
      byCategory[t.category].push(t);
    });
    var labels = {
      'blue-chip': 'Blue Chip (Low Vol)', 'mid-vol': 'Mid Volatility', 'momentum': 'Momentum',
      'short-target': 'High Short Interest', 'earnings': 'Earnings Volatility', 'leveraged-etf': 'Leveraged ETF', 'penny': 'Penny Stocks'
    };
    var html = '';
    Object.keys(labels).forEach(function (cat) {
      if (!byCategory[cat]) return;
      html += '<optgroup label="' + labels[cat] + '">';
      byCategory[cat].forEach(function (t) {
        html += '<option value="' + t.symbol + '">' + t.symbol + ' — ' + t.name + '</option>';
      });
      html += '</optgroup>';
    });
    sel.innerHTML = html;
  }

  function selectSymbol(symbol) {
    if (priceUnsub) priceUnsub();
    state.symbol = symbol;
    document.getElementById('ticker-select').value = symbol;
    renderQuoteHeader(PriceEngine.getQuote(symbol));
    renderChart();
    updateTicketAvailability();
    priceUnsub = PriceEngine.subscribe(symbol, function (q) {
      renderQuoteHeader(q);
      updateChartLive();
      updateTicketAvailability();
    });
    var url = new URL(window.location.href);
    url.searchParams.set('symbol', symbol);
    window.history.replaceState({}, '', url);
  }

  function renderQuoteHeader(q) {
    var priceEl = document.getElementById('quote-price');
    var prevText = priceEl.textContent;
    priceEl.textContent = VTA.fmtPrice(q.price);
    var changeEl = document.getElementById('quote-change');
    changeEl.textContent = VTA.fmtMoney(q.change, { forceSign: true }) + ' (' + VTA.fmtPct(q.changePct) + ')';
    changeEl.className = 'mono ' + VTA.pnlClass(q.change);
    document.getElementById('quote-name').textContent = q.name + ' · ' + q.symbol;
    if (prevText !== priceEl.textContent) VTA.flash(priceEl, q.change >= 0 ? 1 : -1);
  }

  function renderChart() {
    var history = PriceEngine.getHistory(state.symbol, state.range);
    var canvas = document.getElementById('main-chart');
    if (mainChart) mainChart.destroy();
    mainChart = VTACharts.makeMainChart(canvas, history, state.range);
  }

  function updateChartLive() {
    if (!mainChart) return;
    var history = PriceEngine.getHistory(state.symbol, state.range);
    VTACharts.updateMainChart(mainChart, history, state.range);
  }

  function setRange(range) {
    state.range = range;
    document.querySelectorAll('.range-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-range') === range);
    });
    renderChart();
  }

  function setSide(side) {
    state.side = side;
    document.querySelectorAll('.side-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-side') === side);
    });
    var btn = document.getElementById('submit-order');
    var labels = { buy: 'Buy', sell: 'Sell', short: 'Short Sell', cover: 'Buy to Cover' };
    btn.textContent = labels[side];
    btn.className = 'btn btn-block btn-' + side;
    document.getElementById('avail-label').textContent = (side === 'buy' || side === 'cover') ? 'Buying Power' : (side === 'sell' ? 'Shares Available' : 'Account Equity (margin)');
    updateTicketAvailability();
    updateEstTotal();
  }

  function setType(type) {
    state.type = type;
    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-type') === type);
    });
    document.getElementById('limit-field').style.display = type === 'limit' ? '' : 'none';
    updateEstTotal();
  }

  function currentPriceForEstimate() {
    if (state.type === 'limit') {
      var lp = parseFloat(document.getElementById('limit-input').value);
      if (lp > 0) return lp;
    }
    var q = PriceEngine.getQuote(state.symbol);
    return q ? q.price : 0;
  }

  function updateEstTotal() {
    var qty = parseInt(document.getElementById('qty-input').value, 10) || 0;
    var price = currentPriceForEstimate();
    document.getElementById('est-total').textContent = VTA.fmtMoney(qty * price);
  }

  function updateTicketAvailability() {
    var summary = PortfolioEngine.getAccountSummary();
    var valEl = document.getElementById('avail-value');
    if (state.side === 'buy' || state.side === 'cover') {
      valEl.textContent = VTA.fmtMoney(summary.buyingPower);
    } else if (state.side === 'sell') {
      valEl.textContent = VTA.fmtQty(PortfolioEngine.sharesAvailable(state.symbol)) + ' sh';
    } else {
      valEl.textContent = VTA.fmtMoney(summary.equity) + ' equity';
    }
  }

  function showAlert(msg, type) {
    var mount = document.getElementById('order-alert');
    mount.innerHTML = '<div class="alert alert-' + type + '">' + msg + '</div>';
    if (type === 'success') setTimeout(function () { mount.innerHTML = ''; }, 3500);
  }

  function submitOrder() {
    var qty = parseInt(document.getElementById('qty-input').value, 10);
    var opts = { symbol: state.symbol, side: state.side, type: state.type, qty: qty };
    if (state.type === 'limit') opts.limitPrice = parseFloat(document.getElementById('limit-input').value);

    var result = PortfolioEngine.placeOrder(opts);
    if (!result.ok) {
      showAlert(result.error, 'error');
      return;
    }
    if (result.order.status === 'filled') {
      showAlert('Filled: ' + describeOrder(result.order), 'success');
    } else {
      showAlert('Limit order placed and working: ' + describeOrder(result.order), 'info');
    }
    updateTicketAvailability();
    updateEstTotal();
  }

  function describeOrder(o) {
    var verb = { buy: 'Bought', sell: 'Sold', short: 'Shorted', cover: 'Covered' }[o.side];
    var priceStr = o.status === 'filled' ? VTA.fmtPrice(o.fillPrice) : 'limit ' + VTA.fmtPrice(o.limitPrice);
    return verb + ' ' + o.qty + ' ' + o.symbol + ' @ ' + priceStr;
  }

  function renderPositions(summary) {
    summary = summary || PortfolioEngine.getAccountSummary();
    var tbody = document.getElementById('positions-body');
    if (!summary.positions.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No open positions yet. Place a trade to get started.</td></tr>';
      return;
    }
    tbody.innerHTML = summary.positions.map(function (p) {
      return (
        '<tr class="pos-row" data-symbol="' + p.symbol + '" style="cursor:pointer;">' +
        '<td><b>' + p.symbol + '</b></td>' +
        '<td>' + (p.side === 'long' ? '<span class="pos">Long</span>' : '<span class="neg">Short</span>') + '</td>' +
        '<td class="mono">' + VTA.fmtQty(p.qty) + '</td>' +
        '<td class="mono">' + VTA.fmtPrice(p.avgCost) + '</td>' +
        '<td class="mono">' + VTA.fmtPrice(p.mark) + '</td>' +
        '<td class="mono">' + VTA.fmtMoney(p.marketValue) + '</td>' +
        '<td class="mono ' + VTA.pnlClass(p.unrealizedPnl) + '">' + VTA.fmtMoney(p.unrealizedPnl, { forceSign: true }) + '</td>' +
        '<td class="mono ' + VTA.pnlClass(p.unrealizedPnl) + '">' + VTA.fmtPct(p.unrealizedPct) + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function renderLog(summary) {
    summary = summary || PortfolioEngine.getAccountSummary();
    var mount = document.getElementById('exec-log');
    var recent = summary.orders.slice(0, 25);
    if (!recent.length) {
      mount.innerHTML = '<div class="log-entry" style="text-align:center;color:var(--text-faint);">No orders yet.</div>';
      return;
    }
    mount.innerHTML = recent.map(function (o) {
      var statusColor = o.status === 'filled' ? 'pos' : (o.status === 'rejected' ? 'neg' : (o.status === 'open' ? 'flat' : ''));
      var text = describeOrder(o) + ' — <span class="' + statusColor + '">' + o.status.toUpperCase() + '</span>';
      if (o.status === 'open') {
        text += ' <button class="btn btn-sm btn-ghost cancel-order" data-id="' + o.id + '" style="margin-left:6px;">Cancel</button>';
      }
      if (o.note) text += ' <span style="color:var(--text-faint);">(' + o.note + ')</span>';
      return '<div class="log-entry"><span class="log-time">' + VTA.fmtTime(o.ts) + '</span>' + text + '</div>';
    }).join('');
  }

  function refreshAccountUI(summary) {
    renderPositions(summary);
    renderLog(summary);
    updateTicketAvailability();
  }

  document.addEventListener('DOMContentLoaded', function () {
    populateTickerSelect();

    document.getElementById('ticker-select').addEventListener('change', function (e) {
      selectSymbol(e.target.value);
    });
    document.getElementById('range-select').addEventListener('click', function (e) {
      var btn = e.target.closest('.range-btn');
      if (btn) setRange(btn.getAttribute('data-range'));
    });
    document.getElementById('side-toggle').addEventListener('click', function (e) {
      var btn = e.target.closest('.side-btn');
      if (btn) setSide(btn.getAttribute('data-side'));
    });
    document.getElementById('type-tabs').addEventListener('click', function (e) {
      var btn = e.target.closest('.tab-btn');
      if (btn) setType(btn.getAttribute('data-type'));
    });
    document.getElementById('qty-input').addEventListener('input', updateEstTotal);
    document.getElementById('limit-input').addEventListener('input', updateEstTotal);
    document.getElementById('submit-order').addEventListener('click', submitOrder);
    document.getElementById('positions-body').addEventListener('click', function (e) {
      var row = e.target.closest('.pos-row');
      if (row) selectSymbol(row.getAttribute('data-symbol'));
    });
    document.getElementById('exec-log').addEventListener('click', function (e) {
      var btn = e.target.closest('.cancel-order');
      if (!btn) return;
      PortfolioEngine.cancelOrder(parseInt(btn.getAttribute('data-id'), 10));
    });

    setSide('buy');
    setType('market');

    var initial = qs('symbol');
    var valid = initial && PriceEngine.getQuote(initial);
    selectSymbol(valid ? initial.toUpperCase() : 'NOVA');
    setRange('1D');

    refreshAccountUI();
    PortfolioEngine.subscribe(refreshAccountUI);
  });
})();
