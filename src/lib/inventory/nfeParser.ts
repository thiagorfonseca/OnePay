import { XMLParser } from 'fast-xml-parser';
import type { ParsedNfe, ParsedNfeItem } from './types';
import { toNumber } from './utils';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  trimValues: true,
});

const getText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object' && 'text' in (value as any)) return String((value as any).text || '').trim();
  return null;
};

const normalizeDate = (value: string | null) => {
  if (!value) return null;
  if (value.includes('T')) return value.split('T')[0];
  return value;
};

const safeArray = <T>(value: T | T[] | null | undefined): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

export const parseNfeXml = (xml: string): ParsedNfe => {
  if (!xml) return { items: [] };

  let parsed: any;
  try {
    parsed = parser.parse(xml);
  } catch {
    return { items: [] };
  }

  const nfe = parsed?.nfeProc?.NFe || parsed?.NFe || parsed?.nfe || parsed?.nfeProc?.nfe || parsed?.procNFe?.NFe;
  const infNFe = nfe?.infNFe || nfe?.infNfe || nfe?.infNFeSupl?.infNFe || nfe?.infNFeSupl;

  const ide = infNFe?.ide || nfe?.ide || parsed?.ide;
  const emit = infNFe?.emit || nfe?.emit || parsed?.emit;
  const det = infNFe?.det || nfe?.det || parsed?.det;

  const invoiceNumber = getText(ide?.nNF || ide?.nNf || ide?.nNFIS);
  const issueDate = normalizeDate(getText(ide?.dhEmi || ide?.dEmi));
  const supplierName = getText(emit?.xNome || emit?.xFant);
  const supplierCnpj = getText(emit?.CNPJ || emit?.CPF);

  const items: ParsedNfeItem[] = safeArray(det).map((item: any) => {
    const prod = item?.prod || item?.Produto || {};
    const rastros = safeArray(item?.rastro || prod?.rastro || item?.med || prod?.med);
    const rastro = rastros[0] || {};

    return {
      description: getText(prod?.xProd) || 'Item importado',
      quantity: toNumber(getText(prod?.qCom || prod?.qTrib) || 0),
      unit_cost: toNumber(getText(prod?.vUnCom || prod?.vUnTrib) || 0),
      total_cost: toNumber(getText(prod?.vProd) || 0),
      barcode: getText(prod?.cEAN || prod?.cEANTrib),
      batch_code: getText(rastro?.nLote || rastro?.lote),
      expiry_date: normalizeDate(getText(rastro?.dVal || rastro?.validade)),
      manufacture_date: normalizeDate(getText(rastro?.dFab || rastro?.fabricacao)),
    };
  });

  return { invoiceNumber, issueDate, supplierName, supplierCnpj, items };
};
