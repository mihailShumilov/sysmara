/**
 * @module impact
 *
 * Impact analysis module for the AI-first framework. Provides functions to analyze
 * how changes to a target node propagate through a system dependency graph, and
 * to format the resulting impact surface for terminal or JSON output.
 */

export { analyzeImpact } from './analyzer.js';
export { formatImpactTerminal, formatImpactJSON } from './formatter.js';
