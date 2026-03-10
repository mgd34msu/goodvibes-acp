/**
 * Tests for DatabaseTools.generateQuery() SQL injection prevention.
 * Covers ISS-008: identifier validation and WHERE clause sanitisation.
 */
import { describe, it, expect } from 'bun:test';
import { DatabaseTools } from '../db.js';

const db = new DatabaseTools();

describe('DatabaseTools.generateQuery — identifier validation', () => {
  it('generates a SELECT for valid table and columns', () => {
    const sql = db.generateQuery('users', 'select', ['id', 'email']);
    expect(sql).toBe('SELECT "id", "email"\nFROM "users";');
  });

  it('generates a SELECT * when columns = ["*"]', () => {
    const sql = db.generateQuery('orders', 'select');
    expect(sql).toBe('SELECT *\nFROM "orders";');
  });

  it('generates an INSERT for valid columns', () => {
    const sql = db.generateQuery('users', 'insert', ['name', 'email']);
    expect(sql).toContain('INSERT INTO "users"');
    expect(sql).toContain('"name", "email"');
    expect(sql).toContain(':name, :email');
  });

  it('generates an UPDATE for valid columns', () => {
    const sql = db.generateQuery('users', 'update', ['name']);
    expect(sql).toContain('UPDATE "users"');
    expect(sql).toContain('"name" = :name');
  });

  it('generates a DELETE with a safe WHERE clause', () => {
    const sql = db.generateQuery('users', 'delete', [], 'id = :id');
    expect(sql).toBe('DELETE FROM "users"\nWHERE id = :id;');
  });

  it('allows underscores and mixed case in identifiers', () => {
    const sql = db.generateQuery('user_profiles', 'select', ['created_at', 'updatedAt']);
    expect(sql).toContain('"user_profiles"');
    expect(sql).toContain('"created_at"');
    expect(sql).toContain('"updatedAt"');
  });

  it('throws on table name with spaces', () => {
    expect(() => db.generateQuery('user table', 'select')).toThrow(
      /Invalid SQL identifier for table/,
    );
  });

  it('throws on table name with a semicolon', () => {
    expect(() => db.generateQuery('users; DROP TABLE users', 'select')).toThrow(
      /Invalid SQL identifier for table/,
    );
  });

  it('throws on table name with SQL comment injection', () => {
    expect(() => db.generateQuery('users--comment', 'select')).toThrow(
      /Invalid SQL identifier for table/,
    );
  });

  it('throws on table name with double-quote', () => {
    expect(() => db.generateQuery('user"table', 'select')).toThrow(
      /Invalid SQL identifier for table/,
    );
  });

  it('throws on empty table name', () => {
    expect(() => db.generateQuery('', 'select')).toThrow(
      /Invalid SQL identifier for table/,
    );
  });

  it('throws on table name with a dot', () => {
    expect(() => db.generateQuery('public.users', 'select')).toThrow(
      /Invalid SQL identifier for table/,
    );
  });

  it('throws on column name with SQL injection', () => {
    expect(() =>
      db.generateQuery('users', 'select', ['id', '1=1; DROP TABLE users']),
    ).toThrow(/Invalid SQL identifier for column/);
  });

  it('throws on column name with a double-quote', () => {
    expect(() => db.generateQuery('users', 'select', ['id"badcol'])).toThrow(
      /Invalid SQL identifier for column/,
    );
  });

  it('does NOT throw when columns = ["*"] (wildcard is allowed)', () => {
    expect(() => db.generateQuery('users', 'select', ['*'])).not.toThrow();
  });

  it('throws on WHERE clause with single quote', () => {
    expect(() =>
      db.generateQuery('users', 'select', ['*'], "name = 'alice'"),
    ).toThrow(/Unsafe WHERE clause/);
  });

  it('throws on WHERE clause with semicolon', () => {
    expect(() =>
      db.generateQuery('users', 'delete', [], 'id = 1; DROP TABLE users'),
    ).toThrow(/Unsafe WHERE clause/);
  });

  it('throws on WHERE clause with line comment', () => {
    expect(() =>
      db.generateQuery('users', 'select', ['*'], 'id = 1 -- injected'),
    ).toThrow(/Unsafe WHERE clause/);
  });

  it('throws on WHERE clause with block comment', () => {
    expect(() =>
      db.generateQuery('users', 'select', ['*'], 'id = 1 /* comment */'),
    ).toThrow(/Unsafe WHERE clause/);
  });

  it('allows WHERE clause with parameterized placeholder', () => {
    const sql = db.generateQuery('users', 'select', ['id', 'email'], 'id = :id AND email = :email');
    expect(sql).toContain('WHERE id = :id AND email = :email');
  });
});
