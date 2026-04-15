import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Car, ClipboardList, Euro, User } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '../../lib/supabase';

interface SupplierInfo {
  id: string;
  nome: string;
  nif: string;
  email: string;
  contacto: string;
}

interface SupplierHistoryRow {
  id: string;
  numero: string;
  data: string;
  custo: number | null;
  approved_value: number | null;
  status: string | null;
  cliente?: { nome: string | null } | null;
  viatura?: { matricula: string | null; marca: string | null; modelo: string | null } | null;
}

interface MonthlyPoint {
  monthKey: string;
  label: string;
  total: number;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
}).format(value || 0);

const rowAmount = (row: SupplierHistoryRow) => Number(row.custo ?? row.approved_value ?? 0);

export default function SupplierProfile() {
  const { supplierId } = useParams();
  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState<SupplierInfo | null>(null);
  const [history, setHistory] = useState<SupplierHistoryRow[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!supplierId) return;
      setLoading(true);

      try {
        const [supplierResult, historyResult] = await Promise.all([
          supabase
            .from('fornecedores')
            .select('id, nome, nif, email, contacto')
            .eq('id', supplierId)
            .single(),
          supabase
            .from('requisicoes')
            .select('id, numero, data, custo, approved_value, status, cliente:clientes(nome), viatura:viaturas(matricula, marca, modelo)')
            .eq('fornecedor_id', supplierId)
            .order('data', { ascending: false })
            .limit(1000),
        ]);

        if (supplierResult.error) throw supplierResult.error;
        if (historyResult.error) throw historyResult.error;

        setSupplier(supplierResult.data as SupplierInfo);
        setHistory((historyResult.data || []) as SupplierHistoryRow[]);
      } catch (error) {
        console.error('Erro ao carregar perfil do fornecedor:', error);
        setSupplier(null);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [supplierId]);

  const totals = useMemo(() => {
    const totalRevenue = history.reduce((acc, row) => acc + rowAmount(row), 0);
    const uniqueVehicles = new Set(
      history
        .map((row) => row.viatura?.matricula)
        .filter((value): value is string => Boolean(value)),
    );

    return {
      totalRevenue,
      servicesCount: history.length,
      vehiclesCount: uniqueVehicles.size,
    };
  }, [history]);

  const monthlyData = useMemo<MonthlyPoint[]>(() => {
    const map = new Map<string, number>();

    history.forEach((row) => {
      const date = new Date(row.data);
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      map.set(key, (map.get(key) || 0) + rowAmount(row));
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([monthKey, total]) => ({
        monthKey,
        label: new Date(`${monthKey}-01T00:00:00`).toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' }),
        total,
      }));
  }, [history]);

  if (loading) {
    return <div className="p-8 text-slate-400">A carregar perfil do fornecedor...</div>;
  }

  if (!supplier) {
    return (
      <div className="space-y-4 p-8 text-slate-300">
        <p>Fornecedor não encontrado.</p>
        <Link to="/fornecedores" className="text-blue-400 hover:text-blue-300">Voltar para fornecedores</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Perfil Financeiro do Fornecedor</h1>
          <p className="text-sm text-slate-400">{supplier.nome} • NIF {supplier.nif || '-'}</p>
        </div>
        <Link
          to="/fornecedores"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-900 hover:bg-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard title="Total faturado" value={formatCurrency(totals.totalRevenue)} icon={<Euro className="h-4 w-4" />} />
        <SummaryCard title="Número de serviços" value={String(totals.servicesCount)} icon={<ClipboardList className="h-4 w-4" />} />
        <SummaryCard title="Viaturas atendidas" value={String(totals.vehiclesCount)} icon={<Car className="h-4 w-4" />} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/90 p-5">
        <h2 className="mb-4 text-sm font-bold uppercase text-slate-300">Despesas por mês</h2>
        <div className="h-72">
          {monthlyData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-500">Sem dados para gráfico.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '0.75rem' }}
                  formatter={(value: number) => [formatCurrency(value), 'Total']}
                />
                <Bar dataKey="total" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/90 p-5">
        <h2 className="mb-4 text-sm font-bold uppercase text-slate-300">Histórico financeiro</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-400">
                <th className="py-2 pr-3">Número</th>
                <th className="py-2 pr-3">Data</th>
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 pr-3">Viatura</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id} className="border-b border-slate-200/60 text-slate-200">
                  <td className="py-2 pr-3 font-mono">{row.numero}</td>
                  <td className="py-2 pr-3">{new Date(row.data).toLocaleDateString('pt-PT')}</td>
                  <td className="py-2 pr-3">{row.cliente?.nome || '-'}</td>
                  <td className="py-2 pr-3">{row.viatura?.matricula || '-'}</td>
                  <td className="py-2 pr-3">{row.status || '-'}</td>
                  <td className="py-2 pr-3 text-right font-semibold">{formatCurrency(rowAmount(row))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {history.length === 0 && (
            <p className="py-3 text-sm text-slate-500">Este fornecedor ainda não tem histórico de despesas.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white/90 p-4 text-sm text-slate-300">
        <p className="mb-2 font-semibold text-slate-200">Dados do fornecedor</p>
        <div className="flex items-center gap-2"><User className="h-4 w-4 text-slate-400" /> {supplier.email || 'Sem email'} • {supplier.contacto || 'Sem contacto'}</div>
      </section>
    </div>
  );
}

function SummaryCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/90 p-4">
      <p className="flex items-center gap-2 text-xs uppercase text-slate-400">{icon}{title}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
    </div>
  );
}
