/**
 * Type declarations for optional peer dependencies.
 * These modules are dynamically imported at runtime — they may or may not be installed.
 */

declare module 'pg' {
  export class Pool {
    constructor(config: { connectionString: string });
    query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
    end(): Promise<void>;
  }
}

declare module 'mysql2/promise' {
  export function createPool(connectionString: string): {
    query(sql: string, params?: unknown[]): Promise<[Record<string, unknown>[], unknown]>;
    end(): Promise<void>;
  };
}

declare module 'better-sqlite3' {
  interface Statement {
    all(...params: unknown[]): Record<string, unknown>[];
    get(...params: unknown[]): Record<string, unknown> | undefined;
    run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  }

  interface Database {
    prepare(sql: string): Statement;
    exec(sql: string): void;
    pragma(sql: string): unknown;
    close(): void;
  }

  function Database(filename: string): Database;
  export = Database;
}
