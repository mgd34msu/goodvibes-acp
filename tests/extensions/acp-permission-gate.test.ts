import { describe, it, expect, mock } from 'bun:test';
import { PermissionGate, MODE_POLICIES } from '../../src/extensions/acp/permission-gate.js';
import type { PermissionPolicy, PermissionRequest } from '../../src/types/permissions.js';
import type { AgentSideConnection } from '@agentclientprotocol/sdk';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AcpOutcome =
  | { outcome: 'cancelled' }
  | { outcome: 'selected'; optionId: string };

function makeConn(outcomePayload: AcpOutcome = { outcome: 'selected', optionId: 'allow_once' }): {
  conn: AgentSideConnection;
  requestPermissionMock: ReturnType<typeof mock>;
} {
  const requestPermissionMock = mock(async (_params: unknown) => ({ outcome: outcomePayload }));
  const conn = {
    requestPermission: requestPermissionMock,
  } as unknown as AgentSideConnection;
  return { conn, requestPermissionMock };
}

function makeRequest(overrides: Partial<PermissionRequest> = {}): PermissionRequest {
  return {
    type: 'tool_call',
    title: 'Execute tool',
    description: 'Run a tool',
    ...overrides,
  };
}

const SESSION_ID = 'sess-test-001';

// ---------------------------------------------------------------------------
// PermissionGate — auto-approve
// ---------------------------------------------------------------------------

describe('PermissionGate', () => {
  describe('auto-approve policy', () => {
    it('grants immediately without calling conn for auto-approved types', async () => {
      const { conn, requestPermissionMock } = makeConn();
      const policy: PermissionPolicy = {
        autoApprove: ['tool_call'],
        alwaysDeny: [],
        promptForUnknown: true,
      };
      const gate = new PermissionGate(conn, SESSION_ID, policy);

      const result = await gate.check(makeRequest({ type: 'tool_call' }));

      expect(result.status).toBe('granted');
      expect(requestPermissionMock).not.toHaveBeenCalled();
    });

    it('grants all types in the auto-approve list without calling conn', async () => {
      const { conn, requestPermissionMock } = makeConn();
      const policy: PermissionPolicy = {
        autoApprove: ['file_read', 'file_write'],
        alwaysDeny: [],
        promptForUnknown: true,
      };
      const gate = new PermissionGate(conn, SESSION_ID, policy);

      const r1 = await gate.check(makeRequest({ type: 'file_read' }));
      const r2 = await gate.check(makeRequest({ type: 'file_write' }));

      expect(r1.status).toBe('granted');
      expect(r2.status).toBe('granted');
      expect(requestPermissionMock).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // always-deny
  // -------------------------------------------------------------------------

  describe('always-deny policy', () => {
    it('denies immediately without calling conn for always-denied types', async () => {
      const { conn, requestPermissionMock } = makeConn();
      const policy: PermissionPolicy = {
        autoApprove: [],
        alwaysDeny: ['command_execute'],
        promptForUnknown: true,
      };
      const gate = new PermissionGate(conn, SESSION_ID, policy);

      const result = await gate.check(makeRequest({ type: 'command_execute' }));

      expect(result.status).toBe('denied');
      expect(result.reason).toBe('Policy: always denied');
      expect(requestPermissionMock).not.toHaveBeenCalled();
    });

    it('denies all types in the always-deny list without calling conn', async () => {
      const { conn, requestPermissionMock } = makeConn();
      const policy: PermissionPolicy = {
        autoApprove: [],
        alwaysDeny: ['command_execute', 'network_access'],
        promptForUnknown: true,
      };
      const gate = new PermissionGate(conn, SESSION_ID, policy);

      const r1 = await gate.check(makeRequest({ type: 'command_execute' }));
      const r2 = await gate.check(makeRequest({ type: 'network_access' }));

      expect(r1.status).toBe('denied');
      expect(r2.status).toBe('denied');
      expect(requestPermissionMock).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // promptForUnknown = false
  // -------------------------------------------------------------------------

  describe('promptForUnknown = false', () => {
    it('grants without calling conn when type is not in either list and promptForUnknown is false', async () => {
      const { conn, requestPermissionMock } = makeConn();
      const policy: PermissionPolicy = {
        autoApprove: [],
        alwaysDeny: [],
        promptForUnknown: false,
      };
      const gate = new PermissionGate(conn, SESSION_ID, policy);

      const result = await gate.check(makeRequest({ type: 'network_access' }));

      expect(result.status).toBe('granted');
      expect(requestPermissionMock).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // client prompting
  // -------------------------------------------------------------------------

  describe('client prompting', () => {
    it('calls conn.requestPermission for unknown types when promptForUnknown is true', async () => {
      const { conn, requestPermissionMock } = makeConn({ outcome: 'selected', optionId: 'allow_once' });
      const policy: PermissionPolicy = {
        autoApprove: [],
        alwaysDeny: [],
        promptForUnknown: true,
      };
      const gate = new PermissionGate(conn, SESSION_ID, policy);

      await gate.check(makeRequest({ type: 'network_access' }));

      expect(requestPermissionMock).toHaveBeenCalledTimes(1);
    });

    it('passes sessionId to conn.requestPermission', async () => {
      const { conn, requestPermissionMock } = makeConn({ outcome: 'selected', optionId: 'allow_once' });
      const policy: PermissionPolicy = {
        autoApprove: [],
        alwaysDeny: [],
        promptForUnknown: true,
      };
      const gate = new PermissionGate(conn, 'my-session-id', policy);

      await gate.check(makeRequest({ type: 'file_write' }));

      const call = requestPermissionMock.mock.calls[0][0] as { sessionId: string };
      expect(call.sessionId).toBe('my-session-id');
    });

    it('passes title and description in toolCall to conn.requestPermission', async () => {
      const { conn, requestPermissionMock } = makeConn({ outcome: 'selected', optionId: 'allow_once' });
      const policy: PermissionPolicy = {
        autoApprove: [],
        alwaysDeny: [],
        promptForUnknown: true,
      };
      const gate = new PermissionGate(conn, SESSION_ID, policy);

      await gate.check(makeRequest({
        type: 'file_write',
        title: 'Write config',
        description: '/etc/config.json',
      }));

      const call = requestPermissionMock.mock.calls[0][0] as { toolCall: Record<string, unknown> };
      expect(call.toolCall.title).toBe('Write config');
    });

    it('passes options array to conn.requestPermission', async () => {
      const { conn, requestPermissionMock } = makeConn({ outcome: 'selected', optionId: 'allow_once' });
      const policy: PermissionPolicy = {
        autoApprove: [],
        alwaysDeny: [],
        promptForUnknown: true,
      };
      const gate = new PermissionGate(conn, SESSION_ID, policy);

      await gate.check(makeRequest({ type: 'file_write' }));

      const call = requestPermissionMock.mock.calls[0][0] as { options: unknown[] };
      expect(Array.isArray(call.options)).toBe(true);
      expect(call.options.length).toBeGreaterThan(0);
    });

    it('returns granted when conn outcome is selected with allow_once', async () => {
      const { conn } = makeConn({ outcome: 'selected', optionId: 'allow_once' });
      const policy: PermissionPolicy = { autoApprove: [], alwaysDeny: [], promptForUnknown: true };
      const gate = new PermissionGate(conn, SESSION_ID, policy);

      const result = await gate.check(makeRequest({ type: 'file_write' }));

      expect(result.status).toBe('granted');
    });

    it('returns denied when conn outcome is cancelled', async () => {
      const { conn } = makeConn({ outcome: 'cancelled' });
      const policy: PermissionPolicy = { autoApprove: [], alwaysDeny: [], promptForUnknown: true };
      const gate = new PermissionGate(conn, SESSION_ID, policy);

      const result = await gate.check(makeRequest({ type: 'file_write' }));

      expect(result.status).toBe('denied');
    });

    it('returns denied when conn outcome is selected with reject_once', async () => {
      const { conn } = makeConn({ outcome: 'selected', optionId: 'reject_once' });
      const policy: PermissionPolicy = { autoApprove: [], alwaysDeny: [], promptForUnknown: true };
      const gate = new PermissionGate(conn, SESSION_ID, policy);

      const result = await gate.check(makeRequest({ type: 'file_write' }));

      expect(result.status).toBe('denied');
    });

    it('returns denied with reason when conn throws (e.g. session cancelled)', async () => {
      const requestPermissionMock = mock(async () => { throw new Error('Session cancelled'); });
      const conn = { requestPermission: requestPermissionMock } as unknown as AgentSideConnection;
      const policy: PermissionPolicy = { autoApprove: [], alwaysDeny: [], promptForUnknown: true };
      const gate = new PermissionGate(conn, SESSION_ID, policy);

      const result = await gate.check(makeRequest({ type: 'command_execute' }));

      expect(result.status).toBe('denied');
      expect(result.reason).toBe('Permission request failed');
    });
  });

  // -------------------------------------------------------------------------
  // MODE_POLICIES
  // -------------------------------------------------------------------------

  describe('MODE_POLICIES', () => {
    it('justvibes auto-approves all permission types', () => {
      const policy = MODE_POLICIES['justvibes']!;
      const allTypes: Array<PermissionRequest['type']> = [
        'tool_call', 'file_read', 'file_write', 'command_execute', 'network_access',
      ];
      for (const type of allTypes) {
        expect(policy.autoApprove).toContain(type);
      }
      expect(policy.alwaysDeny).toHaveLength(0);
      expect(policy.promptForUnknown).toBe(false);
    });

    it('vibecoding auto-approves tool_call, file_read, file_write, command_execute but not network_access', () => {
      const policy = MODE_POLICIES['vibecoding']!;
      expect(policy.autoApprove).toContain('tool_call');
      expect(policy.autoApprove).toContain('file_read');
      expect(policy.autoApprove).toContain('file_write');
      expect(policy.autoApprove).toContain('command_execute');
      expect(policy.autoApprove).not.toContain('network_access');
      expect(policy.promptForUnknown).toBe(true);
    });

    it('plan auto-approves only file_read and always-denies command_execute', () => {
      const policy = MODE_POLICIES['plan']!;
      expect(policy.autoApprove).toEqual(['file_read']);
      expect(policy.alwaysDeny).toContain('command_execute');
      expect(policy.promptForUnknown).toBe(true);
    });

    it('sandbox auto-approves tool_call and file_read, always-denies network_access', () => {
      const policy = MODE_POLICIES['sandbox']!;
      expect(policy.autoApprove).toContain('tool_call');
      expect(policy.autoApprove).toContain('file_read');
      expect(policy.alwaysDeny).toContain('network_access');
      expect(policy.promptForUnknown).toBe(true);
    });

    it('all four modes are defined', () => {
      expect(MODE_POLICIES).toHaveProperty('justvibes');
      expect(MODE_POLICIES).toHaveProperty('vibecoding');
      expect(MODE_POLICIES).toHaveProperty('plan');
      expect(MODE_POLICIES).toHaveProperty('sandbox');
    });
  });
});
