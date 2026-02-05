set dotenv-load := true

endpoint := "https://clickhouse.xatu.ethpandaops.io"

default:
    just --list

query QUERY:
    echo """{{ QUERY }}""" | curl -i -v -w "\n\nTime total: %{time_total}s\nHTTP code: %{http_code}\n" {{ endpoint }} --max-time 900 -u "$XATU_USERNAME:$XATU_PASSWORD" --data-binary @-

# https://ethpandaops.io/data/xatu/schema/mev_relay_/#mev_relay_bid_trace
trace BLOCK:
    @just query "{{ shell('./trace.sh $1', BLOCK) }}"

# Aggregate bid increases across multiple blocks
trace-aggregate START_BLOCK AMOUNT:
    @just query "{{ shell('./trace-aggregate.sh $1 $2', START_BLOCK, AMOUNT) }}"

# Aggregate bid increases across multiple blocks (CSV output)
trace-aggregate-csv START_BLOCK AMOUNT:
    @just query "{{ shell('./trace-aggregate-csv.sh $1 $2', START_BLOCK, AMOUNT) }}"

# Generate bar chart plot from aggregated data (may timeout for large ranges)
plot START_BLOCK AMOUNT OUTPUT="index.html":
    @echo "Fetching data for blocks {{ START_BLOCK }} to {{ START_BLOCK }} + {{ AMOUNT }}..."
    @just trace-aggregate-csv {{ START_BLOCK }} {{ AMOUNT }} > data.csv
    @echo "Generating plot..."
    @bun run plot-trace.js data.csv {{ OUTPUT }} {{ START_BLOCK }} {{ AMOUNT }}
    @echo "Done! Open {{ OUTPUT }} in a browser to view."

# Generate plot with chunked queries (avoids Cloudflare timeout for large ranges)
plot-chunked START_BLOCK AMOUNT CHUNK_SIZE="10000" OUTPUT="index.html":
    @bun run plot-chunked.ts {{ START_BLOCK }} {{ AMOUNT }} {{ CHUNK_SIZE }} {{ OUTPUT }}
