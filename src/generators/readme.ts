/**
 * @module generators/readme
 * Generates a project-specific README.md for initialized SysMARA projects.
 */

import type { DatabaseProvider } from '../database/adapter.js';

interface GeneratedTextFile {
  path: string;
  content: string;
}

/**
 * Generates a README.md with project setup instructions, commands, and structure.
 */
export function generateReadme(
  projectName: string,
  provider: DatabaseProvider,
  orm: string,
): GeneratedTextFile {
  const dbSetup = provider !== 'sqlite'
    ? `### Start the database

\`\`\`bash
docker compose up -d
\`\`\`

This starts a local ${provider === 'postgresql' ? 'PostgreSQL' : 'MySQL'} instance with default credentials (see \`.env.local\`).
`
    : '';

  const dbCommands = provider !== 'sqlite'
    ? `| \`npm run db:start\` | Start the database container |
| \`npm run db:stop\` | Stop the database container |
| \`npm run db:logs\` | Stream database logs |
`
    : '';

  const content = `# ${projectName}

Built with [SysMARA](https://sysmara.com) — an AI-native TypeScript backend framework.

## Quick Start

### Install dependencies

\`\`\`bash
npm install
\`\`\`

${dbSetup}### Build the project

\`\`\`bash
npm run build
\`\`\`

This runs the full SysMARA pipeline: validates specs, builds the system graph, compiles capabilities, scaffolds implementation files, generates the database schema, and runs diagnostics.

### Start development

\`\`\`bash
npm run dev
\`\`\`

${provider !== 'sqlite' ? 'Starts the database (if not running), builds, and launches the server with file watching.\n' : 'Builds and launches the server with file watching.\n'}
### Start production

\`\`\`bash
npm start
\`\`\`

## Available Commands

| Command | Description |
|---------|-------------|
| \`npm run dev\` | Start development environment |
| \`npm start\` | Start production server |
| \`npm run build\` | Full build pipeline |
| \`npm run validate\` | Validate all specs |
${dbCommands}| \`npm run sysmara:doctor\` | Run comprehensive health check |
| \`npm run sysmara:graph\` | Generate system graph |
| \`npm run sysmara:compile\` | Compile capabilities |
| \`npm run sysmara:scaffold\` | Scaffold implementation files |
| \`npm run sysmara:db:generate\` | Generate database schema |
| \`npm run sysmara:db:migrate\` | Create database migration |

## Project Structure

\`\`\`
${projectName}/
├── system/                  # YAML specifications (source of truth)
│   ├── entities.yaml        # Domain entities with typed fields
│   ├── capabilities.yaml    # Operations with inputs/outputs/policies
│   ├── policies.yaml        # Access control rules
│   ├── invariants.yaml      # Business rules that must hold
│   ├── modules.yaml         # Module boundaries and dependencies
│   └── flows.yaml           # Multi-step workflows
├── app/                     # Application code
│   ├── entities/            # TypeScript entity interfaces
│   ├── capabilities/        # Capability handler implementations
│   ├── policies/            # Policy enforcement logic
│   ├── invariants/          # Invariant validation logic
│   ├── services/            # Module service classes
│   ├── generated/           # Auto-generated (do not edit)
│   │   ├── routes/          # Route handler stubs
│   │   ├── tests/           # Test scaffolds
│   │   └── metadata/        # Capability metadata (JSON)
│   └── database/            # Database schema and migrations
├── .framework/              # SysMARA build artifacts
├── docker-compose.yml       # Local development database
├── Dockerfile               # Production container
├── .env.example             # Environment variable template
├── .env.local               # Local dev settings (gitignored)
└── sysmara.config.yaml      # Project configuration
\`\`\`

## Configuration

- **Database:** ${provider} via ${orm}
- **Config:** \`sysmara.config.yaml\`
- **Environment:** \`.env.local\` (copy from \`.env.example\` for new environments)

## Learn More

- [SysMARA Documentation](https://sysmara.com/docs/getting-started/quickstart/)
- [CLI Reference](https://sysmara.com/docs/reference/cli/)
- [AI Bootstrap Guide](https://sysmara.com/docs/guides/ai-bootstrap/)
`;

  return { path: 'README.md', content };
}
