import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Bell,
  Building2,
  CheckCircle2,
  CircleAlert,
  Clock3,
  CreditCard,
  FileClock,
  Filter,
  Search,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';

type SupplierState = 'Ativo' | 'Pendente' | 'Inativo';

interface SupplierRow {
  id: string;
  logo: string;
  nome: string;
  categoria: string;
  estado: SupplierState;
  gasto: number;
  pagamentos: number;
  requisicoes: number;
}

const monthlyEvolution = [
  { mes: 'Jan', gasto: 38400, pagamentos: 16, ativos: 106 },
  { mes: 'Fev', gasto: 42100, pagamentos: 18, ativos: 108 },
  { mes: 'Mar', gasto: 31800, pagamentos: 12, ativos: 109 },
  { mes: 'Abr', gasto: 55300, pagamentos: 21, ativos: 112 },
  { mes: 'Mai', gasto: 47900, pagamentos: 20, ativos: 114 },
  { mes: 'Jun', gasto: 62100, pagamentos: 26, ativos: 117 },
  { mes: 'Jul', gasto: 58700, pagamentos: 22, ativos: 118 },
  { mes: 'Ago', gasto: 44200, pagamentos: 18, ativos: 120 },
  { mes: 'Set', gasto: 71400, pagamentos: 31, ativos: 123 },
  { mes: 'Out', gasto: 66800, pagamentos: 28, ativos: 125 },
  { mes: 'Nov', gasto: 83200, pagamentos: 33, ativos: 127 },
  { mes: 'Dez', gasto: 79500, pagamentos: 30, ativos: 127 },
];

const paymentBreakdown = [
  { nome: 'Pago', valor: 520000, color: '#4ade80' },
  { nome: 'Pendente', valor: 148000, color: '#fbbf24' },
  { nome: 'Vencido', valor: 53400, color: '#f87171' },
];

const categoryData = [
  { categoria: 'IT & Software', valor: 142300 },
  { categoria: 'Serviços', valor: 98400 },
  { categoria: 'Material Escritório', valor: 74100 },
  { categoria: 'Segurança', valor: 65800 },
  { categoria: 'Logística', valor: 61200 },
  { categoria: 'Outros', valor: 39700 },
];

const analyticsRadar = [
  { eixo: 'SLA', score: 91 },
  { eixo: 'Qualidade', score: 88 },
  { eixo: 'Conformidade', score: 94 },
  { eixo: 'Preço', score: 79 },
  { eixo: 'Risco', score: 70 },
  { eixo: 'Inovação', score: 86 },
];

const suppliers: SupplierRow[] = [
  { id: '1', logo: 'TS', nome: 'TechServ Solutions', categoria: 'IT & Software', estado: 'Ativo', gasto: 142300, pagamentos: 24, requisicoes: 9 },
  { id: '2', logo: 'LP', nome: 'Limpeza Premium Lda', categoria: 'Serviços', estado: 'Ativo', gasto: 98400, pagamentos: 18, requisicoes: 7 },
  { id: '3', logo: 'OP', nome: 'Office Plus Portugal', categoria: 'Material Escritório', estado: 'Ativo', gasto: 74100, pagamentos: 16, requisicoes: 11 },
  { id: '4', logo: 'ST', nome: 'Segurança Total SA', categoria: 'Segurança', estado: 'Ativo', gasto: 65800, pagamentos: 12, requisicoes: 5 },
  { id: '5', logo: 'CB', nome: 'Consult Business Group', categoria: 'Consultoria', estado: 'Pendente', gasto: 24100, pagamentos: 5, requisicoes: 4 },
  { id: '6', logo: 'LG', nome: 'LogiTrans Portugal', categoria: 'Logística', estado: 'Ativo', gasto: 61200, pagamentos: 15, requisicoes: 8 },
  { id: '7', logo: 'SC', nome: 'SoftCloud Lda', categoria: 'IT & Software', estado: 'Pendente', gasto: 19800, pagamentos: 3, requisicoes: 6 },
  { id: '8', logo: 'PX', nome: 'Print & Design Studio', categoria: 'Outros', estado: 'Inativo', gasto: 9100, pagamentos: 2, requisicoes: 1 },
];

const rightSideFeed = {
  atividade: [
    'Contrato renovado com TechServ Solutions por 24 meses',
    'Nova requisição REQ-2026-014 enviada para aprovação',
    'KPI de conformidade subiu para 94% esta semana',
    'Onboarding de fornecedor SoftCloud concluído',
  ],
  pagamentos: [
    { nome: 'TechServ Solutions', valor: 12400, quando: 'há 2h' },
    { nome: 'Office Plus Portugal', valor: 3200, quando: 'hoje' },
    { nome: 'Segurança Total SA', valor: 8750, quando: 'ontem' },
  ],
  notificacoes: [
    { tipo: 'warning', txt: '3 pagamentos vencem em 48h' },
    { tipo: 'info', txt: '2 fornecedores aguardam validação fiscal' },
    { tipo: 'success', txt: 'Backup documental concluído com sucesso' },
  ],
  contratos: [
    { fornecedor: 'Limpeza Premium Lda', dias: 14 },
    { fornecedor: 'Segurança Total SA', dias: 22 },
    { fornecedor: 'Print & Design Studio', dias: 30 },
  ],
};

const cards = [
  { label: 'Total fornecedores', value: '148', icon: Building2, delta: '+12 este mês', color: '#a855f7' },
  { label: 'Ativos', value: '127', icon: CheckCircle2, delta: '85.8% do total', color: '#4ade80' },
  { label: 'Pendentes', value: '21', icon: Clock3, delta: '7 em revisão', color: '#fbbf24' },
  { label: 'Pagamentos', value: '73', icon: CreditCard, delta: '+9 esta semana', color: '#60a5fa' },
  { label: 'Gastos mensais', value: 'EUR 79.5K', icon: Wallet, delta: '+18.4% YoY', color: '#c084fc' },
  { label: 'Requisições abertas', value: '19', icon: FileClock, delta: '5 críticas', color: '#f97316' },
];

function currency(v: number) {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(v);
}

function badgeClass(estado: SupplierState) {
  if (estado === 'Ativo') return 'ferp-badge ferp-badge-active';
  if (estado === 'Pendente') return 'ferp-badge ferp-badge-pending';
  return 'ferp-badge ferp-badge-inactive';
}

export default function FornecedoresDashboard() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'Todos' | SupplierState>('Todos');

  const filteredSuppliers = useMemo(
    () =>
      suppliers.filter((s) => {
        const searchOk =
          s.nome.toLowerCase().includes(search.toLowerCase()) ||
          s.categoria.toLowerCase().includes(search.toLowerCase());
        const statusOk = status === 'Todos' || s.estado === status;
        return searchOk && statusOk;
      }),
    [search, status],
  );

  return (
    <div className="ferp-animate space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white">Dashboard Fornecedores</h2>
          <p className="text-sm" style={{ color: '#94a3b8' }}>Controle operativo, financeiro e analítico em tempo real</p>
        </div>
        <button type="button" onClick={() => navigate('/fornecedores-erp/relatorios')} className="ferp-btn-primary">
          <Sparkles className="h-4 w-4" /> Analytics Executivo
        </button>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-6">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              className="ferp-card ferp-stat-card ferp-card-glow"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ background: `${card.color}20` }}>
                  <Icon className="h-5 w-5" style={{ color: card.color }} />
                </div>
                <TrendingUp className="h-4 w-4" style={{ color: card.color }} />
              </div>
              <p className="text-[23px] font-black text-white leading-none">{card.value}</p>
              <p className="mt-1 text-[12px] font-semibold" style={{ color: '#94a3b8' }}>{card.label}</p>
              <p className="text-[11px]" style={{ color: card.color }}>{card.delta}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-12">
        <div className="space-y-5 2xl:col-span-9">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <motion.div className="ferp-card ferp-card-glow p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h3 className="mb-4 text-[14px] font-black text-white">Evolução mensal</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyEvolution}>
                    <defs>
                      <linearGradient id="evolucao" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="mes" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v: number) => currency(v)} contentStyle={{ background: '#100625', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 10 }} />
                    <Area type="monotone" dataKey="gasto" stroke="#c084fc" strokeWidth={2.5} fill="url(#evolucao)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div className="ferp-card ferp-card-glow p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}>
              <h3 className="mb-4 text-[14px] font-black text-white">Pagamentos</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentBreakdown} innerRadius={52} outerRadius={84} dataKey="valor" paddingAngle={3}>
                      {paymentBreakdown.map((entry) => (
                        <Cell key={entry.nome} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => currency(v)} contentStyle={{ background: '#100625', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 10 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <motion.div className="ferp-card ferp-card-glow p-5 xl:col-span-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              <h3 className="mb-4 text-[14px] font-black text-white">Categorias</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData}>
                    <XAxis dataKey="categoria" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v: number) => currency(v)} contentStyle={{ background: '#100625', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 10 }} />
                    <Bar dataKey="valor" fill="#a855f7" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div className="ferp-card ferp-card-glow p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
              <h3 className="mb-4 text-[14px] font-black text-white">Analytics</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={analyticsRadar}>
                    <PolarGrid stroke="rgba(139,92,246,0.2)" />
                    <PolarAngleAxis dataKey="eixo" stroke="#94a3b8" fontSize={10} />
                    <Radar dataKey="score" stroke="#c084fc" fill="#a855f7" fillOpacity={0.35} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          <motion.div className="ferp-card ferp-card-glow p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-[14px] font-black text-white">Fornecedores ativos</h3>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: '#64748b' }} />
                  <input className="ferp-input pl-8" style={{ width: 220 }} placeholder="Pesquisar fornecedor" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <div className="relative">
                  <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: '#64748b' }} />
                  <select className="ferp-input pl-8" style={{ width: 140 }} value={status} onChange={(e) => setStatus(e.target.value as 'Todos' | SupplierState)}>
                    <option className="bg-[#0d0520]">Todos</option>
                    <option className="bg-[#0d0520]">Ativo</option>
                    <option className="bg-[#0d0520]">Pendente</option>
                    <option className="bg-[#0d0520]">Inativo</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="ferp-table-wrap">
              <table className="ferp-table">
                <thead>
                  <tr>
                    <th>Fornecedor</th>
                    <th>Categoria</th>
                    <th>Estado</th>
                    <th>Valor gasto</th>
                    <th>Ações rápidas</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="ferp-avatar" style={{ width: 32, height: 32, borderRadius: 999 }}>{row.logo}</div>
                          <div>
                            <p className="text-[13px] font-bold text-white">{row.nome}</p>
                            <p className="text-[11px]" style={{ color: '#64748b' }}>{row.pagamentos} pagamentos • {row.requisicoes} requisições</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: '#94a3b8' }}>{row.categoria}</td>
                      <td><span className={badgeClass(row.estado)}>{row.estado}</span></td>
                      <td style={{ color: '#c084fc', fontWeight: 700 }}>{currency(row.gasto)}</td>
                      <td>
                        <div className="flex gap-2">
                          <button className="ferp-btn-ghost" style={{ padding: '6px 10px', fontSize: 11 }} onClick={() => navigate(`/fornecedores-erp/gestao/perfil/${row.id}`)} type="button">Perfil</button>
                          <button className="ferp-btn-ghost" style={{ padding: '6px 10px', fontSize: 11 }} onClick={() => navigate('/fornecedores-erp/pagamentos')} type="button">Pagamento</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>

        <aside className="space-y-5 2xl:col-span-3">
          <motion.div className="ferp-card ferp-card-glow p-5" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
            <h3 className="mb-3 flex items-center gap-2 text-[14px] font-black text-white"><Sparkles className="h-4 w-4 text-[#c084fc]" /> Atividade recente</h3>
            <div className="space-y-3">
              {rightSideFeed.atividade.map((item) => (
                <div key={item} className="rounded-[10px] p-3" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(139,92,246,0.16)' }}>
                  <p className="text-[12px] font-semibold text-white">{item}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div className="ferp-card ferp-card-glow p-5" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }}>
            <h3 className="mb-3 flex items-center gap-2 text-[14px] font-black text-white"><CreditCard className="h-4 w-4 text-[#4ade80]" /> Pagamentos recentes</h3>
            <div className="space-y-3">
              {rightSideFeed.pagamentos.map((p) => (
                <div key={p.nome + p.quando} className="flex items-center justify-between rounded-[10px] p-3" style={{ background: 'rgba(74,222,128,0.06)' }}>
                  <div>
                    <p className="text-[12px] font-semibold text-white">{p.nome}</p>
                    <p className="text-[11px]" style={{ color: '#64748b' }}>{p.quando}</p>
                  </div>
                  <p className="text-[12px] font-bold" style={{ color: '#4ade80' }}>{currency(p.valor)}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div className="ferp-card ferp-card-glow p-5" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <h3 className="mb-3 flex items-center gap-2 text-[14px] font-black text-white"><Bell className="h-4 w-4 text-[#fbbf24]" /> Notificações</h3>
            <div className="space-y-2">
              {rightSideFeed.notificacoes.map((n) => (
                <div key={n.txt} className="flex items-start gap-2 rounded-[10px] p-2.5" style={{ background: 'rgba(124,58,237,0.08)' }}>
                  <CircleAlert className="mt-0.5 h-4 w-4" style={{ color: n.tipo === 'warning' ? '#fbbf24' : n.tipo === 'success' ? '#4ade80' : '#60a5fa' }} />
                  <p className="text-[12px] text-white">{n.txt}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div className="ferp-card ferp-card-glow p-5" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
            <h3 className="mb-3 flex items-center gap-2 text-[14px] font-black text-white"><FileClock className="h-4 w-4 text-[#f97316]" /> Contratos a expirar</h3>
            <div className="space-y-2">
              {rightSideFeed.contratos.map((c) => (
                <div key={c.fornecedor} className="flex items-center justify-between rounded-[10px] px-3 py-2.5" style={{ background: 'rgba(249,115,22,0.08)' }}>
                  <span className="text-[12px] text-white">{c.fornecedor}</span>
                  <span className="text-[11px] font-black" style={{ color: '#fb923c' }}>{c.dias} dias</span>
                </div>
              ))}
            </div>
          </motion.div>
        </aside>
      </div>

      <motion.div className="ferp-card ferp-card-glow p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <h3 className="mb-4 text-[14px] font-black text-white">Fornecedores ativos (trend)</h3>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyEvolution}>
              <XAxis dataKey="mes" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: '#100625', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 10 }} />
              <Line type="monotone" dataKey="ativos" stroke="#60a5fa" strokeWidth={2.5} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}
