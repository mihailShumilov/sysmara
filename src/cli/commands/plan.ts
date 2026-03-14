/**
 * @module cli/commands/plan
 * CLI commands for creating and displaying SysMARA change plans.
 * A change plan is a structured YAML document that describes a set of
 * proposed capability, entity, or module changes before they are implemented.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as process from 'node:process';
import { parse, stringify } from 'yaml';
import { createEmptyPlan, renderChangePlanTerminal, renderChangePlanJSON } from '../../plan/index.js';
import type { SysmaraConfig, ChangePlan } from '../../types/index.js';
import { header, success, error } from '../format.js';

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Creates a new change plan skeleton and writes it as a YAML file to
 * `<frameworkDir>/plans/<planId>.yaml`. The generated file contains
 * placeholder fields for the user to fill in.
 *
 * @param cwd - Current working directory (project root).
 * @param title - Title for the new change plan.
 * @param config - Resolved SysMARA project configuration.
 * @param jsonMode - When `true`, outputs a structured JSON summary including the plan ID and file path.
 */
export async function commandPlanCreate(
  cwd: string,
  title: string,
  config: SysmaraConfig,
  jsonMode: boolean,
): Promise<void> {
  const description = 'TODO: Describe what this change plan covers';
  const plan = createEmptyPlan(title, description);

  const plansDir = path.join(cwd, config.frameworkDir, 'plans');
  await ensureDir(plansDir);

  const fileName = `${plan.id}.yaml`;
  const filePath = path.join(plansDir, fileName);

  const yamlContent = stringify(plan, { lineWidth: 120 });
  await fs.writeFile(filePath, yamlContent, 'utf-8');

  if (jsonMode) {
    console.log(JSON.stringify({
      success: true,
      planId: plan.id,
      file: path.relative(cwd, filePath),
      plan,
    }, null, 2));
  } else {
    console.log(header('Change Plan Created'));
    console.log('');
    console.log(`  Plan ID: ${plan.id}`);
    console.log(`  Title:   ${plan.title}`);
    console.log(`  Status:  ${plan.status}`);
    console.log(`  File:    ${path.relative(cwd, filePath)}`);
    console.log('');
    console.log(success('Plan skeleton created. Edit the YAML file to fill in details.'));
    console.log('');
    console.log('Next steps:');
    console.log(`  1. Edit ${path.relative(cwd, filePath)} to add capability changes`);
    console.log(`  2. Run "sysmara plan show ${path.relative(cwd, filePath)}" to preview`);
  }
}

/**
 * Reads and displays an existing change plan from a YAML file.
 * Renders the plan in either human-readable terminal format or JSON.
 *
 * @param cwd - Current working directory (project root).
 * @param filePath - Path to the change plan YAML file (relative or absolute).
 * @param _config - Resolved SysMARA project configuration (currently unused).
 * @param jsonMode - When `true`, outputs the plan as JSON.
 * @throws Exits the process with code 1 if the file cannot be read or parsed, or is missing required fields.
 */
export async function commandPlanShow(
  cwd: string,
  filePath: string,
  _config: SysmaraConfig,
  jsonMode: boolean,
): Promise<void> {
  const resolvedPath = path.resolve(cwd, filePath);

  let content: string;
  try {
    content = await fs.readFile(resolvedPath, 'utf-8');
  } catch {
    console.error(error(`Could not read plan file: ${filePath}`));
    process.exit(1);
    return; // unreachable but satisfies TypeScript
  }

  let plan: ChangePlan;
  try {
    plan = parse(content) as ChangePlan;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(error(`Failed to parse plan YAML: ${msg}`));
    process.exit(1);
    return;
  }

  if (!plan.id || !plan.title) {
    console.error(error('Invalid plan file: missing required fields (id, title).'));
    process.exit(1);
    return;
  }

  if (jsonMode) {
    console.log(renderChangePlanJSON(plan));
  } else {
    console.log(renderChangePlanTerminal(plan));
  }
}
