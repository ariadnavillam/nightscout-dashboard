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

// Group entries by date
function groupByDay(entries) {
  const byDay = {};
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 7); // last 7 days

  entries.forEach(entry => {
    if (!entry.dateString || typeof entry.dateString !== 'string') return;

    const date = new Date(entry.dateString);
    if (isNaN(date.getTime())) return; // skip if invalid date

    if (date < cutoff) return; // skip if older than 7 days

    const day = date.toISOString().split("T")[0]; // 'YYYY-MM-DD'
    if (!byDay[day]) byDay[day] = [];
    if (typeof entry.sgv === 'number') {
      byDay[day].push(entry.sgv); // only include valid numbers
    }
  });

  return byDay;
}

// Calculate percentage in range for last 7 days, fill missing with 0
function prepareChartData(grouped) {
  const labels = [];
  const data = [];
  const ticks = [];
  const last7Days = getLast7Days();

  last7Days.forEach(day => {
    const readings = grouped[day] || [];
    let pct = 0;
    if (readings.length > 0) {
      const inRange = readings.filter(v => v >= 80 && v <= 180).length;
      pct = Math.round((inRange / readings.length) * 100);
    }
    labels.push(day);
    data.push(pct);
    ticks.push(pct >= 70 ? "✅" : "");
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
