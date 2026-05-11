import { useEffect, useState } from 'react';
import { Edit2, Package, Plus, QrCode, Search, Trash2, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  createMaterial,
  deleteMaterial,
  getOffices,
  getMaterials,
  updateMaterial,
  type InventoryMaterial,
  type InventoryOffice,
} from '../../../services/inventoryService';

type FormData = {
  name: string; sku: string; category: string; office_id: string;
  quantity: number; minimum_quantity: number; unit_cost: number;
};

const EMPTY_FORM: FormData = { name: '', sku: '', category: '', office_id: '', quantity: 0, minimum_quantity: 0, unit_cost: 0 };

const CATEGORIES = ['Consumível', 'Peça', 'Ferramenta', 'EPI', 'Limpeza', 'Escritório', 'Outro'];

export default function Materiais() {
  const [materials, setMaterials] = useState<InventoryMaterial[]>([]);
  const [offices, setOffices] = useState<InventoryOffice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryMaterial | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<InventoryMaterial | null>(null);
  const [qrTarget, setQrTarget] = useState<InventoryMaterial | null>(null);

  async function load() {
    setLoading(true);
    const [mats, offs] = await Promise.all([getMaterials(), getOffices()]).catch(() => [[], []]);
    setMaterials(mats as InventoryMaterial[]);
    setOffices(offs as InventoryOffice[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(mat: InventoryMaterial) {
    setEditing(mat);
    setForm({
      name: mat.name, sku: mat.sku ?? '', category: mat.category ?? '',
      office_id: mat.office_id ?? '', quantity: mat.quantity,
      minimum_quantity: mat.minimum_quantity, unit_cost: mat.unit_cost ?? 0,
    });
    setFormError('');
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('O nome é obrigatório.'); return; }
    setSaving(true); setFormError('');
    try {
      const payload = {
        name: form.name.trim(), sku: form.sku.trim() || undefined,
        category: form.category || undefined,
        office_id: form.office_id || undefined,
        quantity: Number(form.quantity) || 0,
        minimum_quantity: Number(form.minimum_quantity) || 0,
        unit_cost: Number(form.unit_cost) || undefined,
      };
      if (editing) { await updateMaterial(editing.id, payload); }
      else { await createMaterial(payload); }
      setModalOpen(false);
      await load();
    } catch (err: unknown) { setFormError((err as Error).message || 'Erro ao guardar.'); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try { await deleteMaterial(deleteTarget.id); setDeleteTarget(null); await load(); } catch { /* noop */ }
  }

  const officeName = (id?: string) => offices.find((o) => o.id === id)?.name ?? '—';

  const filtered = materials.filter((m) => {
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !(m.sku ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCategory && m.category !== filterCategory) return false;
    if (filterLowStock && m.quantity > m.minimum_quantity) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-black tracking-tight text-slate-900">Materiais</h2>
          <p className="text-sm text-slate-500 mt-0.5">{materials.length} item{materials.length !== 1 ? 's' : ''} registado{materials.length !== 1 ? 's' : ''}</p>
        </div>
        <button type="button" onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700">
          <Plus className="h-4 w-4" />Novo Material
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome ou SKU..."
            className="h-10 w-64 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-emerald-500" />
        </div>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-500">
          <option value="">Todas as categorias</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-50">
          <input type="checkbox" checked={filterLowStock} onChange={(e) => setFilterLowStock(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-rose-600" />
          Stock crítico
        </label>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">A carregar materiais...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm font-semibold text-slate-500">Nenhum material encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                  <th className="px-5 py-3 text-left font-bold">Nome</th>
                  <th className="px-5 py-3 text-left font-bold">SKU</th>
                  <th className="px-5 py-3 text-left font-bold">Categoria</th>
                  <th className="px-5 py-3 text-left font-bold">Local</th>
                  <th className="px-5 py-3 text-right font-bold">Qtd</th>
                  <th className="px-5 py-3 text-right font-bold">Mín</th>
                  <th className="px-5 py-3 text-left font-bold">Estado</th>
                  <th className="px-5 py-3 text-right font-bold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((mat) => {
                  const isLow = mat.quantity <= mat.minimum_quantity;
                  return (
                    <tr key={mat.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-semibold text-slate-900">{mat.name}</td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-500">{mat.sku || '—'}</td>
                      <td className="px-5 py-3">
                        {mat.category ? (
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{mat.category}</span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{officeName(mat.office_id)}</td>
                      <td className="px-5 py-3 text-right font-bold text-slate-900">{mat.quantity}</td>
                      <td className="px-5 py-3 text-right text-slate-500">{mat.minimum_quantity}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${isLow ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {isLow ? 'Crítico' : 'OK'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <button type="button" onClick={() => setQrTarget(mat)} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50" title="QR Code">
                            <QrCode className="h-3.5 w-3.5 text-emerald-600" />
                          </button>
                          <button type="button" onClick={() => openEdit(mat)} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50">
                            <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                          </button>
                          <button type="button" onClick={() => setDeleteTarget(mat)} className="rounded-lg border border-rose-200 p-1.5 hover:bg-rose-50">
                            <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                          </button>
                        </div>
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
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-slate-900">{editing ? 'Editar Material' : 'Novo Material'}</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 hover:bg-slate-100"><X className="h-4 w-4 text-slate-500" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Nome *</label>
                  <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" placeholder="Nome do material" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">SKU / Código</label>
                  <input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" placeholder="Ex: MAT-001" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Categoria</label>
                  <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500">
                    <option value="">Sem categoria</option>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Escritório</label>
                  <select value={form.office_id} onChange={(e) => setForm((f) => ({ ...f, office_id: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500">
                    <option value="">Sem localização</option>
                    {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Preço Unit. (€)</label>
                  <input type="number" min="0" step="0.01" value={form.unit_cost}
                    onChange={(e) => setForm((f) => ({ ...f, unit_cost: parseFloat(e.target.value) || 0 }))}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Quantidade</label>
                  <input type="number" min="0" value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: parseInt(e.target.value) || 0 }))}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Stock Mínimo</label>
                  <input type="number" min="0" value={form.minimum_quantity}
                    onChange={(e) => setForm((f) => ({ ...f, minimum_quantity: parseInt(e.target.value) || 0 }))}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
                </div>
              </div>
              {formError && <p className="text-xs text-rose-600">{formError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button type="button" onClick={handleSave} disabled={saving}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                  {saving ? 'A guardar...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900">Eliminar material?</h3>
            <p className="mt-2 text-sm text-slate-600">Tem a certeza que quer eliminar <strong>{deleteTarget.name}</strong>?</p>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button type="button" onClick={handleDelete}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white hover:bg-rose-700">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {qrTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-center">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-slate-900">QR Code</h3>
              <button type="button" onClick={() => setQrTarget(null)} className="rounded-lg p-1.5 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            {qrTarget.qr_code ? (
              <>
                <div className="flex justify-center p-4 bg-white rounded-xl border border-slate-100">
                  <QRCodeSVG value={qrTarget.qr_code} size={180} />
                </div>
                <p className="mt-3 text-xs font-mono text-slate-500 break-all">{qrTarget.qr_code}</p>
                <p className="mt-1 text-sm font-semibold text-slate-700">{qrTarget.name}</p>
              </>
            ) : (
              <p className="text-sm text-slate-500 py-8">Este material ainda não tem QR Code. Edite e guarde para gerar.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
