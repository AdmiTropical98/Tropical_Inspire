import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  ChevronRight,
  Filter,
  Plus,
  Search,
  Star,
  X,
} from 'lucide-react';

// ─── Mock data ───────────────────────────────────────────────────────────────
const CATEGORIES = ['Todos', 'IT & Software', 'Serviços', 'Material de Escritório', 'Segurança', 'Alimentação', 'Logística', 'Consultoria', 'Outros'];
const STATUSES = ['Todos', 'Ativo', 'Pendente', 'Inativo'];

const SUPPLIERS: Supplier[] = [
  { id: '1', name: 'TechServ Solutions', nif: '508234567', category: 'IT & Software', email: 'geral@techserv.pt', phone: '+351 210 000 123', location: 'Lisboa', status: 'Ativo', rating: 4.8, spend: 142300, contracts: 3, since: '2021-03-15' },
  { id: '2', name: 'Limpeza Premium Lda', nif: '513456789', category: 'Serviços', email: 'info@limpezapremium.pt', phone: '+351 220 000 456', location: 'Porto', status: 'Ativo', rating: 4.5, spend: 98400, contracts: 1, since: '2020-07-20' },
  { id: '3', name: 'Office Plus Portugal', nif: '509876543', category: 'Material de Escritório', email: 'comercial@officeplus.pt', phone: '+351 230 000 789', location: 'Braga', status: 'Ativo', rating: 4.2, spend: 74100, contracts: 2, since: '2022-01-08' },
  { id: '4', name: 'Segurança Total SA', nif: '511234567', category: 'Segurança', email: 'contratos@segurancatotal.pt', phone: '+351 240 000 321', location: 'Lisboa', status: 'Ativo', rating: 4.7, spend: 65800, contracts: 1, since: '2019-11-30' },
  { id: '5', name: 'Catering Express', nif: '512345678', category: 'Alimentação', email: 'pedidos@cateringexpress.pt', phone: '+351 250 000 654', location: 'Setúbal', status: 'Inativo', rating: 4.0, spend: 53200, contracts: 0, since: '2021-06-14' },
  { id: '6', name: 'LogiTrans Portugal', nif: '514567890', category: 'Logística', email: 'ops@logitrans.pt', phone: '+351 260 000 987', location: 'Aveiro', status: 'Ativo', rating: 4.3, spend: 47800, contracts: 2, since: '2022-09-05' },
  { id: '7', name: 'Consult Business Group', nif: '515678901', category: 'Consultoria', email: 'info@consultbg.pt', phone: '+351 270 000 111', location: 'Lisboa', status: 'Pendente', rating: 0, spend: 0, contracts: 0, since: '2024-01-20' },
  { id: '8', name: 'Distribuidora Ibérica', nif: '516789012', category: 'Logística', email: 'comercial@distib.pt', phone: '+351 280 000 222', location: 'Faro', status: 'Ativo', rating: 4.6, spend: 38900, contracts: 1, since: '2023-03-12' },
  { id: '9', name: 'SoftCloud Lda', nif: '517890123', category: 'IT & Software', email: 'suporte@softcloud.pt', phone: '+351 290 000 333', location: 'Coimbra', status: 'Pendente', rating: 0, spend: 0, contracts: 0, since: '2024-02-28' },
  { id: '10', name: 'Print & Design Studio', nif: '518901234', category: 'Outros', email: 'orcamentos@printdesign.pt', phone: '+351 200 000 444', location: 'Lisboa', status: 'Ativo', rating: 3.9, spend: 22100, contracts: 1, since: '2023-07-19' },
];

interface Supplier {
  id: string;
  name: string;
  nif: string;
  category: string;
  email: string;
  phone: string;
  location: string;
  status: 'Ativo' | 'Pendente' | 'Inativo';
  rating: number;
  spend: number;
  contracts: number;
  since: string;
}

function Stars({ rating }: { rating: number }) {
  if (rating === 0) return <span style={{ color: '#475569', fontSize: 11 }}>Sem avaliação</span>;
  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={`h-3 w-3 ${i <= Math.round(rating) ? 'ferp-star' : 'ferp-star-empty'}`} fill={i <= Math.round(rating) ? '#fbbf24' : 'transparent'} />
        ))}
      </div>
      <span style={{ color: '#fbbf24', fontSize: 11, fontWeight: 700 }}>{rating > 0 ? rating.toFixed(1) : ''}</span>
    </div>
  );
}

function fmt(n: number) {
  if (n === 0) return '—';
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function statusBadge(status: string) {
  switch (status) {
    case 'Ativo': return 'ferp-badge ferp-badge-active';
    case 'Pendente': return 'ferp-badge ferp-badge-pending';
    default: return 'ferp-badge ferp-badge-inactive';
  }
}

const PAGE_SIZE = 8;

export default function FornecedoresGestao() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [page, setPage] = useState(1);
  const [showNewModal, setShowNewModal] = useState(false);

  const filtered = SUPPLIERS.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.nif.includes(search) ||
      s.email.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'Todos' || s.category === category;
    const matchStatus = statusFilter === 'Todos' || s.status === statusFilter;
    return matchSearch && matchCat && matchStatus;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="ferp-animate space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white">Fornecedores</h2>
          <p className="text-sm" style={{ color: '#94a3b8' }}>
            {filtered.length} fornecedor{filtered.length !== 1 ? 'es' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          className="ferp-btn-primary"
        >
          <Plus className="h-4 w-4" />
          Novo Fornecedor
        </button>
      </div>

      {/* Filters */}
      <div className="ferp-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: '#64748b' }} />
            <input
              type="text"
              placeholder="Pesquisar por nome, NIF ou email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="ferp-input pl-10"
              style={{ minWidth: 220 }}
            />
          </div>
          {/* Category */}
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="ferp-input"
            style={{ width: 'auto', minWidth: 160 }}
          >
            {CATEGORIES.map((c) => <option key={c} value={c} className="bg-[#0d0520]">{c}</option>)}
          </select>
          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="ferp-input"
            style={{ width: 'auto', minWidth: 120 }}
          >
            {STATUSES.map((s) => <option key={s} value={s} className="bg-[#0d0520]">{s}</option>)}
          </select>
          {/* Reset */}
          {(search || category !== 'Todos' || statusFilter !== 'Todos') && (
            <button
              type="button"
              onClick={() => { setSearch(''); setCategory('Todos'); setStatusFilter('Todos'); setPage(1); }}
              className="ferp-btn-ghost"
              style={{ padding: '8px 12px' }}
            >
              <X className="h-4 w-4" />
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="ferp-table-wrap ferp-card">
        <table className="ferp-table">
          <thead>
            <tr>
              <th>Fornecedor</th>
              <th>NIF</th>
              <th>Categoria</th>
              <th>Localização</th>
              <th>Estado</th>
              <th>Avaliação</th>
              <th>Gasto Total</th>
              <th>Contratos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center" style={{ color: '#475569' }}>
                  Nenhum fornecedor encontrado.
                </td>
              </tr>
            ) : paged.map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="ferp-avatar">{s.name.charAt(0)}</div>
                    <div>
                      <p className="font-bold text-white">{s.name}</p>
                      <p style={{ color: '#64748b', fontSize: 11 }}>{s.email}</p>
                    </div>
                  </div>
                </td>
                <td style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: 12 }}>{s.nif}</td>
                <td>
                  <span
                    className="rounded-[6px] px-2.5 py-1 text-[11px] font-bold"
                    style={{ background: 'rgba(124,58,237,0.12)', color: '#c084fc', border: '1px solid rgba(139,92,246,0.2)' }}
                  >
                    {s.category}
                  </span>
                </td>
                <td style={{ color: '#94a3b8', fontSize: 12 }}>{s.location}</td>
                <td><span className={statusBadge(s.status)}>{s.status}</span></td>
                <td><Stars rating={s.rating} /></td>
                <td style={{ fontWeight: 700, color: s.spend > 0 ? '#c084fc' : '#475569' }}>{fmt(s.spend)}</td>
                <td style={{ color: '#94a3b8', textAlign: 'center' }}>{s.contracts}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => navigate(`/fornecedores-erp/gestao/perfil/${s.id}`)}
                    className="ferp-btn-ghost"
                    style={{ padding: '6px 12px', fontSize: 12 }}
                  >
                    Detalhes <ChevronRight className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span style={{ color: '#64748b', fontSize: 12 }}>
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="ferp-btn-ghost disabled:opacity-40"
              style={{ padding: '7px 14px', fontSize: 12 }}
            >
              Anterior
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={p === page ? 'ferp-btn-primary' : 'ferp-btn-ghost'}
                style={{ padding: '7px 12px', fontSize: 12, minWidth: 36 }}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
              className="ferp-btn-ghost disabled:opacity-40"
              style={{ padding: '7px 14px', fontSize: 12 }}
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {/* New Supplier Modal (simplified) */}
      {showNewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
          onClick={() => setShowNewModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-[20px] p-6"
            style={{ background: 'linear-gradient(160deg, #110528, #0d0320)', border: '1px solid rgba(139,92,246,0.35)', boxShadow: '0 0 60px rgba(124,58,237,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-black text-white">Novo Fornecedor</h3>
              <button type="button" onClick={() => setShowNewModal(false)} className="ferp-btn-ghost" style={{ padding: '5px 8px' }}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Nome / Razão Social', placeholder: 'Empresa Fornecedora Lda' },
                { label: 'NIF', placeholder: '508 000 000' },
                { label: 'Email', placeholder: 'geral@empresa.pt' },
                { label: 'Telefone', placeholder: '+351 210 000 000' },
                { label: 'Morada', placeholder: 'Rua Principal, 123, Lisboa' },
                { label: 'IBAN', placeholder: 'PT50 0000 0000 0000 0000 000 0' },
              ].map((f) => (
                <div key={f.label}>
                  <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider" style={{ color: '#94a3b8' }}>{f.label}</label>
                  <input type="text" placeholder={f.placeholder} className="ferp-input" />
                </div>
              ))}
              <div>
                <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider" style={{ color: '#94a3b8' }}>Categoria</label>
                <select className="ferp-input">
                  {CATEGORIES.filter((c) => c !== 'Todos').map((c) => <option key={c} value={c} className="bg-[#0d0520]">{c}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setShowNewModal(false)} className="ferp-btn-ghost flex-1 justify-center">Cancelar</button>
              <button type="button" onClick={() => setShowNewModal(false)} className="ferp-btn-primary flex-1 justify-center">
                <Building2 className="h-4 w-4" /> Adicionar Fornecedor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
