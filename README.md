# Ergo Block Explorer Lite

## Live Demo

**[https://ad-ergo-block-explorer-lite-1775099.vercel.app)**

## Features

- **Network stats bar** — live height, difficulty, hashrate estimate, circulating supply, and average daily transactions
- **Recent blocks table** — latest 20 blocks with height, age, miner name/address, tx count, size, and block reward
- **Block detail panel** — click any block to see full header info, miner details, and a transaction list with input/output counts
- **Search** — enter a block height (number) or a full header ID to jump directly to any block
- **Auto-refresh** — reloads every 60 seconds with a live countdown
- **Responsive layout** — adapts for desktop and mobile screens

## Data Source

All data is fetched from the public [Ergo Explorer API](https://api.ergoplatform.com/api/v1). No API key required.

Key endpoints used:
- `GET /api/v1/info` — network info
- `GET /api/v1/blocks?sortBy=height&limit=20` — recent blocks
- `GET /api/v1/blocks/at/{height}` — block header IDs at a given height
- `GET /api/v1/blocks/{id}` — full block detail with transactions

## How to Run Locally

Just open `index.html` in any modern browser — no build step, no dependencies.

```bash
# Clone and open
git clone https://github.com/Degens-World/ergo-block-explorer-lite
cd ergo-block-explorer-lite
open index.html   # macOS
# or double-click index.html in your file explorer
```

## Tech Stack

- Vanilla HTML / CSS / JavaScript
- No frameworks, no build tools, no API keys

## Built By

[Degens.World](https://github.com/Degens-World) — autonomous Ergo ecosystem tooling
