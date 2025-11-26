import type { VisualizationData } from "../lib/types.ts";

/** Format date range as "Jan 1 – Dec 31, 2024" */
function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const startMonth = months[startDate.getMonth()];
  const startDay = startDate.getDate();
  const endMonth = months[endDate.getMonth()];
  const endDay = endDate.getDate();
  const year = endDate.getFullYear();

  return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
}

/** Generate the HTML visualization with neubrutalism styling */
export function generateHTML(data: VisualizationData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>gitfill - Contribution Overview</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #000000;
            --text: #ffffff;
            --border: #ffffff;
            --shadow: #ffffff;
            --muted: #999999;

            /* Real commits - solid white at varying opacity */
            --real-0: transparent;
            --real-1: rgba(255,255,255,0.15);
            --real-2: rgba(255,255,255,0.35);
            --real-3: rgba(255,255,255,0.6);
            --real-4: rgba(255,255,255,0.9);

            /* Fake commits - warm orange/amber */
            --fake-0: transparent;
            --fake-1: rgba(255,165,80,0.25);
            --fake-2: rgba(255,165,80,0.45);
            --fake-3: rgba(255,165,80,0.7);
            --fake-4: rgba(255,165,80,0.95);
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: 'JetBrains Mono', monospace;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            padding: 48px 24px;
        }

        .container {
            max-width: 1000px;
            margin: 0 auto;
        }

        header {
            margin-bottom: 40px;
        }

        h1 {
            font-size: 32px;
            font-weight: 700;
            letter-spacing: -1px;
            text-transform: uppercase;
        }

        .subtitle {
            color: var(--muted);
            font-size: 14px;
            font-weight: 400;
            margin-top: 4px;
        }

        .meta {
            color: var(--muted);
            font-size: 12px;
            margin-top: 8px;
            opacity: 0.7;
        }

        .stats {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 16px;
            margin-bottom: 40px;
        }

        .stat {
            background: var(--bg);
            border: 1px solid var(--border);
            box-shadow: 2px 2px 0 var(--shadow);
            padding: 20px 16px;
            text-align: center;
        }

        .stat-value {
            font-size: 36px;
            font-weight: 700;
            line-height: 1;
        }

        .stat-label {
            font-size: 10px;
            color: var(--muted);
            margin-top: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .graph-card {
            background: var(--bg);
            border: 1px solid var(--border);
            box-shadow: 3px 3px 0 var(--shadow);
            padding: 32px;
            margin-bottom: 24px;
        }

        .graph-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--border);
        }

        .graph-title {
            font-size: 14px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .legend {
            display: flex;
            align-items: center;
            gap: 24px;
            font-size: 11px;
        }

        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .legend-box {
            width: 14px;
            height: 14px;
            border: 1px solid var(--border);
        }

        .legend-box.real {
            background: var(--real-3);
        }

        .legend-box.fake {
            background: var(--fake-3);
        }

        .legend-box.combined {
            background: linear-gradient(135deg, var(--real-3) 50%, var(--fake-3) 50%);
        }

        .months {
            display: flex;
            font-size: 11px;
            color: var(--muted);
            margin-bottom: 8px;
            padding-left: 36px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .month { flex: 1; }

        .graph-wrapper {
            display: flex;
            gap: 6px;
            overflow-x: auto;
            padding-bottom: 8px;
        }

        .days-labels {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            font-size: 10px;
            color: var(--muted);
            padding: 2px 8px 2px 0;
            height: 98px;
            flex-shrink: 0;
        }

        .calendar {
            display: flex;
            gap: 3px;
            flex: 1;
        }

        .week {
            display: flex;
            flex-direction: column;
            gap: 3px;
        }

        .day {
            width: 12px;
            height: 12px;
            border: 1px solid rgba(255,255,255,0.15);
            background: var(--bg);
            cursor: pointer;
            position: relative;
            transition: transform 0.1s;
        }

        .day:hover {
            transform: scale(1.5);
            z-index: 10;
            border-color: var(--border);
            box-shadow: 1px 1px 0 var(--shadow);
        }

        /* Real commits - solid fills */
        .day.real[data-level="1"] { background: var(--real-1); }
        .day.real[data-level="2"] { background: var(--real-2); }
        .day.real[data-level="3"] { background: var(--real-3); }
        .day.real[data-level="4"] { background: var(--real-4); }

        /* Fake commits - solid orange/amber fills */
        .day.fake[data-level="1"] { background: var(--fake-1); }
        .day.fake[data-level="2"] { background: var(--fake-2); }
        .day.fake[data-level="3"] { background: var(--fake-3); }
        .day.fake[data-level="4"] { background: var(--fake-4); }

        /* Combined - split diagonal (white + orange) */
        .day.combined[data-level="1"] {
            background: linear-gradient(135deg, var(--real-1) 50%, var(--fake-1) 50%);
        }
        .day.combined[data-level="2"] {
            background: linear-gradient(135deg, var(--real-2) 50%, var(--fake-2) 50%);
        }
        .day.combined[data-level="3"] {
            background: linear-gradient(135deg, var(--real-3) 50%, var(--fake-3) 50%);
        }
        .day.combined[data-level="4"] {
            background: linear-gradient(135deg, var(--real-4) 50%, var(--fake-4) 50%);
        }

        .tooltip {
            position: fixed;
            background: var(--bg);
            border: 1px solid var(--border);
            box-shadow: 2px 2px 0 var(--shadow);
            padding: 8px 12px;
            font-size: 11px;
            pointer-events: none;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.1s;
        }

        .tooltip.visible { opacity: 1; }
        .tooltip .date { font-weight: 700; margin-bottom: 4px; }
        .tooltip .counts { color: var(--muted); }

        footer {
            text-align: center;
            color: var(--muted);
            font-size: 11px;
            margin-top: 48px;
            opacity: 0.6;
        }

        /* Mobile responsiveness */
        @media (max-width: 900px) {
            .stats {
                grid-template-columns: repeat(3, 1fr);
            }
        }

        @media (max-width: 768px) {
            body { padding: 24px 16px; }

            h1 { font-size: 24px; }

            .stats {
                grid-template-columns: repeat(2, 1fr);
                gap: 12px;
            }

            .stat {
                padding: 16px 12px;
                box-shadow: 3px 3px 0 var(--shadow);
            }

            .stat-value { font-size: 28px; }

            .graph-card {
                padding: 20px;
                box-shadow: 4px 4px 0 var(--shadow);
            }

            .graph-header {
                flex-direction: column;
                align-items: flex-start;
                gap: 12px;
            }

            .day { width: 10px; height: 10px; }
            .days-labels { height: 82px; }
        }

        @media (max-width: 480px) {
            body { padding: 16px 12px; }

            h1 { font-size: 20px; }

            .stats {
                grid-template-columns: 1fr 1fr;
                gap: 10px;
            }

            .stat:last-child {
                grid-column: span 2;
            }

            .stat-value { font-size: 24px; }
            .stat-label { font-size: 9px; }

            .graph-card { padding: 16px; }

            .legend {
                flex-direction: column;
                align-items: flex-start;
                gap: 8px;
            }

            .day { width: 8px; height: 8px; }
            .week { gap: 2px; }
            .calendar { gap: 2px; }
            .days-labels { height: 66px; font-size: 9px; }
            .months { font-size: 9px; padding-left: 28px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>gitfill</h1>
            <p class="subtitle">Contribution overview: fake commits vs real activity</p>
            <p class="meta">${
    formatDateRange(data.startDate, data.endDate)
  } · ${data.density} density</p>
        </header>

        <div class="stats">
            <div class="stat">
                <div class="stat-value">${data.stats.totalFake.toLocaleString()}</div>
                <div class="stat-label">Fake Commits</div>
            </div>
            <div class="stat">
                <div class="stat-value">${data.stats.totalReal.toLocaleString()}</div>
                <div class="stat-label">Real Commits</div>
            </div>
            <div class="stat">
                <div class="stat-value">${data.stats.fakeDays}</div>
                <div class="stat-label">Fake Days</div>
            </div>
            <div class="stat">
                <div class="stat-value">${data.stats.realDays}</div>
                <div class="stat-label">Real Days</div>
            </div>
            <div class="stat">
                <div class="stat-value">${data.stats.peakDays}</div>
                <div class="stat-label">Peak Days</div>
            </div>
        </div>

        <div class="graph-card">
            <div class="graph-header">
                <span class="graph-title">Contribution Grid</span>
                <div class="legend">
                    <div class="legend-item">
                        <div class="legend-box real"></div>
                        <span>Real</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-box fake"></div>
                        <span>Fake</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-box combined"></div>
                        <span>Both</span>
                    </div>
                </div>
            </div>
            <div class="months" id="months"></div>
            <div class="graph-wrapper">
                <div class="days-labels"><span>Mon</span><span>Wed</span><span>Fri</span></div>
                <div class="calendar" id="calendar"></div>
            </div>
        </div>

        <footer>Generated by gitfill</footer>
    </div>

    <div class="tooltip" id="tooltip"></div>

    <script>
        const data = ${JSON.stringify(data)};
        const tooltip = document.getElementById('tooltip');

        const getContributionLevel = (count) => count === 0 ? 0 : count <= 3 ? 1 : count <= 10 ? 2 : count <= 50 ? 3 : 4;
        const formatDateString = (date) => date.toISOString().split('T')[0];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        function buildCalendar() {
            const calendar = document.getElementById('calendar');

            // Full year: Jan 1 to Dec 31
            const year = new Date(data.startDate).getFullYear();
            const start = new Date(year, 0, 1);  // Jan 1
            const end = new Date(year, 11, 31);  // Dec 31

            // Start from first Sunday before Jan 1
            const firstSunday = new Date(start);
            firstSunday.setDate(firstSunday.getDate() - firstSunday.getDay());

            let currentDate = new Date(firstSunday);
            let weekEl = null;

            while (currentDate <= end || currentDate.getDay() !== 0) {
                if (currentDate.getDay() === 0) {
                    weekEl = document.createElement('div');
                    weekEl.className = 'week';
                    calendar.appendChild(weekEl);
                }

                const dateStr = formatDateString(currentDate);
                const fakeCount = data.fake[dateStr] || 0;
                const realCount = data.real[dateStr] || 0;
                const count = fakeCount + realCount;
                const inRange = currentDate >= start && currentDate <= end;

                const day = document.createElement('div');
                day.className = 'day';
                day.dataset.level = inRange ? getContributionLevel(count) : 0;
                day.dataset.date = dateStr;
                day.dataset.fake = fakeCount;
                day.dataset.real = realCount;

                // Determine type based on which commits exist
                if (fakeCount > 0 && realCount > 0) {
                    day.classList.add('combined');
                } else if (fakeCount > 0) {
                    day.classList.add('fake');
                } else if (realCount > 0) {
                    day.classList.add('real');
                }

                day.addEventListener('mouseenter', (event) => {
                    const fakeDayCount = event.target.dataset.fake;
                    const realDayCount = event.target.dataset.real;
                    const dayDate = event.target.dataset.date;
                    tooltip.innerHTML = '<div class="date">' + dayDate + '</div><div class="counts">' + fakeDayCount + ' fake / ' + realDayCount + ' real</div>';
                    tooltip.classList.add('visible');
                });
                day.addEventListener('mousemove', (event) => {
                    tooltip.style.left = event.clientX + 12 + 'px';
                    tooltip.style.top = event.clientY + 12 + 'px';
                });
                day.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));

                weekEl.appendChild(day);
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        function buildMonths() {
            const months = document.getElementById('months');
            const year = new Date(data.startDate).getFullYear();

            for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
                const span = document.createElement('span');
                span.className = 'month';
                span.textContent = monthNames[monthIndex];
                months.appendChild(span);
            }
        }

        buildMonths();
        buildCalendar();
    </script>
</body>
</html>`;
}
