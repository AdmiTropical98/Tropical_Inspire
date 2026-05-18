import { useEffect, useState } from 'react';
import { Building2, Edit2, MapPin, Plus, Search, Trash2, X } from 'lucide-react';
import {
  createOffice,
  deleteOffice,
  getOffices,
  updateOffice,
  type InventoryOffice,
} from '../../../services/inventoryService';

const EMPTY_FORM: Omit<InventoryOffice, 'id'> = { name: '', code: '', city: '', active: true };

export default function Escritorios() {
  const [offices, setOffices] = useState<InventoryOffice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryOffice | null>(null);
  const [form, setForm] = useState<Omit<InventoryOffice, 'id'>>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<InventoryOffice | null>(null);

  async function load() {
    setLoading(true);
    try { setOffices(await getOffices()); } catch { setOffices([]); }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setModalOpen(true);
  }

  function openEdit(office: InventoryOffice) {
    setEditing(office);
    setForm({ name: office.name, code: office.code ?? '', city: office.city ?? '', active: office.active ?? true });
    setError('');
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('O nome é obrigatório.'); return; }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await updateOffice(editing.id, { name: form.name.trim(), code: form.code?.trim() || undefined, city: form.city?.trim() || undefined, active: form.active });
      } else {
        await createOffice({ name: form.name.trim(), code: form.code?.trim() || undefined, city: form.city?.trim() || undefined, active: form.active });
      }
      setModalOpen(false);
      await load();
    } catch (err: unknown) {
      setError((err as Error).message || 'Erro ao guardar.');
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try { await deleteOffice(deleteTarget.id); setDeleteTarget(null); await load(); } catch { /* ignore */ }
  }

  const filtered = offices.filter((o) =>
    [o.name, o.code, o.city].some((v) => v?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-black tracking-tight text-slate-900">Escritórios</h2>
          <p className="text-sm text-slate-500 mt-0.5">Locais e armazéns do inventário</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          Novo Escritório
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar escritórios..."
          className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">A carregar...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm font-semibold text-slate-500">Nenhum escritório encontrado</p>
            <p className="text-xs text-slate-400 mt-1">Crie o primeiro escritório para começar.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                  <th className="px-5 py-3 text-left font-bold">Nome</th>
                  <th className="px-5 py-3 text-left font-bold">Código</th>
                  <th className="px-5 py-3 text-left font-bold">Cidade</th>
                  <th className="px-5 py-3 text-left font-bold">Estado</th>
                  <th className="px-5 py-3 text-right font-bold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((office) => (
                  <tr key={office.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        {office.name}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{office.code || '—'}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {office.city ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          {office.city}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${office.active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {office.active !== false ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button type="button" onClick={() => openEdit(office)} className="rounded-lg border border-slate-200 p-1.5 hover:border-slate-300 hover:bg-slate-50">
                          <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(office)} className="rounded-lg border border-rose-200 p-1.5 hover:bg-rose-50">
                          <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-slate-900">{editing ? 'Editar Escritório' : 'Novo Escritório'}</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 hover:bg-slate-100">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Nome *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" placeholder="Ex: Armazém Central" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Código</label>
                  <input value={form.code ?? ''} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" placeholder="Ex: ARM-01" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Cidade</label>
                  <input value={form.city ?? ''} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" placeholder="Ex: Faro" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.active ?? true} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600" />
                <span className="text-sm font-semibold text-slate-700">Escritório ativo</span>
              </label>
              {error && <p className="text-xs text-rose-600">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
                <button type="button" onClick={handleSave} disabled={saving}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                  {saving ? 'A guardar...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900">Eliminar escritório?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Tem a certeza que quer eliminar <strong>{deleteTarget.name}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button type="button" onClick={handleDelete}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white hover:bg-rose-700">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
