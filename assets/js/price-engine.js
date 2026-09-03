/*
 * price-engine.js
 * Fully self-contained simulated market. No network calls, no real market data.
 * Prices are generated with a geometric-Brownian-motion style random walk on
 * an accelerated "simulated clock" so charts feel alive during a short session.
 */
(function (global) {
  'use strict';

  var TRADING_YEAR_SECONDS = 252 * 6.5 * 3600; // ~5,896,800s in a simulated trading year
  var SIM_SECONDS_PER_TICK = 300;              // each live tick = 5 simulated minutes
  var TICK_MS = 1500;                           // real-world ms between ticks
  var DAILY_HISTORY_DAYS = 180;                 // seeded daily candles for 1M/3M/1Y charts
  var INTRADAY_POINTS = 130;                    // rolling bars shown on the 1D chart

  // ---- Fictitious ticker universe -----------------------------------------
  // vol = annualized volatility, drift = annualized expected return,
  // jump = optional magnitude for rare event shocks (earnings surprise, pump/dump, etc).
  var TICKERS = [
    { symbol: 'NOVA', name: 'Nova Industries',        category: 'blue-chip',    basePrice: 145.20, vol: 0.16, drift: 0.06 },
    { symbol: 'STDY', name: 'Steadicorp Holdings',     category: 'blue-chip',    basePrice: 88.40,  vol: 0.12, drift: 0.05 },
    { symbol: 'GRND', name: 'Granite Utilities',       category: 'blue-chip',    basePrice: 132.75, vol: 0.14, drift: 0.04 },
    { symbol: 'QNTM', name: 'Quantum Dynamics',        category: 'mid-vol',      basePrice: 62.10,  vol: 0.35, drift: 0.10 },
    { symbol: 'GRID', name: 'Gridline Networks',       category: 'mid-vol',      basePrice: 55.30,  vol: 0.30, drift: 0.08 },
    { symbol: 'MOJO', name: 'Mojo Beverage Co',        category: 'momentum',     basePrice: 45.60,  vol: 0.55, drift: 0.18 },
    { symbol: 'VLTX', name: 'Voltix Robotics',         category: 'momentum',     basePrice: 28.90,  vol: 0.65, drift: 0.14 },
    { symbol: 'SHRT', name: 'Shorewell Retail',        category: 'short-target', basePrice: 19.35,  vol: 0.70, drift: -0.22 },
    { symbol: 'SWNG', name: 'Swingfield Biotech',      category: 'earnings',     basePrice: 75.00,  vol: 0.45, drift: 0.05, jump: 0.14 },
    { symbol: 'GLOW', name: 'Glowtide Semiconductor',  category: 'earnings',     basePrice: 95.40,  vol: 0.58, drift: 0.03, jump: 0.16 },
    { symbol: 'TRIX', name: 'TriplEdge 3x Bull ETF',   category: 'leveraged-etf',basePrice: 40.00,  vol: 1.10, drift: -0.30 },
    { symbol: 'HYPE', name: 'HyperCycle Media',        category: 'penny',        basePrice: 3.20,   vol: 0.95, drift: 0.05 },
    { symbol: 'PENY', name: 'Peninsula Mining Corp',   category: 'penny',        basePrice: 0.85,   vol: 1.15, drift: -0.08 },
    { symbol: 'ZAP',  name: 'Zapline Energy',          category: 'penny',        basePrice: 1.45,   vol: 1.30, drift: 0.00, jump: 0.35 }
  ];

  // ---- Seeded PRNG (mulberry32) so history is stable across page loads ----
  function hashSeed(str) {
    var h = 1779033703;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
  }
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randNormal(rng) {
    var u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function genWalk(startPrice, steps, dtYears, vol, drift, rng, jumpMag) {
    var out = [];
    var p = startPrice;
    for (var i = 0; i < steps; i++) {
      var z = randNormal(rng);
      var ret = (drift - 0.5 * vol * vol) * dtYears + vol * Math.sqrt(dtYears) * z;
      if (jumpMag && rng() < 0.012) {
        ret += (rng() < 0.5 ? -1 : 1) * jumpMag * (0.5 + rng());
      }
      var newP = Math.max(0.01, p * Math.exp(ret));
      var hi = Math.max(p, newP) * (1 + rng() * 0.004);
      var lo = Math.min(p, newP) * (1 - rng() * 0.004);
      out.push({ t: null, o: p, h: hi, l: lo, c: newP, v: Math.round(50000 + rng() * 500000) });
      p = newP;
    }
    return out;
  }

  var state = {}; // symbol -> { cfg, price, prevClose, daily[], intraday[], subscribers[] }

  function initTicker(cfg) {
    var rng = mulberry32(hashSeed(cfg.symbol));
    var dtDaily = 1 / 252;
    var daily = genWalk(cfg.basePrice, DAILY_HISTORY_DAYS, dtDaily, cfg.vol, cfg.drift, rng, cfg.jump);
    var now = Date.now();
    var dayMs = 86400000;
    daily.forEach(function (c, i) { c.t = now - (DAILY_HISTORY_DAYS - 1 - i) * dayMs; });

    var lastClose = daily[daily.length - 1].c;
    var dtIntra = SIM_SECONDS_PER_TICK / TRADING_YEAR_SECONDS;
    var intraday = genWalk(lastClose, INTRADAY_POINTS, dtIntra, cfg.vol, cfg.drift, rng, cfg.jump);
    intraday.forEach(function (c, i) { c.t = now - (INTRADAY_POINTS - 1 - i) * SIM_SECONDS_PER_TICK * 1000; });

    state[cfg.symbol] = {
      cfg: cfg,
      price: intraday[intraday.length - 1].c,
      prevClose: lastClose,
      daily: daily,
      intraday: intraday,
      subscribers: []
    };
  }

  TICKERS.forEach(initTicker);

  function getQuote(symbol) {
    var s = state[symbol];
    if (!s) return null;
    var change = s.price - s.prevClose;
    return {
      symbol: symbol,
      name: s.cfg.name,
      category: s.cfg.category,
      price: s.price,
      prevClose: s.prevClose,
      change: change,
      changePct: s.prevClose ? (change / s.prevClose) * 100 : 0
    };
  }

  function getAllQuotes() {
    return TICKERS.map(function (t) { return getQuote(t.symbol); });
  }

  function getHistory(symbol, range) {
    var s = state[symbol];
    if (!s) return [];
    if (range === '1D') return s.intraday.slice();
    var days = { '1W': 7, '1M': 30, '3M': 90, '1Y': 180 }[range] || 30;
    return s.daily.slice(-days);
  }

  function subscribe(symbol, cb) {
    var s = state[symbol];
    if (!s) return function () {};
    s.subscribers.push(cb);
    return function () {
      var i = s.subscribers.indexOf(cb);
      if (i >= 0) s.subscribers.splice(i, 1);
    };
  }

  function subscribeAll(cb) {
    var unsubs = TICKERS.map(function (t) { return subscribe(t.symbol, cb); });
    return function () { unsubs.forEach(function (u) { u(); }); };
  }

  function tick() {
    Object.keys(state).forEach(function (sym) {
      var s = state[sym];
      var cfg = s.cfg;
      var u = 0, v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      var z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      var dtYears = SIM_SECONDS_PER_TICK / TRADING_YEAR_SECONDS;
      var ret = (cfg.drift - 0.5 * cfg.vol * cfg.vol) * dtYears + cfg.vol * Math.sqrt(dtYears) * z;
      if (cfg.jump && Math.random() < 0.01) {
        ret += (Math.random() < 0.5 ? -1 : 1) * cfg.jump * (0.5 + Math.random());
      }
      var newPrice = Math.max(0.01, s.price * Math.exp(ret));
      var t = Date.now();
      var last = s.intraday[s.intraday.length - 1];
      last.h = Math.max(last.h, newPrice);
      last.l = Math.min(last.l, newPrice);
      last.c = newPrice;
      s.intraday.push({ t: t, o: newPrice, h: newPrice, l: newPrice, c: newPrice, v: Math.round(1000 + Math.random() * 20000) });
      if (s.intraday.length > INTRADAY_POINTS) s.intraday.shift();
      s.price = newPrice;

      var quote = getQuote(sym);
      s.subscribers.slice().forEach(function (cb) {
        try { cb(quote); } catch (e) { /* ignore subscriber errors */ }
      });
    });
  }

  setInterval(tick, TICK_MS);

  global.PriceEngine = {
    TICK_MS: TICK_MS,
    tickers: TICKERS.map(function (t) { return { symbol: t.symbol, name: t.name, category: t.category }; }),
    getQuote: getQuote,
    getAllQuotes: getAllQuotes,
    getHistory: getHistory,
    subscribe: subscribe,
    subscribeAll: subscribeAll
  };
})(window);
