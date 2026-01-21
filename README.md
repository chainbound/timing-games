# timing-games

Analysis of MEV relay bid timing and value increases.

## Setup

Install dependencies:

```bash
bun install
```

Set up environment variables in `.env`:

```bash
XATU_USERNAME=your_username
XATU_PASSWORD=your_password
```

## Usage

### Analyze a single block

```bash
just trace 24250508
```

### Aggregate statistics across multiple blocks

```bash
# just trace-aggregate START_BLOCK AMOUNT
just trace-aggregate 24250508 100
```

### Generate interactive charts

```bash
# just plot START_BLOCK AMOUNT OUTPUT_FILE
just plot 24250508 100 index.html
```

This will create `index.html` with interactive bar charts showing bid value increases per 200ms bucket.
