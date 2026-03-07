/**
 * Tests for ACP transport abstraction.
 *
 * Covers:
 *   - createStdioTransport: returns an AcpStream (readable + writable)
 *   - createTcpTransportFromSocket: wraps a net.Socket into an AcpStream
 *   - createTransport({ type: 'tcp' }): throws with helpful error message
 *   - createTransport({ type: 'websocket' }): throws
 *   - createTransport({ type: 'stdio' }): returns an AcpStream
 */
import { describe, test, expect, afterEach } from 'bun:test';
import * as net from 'node:net';
import {
  createStdioTransport,
  createTcpTransportFromSocket,
  createTransport,
} from '../../src/extensions/acp/transport.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal AcpStream shape check — ndJsonStream returns { readable, writable } */
function isAcpStream(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return 'readable' in obj && 'writable' in obj;
}

// ---------------------------------------------------------------------------
// createStdioTransport
// ---------------------------------------------------------------------------

describe('createStdioTransport', () => {
  test('returns an AcpStream with readable and writable', () => {
    const stream = createStdioTransport();
    expect(isAcpStream(stream)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createTcpTransportFromSocket
// ---------------------------------------------------------------------------

describe('createTcpTransportFromSocket', () => {
  let server: net.Server | undefined;

  afterEach(() => {
    if (server) {
      server.close();
      server = undefined;
    }
  });

  test('wraps a connected TCP socket into an AcpStream', async () => {
    await new Promise<void>((resolve, reject) => {
      server = net.createServer((socket) => {
        try {
          const stream = createTcpTransportFromSocket(socket);
          expect(isAcpStream(stream)).toBe(true);
          socket.destroy();
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      server.listen(0, '127.0.0.1', () => {
        const addr = server!.address() as net.AddressInfo;
        const client = net.connect(addr.port, '127.0.0.1');
        client.on('error', reject);
      });

      server.on('error', reject);
    });
  });

  test('AcpStream from socket has readable and writable', async () => {
    let stream: ReturnType<typeof createTcpTransportFromSocket> | undefined;

    await new Promise<void>((resolve, reject) => {
      server = net.createServer((socket) => {
        try {
          stream = createTcpTransportFromSocket(socket);
          socket.destroy();
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      server.listen(0, '127.0.0.1', () => {
        const addr = server!.address() as net.AddressInfo;
        const client = net.connect(addr.port, '127.0.0.1');
        client.on('error', reject);
      });

      server.on('error', reject);
    });

    expect(stream).toBeDefined();
    expect(typeof (stream as Record<string, unknown>).readable).not.toBe('undefined');
    expect(typeof (stream as Record<string, unknown>).writable).not.toBe('undefined');
  });
});

// ---------------------------------------------------------------------------
// createTransport — error cases
// ---------------------------------------------------------------------------

describe('createTransport({ type: \'tcp\' })', () => {
  test('throws with message mentioning createTcpTransportFromSocket', () => {
    expect(() =>
      createTransport({ type: 'tcp', port: 9999 }),
    ).toThrow('createTcpTransportFromSocket');
  });

  test('throws with message about daemon:connection pattern', () => {
    expect(() =>
      createTransport({ type: 'tcp', port: 9999 }),
    ).toThrow('daemon:connection');
  });
});

describe('createTransport({ type: \'websocket\' })', () => {
  test('throws with message about WebSocket not being implemented', () => {
    expect(() =>
      createTransport({ type: 'websocket', port: 9999 }),
    ).toThrow('WebSocket transport is not yet implemented');
  });
});

describe('createTransport({ type: \'stdio\' })', () => {
  test('returns an AcpStream', () => {
    const stream = createTransport({ type: 'stdio' });
    expect(isAcpStream(stream)).toBe(true);
  });
});
