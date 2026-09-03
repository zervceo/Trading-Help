/*
 * strategies-data.js
 * Static metadata for the 7 strategy lessons, plus localStorage-backed
 * completion tracking shared by strategies.html, the lesson pages, and
 * the dashboard.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'vta_progress_v1';

  var STRATEGIES = [
    {
      id: 'day-trading-scalping',
      order: 1,
      title: 'Day Trading / Scalping',
      summary: 'Rapid intraday entries and exits capturing small, frequent price moves.',
      volatility: 3,
      ticker: 'VLTX',
      href: 'strategies/day-trading-scalping.html'
    },
    {
      id: 'momentum-trading',
      order: 2,
      title: 'Momentum Trading',
      summary: 'Riding stocks with strong directional volume and price moves.',
      volatility: 3,
      ticker: 'MOJO',
      href: 'strategies/momentum-trading.html'
    },
    {
      id: 'short-selling',
      order: 3,
      title: 'Short Selling',
      summary: 'Profiting from declines: borrowing mechanics, margin, and squeeze risk.',
      volatility: 4,
      ticker: 'SHRT',
      href: 'strategies/short-selling.html'
    },
    {
      id: 'options-straddle-strangle',
      order: 4,
      title: 'Options Straddles / Strangles',
      summary: 'Volatility-based options strategies that profit from big moves either way.',
      volatility: 4,
      ticker: 'GLOW',
      href: 'strategies/options-straddle-strangle.html'
    },
    {
      id: 'leveraged-etf-trading',
      order: 5,
      title: 'Leveraged ETF Trading',
      summary: '2x/3x ETFs, daily-reset decay, and why volatility compounds losses.',
      volatility: 5,
      ticker: 'TRIX',
      href: 'strategies/leveraged-etf-trading.html'
    },
    {
      id: 'penny-stock-trading',
      order: 6,
      title: 'Penny Stock Trading',
      summary: 'Low-float, low-price volatility, liquidity risk, and pump-and-dump awareness.',
      volatility: 5,
      ticker: 'ZAP',
      href: 'strategies/penny-stock-trading.html'
    },
    {
      id: 'earnings-volatility-swing-trading',
      order: 7,
      title: 'Earnings-Volatility Swing Trading',
      summary: 'Holding through earnings-like volatility spikes for multi-day swings.',
      volatility: 4,
      ticker: 'SWNG',
      href: 'strategies/earnings-volatility-swing-trading.html'
    }
  ];

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function save(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function isComplete(id) {
    var data = load();
    return !!data[id];
  }
  function setComplete(id, done) {
    var data = load();
    if (done) data[id] = { completedAt: Date.now() };
    else delete data[id];
    save(data);
  }
  function completedCount() {
    var data = load();
    return STRATEGIES.filter(function (s) { return !!data[s.id]; }).length;
  }
  function getById(id) {
    return STRATEGIES.filter(function (s) { return s.id === id; })[0] || null;
  }

  global.VTAStrategies = {
    list: STRATEGIES,
    isComplete: isComplete,
    setComplete: setComplete,
    completedCount: completedCount,
    getById: getById,
    total: STRATEGIES.length
  };
})(window);
