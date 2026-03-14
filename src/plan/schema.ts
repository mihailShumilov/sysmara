import { z } from 'zod';

export const riskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

export const changeActionSchema = z.enum(['add', 'modify', 'remove', 'rename']);

export const affectedItemSchema = z.object({
  name: z.string().min(1),
  impact: z.enum(['direct', 'indirect']),
  description: z.string(),
});

export const capabilityChangeSchema = z.object({
  capability: z.string().min(1),
  action: changeActionSchema,
  description: z.string(),
  newEntities: z.array(z.string()).optional(),
  newPolicies: z.array(z.string()).optional(),
  newInvariants: z.array(z.string()).optional(),
  breakingChange: z.boolean(),
});

export const changePlanSummarySchema = z.object({
  intent: z.string().min(1),
  scope: z.string(),
  estimatedImpactRadius: z.number().int().min(0),
  requiresHumanReview: z.boolean(),
  breakingChanges: z.boolean(),
});

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
