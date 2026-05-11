import { useEffect, useState } from 'react';
import { Cpu, Edit2, Plus, QrCode, Search, Trash2, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  createEquipment,
  deleteEquipment,
  getEquipments,
  getOffices,
  updateEquipment,
  type InventoryEquipment,
  type InventoryOffice,
} from '../../../services/inventoryService';

type FormData = {
  name: string; serial_number: string; office_id: string;
  assigned_user_id: string; status: InventoryEquipment['status'];
};

const EMPTY_FORM: FormData = { name: '', serial_number: '', office_id: '', assigned_user_id: '', status: 'available' };

const STATUS_LABELS: Record<InventoryEquipment['status'], string> = {
  available: 'Disponível', assigned: 'Atribuído', maintenance: 'Manutenção', retired: 'Abatido',
};

const STATUS_COLORS: Record<InventoryEquipment['status'], string> = {
  available: 'bg-emerald-100 text-emerald-700',
  assigned: 'bg-blue-100 text-blue-700',
  maintenance: 'bg-amber-100 text-amber-700',
  retired: 'bg-slate-100 text-slate-500',
};

export default function Equipamentos() {
  const [equipments, setEquipments] = useState<InventoryEquipment[]>([]);
  const [offices, setOffices] = useState<InventoryOffice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<InventoryEquipment['status'] | ''>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryEquipment | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<InventoryEquipment | null>(null);
  const [qrTarget, setQrTarget] = useState<InventoryEquipment | null>(null);

  async function load() {
    setLoading(true);
    const [equips, offs] = await Promise.all([getEquipments(), getOffices()]).catch(() => [[], []]);
    setEquipments(equips as InventoryEquipment[]);
    setOffices(offs as InventoryOffice[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function openCreate() {
    setEditing(null); setForm(EMPTY_FORM); setFormError(''); setModalOpen(true);
  }

  function openEdit(eq: InventoryEquipment) {
    setEditing(eq);
    setForm({ name: eq.name, serial_number: eq.serial_number ?? '', office_id: eq.office_id ?? '', assigned_user_id: eq.assigned_user_id ?? '', status: eq.status });
    setFormError(''); setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('O nome é obrigatório.'); return; }
    setSaving(true); setFormError('');
    try {
      const payload = {
        name: form.name.trim(), serial_number: form.serial_number.trim() || undefined,
        office_id: form.office_id || undefined, assigned_user_id: form.assigned_user_id.trim() || undefined,
        status: form.status,
      };
      if (editing) { await updateEquipment(editing.id, payload); }
      else { await createEquipment(payload); }
      setModalOpen(false); await load();
    } catch (err: unknown) { setFormError((err as Error).message || 'Erro ao guardar.'); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try { await deleteEquipment(deleteTarget.id); setDeleteTarget(null); await load(); } catch { /* noop */ }
  }

  const officeName = (id?: string) => offices.find((o) => o.id === id)?.name ?? '—';

  const filtered = equipments.filter((eq) => {
    if (search && !eq.name.toLowerCase().includes(search.toLowerCase()) && !(eq.serial_number ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus && eq.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-black tracking-tight text-slate-900">Equipamentos</h2>
          <p className="text-sm text-slate-500 mt-0.5">{equipments.length} equipamento{equipments.length !== 1 ? 's' : ''} registado{equipments.length !== 1 ? 's' : ''}</p>
        </div>
        <button type="button" onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700">
          <Plus className="h-4 w-4" />Novo Equipamento
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome ou nº série..."
            className="h-10 w-64 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-emerald-500" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-500">
          <option value="">Todos os estados</option>
          {(Object.keys(STATUS_LABELS) as InventoryEquipment['status'][]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">A carregar equipamentos...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Cpu className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm font-semibold text-slate-500">Nenhum equipamento encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                  <th className="px-5 py-3 text-left font-bold">Nome</th>
                  <th className="px-5 py-3 text-left font-bold">Nº Série</th>
                  <th className="px-5 py-3 text-left font-bold">Local</th>
                  <th className="px-5 py-3 text-left font-bold">Estado</th>
                  <th className="px-5 py-3 text-left font-bold">Atribuído a</th>
                  <th className="px-5 py-3 text-right font-bold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((eq) => (
                  <tr key={eq.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-semibold text-slate-900">
                      <div className="flex items-center gap-2"><Cpu className="h-4 w-4 text-cyan-500 shrink-0" />{eq.name}</div>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{eq.serial_number || '—'}</td>
                    <td className="px-5 py-3 text-slate-600">{officeName(eq.office_id)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${STATUS_COLORS[eq.status]}`}>
                        {STATUS_LABELS[eq.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-sm">{eq.assigned_user_id || '—'}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button type="button" onClick={() => setQrTarget(eq)} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50" title="QR Code">
                          <QrCode className="h-3.5 w-3.5 text-emerald-600" />
                        </button>
                        <button type="button" onClick={() => openEdit(eq)} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50">
                          <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(eq)} className="rounded-lg border border-rose-200 p-1.5 hover:bg-rose-50">
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-slate-900">{editing ? 'Editar Equipamento' : 'Novo Equipamento'}</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Nome *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" placeholder="Ex: Portátil Dell" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Nº de Série</label>
                <input value={form.serial_number} onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-mono text-slate-800 outline-none focus:border-emerald-500" placeholder="SN-XXXXXX" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Escritório</label>
                  <select value={form.office_id} onChange={(e) => setForm((f) => ({ ...f, office_id: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500">
                    <option value="">Sem local</option>
                    {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Estado</label>
                  <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as InventoryEquipment['status'] }))}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500">
                    {(Object.keys(STATUS_LABELS) as InventoryEquipment['status'][]).map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              </div>
              {form.status === 'assigned' && (
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Atribuído a</label>
                  <input value={form.assigned_user_id} onChange={(e) => setForm((f) => ({ ...f, assigned_user_id: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" placeholder="Nome da pessoa" />
                </div>
              )}
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
            <h3 className="text-lg font-black text-slate-900">Eliminar equipamento?</h3>
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
                {qrTarget.serial_number && <p className="text-xs text-slate-400">S/N: {qrTarget.serial_number}</p>}
              </>
            ) : (
              <p className="text-sm text-slate-500 py-8">Este equipamento ainda não tem QR Code. Edite e guarde para gerar.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
