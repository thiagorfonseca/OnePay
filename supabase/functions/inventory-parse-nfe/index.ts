import { serve } from "https://deno.land/std@0.204.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.2";
import { XMLParser } from "npm:fast-xml-parser@4.5.0";

const allowedOrigins = (() => {
  const raw = Deno.env.get("ALLOWED_ORIGINS") || "";
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) {
    return [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:3000",
    ];
  }
  return list;
})();

const getCorsHeaders = (origin: string | null) => {
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
};

const jsonResponse = (origin: string | null, status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
  });

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  trimValues: true,
});

const safeArray = <T>(value: T | T[] | null | undefined): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const getText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && "text" in (value as any)) return String((value as any).text || "").trim();
  return null;
};

const normalizeDate = (value: string | null) => {
  if (!value) return null;
  if (value.includes("T")) return value.split("T")[0];
  return value;
};

serve(async (req) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return jsonResponse(origin, 405, { error: "Método não permitido" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse(origin, 500, { error: "Configuração do Supabase ausente" });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return jsonResponse(origin, 401, { error: "Token inválido" });

  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: authData, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !authData?.user) return jsonResponse(origin, 401, { error: "Usuário não autenticado" });

  const body = await req.json().catch(() => null) as { xml?: string } | null;
  if (!body?.xml) return jsonResponse(origin, 400, { error: "XML ausente" });

  let parsed: any;
  try {
    parsed = parser.parse(body.xml);
  } catch {
    return jsonResponse(origin, 422, { error: "XML inválido" });
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

  const items = safeArray(det).map((item: any) => {
    const prod = item?.prod || item?.Produto || {};
    const rastros = safeArray(item?.rastro || prod?.rastro || item?.med || prod?.med);
    const rastro = rastros[0] || {};

    return {
      description: getText(prod?.xProd) || "Item importado",
      quantity: Number(getText(prod?.qCom || prod?.qTrib) || 0),
      unit_cost: Number(getText(prod?.vUnCom || prod?.vUnTrib) || 0),
      total_cost: Number(getText(prod?.vProd) || 0),
      barcode: getText(prod?.cEAN || prod?.cEANTrib),
      batch_code: getText(rastro?.nLote || rastro?.lote),
      expiry_date: normalizeDate(getText(rastro?.dVal || rastro?.validade)),
      manufacture_date: normalizeDate(getText(rastro?.dFab || rastro?.fabricacao)),
    };
  });

  return jsonResponse(origin, 200, { invoiceNumber, issueDate, supplierName, supplierCnpj, items });
});
