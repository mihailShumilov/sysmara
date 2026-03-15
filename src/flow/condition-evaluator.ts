/**
 * @module flow/condition-evaluator
 * Safe expression evaluator for flow step conditions.
 * Supports property access, comparison operators, and logical operators
 * without using eval(). Designed for evaluating conditions like:
 * - `context.input.role === "admin"`
 * - `context.stepOutputs.create_user.id !== null`
 * - `context.input.amount > 1000`
 */

import type { FlowContext } from './types.js';

/** Supported token types in condition expressions. */
type TokenType =
  | 'identifier'
  | 'string'
  | 'number'
  | 'operator'
  | 'dot'
  | 'null'
  | 'true'
  | 'false'
  | 'undefined'
  | 'and'
  | 'or'
  | 'not'
  | 'lparen'
  | 'rparen';

/** A single token produced by the lexer. */
interface Token {
  type: TokenType;
  value: string;
}

/**
 * Tokenizes a condition expression string into a list of tokens.
 *
 * @param expr - The condition expression string to tokenize
 * @returns An array of tokens
 * @throws Error if an unexpected character is encountered
 */
function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i]!;

    // Skip whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Parentheses
    if (ch === '(') {
      tokens.push({ type: 'lparen', value: '(' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ')' });
      i++;
      continue;
    }

    // Dot
    if (ch === '.') {
      tokens.push({ type: 'dot', value: '.' });
      i++;
      continue;
    }

    // String literals (single or double quotes)
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let str = '';
      i++;
      while (i < expr.length && expr[i] !== quote) {
        if (expr[i] === '\\' && i + 1 < expr.length) {
          str += expr[i + 1];
          i += 2;
        } else {
          str += expr[i];
          i++;
        }
      }
      i++; // skip closing quote
      tokens.push({ type: 'string', value: str });
      continue;
    }

    // Numbers
    if (/[0-9]/.test(ch) || (ch === '-' && i + 1 < expr.length && /[0-9]/.test(expr[i + 1]!))) {
      let num = ch;
      i++;
      while (i < expr.length && /[0-9.]/.test(expr[i]!)) {
        num += expr[i];
        i++;
      }
      tokens.push({ type: 'number', value: num });
      continue;
    }

    // Operators
    if (ch === '=' || ch === '!' || ch === '<' || ch === '>') {
      let op = ch;
      i++;
      if (i < expr.length && expr[i] === '=') {
        op += '=';
        i++;
        if (i < expr.length && expr[i] === '=') {
          op += '=';
          i++;
        }
      }
      tokens.push({ type: 'operator', value: op });
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_$]/.test(ch)) {
      let ident = ch;
      i++;
      while (i < expr.length && /[a-zA-Z0-9_$]/.test(expr[i]!)) {
        ident += expr[i];
        i++;
      }

      switch (ident) {
        case 'null':
          tokens.push({ type: 'null', value: 'null' });
          break;
        case 'true':
          tokens.push({ type: 'true', value: 'true' });
          break;
        case 'false':
          tokens.push({ type: 'false', value: 'false' });
          break;
        case 'undefined':
          tokens.push({ type: 'undefined', value: 'undefined' });
          break;
        case 'and':
        case 'AND':
          tokens.push({ type: 'and', value: '&&' });
          break;
        case 'or':
        case 'OR':
          tokens.push({ type: 'or', value: '||' });
          break;
        case 'not':
        case 'NOT':
          tokens.push({ type: 'not', value: '!' });
          break;
        default:
          tokens.push({ type: 'identifier', value: ident });
      }
      continue;
    }

    // Logical operators
    if (ch === '&' && i + 1 < expr.length && expr[i + 1] === '&') {
      tokens.push({ type: 'and', value: '&&' });
      i += 2;
      continue;
    }
    if (ch === '|' && i + 1 < expr.length && expr[i + 1] === '|') {
      tokens.push({ type: 'or', value: '||' });
      i += 2;
      continue;
    }

    throw new Error(`Unexpected character '${ch}' at position ${i} in condition: "${expr}"`);
  }

  return tokens;
}

/**
 * Resolves a dotted property path against the flow context.
 * Supports paths like `context.input.role`, `context.stepOutputs.create_user.id`.
 *
 * @param path - Array of property name segments
 * @param context - The flow context to resolve against
 * @returns The resolved value, or undefined if the path doesn't exist
 */
function resolveProperty(path: string[], context: FlowContext): unknown {
  // The root must be "context"
  if (path[0] !== 'context') {
    return undefined;
  }

  let current: unknown = context;
  for (let i = 1; i < path.length; i++) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[path[i]!];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * A simple recursive descent parser and evaluator for condition expressions.
 * Parses and evaluates in a single pass for simplicity.
 */
class ConditionParser {
  private pos = 0;

  constructor(
    private tokens: Token[],
    private context: FlowContext,
  ) {}

  /**
   * Parses and evaluates the full expression.
   *
   * @returns The boolean result of the expression
   */
  evaluate(): boolean {
    const result = this.parseOr();
    return Boolean(result);
  }

  /** Parses OR expressions (lowest precedence). */
  private parseOr(): unknown {
    let left = this.parseAnd();
    while (this.pos < this.tokens.length && this.tokens[this.pos]?.type === 'or') {
      this.pos++;
      const right = this.parseAnd();
      left = Boolean(left) || Boolean(right);
    }
    return left;
  }

  /** Parses AND expressions. */
  private parseAnd(): unknown {
    let left = this.parseComparison();
    while (this.pos < this.tokens.length && this.tokens[this.pos]?.type === 'and') {
      this.pos++;
      const right = this.parseComparison();
      left = Boolean(left) && Boolean(right);
    }
    return left;
  }

  /** Parses comparison expressions. */
  private parseComparison(): unknown {
    if (this.pos < this.tokens.length && this.tokens[this.pos]?.type === 'not') {
      this.pos++;
      const val = this.parseComparison();
      return !val;
    }

    const left = this.parsePrimary();

    if (this.pos < this.tokens.length && this.tokens[this.pos]?.type === 'operator') {
      const op = this.tokens[this.pos]!.value;
      this.pos++;
      const right = this.parsePrimary();
      return this.compare(left, op, right);
    }

    return left;
  }

  /** Parses primary values: literals, property paths, and parenthesized expressions. */
  private parsePrimary(): unknown {
    const token = this.tokens[this.pos];
    if (!token) {
      throw new Error('Unexpected end of expression');
    }

    switch (token.type) {
      case 'string':
        this.pos++;
        return token.value;

      case 'number':
        this.pos++;
        return Number(token.value);

      case 'null':
        this.pos++;
        return null;

      case 'true':
        this.pos++;
        return true;

      case 'false':
        this.pos++;
        return false;

      case 'undefined':
        this.pos++;
        return undefined;

      case 'lparen': {
        this.pos++;
        const result = this.parseOr();
        if (this.pos < this.tokens.length && this.tokens[this.pos]?.type === 'rparen') {
          this.pos++;
        }
        return result;
      }

      case 'identifier': {
        // Build a dotted property path
        const path: string[] = [token.value];
        this.pos++;
        while (
          this.pos < this.tokens.length &&
          this.tokens[this.pos]?.type === 'dot' &&
          this.pos + 1 < this.tokens.length &&
          this.tokens[this.pos + 1]?.type === 'identifier'
        ) {
          this.pos++; // skip dot
          path.push(this.tokens[this.pos]!.value);
          this.pos++;
        }
        return resolveProperty(path, this.context);
      }

      default:
        throw new Error(`Unexpected token: ${token.type} "${token.value}"`);
    }
  }

  /**
   * Performs a comparison between two values.
   *
   * @param left - Left operand
   * @param op - Operator string
   * @param right - Right operand
   * @returns The boolean result
   */
  private compare(left: unknown, op: string, right: unknown): boolean {
    switch (op) {
      case '===':
      case '==':
        return left === right;
      case '!==':
      case '!=':
        return left !== right;
      case '>':
        return (left as number) > (right as number);
      case '<':
        return (left as number) < (right as number);
      case '>=':
        return (left as number) >= (right as number);
      case '<=':
        return (left as number) <= (right as number);
      default:
        throw new Error(`Unsupported operator: ${op}`);
    }
  }
}

/**
 * Evaluates a condition expression against a flow context.
 * Uses a safe recursive descent parser — no eval().
 *
 * @param condition - The condition expression string
 * @param context - The flow context to evaluate against
 * @returns true if the condition is satisfied, false otherwise
 *
 * @example
 * ```ts
 * evaluateCondition('context.input.role === "admin"', flowContext);
 * evaluateCondition('context.stepOutputs.create_user.id !== null', flowContext);
 * evaluateCondition('context.input.amount > 1000', flowContext);
 * ```
 */
export function evaluateCondition(condition: string, context: FlowContext): boolean {
  const tokens = tokenize(condition);
  if (tokens.length === 0) {
    return true; // empty condition is always true
  }
  const parser = new ConditionParser(tokens, context);
  return parser.evaluate();
}
