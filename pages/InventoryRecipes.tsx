import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import SectionHeader from '../components/inventory/SectionHeader';
import DataTable from '../components/inventory/DataTable';
import ItemPicker from '../components/inventory/ItemPicker';
import { useAuth } from '../src/auth/AuthProvider';
import { createRecipe, listInventoryItems, listRecipes } from '../src/lib/inventory/service';

const InventoryRecipes: React.FC = () => {
  const { effectiveClinicId, user } = useAuth();
  const clinicId = effectiveClinicId;
  const [recipes, setRecipes] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [lines, setLines] = useState<Array<{ item_id: string; quantity: number }>>([{ item_id: '', quantity: 1 }]);

  const loadData = async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const [recipesData, itemsData] = await Promise.all([listRecipes(clinicId), listInventoryItems(clinicId)]);
      setRecipes(recipesData);
      setItems(itemsData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [clinicId]);

  const addLine = () => setLines([...lines, { item_id: '', quantity: 1 }]);

  const saveRecipe = async () => {
    if (!clinicId || !user || !name.trim()) return;
    await createRecipe(
      { clinic_id: clinicId, name, created_by: user.id },
      lines.filter((line) => line.item_id)
    );
    setModalOpen(false);
    setName('');
    setLines([{ item_id: '', quantity: 1 }]);
    await loadData();
  };

  const columns = useMemo(
    () => [
      { header: 'Receita', accessorKey: 'name' },
      { header: 'Itens', accessorKey: 'procedure_recipe_lines', cell: ({ row }: any) => row.original.procedure_recipe_lines?.length || 0 },
      { header: 'Criado em', accessorKey: 'created_at', cell: ({ row }: any) => new Date(row.original.created_at).toLocaleDateString('pt-BR') },
    ],
    [recipes]
  );

  if (!clinicId) return null;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Receitas de Procedimento"
        subtitle="Defina BOMs para automação futura de consumo." 
        actions={
          <button className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm text-white" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Nova receita
          </button>
        }
      />

      {loading ? <div className="text-sm text-gray-500">Carregando receitas...</div> : <DataTable data={recipes} columns={columns as any} />}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Nova receita</h3>
                <p className="text-sm text-gray-500">Associe itens e quantidades padrão.</p>
              </div>
              <button className="rounded-full p-2 hover:bg-gray-100" onClick={() => setModalOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600">Nome</label>
                <input className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div className="space-y-3">
                {lines.map((line, index) => (
                  <div key={index} className="grid gap-3 rounded-lg border border-gray-200 p-3 md:grid-cols-4">
                    <div className="md:col-span-3">
                      <label className="text-xs text-gray-600">Item</label>
                      <ItemPicker
                        items={items}
                        value={line.item_id}
                        onChange={(value) => {
                          const next = [...lines];
                          next[index].item_id = value;
                          setLines(next);
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Quantidade</label>
                      <input
                        type="number"
                        step="0.01"
                        className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                        value={line.quantity}
                        onChange={(e) => {
                          const next = [...lines];
                          next[index].quantity = Number(e.target.value || 0);
                          setLines(next);
                        }}
                      />
                    </div>
                  </div>
                ))}
                <button className="rounded-md border border-gray-200 px-3 py-2 text-xs" onClick={addLine}>
                  Adicionar item
                </button>
              </div>

              <div className="flex justify-end gap-2">
                <button className="rounded-md border border-gray-200 px-4 py-2 text-sm" onClick={() => setModalOpen(false)}>
                  Cancelar
                </button>
                <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white" onClick={saveRecipe}>
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default InventoryRecipes;
