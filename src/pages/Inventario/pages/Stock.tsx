import { useEffect, useState } from 'react';
import { AlertTriangle, Boxes, Search } from 'lucide-react';
import { getMaterials, getOffices, type InventoryMaterial, type InventoryOffice } from '../../../services/inventoryService';

export default function Stock() {
  const [materials, setMaterials] = useState<InventoryMaterial[]>([]);
  const [offices, setOffices] = useState<InventoryOffice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterOffice, setFilterOffice] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const [mats, offs] = await Promise.all([getMaterials(), getOffices()]).catch(() => [[], []]);
      setMaterials(mats as InventoryMaterial[]);
      setOffices(offs as InventoryOffice[]);
      setLoading(false);
    })();
  }, []);

  const officeName = (id?: string) => offices.find((o) => o.id === id)?.name ?? '—';

  const filtered = materials.filter((m) => {
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !(m.sku ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    if (filterOffice && m.office_id !== filterOffice) return false;
    if (onlyLow && m.quantity > m.minimum_quantity) return false;
    return true;
  });

  const lowStockCount = materials.filter((m) => m.quantity <= m.minimum_quantity).length;

  const stockLevel = (m: InventoryMaterial) => {
    if (m.minimum_quantity === 0) return 100;
    return Math.min(100, Math.round((m.quantity / (m.minimum_quantity * 2)) * 100));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-black tracking-tight text-slate-900">Gestão de Stock</h2>
          <p className="text-sm text-slate-500 mt-0.5">Visão geral dos níveis de stock por material</p>
        </div>
        {lowStockCount > 0 && (
          <div className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
            <AlertTriangle className="h-4 w-4" />
            {lowStockCount} item{lowStockCount !== 1 ? 's' : ''} em stock crítico
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar material..."
            className="h-10 w-64 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-emerald-500" />
        </div>
        <select value={filterOffice} onChange={(e) => setFilterOffice(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-500">
          <option value="">Todos os locais</option>
          {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-rose-50 hover:border-rose-200">
          <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-rose-600" />
          <AlertTriangle className="h-4 w-4 text-rose-500" />
          Apenas críticos
        </label>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">A carregar stock...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Boxes className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm font-semibold text-slate-500">Nenhum material encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                  <th className="px-5 py-3 text-left font-bold">Material</th>
                  <th className="px-5 py-3 text-left font-bold">Categoria</th>
                  <th className="px-5 py-3 text-left font-bold">Local</th>
                  <th className="px-5 py-3 text-right font-bold">Em Stock</th>
                  <th className="px-5 py-3 text-right font-bold">Mínimo</th>
                  <th className="px-5 py-3 text-left font-bold w-[180px]">Nível</th>
                  <th className="px-5 py-3 text-left font-bold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((mat) => {
                  const isLow = mat.quantity <= mat.minimum_quantity;
                  const pct = stockLevel(mat);
                  const barColor = isLow ? 'bg-rose-500' : pct < 60 ? 'bg-amber-400' : 'bg-emerald-500';
                  return (
                    <tr key={mat.id} className={`hover:bg-slate-50 ${isLow ? 'bg-rose-50/30' : ''}`}>
                      <td className="px-5 py-3 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          {isLow && <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
                          {mat.name}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-xs">{mat.category || '—'}</td>
                      <td className="px-5 py-3 text-slate-600">{officeName(mat.office_id)}</td>
                      <td className={`px-5 py-3 text-right font-black text-lg ${isLow ? 'text-rose-600' : 'text-slate-900'}`}>{mat.quantity}</td>
                      <td className="px-5 py-3 text-right text-slate-500">{mat.minimum_quantity}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[11px] font-bold text-slate-500 w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${isLow ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {isLow ? 'Crítico' : 'Normal'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
