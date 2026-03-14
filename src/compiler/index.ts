/**
 * @module compiler
 *
 * Public API for the Sysmara capability compiler. Re-exports the
 * {@link compileCapabilities} function and its associated output types
 * from the internal `capability-compiler` module.
 */

export {
  compileCapabilities,
  type CompilerOutput,
  type GeneratedFile,
} from './capability-compiler.js';
