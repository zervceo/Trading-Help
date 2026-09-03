/*
 * charts.js
 * Thin Chart.js wrappers: watchlist sparklines, the main trade chart, and
 * the portfolio equity-over-time chart. Requires Chart.js to be loaded first.
 */
(function (global) {
  'use strict';

  var COLOR_UP = '#22c55e';
  var COLOR_DOWN = '#ef4444';
  var COLOR_GRID = 'rgba(148, 163, 184, 0.12)';
  var COLOR_AXIS = 'rgba(203, 213, 225, 0.55)';

  function chartAvailable() {
    if (typeof global.Chart === 'undefined') {
      return false;
    }
    return true;
  }

  function makeSparkline(canvas, history) {
    if (!chartAvailable() || !canvas) return null;
    var closes = history.map(function (c) { return c.c; });
    var up = closes.length > 1 && closes[closes.length - 1] >= closes[0];
    var color = up ? COLOR_UP : COLOR_DOWN;
    return new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: closes.map(function (_, i) { return i; }),
        datasets: [{
          data: closes,
          borderColor: color,
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.25,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { intersect: false },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: { display: false }
        },
        elements: { line: { capBezierPoints: false } }
      }
    });
  }

  function updateSparkline(chart, history) {
    if (!chart) return;
    var closes = history.map(function (c) { return c.c; });
    var up = closes.length > 1 && closes[closes.length - 1] >= closes[0];
    chart.data.labels = closes.map(function (_, i) { return i; });
    chart.data.datasets[0].data = closes;
    chart.data.datasets[0].borderColor = up ? COLOR_UP : COLOR_DOWN;
    chart.update('none');
  }

  function labelForPoint(t, range) {
    var d = new Date(t);
    if (range === '1D') return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function makeMainChart(canvas, history, range) {
    if (!chartAvailable() || !canvas) return null;
    var closes = history.map(function (c) { return c.c; });
    var labels = history.map(function (c) { return labelForPoint(c.t, range); });
    var up = closes.length > 1 && closes[closes.length - 1] >= closes[0];
    var color = up ? COLOR_UP : COLOR_DOWN;
    var ctx = canvas.getContext('2d');
    var gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 320);
    gradient.addColorStop(0, up ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)');
    gradient.addColorStop(1, up ? 'rgba(34,197,94,0.02)' : 'rgba(239,68,68,0.02)');

    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          data: closes,
          borderColor: color,
          backgroundColor: gradient,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: color,
          tension: 0.2,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#111827',
            borderColor: 'rgba(148,163,184,0.25)',
            borderWidth: 1,
            titleColor: '#e2e8f0',
            bodyColor: '#e2e8f0',
            callbacks: {
              label: function (item) { return '$' + item.parsed.y.toFixed(2); }
            }
          }
        },
        scales: {
          x: {
            grid: { color: COLOR_GRID },
            ticks: { color: COLOR_AXIS, maxTicksLimit: 8, autoSkip: true },
            border: { display: false }
          },
          y: {
            grid: { color: COLOR_GRID },
            ticks: { color: COLOR_AXIS, callback: function (v) { return '$' + Number(v).toFixed(2); } },
            border: { display: false }
          }
        }
      }
    });
  }

  function updateMainChart(chart, history, range) {
    if (!chart) return;
    var closes = history.map(function (c) { return c.c; });
    var labels = history.map(function (c) { return labelForPoint(c.t, range); });
    var up = closes.length > 1 && closes[closes.length - 1] >= closes[0];
    var color = up ? COLOR_UP : COLOR_DOWN;
    chart.data.labels = labels;
    chart.data.datasets[0].data = closes;
    chart.data.datasets[0].borderColor = color;
    var ctx = chart.ctx;
    var gradient = ctx.createLinearGradient(0, 0, 0, chart.height || 320);
    gradient.addColorStop(0, up ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)');
    gradient.addColorStop(1, up ? 'rgba(34,197,94,0.02)' : 'rgba(239,68,68,0.02)');
    chart.data.datasets[0].backgroundColor = gradient;
    chart.update('none');
  }

  function makeEquityChart(canvas, points) {
    if (!chartAvailable() || !canvas) return null;
    var ctx = canvas.getContext('2d');
    var values = points.map(function (p) { return p.equity; });
    var up = values.length > 1 && values[values.length - 1] >= values[0];
    var color = up ? COLOR_UP : COLOR_DOWN;
    var gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 260);
    gradient.addColorStop(0, up ? 'rgba(34,197,94,0.30)' : 'rgba(239,68,68,0.30)');
    gradient.addColorStop(1, 'rgba(34,197,94,0.0)');
    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: points.map(function (p) { return new Date(p.t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }),
        datasets: [{
          data: values,
          borderColor: color,
          backgroundColor: gradient,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.15,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#111827', borderColor: 'rgba(148,163,184,0.25)', borderWidth: 1,
            titleColor: '#e2e8f0', bodyColor: '#e2e8f0',
            callbacks: { label: function (item) { return '$' + item.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 2 }); } }
          }
        },
        scales: {
          x: { grid: { color: COLOR_GRID }, ticks: { color: COLOR_AXIS, maxTicksLimit: 6 }, border: { display: false } },
          y: { grid: { color: COLOR_GRID }, ticks: { color: COLOR_AXIS, callback: function (v) { return '$' + Number(v).toLocaleString('en-US'); } }, border: { display: false } }
        }
      }
    });
  }

  global.VTACharts = {
    makeSparkline: makeSparkline,
    updateSparkline: updateSparkline,
    makeMainChart: makeMainChart,
    updateMainChart: updateMainChart,
    makeEquityChart: makeEquityChart
  };
})(window);
