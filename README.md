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

The workflow automatically deploys charts to GitHub Pages.

### Setup

1. Go to your repository Settings → Pages
2. Under "Build and deployment", set Source to "GitHub Actions"
3. Add repository secrets (Settings → Secrets → Actions):
   - `XATU_USERNAME`: Your Xatu database username
   - `XATU_PASSWORD`: Your Xatu database password

### Deploy

**Automatic**: Push to `main` branch (uses default: 100 blocks starting from 24250508)

**Manual**: Go to Actions → Deploy to GitHub Pages → Run workflow
- Customize start block and number of blocks to analyze

Your chart will be available at: `https://<username>.github.io/<repo-name>/index.html`
