import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import {
  ACP_ERROR_CODES,
  toAcpError,
} from '../../src/extensions/acp/errors.js';

// ---------------------------------------------------------------------------
// ACP_ERROR_CODES constants
// ---------------------------------------------------------------------------

describe('ACP_ERROR_CODES', () => {
  test('PARSE_ERROR is -32700', () => {
    expect(ACP_ERROR_CODES.PARSE_ERROR).toBe(-32700);
  });

  test('INVALID_REQUEST is -32600', () => {
    expect(ACP_ERROR_CODES.INVALID_REQUEST).toBe(-32600);
  });

  test('METHOD_NOT_FOUND is -32601', () => {
    expect(ACP_ERROR_CODES.METHOD_NOT_FOUND).toBe(-32601);
  });

  test('INVALID_PARAMS is -32602', () => {
    expect(ACP_ERROR_CODES.INVALID_PARAMS).toBe(-32602);
  });

  test('INTERNAL_ERROR is -32603', () => {
    expect(ACP_ERROR_CODES.INTERNAL_ERROR).toBe(-32603);
  });

  test('SESSION_NOT_FOUND is -32000', () => {
    expect(ACP_ERROR_CODES.SESSION_NOT_FOUND).toBe(-32000);
  });

  test('SESSION_LOAD_FAILED is -32001', () => {
    expect(ACP_ERROR_CODES.SESSION_LOAD_FAILED).toBe(-32001);
  });

  test('MCP_CONNECT_FAILED is -32002', () => {
    expect(ACP_ERROR_CODES.MCP_CONNECT_FAILED).toBe(-32002);
  });

  test('PERMISSION_DENIED is -32003', () => {
    expect(ACP_ERROR_CODES.PERMISSION_DENIED).toBe(-32003);
  });

  test('AGENT_SPAWN_FAILED is -32004', () => {
    expect(ACP_ERROR_CODES.AGENT_SPAWN_FAILED).toBe(-32004);
  });

  test('REQUEST_CANCELLED is -32800', () => {
    expect(ACP_ERROR_CODES.REQUEST_CANCELLED).toBe(-32800);
  });
});

// ---------------------------------------------------------------------------
// toAcpError — well-known error mappings
// ---------------------------------------------------------------------------

describe('toAcpError', () => {
  test('maps Session not found prefix to SESSION_NOT_FOUND', () => {
    const err = new Error('Session not found: abc-123');
    const result = toAcpError(err);
    expect(result.code).toBe(ACP_ERROR_CODES.SESSION_NOT_FOUND);
    expect(result.message).toBe('Session not found: abc-123');
  });

  test('maps Session load failed prefix to SESSION_LOAD_FAILED', () => {
    const err = new Error('Session load failed: corrupt data');
    const result = toAcpError(err);
    expect(result.code).toBe(ACP_ERROR_CODES.SESSION_LOAD_FAILED);
    expect(result.message).toBe('Session load failed: corrupt data');
  });

  test('maps MCP connect failed prefix to MCP_CONNECT_FAILED', () => {
    const err = new Error('MCP connect failed: timeout');
    const result = toAcpError(err);
    expect(result.code).toBe(ACP_ERROR_CODES.MCP_CONNECT_FAILED);
    expect(result.message).toBe('MCP connect failed: timeout');
  });

  test('maps Permission denied prefix to PERMISSION_DENIED', () => {
    const err = new Error('Permission denied: read access');
    const result = toAcpError(err);
    expect(result.code).toBe(ACP_ERROR_CODES.PERMISSION_DENIED);
    expect(result.message).toBe('Permission denied: read access');
  });

  test('maps Agent spawn failed prefix to AGENT_SPAWN_FAILED', () => {
    const err = new Error('Agent spawn failed: quota exceeded');
    const result = toAcpError(err);
    expect(result.code).toBe(ACP_ERROR_CODES.AGENT_SPAWN_FAILED);
    expect(result.message).toBe('Agent spawn failed: quota exceeded');
  });

  test('maps Request cancelled prefix to REQUEST_CANCELLED', () => {
    const err = new Error('Request cancelled: user initiated');
    const result = toAcpError(err);
    expect(result.code).toBe(ACP_ERROR_CODES.REQUEST_CANCELLED);
    expect(result.message).toBe('Request cancelled: user initiated');
  });

  test('maps Cancelled prefix to REQUEST_CANCELLED', () => {
    const err = new Error('Cancelled');
    const result = toAcpError(err);
    expect(result.code).toBe(ACP_ERROR_CODES.REQUEST_CANCELLED);
    expect(result.message).toBe('Cancelled');
  });

  test('maps generic Error to INTERNAL_ERROR', () => {
    const err = new Error('Something went wrong');
    const result = toAcpError(err);
    expect(result.code).toBe(ACP_ERROR_CODES.INTERNAL_ERROR);
    expect(result.message).toBe('Something went wrong');
  });

  test('maps string to INTERNAL_ERROR', () => {
    const result = toAcpError('plain string error');
    expect(result.code).toBe(ACP_ERROR_CODES.INTERNAL_ERROR);
    expect(result.message).toBe('plain string error');
  });

  test('maps unknown object to INTERNAL_ERROR with data', () => {
    const obj = { type: 'custom', detail: 42 };
    const result = toAcpError(obj);
    expect(result.code).toBe(ACP_ERROR_CODES.INTERNAL_ERROR);
    expect(result.message).toBe('An unknown error occurred');
    expect(result.data).toEqual(obj);
  });

  test('maps null to INTERNAL_ERROR', () => {
    const result = toAcpError(null);
    expect(result.code).toBe(ACP_ERROR_CODES.INTERNAL_ERROR);
    expect(result.message).toBe('An unknown error occurred');
  });

  test('maps undefined to INTERNAL_ERROR', () => {
    const result = toAcpError(undefined);
    expect(result.code).toBe(ACP_ERROR_CODES.INTERNAL_ERROR);
    expect(result.message).toBe('An unknown error occurred');
  });

  test('never throws regardless of input', () => {
    const inputs = [null, undefined, 42, [], {}, '', new Error('test'), 'string'];
    for (const input of inputs) {
      expect(() => toAcpError(input)).not.toThrow();
    }
  });

  // -------------------------------------------------------------------------
  // Stack trace exposure: production vs development
  // -------------------------------------------------------------------------

  describe('stack trace in development vs production', () => {
    let originalNodeEnv: string | undefined;

    beforeEach(() => {
      originalNodeEnv = process.env.NODE_ENV;
    });

    afterEach(() => {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    test('includes stack trace data in development environment for generic errors', () => {
      process.env.NODE_ENV = 'development';
      const err = new Error('dev error');
      const result = toAcpError(err);
      // In development, data should be the stack string
      expect(result.data).toBeDefined();
      expect(typeof result.data).toBe('string');
    });

    test('does not include stack trace data in production environment', () => {
      process.env.NODE_ENV = 'production';
      const err = new Error('prod error');
      const result = toAcpError(err);
      expect(result.data).toBeUndefined();
    });

    test('does not include stack trace for well-known error codes regardless of NODE_ENV', () => {
      process.env.NODE_ENV = 'development';
      const err = new Error('Session not found: test');
      const result = toAcpError(err);
      // Well-known codes do not attach data
      expect(result.data).toBeUndefined();
    });
  });
});
