export type ContractTagPayload = {
  responsavel_nome?: string;
  responsavel_cpf?: string;
  responsavel_email?: string;
  responsavel_telefone?: string;
  razao_social?: string;
  nome_fantasia?: string;
  cnpj?: string;
  endereco_logradouro?: string;
  endereco_numero?: string;
  endereco_bairro?: string;
  endereco_cidade?: string;
  endereco_uf?: string;
  endereco_cep?: string;
  produto_nome?: string;
  produto_valor?: string;
  forma_pagamento?: string;
  parcelas?: string;
};

export const CONTRACT_TAGS = [
  '{{nome_completo_responsavel}}',
  '{{cpf_responsavel}}',
  '{{email}}',
  '{{telefone}}',
  '{{razao_social}}',
  '{{nome_fantasia}}',
  '{{cnpj}}',
  '{{endereco_logradouro}}',
  '{{endereco_numero}}',
  '{{endereco_bairro}}',
  '{{endereco_cidade}}',
  '{{endereco_uf}}',
  '{{endereco_cep}}',
  '{{produto_nome}}',
  '{{produto_valor}}',
  '{{forma_pagamento}}',
  '{{parcelas}}',
  '{{data_hoje}}',
];

const normalizeValue = (value?: string | null) => (value ? value : '');

const formatDate = (date: Date) => {
  try {
    return date.toLocaleDateString('pt-BR');
  } catch {
    return date.toISOString().slice(0, 10).split('-').reverse().join('/');
  }
};

export const applyContractTags = (html: string, payload: ContractTagPayload) => {
  const tagMap: Record<string, string> = {
    '{{nome_completo_responsavel}}': normalizeValue(payload.responsavel_nome),
    '{{cpf_responsavel}}': normalizeValue(payload.responsavel_cpf),
    '{{email}}': normalizeValue(payload.responsavel_email),
    '{{telefone}}': normalizeValue(payload.responsavel_telefone),
    '{{razao_social}}': normalizeValue(payload.razao_social),
    '{{nome_fantasia}}': normalizeValue(payload.nome_fantasia),
    '{{cnpj}}': normalizeValue(payload.cnpj),
    '{{endereco_logradouro}}': normalizeValue(payload.endereco_logradouro),
    '{{endereco_numero}}': normalizeValue(payload.endereco_numero),
    '{{endereco_bairro}}': normalizeValue(payload.endereco_bairro),
    '{{endereco_cidade}}': normalizeValue(payload.endereco_cidade),
    '{{endereco_uf}}': normalizeValue(payload.endereco_uf),
    '{{endereco_cep}}': normalizeValue(payload.endereco_cep),
    '{{produto_nome}}': normalizeValue(payload.produto_nome),
    '{{produto_valor}}': normalizeValue(payload.produto_valor),
    '{{forma_pagamento}}': normalizeValue(payload.forma_pagamento),
    '{{parcelas}}': normalizeValue(payload.parcelas),
    '{{data_hoje}}': formatDate(new Date()),
  };

  let output = html;
  Object.entries(tagMap).forEach(([tag, value]) => {
    output = output.split(tag).join(value);
  });
  return output;
};
