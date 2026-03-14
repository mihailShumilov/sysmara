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
