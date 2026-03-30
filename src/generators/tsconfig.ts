/**
 * @module generators/tsconfig
 * Generates a tsconfig.json for scaffolded SysMARA projects.
 */

interface GeneratedFile {
  path: string;
  content: string;
}

/**
 * Generates a tsconfig.json configured for a SysMARA project.
 * Targets ES2022 with NodeNext module resolution — matches the
 * TypeScript settings used by @sysmara/core itself.
 */
export function generateTsconfig(): GeneratedFile {
  const config = {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      esModuleInterop: true,
      strict: true,
      skipLibCheck: true,
      outDir: './dist',
      rootDir: '.',
      declaration: true,
      sourceMap: true,
      resolveJsonModule: true,
      forceConsistentCasingInFileNames: true,
    },
    include: ['app/**/*.ts'],
    exclude: ['node_modules', 'dist'],
  };

  return {
    path: 'tsconfig.json',
    content: JSON.stringify(config, null, 2) + '\n',
  };
}
