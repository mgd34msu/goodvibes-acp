/**
 * Tests for AgentsPlugin registration.
 * Uses real L1 Registry instances.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { Registry } from '../../src/core/registry.ts';
import { AgentsPlugin } from '../../src/plugins/agents/index.ts';
import type { IAgentSpawner } from '../../src/types/registry.ts';

describe('AgentsPlugin registration', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
  });

  it('register() does not throw', () => {
    expect(() => AgentsPlugin.register(registry)).not.toThrow();
  });

  it('registers agent-spawner under single key "agent-spawner"', () => {
    AgentsPlugin.register(registry);
    expect(registry.has('agent-spawner')).toBe(true);
  });

  it('registered spawner is retrievable via get("agent-spawner")', () => {
    AgentsPlugin.register(registry);
    const spawner = registry.get<IAgentSpawner>('agent-spawner');
    expect(spawner).toBeDefined();
  });

  it('registered spawner implements IAgentSpawner (has spawn method)', () => {
    AgentsPlugin.register(registry);
    const spawner = registry.get<IAgentSpawner>('agent-spawner');
    expect(typeof spawner.spawn).toBe('function');
  });

  it('registered spawner implements IAgentSpawner (has result method)', () => {
    AgentsPlugin.register(registry);
    const spawner = registry.get<IAgentSpawner>('agent-spawner');
    expect(typeof spawner.result).toBe('function');
  });

  it('registered spawner implements IAgentSpawner (has cancel method)', () => {
    AgentsPlugin.register(registry);
    const spawner = registry.get<IAgentSpawner>('agent-spawner');
    expect(typeof spawner.cancel).toBe('function');
  });

  it('registered spawner implements IAgentSpawner (has status method)', () => {
    AgentsPlugin.register(registry);
    const spawner = registry.get<IAgentSpawner>('agent-spawner');
    expect(typeof spawner.status).toBe('function');
  });

  it('spawner can spawn an agent and resolve result', async () => {
    AgentsPlugin.register(registry);
    const spawner = registry.get<IAgentSpawner>('agent-spawner');
    const handle = await spawner.spawn({
      type: 'engineer',
      task: 'test task',
      sessionId: 'sess-1',
    });
    expect(handle.type).toBe('engineer');
    const result = await spawner.result(handle);
    expect(result.status).toBe('completed');
  });

  it('manifest has correct name, layer, and capabilities', () => {
    expect(AgentsPlugin.manifest.name).toBe('agents');
    expect(AgentsPlugin.manifest.layer).toBe('L3');
    expect(AgentsPlugin.manifest.capabilities).toContain('agent-spawning');
  });

  it('shutdown() resolves without error', async () => {
    await expect(AgentsPlugin.shutdown()).resolves.toBeUndefined();
  });
});
