import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Config } from '../../src/core/config.ts';
import { writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Temp file for load/save tests
const TMP_CONFIG = join(import.meta.dir, '__tmp_config.json');

describe('Config', () => {
  let config: Config;

  beforeEach(() => {
    // Isolate env vars — store and clear GOODVIBES_ vars
    config = new Config();
  });

  afterEach(async () => {
    config.destroy();
    if (existsSync(TMP_CONFIG)) {
      await unlink(TMP_CONFIG);
    }
  });

  // --- Default values ---

  describe('default values', () => {
    it('runtime.mode defaults to subprocess', () => {
      expect(config.get<string>('runtime.mode')).toBe('subprocess');
    });

    it('runtime.port defaults to 4242', () => {
      expect(config.get<number>('runtime.port')).toBe(4242);
    });

    it('runtime.host defaults to 127.0.0.1', () => {
      expect(config.get<string>('runtime.host')).toBe('127.0.0.1');
    });

    it('runtime.agentGracePeriodMs defaults to 10000', () => {
      expect(config.get<number>('runtime.agentGracePeriodMs')).toBe(10000);
    });

    it('logging.level defaults to info', () => {
      expect(config.get<string>('logging.level')).toBe('info');
    });

    it('logging.dir defaults to .goodvibes/logs', () => {
      expect(config.get<string>('logging.dir')).toBe('.goodvibes/logs');
    });

    it('wrfc.minReviewScore defaults to 9.5', () => {
      expect(config.get<number>('wrfc.minReviewScore')).toBe(9.5);
    });

    it('wrfc.maxFixAttempts defaults to 3', () => {
      expect(config.get<number>('wrfc.maxFixAttempts')).toBe(3);
    });

    it('wrfc.enableQualityGates defaults to true', () => {
      expect(config.get<boolean>('wrfc.enableQualityGates')).toBe(true);
    });

    it('agents.maxParallel defaults to 5', () => {
      expect(config.get<number>('agents.maxParallel')).toBe(5);
    });

    it('agents.defaultTimeout defaults to 300000', () => {
      expect(config.get<number>('agents.defaultTimeout')).toBe(300000);
    });

    it('health.port defaults to 4243', () => {
      expect(config.get<number>('health.port')).toBe(4243);
    });

    it('health.path defaults to /health', () => {
      expect(config.get<string>('health.path')).toBe('/health');
    });
  });

  // --- get / set ---

  describe('get / set', () => {
    it('returns undefined for unknown key', () => {
      expect(config.get('nonexistent.key')).toBeUndefined();
    });

    it('set updates value via dot-notation path', () => {
      config.set('runtime.port', 9000);
      expect(config.get<number>('runtime.port')).toBe(9000);
    });

    it('set creates intermediate objects when path does not exist', () => {
      config.set('newSection.subKey', 'value');
      expect(config.get<string>('newSection.subKey')).toBe('value');
    });

    it('getAll returns full config object', () => {
      const all = config.getAll();
      expect(all.runtime?.mode).toBe('subprocess');
      expect(all.wrfc?.minReviewScore).toBe(9.5);
    });

    it('getAll returns a clone (mutating does not affect internal state)', () => {
      const all = config.getAll();
      all.runtime!.port = 9999;
      expect(config.get<number>('runtime.port')).toBe(4242);
    });
  });

  // --- merge ---

  describe('merge', () => {
    it('deep merges partial config into current config', () => {
      config.merge({ runtime: { port: 8080 } });
      expect(config.get<number>('runtime.port')).toBe(8080);
      // Other runtime keys are preserved
      expect(config.get<string>('runtime.mode')).toBe('subprocess');
    });

    it('does not notify onChange when value is unchanged', () => {
      const calls: string[] = [];
      config.onChange((key) => calls.push(key));
      // Merge with same values
      config.merge({ runtime: { mode: 'subprocess' } });
      // mode is unchanged, so no notification expected
      // (JSON.stringify comparison catches this)
      // The implementation fires for keys that are in partial, comparing JSON
      // subprocess === subprocess, so it won't fire
      expect(calls).toHaveLength(0);
    });

    it('fires onChange for keys that change during merge', () => {
      const calls: string[] = [];
      config.onChange((key) => calls.push(key));
      config.merge({ runtime: { port: 9090 } });
      expect(calls).toContain('runtime');
    });
  });

  // --- onChange ---

  describe('onChange', () => {
    it('fires when set is called', () => {
      const calls: Array<{ key: string; newValue: unknown; oldValue: unknown }> = [];
      config.onChange((key, newValue, oldValue) => calls.push({ key, newValue, oldValue }));
      config.set('runtime.port', 5000);
      expect(calls).toHaveLength(1);
      expect(calls[0].key).toBe('runtime.port');
      expect(calls[0].newValue).toBe(5000);
      expect(calls[0].oldValue).toBe(4242);
    });

    it('dispose() stops callback from firing', () => {
      const calls: string[] = [];
      const sub = config.onChange((key) => calls.push(key));
      config.set('runtime.port', 1111);
      sub.dispose();
      config.set('runtime.port', 2222);
      expect(calls).toHaveLength(1);
    });

    it('multiple listeners all fire', () => {
      const calls: number[] = [];
      config.onChange(() => calls.push(1));
      config.onChange(() => calls.push(2));
      config.set('runtime.port', 9999);
      expect(calls).toEqual([1, 2]);
    });

    it('listener error is swallowed and other listeners still fire', () => {
      const calls: number[] = [];
      config.onChange(() => { throw new Error('listener error'); });
      config.onChange(() => calls.push(1));
      expect(() => config.set('runtime.port', 1234)).not.toThrow();
      expect(calls).toEqual([1]);
    });
  });

  // --- validate ---

  describe('validate', () => {
    it('returns valid:true with no errors for default config', () => {
      const result = config.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns error for invalid runtime.mode', () => {
      config.set('runtime.mode', 'invalid');
      const result = config.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('runtime.mode'))).toBe(true);
    });

    it('accepts valid runtime modes', () => {
      config.set('runtime.mode', 'daemon');
      expect(config.validate().valid).toBe(true);
      config.set('runtime.mode', 'subprocess');
      expect(config.validate().valid).toBe(true);
    });

    it('returns error for invalid runtime.port (out of range)', () => {
      config.set('runtime.port', 0);
      const result = config.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('runtime.port'))).toBe(true);
    });

    it('returns error for runtime.port > 65535', () => {
      config.set('runtime.port', 99999);
      const result = config.validate();
      expect(result.valid).toBe(false);
    });

    it('returns error for wrfc.minReviewScore out of range', () => {
      config.set('wrfc.minReviewScore', 11);
      const result = config.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('wrfc.minReviewScore'))).toBe(true);
    });

    it('returns error for wrfc.minReviewScore negative', () => {
      config.set('wrfc.minReviewScore', -1);
      const result = config.validate();
      expect(result.valid).toBe(false);
    });

    it('returns error for wrfc.maxFixAttempts less than 1', () => {
      config.set('wrfc.maxFixAttempts', 0);
      const result = config.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('wrfc.maxFixAttempts'))).toBe(true);
    });

    it('collects multiple errors at once', () => {
      config.set('runtime.mode', 'bad');
      config.set('runtime.port', 0);
      const result = config.validate();
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  // --- load / save ---

  describe('load / save', () => {
    it('load silently ignores missing file', async () => {
      await expect(config.load('/nonexistent/path/config.json')).resolves.toBeUndefined();
    });

    it('load reads plain JSON config and merges over defaults', async () => {
      await writeFile(TMP_CONFIG, JSON.stringify({ runtime: { port: 7777 } }), 'utf-8');
      await config.load(TMP_CONFIG);
      expect(config.get<number>('runtime.port')).toBe(7777);
      // Defaults still intact for unspecified keys
      expect(config.get<string>('runtime.mode')).toBe('subprocess');
    });

    it('load reads $schema-wrapped JSON config', async () => {
      const wrapped = { $schema: '1.0.0', data: { logging: { level: 'debug' } } };
      await writeFile(TMP_CONFIG, JSON.stringify(wrapped), 'utf-8');
      await config.load(TMP_CONFIG);
      expect(config.get<string>('logging.level')).toBe('debug');
    });

    it('save writes $schema-wrapped file with overrides', async () => {
      config.set('runtime.port', 6666);
      await config.save(TMP_CONFIG);
      const raw = await Bun.file(TMP_CONFIG).text();
      const parsed = JSON.parse(raw);
      expect(parsed.$schema).toBe('1.0.0');
      expect(parsed.data).toBeDefined();
    });

    it('load after save round-trips overrides', async () => {
      config.set('runtime.port', 5555);
      await config.save(TMP_CONFIG);
      const config2 = new Config();
      await config2.load(TMP_CONFIG);
      expect(config2.get<number>('runtime.port')).toBe(5555);
      config2.destroy();
    });
  });

  // --- Environment variable overrides ---

  describe('environment variable overrides', () => {
    it('GOODVIBES_RUNTIME__PORT overrides runtime.port', () => {
      // Set env var before creating config
      // Convention: double underscore __ = nesting separator, single _ = camelCase boundary
      process.env['GOODVIBES_RUNTIME__PORT'] = '3333';
      const envConfig = new Config();
      expect(envConfig.get<number>('runtime.port')).toBe(3333);
      envConfig.destroy();
      delete process.env['GOODVIBES_RUNTIME__PORT'];
    });

    it('GOODVIBES_LOGGING__LEVEL overrides logging.level', () => {
      process.env['GOODVIBES_LOGGING__LEVEL'] = 'debug';
      const envConfig = new Config();
      expect(envConfig.get<string>('logging.level')).toBe('debug');
      envConfig.destroy();
      delete process.env['GOODVIBES_LOGGING__LEVEL'];
    });

    it('GOODVIBES_ vars with true/false coerce to boolean', () => {
      // GOODVIBES_WRFC__ENABLE_QUALITY_GATES → wrfc.enableQualityGates
      process.env['GOODVIBES_WRFC__ENABLE_QUALITY_GATES'] = 'false';
      const envConfig = new Config();
      expect(envConfig.get<boolean>('wrfc.enableQualityGates')).toBe(false);
      envConfig.destroy();
      delete process.env['GOODVIBES_WRFC__ENABLE_QUALITY_GATES'];
    });

    it('GOODVIBES_ vars with numeric strings coerce to number', () => {
      // GOODVIBES_AGENTS__MAX_PARALLEL → agents.maxParallel
      process.env['GOODVIBES_AGENTS__MAX_PARALLEL'] = '10';
      const envConfig = new Config();
      expect(envConfig.get<number>('agents.maxParallel')).toBe(10);
      envConfig.destroy();
      delete process.env['GOODVIBES_AGENTS__MAX_PARALLEL'];
    });

    it('non-GOODVIBES_ env vars are ignored', () => {
      process.env['OTHER_RUNTIME_PORT'] = '9999';
      const envConfig = new Config();
      expect(envConfig.get<number>('runtime.port')).toBe(4242);
      envConfig.destroy();
      delete process.env['OTHER_RUNTIME_PORT'];
    });
  });

  // --- destroy ---

  describe('destroy', () => {
    it('set() throws after destroy', () => {
      config.destroy();
      expect(() => config.set('runtime.port', 1)).toThrow('Config has been destroyed');
    });

    it('merge() throws after destroy', () => {
      config.destroy();
      expect(() => config.merge({ runtime: {} })).toThrow('Config has been destroyed');
    });

    it('onChange() throws after destroy', () => {
      config.destroy();
      expect(() => config.onChange(() => {})).toThrow('Config has been destroyed');
    });

    it('load() throws after destroy', async () => {
      config.destroy();
      await expect(config.load('/any/path')).rejects.toThrow('Config has been destroyed');
    });

    it('save() throws after destroy', async () => {
      config.destroy();
      await expect(config.save('/any/path')).rejects.toThrow('Config has been destroyed');
    });

    it('get() still works after destroy (read-only access)', () => {
      config.destroy();
      // get() does not call _assertNotDestroyed
      expect(config.get<string>('runtime.mode')).toBe('subprocess');
    });
  });
});
