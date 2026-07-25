# Changelog

All notable changes to Wormkey will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.4.0] - 2026-07-25

### Added

- Agent-native JSON and noninteractive CLI modes
- Readiness waiting and process lifecycle management
- Multi-session state, remote close, request inspection, logs, and replay
- Scoped session tokens and the `@wormkey/mcp` package
- GitHub Actions CI, dependency review, npm audit, Go vet, and CodeQL

### Security

- Public, owner, and internal control-plane authorization boundaries
- Cryptographically secure session identifiers, slugs, and credentials
- Hashed owner and tunnel tokens
- Authenticated gateway session validation
- Request cancellation, body limits, timeouts, and unsafe-header filtering

### Changed

- Gateway control-plane and protocol code moved into internal packages
- Local state now uses `~/.wormkey/sessions.json` with restrictive permissions

---

## [0.2.0] - Previous

### Added

- **Interactive CLI** — Keyboard shortcuts: L (open in browser), C (copy URL), P (pause), R (resume), Q (close)
- **QR code** — Terminal QR code printed after share URL for mobile scanning
- **Expiration enforcement** — Tunnels auto-close when `--expires` is reached
- **Status command** — `wormkey status` shows URL, viewers, uptime
- **Pause/Resume** — Pause tunnel during demos; new requests return 503 until resumed
- **Session state** — Persisted to `~/.wormkey/p.json` for status command

### Changed

- Tunnel output format: "Tunnel ready" with Share/QR/shortcuts
- Non-TTY fallback: static output with "Press Ctrl+C to close"

### Protocol

- New frame types: `0x0B` PAUSE, `0x0C` RESUME (CLI → Gateway)

---

## [0.1.5] - Previous

- Initial public release
- `wormkey http <port>` with `--auth`, `--expires`
- Owner claim URL, overlay script integration
