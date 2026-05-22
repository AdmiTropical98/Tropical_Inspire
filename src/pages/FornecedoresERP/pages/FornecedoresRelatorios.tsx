import {
  BarChart3,
  Download,
  FileText,
  Star,
  TrendingUp,
} from 'lucide-react';

// ─── Mock data ───────────────────────────────────────────────────────────────
const TOP_BY_SPEND = [
  { name: 'TechServ Solutions', spend: 142300, pct: 100 },
  { name: 'Limpeza Premium Lda', spend: 98400, pct: 69 },
  { name: 'Office Plus Portugal', spend: 74100, pct: 52 },
  { name: 'Segurança Total SA', spend: 65800, pct: 46 },
  { name: 'Catering Express', spend: 53200, pct: 37 },
  { name: 'LogiTrans Portugal', spend: 47800, pct: 34 },
  { name: 'Distribuidora Ibérica', spend: 38900, pct: 27 },
];

const TOP_BY_RATING = [
  { name: 'TechServ Solutions', rating: 4.8, cat: 'IT & Software' },
  { name: 'Segurança Total SA', rating: 4.7, cat: 'Segurança' },
  { name: 'Limpeza Premium Lda', rating: 4.5, cat: 'Serviços' },
  { name: 'LogiTrans Portugal', rating: 4.3, cat: 'Logística' },
  { name: 'Office Plus Portugal', rating: 4.2, cat: 'Material Escritório' },
];

const MONTHLY_TREND = [
  { month: 'Jan', spend: 38400, suppliers: 12 },
  { month: 'Fev', spend: 42100, suppliers: 14 },
  { month: 'Mar', spend: 31800, suppliers: 11 },
  { month: 'Abr', spend: 55300, suppliers: 16 },
  { month: 'Mai', spend: 47900, suppliers: 15 },
  { month: 'Jun', spend: 62100, suppliers: 18 },
  { month: 'Jul', spend: 58700, suppliers: 17 },
  { month: 'Ago', spend: 44200, suppliers: 14 },
  { month: 'Set', spend: 71400, suppliers: 20 },
  { month: 'Out', spend: 66800, suppliers: 19 },
  { month: 'Nov', spend: 83200, suppliers: 22 },
  { month: 'Dez', spend: 79500, suppliers: 21 },
];

const KPI = [
  { label: 'Total Gasto', value: '€ 721.400', sub: '+18.4% vs 2023', color: '#c084fc', icon: TrendingUp },
  { label: 'Fornecedores Ativos', value: '127', sub: '85.8% do total', color: '#4ade80', icon: BarChart3 },
  { label: 'Avaliação Média', value: '4.3 / 5', sub: 'Top 5 avaliados', color: '#fbbf24', icon: Star },
  { label: 'Documentos', value: '10', sub: '3 contratos ativos', color: '#60a5fa', icon: FileText },
];

function fmt(n: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

const maxSpend = Math.max(...MONTHLY_TREND.map((m) => m.spend));

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-3 w-3 ${i <= Math.round(rating) ? 'ferp-star' : 'ferp-star-empty'}`} fill={i <= Math.round(rating) ? '#fbbf24' : 'transparent'} />
      ))}
      <span className="ml-1 text-[11px] font-bold" style={{ color: '#fbbf24' }}>{rating.toFixed(1)}</span>
    </div>
  );
}

export default function FornecedoresRelatorios() {
  return (
    <div className="ferp-animate space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white">Relatórios & Analytics</h2>
          <p className="text-sm" style={{ color: '#94a3b8' }}>Ano fiscal 2024 · Dados atualizados</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="ferp-btn-ghost" style={{ fontSize: 12 }}>
            <Download className="h-4 w-4" /> Exportar PDF
          </button>
          <button type="button" className="ferp-btn-primary" style={{ fontSize: 12 }}>
            <Download className="h-4 w-4" /> Exportar Excel
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {KPI.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="ferp-card ferp-card-glow p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-[9px]" style={{ background: `${k.color}18` }}>
                  <Icon className="h-5 w-5" style={{ color: k.color }} />
                </div>
              </div>
              <p className="text-[26px] font-black text-white">{k.value}</p>
              <p className="text-[11px] font-semibold mt-0.5" style={{ color: '#64748b' }}>{k.label}</p>
              <p className="text-[11px] mt-0.5" style={{ color: k.color }}>{k.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Trend chart */}
      <div className="ferp-card ferp-card-glow p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-black text-white">Evolução de Gastos 2024</h3>
            <p className="text-[12px]" style={{ color: '#64748b' }}>Gasto mensal acumulado em todos os fornecedores</p>
          </div>
          <div className="text-right">
            <p className="text-[20px] font-black" style={{ color: '#c084fc' }}>€ 721.400</p>
            <p className="text-[11px]" style={{ color: '#4ade80' }}>▲ 18.4% vs 2023</p>
          </div>
        </div>
        <div className="flex h-44 items-end gap-2">
          {MONTHLY_TREND.map((m) => {
            const pct = (m.spend / maxSpend) * 100;
            return (
              <div key={m.month} className="group flex flex-1 flex-col items-center gap-1">
                <div className="relative w-full">
                  <div
                    className="ferp-bar w-full"
                    style={{ height: `${(pct / 100) * 160}px`, minHeight: 4 }}
                    title={fmt(m.spend)}
                  >
                    <div
                      className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center whitespace-nowrap"
                    >
                      <div
                        className="rounded-[8px] px-2.5 py-1.5 text-[10px] font-bold text-white"
                        style={{ background: 'rgba(30,10,60,0.95)', border: '1px solid rgba(139,92,246,0.4)' }}
                      >
                        <p>{fmt(m.spend)}</p>
                        <p style={{ color: '#94a3b8' }}>{m.suppliers} fornec.</p>
                      </div>
                    </div>
                  </div>
                </div>
                <span className="text-[9px] font-bold uppercase" style={{ color: '#475569' }}>{m.month}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Top by spend */}
        <div className="ferp-card ferp-card-glow p-5">
          <h3 className="mb-4 text-[15px] font-black text-white">Top Fornecedores por Gasto</h3>
          <div className="space-y-4">
            {TOP_BY_SPEND.map((s, idx) => (
              <div key={s.name}>
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black flex-shrink-0"
                      style={{ background: 'rgba(124,58,237,0.2)', color: '#c084fc' }}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-[13px] font-semibold text-white">{s.name}</span>
                  </div>
                  <span className="text-[13px] font-black" style={{ color: '#c084fc' }}>{fmt(s.spend)}</span>
                </div>
                <div className="ferp-progress">
                  <div className="ferp-progress-fill" style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top by rating */}
        <div className="ferp-card ferp-card-glow p-5">
          <h3 className="mb-4 text-[15px] font-black text-white">Melhor Avaliados</h3>
          <div className="space-y-3">
            {TOP_BY_RATING.map((s, idx) => (
              <div key={s.name} className="flex items-center gap-3 rounded-[10px] p-3" style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(139,92,246,0.1)' }}>
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-black flex-shrink-0"
                  style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}
                >
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-[13px] truncate">{s.name}</p>
                  <p style={{ color: '#64748b', fontSize: 11 }}>{s.cat}</p>
                </div>
                <Stars rating={s.rating} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="ferp-card ferp-card-glow p-5">
        <h3 className="mb-5 text-[15px] font-black text-white">Gastos por Categoria</h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            { cat: 'IT & Software', value: 142300, pct: 45, color: '#7c3aed' },
            { cat: 'Serviços', value: 98400, pct: 31, color: '#a855f7' },
            { cat: 'Material Escritório', value: 74100, pct: 23, color: '#818cf8' },
            { cat: 'Segurança', value: 65800, pct: 20, color: '#6366f1' },
            { cat: 'Alimentação', value: 53200, pct: 17, color: '#c084fc' },
            { cat: 'Logística & Outros', value: 86600, pct: 27, color: '#4f46e5' },
          ].map((item) => (
            <div key={item.cat} className="rounded-[12px] p-4" style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(139,92,246,0.12)' }}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-bold" style={{ color: '#cbd5e1' }}>{item.cat}</span>
                <span className="text-[12px] font-black" style={{ color: item.color }}>{item.pct}%</span>
              </div>
              <p className="text-[18px] font-black text-white">{fmt(item.value)}</p>
              <div className="ferp-progress mt-2">
                <div className="ferp-progress-fill" style={{ width: `${item.pct}%`, background: `linear-gradient(90deg, ${item.color}, ${item.color}80)` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
