#!/usr/bin/env python3
"""End-to-end demo client for mcp-toolbox-server.

Spawns the server as a subprocess, performs the MCP handshake over stdio, then
lists and calls every tool. Run from the project root:

    python3 client_demo.py
"""

from __future__ import annotations

import json
import subprocess
import sys
from typing import Any, Dict, Optional


class StdioMCPClient:
    def __init__(self, command: list[str]) -> None:
        self.proc = subprocess.Popen(
            command,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        self._id = 0

    def _next_id(self) -> int:
        self._id += 1
        return self._id

    def request(self, method: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        req_id = self._next_id()
        self._send({"jsonrpc": "2.0", "id": req_id, "method": method, "params": params or {}})
        return self._read()

    def notify(self, method: str, params: Optional[Dict[str, Any]] = None) -> None:
        self._send({"jsonrpc": "2.0", "method": method, "params": params or {}})

    def _send(self, payload: Dict[str, Any]) -> None:
        assert self.proc.stdin is not None
        self.proc.stdin.write(json.dumps(payload) + "\n")
        self.proc.stdin.flush()

    def _read(self) -> Dict[str, Any]:
        assert self.proc.stdout is not None
        line = self.proc.stdout.readline()
        if not line:
            raise RuntimeError("server closed the connection")
        return json.loads(line)

    def close(self) -> None:
        if self.proc.stdin:
            self.proc.stdin.close()
        self.proc.wait(timeout=5)


def main() -> int:
    client = StdioMCPClient([sys.executable, "-m", "mcp_toolbox"])
    try:
        init = client.request(
            "initialize",
            {
                "protocolVersion": "2025-06-18",
                "capabilities": {},
                "clientInfo": {"name": "demo-client", "version": "0.1.0"},
            },
        )
        server = init["result"]["serverInfo"]
        print(f"connected to {server['name']} v{server['version']} "
              f"(protocol {init['result']['protocolVersion']})")
        client.notify("notifications/initialized")

        tools = client.request("tools/list")["result"]["tools"]
        print(f"\ndiscovered {len(tools)} tools:")
        for t in tools:
            print(f"  - {t['name']}: {t['description']}")

        print("\ncalling tools:")
        calls = [
            ("current_time_jst", {}),
            ("calculator", {"expression": "(2 + 3) * 4 ** 2"}),
            ("text_stats", {"text": "hello world\nsecond line"}),
            ("uuid_generate", {"count": 2}),
            ("calculator", {"expression": "1 / 0"}),  # exercises in-band error path
        ]
        for name, args in calls:
            resp = client.request("tools/call", {"name": name, "arguments": args})
            result = resp["result"]
            text = result["content"][0]["text"]
            flag = " [isError]" if result.get("isError") else ""
            print(f"  {name}({args}) ->{flag} {text!r}")

        return 0
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
