export function header(text: string): string {
  const line = '═'.repeat(60);
  return `\n${line}\n  ${text}\n${line}`;
}

export function success(text: string): string {
  return `[OK] ${text}`;
}

export function error(text: string): string {
  return `[ERROR] ${text}`;
}

export function warning(text: string): string {
  return `[WARN] ${text}`;
}

export function info(text: string): string {
  return `[INFO] ${text}`;
}

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

export function section(title: string): string {
  return `\n${'─'.repeat(40)}\n  ${title}\n${'─'.repeat(40)}`;
}

export function bullet(items: string[], indent: number = 2): string {
  const pad = ' '.repeat(indent);
  return items.map((item) => `${pad}- ${item}`).join('\n');
}
