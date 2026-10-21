/**
 * Minimal RFC 4180 CSV: quoted fields, escaped quotes (""), CRLF or LF line ends, a leading
 * UTF-8 BOM. Blank lines are skipped.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };

  for (; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"' && field === '') {
      quoted = true;
    } else if (c === ',') {
      endField();
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      endRow();
    } else {
      field += c;
    }
  }
  if (quoted) throw new Error('Unterminated quoted field');
  if (field !== '' || row.length > 0) endRow();
  return rows;
}

/**
 * Serializes rows for spreadsheets. Cells that a spreadsheet would run as a formula
 * (=, +, -, @, tab, CR) are prefixed with an apostrophe (CSV injection).
 */
export function toCsv(rows: (string | number | boolean | null | undefined)[][]): string {
  const cell = (value: string | number | boolean | null | undefined): string => {
    if (value === null || value === undefined) return '';
    let text = String(value);
    if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return `${rows.map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`;
}
