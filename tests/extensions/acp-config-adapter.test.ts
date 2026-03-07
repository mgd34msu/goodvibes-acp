import { describe, test, expect } from 'bun:test';
import {
  buildConfigOptions,
  modeFromConfigValue,
  CONFIG_ID_MODE,
  CONFIG_ID_MODEL,
  type GoodVibesMode,
} from '../../src/extensions/acp/config-adapter.js';

// ---------------------------------------------------------------------------
// CONFIG_ID constants
// ---------------------------------------------------------------------------

describe('CONFIG_ID constants', () => {
  test('CONFIG_ID_MODE is goodvibes.mode', () => {
    expect(CONFIG_ID_MODE).toBe('goodvibes.mode');
  });

  test('CONFIG_ID_MODEL is goodvibes.model', () => {
    expect(CONFIG_ID_MODEL).toBe('goodvibes.model');
  });
});

// ---------------------------------------------------------------------------
// buildConfigOptions
// ---------------------------------------------------------------------------

describe('buildConfigOptions', () => {
  test('returns an array of two options', () => {
    const opts = buildConfigOptions();
    expect(opts).toHaveLength(2);
  });

  test('first option is the mode selector', () => {
    const opts = buildConfigOptions();
    const modeOpt = opts[0];
    expect(modeOpt.id).toBe('goodvibes.mode');
    expect(modeOpt.type).toBe('select');
    expect(modeOpt.category).toBe('mode');
  });

  test('second option is the model selector', () => {
    const opts = buildConfigOptions();
    const modelOpt = opts[1];
    expect(modelOpt.id).toBe('goodvibes.model');
    expect(modelOpt.type).toBe('select');
    expect(modelOpt.category).toBe('model');
  });

  test('mode option currentValue defaults to justvibes', () => {
    const opts = buildConfigOptions();
    expect(opts[0].currentValue).toBe('justvibes');
  });

  test('model option currentValue defaults to claude-sonnet-4-6', () => {
    const opts = buildConfigOptions();
    expect(opts[1].currentValue).toBe('claude-sonnet-4-6');
  });

  test('mode option currentValue reflects argument', () => {
    const opts = buildConfigOptions('vibecoding');
    expect(opts[0].currentValue).toBe('vibecoding');
  });

  test('model option currentValue reflects argument', () => {
    const opts = buildConfigOptions('justvibes', 'claude-opus-4-6');
    expect(opts[1].currentValue).toBe('claude-opus-4-6');
  });

  test('mode option has all four valid mode options', () => {
    const opts = buildConfigOptions();
    const modeOpt = opts[0] as { options: Array<{ value: string }> };
    const values = modeOpt.options.map((o) => o.value);
    expect(values).toContain('justvibes');
    expect(values).toContain('vibecoding');
    expect(values).toContain('sandbox');
    expect(values).toContain('plan');
  });

  test('model option has expected model values', () => {
    const opts = buildConfigOptions();
    const modelOpt = opts[1] as { options: Array<{ value: string }> };
    const values = modelOpt.options.map((o) => o.value);
    expect(values).toContain('claude-opus-4-6');
    expect(values).toContain('claude-sonnet-4-5-20250514');
    expect(values).toContain('claude-haiku-4-5-20251001');
  });

  test('each mode option has name and description', () => {
    const opts = buildConfigOptions();
    const modeOpt = opts[0] as { options: Array<{ value: string; name: string; description: string }> };
    for (const option of modeOpt.options) {
      expect(typeof option.name).toBe('string');
      expect(option.name.length).toBeGreaterThan(0);
      expect(typeof option.description).toBe('string');
      expect(option.description.length).toBeGreaterThan(0);
    }
  });

  test('all four modes can be passed as currentMode', () => {
    const modes: GoodVibesMode[] = ['justvibes', 'vibecoding', 'sandbox', 'plan'];
    for (const mode of modes) {
      const opts = buildConfigOptions(mode);
      expect(opts[0].currentValue).toBe(mode);
    }
  });
});

// ---------------------------------------------------------------------------
// modeFromConfigValue
// ---------------------------------------------------------------------------

describe('modeFromConfigValue', () => {
  test('returns justvibes for justvibes', () => {
    expect(modeFromConfigValue('justvibes')).toBe('justvibes');
  });

  test('returns vibecoding for vibecoding', () => {
    expect(modeFromConfigValue('vibecoding')).toBe('vibecoding');
  });

  test('returns sandbox for sandbox', () => {
    expect(modeFromConfigValue('sandbox')).toBe('sandbox');
  });

  test('returns plan for plan', () => {
    expect(modeFromConfigValue('plan')).toBe('plan');
  });

  test('falls back to justvibes for unknown value', () => {
    expect(modeFromConfigValue('unknown')).toBe('justvibes');
  });

  test('falls back to justvibes for empty string', () => {
    expect(modeFromConfigValue('')).toBe('justvibes');
  });

  test('falls back to justvibes for uppercase variant', () => {
    expect(modeFromConfigValue('JUSTVIBES')).toBe('justvibes');
  });

  test('falls back to justvibes for partial match', () => {
    expect(modeFromConfigValue('just')).toBe('justvibes');
  });
});
