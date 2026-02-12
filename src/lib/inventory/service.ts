import { supabase } from '../../../lib/supabase';
import type {
  InventoryItem,
  InventoryItemPayload,
  InventoryItemStock,
  InventoryBatchStock,
  InventoryOpenContainerStatus,
  InventoryAlert,
  InventoryInsight,
  PurchaseInvoicePayload,
  InventoryMovementPayload,
} from './types';

const client = supabase as any;

export const listInventoryItems = async (clinicId: string) => {
  const { data, error } = await client
    .from('inventory_items')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []) as InventoryItem[];
};

export const createInventoryItem = async (payload: InventoryItemPayload) => {
  const { data, error } = await client
    .from('inventory_items')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data as InventoryItem;
};

export const updateInventoryItem = async (id: string, payload: Partial<InventoryItemPayload>) => {
  const { data, error } = await client
    .from('inventory_items')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as InventoryItem;
};

export const deleteInventoryItem = async (id: string) => {
  const { error } = await client
    .from('inventory_items')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

export const listSuppliers = async (clinicId: string) => {
  const { data, error } = await client
    .from('suppliers')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('nome', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const listItemBarcodes = async (clinicId: string) => {
  const { data, error } = await client
    .from('inventory_item_barcodes')
    .select('item_id, barcode')
    .eq('clinic_id', clinicId);
  if (error) throw error;
  return data || [];
};

export const upsertSupplier = async (payload: Record<string, any>) => {
  const { data, error } = await client
    .from('suppliers')
    .upsert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data;
};

export const deleteSupplier = async (id: string) => {
  const { error } = await client.from('suppliers').delete().eq('id', id);
  if (error) throw error;
};

export const listItemStock = async (clinicId: string) => {
  const { data, error } = await client
    .from('inventory_item_stock')
    .select('*')
    .eq('clinic_id', clinicId);
  if (error) throw error;
  return (data || []) as InventoryItemStock[];
};

export const listBatchStock = async (clinicId: string) => {
  const { data, error } = await client
    .from('inventory_batch_stock')
    .select('*')
    .eq('clinic_id', clinicId);
  if (error) throw error;
  return (data || []) as InventoryBatchStock[];
};

export const listOpenContainers = async (clinicId: string) => {
  const { data, error } = await client
    .from('inventory_open_container_status')
    .select('*')
    .eq('clinic_id', clinicId);
  if (error) throw error;
  return (data || []) as InventoryOpenContainerStatus[];
};

export const listMovements = async (clinicId: string, limit = 200) => {
  const { data, error } = await client
    .from('inventory_movements')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
};

export const listInventoryCounts = async (clinicId: string) => {
  const { data, error } = await client
    .from('inventory_counts')
    .select('*, inventory_count_lines(*)')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createInventoryCount = async (payload: Record<string, any>) => {
  const { data, error } = await client
    .from('inventory_counts')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data;
};

export const addInventoryCountLines = async (lines: Record<string, any>[]) => {
  const { data, error } = await client
    .from('inventory_count_lines')
    .insert(lines)
    .select('*');
  if (error) throw error;
  return data || [];
};

export const submitInventoryCount = async (countId: string) => {
  const { data, error } = await client
    .from('inventory_counts')
    .update({ status: 'submitted' })
    .eq('id', countId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
};

export const approveInventoryCount = async (countId: string) => {
  const { data, error } = await client.rpc('apply_inventory_count', { p_count_id: countId });
  if (error) throw error;
  return data;
};

export const createMovement = async (payload: InventoryMovementPayload) => {
  const { data, error } = await client
    .from('inventory_movements')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data;
};

export const openContainer = async (payload: Record<string, any>) => {
  const { data, error } = await client
    .from('inventory_open_containers')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data;
};

export const createPurchaseInvoice = async (payload: PurchaseInvoicePayload) => {
  const { data, error } = await client.rpc('create_purchase_invoice', { p_payload: payload });
  if (error) throw error;
  return data as string;
};

export const listPurchaseInvoices = async (clinicId: string, limit = 50) => {
  const { data, error } = await client
    .from('purchase_invoices')
    .select('*, suppliers (nome), purchase_invoice_items(*)')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
};

export const uploadInvoiceFile = async (clinicId: string, invoiceId: string, file: File) => {
  const path = `clinics/${clinicId}/invoices/${invoiceId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage
    .from('inventory-docs')
    .upload(path, file, { upsert: false });
  if (error) throw error;
  const { data, error: insertError } = await client
    .from('purchase_invoice_files')
    .insert({ clinic_id: clinicId, invoice_id: invoiceId, file_path: path, file_type: file.type, file_size: file.size })
    .select('*')
    .single();
  if (insertError) throw insertError;
  return data;
};

export const listAlerts = async (clinicId: string) => {
  const { data, error } = await client
    .from('alerts')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as InventoryAlert[];
};

export const updateAlertStatus = async (id: string, status: string) => {
  const { data, error } = await client
    .from('alerts')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as InventoryAlert;
};

export const listInsights = async (clinicId: string) => {
  const { data, error } = await client
    .from('ai_insights')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as InventoryInsight[];
};

export const listRecipes = async (clinicId: string) => {
  const { data, error } = await client
    .from('procedure_recipes')
    .select('*, procedure_recipe_lines(*)')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createRecipe = async (payload: Record<string, any>, lines: Record<string, any>[]) => {
  const { data, error } = await client
    .from('procedure_recipes')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  const recipe = data;
  if (lines.length) {
    const rows = lines.map((line) => ({ ...line, recipe_id: recipe.id, clinic_id: recipe.clinic_id }));
    const { error: linesError } = await client.from('procedure_recipe_lines').insert(rows);
    if (linesError) throw linesError;
  }
  return recipe;
};

export const searchItemByBarcode = async (clinicId: string, barcode: string) => {
  const { data, error } = await client
    .from('inventory_item_barcodes')
    .select('*, inventory_items(*)')
    .eq('clinic_id', clinicId)
    .eq('barcode', barcode)
    .maybeSingle();
  if (error) throw error;
  return data;
};
