/*
 * portfolio-engine.js
 * Client-side paper-trading brokerage simulation. Persists to localStorage.
 * Depends on price-engine.js being loaded first (window.PriceEngine).
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'vta_account_v1';
  var STARTING_CASH = 100000;
  var COMMISSION = 0; // change this constant to simulate per-trade commissions
  var MARGIN_REQUIREMENT = 1.5; // 150% of short exposure must be covered by equity

  var PE = global.PriceEngine;
  var listeners = [];
  var account = null;

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  var EQUITY_SNAPSHOT_MS = 20000; // sample equity for the chart at most this often
  var EQUITY_HISTORY_MAX = 500;

  function freshAccount() {
    var equity = STARTING_CASH;
    var now = Date.now();
    return {
      cash: STARTING_CASH,
      reservedCash: 0,
      reservedShares: {},          // symbol -> qty reserved by open sell-limit orders
      positions: {},               // symbol -> { side: 'long'|'short', qty, avgCost }
      orders: [],                  // full order history, newest last
      realizedPnl: 0,
      nextOrderId: 1,
      dayStartDate: todayKey(),
      dayStartEquity: equity,
      equityHistory: [{ t: now, equity: equity }],
      createdAt: now
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return freshAccount();
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.cash !== 'number') return freshAccount();
      if (!parsed.reservedShares) parsed.reservedShares = {};
      if (typeof parsed.reservedCash !== 'number') parsed.reservedCash = 0;
      if (!parsed.equityHistory || !parsed.equityHistory.length) {
        parsed.equityHistory = [{ t: Date.now(), equity: computeEquityFor(parsed) }];
      }
      if (parsed.dayStartDate !== todayKey()) {
        parsed.dayStartDate = todayKey();
        parsed.dayStartEquity = computeEquityFor(parsed);
      }
      return parsed;
    } catch (e) {
      return freshAccount();
    }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(account)); } catch (e) { /* storage full/unavailable */ }
  }

  function notify() {
    recordEquitySnapshot();
    var summary = getAccountSummary();
    listeners.slice().forEach(function (cb) { try { cb(summary); } catch (e) {} });
  }

  function recordEquitySnapshot() {
    var hist = account.equityHistory;
    var now = Date.now();
    var last = hist[hist.length - 1];
    if (last && now - last.t < EQUITY_SNAPSHOT_MS) return;
    hist.push({ t: now, equity: computeEquityFor(account) });
    if (hist.length > EQUITY_HISTORY_MAX) hist.shift();
  }

  function markPrice(symbol) {
    var q = PE.getQuote(symbol);
    return q ? q.price : 0;
  }

  function computeEquityFor(acct) {
    var equity = acct.cash;
    Object.keys(acct.positions).forEach(function (sym) {
      var pos = acct.positions[sym];
      var mark = markPrice(sym);
      if (pos.side === 'long') equity += pos.qty * mark;
      else equity -= pos.qty * mark;
    });
    return equity;
  }

  function buyingPower() {
    return account.cash - account.reservedCash;
  }

  function sharesAvailable(symbol) {
    var pos = account.positions[symbol];
    var held = pos && pos.side === 'long' ? pos.qty : 0;
    var reserved = account.reservedShares[symbol] || 0;
    return held - reserved;
  }

  function totalShortExposure(extraSymbol, extraQty) {
    var total = 0;
    Object.keys(account.positions).forEach(function (sym) {
      var pos = account.positions[sym];
      if (pos.side !== 'short') return;
      var qty = pos.qty + (sym === extraSymbol ? (extraQty || 0) : 0);
      total += qty * markPrice(sym);
    });
    if (extraSymbol && !account.positions[extraSymbol]) {
      total += (extraQty || 0) * markPrice(extraSymbol);
    }
    return total;
  }

  function fmtErr(msg) { return { ok: false, error: msg }; }

  // ---- Core fills -----------------------------------------------------
  function applyBuy(symbol, qty, price) {
    var cost = qty * price + COMMISSION;
    account.cash -= cost;
    var pos = account.positions[symbol];
    if (pos && pos.side === 'long') {
      var totalCost = pos.avgCost * pos.qty + qty * price;
      pos.qty += qty;
      pos.avgCost = totalCost / pos.qty;
    } else {
      account.positions[symbol] = { side: 'long', qty: qty, avgCost: price };
    }
  }

  function applySell(symbol, qty, price) {
    var proceeds = qty * price - COMMISSION;
    account.cash += proceeds;
    var pos = account.positions[symbol];
    account.realizedPnl += (price - pos.avgCost) * qty;
    pos.qty -= qty;
    if (pos.qty <= 0.0000001) delete account.positions[symbol];
  }

  function applyShort(symbol, qty, price) {
    var proceeds = qty * price - COMMISSION;
    account.cash += proceeds;
    var pos = account.positions[symbol];
    if (pos && pos.side === 'short') {
      var totalCost = pos.avgCost * pos.qty + qty * price;
      pos.qty += qty;
      pos.avgCost = totalCost / pos.qty;
    } else {
      account.positions[symbol] = { side: 'short', qty: qty, avgCost: price };
    }
  }

  function applyCover(symbol, qty, price) {
    var cost = qty * price + COMMISSION;
    account.cash -= cost;
    var pos = account.positions[symbol];
    account.realizedPnl += (pos.avgCost - price) * qty;
    pos.qty -= qty;
    if (pos.qty <= 0.0000001) delete account.positions[symbol];
  }

  // ---- Validation -------------------------------------------------------
  function validate(symbol, side, qty, priceForCheck) {
    if (!PE.getQuote(symbol)) return 'Unknown ticker "' + symbol + '".';
    if (!qty || qty <= 0 || !isFinite(qty)) return 'Enter a quantity greater than zero.';
    if (qty !== Math.floor(qty)) return 'Quantity must be a whole number of shares.';

    if (side === 'buy') {
      var cost = qty * priceForCheck;
      if (cost > buyingPower() + 1e-6) return 'Insufficient buying power. Need $' + cost.toFixed(2) + ', available $' + buyingPower().toFixed(2) + '.';
    } else if (side === 'sell') {
      if (qty > sharesAvailable(symbol) + 1e-6) return 'Insufficient shares. You have ' + sharesAvailable(symbol) + ' available to sell.';
    } else if (side === 'short') {
      var exposure = totalShortExposure(symbol, qty);
      var equity = computeEquityFor(account);
      if (equity < exposure * MARGIN_REQUIREMENT - 1e-6) {
        return 'Insufficient margin. Shorting requires ' + (MARGIN_REQUIREMENT * 100) + '% equity coverage of short exposure ($' + (exposure * MARGIN_REQUIREMENT).toFixed(2) + ' needed, $' + equity.toFixed(2) + ' available).';
      }
    } else if (side === 'cover') {
      var pos = account.positions[symbol];
      var shortHeld = pos && pos.side === 'short' ? pos.qty : 0;
      if (qty > shortHeld + 1e-6) return 'You are only short ' + shortHeld + ' shares of ' + symbol + '.';
      var coverCost = qty * priceForCheck;
      if (coverCost > buyingPower() + 1e-6) return 'Insufficient buying power to cover. Need $' + coverCost.toFixed(2) + ', available $' + buyingPower().toFixed(2) + '.';
    }
    return null;
  }

  function pushOrder(order) {
    order.id = account.nextOrderId++;
    account.orders.push(order);
    return order;
  }

  // ---- Public order API --------------------------------------------------
  function placeOrder(opts) {
    var symbol = (opts.symbol || '').toUpperCase();
    var side = opts.side;         // 'buy' | 'sell' | 'short' | 'cover'
    var type = opts.type || 'market'; // 'market' | 'limit'
    var qty = Math.floor(Number(opts.qty));
    var limitPrice = opts.limitPrice != null ? Number(opts.limitPrice) : null;

    var quote = PE.getQuote(symbol);
    if (!quote) return fmtErr('Unknown ticker "' + symbol + '".');

    if (type === 'limit' && (!limitPrice || limitPrice <= 0)) {
      return fmtErr('Enter a valid limit price.');
    }

    var checkPrice = type === 'limit' ? limitPrice : quote.price;
    var err = validate(symbol, side, qty, checkPrice);
    if (err) return fmtErr(err);

    if (type === 'market') {
      var order = pushOrder({
        ts: Date.now(), symbol: symbol, side: side, type: 'market',
        qty: qty, limitPrice: null, status: 'filled', fillPrice: quote.price
      });
      execute(symbol, side, qty, quote.price);
      save(); notify();
      return { ok: true, order: order };
    }

    // Limit order: reserve resources, queue it, wire up a live check.
    if (side === 'buy' || side === 'cover') {
      account.reservedCash += qty * limitPrice;
    } else if (side === 'sell') {
      account.reservedShares[symbol] = (account.reservedShares[symbol] || 0) + qty;
    }
    var openOrder = pushOrder({
      ts: Date.now(), symbol: symbol, side: side, type: 'limit',
      qty: qty, limitPrice: limitPrice, status: 'open', fillPrice: null
    });
    save(); notify();
    return { ok: true, order: openOrder };
  }

  function execute(symbol, side, qty, price) {
    if (side === 'buy') applyBuy(symbol, qty, price);
    else if (side === 'sell') applySell(symbol, qty, price);
    else if (side === 'short') applyShort(symbol, qty, price);
    else if (side === 'cover') applyCover(symbol, qty, price);
  }

  function releaseReservation(order) {
    if (order.side === 'buy' || order.side === 'cover') {
      account.reservedCash = Math.max(0, account.reservedCash - order.qty * order.limitPrice);
    } else if (order.side === 'sell') {
      var sym = order.symbol;
      account.reservedShares[sym] = Math.max(0, (account.reservedShares[sym] || 0) - order.qty);
    }
  }

  function cancelOrder(orderId) {
    var order = account.orders.filter(function (o) { return o.id === orderId; })[0];
    if (!order || order.status !== 'open') return fmtErr('Order cannot be cancelled.');
    releaseReservation(order);
    order.status = 'cancelled';
    save(); notify();
    return { ok: true };
  }

  function checkOpenLimitOrders(symbol) {
    var quote = PE.getQuote(symbol);
    if (!quote) return;
    var openOrders = account.orders.filter(function (o) { return o.status === 'open' && o.symbol === symbol; });
    openOrders.forEach(function (order) {
      var price = quote.price;
      var shouldFill = false;
      if (order.side === 'buy' && price <= order.limitPrice) shouldFill = true;
      else if (order.side === 'cover' && price <= order.limitPrice) shouldFill = true;
      else if (order.side === 'sell' && price >= order.limitPrice) shouldFill = true;
      else if (order.side === 'short' && price >= order.limitPrice) shouldFill = true;
      if (!shouldFill) return;

      var fillPrice = order.limitPrice;
      var err = validate(order.symbol, order.side, order.qty, fillPrice);
      if (err) {
        releaseReservation(order);
        order.status = 'rejected';
        order.note = err;
        return;
      }
      releaseReservation(order);
      execute(order.symbol, order.side, order.qty, fillPrice);
      order.status = 'filled';
      order.fillPrice = fillPrice;
      order.filledTs = Date.now();
    });
  }

  // ---- Summaries used by the UI -----------------------------------------
  function getAccountSummary() {
    var positions = Object.keys(account.positions).map(function (sym) {
      var pos = account.positions[sym];
      var mark = markPrice(sym);
      var marketValue = pos.qty * mark;
      var unrealized = pos.side === 'long' ? (mark - pos.avgCost) * pos.qty : (pos.avgCost - mark) * pos.qty;
      return {
        symbol: sym, side: pos.side, qty: pos.qty, avgCost: pos.avgCost,
        mark: mark, marketValue: marketValue, unrealizedPnl: unrealized,
        unrealizedPct: pos.avgCost ? (unrealized / (pos.avgCost * pos.qty)) * 100 : 0
      };
    });
    var equity = computeEquityFor(account);
    var unrealizedTotal = positions.reduce(function (s, p) { return s + p.unrealizedPnl; }, 0);
    return {
      cash: account.cash,
      buyingPower: buyingPower(),
      reservedCash: account.reservedCash,
      equity: equity,
      positions: positions,
      realizedPnl: account.realizedPnl,
      unrealizedPnl: unrealizedTotal,
      totalPnl: equity - STARTING_CASH,
      dayPnl: equity - account.dayStartEquity,
      orders: account.orders.slice().reverse(),
      openOrders: account.orders.filter(function (o) { return o.status === 'open'; }),
      equityHistory: account.equityHistory.slice(),
      startingCash: STARTING_CASH,
      marginRequirement: MARGIN_REQUIREMENT,
      commission: COMMISSION
    };
  }

  function resetAccount() {
    account = freshAccount();
    save();
    notify();
  }

  function subscribe(cb) {
    listeners.push(cb);
    return function () {
      var i = listeners.indexOf(cb);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  // ---- Boot ---------------------------------------------------------------
  account = load();
  save();

  PE.subscribeAll(function (quote) {
    checkOpenLimitOrders(quote.symbol);
    save();
    notify();
  });

  global.PortfolioEngine = {
    STARTING_CASH: STARTING_CASH,
    COMMISSION: COMMISSION,
    MARGIN_REQUIREMENT: MARGIN_REQUIREMENT,
    placeOrder: placeOrder,
    cancelOrder: cancelOrder,
    getAccountSummary: getAccountSummary,
    resetAccount: resetAccount,
    subscribe: subscribe,
    sharesAvailable: sharesAvailable,
    buyingPower: buyingPower
  };
})(window);
