import { z } from 'zod';

export type ConsumptionType = 'whole' | 'fractional';
export type MovementType = 'entry' | 'consumption' | 'loss' | 'adjustment' | 'inventory' | 'transfer';
export type AlertType = 'low_stock' | 'expiry' | 'open_expiry' | 'rupture_risk' | 'price_variation' | 'loss_spike';
export type AlertStatus = 'new' | 'acknowledged' | 'resolved';

export const inventoryItemSchema = z.object({
  clinic_id: z.string().uuid(),
  name: z.string().min(2),
  category: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  default_supplier_id: z.string().uuid().optional().nullable(),
  unit: z.string().min(1),
  consumption_type: z.enum(['whole', 'fractional']),
  package_content: z.number().optional().nullable(),
  rounding_step: z.number().optional().nullable(),
  shelf_life_days: z.number().int().optional().nullable(),
  expires_after_open_hours: z.number().int().optional().nullable(),
  storage_type: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  tax_percent: z.number().optional().nullable(),
  min_stock: z.number().optional().nullable(),
  reorder_point: z.number().optional().nullable(),
  max_stock: z.number().optional().nullable(),
  lead_time_days: z.number().int().optional().nullable(),
});

export const inventoryMovementSchema = z.object({
  clinic_id: z.string().uuid(),
  item_id: z.string().uuid(),
  batch_id: z.string().uuid().optional().nullable(),
  open_container_id: z.string().uuid().optional().nullable(),
  movement_type: z.enum(['entry', 'consumption', 'loss', 'adjustment', 'inventory', 'transfer']),
  qty_delta: z.number(),
  unit_cost: z.number().optional().nullable(),
  reason: z.string().optional().nullable(),
  reference_type: z.string().optional().nullable(),
  reference_id: z.string().uuid().optional().nullable(),
  created_by: z.string().uuid().optional().nullable(),
});

export const purchaseInvoiceItemSchema = z.object({
  item_id: z.string().uuid(),
  description: z.string().optional().nullable(),
  quantity: z.number().positive(),
  unit_cost: z.number().optional().nullable(),
  total_cost: z.number().optional().nullable(),
  batch_code: z.string().optional().nullable(),
  expiry_date: z.string().optional().nullable(),
  manufacture_date: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  received_at: z.string().optional().nullable(),
  batch_notes: z.string().optional().nullable(),
});

export const purchaseInvoiceSchema = z.object({
  clinic_id: z.string().uuid(),
  supplier_id: z.string().uuid().optional().nullable(),
  invoice_number: z.string().optional().nullable(),
  issue_date: z.string().optional().nullable(),
  received_at: z.string().optional().nullable(),
  status: z.enum(['draft', 'posted', 'cancelled']).optional(),
  total_amount: z.number().optional().nullable(),
  tax_amount: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  xml_payload: z.string().optional().nullable(),
  items: z.array(purchaseInvoiceItemSchema).min(1),
});

export type InventoryItemPayload = z.infer<typeof inventoryItemSchema>;
export type InventoryMovementPayload = z.infer<typeof inventoryMovementSchema>;
export type PurchaseInvoicePayload = z.infer<typeof purchaseInvoiceSchema>;

export interface InventoryItem extends InventoryItemPayload {
  id: string;
  avg_cost?: number | null;
  last_cost?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryItemStock {
  item_id: string;
  clinic_id: string;
  qty_on_hand: number;
  stock_value: number;
}

export interface InventoryBatchStock {
  batch_id: string;
  clinic_id: string;
  item_id: string;
  expiry_date: string | null;
  qty_on_hand: number;
}

export interface InventoryOpenContainerStatus {
  id: string;
  clinic_id: string;
  item_id: string;
  batch_id: string | null;
  opened_at: string;
  expires_at: string | null;
  total_qty: number;
  remaining_qty: number;
}

export interface InventoryAlert {
  id: string;
  clinic_id: string;
  item_id?: string | null;
  batch_id?: string | null;
  open_container_id?: string | null;
  alert_type: AlertType;
  severity: 'info' | 'warning' | 'critical';
  status: AlertStatus;
  message: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface InventoryInsight {
  id: string;
  clinic_id: string;
  period_start: string | null;
  period_end: string | null;
  title: string | null;
  summary: string;
  data: Record<string, unknown> | null;
  created_at: string;
}

export interface ParsedNfeItem {
  description: string;
  quantity: number;
  unit_cost?: number | null;
  total_cost?: number | null;
  barcode?: string | null;
  batch_code?: string | null;
  expiry_date?: string | null;
  manufacture_date?: string | null;
}

export interface ParsedNfe {
  invoiceNumber?: string | null;
  issueDate?: string | null;
  supplierName?: string | null;
  supplierCnpj?: string | null;
  items: ParsedNfeItem[];
}
