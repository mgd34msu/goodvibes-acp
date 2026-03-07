import { describe, it, expect } from 'bun:test';
import { getModeConfig, MODE_DEFINITIONS } from '../../src/extensions/sessions/modes.js';
import type { ModeConfig } from '../../src/extensions/sessions/modes.js';

const REQUIRED_FIELDS: (keyof ModeConfig)[] = [
  'name',
  'displayName',
  'description',
  'maxAgents',
  'minReviewScore',
  'autoChain',
  'confirmWrites',
  'sandboxed',
];

describe('MODE_DEFINITIONS', () => {
  it('defines exactly 4 modes', () => {
    const keys = Object.keys(MODE_DEFINITIONS);
    expect(keys).toHaveLength(4);
  });

  it('contains justvibes, vibecoding, sandbox, and plan', () => {
    expect(MODE_DEFINITIONS).toHaveProperty('justvibes');
    expect(MODE_DEFINITIONS).toHaveProperty('vibecoding');
    expect(MODE_DEFINITIONS).toHaveProperty('sandbox');
    expect(MODE_DEFINITIONS).toHaveProperty('plan');
  });

  for (const modeName of ['justvibes', 'vibecoding', 'sandbox', 'plan'] as const) {
    describe(`${modeName} mode`, () => {
      const def = MODE_DEFINITIONS[modeName];

      it(`has name field matching key ("${modeName}")`, () => {
        expect(def.name).toBe(modeName);
      });

      for (const field of REQUIRED_FIELDS) {
        it(`has required field: ${field}`, () => {
          expect(def).toHaveProperty(field);
          expect(def[field]).not.toBeUndefined();
        });
      }

      it('has maxAgents as a positive number', () => {
        expect(typeof def.maxAgents).toBe('number');
        expect(def.maxAgents).toBeGreaterThan(0);
      });

      it('has minReviewScore between 0 and 10', () => {
        expect(def.minReviewScore).toBeGreaterThanOrEqual(0);
        expect(def.minReviewScore).toBeLessThanOrEqual(10);
      });

      it('has boolean flags for autoChain, confirmWrites, sandboxed', () => {
        expect(typeof def.autoChain).toBe('boolean');
        expect(typeof def.confirmWrites).toBe('boolean');
        expect(typeof def.sandboxed).toBe('boolean');
      });

      it('has non-empty displayName and description strings', () => {
        expect(typeof def.displayName).toBe('string');
        expect(def.displayName.length).toBeGreaterThan(0);
        expect(typeof def.description).toBe('string');
        expect(def.description.length).toBeGreaterThan(0);
      });
    });
  }
});

describe('getModeConfig', () => {
  it('returns justvibes config for "justvibes"', () => {
    const config = getModeConfig('justvibes');
    expect(config.name).toBe('justvibes');
    expect(config.maxAgents).toBe(3);
    expect(config.minReviewScore).toBe(9.5);
    expect(config.autoChain).toBe(false);
    expect(config.confirmWrites).toBe(true);
    expect(config.sandboxed).toBe(false);
  });

  it('returns vibecoding config for "vibecoding"', () => {
    const config = getModeConfig('vibecoding');
    expect(config.name).toBe('vibecoding');
    expect(config.maxAgents).toBe(6);
    expect(config.autoChain).toBe(true);
    expect(config.confirmWrites).toBe(false);
    expect(config.sandboxed).toBe(false);
  });

  it('returns sandbox config for "sandbox"', () => {
    const config = getModeConfig('sandbox');
    expect(config.name).toBe('sandbox');
    expect(config.sandboxed).toBe(true);
    expect(config.autoChain).toBe(true);
    expect(config.maxAgents).toBe(8);
    expect(config.minReviewScore).toBe(5.0);
  });

  it('returns plan config for "plan"', () => {
    const config = getModeConfig('plan');
    expect(config.name).toBe('plan');
    expect(config.maxAgents).toBe(1);
    expect(config.autoChain).toBe(false);
    expect(config.confirmWrites).toBe(true);
  });

  it('falls back to justvibes for an unknown mode string', () => {
    const config = getModeConfig('unknown-mode');
    expect(config.name).toBe('justvibes');
  });

  it('falls back to justvibes for empty string', () => {
    const config = getModeConfig('');
    expect(config.name).toBe('justvibes');
  });

  it('falls back to justvibes for a random string', () => {
    const config = getModeConfig('totally-made-up-mode-xyz');
    expect(config.name).toBe('justvibes');
  });
});
