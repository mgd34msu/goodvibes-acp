# Wave 1 Agent 1: Types & Transport Layer

**ACP Compliance Score**: 6/10
**Issues Found**: 8 (2C, 3M, 2m, 1N)

## Issues

### 1. AcpSessionUpdateType discriminator values are wrong (KB-04, KB-09: Session Updates)
**Severity**: Critical
**File**: `src/types/events.ts`
**Lines**: 263-273
**Description**: The `AcpSessionUpdateType` union contains several incorrect discriminator values that do not match the SDK's `SessionUpdate` type. The SDK uses `sessionUpdate` as the discriminator field with these values:
- `user_message_chunk` (missing from our type)
- `agent_message_chunk` (correct)
- `agent_thought_chunk` (correct)
- `tool_call` (correct)
- `tool_call_update` (correct)
- `plan` (correct)
- `available_commands_update` (our type has `available_commands` — wrong)
- `current_mode_update` (our type has `current_mode` — wrong)
- `config_option_update` (our type has `config_option` — wrong)
- `session_info_update` (our type has `session_info` — wrong)
- `usage_update` (missing from our type)
- `finish` (our type includes this but SDK does not define it)

Five values have incorrect suffixes (missing `_update`), one phantom value (`finish`) exists, and two valid values are missing (`user_message_chunk`, `usage_update`).

**Remediation**: Replace the `AcpSessionUpdateType` union with:
```typescript
export type AcpSessionUpdateType =
  | 'user_message_chunk'
  | 'agent_message_chunk'
  | 'agent_thought_chunk'
  | 'tool_call'
  | 'tool_call_update'
  | 'plan'
  | 'available_commands_update'
  | 'current_mode_update'
  | 'config_option_update'
  | 'session_info_update'
  | 'usage_update';
```

### 2. ToolCallStatus uses 'running' instead of SDK's 'in_progress' (KB-06, KB-09: Tool Calls)
**Severity**: Critical
**File**: `src/types/events.ts` (and any consumers)
**Lines**: 263-273 (referenced in KB-06 prose)
**Description**: KB-06 defines `ToolCallStatus = 'pending' | 'running' | 'completed' | 'failed'` but the authoritative SDK (`types.gen.d.ts` line 2963) defines `ToolCallStatus = 'pending' | 'in_progress' | 'completed' | 'failed'`. Per the instructions, the SDK is authoritative over KB prose. While `src/types/events.ts` doesn't directly define `ToolCallStatus`, the KB-06 prose value `running` is used throughout the codebase (e.g., in `src/extensions/acp/tool-call-emitter.ts` and KB-01 line 165). Any runtime code emitting `status: 'running'` will produce non-compliant ACP wire messages. Clients expect `'in_progress'`, not `'running'`.

**Remediation**: Define a canonical `ToolCallStatus` type in `src/types/events.ts` using the SDK values (`'pending' | 'in_progress' | 'completed' | 'failed'`) and update all consumers to use `'in_progress'` instead of `'running'`.

### 3. SessionConfigOption.options is optional but SDK requires it (KB-03, KB-09: Config Options)
**Severity**: Major
**File**: `src/types/config.ts`
**Lines**: 119-120
**Description**: The `SessionConfigOption` type declares `options?: SessionConfigOptionChoice[]` (optional). The SDK's `SessionConfigSelect` type requires `options: SessionConfigSelectOptions` (non-optional). Since `SessionConfigOption.type` is restricted to `'select'`, options should always be present. Sending a `configOption` without `options` would violate the SDK schema.

**Remediation**: Change `options?:` to `options:` (remove the `?`).

### 4. MCPServerConfig stdio variant requires 'type: stdio' but SDK omits type for stdio (KB-03, KB-09: MCP Servers)
**Severity**: Major
**File**: `src/types/session.ts`
**Lines**: 48-60
**Description**: The `MCPServerConfig` type uses a discriminated union with `type: 'stdio'` for stdio servers. However, the SDK's `McpServer` union type defines stdio as `McpServerStdio` WITHOUT a `type` discriminator — only HTTP and SSE variants have `type` fields. Additionally, the SDK makes `args` and `env` required on `McpServerStdio`, while our type has them as optional. This means:
- Our type requires `type: 'stdio'` which the SDK never sends
- Our type allows omitting `args` and `env` which the SDK requires

**Remediation**: Restructure `MCPServerConfig` to match the SDK union pattern: stdio servers should not require a `type` field, and `args`/`env` should be required (with `args: []` and `env: []` as defaults). Alternatively, keep the discriminated union for internal convenience but add a mapping layer.

### 5. SessionConfigOption missing _meta field (KB-08, KB-09: Extensibility)
**Severity**: Major
**File**: `src/types/config.ts`
**Lines**: 103-123
**Description**: The SDK's `SessionConfigOption` type includes an optional `_meta?: { [key: string]: unknown } | null` field for ACP extensibility. Our `SessionConfigOption` type omits this field entirely. While `SessionConfigOptionChoice` correctly includes `_meta`, the parent `SessionConfigOption` does not. This means extensibility metadata cannot be attached to config options sent over the wire.

**Remediation**: Add `_meta?: Record<string, unknown>` to the `SessionConfigOption` type.

### 6. SessionConfigOption.options doesn't support grouped options (KB-09: Config Options)
**Severity**: Minor
**File**: `src/types/config.ts`
**Lines**: 119-120
**Description**: The SDK defines `SessionConfigSelectOptions = Array<SessionConfigSelectOption> | Array<SessionConfigSelectGroup>`, supporting both flat and grouped option lists. Our `SessionConfigOptionChoice[]` type only supports flat options. This means config options that need visual grouping (e.g., grouping models by provider) cannot be represented.

**Remediation**: Define a `SessionConfigOptionGroup` type and update `options` to accept either flat or grouped arrays, matching the SDK's `SessionConfigSelectOptions` union.

### 7. ToolKind/ToolCallKind missing 'switch_mode' (KB-09: Tool Calls)
**Severity**: Minor
**File**: `src/types/events.ts` (or wherever ToolCallKind is referenced)
**Lines**: N/A (type not defined in src/types/ but used in extensions)
**Description**: The SDK defines `ToolKind = "read" | "edit" | "delete" | "move" | "search" | "execute" | "think" | "fetch" | "switch_mode" | "other"`. KB-06 line 103-112 lists ToolCallKind without `switch_mode`. If the runtime defines its own ToolCallKind type or enum, it should include `switch_mode` per the SDK.

**Remediation**: Ensure any `ToolCallKind` or `ToolKind` type defined in the codebase includes `'switch_mode'`.

### 8. EnvVariable and HttpHeader missing _meta field (KB-08, KB-09: Extensibility)
**Severity**: Nitpick
**File**: `src/types/session.ts`
**Lines**: 33, 39
**Description**: The SDK's `EnvVariable` type includes an optional `_meta` field. Our `EnvVariable = { name: string; value: string }` omits it. Similarly, `HttpHeader` omits `_meta`. While unlikely to cause practical issues, it means metadata cannot roundtrip through these types.

**Remediation**: Add `_meta?: Record<string, unknown>` to both `EnvVariable` and `HttpHeader` types.
