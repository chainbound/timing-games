#!/usr/bin/env bun

// Setup JSDOM FIRST before importing Plot
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
global.document = dom.window.document;
global.window = dom.window;

// Now import Plot and other dependencies
import * as Plot from "@observablehq/plot";
import * as d3 from "d3";
import { readFileSync, writeFileSync } from "fs";

// Parse command line arguments
const csvFile = process.argv[2] || "data.csv";
const outputFile = process.argv[3] || "index.html";
const startBlock = process.argv[4] || "unknown";
const amount = process.argv[5] || "unknown";

// Read and parse CSV data
const csvData = readFileSync(csvFile, "utf-8");
const data = d3.csvParse(csvData, d3.autoType);

const maxBlocks = d3.max(data, (d) => d.num_blocks);

// Auto-detect bucket size from the data
const bucketSize = data.length > 1 ? data[1].ms_bucket - data[0].ms_bucket : 200;

// Calculate dynamic width based on number of data points
// Give each bar ~40px width for proper label spacing
const plotWidth = Math.max(1400, data.length * 40);

// Define metrics with their colors
const metrics = [
  { name: "mean", field: "mean_increase_eth", color: "#4e79a7" },
  { name: "p50", field: "p50_increase_eth", color: "#f28e2c" },
  { name: "p95", field: "p95_increase_eth", color: "#e15759" },
  { name: "p99", field: "p99_increase_eth", color: "#76b7b2" },
  { name: "max", field: "max_increase_eth", color: "#59a14f" },
];

// Create separate plots for each metric
const plots = metrics.map((metric) => {
  const metricData = data.map((d) => ({
    ms_bucket: d.ms_bucket,
    value: d[metric.field],
    num_blocks: d.num_blocks,
  }));

  return Plot.plot({
    title: metric.name.toUpperCase(),
    width: plotWidth,
    height: 150,
    marginLeft: 80,
    marginBottom: 50,
    marginTop: 30,
    x: {
      label: null,
      tickFormat: (d) => `${d}ms`,
    },
    y: {
      label: "ETH",
      grid: true,
    },
    marks: [
      Plot.barY(metricData, {
        x: "ms_bucket",
        y: "value",
        fill: metric.color,
        opacity: (d) => 0.5 + 0.5 * (d.num_blocks / maxBlocks),
        title: (d) =>
          `Bucket: ${d.ms_bucket}ms - ${d.ms_bucket + bucketSize}ms\n${metric.name}: ${d.value.toFixed(9)} ETH\nBlocks: ${d.num_blocks}`,
      }),
      Plot.ruleY([0]),
      // Add ETH value on top of bars
      Plot.text(metricData, {
        x: "ms_bucket",
        y: "value",
        text: (d) => d.value.toFixed(6),
        dy: -5,
        fontSize: 7,
        fill: "#333",
        fontWeight: "bold",
      }),
      // Add observation count below x-axis labels (in grey)
      Plot.text(metricData, {
        x: "ms_bucket",
        y: 0,
        text: (d) => d.num_blocks,
        dy: 25,
        fontSize: 7,
        fill: "#999",
      }),
    ],
  });
});

// Add x-axis label to the last plot
const maxData = data.map((d) => ({
  ms_bucket: d.ms_bucket,
  value: d.max_increase_eth,
  num_blocks: d.num_blocks,
}));

const lastPlot = Plot.plot({
  title: "MAX",
  width: plotWidth,
  height: 150,
  marginLeft: 80,
  marginBottom: 60,
  marginTop: 30,
  x: {
    label: "Time bucket (ms from slot start)",
    tickFormat: (d) => `${d}ms`,
  },
  y: {
    label: "ETH",
    grid: true,
  },
  marks: [
    Plot.barY(maxData, {
      x: "ms_bucket",
      y: "value",
      fill: "#59a14f",
      opacity: (d) => 0.5 + 0.5 * (d.num_blocks / maxBlocks),
      title: (d) =>
        `Bucket: ${d.ms_bucket}ms - ${d.ms_bucket + bucketSize}ms\nmax: ${d.value.toFixed(9)} ETH\nBlocks: ${d.num_blocks}`,
    }),
    Plot.ruleY([0]),
    // Add ETH value on top of bars
    Plot.text(maxData, {
      x: "ms_bucket",
      y: "value",
      text: (d) => d.value.toFixed(6),
      dy: -5,
      fontSize: 7,
      fill: "#333",
      fontWeight: "bold",
    }),
    // Add observation count below x-axis labels (in grey)
    Plot.text(maxData, {
      x: "ms_bucket",
      y: 0,
      text: (d) => d.num_blocks,
      dy: 35,
      fontSize: 7,
      fill: "#999",
    }),
  ],
});

// Replace the last plot
plots[plots.length - 1] = lastPlot;

// Combine all plots into one HTML document
const endBlock = startBlock !== "unknown" && amount !== "unknown"
  ? parseInt(startBlock) + parseInt(amount) - 1
  : "unknown";
const blockRangeText = startBlock !== "unknown" && endBlock !== "unknown"
  ? `Blocks ${startBlock} - ${endBlock} (${amount} blocks)`
  : `${data[0]?.num_blocks || "N/A"} blocks`;

// Get min and max time buckets
const minTime = d3.min(data, (d) => d.ms_bucket);
const maxTime = d3.max(data, (d) => d.ms_bucket);

// Calculate initial weighted mean
const totalBlocks = d3.sum(data, (d) => d.num_blocks);
const weightedSum = d3.sum(data, (d) => d.mean_increase_eth * d.num_blocks);
const initialWeightedMean = totalBlocks > 0 ? (weightedSum / totalBlocks).toFixed(9) : "0.000000000";

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Bid Value Increases per ${bucketSize}ms Bucket</title>
  <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
  <script src="https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6"></script>
  <style>
    body {
      font-family: system-ui, sans-serif;
      padding: 20px;
      margin: 0 auto;
      font-size: 12px;
    }
    h1 {
      margin-bottom: 5px;
      font-size: 18px;
    }
    h2 {
      margin-top: 0;
      color: #666;
      font-weight: normal;
      font-size: 14px;
    }
    .range-controls {
      background: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 15px;
      margin-bottom: 20px;
    }
    .range-row {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 10px;
    }
    .range-row label {
      min-width: 70px;
      font-weight: 500;
      font-size: 11px;
    }
    .range-row input[type="range"] {
      flex: 1;
      min-width: 200px;
    }
    .range-row .value {
      min-width: 60px;
      font-family: monospace;
      font-size: 11px;
    }
    .range-info {
      margin-top: 10px;
      padding: 6px;
      background: white;
      border-radius: 4px;
      font-size: 11px;
    }
    .scroll-container {
      overflow-x: auto;
      overflow-y: hidden;
      margin-bottom: 20px;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 10px;
      background: #fafafa;
    }
    .plots-wrapper {
      min-width: ${plotWidth}px;
    }
    .plot-container {
      margin-bottom: 20px;
    }
    /* Enhanced tooltip styling */
    [aria-label][role="img"] {
      background: white !important;
      border: 2px solid #333 !important;
      border-radius: 6px !important;
      padding: 12px !important;
      font-size: 14px !important;
      font-weight: 500 !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
      pointer-events: none !important;
      white-space: pre !important;
      line-height: 1.6 !important;
    }
    /* Highlight bars on hover */
    rect:hover {
      opacity: 1 !important;
      filter: brightness(1.1);
      cursor: pointer;
    }
  </style>
</head>
<body>
  <h1>Bid Value Increases per ${bucketSize}ms Bucket</h1>
  <h2>${blockRangeText}</h2>

  <div class="range-controls">
    <div class="range-row">
      <label for="min-range">Min Time:</label>
      <input type="range" id="min-range" min="${minTime}" max="${maxTime}" value="${minTime}" step="${bucketSize}">
      <span class="value" id="min-value">${minTime}ms</span>
    </div>
    <div class="range-row">
      <label for="max-range">Max Time:</label>
      <input type="range" id="max-range" min="${minTime}" max="${maxTime}" value="${maxTime}" step="${bucketSize}">
      <span class="value" id="max-value">${maxTime}ms</span>
    </div>
    <div class="range-info">
      Showing <strong><span id="range-display">${minTime}ms - ${maxTime}ms</span></strong>
      (<span id="point-count">${data.length}</span> data points)
      &nbsp;|&nbsp;
      <strong>Weighted mean increase:</strong> <span id="weighted-mean">${initialWeightedMean}</span> ETH
    </div>
  </div>

  <div class="scroll-container">
    <div class="plots-wrapper" id="plots-container">
      ${plots.map((plot) => `<div class="plot-container">${plot.outerHTML}</div>`).join("\n")}
    </div>
  </div>

  <script>
    // Embedded data
    const fullData = ${JSON.stringify(data)};
    const bucketSize = ${bucketSize};
    const maxBlocks = ${maxBlocks};

    const metrics = [
      { name: "mean", field: "mean_increase_eth", color: "#4e79a7" },
      { name: "p50", field: "p50_increase_eth", color: "#f28e2c" },
      { name: "p95", field: "p95_increase_eth", color: "#e15759" },
      { name: "p99", field: "p99_increase_eth", color: "#76b7b2" },
      { name: "max", field: "max_increase_eth", color: "#59a14f" },
    ];

    const minRange = document.getElementById('min-range');
    const maxRange = document.getElementById('max-range');
    const minValue = document.getElementById('min-value');
    const maxValue = document.getElementById('max-value');
    const rangeDisplay = document.getElementById('range-display');
    const pointCount = document.getElementById('point-count');
    const plotsContainer = document.getElementById('plots-container');
    const weightedMeanEl = document.getElementById('weighted-mean');

    function updatePlots() {
      const min = parseInt(minRange.value);
      const max = parseInt(maxRange.value);

      // Ensure min <= max
      if (min > max) {
        if (this === minRange) {
          maxRange.value = min;
        } else {
          minRange.value = max;
        }
        return updatePlots.call(this);
      }

      // Update display values
      minValue.textContent = min + 'ms';
      maxValue.textContent = max + 'ms';
      rangeDisplay.textContent = \`\${min}ms - \${max}ms\`;

      // Filter data
      const filteredData = fullData.filter(d => d.ms_bucket >= min && d.ms_bucket <= max);
      pointCount.textContent = filteredData.length;

      // Calculate weighted mean increase across selected range
      const totalBlocks = filteredData.reduce((sum, d) => sum + d.num_blocks, 0);
      const weightedSum = filteredData.reduce((sum, d) => sum + d.mean_increase_eth * d.num_blocks, 0);
      const weightedMean = totalBlocks > 0 ? weightedSum / totalBlocks : 0;
      weightedMeanEl.textContent = weightedMean.toFixed(9);

      // Calculate dynamic width
      const plotWidth = Math.max(1400, filteredData.length * 40);

      // Generate new plots
      const plots = metrics.slice(0, -1).map((metric) => {
        const metricData = filteredData.map((d) => ({
          ms_bucket: d.ms_bucket,
          value: d[metric.field],
          num_blocks: d.num_blocks,
        }));

        return Plot.plot({
          title: metric.name.toUpperCase(),
          width: plotWidth,
          height: 150,
          marginLeft: 80,
          marginBottom: 50,
          marginTop: 30,
          x: {
            label: null,
            tickFormat: (d) => \`\${d}ms\`,
          },
          y: {
            label: "ETH",
            grid: true,
          },
          marks: [
            Plot.barY(metricData, {
              x: "ms_bucket",
              y: "value",
              fill: metric.color,
              opacity: (d) => 0.5 + 0.5 * (d.num_blocks / maxBlocks),
              title: (d) =>
                \`Bucket: \${d.ms_bucket}ms - \${d.ms_bucket + bucketSize}ms\\n\${metric.name}: \${d.value.toFixed(9)} ETH\\nBlocks: \${d.num_blocks}\`,
            }),
            Plot.ruleY([0]),
            Plot.text(metricData, {
              x: "ms_bucket",
              y: "value",
              text: (d) => d.value.toFixed(6),
              dy: -5,
              fontSize: 7,
              fill: "#333",
              fontWeight: "bold",
            }),
            Plot.text(metricData, {
              x: "ms_bucket",
              y: 0,
              text: (d) => d.num_blocks,
              dy: 25,
              fontSize: 7,
              fill: "#999",
            }),
          ],
        });
      });

      // Add last plot with x-axis label
      const maxMetric = metrics[metrics.length - 1];
      const maxData = filteredData.map((d) => ({
        ms_bucket: d.ms_bucket,
        value: d[maxMetric.field],
        num_blocks: d.num_blocks,
      }));

      const lastPlot = Plot.plot({
        title: "MAX",
        width: plotWidth,
        height: 150,
        marginLeft: 80,
        marginBottom: 60,
        marginTop: 30,
        x: {
          label: "Time bucket (ms from slot start)",
          tickFormat: (d) => \`\${d}ms\`,
        },
        y: {
          label: "ETH",
          grid: true,
        },
        marks: [
          Plot.barY(maxData, {
            x: "ms_bucket",
            y: "value",
            fill: maxMetric.color,
            opacity: (d) => 0.5 + 0.5 * (d.num_blocks / maxBlocks),
            title: (d) =>
              \`Bucket: \${d.ms_bucket}ms - \${d.ms_bucket + bucketSize}ms\\nmax: \${d.value.toFixed(9)} ETH\\nBlocks: \${d.num_blocks}\`,
          }),
          Plot.ruleY([0]),
          Plot.text(maxData, {
            x: "ms_bucket",
            y: "value",
            text: (d) => d.value.toFixed(6),
            dy: -5,
            fontSize: 7,
            fill: "#333",
            fontWeight: "bold",
          }),
          Plot.text(maxData, {
            x: "ms_bucket",
            y: 0,
            text: (d) => d.num_blocks,
            dy: 35,
            fontSize: 7,
            fill: "#999",
          }),
        ],
      });

      plots.push(lastPlot);

      // Update plots container
      plotsContainer.innerHTML = plots.map(plot => \`<div class="plot-container">\${plot.outerHTML}</div>\`).join('\\n');

      // Update wrapper width
      document.querySelector('.plots-wrapper').style.minWidth = plotWidth + 'px';
    }

    // Add event listeners
    minRange.addEventListener('input', updatePlots);
    maxRange.addEventListener('input', updatePlots);
  </script>
</body>
</html>
`;

writeFileSync(outputFile, htmlContent);

console.log(`Chart saved to ${outputFile}`);
console.log(`Total metrics: ${metrics.length}`);
console.log(`Blocks analyzed: ${data[0]?.num_blocks || "N/A"}`);
