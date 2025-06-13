const oneWeekAgo = new Date();
oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
const isoDate = oneWeekAgo.toISOString();

const proxyUrl = `https://nightscout-proxy-1029015683854.europe-west4.run.app/entries`;

// Fetch data and process
fetch(proxyUrl)
  .then(res => res.json())
  .then(data => {
    const grouped = groupByDay(data);
    const chartData = prepareChartData(grouped);
    renderChart(chartData);

    // --- Added code for glucoseChart ---
    const ctx = document.getElementById('glucoseChart').getContext('2d');
    const chart = new Chart(ctx, {
      type: 'bar',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false, // Important: allows the height to grow
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: '% Time in Range'
            }
          }
        }
      }
    });
    // --- End added code ---
  })
  .catch(err => console.error("Error fetching data:", err));

// Helper: get array of last 7 days as YYYY-MM-DD
function getLast7Days() {
  const days = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

// Group every entry (timestamp + sgv) by day
function groupByDay(entries) {
  const byDay = {};
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);   // keep only the last 7 × 24 h

  entries.forEach(entry => {
    if (!entry.dateString || typeof entry.dateString !== 'string') return;
    if (typeof entry.sgv !== 'number') return;

    const ts = new Date(entry.dateString);
    if (isNaN(ts) || ts < cutoff) return;

    const day = ts.toISOString().split('T')[0];            // “YYYY‑MM‑DD”
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push({ ts, sgv: entry.sgv });               // keep both ts & value
  });

  // sort each day’s readings chronologically (needed for Δ‑minutes calc)
  Object.values(byDay).forEach(arr =>
    arr.sort((a, b) => a.ts - b.ts)
  );

  return byDay;
}

// Calculate %‑time‑in‑range (80‑180 mg/dL) using minutes‑weighting
function prepareChartData(grouped) {
  const labels = [];
  const data   = [];
  const ticks  = [];
  const last7  = getLast7Days();

  last7.forEach(day => {
    const readings = grouped[day] || [];

    // ----- time‑in‑range calculation -----
    let inRangeMin = 0;
    let dayEnd     = new Date(`${day}T23:59:59Z`).getTime();
    const DAY_MIN  = 1440;

    readings.forEach((cur, idx) => {
      const curTime  = cur.ts.getTime();
      const nextTime = (idx < readings.length - 1)
        ? readings[idx + 1].ts.getTime()
        : dayEnd;

      const deltaMin = (nextTime - curTime) / 60000;        // ms → minutes
      if (cur.sgv >= 80 && cur.sgv <= 180) inRangeMin += deltaMin;
    });

    const pct = Math.round((inRangeMin / DAY_MIN) * 100);   // normalise by 1 day
    // -------------------------------------

    labels.push(day);
    data.push(pct);
    ticks.push(pct >= 70 ? '✅' : '');
  });

  return { labels, data, ticks };
}

// Render Chart.js horizontal bar chart
function renderChart({ labels, data, ticks }) {
  new Chart(document.getElementById('tirChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '% In Range (80–180)',
        data,
        backgroundColor: data.map(pct => pct >= 70 ? '#4CAF50' : '#f44336')
      }]
    },
    options: {
      indexAxis: 'y', // Switch to horizontal bars
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            afterLabel: (ctx) => ticks[ctx.dataIndex] ? '✅ Great job!' : ''
          }
        },
        legend: { display: false }
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          title: { display: true, text: 'Percentage (%)' },
          grid: { display: false } // Remove grid lines
        },
        y: {
          grid: { display: false } // Remove grid lines
        }
      }
    }
  });
  
}
