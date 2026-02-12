import { serve } from "https://deno.land/std@0.204.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.2";

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

const callLLM = async (prompt: string) => {
  const apiKey = Deno.env.get("AI_PROVIDER_API_KEY") || Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return null;
  const model = Deno.env.get("AI_MODEL") || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: "Você é um assistente de estoque para clínicas. Responda com recomendações objetivas." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || null;
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
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    return jsonResponse(origin, 500, { error: "Configuração do Supabase ausente" });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return jsonResponse(origin, 401, { error: "Token inválido" });

  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: authData, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !authData?.user) return jsonResponse(origin, 401, { error: "Usuário não autenticado" });

  const body = await req.json().catch(() => ({})) as { clinic_id?: string; question?: string };
  const question = body?.question?.trim() || "";
  if (!question) return jsonResponse(origin, 400, { error: "Pergunta ausente" });

  let clinicId = body?.clinic_id || null;
  const { data: isSystemAdmin } = await supabaseUser.rpc("is_system_admin");
  if (clinicId) {
    const { data: isMember } = await supabaseUser.rpc("is_clinic_member", { p_clinic_id: clinicId });
    if (!isMember && !isSystemAdmin) return jsonResponse(origin, 403, { error: "Sem acesso à clínica" });
  } else {
    const { data: currentClinicId } = await supabaseUser.rpc("current_clinic_id");
    clinicId = currentClinicId || null;
  }

  if (!clinicId) return jsonResponse(origin, 400, { error: "clinic_id não encontrado" });

  const [alertsRes, stockRes, batchesRes] = await Promise.all([
    supabaseAdmin.from("alerts").select("alert_type,message,status").eq("clinic_id", clinicId).in("status", ["new", "acknowledged"]),
    supabaseAdmin.from("inventory_item_stock").select("item_id,qty_on_hand").eq("clinic_id", clinicId),
    supabaseAdmin.from("inventory_batch_stock").select("item_id,expiry_date,qty_on_hand").eq("clinic_id", clinicId),
  ]);

  const alerts = alertsRes.data || [];
  const stock = stockRes.data || [];
  const batches = batchesRes.data || [];

  const expiring = batches.filter((batch) => batch.expiry_date && (batch.qty_on_hand ?? 0) > 0);
  expiring.sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());

  const context = {
    totalAlerts: alerts.length,
    topAlerts: alerts.slice(0, 5).map((a) => a.message),
    expiringSoon: expiring.slice(0, 5),
    stockSnapshot: stock.slice(0, 5),
  };

  const prompt = `Pergunta: ${question}\nContexto de estoque: ${JSON.stringify(context)}`;
  const llmAnswer = await callLLM(prompt);
  const answer = llmAnswer || `Alertas ativos: ${context.totalAlerts}. Principais: ${context.topAlerts.join(" | ") || "sem alertas"}.`;

  await supabaseAdmin.from("ai_chat_logs").insert({
    clinic_id: clinicId,
    question,
    response_text: answer,
    result_json: context,
    tool_called: "inventory-assistant",
    user_id: authData.user.id,
  });

  return jsonResponse(origin, 200, { answer });
});
