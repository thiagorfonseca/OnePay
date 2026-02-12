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
        { role: "system", content: "Você é um analista de estoque para clínicas. Gere resumo curto, objetivo e com recomendações." },
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

  const body = await req.json().catch(() => ({})) as { clinic_id?: string };
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

  const [itemsRes, stockRes, consumptionRes, lossRes, purchaseRes] = await Promise.all([
    supabaseAdmin.from("inventory_items").select("id,name,lead_time_days,min_stock,reorder_point").eq("clinic_id", clinicId),
    supabaseAdmin.from("inventory_item_stock").select("item_id,qty_on_hand,stock_value").eq("clinic_id", clinicId),
    supabaseAdmin.from("inventory_monthly_consumption").select("item_id,month,qty_consumed").eq("clinic_id", clinicId),
    supabaseAdmin.from("inventory_monthly_losses").select("item_id,month,qty_lost").eq("clinic_id", clinicId),
    supabaseAdmin.from("inventory_last_purchase").select("item_id,last_unit_cost,avg_unit_cost").eq("clinic_id", clinicId),
  ]);

  if (itemsRes.error || stockRes.error || consumptionRes.error || lossRes.error || purchaseRes.error) {
    return jsonResponse(origin, 500, { error: "Erro ao consultar dados" });
  }

  const items = itemsRes.data || [];
  const stock = stockRes.data || [];
  const consumption = consumptionRes.data || [];
  const losses = lossRes.data || [];
  const purchase = purchaseRes.data || [];

  const stockMap = new Map(stock.map((row) => [row.item_id, row]));

  const criticalItems = items.filter((item) => {
    const qty = stockMap.get(item.id)?.qty_on_hand || 0;
    const min = item.reorder_point ?? item.min_stock ?? 0;
    return min > 0 && qty < min;
  });

  const consumptionTotals = consumption.reduce((acc: Record<string, number>, row) => {
    acc[row.item_id] = (acc[row.item_id] || 0) + (row.qty_consumed || 0);
    return acc;
  }, {});

  const lossTotals = losses.reduce((acc: Record<string, number>, row) => {
    acc[row.item_id] = (acc[row.item_id] || 0) + (row.qty_lost || 0);
    return acc;
  }, {});

  const topConsumed = Object.entries(consumptionTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([itemId, qty]) => ({
      itemId,
      name: items.find((item) => item.id === itemId)?.name || "Item",
      qty,
    }));

  const topLosses = Object.entries(lossTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([itemId, qty]) => ({
      itemId,
      name: items.find((item) => item.id === itemId)?.name || "Item",
      qty,
    }));

  const priceAlerts = purchase
    .filter((row) => row.last_unit_cost && row.avg_unit_cost && row.last_unit_cost > row.avg_unit_cost * 1.15)
    .map((row) => ({
      itemId: row.item_id,
      name: items.find((item) => item.id === row.item_id)?.name || "Item",
      last: row.last_unit_cost,
      avg: row.avg_unit_cost,
    }));

  const payload = {
    criticalItems: criticalItems.map((item) => item.name),
    topConsumed,
    topLosses,
    priceAlerts,
    stockValue: stock.reduce((sum, row) => sum + (row.stock_value || 0), 0),
  };

  const prompt = `Resumo de estoque da clínica.\nItens críticos: ${payload.criticalItems.join(", ") || "nenhum"}.\nItens mais consumidos: ${topConsumed.map((i) => `${i.name} (${i.qty})`).join(", ") || "sem dados"}.\nPerdas recorrentes: ${topLosses.map((i) => `${i.name} (${i.qty})`).join(", ") || "sem perdas"}.\nVariação de preço: ${priceAlerts.map((i) => `${i.name} (último ${i.last}, média ${i.avg})`).join(", ") || "sem alertas"}.\nValor total em estoque: R$ ${payload.stockValue.toFixed(2)}.`;

  const llmSummary = await callLLM(prompt);
  const summary = llmSummary || `Itens críticos: ${payload.criticalItems.join(", ") || "nenhum"}.\nTop consumos: ${topConsumed.map((i) => `${i.name} (${i.qty})`).join(", ") || "sem dados"}.\nPerdas: ${topLosses.map((i) => `${i.name} (${i.qty})`).join(", ") || "sem perdas"}.\nValor em estoque: R$ ${payload.stockValue.toFixed(2)}.`;

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("ai_insights")
    .insert({
      clinic_id: clinicId,
      title: "Resumo de estoque",
      summary,
      data: payload,
      model: llmSummary ? "openai" : "rules",
    })
    .select("*")
    .single();

  if (insertError) return jsonResponse(origin, 500, { error: "Erro ao salvar insight" });

  return jsonResponse(origin, 200, { insight: inserted });
});
