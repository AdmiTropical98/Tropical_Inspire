import { useState, useRef } from 'react';
import {
    Upload, Plus, Calendar,
    CheckSquare, MoreVertical, Trash2, ArrowRight, Siren,
    Send, MapPin, Clock, Users, MousePointer2,
    Search, LayoutList, X, GripVertical, AlertTriangle, Edit,
    Table as TableIcon, LayoutGrid
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import type { Servico, Notification } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';

interface NewServiceState {
    hora: string;
    passageiro: string;
    origem: string;
    destino: string;
    referencia: string;
    obs: string;
    temRegresso: boolean;
    horaRegresso: string;
    destinoRegresso: string;
    centroCustoId?: string;
}

export default function Escalas() {
    const {
        motoristas, servicos, addNotification, notifications, updateNotification, centrosCustos,
        addServico, updateServico, deleteServico, deleteMotorista, updateMotorista, geofences
    } = useWorkshop();
    const { userRole } = useAuth();
    const { hasAccess } = usePermissions();
    const { t } = useTranslation();

    // Core State
    const [selectedPendentes, setSelectedPendentes] = useState<string[]>([]);
    const [selectedMotoristaForAssign, setSelectedMotoristaForAssign] = useState<string>('');
    const [selectedCentroCusto, setSelectedCentroCusto] = useState<string>('all');

    // Mobile sidebar state
    const [isPendingSidebarOpen, setIsPendingSidebarOpen] = useState(false);

    // View Mode State
    const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

    // Grouping State
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'busy'>('all');

    // Drag and drop state
    const [draggedServiceId, setDraggedServiceId] = useState<string | null>(null);

    // Quick Distribution Mode State
    const [isDistributeMode, setIsDistributeMode] = useState(false);
    const [activeDriverId, setActiveDriverId] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Driver Menu State
    const [activeDriverMenuId, setActiveDriverMenuId] = useState<string | null>(null);

    // New Manual Service State
    const [showNewServiceModal, setShowNewServiceModal] = useState(false);
    const [newService, setNewService] = useState<NewServiceState>({
        hora: '09:00',
        passageiro: '',
        origem: '',
        destino: '',
        referencia: '',
        obs: '',
        temRegresso: false,
        horaRegresso: '18:00',
        destinoRegresso: '',
        centroCustoId: ''
    });

    // Urgent Request State
    const [showUrgentModal, setShowUrgentModal] = useState(false);
    const [urgentData, setUrgentData] = useState({
        hora: '',
        passageiro: '',
        origem: '',
        destino: '',
        obs: ''
    });

    // Quick Assign Function
    const handleQuickAssign = async (serviceId: string) => {
        if (!activeDriverId) return;
        const service = servicos.find(s => s.id === serviceId);
        if (service) {
            await updateServico({ ...service, motoristaId: activeDriverId });
        }
    };

    const handleUrgentRequest = (e: React.FormEvent) => {
        e.preventDefault();

        const newNotification: Notification = {
            id: crypto.randomUUID(),
            type: 'urgent_transport_request',
            data: {
                time: urgentData.hora || new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
                passenger: urgentData.passageiro,
                origin: urgentData.origem,
                destination: urgentData.destino,
                obs: urgentData.obs
            },
            status: 'pending',
            timestamp: new Date().toISOString()
        };

        addNotification(newNotification);
        setShowUrgentModal(false);
        setUrgentData({ hora: '', passageiro: '', origem: '', destino: '', obs: '' });
        alert(t('schedule.alerts.urgent_request_sent'));
    };

    const handleSupervisorCancel = async (notification: Notification) => {
        if (!confirm(t('schedule.alerts.cancel_confirm'))) return;

        if (notification.status === 'assigned' && notification.response?.driverId) {
            addNotification({
                id: crypto.randomUUID(),
                type: 'transport_cancelled',
                data: {
                    origin: notification.data.origin,
                    destination: notification.data.destination
                },
                status: 'pending',
                response: { driverId: notification.response.driverId },
                timestamp: new Date().toISOString()
            });

            if (notification.response.serviceId) {
                await deleteServico(notification.response.serviceId);
            }
        }

        updateNotification({ ...notification, status: 'rejected' });
    };

    // Advanced Filtering
    const filteredServicos = servicos.filter(s => {
        // Filter by Cost Center
        if (selectedCentroCusto !== 'all' && s.centroCustoId !== selectedCentroCusto) return false;

        // Filter by Search Term
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            return (
                s.passageiro.toLowerCase().includes(term) ||
                s.origem.toLowerCase().includes(term) ||
                s.destino.toLowerCase().includes(term) ||
                s.voo?.toLowerCase().includes(term)
            );
        }
        return true;
    });

    const pendentes = filteredServicos.filter(s => !s.motoristaId).sort((a, b) => a.hora.localeCompare(b.hora));
    const assigned = filteredServicos.filter(s => s.motoristaId);

    // Logic & Filters
    const filteredMotoristas = motoristas.filter(m => {
        if (filterStatus === 'all') return true;
        if (filterStatus === 'available') return m.status === 'disponivel';
        if (filterStatus === 'busy') return m.status === 'ocupado';
        return true;
    }).filter(m => {
        if (searchTerm) return m.nome.toLowerCase().includes(searchTerm.toLowerCase());
        return true;
    });

    const handleDropService = async (driverId: string) => {
        if (draggedServiceId) {
            const service = servicos.find(s => s.id === draggedServiceId);
            if (service) {
                await updateServico({ ...service, motoristaId: driverId });
            }
            setDraggedServiceId(null);
            if (isDistributeMode) { /* optional feedback */ }
        }
    };

    // Stats
    const totalServices = filteredServicos.length;
    const progressPercentage = totalServices > 0 ? Math.round((assigned.length / totalServices) * 100) : 0;

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];

                const data = XLSX.utils.sheet_to_json(ws);
                const mappedServicos: Servico[] = [];

                data.forEach((row: any) => {
                    const nome = row['Nome do funcionário'] || row['Nome'] || 'Desconhecido';
                    const origem = row['Origem'] || '';
                    const destino = row['Destino'] || '';

                    // Parse Times
                    const parseTime = (val: any) => {
                        if (!val) return null;
                        if (typeof val === 'number') {
                            const totalSeconds = Math.round(val * 86400);
                            const hours = Math.floor(totalSeconds / 3600);
                            const minutes = Math.floor((totalSeconds % 3600) / 60);
                            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                        }
                        const str = String(val).trim();
                        if (str.match(/^\d{1,2}:\d{2}/)) {
                            const [h, m] = str.split(':');
                            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                        }
                        return '00:00';
                    };

                    const horaEntrada = parseTime(row['Horário de apanhar transporte']);
                    const horaSaida = parseTime(row['Horário de saída do serviço']);

                    if (horaEntrada) {
                        mappedServicos.push({
                            id: crypto.randomUUID(),
                            hora: horaEntrada,
                            passageiro: nome,
                            origem: origem,
                            destino: destino,
                            voo: '',
                            obs: 'Entrada (Importado)',
                            concluido: false,
                            centroCustoId: selectedCentroCusto !== 'all' ? selectedCentroCusto : undefined
                        });
                    }

                    if (horaSaida) {
                        mappedServicos.push({
                            id: crypto.randomUUID(),
                            hora: horaSaida,
                            passageiro: nome,
                            origem: destino,
                            destino: origem,
                            voo: '',
                            obs: 'Saída (Importado)',
                            concluido: false
                        });
                    }
                });

                if (mappedServicos.length === 0) {
                    alert(t('schedule.alerts.no_valid_data'));
                } else {
                    // Bulk insert - loop for now as we don't have bulk insert in context yet
                    for (const s of mappedServicos) {
                        await addServico(s);
                    }
                }
            } catch (error) {
                console.error("Erro ao importar:", error);
                alert(t('schedule.alerts.file_read_error'));
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleCreateService = async (e: React.FormEvent) => {
        e.preventDefault();

        const servicesToAdd: Servico[] = [{
            id: crypto.randomUUID(),
            hora: newService.hora,
            passageiro: newService.passageiro || 'Staff',
            origem: newService.origem,
            destino: newService.destino,
            voo: newService.referencia,
            obs: 'Entrada',
            concluido: false,
            centroCustoId: newService.centroCustoId || (selectedCentroCusto !== 'all' ? selectedCentroCusto : undefined)
        }];

        if (newService.temRegresso) {
            const returnDest = newService.destinoRegresso || newService.origem;
            servicesToAdd.push({
                id: crypto.randomUUID(),
                hora: newService.horaRegresso,
                passageiro: newService.passageiro || 'Staff',
                origem: newService.destino,
                destino: returnDest,
                voo: newService.referencia,
                obs: 'Saída',
                concluido: false,
                centroCustoId: newService.centroCustoId || (selectedCentroCusto !== 'all' ? selectedCentroCusto : undefined)
            });
        }

        for (const s of servicesToAdd) {
            await addServico(s);
        }
        setShowNewServiceModal(false);

        setNewService({
            hora: '09:00',
            passageiro: '',
            origem: '',
            destino: '',
            referencia: '',
            obs: '',
            temRegresso: false,
            horaRegresso: '18:00',
            destinoRegresso: '',
            centroCustoId: ''
        });
    };

    const handleAssign = async () => {
        if (!selectedMotoristaForAssign || selectedPendentes.length === 0) return;

        const servicesToUpdate = servicos.filter(s => selectedPendentes.includes(s.id));
        await Promise.all(servicesToUpdate.map(s => updateServico({ ...s, motoristaId: selectedMotoristaForAssign })));

        setSelectedPendentes([]);
        setSelectedMotoristaForAssign('');
    };

    const handleBatchDelete = async () => {
        if (selectedPendentes.length === 0) return;
        if (!confirm(t('schedule.alerts.delete_confirm'))) return;

        await Promise.all(selectedPendentes.map(id => deleteServico(id)));
        setSelectedPendentes([]);
    };

    const togglePendenteSelection = (id: string) => {
        setSelectedPendentes(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedPendentes.length === pendentes.length) {
            setSelectedPendentes([]);
        } else {
            setSelectedPendentes(pendentes.map(s => s.id));
        }
    };

    const unassignService = async (id: string) => {
        const service = servicos.find(s => s.id === id);
        if (service) {
            await updateServico({ ...service, motoristaId: null });
        }
    };

    const handleDeleteService = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm(t('schedule.alerts.delete_confirm'))) {
            await deleteServico(id);
            setSelectedPendentes(prev => prev.filter(x => x !== id));
        }
    };

    const handleDeleteDriver = async (driverId: string, driverName: string) => {
        if (confirm(`Tem a certeza que deseja eliminar o motorista ${driverName}?`)) {
            await deleteMotorista(driverId);
            setActiveDriverMenuId(null);
        }
    };

    const handleEditDriver = async (driver: any) => {
        const newName = prompt("Novo nome para o motorista:", driver.nome);
        if (newName && newName !== driver.nome) {
            await updateMotorista({ ...driver, nome: newName });
            setActiveDriverMenuId(null);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0f172a] relative overflow-y-auto md:overflow-hidden custom-scrollbar">

            {/* HEADER TOOLBAR */}
            <div className="h-auto md:min-h-20 border-b border-white/5 flex flex-wrap md:flex-nowrap items-center justify-between p-3 md:px-8 bg-[#0f172a]/80 backdrop-blur-md z-20 shrink-0 gap-4">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".xlsx, .xls, .csv"
                />

                {/* Left: Date & Stats */}
                <div className="flex items-center justify-between w-full md:w-auto gap-4">
                    <div className="flex flex-col shrink-0">
                        <div className="flex items-center gap-1.5 text-blue-400 mb-0.5">
                            <Calendar className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Hoje</span>
                        </div>
                        <h2 className="text-lg font-bold text-white capitalize leading-none truncate max-w-[200px] md:max-w-none">
                            {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'short' })}
                        </h2>
                    </div>

                    <div className="hidden md:block h-10 w-px bg-white/10" />

                    {/* Stats */}
                    <div className="flex items-center gap-4 md:gap-6">
                        <div className="flex flex-col items-center">
                            <span className="text-[9px] md:text-xs text-slate-400 font-medium uppercase tracking-wider">Serviços</span>
                            <span className="text-sm md:text-lg font-bold text-white leading-tight">{totalServices}</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-[9px] md:text-xs text-slate-400 font-medium uppercase tracking-wider">Concluído</span>
                            <span className="text-sm md:text-lg font-bold text-emerald-400 leading-tight">{progressPercentage}%</span>
                        </div>

                        {/* Pendentes Indicator - Mobile Only (Compact) / Desktop (Full) */}
                        <div
                            className="flex flex-col items-center relative cursor-pointer"
                            onClick={() => setIsPendingSidebarOpen(true)}
                        >
                            <span className="text-[9px] md:text-xs text-slate-400 font-medium uppercase tracking-wider">Pendentes</span>
                            <span className={`text-sm md:text-lg font-bold leading-tight ${pendentes.length > 0 ? 'text-amber-400' : 'text-slate-500'}`}>{pendentes.length}</span>
                            {pendentes.length > 0 && <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />}
                        </div>
                    </div>
                </div>

                {/* Right: Actions & Tools */}
                <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto justify-end">
                    <div className="relative flex-1 md:flex-none md:w-64 min-w-[140px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Procurar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[#1e293b] border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-blue-500/50"
                        />
                    </div>

                    {/* Cost Center Filter - Desktop Only */}
                    <div className="hidden xl:block w-48">
                        <select
                            value={selectedCentroCusto}
                            onChange={(e) => setSelectedCentroCusto(e.target.value)}
                            className="w-full bg-[#1e293b] border border-white/10 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
                        >
                            <option value="all">{t('menu.cost_centers')}: Todos</option>
                            {centrosCustos.map(cc => (
                                <option key={cc.id} value={cc.id}>{cc.nome}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end mt-2 md:mt-0">
                        {/* Action Buttons Group */}
                        <div className="flex gap-2">
                            {/* Distribute Mode */}
                            {hasAccess(userRole, 'escalas_create') && (
                                <button
                                    onClick={() => setIsDistributeMode(!isDistributeMode)}
                                    className={`p-2 rounded-lg border transition-colors ${isDistributeMode
                                        ? 'bg-blue-600 border-blue-500 text-white animate-pulse'
                                        : 'bg-[#1e293b] border-white/5 text-slate-300 hover:bg-slate-700'
                                        }`}
                                    title="Modo de Distribuição Rápida"
                                >
                                    <MousePointer2 className="w-5 h-5" />
                                </button>
                            )}

                            {/* Mobile Pending Details Toggle */}
                            {hasAccess(userRole, 'escalas_view_pending') && (
                                <button
                                    onClick={() => setIsPendingSidebarOpen(!isPendingSidebarOpen)}
                                    className="md:hidden p-2 bg-[#1e293b] hover:bg-slate-700 text-slate-300 rounded-lg border border-white/5 relative"
                                >
                                    <LayoutList className="w-5 h-5" />
                                    {pendentes.length > 0 && (
                                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-[10px] font-bold text-black rounded-full flex items-center justify-center">
                                            {pendentes.length}
                                        </span>
                                    )}
                                </button>
                            )}

                            {hasAccess(userRole, 'escalas_import') && (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2 bg-[#1e293b] hover:bg-slate-700 text-slate-300 rounded-lg border border-white/5 transition-colors"
                                    title="Importar Excel"
                                >
                                    <Upload className="w-5 h-5" />
                                </button>
                            )}

                            {/* View Toggles */}
                            {hasAccess(userRole, 'escalas_create') && (
                                <div className="flex bg-[#1e293b] rounded-lg p-1 border border-white/5">
                                    <button
                                        onClick={() => setViewMode('cards')}
                                        className={`p-1.5 rounded-md transition-all ${viewMode === 'cards' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                        title="Vista de Cartões"
                                    >
                                        <LayoutGrid className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('table')}
                                        className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                        title="Vista de Tabela"
                                    >
                                        <TableIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2">
                            {hasAccess(userRole, 'escalas_create') && (
                                <button
                                    onClick={() => setShowNewServiceModal(true)}
                                    className="flex bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-bold items-center gap-2 transition-all shadow-lg hover:shadow-blue-600/20 whitespace-nowrap"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span className="hidden sm:inline">Novo</span>
                                </button>
                            )}

                            <button
                                onClick={() => setShowUrgentModal(true)}
                                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/50 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap"
                            >
                                <AlertTriangle className="w-4 h-4" />
                                <span className="hidden sm:inline">Urgência</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col md:flex-row md:overflow-hidden relative h-auto md:h-full">

                {viewMode === 'cards' ? (
                    /* CARD VIEW (Existing) */
                    <>
                        <div className={`flex-1 md:overflow-hidden p-0 transition-colors duration-300
                    ${isDistributeMode ? 'bg-[#1e293b]/20' : ''}
                `}>
                            <div className="h-auto md:h-full flex flex-col">
                                {/* Status Filters */}
                                <div className="flex items-center gap-2 mb-2 px-2 md:px-8 mt-2 md:mt-6 overflow-x-auto pb-1 shrink-0 scrollbar-hide">
                                    <button
                                        onClick={() => setFilterStatus('all')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${filterStatus === 'all'
                                            ? 'bg-blue-600 text-white border-blue-500'
                                            : 'bg-[#1e293b] text-slate-400 border-white/5 hover:border-white/10'
                                            }`}
                                    >
                                        Todos
                                    </button>
                                    <button
                                        onClick={() => setFilterStatus('available')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${filterStatus === 'available'
                                            ? 'bg-emerald-600 text-white border-emerald-500'
                                            : 'bg-[#1e293b] text-emerald-400 border-white/5 hover:border-white/10'
                                            }`}
                                    >
                                        Disponíveis ({motoristas.filter(m => m.status === 'disponivel').length})
                                    </button>
                                    <button
                                        onClick={() => setFilterStatus('busy')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${filterStatus === 'busy'
                                            ? 'bg-amber-600 text-white border-amber-500'
                                            : 'bg-[#1e293b] text-amber-400 border-white/5 hover:border-white/10'
                                            }`}
                                    >
                                        Em Serviço ({motoristas.filter(m => m.status === 'ocupado').length})
                                    </button>
                                </div>

                                {/* Drivers Swimlanes */}
                                <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-3 md:gap-6 md:overflow-x-auto pb-24 md:pb-6 px-2 md:px-4 snap-y md:snap-x">
                                    {filteredMotoristas.map(driver => {
                                        // Calculate Driver Stats
                                        const driverServices = assigned.filter(s => s.motoristaId === driver.id).sort((a, b) => a.hora.localeCompare(b.hora));

                                        return (
                                            <div
                                                key={driver.id}
                                                onClick={() => isDistributeMode && setActiveDriverId(driver.id)}
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                                                }}
                                                onDragLeave={(e) => {
                                                    e.preventDefault();
                                                    e.currentTarget.style.borderColor = '';
                                                    e.currentTarget.style.backgroundColor = '';
                                                }}
                                                // Removed hardcoded width, allowing flex-grow and proper shrinking
                                                className={`bg-[#1e293b] rounded-2xl shadow-lg flex flex-col shrink-0 w-full md:w-[420px] lg:w-[450px] snap-center group transition-all duration-200 h-auto md:h-full
                                            ${isDistributeMode && activeDriverId === driver.id ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-[#0f172a]' : ''}
                                            border ${draggedServiceId ? 'border-dashed border-blue-500/40 hover:border-blue-500' : 'border-white/5 hover:border-white/10'}
                                            ${activeDriverMenuId === driver.id ? 'relative z-50' : ''}
                                        `}
                                            >

                                                {/* Card Header */}
                                                <div className="p-3 bg-slate-900/50 border-b border-white/5 flex items-center justify-between rounded-t-2xl">
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative">
                                                            {driver.foto ? (
                                                                <img src={driver.foto} alt={driver.nome} className="w-9 h-9 rounded-full object-cover border-2 border-slate-700" />
                                                            ) : (
                                                                    <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold border-2 border-slate-600">
                                                                    {driver.nome.charAt(0)}
                                                                </div>
                                                            )}
                                                            <div className={`absolute -bottom-1 -right-1 w-3 h-3 border-2 border-[#1e293b] rounded-full shadow-sm
                                                    ${driver.status === 'disponivel' ? 'bg-emerald-500' :
                                                                driver.status === 'ocupado' ? 'bg-amber-500' : 'bg-red-500'}
                                                `}></div>
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-white text-sm md:text-base leading-tight">{driver.nome}</h3>
                                                            <div className="flex items-center gap-3 mt-0.5 text-[10px] md:text-xs text-slate-400">
                                                                <span className="flex items-center gap-1.5">
                                                                    <MapPin className="w-2.5 h-2.5 text-blue-400" />
                                                                    {driverServices.length} {t('schedule.trips')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="relative">
                                                        <button
                                                            onMouseDown={(e) => {
                                                                e.stopPropagation();
                                                                setActiveDriverMenuId(activeDriverMenuId === driver.id ? null : driver.id);
                                                            }}
                                                            className={`p-2 rounded-lg transition-colors ${activeDriverMenuId === driver.id ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                                                        >
                                                            <MoreVertical className="w-5 h-5" />
                                                        </button>

                                                        {activeDriverMenuId === driver.id && (
                                                            <>
                                                                <div
                                                                    className="fixed inset-0 z-40"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setActiveDriverMenuId(null);
                                                                    }}
                                                                />
                                                                <div className="absolute right-0 top-full mt-2 w-32 bg-[#1e293b] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
                                                                    <div className="p-1">
                                                                        <button
                                                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-left"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleEditDriver(driver);
                                                                            }}
                                                                        >
                                                                            <Edit className="w-4 h-4" />
                                                                            <span>Editar</span>
                                                                        </button>
                                                                        <div className="h-px bg-white/10 my-1" />
                                                                        <button
                                                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors text-left"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleDeleteDriver(driver.id, driver.nome);
                                                                            }}
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                            <span>Eliminar</span>
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Timeline */}
                                                <div className="p-2 md:p-3 flex-1 bg-[#0b1120]/30 min-h-[150px] overflow-y-auto custom-scrollbar relative">
                                                    <div className="space-y-3 relative">
                                                        {/* Vertical Timeline Line */}
                                                        {driverServices.length > 1 && (
                                                            <div className="absolute left-[2.35rem] top-4 bottom-4 w-px bg-slate-800/80 z-0"></div>
                                                        )}

                                                        {driverServices.length === 0 ? (
                                                            <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-slate-500/50 text-xs text-center">
                                                                <div className="p-4 bg-slate-800/30 rounded-full mb-3 shadow-inner">
                                                                    <Clock className="w-8 h-8 opacity-40" />
                                                                </div>
                                                                <span className="font-medium">Motorista Disponível</span>
                                                                <span className="text-[10px] opacity-60 mt-1">Arraste serviços para aqui</span>
                                                            </div>
                                                        ) : (
                                                            /* GROUPING LOGIC */
                                                            (() => {
                                                                // Group services
                                                                const groupedServices: { [key: string]: typeof driverServices } = {};
                                                                driverServices.forEach(s => {
                                                                    const key = `${s.hora}|${s.origem}`;
                                                                    if (!groupedServices[key]) groupedServices[key] = [];
                                                                    groupedServices[key].push(s);
                                                                });

                                                                // Convert to array and sort
                                                                const groups = Object.values(groupedServices).sort((a, b) => a[0].hora.localeCompare(b[0].hora));

                                                                return groups.map((group) => {
                                                                    const isGroup = group.length > 1;
                                                                    const firstService = group[0];
                                                                    const groupKey = `${driver.id}-${firstService.hora}-${firstService.origem}`;
                                                                    const isExpanded = expandedGroups[groupKey];

                                                                    if (!isGroup) {
                                                                        // RENDER SINGLE SERVICE (Legacy)
                                                                        const service = firstService;
                                                                        return (
                                                                            <div key={service.id} className="relative z-10 flex gap-2 md:gap-4 group/item">
                                                                                {/* Time Column */}
                                                                                <div className="flex flex-col items-center gap-1 min-w-[3.5rem] md:min-w-[4.5rem] pt-0.5">
                                                                                    <span className="text-[11px] md:text-sm font-bold text-white font-mono bg-slate-800/80 px-1.5 md:px-2 py-0.5 md:py-1 rounded border border-white/5 shadow-sm">
                                                                                        {service.hora}
                                                                                    </span>
                                                                                    {service.voo && (
                                                                                        <span className="px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 rounded border border-indigo-500/30 max-w-full truncate">
                                                                                            {service.voo}
                                                                                        </span>
                                                                                    )}
                                                                                </div>

                                                                                {/* Content Card */}
                                                                                <div className="flex-1 bg-slate-800/40 hover:bg-slate-800/60 border border-white/5 hover:border-blue-500/30 rounded-lg p-2 flex flex-col gap-1.5 transition-all relative overflow-hidden">
                                                                                    <button
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            unassignService(service.id);
                                                                                        }}
                                                                                        className="absolute top-1 right-1 p-1 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover/item:opacity-100 z-20"
                                                                                        title={t('schedule.remove_assignment')}
                                                                                    >
                                                                                        <Trash2 className="w-3 h-3" />
                                                                                    </button>

                                                                                    <div className="flex items-start justify-between pr-6">
                                                                                        <div className="flex flex-col">
                                                                                            <span className="text-xs font-bold text-slate-200 line-clamp-1" title={service.passageiro}>
                                                                                                {service.passageiro}
                                                                                            </span>
                                                                                            {service.obs && service.obs !== 'Entrada' && service.obs !== 'Saída' && (
                                                                                                <span className="text-[9px] text-slate-500 italic line-clamp-1">{service.obs}</span>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* Route Flow */}
                                                                                    <div className="flex items-center gap-1.5 text-[10px] bg-[#0f172a]/40 p-1.5 rounded border border-white/5">
                                                                                        <div className="w-1 h-1 rounded-full bg-slate-500 shrink-0"></div>
                                                                                        <span className="text-slate-400 truncate flex-1" title={service.origem}>{service.origem}</span>
                                                                                        <ArrowRight className="w-2.5 h-2.5 text-slate-600 shrink-0" />
                                                                                        <div className="w-1 h-1 rounded-full bg-blue-500 shrink-0"></div>
                                                                                        <span className="text-slate-300 truncate flex-1 font-medium" title={service.destino}>{service.destino}</span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    } else {
                                                                        // RENDER GROUP CARD
                                                                        return (
                                                                            <div key={groupKey} className="relative z-10 flex gap-2 md:gap-4">
                                                                                {/* Time Column */}
                                                                                <div className="flex flex-col items-center gap-1 min-w-[3.5rem] md:min-w-[4.5rem] pt-0.5">
                                                                                    <span className="text-[11px] md:text-sm font-bold text-white font-mono bg-blue-600 px-1.5 md:px-2 py-0.5 md:py-1 rounded border border-blue-400/30 shadow-lg shadow-blue-900/20">
                                                                                        {firstService.hora}
                                                                                    </span>
                                                                                    <div className="w-px h-full bg-blue-500/20 mx-auto my-1"></div>
                                                                                </div>

                                                                                {/* Group Container */}
                                                                                <div
                                                                                    className={`flex-1 rounded-xl border transition-all duration-300 overflow-hidden
                                                                                    ${isExpanded
                                                                                            ? 'bg-slate-800/80 border-blue-500/50'
                                                                                            : 'bg-gradient-to-br from-blue-900/20 to-slate-900/50 border-blue-500/20 hover:border-blue-500/40 cursor-pointer'
                                                                                        }
                                                                                `}
                                                                                    onClick={() => {
                                                                                        setExpandedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
                                                                                    }}
                                                                                >
                                                                                    {/* Group Header */}
                                                                                    <div className="p-3">
                                                                                        <div className="flex items-center justify-between mb-2">
                                                                                            <div className="flex items-center gap-2">
                                                                                                <div className="bg-blue-500 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold text-white">
                                                                                                    {group.length}
                                                                                                </div>
                                                                                                <span className="font-bold text-blue-100 text-sm">Passageiros</span>
                                                                                            </div>
                                                                                            <div className={`p-1 rounded-lg transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-white/10' : ''}`}>
                                                                                                <LayoutList className="w-4 h-4 text-blue-400" />
                                                                                            </div>
                                                                                        </div>

                                                                                        <div className="flex items-center gap-2 text-xs bg-[#0f172a]/40 p-2 rounded-lg border border-white/5">
                                                                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0"></div>
                                                                                            <span className="text-slate-300 truncate flex-1 font-medium">{firstService.origem}</span>
                                                                                            {isExpanded && (
                                                                                                <>
                                                                                                    <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                                                                                                    <span className="text-slate-500 text-[10px] italic shrink-0">Vários Destinos</span>
                                                                                                </>
                                                                                            )}
                                                                                        </div>

                                                                                        {!isExpanded && (
                                                                                            <div className="mt-2 text-xs text-slate-500 pl-1">
                                                                                                <span className="truncate block opacity-70">
                                                                                                    {group.map(s => s.passageiro).join(', ')}
                                                                                                </span>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>

                                                                                    {/* Expanded Content */}
                                                                                    {isExpanded && (
                                                                                        <div className="border-t border-white/5 bg-[#0b1120]/30 divide-y divide-white/5">
                                                                                            {group.map(service => (
                                                                                                <div key={service.id} className="p-3 hover:bg-white/5 transition-colors relative group/subitem">
                                                                                                    <button
                                                                                                        onClick={(e) => {
                                                                                                            e.stopPropagation();
                                                                                                            unassignService(service.id);
                                                                                                        }}
                                                                                                        className="absolute top-3 right-3 p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover/subitem:opacity-100"
                                                                                                        title={t('schedule.remove_assignment')}
                                                                                                    >
                                                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                                                    </button>

                                                                                                    <div className="pr-8">
                                                                                                        <div className="font-medium text-slate-200 text-sm mb-1">{service.passageiro}</div>
                                                                                                        <div className="flex items-center gap-2 text-xs">
                                                                                                            <ArrowRight className="w-3 h-3 text-slate-600" />
                                                                                                            <span className="text-slate-400 truncate">{service.destino}</span>
                                                                                                        </div>
                                                                                                        {service.obs && (
                                                                                                            <div className="text-[10px] text-slate-500 italic mt-1 pl-5">"{service.obs}"</div>
                                                                                                        )}
                                                                                                    </div>
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    }
                                                                });
                                                            })()
                                                        )}
                                                    </div>
                                                </div>

                                                {/* DRIVER FOOTER ACTIONS */}
                                                <div className="px-4 py-3 bg-slate-900/50 border-t border-white/5 flex justify-end gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-wider rounded-b-2xl">
                                                    <button className="hover:text-blue-400 transition-colors">Ver Perfil</button>
                                                    <span>•</span>
                                                    <button className="hover:text-blue-400 transition-colors">Enviar Msg</button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* URGENT REQUEST SECTION (Supervisor/Admin View Only) */}
                                {(userRole === 'admin' || userRole === 'supervisor') && notifications.some(n => n.type === 'urgent_transport_request' && (n.status === 'pending' || n.status === 'assigned')) && (
                                    <div className="mt-8 pt-8 border-t border-white/10">
                                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
                                            <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                                                <Siren className="w-5 h-5 text-red-500" />
                                            </div>
                                            {t('schedule.my_urgent_requests')}
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {notifications
                                                .filter(n => n.type === 'urgent_transport_request' && (n.status === 'pending' || n.status === 'assigned'))
                                                .map(req => (
                                                    <div key={req.id} className={`bg-[#182338]/80 backdrop-blur-md border ${req.status === 'assigned' ? 'border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.1)]' : 'border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.05)]'} rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300`}>
                                                        {/* Status Badge */}
                                                        <div className="flex justify-between items-start z-10">
                                                            {req.status === 'pending' ? (
                                                                <span className="bg-red-500/20 text-red-400 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border border-red-500/20 flex items-center gap-1.5 animate-pulse">
                                                                    <Clock className="w-3 h-3" />
                                                                    {t('schedule.status.pending')}
                                                                </span>
                                                            ) : (
                                                                <span className="bg-blue-500/20 text-blue-400 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border border-blue-500/20 flex items-center gap-1.5">
                                                                    <CheckSquare className="w-3 h-3" />
                                                                    {t('schedule.status.assigned')}
                                                                </span>
                                                            )}
                                                            <span className="text-slate-400 font-mono text-xs bg-black/20 px-2 py-1 rounded">{req.data.time}</span>
                                                        </div>

                                                        <div className="z-10 bg-black/20 p-3 rounded-xl border border-white/5">
                                                            <div className="font-bold text-white text-base mb-1">{req.data.passenger}</div>
                                                            <div className="flex flex-col gap-1.5 text-xs text-slate-400">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-500"></div>
                                                                    <span className="truncate">{req.data.origin}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                                                                    <span className="text-slate-200 truncate font-medium">{req.data.destination}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {req.data.obs && (
                                                            <div className="text-xs text-slate-500 italic px-2">
                                                                "{req.data.obs}"
                                                            </div>
                                                        )}

                                                        <button
                                                            onClick={() => handleSupervisorCancel(req)}
                                                            className="mt-auto z-10 w-full py-2.5 bg-slate-800/50 hover:bg-red-500/10 border border-slate-700 hover:border-red-500/30 text-slate-400 hover:text-red-400 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            {t('schedule.actions.cancel')}
                                                        </button>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT SIDEBAR: PENDING SERVICES */}
                        {hasAccess(userRole, 'escalas_view_pending') && (
                            <>
                                {/* Mobile Backdrop */}
                                {isPendingSidebarOpen && (
                                    <div
                                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden"
                                        onClick={() => setIsPendingSidebarOpen(false)}
                                    />
                                )}

                                <div className={`
                            fixed lg:relative inset-y-0 right-0 z-[60]
                            w-[85vw] max-w-[400px] lg:w-[400px]
                            flex flex-col bg-[#0f172a] border-l border-white/5 shadow-2xl
                            transform transition-transform duration-300 ease-in-out
                            ${isPendingSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
                        `}>
                                    {/* Sidebar Header */}
                                    <div className="p-6 bg-[#0f172a]/95 backdrop-blur border-b border-white/5 z-20 flex flex-col gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg shadow-lg shadow-purple-900/20">
                                                <Upload className="w-4 h-4 text-white" />
                                            </div>
                                            <h2 className="text-lg font-bold text-white max-w-[150px] truncate">
                                                {t('schedule.pending.title')}
                                            </h2>
                                            <div className="flex items-center gap-2 ml-auto">
                                                <span className="bg-slate-800 text-slate-300 text-xs px-2.5 py-1 rounded-full border border-white/10 font-mono">
                                                    {pendentes.length}
                                                </span>
                                                <button
                                                    onClick={() => setIsPendingSidebarOpen(false)}
                                                    className="lg:hidden p-1.5 text-slate-400 hover:text-white bg-slate-800/50 rounded-lg"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Batch Assign Control - Hidden in Distribute Mode */}
                                        {!isDistributeMode && pendentes.length > 0 && (
                                            <div className={`flex gap-2 p-1 bg-slate-900/50 rounded-xl border border-white/10 ${pendentes.length === 0 ? 'hidden' : ''}`}>
                                                <select
                                                    className="flex-1 bg-transparent text-sm px-3 py-2 text-slate-300 outline-none focus:text-white cursor-pointer"
                                                    value={selectedMotoristaForAssign}
                                                    onChange={(e) => setSelectedMotoristaForAssign(e.target.value)}
                                                >
                                                    <option value="" className="bg-slate-900">{t('schedule.pending.assign_to')}</option>
                                                    {motoristas.map(m => (
                                                        <option key={m.id} value={m.id} className="bg-slate-900">{m.nome}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={handleAssign}
                                                    disabled={!selectedMotoristaForAssign || selectedPendentes.length === 0}
                                                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-all shadow-lg"
                                                    title="Atribuir"
                                                >
                                                    <ArrowRight className="w-4 h-4" />
                                                </button>
                                                {selectedPendentes.length > 0 && (
                                                    <button
                                                        onClick={handleBatchDelete}
                                                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 p-2 rounded-lg transition-all"
                                                        title="Apagar selecionados"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {pendentes.length > 0 && (
                                            <div className="flex items-center justify-between mt-1">
                                                <button
                                                    onClick={toggleSelectAll}
                                                    className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-white transition-colors"
                                                >
                                                    Selecionar Todos
                                                </button>
                                                <span className="text-[10px] text-slate-600">
                                                    {selectedPendentes.length} selecionados
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Pending List */}
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 bg-[#0b1120]">
                                        {pendentes.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-slate-600 px-10 text-center">
                                                <CheckSquare className="w-12 h-12 mb-4 opacity-20" />
                                                <p className="text-sm font-medium">{t('schedule.pending.empty')}</p>
                                                <p className="text-xs opacity-50 mt-1">Ótimo trabalho! Tudo organizado.</p>
                                            </div>
                                        ) : (
                                            pendentes.map(service => (
                                                <div
                                                    key={service.id}
                                                    onClick={() => {
                                                        if (isDistributeMode) {
                                                            handleQuickAssign(service.id);
                                                        } else {
                                                            togglePendenteSelection(service.id);
                                                        }
                                                    }}
                                                    draggable={!isDistributeMode}
                                                    onDragStart={(e) => {
                                                        setDraggedServiceId(service.id);
                                                        e.dataTransfer.setData('text/plain', service.id);
                                                    }}
                                                    onDragEnd={() => setDraggedServiceId(null)}
                                                    className={`group relative p-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing select-none
                                                        ${isDistributeMode
                                                            ? activeDriverId
                                                                ? 'bg-slate-800/30 border-white/5 hover:bg-blue-600/20 hover:border-blue-500/50 hover:scale-[1.02]'
                                                                : 'bg-slate-800/30 border-white/5 opacity-50 cursor-not-allowed'
                                                            : selectedPendentes.includes(service.id)
                                                                ? 'bg-blue-900/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                                                                : 'bg-slate-900/40 border-white/5 hover:border-white/10 hover:bg-slate-800/60'
                                                        }
                                                    `}
                                                >
                                                    <div className="flex gap-3">
                                                        {/* Drag Handle */}
                                                        {!isDistributeMode && !selectedPendentes.includes(service.id) && (
                                                            <div className="hidden group-hover:flex absolute left-1 top-1/2 -translate-y-1/2 p-1 text-slate-600 cursor-grab active:cursor-grabbing">
                                                                <GripVertical className="w-4 h-4" />
                                                            </div>
                                                        )}

                                                        {/* Checkbox Visual or Assign Action */}
                                                        {isDistributeMode ? (
                                                            <div className={`w-5 h-5 mt-0.5 rounded-md flex items-center justify-center transition-colors
                                                                ${activeDriverId ? 'bg-slate-800 text-slate-500 group-hover:bg-blue-500 group-hover:text-white' : 'bg-slate-800 text-slate-600'}
                                                            `}>
                                                                <ArrowRight className="w-3.5 h-3.5" />
                                                            </div>
                                                        ) : (
                                                            <div className={`w-5 h-5 mt-0.5 rounded-md border flex items-center justify-center transition-colors
                                                                ${selectedPendentes.includes(service.id)
                                                                    ? 'bg-blue-600 border-blue-600'
                                                                    : 'bg-slate-900 border-slate-700 group-hover:border-slate-500'}
                                                            `}>
                                                                {selectedPendentes.includes(service.id) && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                                                            </div>
                                                        )}

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-start mb-1">
                                                                <span className="font-mono text-sm font-bold text-white bg-slate-900 px-1.5 py-0.5 rounded border border-white/5">{service.hora}</span>
                                                                <button
                                                                    onClick={(e) => handleDeleteService(service.id, e)}
                                                                    className="text-slate-600 hover:text-red-400 transition-colors opacity-70 hover:opacity-100 p-1 hover:bg-slate-800 rounded"
                                                                    title={t('schedule.actions.cancel')}
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </button>
                                                            </div>

                                                            <div className="font-medium text-slate-200 text-sm truncate pr-2 mb-2">{service.passageiro}</div>

                                                            <div className="text-xs text-slate-500 flex flex-col gap-1.5 bg-black/20 p-2 rounded-lg border border-white/5">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-600"></div>
                                                                    <span className="truncate">{service.origem}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                                    <span className="truncate text-slate-400 group-hover:text-slate-300 transition-colors">{service.destino}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                ) : (
                    /* TABLE VIEW (New) */
                    <div className="flex-1 flex flex-col bg-[#1e293b]/30 overflow-hidden h-full">
                        {/* Bulk Action Bar */}
                        <div className="h-16 bg-[#1e293b] border-b border-white/5 px-6 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-4">
                                <span className="text-slate-400 text-sm">
                                    <span className="text-white font-bold">{filteredServicos.length}</span> serviços encontrados
                                </span>
                                {selectedPendentes.length > 0 && (
                                    <>
                                        <div className="h-4 w-px bg-white/10" />
                                        <span className="text-blue-400 text-sm font-bold">
                                            {selectedPendentes.length} selecionados
                                        </span>
                                    </>
                                )}
                            </div>

                            <div className="flex items-center gap-4">
                                {selectedPendentes.length > 0 ? (
                                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                                        <div className="flex items-center gap-2 bg-[#0f172a] p-1 pr-2 rounded-lg border border-white/10">
                                            <select
                                                className="bg-transparent text-sm px-3 py-1.5 text-slate-300 outline-none focus:text-white cursor-pointer min-w-[200px]"
                                                value={selectedMotoristaForAssign}
                                                onChange={(e) => setSelectedMotoristaForAssign(e.target.value)}
                                            >
                                                <option value="" className="bg-slate-900">Atribuir a motorista...</option>
                                                {motoristas.filter(m => m.status === 'disponivel').map(m => (
                                                    <option key={m.id} value={m.id} className="bg-slate-900">{m.nome} (Disponível)</option>
                                                ))}
                                                <option disabled>──────────</option>
                                                {motoristas.filter(m => m.status !== 'disponivel').map(m => (
                                                    <option key={m.id} value={m.id} className="bg-slate-900 text-slate-500">{m.nome} ({m.status})</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={handleAssign}
                                                disabled={!selectedMotoristaForAssign}
                                                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white p-1.5 rounded-md transition-all"
                                                title="Confirmar atribuição"
                                            >
                                                <CheckSquare className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <button
                                            onClick={handleBatchDelete}
                                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            <span>Apagar</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-xs text-slate-500 italic">
                                        Selecione serviços para ações em massa
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Table Header */}
                        <div className="bg-[#0f172a] border-b border-white/5 grid grid-cols-[50px_80px_1fr_1fr_1fr_120px_200px_120px] gap-4 px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider sticky top-0 z-10">
                            <div className="flex items-center justify-center">
                                <input
                                    type="checkbox"
                                    checked={selectedPendentes.length === filteredServicos.length && filteredServicos.length > 0}
                                    onChange={() => {
                                        if (selectedPendentes.length === filteredServicos.length) {
                                            setSelectedPendentes([]);
                                        } else {
                                            setSelectedPendentes(filteredServicos.map(s => s.id));
                                        }
                                    }}
                                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-offset-0 focus:ring-transparent"
                                />
                            </div>
                            <div>Hora</div>
                            <div>Passageiro</div>
                            <div>Origem</div>
                            <div>Destino</div>
                            <div>Ref/Voo</div>
                            <div>Motorista</div>
                            <div className="text-right">Ações</div>
                        </div>

                        {/* Table Body */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {filteredServicos.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-500">
                                    <Search className="w-12 h-12 mb-4 opacity-20" />
                                    <p className="text-lg font-medium">Nenhum serviço encontrado</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/5">
                                    {filteredServicos.map((service) => {

                                        return (
                                            <div
                                                key={service.id}
                                                className={`grid grid-cols-[50px_80px_1fr_1fr_1fr_120px_200px_120px] gap-4 px-6 py-3 items-center hover:bg-white/[0.02] transition-colors
                                            ${selectedPendentes.includes(service.id) ? 'bg-blue-500/5' : ''}
                                        `}
                                                onClick={() => togglePendenteSelection(service.id)}
                                            >
                                                {/* Checkbox */}
                                                <div className="flex items-center justify-center" onClick={e => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedPendentes.includes(service.id)}
                                                        onChange={() => togglePendenteSelection(service.id)}
                                                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-offset-0 focus:ring-transparent"
                                                    />
                                                </div>

                                                {/* Hora */}
                                                <div className="font-mono text-sm text-white font-medium flex items-center gap-2">
                                                    {service.hora}
                                                </div>

                                                {/* Passageiro */}
                                                <div className="text-sm font-medium text-slate-200 truncate" title={service.passageiro}>
                                                    {service.passageiro}
                                                </div>

                                                {/* Origem */}
                                                <div className="text-sm text-slate-400 truncate" title={service.origem}>
                                                    {service.origem}
                                                </div>

                                                {/* Destino */}
                                                <div className="text-sm text-slate-400 truncate" title={service.destino}>
                                                    {service.destino}
                                                </div>

                                                {/* Ref */}
                                                <div className="text-xs text-slate-500 truncate">
                                                    {service.voo || '-'}
                                                </div>

                                                {/* Motorista */}
                                                <div onClick={e => e.stopPropagation()}>
                                                    <select
                                                        className={`w-full bg-[#0f172a] border ${service.motoristaId ? 'border-blue-500/30 text-blue-200' : 'border-white/10 text-slate-400'} text-xs rounded-lg px-2 py-1.5 focus:border-blue-500 outline-none cursor-pointer`}
                                                        value={service.motoristaId || ''}
                                                        onChange={async (e) => {
                                                            const newDriverId = e.target.value;
                                                            if (newDriverId) {
                                                                await updateServico({ ...service, motoristaId: newDriverId });
                                                            } else {
                                                                await updateServico({ ...service, motoristaId: undefined });
                                                            }
                                                        }}
                                                    >
                                                        <option value="">-- Por atribuir --</option>
                                                        {motoristas.filter(m => m.status === 'disponivel' || m.id === service.motoristaId).map(m => (
                                                            <option key={m.id} value={m.id}>{m.nome}</option>
                                                        ))}
                                                        <option disabled>──────────</option>
                                                        {motoristas.filter(m => m.status !== 'disponivel' && m.id !== service.motoristaId).map(m => (
                                                            <option key={m.id} value={m.id} className="text-slate-500">{m.nome} ({m.status})</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Ações */}
                                                <div className="flex justify-end items-center gap-2" onClick={e => e.stopPropagation()}>
                                                    <button
                                                        onClick={(e) => handleDeleteService(service.id, e)}
                                                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL: NEW SERVICE */}
            {
                showNewServiceModal && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                        <div className="bg-[#1e293b] border border-white/10 p-0 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-6 bg-slate-900/50 border-b border-white/5 flex items-center gap-3">
                                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                                    <Plus className="w-5 h-5" />
                                </div>
                                <h2 className="text-xl font-bold text-white">{t('schedule.modal.new.title')}</h2>
                            </div>

                            <form onSubmit={handleCreateService} className="p-6 space-y-5">
                                <div className="grid grid-cols-3 gap-5">
                                    <div className="col-span-1">
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t('schedule.modal.new.entry_time')}</label>
                                        <input
                                            type="time"
                                            required
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                            value={newService.hora}
                                            onChange={e => setNewService({ ...newService, hora: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t('schedule.modal.new.passenger')}</label>
                                        <div className="relative">
                                            <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                            <input
                                                type="text"
                                                required
                                                placeholder="Nome do passageiro..."
                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={newService.passageiro}
                                                onChange={e => setNewService({ ...newService, passageiro: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t('schedule.modal.new.pickup')}</label>
                                        <input
                                            type="text"
                                            required
                                            list="geofences-list"
                                            placeholder="Onde apanhar..."
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={newService.origem}
                                            onChange={e => setNewService({ ...newService, origem: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t('schedule.modal.new.workplace')}</label>
                                        <input
                                            type="text"
                                            required
                                            list="geofences-list"
                                            placeholder="Destino..."
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={newService.destino}
                                            onChange={e => setNewService({ ...newService, destino: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t('schedule.modal.new.ref')}</label>
                                        <input
                                            type="text"
                                            placeholder="Ex: Voo LX123"
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={newService.referencia}
                                            onChange={e => setNewService({ ...newService, referencia: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t('menu.cost_centers')}</label>
                                        <select
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                                            value={newService.centroCustoId}
                                            onChange={e => setNewService({ ...newService, centroCustoId: e.target.value })}
                                        >
                                            <option value="">(Sem custo associado)</option>
                                            {centrosCustos.map(cc => (
                                                <option key={cc.id} value={cc.id}>{cc.nome}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-white/5">
                                    <label className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl border border-white/5 cursor-pointer hover:bg-slate-900 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={newService.temRegresso}
                                            onChange={e => setNewService({ ...newService, temRegresso: e.target.checked })}
                                            className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
                                        />
                                        <span className="text-sm font-bold text-slate-300">
                                            {t('schedule.modal.new.return_check')}
                                        </span>
                                    </label>

                                    {newService.temRegresso && (
                                        <div className="mt-4 pl-4 border-l-2 border-slate-700 space-y-4 animate-in slide-in-from-top-2">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t('schedule.modal.new.exit_time')}</label>
                                                    <input
                                                        type="time"
                                                        required
                                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                                        value={newService.horaRegresso}
                                                        onChange={e => setNewService({ ...newService, horaRegresso: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t('schedule.modal.new.diff_dest')}</label>
                                                    <input
                                                        type="text"
                                                        list="geofences-list"
                                                        placeholder="Opcional..."
                                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                        value={newService.destinoRegresso}
                                                        onChange={e => setNewService({ ...newService, destinoRegresso: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowNewServiceModal(false)}
                                        className="px-6 py-3 text-slate-400 hover:text-white transition-colors text-sm font-medium"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 flex items-center gap-2"
                                    >
                                        <Plus className="w-5 h-5" />
                                        {t('schedule.modal.new.add_btn')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* MODAL: URGENT REQUEST */}
            {
                showUrgentModal && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
                        <div className="bg-[#1e293b] border border-red-500/30 p-8 rounded-3xl w-full max-w-lg shadow-[0_0_50px_rgba(239,68,68,0.15)] animate-in zoom-in-95 duration-200">
                            <div className="flex items-center gap-4 mb-8 text-red-500">
                                <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20">
                                    <Siren className="w-8 h-8" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white">{t('schedule.modal.urgent.title')}</h2>
                                    <p className="text-red-400/80 text-sm font-medium">Este pedido será notificado aos supervisores.</p>
                                </div>
                            </div>

                            <form onSubmit={handleUrgentRequest} className="space-y-6">

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">{t('schedule.modal.urgent.time')}</label>
                                        <input
                                            type="time"
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3.5 text-white focus:ring-2 focus:ring-red-500 outline-none shadow-inner"
                                            value={urgentData.hora}
                                            onChange={e => setUrgentData({ ...urgentData, hora: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">{t('schedule.modal.urgent.passenger')}</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Nome..."
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3.5 text-white focus:ring-2 focus:ring-red-500 outline-none shadow-inner"
                                            value={urgentData.passageiro}
                                            onChange={e => setUrgentData({ ...urgentData, passageiro: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">{t('schedule.modal.urgent.pickup')}</label>
                                        <input
                                            type="text"
                                            required
                                            list="geofences-list"
                                            placeholder="Onde está..."
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3.5 text-white focus:ring-2 focus:ring-red-500 outline-none shadow-inner"
                                            value={urgentData.origem}
                                            onChange={e => setUrgentData({ ...urgentData, origem: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">{t('schedule.modal.urgent.dropoff')}</label>
                                        <input
                                            type="text"
                                            required
                                            list="geofences-list"
                                            placeholder="Para onde vai..."
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3.5 text-white focus:ring-2 focus:ring-red-500 outline-none shadow-inner"
                                            value={urgentData.destino}
                                            onChange={e => setUrgentData({ ...urgentData, destino: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">{t('schedule.modal.urgent.obs')}</label>
                                    <textarea
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3.5 text-white focus:ring-2 focus:ring-red-500 outline-none resize-none shadow-inner"
                                        rows={3}
                                        placeholder="Detalhes adicionais..."
                                        value={urgentData.obs}
                                        onChange={e => setUrgentData({ ...urgentData, obs: e.target.value })}
                                    />
                                </div>

                                <div className="flex gap-4 pt-4 border-t border-white/5">
                                    <button
                                        type="button"
                                        onClick={() => setShowUrgentModal(false)}
                                        className="flex-1 py-4 bg-slate-800 text-slate-300 hover:text-white rounded-xl font-bold transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-[2] py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-900/40 flex items-center justify-center gap-3 transform hover:scale-[1.02] transition-all"
                                    >
                                        <Send className="w-5 h-5" />
                                        {t('schedule.modal.urgent.send')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
            {/* Datalist for geofences suggestions */}
            <datalist id="geofences-list">
                {geofences.map(geo => (
                    <option key={geo.id} value={geo.name} />
                ))}
            </datalist>
        </div >
    );
}
