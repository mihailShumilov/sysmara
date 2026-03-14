import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as process from 'node:process';
import { parseSpecDirectory, crossValidate } from '../../spec/index.js';
import { validateModuleBoundaries, validateCapabilityBoundaries, detectModuleCycles } from '../../boundaries/index.js';
import { validateInvariantSpecs } from '../../invariants/index.js';
import { runDiagnostics } from '../../diagnostics/index.js';
import type { SysmaraConfig } from '../../types/index.js';
import { header, success, error } from '../format.js';

interface DoctorSection {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details: string[];
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function commandDoctor(cwd: string, config: SysmaraConfig, jsonMode: boolean): Promise<void> {
  const sections: DoctorSection[] = [];
  let overallHealthy = true;

  // 1. Check sysmara.config.yaml
  const configPath = path.join(cwd, 'sysmara.config.yaml');
  const configExists = await fileExists(configPath);
  sections.push({
    name: 'Configuration',
    status: configExists ? 'pass' : 'fail',
    message: configExists ? 'sysmara.config.yaml found' : 'sysmara.config.yaml not found',
    details: configExists ? [] : ['Run "sysmara init" to create a project'],
  });
  if (!configExists) overallHealthy = false;

  // 2. Check system/ directory
  const specDir = path.resolve(cwd, config.specDir);
  const specDirExists = await fileExists(specDir);
  sections.push({
    name: 'Spec Directory',
    status: specDirExists ? 'pass' : 'fail',
    message: specDirExists ? `${config.specDir} directory found` : `${config.specDir} directory not found`,
    details: specDirExists ? [] : ['Run "sysmara init" to create the spec directory'],
  });
  if (!specDirExists) {
    overallHealthy = false;
    outputResults(sections, overallHealthy, jsonMode);
    if (!overallHealthy) process.exit(1);
    return;
  }

  // 3. Parse all specs
  const result = await parseSpecDirectory(specDir);
  const parseErrors = result.diagnostics.filter((d) => d.severity === 'error');
  sections.push({
    name: 'Spec Parsing',
    status: parseErrors.length === 0 ? 'pass' : 'fail',
    message: result.specs
      ? `Parsed successfully: ${result.specs.entities.length} entities, ${result.specs.capabilities.length} capabilities, ${result.specs.policies.length} policies, ${result.specs.invariants.length} invariants, ${result.specs.modules.length} modules, ${result.specs.flows.length} flows`
      : 'Failed to parse specs',
    details: result.diagnostics.map((d) => `[${d.severity.toUpperCase()}] ${d.message}`),
  });
  if (!result.specs) {
    overallHealthy = false;
    outputResults(sections, overallHealthy, jsonMode);
    process.exit(1);
    return;
  }

  const specs = result.specs;

  // 4. Cross-validate
  const crossDiags = crossValidate(specs);
  const crossErrors = crossDiags.filter((d) => d.severity === 'error');
  sections.push({
    name: 'Cross-Validation',
    status: crossErrors.length === 0 ? (crossDiags.length === 0 ? 'pass' : 'warn') : 'fail',
    message: crossDiags.length === 0 ? 'No cross-validation issues' : `${crossDiags.length} issue(s) found`,
    details: crossDiags.map((d) => `[${d.severity.toUpperCase()}] ${d.message}`),
  });
  if (crossErrors.length > 0) overallHealthy = false;

  // 5. Module boundaries
  const moduleDiags = validateModuleBoundaries(specs.modules);
  const capBoundaryDiags = validateCapabilityBoundaries(specs.capabilities, specs.modules, specs.entities);
  const boundaryDiags = [...moduleDiags, ...capBoundaryDiags];
  const boundaryErrors = boundaryDiags.filter((d) => d.severity === 'error');
  sections.push({
    name: 'Module Boundaries',
    status: boundaryErrors.length === 0 ? (boundaryDiags.length === 0 ? 'pass' : 'warn') : 'fail',
    message: boundaryDiags.length === 0 ? 'All boundaries valid' : `${boundaryDiags.length} boundary issue(s)`,
    details: boundaryDiags.map((d) => `[${d.severity.toUpperCase()}] ${d.message}`),
  });
  if (boundaryErrors.length > 0) overallHealthy = false;

  // 6. Invariant specs
  const invariantDiags = validateInvariantSpecs(specs.invariants, specs.entities);
  const invariantErrors = invariantDiags.filter((d) => d.severity === 'error');
  sections.push({
    name: 'Invariant Specs',
    status: invariantErrors.length === 0 ? (invariantDiags.length === 0 ? 'pass' : 'warn') : 'fail',
    message: invariantDiags.length === 0 ? 'All invariant specs valid' : `${invariantDiags.length} invariant issue(s)`,
    details: invariantDiags.map((d) => `[${d.severity.toUpperCase()}] ${d.message}`),
  });
  if (invariantErrors.length > 0) overallHealthy = false;

  // 7. Full diagnostics
  const report = runDiagnostics(specs);
  const diagErrors = report.diagnostics.filter((d) => d.severity === 'error');
  sections.push({
    name: 'Diagnostics',
    status: diagErrors.length === 0 ? (report.diagnostics.length === 0 ? 'pass' : 'warn') : 'fail',
    message: `${report.totalErrors} error(s), ${report.totalWarnings} warning(s), ${report.totalInfo} info`,
    details: report.diagnostics.map((d) => `[${d.severity.toUpperCase()}] ${d.message}`),
  });
  if (diagErrors.length > 0) overallHealthy = false;

  // 8. Orphan specs check
  const orphanDetails: string[] = [];
  const moduleEntityNames = new Set(specs.modules.flatMap((m) => m.entities));
  const moduleCapNames = new Set(specs.modules.flatMap((m) => m.capabilities));

  for (const entity of specs.entities) {
    if (!moduleEntityNames.has(entity.name)) {
      orphanDetails.push(`Entity "${entity.name}" is not listed in any module`);
    }
  }
  for (const cap of specs.capabilities) {
    if (!moduleCapNames.has(cap.name)) {
      orphanDetails.push(`Capability "${cap.name}" is not listed in any module`);
    }
  }
  sections.push({
    name: 'Orphan Detection',
    status: orphanDetails.length === 0 ? 'pass' : 'warn',
    message: orphanDetails.length === 0 ? 'No orphan specs detected' : `${orphanDetails.length} orphan(s) detected`,
    details: orphanDetails,
  });

  // 9. Module cycles
  const cycles = detectModuleCycles(specs.modules);
  sections.push({
    name: 'Module Cycles',
    status: cycles.length === 0 ? 'pass' : 'fail',
    message: cycles.length === 0 ? 'No dependency cycles detected' : `${cycles.length} cycle(s) detected`,
    details: cycles.map((cycle) => `Cycle: ${cycle.join(' -> ')}`),
  });
  if (cycles.length > 0) overallHealthy = false;

  outputResults(sections, overallHealthy, jsonMode);
  if (!overallHealthy) process.exit(1);
}

function outputResults(sections: DoctorSection[], overallHealthy: boolean, jsonMode: boolean): void {
  if (jsonMode) {
    console.log(JSON.stringify({
      healthy: overallHealthy,
      sections: sections.map((s) => ({
        name: s.name,
        status: s.status,
        message: s.message,
        details: s.details,
      })),
    }, null, 2));
    return;
  }

  console.log(header('SysMARA Doctor — System Health Check'));
  console.log('');

  for (const s of sections) {
    const statusIcon = s.status === 'pass' ? '[PASS]' : s.status === 'warn' ? '[WARN]' : '[FAIL]';
    console.log(`  ${statusIcon} ${s.name}: ${s.message}`);

    if (s.details.length > 0) {
      for (const detail of s.details) {
        console.log(`         ${detail}`);
      }
    }
  }

  console.log('');
  if (overallHealthy) {
    console.log(success('System is healthy.'));
  } else {
    console.log(error('System has issues that need attention.'));
  }
}
