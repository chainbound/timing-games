#!/usr/bin/env bash

# Aggregates bid increases across multiple consecutive blocks (CSV output)
# Shows mean, median (p50), p95, p99 for each 200ms bucket
# Usage: ./trace-aggregate-csv.sh START_BLOCK AMOUNT
# Example: ./trace-aggregate-csv.sh 24250508 100

START_BLOCK=$1
AMOUNT=$2
END_BLOCK=$((START_BLOCK + AMOUNT - 1))

echo "WITH unique_bids AS (
      SELECT DISTINCT
          block_number,
          timestamp_ms,
          value,
          timestamp_ms - (toUnixTimestamp(slot_start_date_time) * 1000) AS ms_from_slot_start,
          relay_name
      FROM mev_relay_bid_trace
      WHERE block_number BETWEEN $START_BLOCK AND $END_BLOCK
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
  FORMAT CSVWithNames"
