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

const parseThresholds = () => {
  const raw = Deno.env.get("ALERT_THRESHOLDS") || "";
  if (!raw) return {} as Record<string, number>;
  try {
    return JSON.parse(raw);
  } catch {
    return {} as Record<string, number>;
  }
};

const buildAlertsForClinic = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  clinicId: string,
  thresholds: Record<string, number>
) => {
  const [itemsRes, stockRes, batchRes, containerRes, rulesRes, alertsRes, movementsRes, purchaseRes] = await Promise.all([
    supabaseAdmin.from("inventory_items").select("id,name,min_stock,reorder_point,lead_time_days").eq("clinic_id", clinicId),
    supabaseAdmin.from("inventory_item_stock").select("item_id,qty_on_hand").eq("clinic_id", clinicId),
    supabaseAdmin.from("inventory_batch_stock").select("batch_id,item_id,expiry_date,qty_on_hand").eq("clinic_id", clinicId),
    supabaseAdmin.from("inventory_open_container_status").select("id,item_id,expires_at,remaining_qty").eq("clinic_id", clinicId),
    supabaseAdmin
      .from("stock_rules")
      .select("item_id,min_stock,reorder_point,lead_time_days,expiry_alert_days,open_expiry_alert_hours,price_variation_percent,loss_spike_zscore")
      .eq("clinic_id", clinicId),
    supabaseAdmin
      .from("alerts")
      .select("alert_type,item_id,batch_id,open_container_id,status")
      .eq("clinic_id", clinicId)
      .in("status", ["new", "acknowledged"]),
    supabaseAdmin
      .from("inventory_movements")
      .select("item_id,movement_type,qty_delta,created_at")
      .eq("clinic_id", clinicId)
      .gte("created_at", new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString()),
    supabaseAdmin.from("inventory_last_purchase").select("item_id,last_unit_cost,avg_unit_cost").eq("clinic_id", clinicId),
  ]);

  if (itemsRes.error || stockRes.error || batchRes.error || containerRes.error || rulesRes.error || alertsRes.error || movementsRes.error || purchaseRes.error) {
    throw new Error("Erro ao consultar dados");
  }

  const items = itemsRes.data || [];
  const stock = stockRes.data || [];
  const batches = batchRes.data || [];
  const containers = containerRes.data || [];
  const rules = rulesRes.data || [];
  const existingAlerts = alertsRes.data || [];
  const movements = movementsRes.data || [];
  const purchases = purchaseRes.data || [];

  const stockByItem = new Map(stock.map((row) => [row.item_id, row.qty_on_hand || 0]));
  const ruleByItem = new Map(rules.map((row) => [row.item_id, row]));

  const openKey = (type: string, itemId?: string | null, batchId?: string | null, containerId?: string | null) =>
    `${type}::${itemId || ""}::${batchId || ""}::${containerId || ""}`;

  const existingKeys = new Set(existingAlerts.map((alert) => openKey(alert.alert_type, alert.item_id, alert.batch_id, alert.open_container_id)));

  const toInsert: Array<Record<string, any>> = [];

  // Low stock
  items.forEach((item) => {
    const rule = ruleByItem.get(item.id) || {};
    const min = rule.min_stock ?? item.min_stock ?? 0;
    const reorder = rule.reorder_point ?? item.reorder_point ?? min;
    const threshold = reorder || min;
    const qty = stockByItem.get(item.id) || 0;
    if (threshold > 0 && qty < threshold) {
      const key = openKey("low_stock", item.id);
      if (!existingKeys.has(key)) {
        toInsert.push({
          clinic_id: clinicId,
          item_id: item.id,
          alert_type: "low_stock",
          severity: qty <= min ? "critical" : "warning",
          status: "new",
          message: `Estoque baixo para ${item.name} (saldo ${qty}).`,
        });
      }
    }
  });

  // Expiry (batches)
  const now = Date.now();
  batches.forEach((batch) => {
    if (!batch.expiry_date || (batch.qty_on_hand ?? 0) <= 0) return;
    const itemRule = ruleByItem.get(batch.item_id) || {};
    const days = itemRule.expiry_alert_days ?? thresholds.expiryDays;
    const diffDays = (new Date(batch.expiry_date).getTime() - now) / (1000 * 60 * 60 * 24);
    if (diffDays <= days) {
      const key = openKey("expiry", batch.item_id, batch.batch_id);
      if (!existingKeys.has(key)) {
        toInsert.push({
          clinic_id: clinicId,
          item_id: batch.item_id,
          batch_id: batch.batch_id,
          alert_type: "expiry",
          severity: diffDays <= 7 ? "critical" : "warning",
          status: "new",
          message: `Lote vencendo em ${Math.ceil(diffDays)} dias.`,
          metadata: { expiry_date: batch.expiry_date },
        });
      }
    }
  });

  // Open container expiry
  containers.forEach((container) => {
    if (!container.expires_at || (container.remaining_qty ?? 0) <= 0) return;
    const itemRule = ruleByItem.get(container.item_id) || {};
    const hours = itemRule.open_expiry_alert_hours ?? thresholds.openExpiryHours;
    const diffHours = (new Date(container.expires_at).getTime() - now) / (1000 * 60 * 60);
    if (diffHours <= hours) {
      const key = openKey("open_expiry", container.item_id, null, container.id);
      if (!existingKeys.has(key)) {
        toInsert.push({
          clinic_id: clinicId,
          item_id: container.item_id,
          open_container_id: container.id,
          alert_type: "open_expiry",
          severity: diffHours <= 4 ? "critical" : "warning",
          status: "new",
          message: `Frasco aberto expirando em ${Math.ceil(diffHours)}h.`,
          metadata: { expires_at: container.expires_at },
        });
      }
    }
  });

  // Price variation
  purchases.forEach((row) => {
    if (!row.last_unit_cost || !row.avg_unit_cost) return;
    const itemRule = ruleByItem.get(row.item_id) || {};
    const pct = itemRule.price_variation_percent ?? thresholds.priceVariationPercent;
    if (row.last_unit_cost > row.avg_unit_cost * (1 + pct)) {
      const key = openKey("price_variation", row.item_id);
      if (!existingKeys.has(key)) {
        toInsert.push({
          clinic_id: clinicId,
          item_id: row.item_id,
          alert_type: "price_variation",
          severity: "info",
          status: "new",
          message: `Preço recente acima da média (${Math.round(pct * 100)}%).`,
          metadata: { last: row.last_unit_cost, avg: row.avg_unit_cost },
        });
      }
    }
  });

  // Consumption & rupture risk
  const lookbackDays = thresholds.ruptureLookbackDays;
  const cutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
  const consumptionByItem = new Map<string, number>();
  const lossLast30ByItem = new Map<string, number>();
  const lossPrev90ByItem = new Map<string, number>();
  const lossCutoff30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const lossCutoff120 = Date.now() - 120 * 24 * 60 * 60 * 1000;

  movements.forEach((mov) => {
    const createdAt = new Date(mov.created_at).getTime();
    if (mov.movement_type === "consumption" && createdAt >= cutoff) {
      const current = consumptionByItem.get(mov.item_id) || 0;
      consumptionByItem.set(mov.item_id, current + Math.abs(Number(mov.qty_delta || 0)));
    }
    if (mov.movement_type === "loss") {
      const qty = Math.abs(Number(mov.qty_delta || 0));
      if (createdAt >= lossCutoff30) {
        const current = lossLast30ByItem.get(mov.item_id) || 0;
        lossLast30ByItem.set(mov.item_id, current + qty);
      } else if (createdAt >= lossCutoff120) {
        const current = lossPrev90ByItem.get(mov.item_id) || 0;
        lossPrev90ByItem.set(mov.item_id, current + qty);
      }
    }
  });

  items.forEach((item) => {
    const qty = stockByItem.get(item.id) || 0;
    const consumed = consumptionByItem.get(item.id) || 0;
    const avgDaily = consumed / Math.max(1, lookbackDays);
    const leadTime = ruleByItem.get(item.id)?.lead_time_days ?? item.lead_time_days ?? 0;
    if (leadTime > 0 && avgDaily * leadTime > qty) {
      const key = openKey("rupture_risk", item.id);
      if (!existingKeys.has(key)) {
        toInsert.push({
          clinic_id: clinicId,
          item_id: item.id,
          alert_type: "rupture_risk",
          severity: "warning",
          status: "new",
          message: `Risco de ruptura em ${leadTime} dias (consumo médio ${avgDaily.toFixed(2)}).`,
          metadata: { lead_time_days: leadTime, avg_daily: avgDaily },
        });
      }
    }
  });

  // Loss spike (last 30 vs avg previous 90)
  items.forEach((item) => {
    const last30 = lossLast30ByItem.get(item.id) || 0;
    const prev90 = lossPrev90ByItem.get(item.id) || 0;
    if (last30 <= 0 || prev90 <= 0) return;
    const avgPrev = prev90 / 3;
    const key = openKey("loss_spike", item.id);
    if (!existingKeys.has(key) && last30 > avgPrev * thresholds.lossSpikeMultiplier) {
      toInsert.push({
        clinic_id: clinicId,
        item_id: item.id,
        alert_type: "loss_spike",
        severity: "warning",
        status: "new",
        message: `Perdas acima do normal para ${item.name}.`,
        metadata: { last30, avgPrev },
      });
    }
  });

  if (toInsert.length) {
    const { error } = await supabaseAdmin.from("alerts").insert(toInsert);
    if (error) throw new Error("Erro ao inserir alertas");
  }

  return toInsert.length;
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

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const isServiceRole = token === supabaseServiceKey;

  const body = await req.json().catch(() => ({})) as { clinic_id?: string };
  let clinicIds: string[] = [];

  if (isServiceRole) {
    if (body?.clinic_id) {
      clinicIds = [body.clinic_id];
    } else {
      const { data: clinics, error } = await supabaseAdmin.from("clinics").select("id").eq("ativo", true);
      if (error) return jsonResponse(origin, 500, { error: "Erro ao carregar clínicas" });
      clinicIds = (clinics || []).map((c) => c.id);
    }
  } else {
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: authData, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !authData?.user) return jsonResponse(origin, 401, { error: "Usuário não autenticado" });

    let clinicId = body?.clinic_id || null;
    const { data: isSystemAdmin } = await supabaseUser.rpc("is_system_admin");

    if (clinicId) {
      const { data: isMember } = await supabaseUser.rpc("is_clinic_member", { p_clinic_id: clinicId });
      if (!isMember && !isSystemAdmin) {
        return jsonResponse(origin, 403, { error: "Sem acesso à clínica" });
      }
    } else {
      const { data: currentClinicId } = await supabaseUser.rpc("current_clinic_id");
      clinicId = currentClinicId || null;
    }

    if (!clinicId) return jsonResponse(origin, 400, { error: "clinic_id não encontrado" });
    clinicIds = [clinicId];
  }

  const thresholds = {
    expiryDays: 30,
    openExpiryHours: 24,
    priceVariationPercent: 0.2,
    lossSpikeMultiplier: 1.5,
    ruptureLookbackDays: 30,
    ...parseThresholds(),
  };

  try {
    let inserted = 0;
    for (const clinicId of clinicIds) {
      inserted += await buildAlertsForClinic(supabaseAdmin, clinicId, thresholds);
    }
    return jsonResponse(origin, 200, { inserted, clinics: clinicIds.length });
  } catch (error) {
    return jsonResponse(origin, 500, { error: (error as Error).message || "Erro ao gerar alertas" });
  }
});
