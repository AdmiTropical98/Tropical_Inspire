import { useEffect, useState } from 'react';
import { ArrowLeftRight, Plus, TrendingDown, TrendingUp, X } from 'lucide-react';
import {
  createMovement,
  getMovements,
  getMaterials,
  type InventoryMovement,
  type InventoryMaterial,
} from '../../../services/inventoryService';

type FilterType = '' | InventoryMovement['movement_type'];

const TYPE_CONFIG: Record<InventoryMovement['movement_type'], { label: string; color: string; Icon: React.ElementType }> = {
  entry: { label: 'Entrada', color: 'bg-emerald-100 text-emerald-700', Icon: TrendingUp },
  exit: { label: 'Saída', color: 'bg-rose-100 text-rose-700', Icon: TrendingDown },
  transfer: { label: 'Transferência', color: 'bg-amber-100 text-amber-700', Icon: ArrowLeftRight },
};

export default function Movimentos() {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [materials, setMaterials] = useState<InventoryMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<{ movement_type: InventoryMovement['movement_type']; material_id: string; quantity: number; notes: string }>({
    movement_type: 'entry', material_id: '', quantity: 1, notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function load() {
    setLoading(true);
    const [movs, mats] = await Promise.all([getMovements(), getMaterials()]).catch(() => [[], []]);
    setMovements(movs as InventoryMovement[]);
    setMaterials(mats as InventoryMaterial[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function handleSave() {
    if (!form.material_id) { setFormError('Selecione um material.'); return; }
    if (form.quantity <= 0) { setFormError('A quantidade deve ser maior que zero.'); return; }
    setSaving(true); setFormError('');
    try {
      await createMovement({
        movement_type: form.movement_type,
        material_id: form.material_id,
        quantity: form.quantity,
        notes: form.notes.trim() || undefined,
      });
      setModalOpen(false);
      setForm({ movement_type: 'entry', material_id: '', quantity: 1, notes: '' });
      await load();
    } catch (err: unknown) { setFormError((err as Error).message || 'Erro ao registar.'); }
    setSaving(false);
  }

  const filtered = filterType ? movements.filter((m) => m.movement_type === filterType) : movements;
  const matName = (id?: string) => materials.find((m) => m.id === id)?.name ?? '—';

  const totals = {
    entry: movements.filter((m) => m.movement_type === 'entry').length,
    exit: movements.filter((m) => m.movement_type === 'exit').length,
    transfer: movements.filter((m) => m.movement_type === 'transfer').length,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-black tracking-tight text-slate-900">Movimentos</h2>
          <p className="text-sm text-slate-500 mt-0.5">Histórico de entradas, saídas e transferências</p>
        </div>
        <button type="button" onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700">
          <Plus className="h-4 w-4" />Registar Movimento
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {(Object.entries(totals) as [InventoryMovement['movement_type'], number][]).map(([type, count]) => {
          const cfg = TYPE_CONFIG[type];
          const Icon = cfg.Icon;
          return (
            <article key={type} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4 text-slate-500" />
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{cfg.label}s</p>
              </div>
              <p className="text-2xl font-black text-slate-900">{count}</p>
            </article>
          );
        })}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {([['', 'Todos'], ['entry', 'Entradas'], ['exit', 'Saídas'], ['transfer', 'Transferências']] as [FilterType, string][]).map(([val, label]) => (
          <button key={val} type="button" onClick={() => setFilterType(val)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${filterType === val ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">A carregar movimentos...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <ArrowLeftRight className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm font-semibold text-slate-500">Nenhum movimento registado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                  <th className="px-5 py-3 text-left font-bold">Tipo</th>
                  <th className="px-5 py-3 text-left font-bold">Material</th>
                  <th className="px-5 py-3 text-right font-bold">Qtd</th>
                  <th className="px-5 py-3 text-left font-bold">Notas</th>
                  <th className="px-5 py-3 text-left font-bold">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((mov) => {
                  const cfg = TYPE_CONFIG[mov.movement_type];
                  const Icon = cfg.Icon;
                  return (
                    <tr key={mov.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${cfg.color}`}>
                          <Icon className="h-3 w-3" />{cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-800">{matName(mov.material_id)}</td>
                      <td className="px-5 py-3 text-right font-bold text-slate-900">{mov.quantity ?? '—'}</td>
                      <td className="px-5 py-3 text-slate-500 max-w-[200px] truncate">{mov.notes || '—'}</td>
                      <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(mov.created_at).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-slate-900">Registar Movimento</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Tipo</label>
                <div className="flex gap-2">
                  {(Object.keys(TYPE_CONFIG) as InventoryMovement['movement_type'][]).map((t) => (
                    <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, movement_type: t }))}
                      className={`flex-1 rounded-xl border py-2 text-xs font-bold uppercase tracking-wide transition ${form.movement_type === t ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      {TYPE_CONFIG[t].label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Material *</label>
                <select value={form.material_id} onChange={(e) => setForm((f) => ({ ...f, material_id: e.target.value }))}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500">
                  <option value="">Selecionar material...</option>
                  {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Quantidade *</label>
                <input type="number" min="1" value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Notas</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500" placeholder="Observações opcionais..." />
              </div>
              {formError && <p className="text-xs text-rose-600">{formError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button type="button" onClick={handleSave} disabled={saving}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                  {saving ? 'A registar...' : 'Registar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
