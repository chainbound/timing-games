#!/usr/bin/env bash

# Shows how much the highest bid increases in each 100ms bucket
# This reveals the marginal value of each additional 100ms of bidding time
# Displays in 100ms buckets relative to slot start (can be negative!)
# Negative times = bids submitted BEFORE slot start (during previous slot)

echo "WITH unique_bids AS (
      SELECT DISTINCT
          timestamp_ms,
          value,
          timestamp_ms - (toUnixTimestamp(slot_start_date_time) * 1000) AS ms_from_slot_start,
          relay_name
      FROM mev_relay_bid_trace
      WHERE block_number = '$1'
        AND ms_from_slot_start BETWEEN 0 and 4000
  ),
  bucket_max AS (
      SELECT
          floor(ms_from_slot_start / 200) * 200 AS ms_bucket,
          max(value) / 1e18 AS max_bid_eth
      FROM unique_bids
      GROUP BY ms_bucket
  )
  SELECT
      ms_bucket,
      max_bid_eth,
      round(greatest(0, max_bid_eth - lag(max_bid_eth) OVER (ORDER BY ms_bucket)), 9) AS increase_from_prev_eth
  FROM bucket_max
  ORDER BY ms_bucket
  FORMAT TabSeparatedWithNames"
