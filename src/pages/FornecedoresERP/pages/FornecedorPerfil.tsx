import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  Mail,
  MapPin,
  Phone,
  Star,
  User,
  CheckCircle2,
  Clock,
  Edit2,
} from 'lucide-react';

// ─── Mock data ───────────────────────────────────────────────────────────────
const SUPPLIERS_MAP: Record<string, SupplierDetail> = {
  '1': {
    id: '1', name: 'TechServ Solutions', nif: '508234567', category: 'IT & Software',
    email: 'geral@techserv.pt', phone: '+351 210 000 123', location: 'Lisboa',
    address: 'Av. da Liberdade, 245, 3.º Esq., 1250-142 Lisboa', iban: 'PT50 0002 0123 1234 5678 9015 4',
    status: 'Ativo', rating: 4.8, spend: 142300, contracts: 3, since: '2021-03-15',
    notes: 'Fornecedor estratégico de IT. Contrato principal de suporte 24/7 e licenciamento Microsoft. Excelente tempo de resposta.',
    contacts: [
      { name: 'João Ferreira', role: 'Account Manager', email: 'j.ferreira@techserv.pt', phone: '+351 916 000 001' },
      { name: 'Ana Costa', role: 'Suporte Técnico', email: 'a.costa@techserv.pt', phone: '+351 916 000 002' },
    ],
    payments: [
      { id: 'p1', desc: 'Licenças Microsoft 365 — Q4 2024', amount: 8400, date: '2024-12-10', status: 'Pago' },
      { id: 'p2', desc: 'Suporte IT — Nov 2024', amount: 3200, date: '2024-11-30', status: 'Pago' },
      { id: 'p3', desc: 'Upgrade servidor — Jan 2025', amount: 12800, date: '2025-01-15', status: 'Pendente' },
    ],
    documents: [
      { name: 'Contrato Principal 2024-2026.pdf', type: 'Contrato', date: '2024-01-15', size: '2.4 MB' },
      { name: 'Proposta Comercial Q1 2025.pdf', type: 'Proposta', date: '2024-12-20', size: '1.1 MB' },
      { name: 'NIF TechServ Solutions.pdf', type: 'Fiscal', date: '2021-03-15', size: '0.3 MB' },
    ],
  },
  '2': {
    id: '2', name: 'Limpeza Premium Lda', nif: '513456789', category: 'Serviços',
    email: 'info@limpezapremium.pt', phone: '+351 220 000 456', location: 'Porto',
    address: 'Rua de Santa Catarina, 102, 4000-447 Porto', iban: 'PT50 0003 0456 9876 5432 1098 7',
    status: 'Ativo', rating: 4.5, spend: 98400, contracts: 1, since: '2020-07-20',
    notes: 'Prestação de serviços de limpeza em todas as instalações. Visitas diárias de segunda a sexta.',
    contacts: [
      { name: 'Maria Silva', role: 'Gestora de Conta', email: 'm.silva@limpezapremium.pt', phone: '+351 932 000 003' },
    ],
    payments: [
      { id: 'p1', desc: 'Limpeza Escritórios — Dez 2024', amount: 4200, date: '2024-12-31', status: 'Pago' },
      { id: 'p2', desc: 'Limpeza Escritórios — Jan 2025', amount: 4200, date: '2025-01-31', status: 'Pendente' },
    ],
    documents: [
      { name: 'Contrato Serviços 2023-2025.pdf', type: 'Contrato', date: '2023-01-01', size: '1.8 MB' },
    ],
  },
};

const DEFAULT_SUPPLIER: SupplierDetail = {
  id: '?', name: 'Fornecedor Desconhecido', nif: '—', category: '—',
  email: '—', phone: '—', location: '—', address: '—', iban: '—',
  status: 'Pendente', rating: 0, spend: 0, contracts: 0, since: '—',
  notes: '', contacts: [], payments: [], documents: [],
};

interface Contact { name: string; role: string; email: string; phone: string; }
interface Payment { id: string; desc: string; amount: number; date: string; status: string; }
interface Doc { name: string; type: string; date: string; size: string; }
interface SupplierDetail {
  id: string; name: string; nif: string; category: string;
  email: string; phone: string; location: string; address: string; iban: string;
  status: string; rating: number; spend: number; contracts: number; since: string;
  notes: string; contacts: Contact[]; payments: Payment[]; documents: Doc[];
}

function Stars({ rating }: { rating: number }) {
  if (rating === 0) return <span style={{ color: '#475569', fontSize: 12 }}>Sem avaliação</span>;
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-4 w-4 ${i <= Math.round(rating) ? 'ferp-star' : 'ferp-star-empty'}`} fill={i <= Math.round(rating) ? '#fbbf24' : 'transparent'} />
      ))}
      <span style={{ color: '#fbbf24', fontSize: 13, fontWeight: 700 }}>{rating.toFixed(1)}</span>
    </div>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: '#475569' }}>{label}</span>
      <span className={`text-[14px] font-semibold text-white ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

export default function FornecedorPerfil() {
  const { supplierId } = useParams<{ supplierId: string }>();
  const navigate = useNavigate();
  const supplier = SUPPLIERS_MAP[supplierId ?? ''] ?? { ...DEFAULT_SUPPLIER, id: supplierId ?? '?' };

  return (
    <div className="ferp-animate space-y-5">
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate('/fornecedores-erp/gestao')}
        className="ferp-btn-ghost"
        style={{ fontSize: 13 }}
      >
        <ArrowLeft className="h-4 w-4" /> Voltar à lista
      </button>

      {/* Header card */}
      <div className="ferp-card ferp-card-glow p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-[16px] text-2xl font-black text-white flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(124,58,237,0.4), rgba(168,85,247,0.25))',
                border: '1px solid rgba(139,92,246,0.4)',
                boxShadow: '0 0 24px rgba(124,58,237,0.3)',
              }}
            >
              {supplier.name.charAt(0)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black text-white tracking-tight">{supplier.name}</h2>
                <span
                  className={`ferp-badge ${supplier.status === 'Ativo' ? 'ferp-badge-active' : supplier.status === 'Pendente' ? 'ferp-badge-pending' : 'ferp-badge-inactive'}`}
                >
                  {supplier.status}
                </span>
              </div>
              <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>{supplier.category}</p>
              <div className="mt-2">
                <Stars rating={supplier.rating} />
              </div>
            </div>
          </div>
          <button type="button" className="ferp-btn-ghost" style={{ fontSize: 12 }}>
            <Edit2 className="h-3.5 w-3.5" /> Editar
          </button>
        </div>

        {/* Quick stats */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Gasto Total', value: supplier.spend > 0 ? fmt(supplier.spend) : '—', color: '#c084fc' },
            { label: 'Contratos', value: String(supplier.contracts), color: '#60a5fa' },
            { label: 'Cliente desde', value: supplier.since !== '—' ? new Date(supplier.since).toLocaleDateString('pt-PT') : '—', color: '#4ade80' },
            { label: 'Avaliação', value: supplier.rating > 0 ? `${supplier.rating}/5` : '—', color: '#fbbf24' },
          ].map((s) => (
            <div key={s.label} className="rounded-[12px] p-3 text-center" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
              <p className="text-[18px] font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[11px] font-semibold mt-0.5" style={{ color: '#64748b' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Contact info */}
        <div className="ferp-card p-5">
          <h3 className="mb-4 text-[14px] font-black text-white">Informações de Contacto</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-[8px]" style={{ background: 'rgba(124,58,237,0.15)' }}>
                <Mail className="h-4 w-4" style={{ color: '#a855f7' }} />
              </div>
              <InfoRow label="Email" value={supplier.email} />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-[8px]" style={{ background: 'rgba(124,58,237,0.15)' }}>
                <Phone className="h-4 w-4" style={{ color: '#a855f7' }} />
              </div>
              <InfoRow label="Telefone" value={supplier.phone} />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-[8px]" style={{ background: 'rgba(124,58,237,0.15)' }}>
                <MapPin className="h-4 w-4" style={{ color: '#a855f7' }} />
              </div>
              <InfoRow label="Morada" value={supplier.address} />
            </div>
          </div>
        </div>

        {/* Fiscal info */}
        <div className="ferp-card p-5">
          <h3 className="mb-4 text-[14px] font-black text-white">Dados Fiscais & Bancários</h3>
          <div className="space-y-4">
            <InfoRow label="NIF" value={supplier.nif} mono />
            <InfoRow label="IBAN" value={supplier.iban} mono />
            <InfoRow label="Categoria" value={supplier.category} />
          </div>
        </div>
      </div>

      {/* Notes */}
      {supplier.notes && (
        <div className="ferp-card p-5">
          <h3 className="mb-3 text-[14px] font-black text-white">Notas Internas</h3>
          <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.7 }}>{supplier.notes}</p>
        </div>
      )}

      {/* Contacts */}
      {supplier.contacts.length > 0 && (
        <div className="ferp-card p-5">
          <h3 className="mb-4 text-[14px] font-black text-white">Contactos</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {supplier.contacts.map((c) => (
              <div key={c.email} className="rounded-[12px] p-4" style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(139,92,246,0.15)' }}>
                <div className="flex items-center gap-3">
                  <div className="ferp-avatar"><User className="h-4 w-4" /></div>
                  <div>
                    <p className="font-bold text-white text-[13px]">{c.name}</p>
                    <p style={{ color: '#a855f7', fontSize: 11, fontWeight: 700 }}>{c.role}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  <p style={{ color: '#94a3b8', fontSize: 12 }}><Mail className="inline h-3 w-3 mr-1" />{c.email}</p>
                  <p style={{ color: '#94a3b8', fontSize: 12 }}><Phone className="inline h-3 w-3 mr-1" />{c.phone}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment history */}
      {supplier.payments.length > 0 && (
        <div className="ferp-card p-5">
          <h3 className="mb-4 text-[14px] font-black text-white">Histórico de Pagamentos</h3>
          <div className="ferp-table-wrap" style={{ border: 'none' }}>
            <table className="ferp-table">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th>Data</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {supplier.payments.map((p) => (
                  <tr key={p.id}>
                    <td style={{ color: '#cbd5e1', fontSize: 13 }}>{p.desc}</td>
                    <td style={{ fontWeight: 700, color: '#c084fc' }}>{fmt(p.amount)}</td>
                    <td style={{ color: '#64748b', fontSize: 12 }}>{new Date(p.date).toLocaleDateString('pt-PT')}</td>
                    <td>
                      <span className={`ferp-badge ${p.status === 'Pago' ? 'ferp-badge-paid' : 'ferp-badge-pending'}`}>
                        {p.status === 'Pago' ? <CheckCircle2 className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Documents */}
      {supplier.documents.length > 0 && (
        <div className="ferp-card p-5">
          <h3 className="mb-4 text-[14px] font-black text-white">Documentos</h3>
          <div className="space-y-2">
            {supplier.documents.map((doc) => (
              <div
                key={doc.name}
                className="flex items-center gap-3 rounded-[10px] p-3"
                style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(139,92,246,0.15)' }}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-[8px]" style={{ background: 'rgba(124,58,237,0.2)' }}>
                  <FileText className="h-4 w-4" style={{ color: '#a855f7' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-semibold text-white text-[13px]">{doc.name}</p>
                  <p style={{ color: '#64748b', fontSize: 11 }}>{doc.type} • {doc.size} • {new Date(doc.date).toLocaleDateString('pt-PT')}</p>
                </div>
                <button type="button" className="ferp-btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }}>
                  Ver
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
