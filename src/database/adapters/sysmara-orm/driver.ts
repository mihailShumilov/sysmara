/**
 * @module database/adapters/sysmara-orm/driver
 * Unified database driver abstraction for SysMARA ORM.
 * Supports PostgreSQL, MySQL, and SQLite through optional peer dependencies.
 * Falls back to an in-memory store when no database driver is available.
 */

import type { DatabaseProvider } from '../../adapter.js';

/**
 * A single row returned from a database query.
 */
export type Row = Record<string, unknown>;

/**
 * Result of a query execution.
 */
export interface QueryResult {
  rows: Row[];
  rowCount: number;
}

/**
 * Unified database driver interface.
 */
export interface DatabaseDriver {
  /** The database provider this driver connects to. */
  readonly provider: DatabaseProvider;

  /**
   * Opens a connection to the database.
   */
  connect(): Promise<void>;

  /**
   * Closes the database connection.
   */
  disconnect(): Promise<void>;

  /**
   * Executes a parameterized SQL query.
   * Uses $1, $2... placeholders (PostgreSQL style).
   * MySQL/SQLite drivers convert to their native placeholder format.
   *
   * @param sql - The parameterized SQL string
   * @param params - The parameter values
   * @returns The query result
   */
  query(sql: string, params?: unknown[]): Promise<QueryResult>;

  /**
   * Executes raw SQL (e.g. for schema creation).
   * Statements may be separated by semicolons.
   */
  exec(sql: string): Promise<void>;

  /**
   * Returns true if the driver is connected.
   */
  isConnected(): boolean;
}

/**
 * Converts PostgreSQL-style $1, $2 placeholders to ? placeholders for MySQL/SQLite.
 */
function convertPlaceholders(sql: string): string {
  return sql.replace(/\$(\d+)/g, '?');
}

/**
 * Reorders params for MySQL/SQLite when converting from $N placeholders.
 * PostgreSQL $1, $2 can be in any order, so we need to map them correctly.
 */
function reorderParams(sql: string, params: unknown[]): unknown[] {
  const matches = [...sql.matchAll(/\$(\d+)/g)];
  if (matches.length === 0) return params;
  return matches.map(m => params[parseInt(m[1]!, 10) - 1]);
}

// ─── PostgreSQL Driver ───────────────────────────────────────────────

/**
 * PostgreSQL driver using the `pg` package.
 */
export class PostgresDriver implements DatabaseDriver {
  readonly provider: DatabaseProvider = 'postgresql';
  private pool: unknown = null;
  private connected = false;

  constructor(private connectionString: string) {}

  async connect(): Promise<void> {
    try {
      // Dynamic import so pg is an optional peer dependency
      const pg = await import('pg');
      const Pool = pg.default?.Pool ?? pg.Pool;
      this.pool = new Pool({ connectionString: this.connectionString });
      // Test connection
      const pool = this.pool as { query(sql: string): Promise<unknown>; };
      await pool.query('SELECT 1');
      this.connected = true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Cannot find module') || message.includes('MODULE_NOT_FOUND') || message.includes('ERR_MODULE_NOT_FOUND')) {
        throw new Error(
          'PostgreSQL driver requires the "pg" package. Install it:\n' +
          '  npm install pg\n' +
          '  npm install -D @types/pg'
        );
      }
      throw new Error(`Failed to connect to PostgreSQL: ${message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      const pool = this.pool as { end(): Promise<void> };
      await pool.end();
      this.pool = null;
      this.connected = false;
    }
  }

  async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
    if (!this.pool) throw new Error('PostgreSQL driver not connected');
    const pool = this.pool as { query(sql: string, params: unknown[]): Promise<{ rows: Row[]; rowCount: number | null }> };
    const result = await pool.query(sql, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount ?? result.rows.length,
    };
  }

  async exec(sql: string): Promise<void> {
    if (!this.pool) throw new Error('PostgreSQL driver not connected');
    const pool = this.pool as { query(sql: string): Promise<unknown> };
    await pool.query(sql);
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// ─── MySQL Driver ────────────────────────────────────────────────────

/**
 * MySQL driver using the `mysql2` package.
 */
export class MysqlDriver implements DatabaseDriver {
  readonly provider: DatabaseProvider = 'mysql';
  private pool: unknown = null;
  private connected = false;

  constructor(private connectionString: string) {}

  async connect(): Promise<void> {
    try {
      const mysql2 = await import('mysql2/promise');
      const createPool = mysql2.default?.createPool ?? mysql2.createPool;
      this.pool = createPool(this.connectionString);
      // Test connection
      const pool = this.pool as { query(sql: string): Promise<unknown> };
      await pool.query('SELECT 1');
      this.connected = true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Cannot find module') || message.includes('MODULE_NOT_FOUND') || message.includes('ERR_MODULE_NOT_FOUND')) {
        throw new Error(
          'MySQL driver requires the "mysql2" package. Install it:\n' +
          '  npm install mysql2'
        );
      }
      throw new Error(`Failed to connect to MySQL: ${message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      const pool = this.pool as { end(): Promise<void> };
      await pool.end();
      this.pool = null;
      this.connected = false;
    }
  }

  async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
    if (!this.pool) throw new Error('MySQL driver not connected');
    const pool = this.pool as { query(sql: string, params: unknown[]): Promise<[Row[], unknown]> };

    const reorderedParams = reorderParams(sql, params);
    const convertedSql = convertPlaceholders(sql);

    // MySQL uses backticks not double-quotes for identifiers
    const mysqlSql = convertedSql.replace(/"/g, '`');

    const [rows] = await pool.query(mysqlSql, reorderedParams);
    const resultRows = Array.isArray(rows) ? rows : [];
    return {
      rows: resultRows as Row[],
      rowCount: resultRows.length,
    };
  }

  async exec(sql: string): Promise<void> {
    if (!this.pool) throw new Error('MySQL driver not connected');
    const pool = this.pool as { query(sql: string): Promise<unknown> };

    // MySQL uses backticks
    const mysqlSql = sql.replace(/"/g, '`');

    // Split on semicolons and execute each statement
    const statements = mysqlSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      // Skip PostgreSQL-specific statements
      if (stmt.includes('CREATE EXTENSION')) continue;
      await pool.query(stmt);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// ─── SQLite Driver ───────────────────────────────────────────────────

/**
 * SQLite driver using the `better-sqlite3` package.
 * Note: better-sqlite3 is synchronous, but we wrap in async for interface consistency.
 */
export class SqliteDriver implements DatabaseDriver {
  readonly provider: DatabaseProvider = 'sqlite';
  private db: unknown = null;
  private connected = false;

  constructor(private filePath: string) {}

  async connect(): Promise<void> {
    try {
      const betterSqlite3 = await import('better-sqlite3');
      const Database = betterSqlite3.default ?? betterSqlite3;
      // Extract file path from connection string if needed
      let dbPath = this.filePath;
      if (dbPath.startsWith('sqlite://')) {
        dbPath = dbPath.replace('sqlite://', '');
      }
      if (dbPath.startsWith('file:')) {
        dbPath = dbPath.replace('file:', '');
      }
      if (!dbPath || dbPath === '') {
        dbPath = ':memory:';
      }
      this.db = (Database as unknown as (path: string) => unknown)(dbPath);
      // Enable WAL mode for better performance
      const db = this.db as { pragma(sql: string): unknown };
      db.pragma('journal_mode = WAL');
      this.connected = true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Cannot find module') || message.includes('MODULE_NOT_FOUND') || message.includes('ERR_MODULE_NOT_FOUND')) {
        throw new Error(
          'SQLite driver requires the "better-sqlite3" package. Install it:\n' +
          '  npm install better-sqlite3\n' +
          '  npm install -D @types/better-sqlite3'
        );
      }
      throw new Error(`Failed to open SQLite database: ${message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      const db = this.db as { close(): void };
      db.close();
      this.db = null;
      this.connected = false;
    }
  }

  async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
    if (!this.db) throw new Error('SQLite driver not connected');
    const db = this.db as {
      prepare(sql: string): {
        all(...params: unknown[]): Row[];
        run(...params: unknown[]): { changes: number };
      };
    };

    const reorderedParams = reorderParams(sql, params);
    const convertedSql = convertPlaceholders(sql);

    const stmt = db.prepare(convertedSql);

    // Detect if this is a SELECT/RETURNING query
    const trimmed = convertedSql.trim().toUpperCase();
    if (trimmed.startsWith('SELECT') || convertedSql.includes('RETURNING')) {
      // SQLite doesn't support RETURNING — handle it
      if (convertedSql.includes('RETURNING')) {
        return this.handleReturning(convertedSql, reorderedParams);
      }
      const rows = stmt.all(...reorderedParams);
      return { rows, rowCount: rows.length };
    } else {
      const result = stmt.run(...reorderedParams);
      return { rows: [], rowCount: result.changes };
    }
  }

  async exec(sql: string): Promise<void> {
    if (!this.db) throw new Error('SQLite driver not connected');
    const db = this.db as { exec(sql: string): void };

    // Remove PostgreSQL-specific statements
    const cleanedSql = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('CREATE EXTENSION'))
      .join('\n');

    // Remove RETURNING clauses for exec (schema creation)
    const noReturning = cleanedSql.replace(/\s+RETURNING\s+\*/gi, '');
    db.exec(noReturning);
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Handles INSERT/UPDATE ... RETURNING * for SQLite which doesn't support RETURNING.
   * Strips RETURNING *, executes the statement, then does a SELECT by rowid/id.
   */
  private async handleReturning(sql: string, params: unknown[]): Promise<QueryResult> {
    const db = this.db as {
      prepare(sql: string): {
        all(...params: unknown[]): Row[];
        run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
        get(...params: unknown[]): Row | undefined;
      };
    };

    // Remove RETURNING *
    const cleanSql = sql.replace(/\s+RETURNING\s+\*/gi, '');
    const trimmed = cleanSql.trim().toUpperCase();

    if (trimmed.startsWith('INSERT')) {
      const stmt = db.prepare(cleanSql);
      const result = stmt.run(...params);
      // Try to get the inserted row by last_insert_rowid or id
      const tableName = this.extractTableName(cleanSql);
      if (tableName) {
        const selectStmt = db.prepare(`SELECT * FROM ${tableName} WHERE rowid = ?`);
        const row = selectStmt.get(Number(result.lastInsertRowid));
        return { rows: row ? [row] : [], rowCount: result.changes };
      }
      return { rows: [], rowCount: result.changes };
    } else if (trimmed.startsWith('UPDATE')) {
      // For UPDATE, extract the WHERE clause to find updated rows
      const stmt = db.prepare(cleanSql);
      stmt.run(...params);
      // Try to SELECT the updated row using the same WHERE condition
      const tableName = this.extractTableName(cleanSql);
      const whereMatch = cleanSql.match(/WHERE\s+(.+)/i);
      if (tableName && whereMatch) {
        const selectSql = `SELECT * FROM ${tableName} WHERE ${whereMatch[1]}`;
        const selectStmt = db.prepare(selectSql);
        // The last param is usually the id in WHERE clause
        const whereParams = params.slice(-1);
        const rows = selectStmt.all(...whereParams);
        return { rows, rowCount: rows.length };
      }
      return { rows: [], rowCount: 0 };
    }

    // Fallback
    const stmt = db.prepare(cleanSql);
    const result = stmt.run(...params);
    return { rows: [], rowCount: result.changes };
  }

  private extractTableName(sql: string): string | null {
    // INSERT INTO "tableName" or UPDATE "tableName"
    const match = sql.match(/(?:INSERT\s+INTO|UPDATE)\s+["`]?(\w+)["`]?/i);
    return match ? `"${match[1]}"` : null;
  }
}

// ─── In-Memory Driver (fallback) ────────────────────────────────────

/**
 * In-memory driver for testing and development when no database is available.
 * Stores data in plain JavaScript Maps.
 */
export class InMemoryDriver implements DatabaseDriver {
  readonly provider: DatabaseProvider;
  private tables = new Map<string, Row[]>();
  private connected = false;
  private autoId = 0;

  constructor(provider: DatabaseProvider = 'sqlite') {
    this.provider = provider;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.tables.clear();
    this.connected = false;
  }

  async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
    const trimmed = sql.trim().toUpperCase();
    const tableName = this.extractTableName(sql);
    if (!tableName) {
      return { rows: [], rowCount: 0 };
    }

    if (!this.tables.has(tableName)) {
      this.tables.set(tableName, []);
    }

    if (trimmed.startsWith('SELECT')) {
      return this.handleSelect(tableName, sql, params);
    } else if (trimmed.startsWith('INSERT')) {
      return this.handleInsert(tableName, sql, params);
    } else if (trimmed.startsWith('UPDATE')) {
      return this.handleUpdate(tableName, sql, params);
    } else if (trimmed.startsWith('DELETE')) {
      return this.handleDelete(tableName, sql, params);
    }

    return { rows: [], rowCount: 0 };
  }

  async exec(sql: string): Promise<void> {
    // Parse CREATE TABLE statements to initialize table storage
    const createMatches = sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?/gi);
    for (const match of createMatches) {
      const name = match[1]!;
      if (!this.tables.has(name)) {
        this.tables.set(name, []);
      }
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  private extractTableName(sql: string): string | null {
    // Match table name from various SQL patterns
    const patterns = [
      /FROM\s+["`]?(\w+)["`]?/i,
      /INTO\s+["`]?(\w+)["`]?/i,
      /UPDATE\s+["`]?(\w+)["`]?/i,
      /DELETE\s+FROM\s+["`]?(\w+)["`]?/i,
    ];
    for (const pattern of patterns) {
      const match = sql.match(pattern);
      if (match) return match[1]!;
    }
    return null;
  }

  private resolveParam(_sql: string, params: unknown[], placeholder: string): unknown {
    const match = placeholder.match(/\$(\d+)/);
    if (match) {
      return params[parseInt(match[1]!, 10) - 1];
    }
    return undefined;
  }

  private handleSelect(tableName: string, sql: string, params: unknown[]): QueryResult {
    let rows = [...(this.tables.get(tableName) ?? [])];

    // Parse WHERE clause
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s*$)/i);
    if (whereMatch) {
      const conditions = whereMatch[1]!.split(/\s+AND\s+/i);
      for (const cond of conditions) {
        const condMatch = cond.match(/["`]?(\w+)["`]?\s*=\s*(\$\d+)/);
        if (condMatch) {
          const field = condMatch[1]!;
          const value = this.resolveParam(sql, params, condMatch[2]!);
          rows = rows.filter(r => r[field] === value);
        }
      }
    }

    // Parse LIMIT
    const limitMatch = sql.match(/LIMIT\s+(\$\d+|\d+)/i);
    if (limitMatch) {
      const limit = limitMatch[1]!.startsWith('$')
        ? this.resolveParam(sql, params, limitMatch[1]!) as number
        : parseInt(limitMatch[1]!, 10);
      rows = rows.slice(0, limit);
    }

    return { rows, rowCount: rows.length };
  }

  private handleInsert(tableName: string, sql: string, params: unknown[]): QueryResult {
    const table = this.tables.get(tableName) ?? [];

    // Parse column names
    const colMatch = sql.match(/\(([^)]+)\)\s*VALUES/i);
    if (!colMatch) return { rows: [], rowCount: 0 };

    const columns = colMatch[1]!.split(',').map(c => c.trim().replace(/["`]/g, ''));
    const row: Row = {};
    for (let i = 0; i < columns.length; i++) {
      row[columns[i]!] = params[i];
    }

    // Auto-generate id if not provided
    if (!row.id) {
      row.id = `mem_${++this.autoId}_${Date.now()}`;
    }

    // Auto-generate timestamps
    if (!row.created_at) {
      row.created_at = new Date().toISOString();
    }
    if (!row.updated_at) {
      row.updated_at = new Date().toISOString();
    }

    table.push(row);
    this.tables.set(tableName, table);

    return { rows: [row], rowCount: 1 };
  }

  private handleUpdate(tableName: string, sql: string, params: unknown[]): QueryResult {
    const table = this.tables.get(tableName) ?? [];

    // Parse SET clause
    const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/i);
    const whereMatch = sql.match(/WHERE\s+["`]?(\w+)["`]?\s*=\s*(\$\d+)/i);

    if (!setMatch || !whereMatch) return { rows: [], rowCount: 0 };

    const idField = whereMatch[1]!;
    const idValue = this.resolveParam(sql, params, whereMatch[2]!);

    const setClauses = setMatch[1]!.split(',').map(s => s.trim());
    const updates: Record<string, unknown> = {};

    for (const clause of setClauses) {
      const clauseMatch = clause.match(/["`]?(\w+)["`]?\s*=\s*(\$\d+)/);
      if (clauseMatch) {
        updates[clauseMatch[1]!] = this.resolveParam(sql, params, clauseMatch[2]!);
      }
    }

    const updatedRows: Row[] = [];
    for (const row of table) {
      if (row[idField] === idValue) {
        Object.assign(row, updates);
        row.updated_at = new Date().toISOString();
        updatedRows.push(row);
      }
    }

    return { rows: updatedRows, rowCount: updatedRows.length };
  }

  private handleDelete(tableName: string, sql: string, params: unknown[]): QueryResult {
    const table = this.tables.get(tableName) ?? [];
    const whereMatch = sql.match(/WHERE\s+["`]?(\w+)["`]?\s*=\s*(\$\d+)/i);

    if (!whereMatch) return { rows: [], rowCount: 0 };

    const field = whereMatch[1]!;
    const value = this.resolveParam(sql, params, whereMatch[2]!);

    const before = table.length;
    const remaining = table.filter(r => r[field] !== value);
    this.tables.set(tableName, remaining);

    return { rows: [], rowCount: before - remaining.length };
  }
}

// ─── Factory ─────────────────────────────────────────────────────────

/**
 * Creates a database driver for the given provider and connection string.
 *
 * @param provider - The database provider
 * @param connectionString - The connection string or file path
 * @returns A new DatabaseDriver instance
 */
export function createDriver(provider: DatabaseProvider, connectionString: string): DatabaseDriver {
  switch (provider) {
    case 'postgresql':
      return new PostgresDriver(connectionString);
    case 'mysql':
      return new MysqlDriver(connectionString);
    case 'sqlite':
      return new SqliteDriver(connectionString);
    default:
      throw new Error(`Unsupported database provider: ${provider}`);
  }
}

/**
 * Creates an in-memory driver for testing.
 *
 * @param provider - The database provider to emulate
 * @returns A new InMemoryDriver instance
 */
export function createInMemoryDriver(provider: DatabaseProvider = 'sqlite'): DatabaseDriver {
  return new InMemoryDriver(provider);
}
