/**
 * @module diagnostics
 *
 * Public API for the Sysmara diagnostics subsystem. Re-exports the
 * diagnostics engine ({@link runDiagnostics}) and formatting utilities
 * ({@link formatDiagnosticsTerminal}, {@link formatDiagnosticsJSON}).
 */

export { runDiagnostics } from './engine.js';
export { formatDiagnosticsTerminal, formatDiagnosticsJSON } from './formatter.js';
