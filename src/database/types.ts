/**
 * @module database/types
 * Shared type definitions for the database adapter layer, including
 * column types, constraints, table definitions, and migration steps.
 */

/**
 * Supported database column data types.
 */
export type ColumnType =
  | 'string'
  | 'text'
  | 'integer'
  | 'float'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'timestamp'
  | 'json'
  | 'enum'
  | 'uuid'
  | 'bigint';

/**
 * Constraint types that can be applied to columns or tables.
 */
export type ConstraintType =
  | 'primary_key'
  | 'foreign_key'
  | 'unique'
  | 'not_null'
  | 'default'
  | 'check'
  | 'index';

/**
 * Defines a constraint applied to a column or table.
 *
 * @property type - The kind of constraint
 * @property value - Optional constraint value (e.g., default value, check expression, referenced table)
 * @property column - Optional target column for table-level constraints
 * @property references - Optional foreign key reference in the form `{ table, column }`
 */
export interface ConstraintDefinition {
  type: ConstraintType;
  value?: string | number | boolean;
  column?: string;
  references?: {
    table: string;
    column: string;
  };
}

/**
 * Defines a single column in a database table.
 *
 * @property name - The column name
 * @property type - The data type of the column
 * @property nullable - Whether the column allows NULL values
 * @property primaryKey - Whether this column is the primary key
 * @property unique - Whether this column has a unique constraint
 * @property defaultValue - Optional default value expression
 * @property references - Optional foreign key reference
 * @property enumValues - Optional list of allowed values for enum columns
 */
export interface ColumnDefinition {
  name: string;
  type: ColumnType;
  nullable: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  defaultValue?: string | number | boolean;
  references?: {
    table: string;
    column: string;
  };
  enumValues?: string[];
}

/**
 * Defines a database table with its columns and constraints.
 *
 * @property name - The table name
 * @property columns - List of column definitions
 * @property constraints - Optional list of table-level constraints
 * @property indexes - Optional list of index definitions
 */
export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
  constraints?: ConstraintDefinition[];
  indexes?: IndexDefinition[];
}

/**
 * Defines a database index on one or more columns.
 *
 * @property name - The index name
 * @property columns - Columns included in the index
 * @property unique - Whether this is a unique index
 */
export interface IndexDefinition {
  name: string;
  columns: string[];
  unique?: boolean;
}

/**
 * The type of operation performed in a single migration step.
 */
export type MigrationAction =
  | 'create_table'
  | 'drop_table'
  | 'add_column'
  | 'drop_column'
  | 'alter_column'
  | 'add_index'
  | 'drop_index'
  | 'add_constraint'
  | 'drop_constraint'
  | 'rename_table'
  | 'rename_column';

/**
 * Describes a single step within a database migration.
 *
 * @property action - The migration operation to perform
 * @property table - The target table name
 * @property column - Optional target column name (for column-level operations)
 * @property definition - Optional column or table definition for create/add operations
 * @property oldName - Optional previous name for rename operations
 * @property newName - Optional new name for rename operations
 */
export interface MigrationStep {
  action: MigrationAction;
  table: string;
  column?: string;
  definition?: ColumnDefinition | TableDefinition;
  oldName?: string;
  newName?: string;
}

/**
 * Status information about the database schema relative to the system specs.
 *
 * @property adapter - The active adapter name
 * @property provider - The active database provider
 * @property pendingMigrations - Number of migrations that have not been applied
 * @property lastMigration - Identifier of the most recently applied migration, if any
 * @property tables - List of table names currently defined in the schema
 * @property synced - Whether the schema is fully in sync with the specs
 */
export interface DatabaseStatus {
  adapter: string;
  provider: string;
  pendingMigrations: number;
  lastMigration?: string;
  tables: string[];
  synced: boolean;
}
