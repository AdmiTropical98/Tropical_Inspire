import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';

// ─── Mock data ───────────────────────────────────────────────────────────────
interface Payment {
  id: string;
  supplier: string;
  description: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: 'Pago' | 'Pendente' | 'Vencido';
  method: string;
  ref: string;
}

const PAYMENTS: Payment[] = [
  { id: 'PAG-001', supplier: 'TechServ Solutions', description: 'Licenças Microsoft 365 — Q4 2024', amount: 8400, dueDate: '2024-12-15', paidDate: '2024-12-10', status: 'Pago', method: 'Transferência', ref: 'REQ-2024-040' },
  { id: 'PAG-002', supplier: 'Limpeza Premium Lda', description: 'Limpeza Escritórios — Dez 2024', amount: 4200, dueDate: '2024-12-31', paidDate: '2024-12-28', status: 'Pago', method: 'Transferência', ref: 'REQ-2024-045' },
  { id: 'PAG-003', supplier: 'Segurança Total SA', description: 'Serviço de Segurança — Jan 2025', amount: 8750, dueDate: '2025-01-31', status: 'Pendente', method: 'Transferência', ref: 'REQ-2025-001' },
  { id: 'PAG-004', supplier: 'TechServ Solutions', description: 'Upgrade Servidor Principal', amount: 12800, dueDate: '2025-02-15', status: 'Pendente', method: 'Transferência', ref: 'REQ-2025-003' },
  { id: 'PAG-005', supplier: 'Office Plus Portugal', description: 'Material Escritório — Nov 2024', amount: 1850, dueDate: '2024-12-01', status: 'Vencido', method: 'Transferência', ref: 'REQ-2024-038' },
  { id: 'PAG-006', supplier: 'LogiTrans Portugal', description: 'Transporte Mercadorias Q4', amount: 3600, dueDate: '2024-11-30', status: 'Vencido', method: 'Transferência', ref: 'REQ-2024-035' },
  { id: 'PAG-007', supplier: 'Limpeza Premium Lda', description: 'Limpeza Escritórios — Jan 2025', amount: 4200, dueDate: '2025-01-31', status: 'Pendente', method: 'Transferência', ref: 'REQ-2025-002' },
  { id: 'PAG-008', supplier: 'TechServ Solutions', description: 'Suporte IT — Dez 2024', amount: 3200, dueDate: '2024-12-20', paidDate: '2024-12-18', status: 'Pago', method: 'Débito Direto', ref: 'REQ-2024-042' },
];

function fmt(n: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function statusBadge(status: string) {
  switch (status) {
    case 'Pago': return 'ferp-badge ferp-badge-paid';
    case 'Pendente': return 'ferp-badge ferp-badge-pending';
    case 'Vencido': return 'ferp-badge ferp-badge-overdue';
    default: return 'ferp-badge ferp-badge-inactive';
  }
}

export default function FornecedoresPagamentos() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [showNew, setShowNew] = useState(false);

  const filtered = PAYMENTS.filter((p) => {
    const matchSearch = p.supplier.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search);
    const matchStatus = statusFilter === 'Todos' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPago = PAYMENTS.filter((p) => p.status === 'Pago').reduce((acc, p) => acc + p.amount, 0);
  const totalPendente = PAYMENTS.filter((p) => p.status === 'Pendente').reduce((acc, p) => acc + p.amount, 0);
  const totalVencido = PAYMENTS.filter((p) => p.status === 'Vencido').reduce((acc, p) => acc + p.amount, 0);

  const monthlyData = [
    { month: 'Set', paid: 28400, pending: 5200 },
    { month: 'Out', paid: 31800, pending: 8100 },
    { month: 'Nov', paid: 26500, pending: 5450 },
    { month: 'Dez', paid: 15800, pending: 16950 },
    { month: 'Jan', paid: 0, pending: 28950 },
  ];
  const maxVal = Math.max(...monthlyData.map((m) => m.paid + m.pending));

  const velocityData = monthlyData.map((m) => ({
    month: m.month,
    total: m.paid + m.pending,
    paid: m.paid,
  }));

  return (
    <div className="ferp-animate space-y-5">
      {/* Header */}
      <motion.div className="flex items-center justify-between" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white">Pagamentos</h2>
          <p className="text-sm" style={{ color: '#94a3b8' }}>{filtered.length} registro(s)</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="ferp-btn-ghost" style={{ fontSize: 12 }}>
            <Download className="h-4 w-4" /> Exportar
          </button>
          <button type="button" onClick={() => setShowNew(true)} className="ferp-btn-primary">
            <Plus className="h-4 w-4" /> Registar Pagamento
          </button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Total Pago', value: fmt(totalPago), icon: CheckCircle2, color: '#4ade80', sub: `${PAYMENTS.filter((p) => p.status === 'Pago').length} pagamentos` },
          { label: 'Pendente', value: fmt(totalPendente), icon: Clock, color: '#fbbf24', sub: `${PAYMENTS.filter((p) => p.status === 'Pendente').length} aguardando` },
          { label: 'Vencido', value: fmt(totalVencido), icon: AlertCircle, color: '#f87171', sub: `${PAYMENTS.filter((p) => p.status === 'Vencido').length} em atraso` },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} className="ferp-card ferp-card-glow p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-[9px]" style={{ background: `${s.color}18` }}>
                  <Icon className="h-5 w-5" style={{ color: s.color }} />
                </div>
                {s.label === 'Vencido' && totalVencido > 0 && (
                  <TrendingDown className="h-4 w-4" style={{ color: '#f87171' }} />
                )}
                {s.label === 'Total Pago' && (
                  <TrendingUp className="h-4 w-4" style={{ color: '#4ade80' }} />
                )}
              </div>
              <p className="text-[26px] font-black text-white">{s.value}</p>
              <p className="text-[12px] font-semibold mt-1" style={{ color: '#64748b' }}>{s.label}</p>
              <p className="text-[11px] mt-0.5" style={{ color: s.color }}>{s.sub}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="ferp-card ferp-card-glow p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[15px] font-black text-white">Pagamentos por Mês</h3>
          <div className="flex gap-4 text-[11px] font-bold">
            <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ background: '#4ade80' }} /> Pagos</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ background: '#fbbf24' }} /> Pendentes</span>
          </div>
        </div>
        <div className="flex h-36 items-end gap-4">
          {monthlyData.map((m) => {
            const paidH = (m.paid / maxVal) * 100;
            const pendH = (m.pending / maxVal) * 100;
            return (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex flex-1 w-full flex-col-reverse gap-0.5 items-stretch">
                  <div className="ferp-bar rounded-none rounded-b-[4px]" style={{ height: `${paidH}%`, minHeight: 2, background: 'linear-gradient(to top, rgba(74,222,128,0.8), rgba(74,222,128,0.4))' }} />
                  {m.pending > 0 && (
                    <div style={{ height: `${pendH}%`, minHeight: 2, background: 'linear-gradient(to top, rgba(251,191,36,0.8), rgba(251,191,36,0.4))', borderRadius: '4px 4px 0 0' }} />
                  )}
                </div>
                <span className="text-[9px] font-bold uppercase" style={{ color: '#475569' }}>{m.month}</span>
              </div>
            );
          })}
        </div>
      </div>

      <motion.div className="ferp-card ferp-card-glow p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h3 className="mb-3 text-[15px] font-black text-white">Velocidade de processamento</h3>
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={velocityData}>
              <defs>
                <linearGradient id="paidVelocity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4ade80" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#4ade80" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 2" stroke="rgba(139,92,246,0.15)" />
              <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
              <ChartTooltip contentStyle={{ background: '#100625', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 10 }} />
              <Area type="monotone" dataKey="total" stroke="#a855f7" fill="url(#paidVelocity)" />
              <Bar dataKey="paid" fill="#4ade80" radius={[4, 4, 0, 0]} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
      </div>

      {/* Filters */}
      <div className="ferp-card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: '#64748b' }} />
          <input type="text" placeholder="Pesquisar pagamento..." value={search} onChange={(e) => setSearch(e.target.value)} className="ferp-input pl-10" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="ferp-input" style={{ width: 'auto', minWidth: 120 }}>
          {['Todos', 'Pago', 'Pendente', 'Vencido'].map((s) => <option key={s} value={s} className="bg-[#0d0520]">{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="ferp-table-wrap ferp-card">
        <table className="ferp-table">
          <thead>
            <tr>
              <th>Referência</th>
              <th>Fornecedor</th>
              <th>Descrição</th>
              <th>Valor</th>
              <th>Vencimento</th>
              <th>Pago em</th>
              <th>Estado</th>
              <th>Método</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td style={{ fontFamily: 'monospace', color: '#7c3aed', fontSize: 11, fontWeight: 700 }}>{p.id}</td>
                <td style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 600 }}>{p.supplier}</td>
                <td style={{ color: '#94a3b8', fontSize: 12 }}>{p.description}</td>
                <td style={{ fontWeight: 700, color: '#c084fc' }}>{fmt(p.amount)}</td>
                <td style={{ color: p.status === 'Vencido' ? '#f87171' : '#64748b', fontSize: 12 }}>
                  {new Date(p.dueDate).toLocaleDateString('pt-PT')}
                </td>
                <td style={{ color: '#4ade80', fontSize: 12 }}>
                  {p.paidDate ? new Date(p.paidDate).toLocaleDateString('pt-PT') : '—'}
                </td>
                <td><span className={statusBadge(p.status)}>{p.status}</span></td>
                <td style={{ color: '#64748b', fontSize: 11 }}>{p.method}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Payment Modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }} onClick={() => setShowNew(false)}>
          <div className="w-full max-w-lg rounded-[20px] p-6" style={{ background: 'linear-gradient(160deg, #110528, #0d0320)', border: '1px solid rgba(139,92,246,0.35)', boxShadow: '0 0 60px rgba(124,58,237,0.25)' }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-black text-white">Registar Pagamento</h3>
              <button type="button" onClick={() => setShowNew(false)} className="ferp-btn-ghost" style={{ padding: '5px 8px' }}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Fornecedor', type: 'select' },
                { label: 'Descrição', placeholder: 'Ex: Fatura FT 2025/001' },
                { label: 'Valor (€)', placeholder: '0.00' },
                { label: 'Data de Vencimento', placeholder: 'DD/MM/AAAA' },
                { label: 'Método de Pagamento', type: 'select2' },
              ].map((f) => (
                <div key={f.label}>
                  <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider" style={{ color: '#94a3b8' }}>{f.label}</label>
                  {f.type === 'select' ? (
                    <select className="ferp-input">
                      {['TechServ Solutions', 'Limpeza Premium Lda', 'Office Plus Portugal', 'Segurança Total SA'].map((s) => <option key={s} className="bg-[#0d0520]">{s}</option>)}
                    </select>
                  ) : f.type === 'select2' ? (
                    <select className="ferp-input">
                      {['Transferência Bancária', 'Débito Direto', 'Cheque', 'Numerário'].map((s) => <option key={s} className="bg-[#0d0520]">{s}</option>)}
                    </select>
                  ) : (
                    <input type="text" placeholder={f.placeholder} className="ferp-input" />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setShowNew(false)} className="ferp-btn-ghost flex-1 justify-center">Cancelar</button>
              <button type="button" onClick={() => setShowNew(false)} className="ferp-btn-primary flex-1 justify-center">
                <CreditCard className="h-4 w-4" /> Registar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
