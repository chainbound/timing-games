#!/usr/bin/env bun

/**
 * Runs trace-aggregate queries in chunks to avoid Cloudflare timeouts,
 * then aggregates the results.
 *
 * Usage: bun plot-chunked.ts <START_BLOCK> <TOTAL_AMOUNT> [CHUNK_SIZE] [OUTPUT]
 * Example: bun plot-chunked.ts 24301606 50000 10000 index.html
 */

const ENDPOINT = process.env.XATU_ENDPOINT || "https://clickhouse.xatu.ethpandaops.io";
const USERNAME = process.env.XATU_USERNAME;
const PASSWORD = process.env.XATU_PASSWORD;

if (!USERNAME || !PASSWORD) {
  console.error("Error: XATU_USERNAME and XATU_PASSWORD must be set");
  process.exit(1);
}

interface BucketData {
  ms_bucket: number;
  mean_increase_eth: number;
  p50_increase_eth: number;
  p95_increase_eth: number;
  p99_increase_eth: number;
  max_increase_eth: number;
  num_blocks: number;
}

interface AggregatedBucket {
  ms_bucket: number;
  sum_weighted_mean: number;
  sum_weighted_p50: number;
  sum_weighted_p95: number;
  sum_weighted_p99: number;
  max_increase_eth: number;
  total_blocks: number;
}

function buildQuery(startBlock: number, endBlock: number): string {
  return `WITH unique_bids AS (
      SELECT DISTINCT
          block_number,
          timestamp_ms,
          value,
          timestamp_ms - (toUnixTimestamp(slot_start_date_time) * 1000) AS ms_from_slot_start,
          relay_name
      FROM mev_relay_bid_trace
      WHERE block_number BETWEEN ${startBlock} AND ${endBlock}
        AND ms_from_slot_start BETWEEN 0 and 4000
  ),
  bucket_max AS (
      SELECT
          block_number,
          floor(ms_from_slot_start / 50) * 50 AS ms_bucket,
          max(value) / 1e18 AS max_bid_eth
      FROM unique_bids
      GROUP BY block_number, ms_bucket
  ),
  bucket_increases AS (
      SELECT
          block_number,
          ms_bucket,
          max_bid_eth,
          greatest(0, max_bid_eth - lag(max_bid_eth) OVER (PARTITION BY block_number ORDER BY ms_bucket)) AS increase_from_prev_eth
      FROM bucket_max
  )
  SELECT
      ms_bucket,
      round(avg(increase_from_prev_eth), 9) AS mean_increase_eth,
      round(quantileExact(0.5)(increase_from_prev_eth), 9) AS p50_increase_eth,
      round(quantileExact(0.95)(increase_from_prev_eth), 9) AS p95_increase_eth,
      round(quantileExact(0.99)(increase_from_prev_eth), 9) AS p99_increase_eth,
      round(max(increase_from_prev_eth), 9) AS max_increase_eth,
      count(*) AS num_blocks
  FROM bucket_increases
  WHERE increase_from_prev_eth > 0
  GROUP BY ms_bucket
  ORDER BY ms_bucket
  FORMAT CSVWithNames`;
}

async function runQuery(query: string): Promise<string> {
  const auth = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: query,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Query failed: ${response.status} ${response.statusText} - ${text}`);
  }

  return response.text();
}

function parseCSV(content: string): BucketData[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  // Skip header
  return lines.slice(1)
    .filter(line => line.trim())
    .map(line => {
      const parts = line.split(',').map(p => p.trim().replace(/"/g, ''));
      return {
        ms_bucket: parseInt(parts[0]),
        mean_increase_eth: parseFloat(parts[1]),
        p50_increase_eth: parseFloat(parts[2]),
        p95_increase_eth: parseFloat(parts[3]),
        p99_increase_eth: parseFloat(parts[4]),
        max_increase_eth: parseFloat(parts[5]),
        num_blocks: parseInt(parts[6]),
      };
    })
    .filter(d => !isNaN(d.ms_bucket) && d.num_blocks > 0);
}

function aggregateData(allData: BucketData[][]): BucketData[] {
  const bucketMap = new Map<number, AggregatedBucket>();

  for (const fileData of allData) {
    for (const row of fileData) {
      const existing = bucketMap.get(row.ms_bucket);

      if (existing) {
        existing.sum_weighted_mean += row.mean_increase_eth * row.num_blocks;
        existing.sum_weighted_p50 += row.p50_increase_eth * row.num_blocks;
        existing.sum_weighted_p95 += row.p95_increase_eth * row.num_blocks;
        existing.sum_weighted_p99 += row.p99_increase_eth * row.num_blocks;
        existing.max_increase_eth = Math.max(existing.max_increase_eth, row.max_increase_eth);
        existing.total_blocks += row.num_blocks;
      } else {
        bucketMap.set(row.ms_bucket, {
          ms_bucket: row.ms_bucket,
          sum_weighted_mean: row.mean_increase_eth * row.num_blocks,
          sum_weighted_p50: row.p50_increase_eth * row.num_blocks,
          sum_weighted_p95: row.p95_increase_eth * row.num_blocks,
          sum_weighted_p99: row.p99_increase_eth * row.num_blocks,
          max_increase_eth: row.max_increase_eth,
          total_blocks: row.num_blocks,
        });
      }
    }
  }

  const results: BucketData[] = [];
  for (const [_, agg] of bucketMap) {
    results.push({
      ms_bucket: agg.ms_bucket,
      mean_increase_eth: agg.sum_weighted_mean / agg.total_blocks,
      p50_increase_eth: agg.sum_weighted_p50 / agg.total_blocks,
      p95_increase_eth: agg.sum_weighted_p95 / agg.total_blocks,
      p99_increase_eth: agg.sum_weighted_p99 / agg.total_blocks,
      max_increase_eth: agg.max_increase_eth,
      num_blocks: agg.total_blocks,
    });
  }

  return results.sort((a, b) => a.ms_bucket - b.ms_bucket);
}

function formatCSV(data: BucketData[]): string {
  const header = 'ms_bucket,mean_increase_eth,p50_increase_eth,p95_increase_eth,p99_increase_eth,max_increase_eth,num_blocks';
  const rows = data.map(d =>
    `${d.ms_bucket},${d.mean_increase_eth.toFixed(9)},${d.p50_increase_eth.toFixed(9)},${d.p95_increase_eth.toFixed(9)},${d.p99_increase_eth.toFixed(9)},${d.max_increase_eth.toFixed(9)},${d.num_blocks}`
  );
  return [header, ...rows].join('\n');
}

// Main
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: bun plot-chunked.ts <START_BLOCK> <TOTAL_AMOUNT> [CHUNK_SIZE] [OUTPUT]');
  console.error('Example: bun plot-chunked.ts 24301606 50000 10000 index.html');
  process.exit(1);
}

const startBlock = parseInt(args[0]);
const totalAmount = parseInt(args[1]);
const chunkSize = parseInt(args[2] || '10000');
const outputFile = args[3] || 'index.html';

console.error(`Fetching data for blocks ${startBlock} to ${startBlock + totalAmount - 1}`);
console.error(`Chunk size: ${chunkSize} blocks`);

const chunks: { start: number; end: number }[] = [];
for (let i = 0; i < totalAmount; i += chunkSize) {
  const chunkStart = startBlock + i;
  const chunkEnd = Math.min(startBlock + i + chunkSize - 1, startBlock + totalAmount - 1);
  chunks.push({ start: chunkStart, end: chunkEnd });
}

console.error(`Running ${chunks.length} queries...\n`);

const allData: BucketData[][] = [];
let totalBlocks = 0;

for (let i = 0; i < chunks.length; i++) {
  const chunk = chunks[i];
  const progress = `[${i + 1}/${chunks.length}]`;

  process.stderr.write(`${progress} Querying blocks ${chunk.start} - ${chunk.end}...`);

  try {
    const query = buildQuery(chunk.start, chunk.end);
    const result = await runQuery(query);
    const data = parseCSV(result);

    if (data.length > 0) {
      allData.push(data);
      const chunkBlocks = data.reduce((s, d) => s + d.num_blocks, 0);
      totalBlocks += chunkBlocks;
      console.error(` OK (${data.length} buckets, ${chunkBlocks} observations)`);
    } else {
      console.error(` WARNING: No data returned`);
    }
  } catch (error) {
    console.error(` FAILED: ${error}`);
    process.exit(1);
  }
}

if (allData.length === 0) {
  console.error('\nNo data collected!');
  process.exit(1);
}

console.error(`\nAggregating ${allData.length} chunks...`);
const aggregated = aggregateData(allData);

// Write CSV
const csvContent = formatCSV(aggregated);
await Bun.write('data.csv', csvContent);
console.error(`Wrote data.csv (${aggregated.length} buckets, ${totalBlocks} total observations)`);

// Generate plot
console.error('Generating plot...');
const plotProc = Bun.spawn(['bun', 'run', 'plot-trace.js', 'data.csv', outputFile, startBlock.toString(), totalAmount.toString()], {
  stdout: 'inherit',
  stderr: 'inherit',
});
await plotProc.exited;

console.error(`\nDone! Open ${outputFile} in a browser to view.`);
