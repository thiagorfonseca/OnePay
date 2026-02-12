import { describe, it, expect } from 'vitest';
import { parseNfeXml } from '../nfeParser';

const xmlSample = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc>
  <NFe>
    <infNFe>
      <ide>
        <nNF>1234</nNF>
        <dEmi>2026-02-10</dEmi>
      </ide>
      <emit>
        <xNome>Distribuidora Alfa</xNome>
        <CNPJ>12345678000199</CNPJ>
      </emit>
      <det>
        <prod>
          <xProd>Toxina Botulínica</xProd>
          <qCom>2</qCom>
          <vUnCom>1500.00</vUnCom>
          <vProd>3000.00</vProd>
          <cEAN>7890000000000</cEAN>
        </prod>
        <rastro>
          <nLote>L123</nLote>
          <dVal>2027-01-01</dVal>
        </rastro>
      </det>
    </infNFe>
  </NFe>
</nfeProc>`;

describe('parseNfeXml', () => {
  it('parses basic NF-e fields', () => {
    const result = parseNfeXml(xmlSample);
    expect(result.invoiceNumber).toBe('1234');
    expect(result.issueDate).toBe('2026-02-10');
    expect(result.supplierName).toBe('Distribuidora Alfa');
    expect(result.supplierCnpj).toBe('12345678000199');
    expect(result.items.length).toBe(1);
    expect(result.items[0].description).toBe('Toxina Botulínica');
    expect(result.items[0].batch_code).toBe('L123');
  });
});
