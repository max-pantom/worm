# wormkey-mcp

MCP server for creating and managing [Wormkey](https://wormkey.run) localhost tunnels from an AI agent.

## Use with an MCP client

Add Wormkey to your MCP client configuration:

```json
{
  "mcpServers": {
    "wormkey": {
      "command": "npx",
      "args": ["-y", "wormkey-mcp"]
    }
  }
}
```

Restart the client, then ask your agent:

> Start a Wormkey tunnel for port 3000.

The server provides tools for starting, listing, inspecting, and closing tunnels, reading captured requests, replaying requests, and waiting for a local service to become ready.

## Requirements

- Node.js 18 or newer
- A local application to expose

`wormkey-mcp` installs the compatible Wormkey CLI automatically.

## Environment variables

- `WORMKEY_BIN` — optional path or command name for a custom Wormkey CLI executable
- `WORMKEY_CONTROL_PLANE_URL` — optional control-plane override used by the CLI
- `WORMKEY_EDGE_URL` — optional edge-gateway override used by the CLI

## License

MIT
