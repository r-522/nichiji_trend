# mcp-toolbox-server

A **dependency-free** [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server,
written in pure Python. It speaks JSON-RPC 2.0 over **stdio** (one JSON object per line) and
implements the core MCP surface that any MCP client (Claude, IDEs, custom agents) can talk to.

> Built 2026-05-27 (JST) as the daily trend project. Today's trend: **MCP** — the de-facto
> standard for connecting AI agents to tools, now governed by the Linux Foundation's
> Agentic AI Foundation. See `../readme.md` for the research write-up.

## Why this exists

MCP is the connective tissue of agentic AI: instead of bespoke integrations, an agent
discovers and invokes tools through one standard protocol. This project shows the protocol
end to end — handshake, tool discovery, tool invocation, and in-band error reporting —
without pulling in the official SDK, so you can read every byte that goes over the wire.

## Supported methods

| Method | Type | Description |
| :-- | :-- | :-- |
| `initialize` | request | Handshake; returns protocol version + server capabilities |
| `notifications/initialized` | notification | Client confirms handshake (no response) |
| `ping` | request | Liveness check |
| `tools/list` | request | List available tools and their JSON Schemas |
| `tools/call` | request | Invoke a tool by name with arguments |

## Bundled tools

| Tool | Description |
| :-- | :-- |
| `current_time_jst` | Current date/time in Japan Standard Time (UTC+9) |
| `calculator` | Safe arithmetic eval (`+ - * / // % **`, parentheses) |
| `text_stats` | Character / word / line counts for text |
| `uuid_generate` | Generate one or more UUID v4 strings |

## Run it

```bash
cd mcp-toolbox-server

# Run the server directly (reads JSON-RPC from stdin):
python3 -m mcp_toolbox

# Or run the end-to-end demo client (spawns the server and exercises every tool):
python3 client_demo.py
```

### Talk to it by hand

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"calculator","arguments":{"expression":"6*7"}}}' \
  | python3 -m mcp_toolbox
```

### Use from an MCP client (e.g. Claude Desktop config)

```json
{
  "mcpServers": {
    "toolbox": {
      "command": "python3",
      "args": ["-m", "mcp_toolbox"],
      "cwd": "/root/20260527/mcp-toolbox-server"
    }
  }
}
```

## Project layout

```
mcp-toolbox-server/
├── pyproject.toml          # packaging + console-script entrypoint
├── README.md               # this file
├── client_demo.py          # end-to-end stdio MCP client demo
└── mcp_toolbox/
    ├── __init__.py         # version + protocol constants
    ├── __main__.py         # `python3 -m mcp_toolbox`
    ├── server.py           # JSON-RPC 2.0 stdio dispatch loop
    └── tools.py            # tool registry + implementations
```

## Extending

Register a new tool by decorating a handler in `mcp_toolbox/tools.py`:

```python
@tool(
    name="reverse",
    description="Reverse a string.",
    input_schema={"type": "object", "properties": {"text": {"type": "string"}}, "required": ["text"]},
)
def _reverse(args):
    return args["text"][::-1]
```

It is automatically advertised via `tools/list` and callable via `tools/call`.

## License

MIT
