import React, { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Plus, X } from 'lucide-react';
import SectionHeader from '../components/inventory/SectionHeader';
import DataTable from '../components/inventory/DataTable';
import ItemPicker from '../components/inventory/ItemPicker';
import { useAuth } from '../src/auth/AuthProvider';
import {
  createPurchaseInvoice,
  listInventoryItems,
  listItemBarcodes,
  listPurchaseInvoices,
  listSuppliers,
  uploadInvoiceFile,
} from '../src/lib/inventory/service';
import { parseNfeXml } from '../src/lib/inventory/nfeParser';
import type { InventoryItem, ParsedNfeItem, PurchaseInvoicePayload } from '../src/lib/inventory/types';
import { normalizeText } from '../src/lib/inventory/utils';

interface PurchaseInvoiceForm {
  supplier_id?: string | null;
  invoice_number?: string | null;
  issue_date?: string | null;
  received_at?: string | null;
  notes?: string | null;
  items: Array<{
    item_id: string;
    description?: string | null;
    quantity: number;
    unit_cost?: number | null;
    total_cost?: number | null;
    batch_code?: string | null;
    expiry_date?: string | null;
    barcode?: string | null;
  }>;
}

const InventoryPurchases: React.FC = () => {
  const { effectiveClinicId, session } = useAuth();
  const clinicId = effectiveClinicId;
  const [invoices, setInvoices] = useState<any[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [barcodeMap, setBarcodeMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSource, setParseSource] = useState<string | null>(null);

  const { control, register, handleSubmit, reset, setValue, getValues } = useForm<PurchaseInvoiceForm>({
    defaultValues: {
      items: [{ item_id: '', quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const loadData = async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const [invoiceData, itemData, supplierData, barcodeData] = await Promise.all([
        listPurchaseInvoices(clinicId),
        listInventoryItems(clinicId),
        listSuppliers(clinicId),
        listItemBarcodes(clinicId),
      ]);
      setInvoices(invoiceData);
      setItems(itemData);
      setSuppliers(supplierData);
      const map: Record<string, string> = {};
      barcodeData.forEach((row: any) => {
        const normalized = String(row.barcode || '').replace(/\D/g, '');
        if (normalized) map[normalized] = row.item_id;
      });
      setBarcodeMap(map);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [clinicId]);

  const onSubmit = async (values: PurchaseInvoiceForm) => {
    if (!clinicId) return;
    const payload: PurchaseInvoicePayload = {
      clinic_id: clinicId,
      supplier_id: values.supplier_id || null,
      invoice_number: values.invoice_number || null,
      issue_date: values.issue_date || null,
      received_at: values.received_at || null,
      notes: values.notes || null,
      status: 'posted',
      items: values.items.map((item) => ({
        item_id: item.item_id,
        description: item.description,
        quantity: Number(item.quantity || 0),
        unit_cost: item.unit_cost ? Number(item.unit_cost) : null,
        total_cost: item.total_cost ? Number(item.total_cost) : null,
        batch_code: item.batch_code || null,
        expiry_date: item.expiry_date || null,
        barcode: item.barcode || null,
      })),
    };

    const invoiceId = await createPurchaseInvoice(payload);
    if (uploadFile) {
      await uploadInvoiceFile(clinicId, invoiceId, uploadFile);
    }
    setModalOpen(false);
    setUploadFile(null);
    reset({ items: [{ item_id: '', quantity: 1 }] });
    await loadData();
  };

  const handleXmlFile = async (file: File) => {
    setParseError(null);
    setParseSource(null);
    const text = await file.text();
    let parsed: any = null;

    if (session?.access_token) {
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/inventory-parse-nfe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ xml: text }),
        });
        if (response.ok) {
          parsed = await response.json();
          setParseSource('Servidor');
        }
      } catch {
        parsed = null;
      }
    }

    if (!parsed) {
      parsed = parseNfeXml(text);
      setParseSource('Local');
    }

    if (parsed.invoiceNumber) setValue('invoice_number', parsed.invoiceNumber);
    if (parsed.issueDate) setValue('issue_date', parsed.issueDate);

    if (parsed.supplierCnpj) {
      const normalizedCnpj = String(parsed.supplierCnpj).replace(/\D/g, '');
      const matched = suppliers.find((sup) => String(sup.cnpj || '').replace(/\D/g, '') === normalizedCnpj);
      if (matched) setValue('supplier_id', matched.id);
    } else if (parsed.supplierName) {
      const normalizedName = normalizeText(parsed.supplierName);
      if (normalizedName.length >= 3) {
        const matched = suppliers.find((sup) => normalizeText(sup.nome || '').includes(normalizedName));
        if (matched) setValue('supplier_id', matched.id);
      }
    }

    if (parsed.items.length) {
      const current = getValues();
      reset({
        ...current,
        items: parsed.items.map((item: ParsedNfeItem) => ({
          item_id: (() => {
            if (item.barcode) {
              const normalizedBarcode = String(item.barcode).replace(/\D/g, '');
              if (normalizedBarcode && barcodeMap[normalizedBarcode]) return barcodeMap[normalizedBarcode];
            }
            if (item.description) {
              const desc = normalizeText(item.description);
              if (desc.length >= 3) {
                const match = items.find((it) => {
                  const name = normalizeText(it.name);
                  return desc.includes(name) || name.includes(desc);
                });
                return match?.id || '';
              }
            }
            return '';
          })(),
          description: item.description,
          quantity: item.quantity,
          unit_cost:
            item.unit_cost || (item.total_cost && item.quantity ? Number(item.total_cost) / Number(item.quantity) : undefined),
          total_cost: item.total_cost || undefined,
          batch_code: item.batch_code || undefined,
          expiry_date: item.expiry_date || undefined,
          barcode: item.barcode || undefined,
        })),
      });
    } else {
      setParseError('Não foi possível interpretar itens do XML. Preencha manualmente.');
    }
  };

  const columns = useMemo(
    () => [
      { header: 'Nota', accessorKey: 'invoice_number', cell: ({ row }: any) => row.original.invoice_number || '—' },
      { header: 'Fornecedor', accessorKey: 'supplier_id', cell: ({ row }: any) => row.original.suppliers?.nome || '—' },
      { header: 'Data', accessorKey: 'issue_date', cell: ({ row }: any) => row.original.issue_date || '—' },
      { header: 'Itens', accessorKey: 'items', cell: ({ row }: any) => row.original.purchase_invoice_items?.length || 0 },
    ],
    [invoices]
  );

  if (!clinicId) return null;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Compras e Notas de Entrada"
        subtitle="Registre notas fiscais, lote e validade para abastecer o estoque automaticamente."
        actions={
          <button
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm text-white"
            onClick={() => setModalOpen(true)}
          >
            <Plus className="h-4 w-4" /> Nova entrada
          </button>
        }
      />

      {loading ? <div className="text-sm text-gray-500">Carregando notas...</div> : <DataTable data={invoices} columns={columns as any} />}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Nova nota de entrada</h3>
                <p className="text-sm text-gray-500">Preencha manualmente ou importe XML da NF-e.</p>
              </div>
              <button className="rounded-full p-2 hover:bg-gray-100" onClick={() => setModalOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Fornecedor</label>
                  <select className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" {...register('supplier_id')}>
                    <option value="">Selecione</option>
                    {suppliers.map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Número da nota</label>
                  <input className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" {...register('invoice_number')} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Data de emissão</label>
                  <input type="date" className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" {...register('issue_date')} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-gray-600">Anexar PDF/Imagem</label>
                  <input
                    type="file"
                    className="mt-1 w-full text-sm"
                    onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Importar XML NF-e</label>
                  <input
                    type="file"
                    accept=".xml"
                    className="mt-1 w-full text-sm"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) handleXmlFile(file);
                    }}
                  />
                  {parseSource ? <p className="mt-1 text-xs text-gray-500">Parser: {parseSource}</p> : null}
                  {parseError ? <p className="mt-1 text-xs text-rose-500">{parseError}</p> : null}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-700">Itens da nota</h4>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-1 text-xs"
                    onClick={() => append({ item_id: '', quantity: 1 })}
                  >
                    <Plus className="h-3 w-3" /> Adicionar item
                  </button>
                </div>

                <div className="mt-3 space-y-3">
                  {fields.map((field, index) => (
                    <div key={field.id} className="grid gap-3 rounded-lg border border-gray-200 p-3 md:grid-cols-6">
                      <div className="md:col-span-2">
                        <label className="text-xs text-gray-600">Item</label>
                        <input type="hidden" {...register(`items.${index}.item_id` as const)} />
                        <ItemPicker
                          items={items}
                          value={field.item_id}
                          onChange={(value) => setValue(`items.${index}.item_id`, value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Qtd</label>
                        <input
                          type="number"
                          step="0.01"
                          className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                          {...register(`items.${index}.quantity` as const, { valueAsNumber: true })}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Custo unitário</label>
                        <input
                          type="number"
                          step="0.01"
                          className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                          {...register(`items.${index}.unit_cost` as const, { valueAsNumber: true })}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Lote</label>
                        <input className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" {...register(`items.${index}.batch_code` as const)} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Validade</label>
                        <input type="date" className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" {...register(`items.${index}.expiry_date` as const)} />
                      </div>
                      <div className="md:col-span-5">
                        <label className="text-xs text-gray-600">Descrição</label>
                        <input className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" {...register(`items.${index}.description` as const)} />
                      </div>
                      <div className="flex items-end">
                        <button type="button" className="rounded-md border border-red-200 px-3 py-2 text-xs text-red-600" onClick={() => remove(index)}>
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" className="rounded-md border border-gray-200 px-4 py-2 text-sm" onClick={() => setModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white">
                  Salvar entrada
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default InventoryPurchases;
