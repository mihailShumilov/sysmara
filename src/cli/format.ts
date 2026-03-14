/**
 * @module cli/format
 * Terminal formatting utilities for SysMARA CLI output.
 * Provides consistent visual patterns (headers, status prefixes, tables, etc.)
 * used across all CLI commands.
 */

/**
 * Formats text as a prominent section header enclosed in double-line borders.
 *
 * @param text - Header text to display.
 * @returns A multi-line string with `═` borders above and below the text.
 */
export function header(text: string): string {
  const line = '═'.repeat(60);
  return `\n${line}\n  ${text}\n${line}`;
}

/**
 * Prefixes text with a success indicator.
 *
 * @param text - Message to mark as successful.
 * @returns The text prefixed with `[OK]`.
 */
export function success(text: string): string {
  return `[OK] ${text}`;
}

/**
 * Prefixes text with an error indicator.
 *
 * @param text - Error message.
 * @returns The text prefixed with `[ERROR]`.
 */
export function error(text: string): string {
  return `[ERROR] ${text}`;
}

/**
 * Prefixes text with a warning indicator.
 *
 * @param text - Warning message.
 * @returns The text prefixed with `[WARN]`.
 */
export function warning(text: string): string {
  return `[WARN] ${text}`;
}

/**
 * Prefixes text with an informational indicator.
 *
 * @param text - Informational message.
 * @returns The text prefixed with `[INFO]`.
 */
export function info(text: string): string {
  return `[INFO] ${text}`;
}

/**
 * Renders a fixed-width ASCII table with headers and data rows.
 * Column widths are auto-calculated from the longest cell in each column.
 *
 * @param headers - Column header labels.
 * @param rows - Two-dimensional array of cell values.
 * @returns A multi-line string containing the formatted table.
 */
export function table(headers: string[], rows: string[][]): string {
  const colWidths = headers.map((h, i) => {
    const maxRow = rows.reduce((max, row) => Math.max(max, (row[i] ?? '').length), 0);
    return Math.max(h.length, maxRow);
  });

  const sep = colWidths.map((w) => '─'.repeat(w + 2)).join('┼');
  const headerLine = headers.map((h, i) => ` ${h.padEnd(colWidths[i] ?? 0)} `).join('│');
  const dataLines = rows.map((row) =>
    row.map((cell, i) => ` ${(cell ?? '').padEnd(colWidths[i] ?? 0)} `).join('│'),
  );

  return [headerLine, sep, ...dataLines].join('\n');
}

/**
 * Formats text as a subsection header with single-line borders.
 *
 * @param title - Subsection title.
 * @returns A multi-line string with `─` borders above and below the title.
 */
export function section(title: string): string {
  return `\n${'─'.repeat(40)}\n  ${title}\n${'─'.repeat(40)}`;
}

/**
 * Renders a list of items as indented bullet points.
 *
 * @param items - Strings to render as bullet points.
 * @param indent - Number of leading spaces before each bullet. Defaults to `2`.
 * @returns A newline-separated string of bulleted items.
 */
export function bullet(items: string[], indent: number = 2): string {
  const pad = ' '.repeat(indent);
  return items.map((item) => `${pad}- ${item}`).join('\n');
}
