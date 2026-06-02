/** Minimal JSON-RPC 2.0 envelope helpers — the transport A2A rides on. */

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: unknown;
}

export interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: string | number;
  result: unknown;
}

export interface JsonRpcError {
  jsonrpc: "2.0";
  id: string | number | null;
  error: { code: number; message: string; data?: unknown };
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

/** Standard JSON-RPC error codes used by A2A. */
export const RpcErrors = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

let counter = 0;
export function nextRpcId(): number {
  return ++counter;
}

export function rpcRequest(method: string, params: unknown): JsonRpcRequest {
  return { jsonrpc: "2.0", id: nextRpcId(), method, params };
}

export function rpcSuccess(
  id: string | number,
  result: unknown,
): JsonRpcSuccess {
  return { jsonrpc: "2.0", id, result };
}

export function rpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcError {
  return { jsonrpc: "2.0", id, error: { code, message, data } };
}

export function isRpcError(r: JsonRpcResponse): r is JsonRpcError {
  return "error" in r;
}
