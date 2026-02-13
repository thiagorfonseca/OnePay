export type ZapsignSigner = {
  name: string;
  email: string;
  cpf?: string;
  authMode?: 'email' | 'sms' | 'whatsapp';
  phone?: string;
  anchor?: string;
};

export type ZapsignCreateDocumentParams = {
  name: string;
  base64_pdf?: string;
  base64_docx?: string;
  signers: ZapsignSigner[];
  lang?: string;
  external_id?: string;
  sandbox?: boolean;
  redirectUrl?: string;
};

const getApiBase = () => 'https://api.zapsign.com.br/api/v1';
const buildSignerUrl = (token?: string | null) => (token ? `https://app.zapsign.com.br/verificar/${token}` : null);

const request = async (path: string, token: string, options: RequestInit = {}) => {
  const res = await fetch(`${getApiBase()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const rawText = await res.text();
  const data = rawText ? (() => { try { return JSON.parse(rawText); } catch { return {}; } })() : {};
  if (!res.ok) {
    const message = data?.message || data?.detail || data?.error || 'Erro ao comunicar com ZapSign';
    throw new Error(message);
  }
  if (data?.signers && Array.isArray(data.signers)) {
    data.signers = data.signers.map((signer: any) => {
      const tokenValue = signer?.token || signer?.signer_token;
      const signUrl = signer?.sign_url || signer?.url || buildSignerUrl(tokenValue);
      return { ...signer, sign_url: signUrl };
    });
  }
  return data;
};

export const createDocumentFromBase64 = async (
  token: string,
  params: ZapsignCreateDocumentParams
) => {
  if (!params.base64_pdf && !params.base64_docx) {
    throw new Error('base64_pdf ou base64_docx é obrigatório.');
  }

  const body: Record<string, any> = {
    name: params.name,
    lang: params.lang || 'pt-br',
    external_id: params.external_id,
    signers: params.signers.map((signer, index) => ({
      name: signer.name,
      email: signer.email,
      cpf: signer.cpf,
      auth_mode: signer.authMode || 'email',
      phone_number: signer.phone,
      anchor: signer.anchor || `<<signer${index + 1}>>`,
    })),
  };

  if (params.base64_pdf) body.base64_pdf = params.base64_pdf;
  if (params.base64_docx) body.base64_docx = params.base64_docx;
  if (params.sandbox !== undefined) body.sandbox = params.sandbox;
  if (params.redirectUrl) body.redirect_url = params.redirectUrl;

  return request('/docs', token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
};

export const getDocument = async (token: string, docId: string) => {
  return request(`/docs/${docId}`, token, { method: 'GET' });
};

export const downloadSigned = async (token: string, docId: string) => {
  return request(`/docs/${docId}/download`, token, { method: 'GET' });
};
