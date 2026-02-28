# wormkey

## Install

```bash
npm i -g wormkey
```

## Run

```bash
wormkey http 3000
```

Prints the share link (e.g. `https://wormkey.run/s/slug`). No env vars needed for production.

## Options

- `--local` — Use localhost control plane and edge (for local dev)

## Env (optional)

- `WORMKEY_CONTROL_PLANE_URL`
- `WORMKEY_EDGE_URL`
