import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { success } from '../format.js';

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeFile(filePath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

export async function commandInit(cwd: string): Promise<void> {
  console.log('Initializing SysMARA project...\n');

  const appDirs = [
    'app/entities',
    'app/capabilities',
    'app/policies',
    'app/invariants',
    'app/modules',
    'app/flows',
    'app/routes',
    'app/services',
    'app/adapters',
    'app/generated',
    'app/protected',
    'app/tests',
  ];

  for (const dir of appDirs) {
    await ensureDir(path.join(cwd, dir));
    console.log(`  created ${dir}/`);
  }

  await ensureDir(path.join(cwd, 'system'));
  console.log('  created system/');

  await ensureDir(path.join(cwd, '.framework'));
  console.log('  created .framework/');

  const entitiesYaml = `entities:
  - name: user
    description: A registered user in the system
    module: users
    fields:
      - name: id
        type: string
        required: true
        description: Unique user identifier
      - name: email
        type: string
        required: true
        description: User email address
      - name: name
        type: string
        required: true
        description: User display name
      - name: role
        type: string
        required: true
        description: User role in the system
      - name: created_at
        type: date
        required: true
        description: Account creation timestamp
    invariants:
      - email_must_be_unique
`;

  const capabilitiesYaml = `capabilities:
  - name: create_user
    description: Creates a new user account
    module: users
    entities:
      - user
    input:
      - name: email
        type: string
        required: true
      - name: name
        type: string
        required: true
      - name: role
        type: string
        required: false
    output:
      - name: user
        type: reference
        required: true
    policies:
      - user_creation_policy
    invariants:
      - email_must_be_unique
    idempotent: false

  - name: get_user
    description: Retrieves a user by ID
    module: users
    entities:
      - user
    input:
      - name: id
        type: string
        required: true
    output:
      - name: user
        type: reference
        required: true
    policies: []
    invariants: []
    idempotent: true
`;

  const policiesYaml = `policies:
  - name: user_creation_policy
    description: Controls who can create new user accounts
    actor: authenticated_user
    capabilities:
      - create_user
    conditions:
      - field: actor.role
        operator: in
        value:
          - admin
    effect: allow
`;

  const invariantsYaml = `invariants:
  - name: email_must_be_unique
    description: User email addresses must be unique across the system
    entity: user
    rule: No two users may share the same email address
    severity: error
    enforcement: both
`;

  const modulesYaml = `modules:
  - name: users
    description: User management module
    entities:
      - user
    capabilities:
      - create_user
      - get_user
    allowedDependencies: []
    forbiddenDependencies: []
    owner: core-team
`;

  const flowsYaml = `flows:
  - name: user_registration
    description: End-to-end user registration flow
    trigger: create_user
    module: users
    steps:
      - name: create_account
        action: create_user
        onFailure: abort
      - name: send_welcome_email
        action: send_welcome_email
        onFailure: skip
`;

  const safeEditZonesYaml = `safeEditZones:
  - path: app/generated/**
    zone: generated
    description: Compiler-generated code — do not edit

  - path: app/capabilities/**
    zone: editable
    description: Capability implementations

  - path: app/protected/**
    zone: protected
    description: Infrastructure code — requires authorization

  - path: system/**
    zone: editable
    owner: architect
    description: System specifications
`;

  const glossaryYaml = `glossary:
  - term: entity
    definition: A named data structure representing a core domain object
    relatedEntities: []

  - term: capability
    definition: A named operation that acts on entities with defined inputs, outputs, policies, and invariants
    relatedEntities: []

  - term: policy
    definition: A rule governing access to capabilities based on actor context
    relatedEntities: []

  - term: invariant
    definition: A constraint that must hold true at all times
    relatedEntities: []
`;

  const specFiles: Array<[string, string]> = [
    ['system/entities.yaml', entitiesYaml],
    ['system/capabilities.yaml', capabilitiesYaml],
    ['system/policies.yaml', policiesYaml],
    ['system/invariants.yaml', invariantsYaml],
    ['system/modules.yaml', modulesYaml],
    ['system/flows.yaml', flowsYaml],
    ['system/safe-edit-zones.yaml', safeEditZonesYaml],
    ['system/glossary.yaml', glossaryYaml],
  ];

  for (const [filePath, content] of specFiles) {
    await writeFile(path.join(cwd, filePath), content);
    console.log(`  created ${filePath}`);
  }

  const configYaml = `name: my-sysmara-app
version: 0.0.1
specDir: ./system
appDir: ./app
frameworkDir: ./.framework
generatedDir: ./app/generated
port: 3000
host: 0.0.0.0
logLevel: info
`;

  await writeFile(path.join(cwd, 'sysmara.config.yaml'), configYaml);
  console.log('  created sysmara.config.yaml');

  console.log('');
  console.log(success('Project initialized successfully.'));
  console.log('');
  console.log('Next steps:');
  console.log('  sysmara build      — Validate specs and build system graph');
  console.log('  sysmara validate   — Validate all specs');
  console.log('  sysmara doctor     — Run comprehensive health check');
}
