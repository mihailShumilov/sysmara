/**
 * @module plan
 *
 * Change plan module for the AI-first framework. Provides plan generation from
 * high-level change requests, Zod validation schemas for plan data structures,
 * and renderers for Markdown, JSON, and terminal output formats.
 */

export { changePlanSchema, capabilityChangeSchema, affectedItemSchema, changePlanSummarySchema, riskLevelSchema } from './schema.js';
export { generateChangePlan, createEmptyPlan } from './generator.js';
export type { PlanRequest } from './generator.js';
export { renderChangePlanMarkdown, renderChangePlanJSON, renderChangePlanTerminal } from './renderer.js';
