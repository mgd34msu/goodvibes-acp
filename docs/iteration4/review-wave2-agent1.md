# Wave 2 Review — EventBus & Registry

**Reviewer**: ACP Compliance Agent (Iteration 4, Phase 2)  
**Files reviewed**:
- `src/core/event-bus.ts`
- `src/core/registry.ts`
- `src/types/events.ts`
- `src/types/registry.ts`

**KB sources**: KB-04 (prompt-turn), KB-08 (extensibility), KB-09 (typescript-sdk)

---

## Issues

### 1. AcpSessionUpdateType missing `user_message_chunk` (Major)

**File**: `src/types/events.ts:263-273`  
**KB topic**: KB-04 line 423, table at line 558  
**Description**: `AcpSessionUpdateType` omits `user_message_chunk`, which KB-04 defines as a valid `sessionUpdate` discriminator used during `session/load` history replay. Any runtime code switching on this union type will reject or fail to handle replayed user messages.

### 2. AcpSessionUpdateType uses `current_mode` — should be `current_mode_update` (Major)

**File**: `src/types/events.ts:271`  
**KB topic**: KB-04 line 369/377/557, KB-09 line 923  
**Description**: KB-04 wire format shows the discriminator is `current_mode_update` (line 369: `"sessionUpdate": "current_mode_update"`). KB-09 table shows `current_mode` but the TypeScript interface (KB-09 line 631: `CurrentModeUpdate`) and KB-04 wire examples are authoritative. The current value `current_mode` may cause wire-format mismatch. **However**: KB-09 SDK schema types export `CurrentModeUpdate` which maps to the SDK's actual discriminator. Since KB-04/KB-09 disagree, and the task notes "SDK authoritative", the SDK's actual discriminator value should be verified. If the SDK uses `current_mode`, current code is correct; if `current_mode_update`, this needs fixing.

**Severity reduced to Minor** pending SDK verification — the known context notes KB-04/KB-06 differences where SDK is authoritative.

### 3. AcpSessionUpdateType `config_option` vs `config_options_update` (Minor)

**File**: `src/types/events.ts:272`  
**KB topic**: KB-04 line 385/396/521/556, KB-09 line 923  
**Description**: KB-04 consistently uses `config_options_update` on the wire (line 396, 521, 556). KB-09 table at line 923 shows `config_option`. The code was recently changed from `config_options_update` to `config_option`. Same SDK-authoritative principle applies — if the SDK schema type `ConfigOptionUpdate` maps to `config_option` as the discriminator, the current code is correct. Low risk given known KB discrepancies.

### 4. ToolResult lacks `_meta` field (Major)

**File**: `src/types/registry.ts:29-40`  
**KB topic**: KB-08 line 7, 26  
**Description**: KB-08 states `_meta` is available on "every type in the ACP protocol" and specifically on "nested types: content blocks, tool calls, plan entries, capability objects". `ToolResult` is the return value for tool execution and should carry `_meta` for W3C trace context propagation and vendor-specific metadata. Adding `_meta?: Record<string, unknown>` would align with ACP extensibility requirements.

### 5. EventBus `_emitError` does not propagate `_meta` (Minor)

**File**: `src/core/event-bus.ts:345-350`  
**KB topic**: KB-08 (extensibility — `_meta` propagation)  
**Description**: When `_emitError` creates an error `EventRecord`, it does not carry forward any `_meta` from the originating event. This breaks W3C trace context propagation for error events — if a handler fails during processing of a traced event, the error event loses the trace context. The source event's `_meta` (or at least `traceparent`/`tracestate`) should be propagated to the error record.

### 6. EventBus `handlerCount` omits prefix handlers (Minor)

**File**: `src/core/event-bus.ts:319-326`  
**KB topic**: N/A (internal consistency)  
**Description**: The `handlerCount` getter only iterates `_handlers` but ignores `_prefixHandlers`. After the O(1) prefix optimization was added, handlers registered via `on('session:*', fn)` are stored in `_prefixHandlers` and won't be counted. This gives an inaccurate count. Should also iterate `_prefixHandlers`.

### 7. EventBus prefix wildcard only matches last colon segment (Nitpick)

**File**: `src/core/event-bus.ts:217-223`  
**KB topic**: N/A (behavioral edge case)  
**Description**: The `lastIndexOf(':')` approach means for an event type `a:b:c`, only the prefix `a:b:` is checked in `_prefixHandlers`. A subscription to `a:*` (which stores prefix `a:`) would NOT match `a:b:c` because the code only checks the last colon. This is a behavioral limitation of the O(1) optimization vs the previous O(k) iteration approach. If multi-level wildcards are needed (e.g., `agent:*` matching `agent:status:changed`), this needs to iterate all possible prefix segments.

### 8. EventBus `once()` race condition with async handlers (Nitpick)

**File**: `src/core/event-bus.ts:152-166`  
**KB topic**: N/A (correctness)  
**Description**: The `once()` wrapper uses a `disposed` flag to prevent double-fire, but the disposal happens synchronously via `this.off()` before awaiting the handler result. If the same event type is emitted rapidly in concurrent async contexts (e.g., multiple promises resolving), the flag correctly prevents double-fire. However, the handler is called and then `off()` removes the wrapper — any in-flight iteration of the handler set could theoretically skip handlers if `Set.delete` is called during iteration. In practice, JavaScript's single-threaded nature and Set iteration semantics (items deleted during iteration are not visited if not yet reached) make this safe.

### 9. Registry type safety relies on caller discipline (Minor)

**File**: `src/core/registry.ts:38-46`  
**KB topic**: N/A (robustness)  
**Description**: Both `_single` and `_multi` store values as `unknown`, and `get<T>()` casts blindly to `T`. There's no runtime type guard. This is documented in the WARNING comments (good), but a production ACP runtime handling third-party plugin registrations could benefit from optional runtime validation (e.g., checking interface shape) to provide better error messages when a plugin registers the wrong type.

---

## Previously Reported Issues — Status

| Issue | Status |
|-------|--------|
| O(k) handler iteration | **Fixed** — prefix handlers now use O(1) Map lookup |
| `_meta` propagation missing on `emit()` | **Fixed** — emit() now accepts `_meta` via options object |
| ToolResult lacks `_meta` | **Open** — see Issue #4 above |
| Wildcard re-entry risk | **Mitigated** — error handler recursion guard exists (line 337) |

---

## Overall ACP Compliance Score

**7.5 / 10**

**Strengths**:
- EventBus correctly implements `_meta` propagation on `emit()` (fixed from prior review)
- O(1) prefix wildcard lookup is a solid performance improvement
- Event type unions cover the core ACP session update types
- Registry is clean, well-documented, and follows the capability pattern
- Error isolation prevents handler failures from crashing the bus

**Gaps**:
- `AcpSessionUpdateType` is missing `user_message_chunk` (needed for session/load replay)
- `ToolResult` still lacks `_meta` per KB-08 extensibility requirement
- `_emitError` breaks trace context propagation
- `handlerCount` is inaccurate after prefix optimization
- Wire-format discriminator values need SDK verification (`current_mode` vs `current_mode_update`)

**Recommendation**: Address Issues #1, #4, #5, and #6 before next review iteration. Issues #2 and #3 need SDK source verification to determine correct wire-format values.
