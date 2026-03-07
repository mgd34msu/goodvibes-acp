/**
 * @module mcp
 * @layer L2 — MCP integration barrel export
 *
 * Exports the McpBridge orchestrator, McpToolProxy registry adapter,
 * and transport primitives for MCP stdio connections.
 */

export { McpBridge } from './bridge.js';
export type { McpConnection } from './bridge.js';
export { McpToolProxy } from './tool-proxy.js';
export { McpClient, createMcpStdioTransport } from './transport.js';
export type { McpToolDef, McpCallResult, McpStdioTransportOptions } from './transport.js';
