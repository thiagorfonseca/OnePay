export type SpreadsheetCell = { type: 'String' | 'Number'; value: string | number };

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const buildSpreadsheetXml = (sheetName: string, rows: SpreadsheetCell[][]) => {
  const xmlRows = rows
    .map((row) => {
      const cells = row
        .map((cell) => {
          const value = cell.type === 'Number' ? cell.value : escapeXml(String(cell.value));
          return `<Cell><Data ss:Type="${cell.type}">${value}</Data></Cell>`;
        })
        .join('');
      return `<Row>${cells}</Row>`;
    })
    .join('');
  return `<?xml version="1.0"?>\n` +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">` +
    `<Worksheet ss:Name="${escapeXml(sheetName)}"><Table>${xmlRows}</Table></Worksheet>` +
    `</Workbook>`;
};
