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
const outputFile = process.argv[3] || "output.html";

// Read and parse CSV data
const csvData = readFileSync(csvFile, "utf-8");
const data = d3.csvParse(csvData, d3.autoType);

const maxBlocks = d3.max(data, (d) => d.num_blocks);

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
    width: 1400,
    height: 180,
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
          `Bucket: ${d.ms_bucket}ms - ${d.ms_bucket + 200}ms\n${metric.name}: ${d.value.toFixed(9)} ETH\nBlocks: ${d.num_blocks}`,
      }),
      Plot.ruleY([0]),
      // Add text labels on top of bars showing num_blocks
      Plot.text(metricData, {
        x: "ms_bucket",
        y: "value",
        text: (d) => d.num_blocks,
        dy: -5,
        fontSize: 10,
        fill: "#333",
        fontWeight: "bold",
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
  width: 1400,
  height: 180,
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
        `Bucket: ${d.ms_bucket}ms - ${d.ms_bucket + 200}ms\nmax: ${d.value.toFixed(9)} ETH\nBlocks: ${d.num_blocks}`,
    }),
    Plot.ruleY([0]),
    // Add text labels on top of bars showing num_blocks
    Plot.text(maxData, {
      x: "ms_bucket",
      y: "value",
      text: (d) => d.num_blocks,
      dy: -5,
      fontSize: 10,
      fill: "#333",
      fontWeight: "bold",
    }),
  ],
});

// Replace the last plot
plots[plots.length - 1] = lastPlot;

// Combine all plots into one HTML document
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Bid Value Increases per 200ms Bucket</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      padding: 20px;
      max-width: 1500px;
      margin: 0 auto;
    }
    h1 {
      margin-bottom: 5px;
    }
    h2 {
      margin-top: 0;
      color: #666;
      font-weight: normal;
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
  <h1>Bid Value Increases per 200ms Bucket</h1>
  <h2>Aggregated across ${data[0]?.num_blocks || "N/A"} blocks</h2>
  ${plots.map((plot) => `<div class="plot-container">${plot.outerHTML}</div>`).join("\n")}
</body>
</html>
`;

writeFileSync(outputFile, htmlContent);

console.log(`Chart saved to ${outputFile}`);
console.log(`Total metrics: ${metrics.length}`);
console.log(`Blocks analyzed: ${data[0]?.num_blocks || "N/A"}`);
