import React, { useState } from 'react';
import { FrotaPageHeader } from '../../components/ui/frota/FrotaPageHeader';
import { FrotaFilterBar } from '../../components/ui/frota/FrotaFilterBar';
import { FrotaTable, type FrotaTableColumn } from '../../components/ui/frota/FrotaTable';
import { FrotaStatusBadge } from '../../components/ui/frota/FrotaStatusBadge';
import { FrotaDrawer } from '../../components/ui/frota/FrotaDrawer';
import { FrotaCard } from '../../components/ui/frota/FrotaCard';

import { 
    AlertTriangle, 
    Bell, 
    Calendar,
    Clock, 
    Info, 
    ShieldAlert, 
    Truck, 
    User, 
    CheckCircle2,
    Eye,
    Check
} from 'lucide-react';

interface IntelligentAlert {
    id: string;
    severity: 'critical' | 'warning' | 'notice' | 'info';
    title: string;
    description: string;
    date: string;
    vehicle?: string;
    driver?: string;
    costImpact?: string;
    origin: string;
    status: 'open' | 'resolved';
    recommendation: string;
}

// Temporary Mock Data reflecting the new intelligent structure
const mockAlerts: IntelligentAlert[] = [
    {
        id: 'ALT-001',
        severity: 'critical',
        title: 'Abastecimento Incompatível (Geolocalização)',
        description: 'O cartão da viatura foi utilizado num posto a 37 km da posição GPS atual da viatura.',
        date: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        vehicle: '40-QB-86',
        driver: 'Rui Costa',
        costImpact: '€ 85.40',
        origin: 'Integração Galp / Cartrack',
        status: 'open',
        recommendation: 'Suspender cartão temporariamente e contactar o motorista.'
    },
    {
        id: 'ALT-002',
        severity: 'warning',
        title: 'Manutenção Preventiva Atrasada',
        description: 'A viatura ultrapassou em 1.500 km o limite recomendado para a revisão.',
        date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        vehicle: 'AB-12-CD',
        origin: 'Sistema de Manutenção',
        status: 'open',
        recommendation: 'Agendar revisão imediatamente na oficina interna.'
    },
    {
        id: 'ALT-003',
        severity: 'notice',
        title: 'Consumo Anómalo',
        description: 'Média de consumo aumentou 18% (de 6.2L para 7.3L/100km) nos últimos 15 dias.',
        date: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
        vehicle: '99-ZZ-99',
        driver: 'Ana Silva',
        costImpact: 'Estimativa: +€45/mês',
        origin: 'Módulo Combustíveis',
        status: 'open',
        recommendation: 'Verificar pressão dos pneus e estilo de condução.'
    },
    {
        id: 'ALT-004',
        severity: 'info',
        title: 'Documento a Expirar',
        description: 'Seguro de responsabilidade civil expira em 5 dias.',
        date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        vehicle: '11-AA-22',
        origin: 'Gestão Documental',
        status: 'open',
        recommendation: 'Renovar apólice com a seguradora.'
    }
];

export default function AlertsModule() {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSeverity, setFilterSeverity] = useState('all');
    const [selectedAlert, setSelectedAlert] = useState<IntelligentAlert | null>(null);

    const getSeverityDetails = (severity: IntelligentAlert['severity']) => {
        switch (severity) {
            case 'critical': return { color: 'error', icon: <ShieldAlert />, label: 'Crítico' };
            case 'warning': return { color: 'warning', icon: <AlertTriangle />, label: 'Atenção' };
            case 'notice': return { color: 'warning', icon: <Bell />, label: 'Aviso' };
            case 'info': return { color: 'info', icon: <Info />, label: 'Info' };
        }
    };

    const columns: FrotaTableColumn<IntelligentAlert>[] = [
        {
            id: 'severity',
            header: 'Severidade',
            sortable: true,
            className: 'w-32',
            cell: (row) => {
                const details = getSeverityDetails(row.severity);
                return (
                    <FrotaStatusBadge 
                        variant={details.color as any} 
                        label={details.label} 
                        icon={details.icon} 
                    />
                );
            }
        },
        {
            id: 'details',
            header: 'Detalhes do Alerta',
            cell: (row) => (
                <div className="flex flex-col">
                    <span className="font-bold text-slate-900">{row.title}</span>
                    <span className="text-slate-500 text-xs truncate max-w-md">{row.description}</span>
                </div>
            )
        },
        {
            id: 'entities',
            header: 'Entidades',
            cell: (row) => (
                <div className="flex flex-col gap-1">
                    {row.vehicle && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded w-max">
                            <Truck className="w-3 h-3 text-slate-500" /> {row.vehicle}
                        </div>
                    )}
                    {row.driver && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded w-max">
                            <User className="w-3 h-3 text-slate-500" /> {row.driver}
                        </div>
                    )}
                </div>
            )
        },
        {
            id: 'date',
            header: 'Data / Hora',
            sortable: true,
            cell: (row) => (
                <div className="flex flex-col text-sm">
                    <span className="font-medium text-slate-700">{new Date(row.date).toLocaleDateString('pt-PT')}</span>
                    <span className="text-slate-500 text-xs">{new Date(row.date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            )
        },
        {
            id: 'status',
            header: 'Estado',
            cell: (row) => (
                <FrotaStatusBadge 
                    variant={row.status === 'open' ? 'warning' : 'success'} 
                    label={row.status === 'open' ? 'Pendente' : 'Resolvido'} 
                />
            )
        }
    ];

    const filteredAlerts = mockAlerts.filter(alert => {
        const matchesSearch = alert.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              alert.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              alert.vehicle?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSeverity = filterSeverity === 'all' || alert.severity === filterSeverity;
        return matchesSearch && matchesSeverity;
    });

    return (
        <div className="w-full min-w-0 flex flex-col space-y-6 animate-in fade-in duration-500">
            <FrotaPageHeader
                title="Centro de Alertas"
                subtitle="Monitorização inteligente de anomalias e desvios operacionais."
                icon={<Bell className="w-6 h-6" />}
            />

            <FrotaFilterBar
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                searchPlaceholder="Pesquisar por título, viatura ou descrição..."
            >
                <select 
                    className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 font-medium min-w-[150px]"
                    value={filterSeverity}
                    onChange={(e) => setFilterSeverity(e.target.value)}
                >
                    <option value="all">Todas as Severidades</option>
                    <option value="critical">Crítico</option>
                    <option value="warning">Atenção</option>
                    <option value="notice">Aviso</option>
                    <option value="info">Info</option>
                </select>
                <select className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 font-medium min-w-[150px]">
                    <option value="open">Pendentes</option>
                    <option value="resolved">Resolvidos</option>
                    <option value="all">Todos os Estados</option>
                </select>
            </FrotaFilterBar>

            <FrotaCard noPadding className="h-[600px]">
                <FrotaTable
                    columns={columns}
                    data={filteredAlerts}
                    onRowClick={(row) => setSelectedAlert(row)}
                    emptyMessage="Não foram encontrados alertas com os filtros atuais."
                />
            </FrotaCard>

            {/* Alert Detail Drawer */}
            <FrotaDrawer
                isOpen={!!selectedAlert}
                onClose={() => setSelectedAlert(null)}
                title={<div className="flex items-center gap-3">
                    {selectedAlert && getSeverityDetails(selectedAlert.severity).icon}
                    <span>Detalhe do Alerta</span>
                </div>}
                size="md"
                footer={
                    <div className="flex gap-3 w-full">
                        <button className="flex-1 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-lg font-bold hover:bg-slate-50 transition-colors">
                            Ignorar
                        </button>
                        <button className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-bold flex justify-center items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20">
                            <Check className="w-4 h-4" /> Marcar como Resolvido
                        </button>
                    </div>
                }
            >
                {selectedAlert && (
                    <div className="space-y-6">
                        {/* Status Banner */}
                        <div className={`p-4 rounded-xl border flex items-start gap-4 ${
                            selectedAlert.severity === 'critical' ? 'bg-red-50 border-red-200 text-red-900' :
                            selectedAlert.severity === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-900' :
                            selectedAlert.severity === 'notice' ? 'bg-amber-50 border-amber-200 text-amber-900' :
                            'bg-sky-50 border-sky-200 text-sky-900'
                        }`}>
                            <div className={`p-2 rounded-lg bg-white/60 backdrop-blur-sm shadow-sm`}>
                                {getSeverityDetails(selectedAlert.severity).icon}
                            </div>
                            <div>
                                <h3 className="font-black text-lg tracking-tight mb-1">{selectedAlert.title}</h3>
                                <p className="text-sm font-medium opacity-80">{selectedAlert.description}</p>
                            </div>
                        </div>

                        {/* Entities Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Viatura Associada</p>
                                {selectedAlert.vehicle ? (
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-slate-100 rounded-lg"><Truck className="w-4 h-4 text-slate-600" /></div>
                                        <span className="font-bold text-slate-900">{selectedAlert.vehicle}</span>
                                    </div>
                                ) : <span className="text-slate-400 text-sm">N/A</span>}
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Motorista Associado</p>
                                {selectedAlert.driver ? (
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-slate-100 rounded-lg"><User className="w-4 h-4 text-slate-600" /></div>
                                        <span className="font-bold text-slate-900">{selectedAlert.driver}</span>
                                    </div>
                                ) : <span className="text-slate-400 text-sm">N/A</span>}
                            </div>
                        </div>

                        {/* Details Card */}
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Impacto Estimado</p>
                                <p className="font-black text-slate-900 text-lg">{selectedAlert.costImpact || 'N/A'}</p>
                            </div>
                            <div className="border-t border-slate-100 pt-4">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Origem do Alerta</p>
                                <p className="font-medium text-slate-700 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-slate-400" />
                                    {selectedAlert.origin}
                                </p>
                            </div>
                        </div>

                        {/* Action Recommendation */}
                        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 text-white shadow-lg">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Ação Recomendada</p>
                            <p className="font-medium text-slate-100">{selectedAlert.recommendation}</p>
                        </div>
                    </div>
                )}
            </FrotaDrawer>
        </div>
    );
}