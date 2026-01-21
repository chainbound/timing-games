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
just trace-aggregate 24250508 100
```

### Generate interactive charts

```bash
just plot 24250508 100
```

This will create `output.html` with interactive bar charts showing bid value increases per 200ms bucket.

## GitHub Pages Deployment

The workflow automatically deploys `index.html` to GitHub Pages when pushed to `main`.

### Setup

1. Go to your repository Settings → Pages
2. Under "Build and deployment", set Source to "GitHub Actions"

### Deploy

1. Generate your chart locally:
   ```bash
   just plot 24250508 100 index.html
   ```

2. Commit and push `index.html` to `main`:
   ```bash
   git add index.html
   git commit -m "Update chart"
   git push
   ```

Your chart will be available at: `https://<username>.github.io/<repo-name>/`
