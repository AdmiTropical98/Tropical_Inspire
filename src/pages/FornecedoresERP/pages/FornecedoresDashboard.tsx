import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Package,
  Star,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';

// ─── Mock data ─────────────────────────────────────────
const MONTHLY_SPEND = [
  { month: 'Jan', value: 38400 },
  { month: 'Fev', value: 42100 },
  { month: 'Mar', value: 31800 },
  { month: 'Abr', value: 55300 },
  { month: 'Mai', value: 47900 },
  { month: 'Jun', value: 62100 },
  { month: 'Jul', value: 58700 },
  { month: 'Ago', value: 44200 },
  { month: 'Set', value: 71400 },
  { month: 'Out', value: 66800 },
  { month: 'Nov', value: 83200 },
  { month: 'Dez', value: 79500 },
];

const TOP_SUPPLIERS = [
  { id: '1', name: 'TechServ Solutions', category: 'IT & Software', spend: 142300, rating: 4.8, active: true },
  { id: '2', name: 'Limpeza Premium Lda', category: 'Serviços', spend: 98400, rating: 4.5, active: true },
  { id: '3', name: 'Office Plus Portugal', category: 'Material de Escritório', spend: 74100, rating: 4.2, active: true },
  { id: '4', name: 'Segurança Total SA', category: 'Segurança', spend: 65800, rating: 4.7, active: true },
  { id: '5', name: 'Catering Express', category: 'Alimentação', spend: 53200, rating: 4.0, active: false },
];

const RECENT_ACTIVITY = [
  { id: 1, type: 'payment', text: 'Pagamento processado — TechServ Solutions', amount: '€ 12.400', time: 'há 2h', color: '#4ade80' },
  { id: 2, type: 'request', text: 'Nova requisição aprovada — Office Plus Portugal', amount: '€ 3.200', time: 'há 5h', color: '#c084fc' },
  { id: 3, type: 'supplier', text: 'Novo fornecedor adicionado — CleanCo Lda', amount: '', time: 'ontem', color: '#60a5fa' },
  { id: 4, type: 'payment', text: 'Pagamento pendente — Segurança Total SA', amount: '€ 8.750', time: 'ontem', color: '#fbbf24' },
  { id: 5, type: 'contract', text: 'Contrato renovado — Catering Express', amount: '€ 53.200/ano', time: '2 dias', color: '#a855f7' },
];

const STATS = [
  { label: 'Total Fornecedores', value: '148', sub: '+12 este mês', icon: Building2, color: '#7c3aed', glow: 'rgba(124,58,237,0.3)' },
  { label: 'Ativos', value: '127', sub: '85.8% do total', icon: CheckCircle2, color: '#4ade80', glow: 'rgba(74,222,128,0.2)' },
  { label: 'Pendentes', value: '21', sub: '7 aguardam aprovação', icon: Zap, color: '#fbbf24', glow: 'rgba(251,191,36,0.2)' },
  { label: 'Gasto Anual', value: '€ 721K', sub: '+18.4% vs ano anterior', icon: CreditCard, color: '#a855f7', glow: 'rgba(168,85,247,0.25)' },
];

// ─── Helpers ───────────────────────────────────────────
const maxSpend = Math.max(...MONTHLY_SPEND.map((m) => m.value));

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${i <= Math.round(rating) ? 'ferp-star' : 'ferp-star-empty'}`}
          fill={i <= Math.round(rating) ? '#fbbf24' : 'transparent'}
        />
      ))}
    </div>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

// ─── Component ─────────────────────────────────────────
export default function FornecedoresDashboard() {
  const navigate = useNavigate();

  return (
    <div className="ferp-animate space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            Visão Geral
          </h2>
          <p className="mt-0.5 text-sm" style={{ color: '#94a3b8' }}>
            {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/fornecedores-erp/gestao')}
          className="ferp-btn-primary"
        >
          <Building2 className="h-4 w-4" />
          Gerir Fornecedores
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="ferp-card ferp-stat-card ferp-card-glow">
              <div className="mb-4 flex items-start justify-between">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-[10px]"
                  style={{ background: `${stat.color}22`, boxShadow: `0 0 14px ${stat.glow}` }}
                >
                  <Icon className="h-5 w-5" style={{ color: stat.color }} />
                </div>
                <ArrowUpRight className="h-4 w-4" style={{ color: stat.color, opacity: 0.7 }} />
              </div>
              <p className="text-[28px] font-black tracking-tight text-white leading-none">
                {stat.value}
              </p>
              <p className="mt-1 text-[12px] font-semibold" style={{ color: '#94a3b8' }}>
                {stat.label}
              </p>
              <p className="mt-0.5 text-[11px]" style={{ color: stat.color }}>
                {stat.sub}
              </p>
            </div>
          );
        })}
      </div>

      {/* Middle row: chart + top suppliers */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Bar chart — monthly spend */}
        <div className="ferp-card ferp-card-glow xl:col-span-2 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-black text-white">Gastos Mensais</h3>
              <p className="text-[12px]" style={{ color: '#64748b' }}>
                Total acumulado: <span style={{ color: '#c084fc' }}>€ 721.400</span>
              </p>
            </div>
            <div className="ferp-badge ferp-badge-approved">
              <TrendingUp className="h-3 w-3" />
              +18.4%
            </div>
          </div>

          {/* Chart */}
          <div className="flex h-36 items-end gap-1.5">
            {MONTHLY_SPEND.map((m) => {
              const pct = (m.value / maxSpend) * 100;
              return (
                <div key={m.month} className="group flex flex-1 flex-col items-center gap-1">
                  <div
                    className="ferp-bar w-full relative"
                    style={{ height: `${pct}%`, minHeight: 4 }}
                    title={fmt(m.value)}
                  >
                    <div
                      className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-bold text-white"
                      style={{ background: 'rgba(30,10,60,0.95)', border: '1px solid rgba(139,92,246,0.4)' }}
                    >
                      {fmt(m.value)}
                    </div>
                  </div>
                  <span className="text-[9px] font-bold uppercase" style={{ color: '#475569' }}>{m.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Categoria breakdown */}
        <div className="ferp-card ferp-card-glow p-5">
          <h3 className="mb-4 text-[15px] font-black text-white">Por Categoria</h3>
          <div className="space-y-3">
            {[
              { cat: 'IT & Software', pct: 68, color: '#7c3aed' },
              { cat: 'Serviços', pct: 52, color: '#a855f7' },
              { cat: 'Material Escritório', pct: 38, color: '#c084fc' },
              { cat: 'Segurança', pct: 31, color: '#818cf8' },
              { cat: 'Alimentação', pct: 25, color: '#6366f1' },
              { cat: 'Outros', pct: 18, color: '#4f46e5' },
            ].map((item) => (
              <div key={item.cat}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[12px] font-semibold" style={{ color: '#cbd5e1' }}>{item.cat}</span>
                  <span className="text-[11px] font-bold" style={{ color: item.color }}>{item.pct}%</span>
                </div>
                <div className="ferp-progress">
                  <div className="ferp-progress-fill" style={{ width: `${item.pct}%`, background: `linear-gradient(90deg, ${item.color}, ${item.color}bb)` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row: top suppliers + recent activity */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Top Suppliers */}
        <div className="ferp-card ferp-card-glow p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[15px] font-black text-white">Top Fornecedores</h3>
            <button
              type="button"
              onClick={() => navigate('/fornecedores-erp/gestao')}
              className="ferp-btn-ghost"
              style={{ fontSize: 11, padding: '5px 10px' }}
            >
              Ver todos <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-2">
            {TOP_SUPPLIERS.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => navigate(`/fornecedores-erp/gestao/perfil/${s.id}`)}
                className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition"
                style={{ background: 'rgba(124,58,237,0.05)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(124,58,237,0.12)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(124,58,237,0.05)'; }}
              >
                <span
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-black"
                  style={{ background: 'rgba(124,58,237,0.2)', color: '#c084fc' }}
                >
                  {idx + 1}
                </span>
                <div className="ferp-avatar">{s.name.charAt(0)}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-white">{s.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px]" style={{ color: '#64748b' }}>{s.category}</span>
                    <Stars rating={s.rating} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-black" style={{ color: '#c084fc' }}>{fmt(s.spend)}</p>
                  <span className={`ferp-badge ${s.active ? 'ferp-badge-active' : 'ferp-badge-inactive'}`}>
                    {s.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="ferp-card ferp-card-glow p-5">
          <h3 className="mb-4 text-[15px] font-black text-white">Atividade Recente</h3>
          <div className="relative space-y-0">
            {RECENT_ACTIVITY.map((a, idx) => (
              <div key={a.id} className="relative flex items-start gap-3 pb-4">
                {idx < RECENT_ACTIVITY.length - 1 && (
                  <div
                    className="absolute left-[7px] top-5 bottom-0 w-px"
                    style={{ background: 'rgba(139,92,246,0.15)' }}
                  />
                )}
                <div
                  className="ferp-timeline-dot mt-1"
                  style={{ background: a.color, boxShadow: `0 0 8px ${a.color}` }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-white leading-tight">{a.text}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    {a.amount && (
                      <span className="text-[12px] font-bold" style={{ color: a.color }}>{a.amount}</span>
                    )}
                    <span className="text-[11px]" style={{ color: '#475569' }}>• {a.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="ferp-card p-5">
        <h3 className="mb-4 text-[14px] font-black text-white">Ações Rápidas</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Novo Fornecedor', icon: Building2, path: '/fornecedores-erp/gestao', color: '#7c3aed' },
            { label: 'Nova Requisição', icon: Package, path: '/fornecedores-erp/requisicoes', color: '#a855f7' },
            { label: 'Registar Pagamento', icon: CreditCard, path: '/fornecedores-erp/pagamentos', color: '#818cf8' },
            { label: 'Ver Relatórios', icon: TrendingUp, path: '/fornecedores-erp/relatorios', color: '#c084fc' },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                onClick={() => navigate(action.path)}
                className="flex flex-col items-center gap-2 rounded-[12px] p-4 text-center transition"
                style={{
                  background: `${action.color}11`,
                  border: `1px solid ${action.color}33`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = `${action.color}22`; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = `${action.color}11`; }}
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-[9px]"
                  style={{ background: `${action.color}22` }}
                >
                  <Icon className="h-5 w-5" style={{ color: action.color }} />
                </div>
                <span className="text-[12px] font-bold text-white">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
