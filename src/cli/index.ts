#!/usr/bin/env node
/**
 * @module cli
 * Entry point for the `sysmara` CLI. Parses command-line arguments, resolves
 * project configuration, and dispatches to the appropriate sub-command handler
 * (init, add, validate, build, graph, compile, doctor, check, explain, impact, plan).
 */

import * as path from 'node:path';
import * as process from 'node:process';
import { resolveConfig } from '../runtime/config.js';
import { commandInit } from './commands/init.js';
import { commandAdd } from './commands/add.js';
import { commandValidate } from './commands/validate.js';
import { commandBuild } from './commands/build.js';
import { commandGraph } from './commands/graph.js';
import { commandCompile } from './commands/compile.js';
import { commandDoctor } from './commands/doctor.js';
import { commandExplain } from './commands/explain.js';
import { commandImpact } from './commands/impact.js';
import { commandPlanCreate, commandPlanShow } from './commands/plan.js';
import { commandCheckBoundaries } from './commands/check.js';

/** Current CLI version string, displayed by `--version`. */
const VERSION = '0.2.0';

function printHelp(): void {
  const help = `
sysmara v${VERSION} — SysMARA: Model / Architecture / Runtime Abstraction for AI-native backends

Usage: sysmara <command> [options]

Commands:
  init                         Create a new SysMARA project
  add <type> <name>            Add entity, capability, policy, invariant, module, or flow
  validate                     Validate all specs
  build                        Full build: validate, graph, compile, diagnose
  graph                        Generate system-graph.json and system-map.json
  compile                      Run capability compiler
  doctor                       Comprehensive system health check
  check boundaries             Check module boundary violations
  explain <type> <name>        Explain a capability, invariant, or module
  impact <type> <name>         Analyze impact of a capability or entity
  plan create <title>          Create a change plan skeleton
  plan show <file>             Display a change plan
  help                         Show this help

Options:
  --json                       Output in JSON format (where supported)
  --version, -v                Show version`;
  console.log(help.trim());
}

function parseFlags(args: string[]): { positional: string[]; json: boolean } {
  const positional: string[] = [];
  let json = false;

  for (const arg of args) {
    if (arg === '--json') {
      json = true;
    } else if (!arg.startsWith('--')) {
      positional.push(arg);
    }
  }

  return { positional, json };
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  const command = rawArgs[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    process.exit(0);
  }

  if (command === '--version' || command === '-v') {
    console.log(`sysmara v${VERSION}`);
    process.exit(0);
  }

  const cwd = process.cwd();
  const { positional, json: jsonMode } = parseFlags(rawArgs);

  try {
    switch (positional[0]) {
      case 'init':
        await commandInit(cwd);
        break;

      case 'add': {
        const type = positional[1];
        const name = positional[2];
        if (!type || !name) {
          console.error('Usage: sysmara add <type> <name>');
          console.error('Types: entity, capability, policy, invariant, module, flow');
          process.exit(1);
        }
        const config = resolveConfig(path.join(cwd, 'sysmara.config.yaml'));
        await commandAdd(cwd, type, name, config);
        break;
      }

      case 'validate': {
        const config = resolveConfig(path.join(cwd, 'sysmara.config.yaml'));
        await commandValidate(cwd, config, jsonMode);
        break;
      }

      case 'build': {
        const config = resolveConfig(path.join(cwd, 'sysmara.config.yaml'));
        await commandBuild(cwd, config, jsonMode);
        break;
      }

      case 'graph': {
        const config = resolveConfig(path.join(cwd, 'sysmara.config.yaml'));
        await commandGraph(cwd, config, jsonMode);
        break;
      }

      case 'compile': {
        const config = resolveConfig(path.join(cwd, 'sysmara.config.yaml'));
        await commandCompile(cwd, config, jsonMode);
        break;
      }

      case 'doctor': {
        const config = resolveConfig(path.join(cwd, 'sysmara.config.yaml'));
        await commandDoctor(cwd, config, jsonMode);
        break;
      }

      case 'check': {
        const subcommand = positional[1];
        if (subcommand !== 'boundaries') {
          console.error('Usage: sysmara check boundaries');
          process.exit(1);
        }
        const config = resolveConfig(path.join(cwd, 'sysmara.config.yaml'));
        await commandCheckBoundaries(cwd, config, jsonMode);
        break;
      }

      case 'explain': {
        const type = positional[1];
        const name = positional[2];
        if (!type || !name) {
          console.error('Usage: sysmara explain <type> <name>');
          console.error('Types: capability, invariant, module');
          process.exit(1);
        }
        const config = resolveConfig(path.join(cwd, 'sysmara.config.yaml'));
        await commandExplain(cwd, type, name, config, jsonMode);
        break;
      }

      case 'impact': {
        const type = positional[1];
        const name = positional[2];
        if (!type || !name) {
          console.error('Usage: sysmara impact <type> <name>');
          console.error('Types: capability, entity');
          process.exit(1);
        }
        const config = resolveConfig(path.join(cwd, 'sysmara.config.yaml'));
        await commandImpact(cwd, type, name, config, jsonMode);
        break;
      }

      case 'plan': {
        const subcommand = positional[1];
        if (!subcommand) {
          console.error('Usage: sysmara plan <create|show> [args]');
          process.exit(1);
        }

        const config = resolveConfig(path.join(cwd, 'sysmara.config.yaml'));

        if (subcommand === 'create') {
          const title = positional[2];
          if (!title) {
            console.error('Usage: sysmara plan create <title>');
            process.exit(1);
          }
          await commandPlanCreate(cwd, title, config, jsonMode);
        } else if (subcommand === 'show') {
          const filePath = positional[2];
          if (!filePath) {
            console.error('Usage: sysmara plan show <file>');
            process.exit(1);
          }
          await commandPlanShow(cwd, filePath, config, jsonMode);
        } else {
          console.error(`Unknown plan subcommand: ${subcommand}`);
          console.error('Usage: sysmara plan <create|show> [args]');
          process.exit(1);
        }
        break;
      }

      default:
        console.error(`Unknown command: ${positional[0]}`);
        console.error('Run "sysmara help" to see available commands.');
        process.exit(1);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\nError: ${message}`);
    process.exit(1);
  }
}

main();
