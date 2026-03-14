/**
 * @module plan/schema
 *
 * Zod validation schemas for change plan data structures. These schemas enforce
 * the shape and constraints of change plans, capability changes, affected items,
 * and related types at runtime.
 */

import { z } from 'zod';

/**
 * Zod schema for risk level classification.
 * Validates that the value is one of: `'low'`, `'medium'`, `'high'`, or `'critical'`.
 */
export const riskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

/**
 * Zod schema for capability change actions.
 * Validates that the value is one of: `'add'`, `'modify'`, `'remove'`, or `'rename'`.
 */
export const changeActionSchema = z.enum(['add', 'modify', 'remove', 'rename']);

/**
 * Zod schema for an affected item within a change plan.
 * Validates an object with a non-empty `name`, an `impact` of `'direct'` or `'indirect'`,
 * and a `description` string.
 */
export const affectedItemSchema = z.object({
  name: z.string().min(1),
  impact: z.enum(['direct', 'indirect']),
  description: z.string(),
});

/**
 * Zod schema for a single capability change entry.
 * Validates the capability name, action type, description, optional arrays of
 * new entities/policies/invariants, and a required `breakingChange` boolean flag.
 */
export const capabilityChangeSchema = z.object({
  capability: z.string().min(1),
  action: changeActionSchema,
  description: z.string(),
  newEntities: z.array(z.string()).optional(),
  newPolicies: z.array(z.string()).optional(),
  newInvariants: z.array(z.string()).optional(),
  breakingChange: z.boolean(),
});

/**
 * Zod schema for the summary section of a change plan.
 * Validates intent, scope, estimated impact radius (non-negative integer),
 * and boolean flags for human review requirement and breaking changes.
 */
export const changePlanSummarySchema = z.object({
  intent: z.string().min(1),
  scope: z.string(),
  estimatedImpactRadius: z.number().int().min(0),
  requiresHumanReview: z.boolean(),
  breakingChanges: z.boolean(),
});

/**
 * Zod schema for a complete change plan.
 * Validates the full structure including metadata (id, title, description, timestamps, author),
 * status, risk level, summary, capability changes, all affected item categories,
 * and supplementary lists (migration notes, artifacts, tests, specs, review flags,
 * rollout notes, open questions).
 */
export const changePlanSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  createdAt: z.string(),
  author: z.string(),
  status: z.enum(['draft', 'proposed', 'approved', 'rejected', 'implemented']),
  risk: riskLevelSchema,
  summary: changePlanSummarySchema,
  capabilityChanges: z.array(capabilityChangeSchema),
  affectedEntities: z.array(affectedItemSchema),
  affectedModules: z.array(affectedItemSchema),
  affectedPolicies: z.array(affectedItemSchema),
  affectedInvariants: z.array(affectedItemSchema),
  affectedRoutes: z.array(affectedItemSchema),
  migrationNotes: z.array(z.string()),
  generatedArtifactsToRefresh: z.array(z.string()),
  testsLikelyAffected: z.array(z.string()),
  specsToUpdate: z.array(z.string()),
  humanReviewFlags: z.array(z.string()),
  rolloutNotes: z.array(z.string()),
  openQuestions: z.array(z.string()),
});
