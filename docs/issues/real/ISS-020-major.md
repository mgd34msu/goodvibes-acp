# ISS-020: `HistoryMessage` uses flat `content: string` instead of `ContentBlock`

**Severity**: Major  
**File**: `src/types/session.ts`  
**Lines**: 94-101  
**KB Reference**: KB-03 (Sessions)

## Description

ACP history replay emits `ContentBlock` structures. Storing content as plain string loses non-text content (images, resources).

## Evidence

Our `HistoryMessage` type (`src/types/session.ts` lines 94-101):
```typescript
export type HistoryMessage = {
  role: 'user' | 'assistant';
  content: string;      // Plain string only
  timestamp: number;
};
```

The SDK `ContentBlock` type is a discriminated union supporting text, images, resources, and resource links:
```typescript
export type ContentBlock = (TextContent & { type: "text" })
  | (ImageContent & { type: "image" })
  | (Resource & { type: "resource" })
  | (ResourceLink & { type: "resource_link" });
```

ACP prompt requests use `Array<ContentBlock>` for message content. When history is replayed via `session/load`, messages should preserve their original `ContentBlock` structure. Storing as `string` means:
1. Image content is lost
2. Resource/resource link content is lost
3. Multi-block messages are flattened

### Verdict: CONFIRMED

The `HistoryMessage` type uses `content: string` which cannot preserve non-text ACP content blocks. This causes data loss during session resume/replay.

## Remediation

1. Change `content: string` to `content: ContentBlock[]` (or `ContentBlock | ContentBlock[]`).
2. Define a local `ContentBlock` type in L0 types that mirrors the SDK's discriminated union.
3. Update all code that constructs `HistoryMessage` to use `ContentBlock` arrays.
4. Update serialization/deserialization to handle the structured content.
