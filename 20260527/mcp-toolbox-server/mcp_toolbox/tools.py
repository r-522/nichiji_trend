"""Tool registry and implementations exposed over MCP.

Each tool declares an MCP-compatible JSON Schema (`inputSchema`) and a handler
that receives validated-ish arguments and returns a plain string result.
"""

from __future__ import annotations

import ast
import operator
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, List

# A tool entry: schema describing it to clients + the python handler.
ToolHandler = Callable[[Dict[str, Any]], str]
_REGISTRY: Dict[str, Dict[str, Any]] = {}


def tool(name: str, description: str, input_schema: Dict[str, Any]) -> Callable[[ToolHandler], ToolHandler]:
    """Register a handler as an MCP tool."""

    def decorator(handler: ToolHandler) -> ToolHandler:
        _REGISTRY[name] = {
            "name": name,
            "description": description,
            "inputSchema": input_schema,
            "handler": handler,
        }
        return handler

    return decorator


def list_tools() -> List[Dict[str, Any]]:
    """Return tool descriptors in the shape expected by `tools/list`."""
    return [
        {"name": t["name"], "description": t["description"], "inputSchema": t["inputSchema"]}
        for t in _REGISTRY.values()
    ]


def call_tool(name: str, arguments: Dict[str, Any]) -> str:
    if name not in _REGISTRY:
        raise KeyError(f"unknown tool: {name}")
    return _REGISTRY[name]["handler"](arguments or {})


# --------------------------------------------------------------------------
# Tool implementations
# --------------------------------------------------------------------------

JST = timezone(timedelta(hours=9), name="JST")


@tool(
    name="current_time_jst",
    description="Return the current date and time in Japan Standard Time (JST, UTC+9).",
    input_schema={
        "type": "object",
        "properties": {
            "format": {
                "type": "string",
                "description": "strftime format string. Defaults to ISO-like '%Y-%m-%d %H:%M:%S'.",
            }
        },
    },
)
def _current_time_jst(args: Dict[str, Any]) -> str:
    fmt = args.get("format") or "%Y-%m-%d %H:%M:%S"
    return datetime.now(JST).strftime(fmt) + " JST"


# Only safe arithmetic AST nodes are evaluated.
_ALLOWED_BINOPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}
_ALLOWED_UNARYOPS = {ast.UAdd: operator.pos, ast.USub: operator.neg}


def _safe_eval(node: ast.AST) -> float:
    if isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)):
            return node.value
        raise ValueError("only numeric constants are allowed")
    if isinstance(node, ast.BinOp) and type(node.op) in _ALLOWED_BINOPS:
        return _ALLOWED_BINOPS[type(node.op)](_safe_eval(node.left), _safe_eval(node.right))
    if isinstance(node, ast.UnaryOp) and type(node.op) in _ALLOWED_UNARYOPS:
        return _ALLOWED_UNARYOPS[type(node.op)](_safe_eval(node.operand))
    raise ValueError("unsupported expression")


@tool(
    name="calculator",
    description="Evaluate a basic arithmetic expression (+, -, *, /, //, %, ** and parentheses).",
    input_schema={
        "type": "object",
        "properties": {
            "expression": {"type": "string", "description": "e.g. '(2 + 3) * 4 ** 2'"}
        },
        "required": ["expression"],
    },
)
def _calculator(args: Dict[str, Any]) -> str:
    expr = args.get("expression", "")
    if not isinstance(expr, str) or not expr.strip():
        raise ValueError("expression must be a non-empty string")
    tree = ast.parse(expr, mode="eval")
    result = _safe_eval(tree.body)
    return str(result)


@tool(
    name="text_stats",
    description="Return character, word and line counts for a block of text.",
    input_schema={
        "type": "object",
        "properties": {"text": {"type": "string"}},
        "required": ["text"],
    },
)
def _text_stats(args: Dict[str, Any]) -> str:
    text = args.get("text", "")
    if not isinstance(text, str):
        raise ValueError("text must be a string")
    chars = len(text)
    words = len(text.split())
    lines = len(text.splitlines()) or (1 if text else 0)
    return f"characters={chars} words={words} lines={lines}"


@tool(
    name="uuid_generate",
    description="Generate one or more random UUID (v4) strings.",
    input_schema={
        "type": "object",
        "properties": {
            "count": {"type": "integer", "minimum": 1, "maximum": 100, "default": 1}
        },
    },
)
def _uuid_generate(args: Dict[str, Any]) -> str:
    count = int(args.get("count", 1))
    count = max(1, min(count, 100))
    return "\n".join(str(uuid.uuid4()) for _ in range(count))
