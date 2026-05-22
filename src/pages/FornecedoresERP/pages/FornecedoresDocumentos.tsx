import { useState } from 'react';
import { motion } from 'framer-motion';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Download,
  Eye,
  File,
  FileText,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

// ─── Mock data ───────────────────────────────────────────────────────────────
interface Doc {
  id: string;
  name: string;
  type: 'Contrato' | 'Fatura' | 'Proposta' | 'Fiscal' | 'Certificado' | 'Outro';
  supplier: string;
  size: string;
  date: string;
  uploadedBy: string;
}

const DOCUMENTS: Doc[] = [
  { id: 'd1', name: 'Contrato Principal TechServ 2024-2026.pdf', type: 'Contrato', supplier: 'TechServ Solutions', size: '2.4 MB', date: '2024-01-15', uploadedBy: 'Maria Costa' },
  { id: 'd2', name: 'Proposta Comercial Q1 2025 — TechServ.pdf', type: 'Proposta', supplier: 'TechServ Solutions', size: '1.1 MB', date: '2024-12-20', uploadedBy: 'João Silva' },
  { id: 'd3', name: 'NIF TechServ Solutions.pdf', type: 'Fiscal', supplier: 'TechServ Solutions', size: '0.3 MB', date: '2021-03-15', uploadedBy: 'Admin' },
  { id: 'd4', name: 'Contrato Limpeza 2023-2025.pdf', type: 'Contrato', supplier: 'Limpeza Premium Lda', size: '1.8 MB', date: '2023-01-01', uploadedBy: 'Ana Ferreira' },
  { id: 'd5', name: 'Fatura LPL-2024-112.pdf', type: 'Fatura', supplier: 'Limpeza Premium Lda', size: '0.4 MB', date: '2024-12-31', uploadedBy: 'Sistema' },
  { id: 'd6', name: 'Certificado ISO 9001 — Segurança Total.pdf', type: 'Certificado', supplier: 'Segurança Total SA', size: '0.6 MB', date: '2023-06-10', uploadedBy: 'Pedro Alves' },
  { id: 'd7', name: 'Contrato Segurança 2019-2025.pdf', type: 'Contrato', supplier: 'Segurança Total SA', size: '3.2 MB', date: '2019-11-30', uploadedBy: 'Admin' },
  { id: 'd8', name: 'Fatura TS-2024-089.pdf', type: 'Fatura', supplier: 'TechServ Solutions', size: '0.5 MB', date: '2024-11-30', uploadedBy: 'Sistema' },
  { id: 'd9', name: 'Declaração Atividade Office Plus.pdf', type: 'Fiscal', supplier: 'Office Plus Portugal', size: '0.2 MB', date: '2022-01-08', uploadedBy: 'Carla Mendes' },
  { id: 'd10', name: 'Proposta LogiTrans Q4 2024.pdf', type: 'Proposta', supplier: 'LogiTrans Portugal', size: '0.9 MB', date: '2024-09-15', uploadedBy: 'Ricardo Santos' },
];

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Contrato: { bg: 'rgba(124,58,237,0.15)', text: '#c084fc', border: 'rgba(139,92,246,0.3)' },
  Fatura: { bg: 'rgba(74,222,128,0.12)', text: '#4ade80', border: 'rgba(74,222,128,0.25)' },
  Proposta: { bg: 'rgba(96,165,250,0.12)', text: '#60a5fa', border: 'rgba(96,165,250,0.25)' },
  Fiscal: { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24', border: 'rgba(251,191,36,0.25)' },
  Certificado: { bg: 'rgba(52,211,153,0.12)', text: '#34d399', border: 'rgba(52,211,153,0.25)' },
  Outro: { bg: 'rgba(148,163,184,0.1)', text: '#94a3b8', border: 'rgba(148,163,184,0.2)' },
};

const TYPES = ['Todos', 'Contrato', 'Fatura', 'Proposta', 'Fiscal', 'Certificado', 'Outro'];

export default function FornecedoresDocumentos() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('Todos');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [showUpload, setShowUpload] = useState(false);
  const [drag, setDrag] = useState(false);

  const filtered = DOCUMENTS.filter((d) => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) || d.supplier.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'Todos' || d.type === typeFilter;
    return matchSearch && matchType;
  });

  const byType = TYPES.slice(1).map((t) => ({
    type: t,
    count: DOCUMENTS.filter((d) => d.type === t).length,
  }));

  const pieData = byType.map((item) => ({
    name: item.type,
    value: item.count,
    color: TYPE_COLORS[item.type].text,
  }));

  return (
    <div className="ferp-animate space-y-5">
      {/* Header */}
      <motion.div className="flex items-center justify-between" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white">Documentos</h2>
          <p className="text-sm" style={{ color: '#94a3b8' }}>{filtered.length} documento(s)</p>
        </div>
        <button type="button" onClick={() => setShowUpload(true)} className="ferp-btn-primary">
          <Upload className="h-4 w-4" /> Upload Documento
        </button>
      </motion.div>

      <motion.div className="ferp-card p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-[13px] font-black text-white">Distribuição documental</h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" outerRadius={62} innerRadius={34}>
                    {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#100625', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="space-y-2">
            {byType.map((item) => (
              <div key={item.type} className="flex items-center justify-between rounded-[10px] px-3 py-2" style={{ background: 'rgba(124,58,237,0.08)' }}>
                <span className="text-[12px] text-white">{item.type}</span>
                <span className="text-[12px] font-black" style={{ color: TYPE_COLORS[item.type].text }}>{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Type summary */}
      <div className="flex flex-wrap gap-2">
        {byType.map((t) => {
          const colors = TYPE_COLORS[t.type];
          return (
            <button
              key={t.type}
              type="button"
              onClick={() => setTypeFilter(typeFilter === t.type ? 'Todos' : t.type)}
              className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-[12px] font-bold transition"
              style={{
                background: typeFilter === t.type ? colors.bg : 'rgba(15,5,40,0.6)',
                border: `1px solid ${typeFilter === t.type ? colors.border : 'rgba(139,92,246,0.15)'}`,
                color: typeFilter === t.type ? colors.text : '#64748b',
              }}
            >
              {t.type}
              <span
                className="rounded-full px-1.5 py-0 text-[10px] font-black"
                style={{ background: colors.bg, color: colors.text }}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters + view toggle */}
      <div className="ferp-card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: '#64748b' }} />
          <input type="text" placeholder="Pesquisar documento ou fornecedor..." value={search} onChange={(e) => setSearch(e.target.value)} className="ferp-input pl-10" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="ferp-input" style={{ width: 'auto', minWidth: 120 }}>
          {TYPES.map((t) => <option key={t} value={t} className="bg-[#0d0520]">{t}</option>)}
        </select>
        <div className="flex rounded-[10px] overflow-hidden" style={{ border: '1px solid rgba(139,92,246,0.2)' }}>
          {(['grid', 'list'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className="px-3 py-2 text-[12px] font-bold transition"
              style={{
                background: view === v ? 'rgba(124,58,237,0.3)' : 'transparent',
                color: view === v ? '#c084fc' : '#64748b',
              }}
            >
              {v === 'grid' ? '⊞' : '≡'} {v === 'grid' ? 'Grid' : 'Lista'}
            </button>
          ))}
        </div>
      </div>

      {/* Documents */}
      {view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((doc) => {
            const colors = TYPE_COLORS[doc.type];
            return (
              <div key={doc.id} className="ferp-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[10px]" style={{ background: colors.bg }}>
                    <FileText className="h-5 w-5" style={{ color: colors.text }} />
                  </div>
                  <span className="ferp-badge" style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, fontSize: 9 }}>
                    {doc.type}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-white text-[13px] leading-tight line-clamp-2">{doc.name}</p>
                  <p className="mt-1 text-[11px]" style={{ color: '#64748b' }}>{doc.supplier}</p>
                </div>
                <div className="flex items-center justify-between text-[11px]" style={{ color: '#475569' }}>
                  <span>{doc.size}</span>
                  <span>{new Date(doc.date).toLocaleDateString('pt-PT')}</span>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="ferp-btn-ghost flex-1 justify-center" style={{ padding: '6px 10px', fontSize: 11 }}>
                    <Eye className="h-3 w-3" /> Ver
                  </button>
                  <button type="button" className="ferp-btn-ghost flex-1 justify-center" style={{ padding: '6px 10px', fontSize: 11 }}>
                    <Download className="h-3 w-3" /> Download
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="ferp-table-wrap ferp-card">
          <table className="ferp-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Fornecedor</th>
                <th>Tamanho</th>
                <th>Data</th>
                <th>Upload por</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => {
                const colors = TYPE_COLORS[doc.type];
                return (
                  <tr key={doc.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[8px]" style={{ background: colors.bg }}>
                          <File className="h-4 w-4" style={{ color: colors.text }} />
                        </div>
                        <span className="font-semibold text-white text-[13px] max-w-[200px] truncate">{doc.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="ferp-badge" style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
                        {doc.type}
                      </span>
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: 12 }}>{doc.supplier}</td>
                    <td style={{ color: '#64748b', fontSize: 12 }}>{doc.size}</td>
                    <td style={{ color: '#64748b', fontSize: 12 }}>{new Date(doc.date).toLocaleDateString('pt-PT')}</td>
                    <td style={{ color: '#64748b', fontSize: 12 }}>{doc.uploadedBy}</td>
                    <td>
                      <div className="flex gap-1.5">
                        <button type="button" className="ferp-btn-ghost" style={{ padding: '5px 8px' }} title="Ver"><Eye className="h-3.5 w-3.5" /></button>
                        <button type="button" className="ferp-btn-ghost" style={{ padding: '5px 8px' }} title="Download"><Download className="h-3.5 w-3.5" /></button>
                        <button type="button" className="ferp-btn-ghost" style={{ padding: '5px 8px', color: '#f87171', borderColor: 'rgba(239,68,68,0.2)' }} title="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }} onClick={() => setShowUpload(false)}>
          <div className="w-full max-w-lg rounded-[20px] p-6" style={{ background: 'linear-gradient(160deg, #110528, #0d0320)', border: '1px solid rgba(139,92,246,0.35)', boxShadow: '0 0 60px rgba(124,58,237,0.25)' }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-black text-white">Upload de Documento</h3>
              <button type="button" onClick={() => setShowUpload(false)} className="ferp-btn-ghost" style={{ padding: '5px 8px' }}><X className="h-4 w-4" /></button>
            </div>

            {/* Drop zone */}
            <div
              className="flex flex-col items-center justify-center rounded-[14px] p-8 text-center transition cursor-pointer"
              style={{
                border: `2px dashed ${drag ? 'rgba(168,85,247,0.7)' : 'rgba(139,92,246,0.3)'}`,
                background: drag ? 'rgba(124,58,237,0.1)' : 'rgba(15,5,40,0.5)',
              }}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={() => setDrag(false)}
            >
              <Upload className="h-10 w-10 mb-3" style={{ color: drag ? '#a855f7' : '#475569' }} />
              <p className="font-bold text-white text-[14px]">Arraste ficheiros aqui</p>
              <p style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>ou clique para selecionar • PDF, DOCX, XLSX até 25 MB</p>
              <button type="button" className="ferp-btn-primary mt-4" style={{ padding: '8px 18px', fontSize: 12 }}>
                <Plus className="h-3.5 w-3.5" /> Selecionar Ficheiro
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider" style={{ color: '#94a3b8' }}>Fornecedor</label>
                <select className="ferp-input">
                  {['TechServ Solutions', 'Limpeza Premium Lda', 'Office Plus Portugal', 'Segurança Total SA'].map((s) => <option key={s} className="bg-[#0d0520]">{s}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider" style={{ color: '#94a3b8' }}>Tipo de Documento</label>
                <select className="ferp-input">
                  {TYPES.slice(1).map((t) => <option key={t} className="bg-[#0d0520]">{t}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setShowUpload(false)} className="ferp-btn-ghost flex-1 justify-center">Cancelar</button>
              <button type="button" onClick={() => setShowUpload(false)} className="ferp-btn-primary flex-1 justify-center">
                <Upload className="h-4 w-4" /> Fazer Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
