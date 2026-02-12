import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const decodeHtmlEntities = (text: string) =>
  text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

export const htmlToText = (html: string) => {
  const withBreaks = html
    .replace(/<\s*br\s*\/>/gi, '\n')
    .replace(/<\s*br\s*>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n')
    .replace(/<\s*p[^>]*>/gi, '')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<\s*\/li\s*>/gi, '\n')
    .replace(/<\s*div[^>]*>/gi, '')
    .replace(/<\s*\/div\s*>/gi, '\n');

  const stripped = withBreaks.replace(/<[^>]+>/g, '');
  const normalized = stripped.replace(/\n{3,}/g, '\n\n');
  return decodeHtmlEntities(normalized).trim();
};

const wrapText = (text: string, font: any, fontSize: number, maxWidth: number) => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(next, fontSize);
    if (width <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
};

export const buildPdfFromHtml = async (html: string) => {
  const text = htmlToText(html);
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 12;
  const lineHeight = fontSize * 1.4;
  const margin = 48;
  let page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  let y = height - margin;

  const paragraphs = text.split(/\n{2,}/g);
  for (const paragraph of paragraphs) {
    const lines = wrapText(paragraph, font, fontSize, width - margin * 2);
    for (const line of lines) {
      if (y < margin) {
        page = pdfDoc.addPage();
        y = height - margin;
      }
      page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0, 0, 0) });
      y -= lineHeight;
    }
    y -= lineHeight;
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes).toString('base64');
};
