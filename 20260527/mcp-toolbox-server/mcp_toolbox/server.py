"""A minimal Model Context Protocol (MCP) server over stdio.

Speaks JSON-RPC 2.0 on stdin/stdout, one JSON object per line. Implements the
core MCP handshake and tool surface:

    - initialize
    - notifications/initialized   (notification, no response)
    - tools/list
    - tools/call
    - ping

No third-party dependencies are required.
"""

from __future__ import annotations

import json
import sys
from typing import Any, Dict, Optional

from . import PROTOCOL_VERSION, __version__, tools

SERVER_INFO = {"name": "mcp-toolbox-server", "version": __version__}

# JSON-RPC error codes.
PARSE_ERROR = -32700
INVALID_REQUEST = -32600
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
INTERNAL_ERROR = -32603


def _result(req_id: Any, result: Dict[str, Any]) -> Dict[str, Any]:
    return {"jsonrpc": "2.0", "id": req_id, "result": result}


def _error(req_id: Any, code: int, message: str) -> Dict[str, Any]:
    return {"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}}


def handle_message(msg: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Dispatch a single JSON-RPC message. Returns a response, or None for notifications."""
    method = msg.get("method")
    req_id = msg.get("id")
    params = msg.get("params") or {}
    is_notification = "id" not in msg

    if method == "initialize":
        return _result(
            req_id,
            {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {"tools": {"listChanged": False}},
                "serverInfo": SERVER_INFO,
            },
        )

    if method == "notifications/initialized":
        return None  # client confirmed handshake; nothing to send back

    if method == "ping":
        return _result(req_id, {})

    if method == "tools/list":
        return _result(req_id, {"tools": tools.list_tools()})

    if method == "tools/call":
        name = params.get("name")
        arguments = params.get("arguments", {})
        if not name:
            return _error(req_id, INVALID_PARAMS, "missing tool name")
        try:
            text = tools.call_tool(name, arguments)
        except KeyError as exc:
            return _error(req_id, METHOD_NOT_FOUND, str(exc))
        except (ValueError, TypeError, ArithmeticError) as exc:
            # Tool-level failures are reported in-band per the MCP spec.
            return _result(
                req_id,
                {"content": [{"type": "text", "text": f"error: {exc}"}], "isError": True},
            )
        return _result(req_id, {"content": [{"type": "text", "text": text}], "isError": False})

    if is_notification:
        return None
    return _error(req_id, METHOD_NOT_FOUND, f"unknown method: {method}")


def serve(stdin=None, stdout=None) -> None:
    """Run the stdio read/dispatch/write loop until EOF."""
    stdin = stdin or sys.stdin
    stdout = stdout or sys.stdout

    for line in stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            _write(stdout, _error(None, PARSE_ERROR, "invalid JSON"))
            continue

        response = handle_message(msg)
        if response is not None:
            _write(stdout, response)


def _write(stdout, payload: Dict[str, Any]) -> None:
    stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    stdout.flush()


if __name__ == "__main__":
    serve()
