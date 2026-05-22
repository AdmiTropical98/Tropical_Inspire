import { useState } from 'react';
import { motion } from 'framer-motion';
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Plus,
  Search,
  XCircle,
  X,
  Package,
  AlertCircle,
} from 'lucide-react';

// ─── Mock data ───────────────────────────────────────────────────────────────
interface Req {
  id: string;
  title: string;
  supplier: string;
  category: string;
  amount: number;
  requestedBy: string;
  date: string;
  status: 'Pendente' | 'Aprovado' | 'Rejeitado' | 'Em Análise';
  priority: 'Alta' | 'Média' | 'Baixa';
  timeline: Array<{ date: string; action: string; by: string }>;
}

const REQUISITIONS: Req[] = [
  {
    id: 'REQ-2025-001', title: 'Licenças Microsoft 365 — Q1 2025', supplier: 'TechServ Solutions', category: 'IT & Software', amount: 8400, requestedBy: 'João Silva', date: '2025-01-08', status: 'Aprovado', priority: 'Alta',
    timeline: [
      { date: '2025-01-08', action: 'Requisição criada', by: 'João Silva' },
      { date: '2025-01-09', action: 'Em análise pelo gestor', by: 'Sistema' },
      { date: '2025-01-10', action: 'Aprovada', by: 'Maria Costa' },
    ],
  },
  {
    id: 'REQ-2025-002', title: 'Material de Escritório — Stock Mensal', supplier: 'Office Plus Portugal', category: 'Material de Escritório', amount: 1250, requestedBy: 'Ana Ferreira', date: '2025-01-12', status: 'Pendente', priority: 'Baixa',
    timeline: [
      { date: '2025-01-12', action: 'Requisição criada', by: 'Ana Ferreira' },
    ],
  },
  {
    id: 'REQ-2025-003', title: 'Upgrade Servidor Principal', supplier: 'TechServ Solutions', category: 'IT & Software', amount: 12800, requestedBy: 'Pedro Alves', date: '2025-01-15', status: 'Em Análise', priority: 'Alta',
    timeline: [
      { date: '2025-01-15', action: 'Requisição criada', by: 'Pedro Alves' },
      { date: '2025-01-16', action: 'Em análise pelo gestor', by: 'Sistema' },
    ],
  },
  {
    id: 'REQ-2024-048', title: 'Serviço de Catering — Evento Anual', supplier: 'Catering Express', category: 'Alimentação', amount: 4500, requestedBy: 'Carla Mendes', date: '2024-12-10', status: 'Rejeitado', priority: 'Média',
    timeline: [
      { date: '2024-12-10', action: 'Requisição criada', by: 'Carla Mendes' },
      { date: '2024-12-11', action: 'Em análise', by: 'Sistema' },
      { date: '2024-12-12', action: 'Rejeitada — Budget excedido', by: 'Direção' },
    ],
  },
  {
    id: 'REQ-2025-004', title: 'Consultoria ERP — Fase 2', supplier: 'Consult Business Group', category: 'Consultoria', amount: 18000, requestedBy: 'Ricardo Santos', date: '2025-01-18', status: 'Pendente', priority: 'Alta',
    timeline: [
      { date: '2025-01-18', action: 'Requisição criada', by: 'Ricardo Santos' },
    ],
  },
];

function statusBadge(status: string) {
  switch (status) {
    case 'Aprovado': return 'ferp-badge ferp-badge-approved';
    case 'Pendente': return 'ferp-badge ferp-badge-pending';
    case 'Rejeitado': return 'ferp-badge ferp-badge-overdue';
    default: return 'ferp-badge ferp-badge-inactive';
  }
}

function priorityBadge(priority: string) {
  const map: Record<string, string> = {
    Alta: 'background:rgba(239,68,68,0.12);color:#f87171;border:1px solid rgba(239,68,68,0.25)',
    Média: 'background:rgba(251,191,36,0.12);color:#fbbf24;border:1px solid rgba(251,191,36,0.25)',
    Baixa: 'background:rgba(74,222,128,0.1);color:#4ade80;border:1px solid rgba(74,222,128,0.2)',
  };
  return map[priority] || '';
}

function fmt(n: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

export default function FornecedoresRequisicoes() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [selected, setSelected] = useState<Req | null>(null);
  const [showNew, setShowNew] = useState(false);

  const filtered = REQUISITIONS.filter((r) => {
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase()) || r.supplier.toLowerCase().includes(search.toLowerCase()) || r.id.includes(search);
    const matchStatus = statusFilter === 'Todos' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: REQUISITIONS.length,
    pendente: REQUISITIONS.filter((r) => r.status === 'Pendente').length,
    aprovado: REQUISITIONS.filter((r) => r.status === 'Aprovado').length,
    emAnalise: REQUISITIONS.filter((r) => r.status === 'Em Análise').length,
  };

  const statusChart = [
    { name: 'Pendente', value: stats.pendente, color: '#fbbf24' },
    { name: 'Em Análise', value: stats.emAnalise, color: '#60a5fa' },
    { name: 'Aprovado', value: stats.aprovado, color: '#4ade80' },
    { name: 'Rejeitado', value: REQUISITIONS.filter((r) => r.status === 'Rejeitado').length, color: '#f87171' },
  ];

  return (
    <div className="ferp-animate space-y-5">
      {/* Header */}
      <motion.div className="flex items-center justify-between" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white">Requisições</h2>
          <p className="text-sm" style={{ color: '#94a3b8' }}>{filtered.length} requisição(ões) encontrada(s)</p>
        </div>
        <button type="button" onClick={() => setShowNew(true)} className="ferp-btn-primary">
          <Plus className="h-4 w-4" /> Nova Requisição
        </button>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:col-span-8">
        {[
          { label: 'Total', value: stats.total, icon: Package, color: '#7c3aed' },
          { label: 'Pendentes', value: stats.pendente, icon: Clock, color: '#fbbf24' },
          { label: 'Em Análise', value: stats.emAnalise, icon: AlertCircle, color: '#60a5fa' },
          { label: 'Aprovadas', value: stats.aprovado, icon: CheckCircle2, color: '#4ade80' },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <motion.button
              key={s.label}
              type="button"
              onClick={() => setStatusFilter(s.label === 'Total' ? 'Todos' : s.label === 'Em Análise' ? 'Em Análise' : s.label.replace(/s$/, ''))}
              className="ferp-card p-4 text-left transition"
              style={{ background: 'var(--ferp-surface)' }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Icon className="h-5 w-5 mb-2" style={{ color: s.color }} />
              <p className="text-[22px] font-black text-white">{s.value}</p>
              <p className="text-[11px] font-semibold mt-0.5" style={{ color: '#64748b' }}>{s.label}</p>
            </motion.button>
          );
        })}
        </div>

        <motion.div className="ferp-card p-4 xl:col-span-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h3 className="mb-2 text-[13px] font-black text-white">Estado das requisições</h3>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusChart} innerRadius={36} outerRadius={58} dataKey="value" paddingAngle={2}>
                  {statusChart.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#100625', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="ferp-card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: '#64748b' }} />
          <input type="text" placeholder="Pesquisar requisição..." value={search} onChange={(e) => setSearch(e.target.value)} className="ferp-input pl-10" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="ferp-input" style={{ width: 'auto', minWidth: 130 }}>
          {['Todos', 'Pendente', 'Em Análise', 'Aprovado', 'Rejeitado'].map((s) => <option key={s} value={s} className="bg-[#0d0520]">{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="ferp-table-wrap ferp-card">
        <table className="ferp-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Título</th>
              <th>Fornecedor</th>
              <th>Valor</th>
              <th>Prioridade</th>
              <th>Estado</th>
              <th>Data</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td style={{ fontFamily: 'monospace', color: '#7c3aed', fontSize: 12, fontWeight: 700 }}>{r.id}</td>
                <td>
                  <p className="font-semibold text-white text-[13px]">{r.title}</p>
                  <p style={{ color: '#64748b', fontSize: 11 }}>por {r.requestedBy}</p>
                </td>
                <td style={{ color: '#94a3b8', fontSize: 12 }}>{r.supplier}</td>
                <td style={{ fontWeight: 700, color: '#c084fc' }}>{fmt(r.amount)}</td>
                <td>
                  <span className="ferp-badge" style={{ cssText: priorityBadge(r.priority) } as React.CSSProperties}>
                    {r.priority}
                  </span>
                </td>
                <td><span className={statusBadge(r.status)}>{r.status}</span></td>
                <td style={{ color: '#64748b', fontSize: 12 }}>{new Date(r.date).toLocaleDateString('pt-PT')}</td>
                <td>
                  <button type="button" onClick={() => setSelected(r)} className="ferp-btn-ghost" style={{ padding: '5px 10px', fontSize: 11 }}>
                    Ver <ChevronRight className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-end p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }} onClick={() => setSelected(null)}>
          <div className="w-full max-w-md h-full max-h-[90vh] overflow-y-auto rounded-[20px] p-6 space-y-5" style={{ background: 'linear-gradient(160deg, #120530, #080218)', border: '1px solid rgba(139,92,246,0.35)', boxShadow: '0 0 60px rgba(124,58,237,0.25)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-black text-white">Detalhes da Requisição</h3>
              <button type="button" onClick={() => setSelected(null)} className="ferp-btn-ghost" style={{ padding: '5px 8px' }}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2">
              <p style={{ fontFamily: 'monospace', color: '#7c3aed', fontSize: 12, fontWeight: 700 }}>{selected.id}</p>
              <h4 className="text-white font-bold text-[16px]">{selected.title}</h4>
              <div className="flex gap-2 flex-wrap">
                <span className={statusBadge(selected.status)}>{selected.status}</span>
                <span className="ferp-badge" style={{ cssText: priorityBadge(selected.priority) } as React.CSSProperties}>{selected.priority}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Fornecedor', value: selected.supplier },
                { label: 'Categoria', value: selected.category },
                { label: 'Valor', value: fmt(selected.amount) },
                { label: 'Requerido por', value: selected.requestedBy },
              ].map((f) => (
                <div key={f.label} className="rounded-[10px] p-3" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
                  <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#475569' }}>{f.label}</p>
                  <p className="text-[13px] font-bold text-white mt-0.5">{f.value}</p>
                </div>
              ))}
            </div>
            <div>
              <h4 className="mb-3 text-[13px] font-black text-white">Timeline</h4>
              <div className="space-y-3">
                {selected.timeline.map((t, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="ferp-timeline-dot mt-1" style={{ flexShrink: 0 }} />
                    <div>
                      <p className="text-[13px] font-semibold text-white">{t.action}</p>
                      <p style={{ color: '#64748b', fontSize: 11 }}>{t.by} • {new Date(t.date).toLocaleDateString('pt-PT')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {selected.status === 'Pendente' && (
              <div className="flex gap-3">
                <button type="button" className="ferp-btn-ghost flex-1 justify-center" style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}>
                  <XCircle className="h-4 w-4" /> Rejeitar
                </button>
                <button type="button" className="ferp-btn-primary flex-1 justify-center">
                  <CheckCircle2 className="h-4 w-4" /> Aprovar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Req Modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }} onClick={() => setShowNew(false)}>
          <div className="w-full max-w-lg rounded-[20px] p-6" style={{ background: 'linear-gradient(160deg, #110528, #0d0320)', border: '1px solid rgba(139,92,246,0.35)', boxShadow: '0 0 60px rgba(124,58,237,0.25)' }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-black text-white">Nova Requisição</h3>
              <button type="button" onClick={() => setShowNew(false)} className="ferp-btn-ghost" style={{ padding: '5px 8px' }}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Título', placeholder: 'Descrição da requisição' },
                { label: 'Valor estimado (€)', placeholder: '0.00' },
                { label: 'Requerido por', placeholder: 'Nome do colaborador' },
              ].map((f) => (
                <div key={f.label}>
                  <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider" style={{ color: '#94a3b8' }}>{f.label}</label>
                  <input type="text" placeholder={f.placeholder} className="ferp-input" />
                </div>
              ))}
              <div>
                <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider" style={{ color: '#94a3b8' }}>Fornecedor</label>
                <select className="ferp-input">
                  <option className="bg-[#0d0520]">TechServ Solutions</option>
                  <option className="bg-[#0d0520]">Office Plus Portugal</option>
                  <option className="bg-[#0d0520]">Limpeza Premium Lda</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider" style={{ color: '#94a3b8' }}>Prioridade</label>
                <select className="ferp-input">
                  {['Baixa', 'Média', 'Alta'].map((p) => <option key={p} className="bg-[#0d0520]">{p}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setShowNew(false)} className="ferp-btn-ghost flex-1 justify-center">Cancelar</button>
              <button type="button" onClick={() => setShowNew(false)} className="ferp-btn-primary flex-1 justify-center">
                <Package className="h-4 w-4" /> Submeter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
