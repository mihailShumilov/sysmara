/**
 * @module database/adapters/typeorm
 * TypeORM adapter for the SysMARA database layer.
 * Converts entity specifications into TypeORM @Entity() decorated classes,
 * migration placeholders, and typed repository classes.
 */

import type { DatabaseAdapter } from '../adapter.js';
import type { GeneratedFile } from '../../compiler/capability-compiler.js';
import type { SystemSpecs, EntitySpec, EntityField, CapabilitySpec } from '../../types/index.js';

/**
 * Converts a snake_case or kebab-case name to PascalCase.
 *
 * @param name - The input name
 * @returns PascalCase string
 */
function toPascalCase(name: string): string {
  return name
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Converts a snake_case or kebab-case name to camelCase.
 *
 * @param name - The input name
 * @returns camelCase string
 */
function toCamelCase(name: string): string {
  const pascal = toPascalCase(name);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Maps a SysMARA field type to a TypeORM column type string.
 *
 * @param field - The entity field to map
 * @returns The TypeORM column type string
 */
function mapTypeOrmColumnType(field: EntityField): string {
  switch (field.type.toLowerCase()) {
    case 'string':
      return 'varchar';
    case 'number':
    case 'integer':
      return 'int';
    case 'float':
    case 'decimal':
      return 'float';
    case 'boolean':
    case 'bool':
      return 'boolean';
    case 'date':
    case 'datetime':
    case 'timestamp':
      return 'timestamp';
    case 'json':
      return 'json';
    default:
      return 'varchar';
  }
}

/**
 * Maps a SysMARA field type to its TypeScript type for class properties.
 *
 * @param field - The entity field to map
 * @returns The TypeScript type string
 */
function mapTsType(field: EntityField): string {
  switch (field.type.toLowerCase()) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
    case 'float':
    case 'decimal':
      return 'number';
    case 'boolean':
    case 'bool':
      return 'boolean';
    case 'date':
    case 'datetime':
    case 'timestamp':
      return 'Date';
    case 'json':
      return 'Record<string, unknown>';
    default:
      return 'string';
  }
}

/**
 * Checks whether a field has a "unique" constraint.
 *
 * @param field - The entity field to inspect
 * @returns True if the field has a unique constraint
 */
function isUnique(field: EntityField): boolean {
  return field.constraints?.some((c) => c.type === 'unique') ?? false;
}

/**
 * Generates a TypeORM entity class for a single entity.
 *
 * @param entity - The entity specification
 * @param allEntities - All entities for resolving references
 * @returns The TypeORM entity class source
 */
function generateTypeOrmEntity(entity: EntitySpec, allEntities: EntitySpec[]): string {
  const className = toPascalCase(entity.name);
  const entityNames = new Set(allEntities.map((e) => e.name));
  const lines: string[] = [];
  const decoratorImports = new Set<string>(['Entity', 'Column']);
  const hasRelations = entity.fields.some(
    (f) => f.name.endsWith('_id') && entityNames.has(f.name.replace(/_id$/, '')),
  );

  if (hasRelations) {
    decoratorImports.add('ManyToOne');
    decoratorImports.add('JoinColumn');
  }

  // Check for special columns
  for (const field of entity.fields) {
    if (field.name === 'id') {
      decoratorImports.add('PrimaryGeneratedColumn');
    }
    if (field.name === 'created_at') {
      decoratorImports.add('CreateDateColumn');
    }
    if (field.name === 'updated_at') {
      decoratorImports.add('UpdateDateColumn');
    }
  }

  // Import decorators
  lines.push(`import { ${[...decoratorImports].sort().join(', ')} } from 'typeorm';`);

  // Import related entities
  for (const field of entity.fields) {
    if (field.name.endsWith('_id')) {
      const refName = field.name.replace(/_id$/, '');
      if (entityNames.has(refName)) {
        const refClass = toPascalCase(refName);
        lines.push(`import { ${refClass} } from './${refName}.entity.js';`);
      }
    }
  }

  lines.push('');
  lines.push(`/** ${entity.description} */`);
  lines.push(`@Entity('${entity.name}')`);
  lines.push(`export class ${className} {`);

  for (const field of entity.fields) {
    const propName = toCamelCase(field.name);
    const tsType = mapTsType(field);

    lines.push('');

    if (field.name === 'id') {
      lines.push(`  @PrimaryGeneratedColumn('uuid')`);
      lines.push(`  ${propName}!: string;`);
    } else if (field.name === 'created_at') {
      lines.push('  @CreateDateColumn()');
      lines.push(`  ${propName}!: Date;`);
    } else if (field.name === 'updated_at') {
      lines.push('  @UpdateDateColumn()');
      lines.push(`  ${propName}!: Date;`);
    } else {
      const colOptions: string[] = [];
      colOptions.push(`type: '${mapTypeOrmColumnType(field)}'`);

      if (!field.required) {
        colOptions.push('nullable: true');
      }
      if (isUnique(field)) {
        colOptions.push('unique: true');
      }

      lines.push(`  @Column({ ${colOptions.join(', ')} })`);
      const nullable = !field.required ? ' | null' : '';
      lines.push(`  ${propName}!: ${tsType}${nullable};`);

      // Add relation decorator
      const refName = field.name.replace(/_id$/, '');
      if (field.name.endsWith('_id') && entityNames.has(refName)) {
        const refClass = toPascalCase(refName);
        const relPropName = toCamelCase(refName);
        lines.push('');
        lines.push(`  @ManyToOne(() => ${refClass})`);
        lines.push(`  @JoinColumn({ name: '${field.name}' })`);
        lines.push(`  ${relPropName}?: ${refClass};`);
      }
    }
  }

  lines.push('}');
  return lines.join('\n');
}

/**
 * TypeORM database adapter implementation.
 * Converts SysMARA entity specifications into TypeORM @Entity() decorated
 * classes, migration placeholders, and typed repository classes.
 */
export const typeormAdapter: DatabaseAdapter = {
  name: 'typeorm',

  generateSchema(specs: SystemSpecs): GeneratedFile[] {
    const files: GeneratedFile[] = [];

    for (const entity of specs.entities) {
      const content = `// ============================================================
// GENERATED BY SYSMARA DATABASE ADAPTER (TypeORM)
// Source: entity:${entity.name}
// Edit Zone: generated
// DO NOT EDIT — this file will be regenerated
// ============================================================

${generateTypeOrmEntity(entity, specs.entities)}
`;

      files.push({
        path: `typeorm/entities/${entity.name}.entity.ts`,
        content,
        source: `entity:${entity.name}`,
        zone: 'generated',
      });
    }

    // Generate index file re-exporting all entities
    const indexContent = `// ============================================================
// GENERATED BY SYSMARA DATABASE ADAPTER (TypeORM)
// DO NOT EDIT — this file will be regenerated
// ============================================================

${specs.entities.map((e) => `export { ${toPascalCase(e.name)} } from './${e.name}.entity.js';`).join('\n')}
`;

    files.push({
      path: 'typeorm/entities/index.ts',
      content: indexContent,
      source: 'database:typeorm',
      zone: 'generated',
    });

    return files;
  },

  generateMigration(_prev: SystemSpecs, next: SystemSpecs): GeneratedFile[] {
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const className = `SysmaraMigration${timestamp}`;
    const entityNames = next.entities.map((e) => toPascalCase(e.name));

    const content = `// ============================================================
// GENERATED BY SYSMARA DATABASE ADAPTER (TypeORM)
// Migration: ${className}
// DO NOT EDIT — this file will be regenerated
// ============================================================

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Placeholder migration for entities: ${entityNames.join(', ')}.
 * Run \`npx typeorm migration:generate\` to produce the actual SQL.
 */
export class ${className} implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // TODO: Implement migration up
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // TODO: Implement migration down
  }
}
`;

    return [
      {
        path: `typeorm/migrations/${timestamp}-sysmara-migration.ts`,
        content,
        source: 'database:typeorm',
        zone: 'generated',
      },
    ];
  },

  generateRepository(capability: CapabilitySpec): GeneratedFile[] {
    const repoContent = generateTypeOrmRepository(capability);
    return [
      {
        path: `generated/repositories/${capability.name}.repository.ts`,
        content: repoContent,
        source: `capability:${capability.name}`,
        zone: 'generated',
      },
    ];
  },
};

/**
 * Generates a TypeORM repository file from a capability.
 *
 * @param capability - The capability specification
 * @returns The TypeScript repository source
 */
function generateTypeOrmRepository(capability: CapabilitySpec): string {
  const repoMethods: string[] = [];
  const entityImports: string[] = [];

  for (const entityName of capability.entities) {
    const pascalName = toPascalCase(entityName);
    entityImports.push(`import { ${pascalName} } from '../../typeorm/entities/${entityName}.entity.js';`);

    repoMethods.push(`
  /** Find a ${entityName} by ID. */
  async find${pascalName}ById(id: string): Promise<${pascalName} | null> {
    return this.dataSource.getRepository(${pascalName}).findOneBy({ id } as any);
  }

  /** Find all ${entityName} records matching a filter. */
  async findMany${pascalName}(where: Record<string, unknown> = {}): Promise<${pascalName}[]> {
    return this.dataSource.getRepository(${pascalName}).findBy(where as any);
  }

  /** Create a new ${entityName}. */
  async create${pascalName}(data: Record<string, unknown>): Promise<${pascalName}> {
    const repo = this.dataSource.getRepository(${pascalName});
    const entity = repo.create(data as any);
    return repo.save(entity);
  }

  /** Update a ${entityName} by ID. */
  async update${pascalName}(id: string, data: Record<string, unknown>): Promise<void> {
    await this.dataSource.getRepository(${pascalName}).update(id, data as any);
  }

  /** Delete a ${entityName} by ID. */
  async delete${pascalName}(id: string): Promise<void> {
    await this.dataSource.getRepository(${pascalName}).delete(id);
  }`);
  }

  const capPascal = toPascalCase(capability.name);

  return `// ============================================================
// GENERATED BY SYSMARA DATABASE ADAPTER (TypeORM)
// Source: capability:${capability.name}
// Edit Zone: generated
// DO NOT EDIT — this file will be regenerated
// ============================================================

${entityImports.join('\n')}

/**
 * Repository for the "${capability.name}" capability.
 * Provides typed data-access methods for: ${capability.entities.join(', ')}.
 */
export class ${capPascal}Repository {
  private dataSource: any;

  constructor(dataSource: any) {
    this.dataSource = dataSource;
  }
${repoMethods.join('\n')}
}
`;
}
