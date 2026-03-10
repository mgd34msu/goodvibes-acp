/**
 * @module mcp
 * @layer L2 — MCP integration barrel export
 *
 * Exports the McpBridge orchestrator, McpToolProxy registry adapter,
 * and transport primitives for MCP stdio and HTTP connections.
 */

export { McpBridge } from './bridge.js';
export type { McpConnection } from './bridge.js';
export { McpToolProxy } from './tool-proxy.js';
export { McpToolCallBridge } from './tool-call-bridge.js';
export { McpClient, McpHttpClient, createMcpStdioTransport, createMcpHttpTransport } from './transport.js';
export type { McpToolDef, McpCallResult, McpStdioTransportOptions, McpHttpTransportOptions } from './transport.js';
