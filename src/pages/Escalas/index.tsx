import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    Upload, Plus, Calendar,
    CheckSquare, MoreVertical, Trash2, ArrowRight, Siren,
    Send, MapPin, Clock, Users, Car,
    Search, LayoutList, AlertTriangle, Edit,
    Table as TableIcon, LayoutGrid, CloudLightning, FileText, Settings, CheckCircle
} from 'lucide-react';

import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import PageHeader from '../../components/common/PageHeader';
import DispatchBoard from './DispatchBoard';
import EscalaTimelineModal from './EscalaTimelineModal';
import { coerceServiceStatus, updateServiceStatus } from '../../services/serviceStatus';

import * as XLSX from 'xlsx';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import type { Servico, Notification } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { fetchSheetCSV, parseSheetToServices, groupServicesIntoTrips, suggestDrivers, autoGroupTripsByZone, generateAutoDispatchTrips, type GroupedTrip } from './EscalaAutomation';
import { emailService } from '../../services/emailService';
import { ColaboradorService } from '../../services/colaboradorService';
import type { Colaborador as ColaboradorType } from '../../services/colaboradorService';

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
    colaboradorId?: string;
    validationPoints: string[];
}

// Sortable Driver Card Component
function SortableDriverCard({ driver, children, isDistributeMode, activeDriverId, activeDriverMenuId, onClick, onDragOver, onDragLeave, onDrop }: any) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: driver.id, disabled: isDistributeMode }); // Disable drag if in Quick Distribute Mode

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 100 : 'auto',
        opacity: isDragging ? 0.3 : 1
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`bg-[#1e293b] rounded-2xl shadow-lg flex flex-col group transition-all duration-200 min-h-[420px] max-h-[calc(100vh-280px)]
                ${isDistributeMode && activeDriverId === driver.id ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-[#0f172a]' : ''}
                border border-white/5 hover:border-white/10
                ${activeDriverMenuId === driver.id ? 'relative z-50' : ''}
            `}
            onClick={onClick}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            {/* Handle for Dragging (Optional: could handle on whole card, but let's use header) */}
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
                {children}
            </div>
        </div>
    );
}

export default function Escalas() {
    const {
        motoristas, servicos, addNotification, notifications, updateNotification, centrosCustos,
        updateServico, deleteServico, deleteMotorista, updateMotorista, geofences,
        complianceStats, locais, checkRouteValidation, scaleBatches, createScaleBatch,
        zonasOperacionais, refreshData, viaturas, cartrackVehicles,
        escalaTemplates, escalaTemplateItems, addEscalaTemplate, deleteEscalaTemplate, addTemplateItem, deleteTemplateItem,
        publishBatch
    } = useWorkshop();
    const { userRole } = useAuth();
    const { hasAccess } = usePermissions();

    const { t } = useTranslation();
    const autoEmailEnabled = String(import.meta.env.VITE_EMAIL_AUTO_SEND ?? 'false') === 'true';


    // ... (lines skipped)

    // ... (lines skipped)



    // Core State
    const [selectedPendentes, setSelectedPendentes] = useState<string[]>([]);
    const [selectedMotoristaForAssign, setSelectedMotoristaForAssign] = useState<string>('');
    const [selectedCentroCusto, setSelectedCentroCusto] = useState<string>('all');
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);



    // Mobile sidebar state
    // const [isPendingSidebarOpen, setIsPendingSidebarOpen] = useState(false); // Removed: Use layout directly
    // Desktop sidebar state
    // const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); // Removed: Use layout directly



    // View Mode State
    const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

    // Grouping State
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'busy'>('all');
    const [colaboradores, setColaboradores] = useState<ColaboradorType[]>([]);

    useEffect(() => {
        const loadColaboradores = async () => {
            const list = await ColaboradorService.listarTodos();
            setColaboradores(list);
        };
        loadColaboradores();
    }, []);



    // Quick Distribution Mode State
    const [isDistributeMode] = useState(false);
    const [activeDriverId, setActiveDriverId] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Driver Menu State
    const [activeDriverMenuId, setActiveDriverMenuId] = useState<string | null>(null);

    // New Manual Service State
    const [showNewServiceModal, setShowNewServiceModal] = useState(false);
    const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
    const [timelineBatchId, setTimelineBatchId] = useState<string | null>(null);
    const [publishingBatchId, setPublishingBatchId] = useState<string | null>(null);
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
        centroCustoId: '',
        colaboradorId: '',
        validationPoints: []
    });

    // Urgent Request State
    const [showUrgentModal, setShowUrgentModal] = useState(false);
    const [urgentData, setUrgentData] = useState({ hora: '12:00', passageiro: '', origem: '', destino: '', obs: '' });

    // Automation States
    const [showAutoModal, setShowAutoModal] = useState(false);
    const [isAutoLoading, setIsAutoLoading] = useState(false);
    const [automationTrips, setAutomationTrips] = useState<GroupedTrip[]>([]);
    const [automationMode, setAutomationMode] = useState<'import' | 'auto-dispatch'>('import');
    const [sendingScheduleServiceId, setSendingScheduleServiceId] = useState<string | null>(null);
    const [autoSettings, setAutoSettings] = useState({
        albufeiraUrl: localStorage.getItem('auto_sheet_albufeira') || '',
        quarteiraUrl: localStorage.getItem('auto_sheet_quarteira') || ''
    });

    const viaturaById = useMemo(() => {
        const map = new Map<string, any>();
        viaturas.forEach(v => map.set(v.id, v));
        return map;
    }, [viaturas]);

    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [showManageTemplates, setShowManageTemplates] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

    const [newTemplateName, setNewTemplateName] = useState('');
    const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
    const [templateItemForm, setTemplateItemForm] = useState({
        hora_entrada: '09:00',
        hora_saida: '18:00',
        passageiro: '',
        local: '',
        obs: ''
    });

    const isUrgentService = (service: Partial<Servico>) => {
        if (service.isUrgent || service.status === 'URGENTE') return true;
        if (!service.hora) return false;

        const [hoursRaw, minutesRaw] = service.hora.split(':');
        const hours = Number(hoursRaw);
        const minutes = Number(minutesRaw);
        if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return false;

        const dateBase = service.data || selectedDate || new Date().toISOString().split('T')[0];
        const serviceDateTime = new Date(`${dateBase}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
        if (Number.isNaN(serviceDateTime.getTime())) return false;

        const diffMinutes = (serviceDateTime.getTime() - Date.now()) / 60000;
        return diffMinutes >= 0 && diffMinutes < 60;
    };

    const formatCheckpointTime = (value?: string | null) => {
        if (!value) return '--';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return '--';
        return parsed.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    };

    const getServiceVisualState = (service: Servico): 'urgent' | 'completed' | 'active' | 'delayed' | 'scheduled' => {
        if (isUrgentService(service)) return 'urgent';
        const canonical = coerceServiceStatus(service.status) || updateServiceStatus(service);
        if (canonical === 'COMPLETED') return 'completed';
        if (canonical === 'EN_ROUTE_ORIGIN' || canonical === 'ARRIVED_ORIGIN' || canonical === 'BOARDING' || canonical === 'EN_ROUTE_DESTINATION') return 'active';
        if (canonical === 'DRIVER_ASSIGNED' || canonical === 'SCHEDULED') return 'scheduled';
        return 'scheduled';
    };

    const getServiceVisualStyles = (service: Servico) => {
        const state = getServiceVisualState(service);
        if (state === 'urgent') return { label: 'Urgent', badge: 'bg-red-500/20 text-red-300 border-red-500/40', border: 'border-red-500/40' };
        if (state === 'completed') return { label: 'Completed', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', border: 'border-emerald-500/30' };
        if (state === 'active') return { label: 'Active', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40', border: 'border-amber-500/30' };
        if (state === 'delayed') return { label: 'Delayed', badge: 'bg-red-500/20 text-red-300 border-red-500/40', border: 'border-red-500/30' };
        return { label: 'Scheduled', badge: 'bg-slate-500/20 text-slate-300 border-slate-500/40', border: 'border-slate-600/30' };
    };

    const handlePendingDragStart = (serviceId: string) => (e: React.DragEvent) => {
        e.dataTransfer.setData('text/plain', serviceId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDropServiceOnDriver = async (driverId: string, e: React.DragEvent) => {
        e.preventDefault();
        const serviceId = e.dataTransfer.getData('text/plain');
        if (!serviceId) return;
        const service = servicos.find(s => s.id === serviceId);
        if (!service) return;
        await updateServico({ ...service, motoristaId: driverId });
        if (isUrgentService(service)) {
            await notifyUrgentAssignment(service, driverId);
        }
    };

    const notifyUrgentAssignment = async (service: Servico, driverId: string) => {
        const driver = motoristas.find(m => m.id === driverId);
        const centro = centrosCustos.find(c => c.id === service.centroCustoId);

        await addNotification({
            id: crypto.randomUUID(),
            type: 'transport_assignment',
            data: {
                serviceId: service.id,
                passenger: service.passageiro,
                origin: service.origem,
                destination: service.destino,
                time: service.hora,
                title: '⚠ Serviço URGENTE atribuído',
                message: `${service.passageiro} • ${service.hora} • ${service.origem} → ${service.destino}`,
                priority: 'high'
            },
            status: 'pending',
            response: { driverId, serviceId: service.id },
            timestamp: new Date().toISOString()
        });

        await addNotification({
            id: crypto.randomUUID(),
            type: 'system_alert',
            data: {
                title: '⚠ Atribuição URGENTE confirmada',
                message: `Motorista ${driver?.nome || 'N/D'} atribuído ao serviço ${service.hora} (${centro?.nome || 'Centro Operacional'}).`,
                priority: 'high'
            },
            status: 'pending',
            timestamp: new Date().toISOString()
        });
    };

    const handleRunAutomation = async () => {
        setIsAutoLoading(true);
        try {
            const url = selectedCentroCusto === 'albufeira' ? autoSettings.albufeiraUrl : autoSettings.quarteiraUrl;
            if (!url) {
                alert('Por favor, configure o URL da folha nas Definições de Automação.');
                return;
            }

            localStorage.setItem('auto_sheet_albufeira', autoSettings.albufeiraUrl);
            localStorage.setItem('auto_sheet_quarteira', autoSettings.quarteiraUrl);

            const rows = await fetchSheetCSV(url, selectedDate);
            const rawServices = parseSheetToServices(rows, selectedDate, selectedCentroCusto);

            // Initial grouping using exact locations + zones enrichment
            const trips = groupServicesIntoTrips(rawServices, zonasOperacionais);

            // Initial Suggestion of drivers
            const suggested = suggestDrivers(trips, motoristas, servicos, selectedCentroCusto);

            setAutomationTrips(suggested);
            setAutomationMode('import');
            setShowAutoModal(true);
        } catch (error: any) {
            alert('Erro na Automação: ' + error.message);
        } finally {
            setIsAutoLoading(false);
        }
    };

    const handleGenerateAutoDispatch = async () => {
        setIsAutoLoading(true);
        try {
            const plannedPassengers = servicos.filter((s: Servico) => {
                if (s.concluido || s.motoristaId) return false;
                if ((s.data || selectedDate) !== selectedDate) return false;
                if (selectedCentroCusto !== 'all' && s.centroCustoId !== selectedCentroCusto) return false;
                return Boolean(s.hora && s.origem && s.destino && s.passageiro);
            });

            if (plannedPassengers.length === 0) {
                alert('Sem passageiros planeados pendentes para gerar serviços automáticos nesta data.');
                return;
            }

            const generated = generateAutoDispatchTrips({
                services: plannedPassengers,
                motoristas,
                viaturas,
                existingServicos: servicos,
                locais,
                cartrackVehicles,
                selectedDate,
                selectedCentroCusto
            });

            if (generated.length === 0) {
                alert('Não foi possível gerar serviços automáticos com os critérios atuais.');
                return;
            }

            setAutomationTrips(generated);
            setAutomationMode('auto-dispatch');
            setShowAutoModal(true);
        } finally {
            setIsAutoLoading(false);
        }
    };

    const handleLaunchTemplate = async (templateId: string) => {
        const template = escalaTemplates.find(t => t.id === templateId);
        if (!template) return;

        const items = escalaTemplateItems.filter(ti => ti.template_id === templateId);
        if (items.length === 0) {
            alert('Este modelo não tem itens.');
            return;
        }

        const servicesToAdd: Servico[] = [];

        items.forEach(item => {
            // Entry Service
            if (item.hora_entrada) {
                servicesToAdd.push({
                    id: crypto.randomUUID(),
                    data: selectedDate,
                    hora: item.hora_entrada,
                    passageiro: item.passageiro || 'Staff',
                    origem: item.local,
                    destino: 'Hotel/Base', // Generic or from local mapping
                    obs: item.obs || 'Entrada (Modelo)',
                    concluido: false,
                    centroCustoId: template.centro_custo_id || (selectedCentroCusto !== 'all' ? selectedCentroCusto : undefined)
                });
            }
            // Return Service
            if (item.hora_saida) {
                servicesToAdd.push({
                    id: crypto.randomUUID(),
                    data: selectedDate,
                    hora: item.hora_saida,
                    passageiro: item.passageiro || 'Staff',
                    origem: 'Hotel/Base',
                    destino: item.local,
                    obs: item.obs || 'Saída (Modelo)',
                    concluido: false,
                    centroCustoId: template.centro_custo_id || (selectedCentroCusto !== 'all' ? selectedCentroCusto : undefined)
                });
            }
        });

        const batchData = {
            notes: `Escala Permanente: ${template.nome}`,
            centroCustoId: selectedCentroCusto !== 'all' ? selectedCentroCusto : (template.centro_custo_id || ''),
            referenceDate: selectedDate
        };

        const result = await createScaleBatch(batchData, servicesToAdd);
        if (result.success) {
            setShowTemplateModal(false);
            addNotification({
                id: crypto.randomUUID(),
                type: 'system_alert',
                data: {
                    message: `Escala gerada a partir do modelo "${template.nome}"`,
                    title: 'Sucesso'
                },
                status: 'pending',
                timestamp: new Date().toISOString()
            });
        }
    };

    const applyAutoGroupingByZone = () => {
        setAutomationTrips(prev => autoGroupTripsByZone(prev));
    };

    const confirmAutomation = async () => {
        const allServicesToCreate: any[] = [];

        if (automationMode === 'auto-dispatch') {
            automationTrips.forEach(trip => {
                const passengerNames = trip.servicos.map(s => s.passageiro).filter(Boolean);
                const passengerCount = Number(trip.passengerCount || trip.servicos.length || 1);
                const vehicleCapacity = Number(trip.vehicleCapacity || viaturaById.get(trip.vehicleId || '')?.vehicleCapacity || 8);
                const occupancyRate = Number((((passengerCount / Math.max(vehicleCapacity, 1)) * 100)).toFixed(2));

                allServicesToCreate.push({
                    id: crypto.randomUUID(),
                    data: selectedDate,
                    hora: trip.hora,
                    passageiro: passengerCount > 1 ? `Grupo (${passengerCount} passageiros)` : (passengerNames[0] || 'Passageiro'),
                    origem: trip.origem,
                    destino: trip.destino,
                    obs: `Auto Dispatch | ${passengerNames.join(', ')}`,
                    concluido: false,
                    centroCustoId: selectedCentroCusto !== 'all' ? selectedCentroCusto : undefined,
                    motoristaId: trip.motoristaId,
                    vehicleId: trip.vehicleId || null,
                    passengerCount,
                    occupancyRate,
                    originLocationId: trip.servicos[0]?.originLocationId || null,
                    destinationLocationId: trip.servicos[0]?.destinationLocationId || null
                });
            });
        } else {
            automationTrips.forEach(trip => {
                trip.servicos.forEach(s => {
                    allServicesToCreate.push({
                        ...s,
                        motoristaId: trip.motoristaId,
                        vehicleId: trip.vehicleId || null,
                        passengerCount: Number(trip.passengerCount || 1),
                        occupancyRate: trip.occupancyRate ?? null
                    });
                });
            });
        }

        const batchData = {
            notes: `Automação: ${selectedDate}`,
            centroCustoId: selectedCentroCusto,
            referenceDate: selectedDate
        };

        const result = await createScaleBatch(batchData, allServicesToCreate);
        if (result.success) {
            await refreshData();
            setShowAutoModal(false);
            addNotification({
                id: crypto.randomUUID(),
                type: 'system_alert',
                data: {
                    message: `Escala gerada com sucesso! ${allServicesToCreate.length} serviços importados.`,
                    title: 'Sucesso'
                },
                status: 'pending',
                timestamp: new Date().toISOString()
            });
        } else {
            alert('Erro ao guardar escala: ' + result.error);
        }
    };
    // Layout & Filter State
    const [showAutoSettings, setShowAutoSettings] = useState(false);
    const [layoutCols, setLayoutCols] = useState<number>(() => {
        const saved = localStorage.getItem('escalas_layout_cols');
        return saved ? parseInt(saved) : 3;
    });
    const [driverOrder, setDriverOrder] = useState<string[]>(() => {
        const saved = localStorage.getItem('escalas_driver_order');
        return saved ? JSON.parse(saved) : [];
    });

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );


    // Save Layout Effects
    useEffect(() => {
        localStorage.setItem('escalas_layout_cols', layoutCols.toString());
    }, [layoutCols]);

    useEffect(() => {
        if (driverOrder.length > 0)
            localStorage.setItem('escalas_driver_order', JSON.stringify(driverOrder));
    }, [driverOrder]);

    // Quick Assign Function


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
        // Filter by Date
        // If service has explicit 'data', use it.
        // If not, try to fallback (optional: depending on business rule, we might default to today or show all legacy).

        // Better fallback: if s.data is missing, maybe we shouldn't hide it yet to avoid data loss visibility.
        // But the user wants control. Let's strictly filter if s.data exists.
        if (s.data && s.data !== selectedDate) return false;

        // Filter by Batch
        if (selectedBatchId && s.batchId !== selectedBatchId) return false;
        // If s.data is missing, we might want to still show it? Or assume it's legacy 'today'?
        // For now: Check if s.data matches. If s.data is undefined, check if we are on "Today".
        if (!s.data) {
            // Basic legacy support: match today
            const today = new Date().toISOString().split('T')[0];
            if (selectedDate !== today) return false;
        }

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

    // Global Pending Calculation for Sidebar Grouping
    const globalPendentes = servicos.filter(s => {
        if (s.motoristaId || s.concluido) return false;
        if (selectedCentroCusto !== 'all' && s.centroCustoId !== selectedCentroCusto) return false;
        return true;
    });

    // Compute Batches that have pending services
    const pendingBatches = scaleBatches.filter(batch => {
        return globalPendentes.some(s => s.batchId === batch.id);
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const adHocPendentes = globalPendentes.filter(s => !s.batchId);

    // Sidebar Count


    const pendentes = filteredServicos.filter(s => !s.motoristaId).sort((a, b) => a.hora.localeCompare(b.hora));
    const assigned = filteredServicos.filter(s => s.motoristaId);
    const urgentServices = filteredServicos.filter(s => isUrgentService(s));
    const urgentPendingServices = urgentServices.filter(s => !s.motoristaId);

    // Logic & Filters
    const filteredMotoristas = motoristas.filter(m => {
        if (selectedCentroCusto !== 'all' && m.centroCustoId !== selectedCentroCusto) return false;

        if (filterStatus === 'all') return true;
        if (filterStatus === 'available') return m.status === 'disponivel';
        if (filterStatus === 'busy') return m.status === 'ocupado';
        return true;
    }).filter(m => {
        if (searchTerm) return m.nome.toLowerCase().includes(searchTerm.toLowerCase());
        return true;
    });



    // Stats
    const totalServices = filteredServicos.length;
    const progressPercentage = totalServices > 0 ? Math.round((assigned.length / totalServices) * 100) : 0;

    const handleDownloadTemplate = () => {
        const headers = [
            'Nome do funcionário',
            'Origem',
            'Destino',
            'Horário de apanhar transporte',
            'Horário de saída do serviço',
            'Voo',
            'Observações'
        ];

        // Create an example row with the first local if available
        const exampleRow = [
            'Exemplo João Silva',
            locais.length > 0 ? locais[0].nome : 'Hotel ABC',
            locais.length > 1 ? locais[1].nome : 'Aeroporto FARO',
            '09:00',
            '18:00',
            'TP123',
            'Exemplo de nota'
        ];

        const wsData = [headers, exampleRow];
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Add a second sheet with all locations for reference
        const localesData = locais.map(l => ({
            'Nome do Local': l.nome,
            'Tipo': l.tipo,
            'Área': l.centroCustoId || 'N/A'
        }));

        const wsLocales = XLSX.utils.json_to_sheet(localesData);

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Importar Escala");
        XLSX.utils.book_append_sheet(wb, wsLocales, "Locais Disponíveis");

        XLSX.writeFile(wb, "Template_Escala_Import.xlsx");

        addNotification({
            id: crypto.randomUUID(),
            type: 'system_alert',
            data: {
                message: 'Modelo Excel descarregado com os locais e configurações atuais.',
                title: 'Modelo Atualizado'
            },
            status: 'pending',
            timestamp: new Date().toISOString()
        });
    };

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
                    const voo = row['Voo'] || '';
                    const obsRow = row['Observações'] || '';

                    if (horaEntrada) {
                        mappedServicos.push({
                            id: crypto.randomUUID(),
                            hora: horaEntrada,
                            passageiro: nome,
                            origem: origem,
                            destino: destino,
                            voo: voo,
                            obs: obsRow ? `Entrada - ${obsRow}` : 'Entrada (Importado)',
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
                            voo: voo,
                            obs: obsRow ? `Saída - ${obsRow}` : 'Saída (Importado)',
                            concluido: false,
                            centroCustoId: selectedCentroCusto !== 'all' ? selectedCentroCusto : undefined
                        });
                    }
                });

                if (mappedServicos.length === 0) {
                    alert(t('schedule.alerts.no_valid_data'));
                } else {
                    // Create a Batch for this upload
                    const batchData = {
                        notes: `Importado via Excel (${file.name})`,
                        centroCustoId: selectedCentroCusto !== 'all' ? selectedCentroCusto : mappedServicos[0].centroCustoId || '',
                        referenceDate: selectedDate
                    };

                    const result = await createScaleBatch(batchData, mappedServicos);

                    if (result.success) {
                        addNotification({
                            id: crypto.randomUUID(),
                            type: 'system_alert',
                            data: {
                                message: `Lote "${batchData.notes}" criado com ${mappedServicos.length} serviços!`,
                                title: 'Sucesso'
                            },
                            status: 'pending',
                            timestamp: new Date().toISOString()
                        });
                    } else {
                        alert(`Erro ao criar lote: ${result.error}`);
                        // Fallback? No, if batch fails, we shouldn't add partials.
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

        // Try to find colaboradorId by name
        const associatedColab = colaboradores.find(c => c.nome === newService.passageiro);
        const colabId = associatedColab?.id || newService.colaboradorId;

        const entryService: Servico = {
            id: crypto.randomUUID(),
            data: selectedDate, // Use currently selected date
            hora: newService.hora,
            passageiro: newService.passageiro || 'Staff',
            origem: newService.origem,
            destino: newService.destino,
            voo: newService.referencia,
            obs: 'Entrada',
            concluido: false,
            centroCustoId: newService.centroCustoId || (selectedCentroCusto !== 'all' ? selectedCentroCusto : undefined),
            colaboradorId: colabId,
            validationPoints: newService.validationPoints
        };
        entryService.isUrgent = isUrgentService(entryService);
        entryService.status = entryService.isUrgent ? 'URGENTE' : entryService.status;

        const servicesToAdd: Servico[] = [entryService];

        if (newService.temRegresso) {
            const returnDest = newService.destinoRegresso || newService.origem;
            const returnService: Servico = {
                id: crypto.randomUUID(),
                data: selectedDate,
                hora: newService.horaRegresso,
                passageiro: newService.passageiro || 'Staff',
                origem: newService.destino,
                destino: returnDest,
                voo: newService.referencia,
                obs: 'Saída',
                concluido: false,
                centroCustoId: newService.centroCustoId || (selectedCentroCusto !== 'all' ? selectedCentroCusto : undefined),
                colaboradorId: colabId,
                validationPoints: newService.validationPoints
            };

            returnService.isUrgent = isUrgentService(returnService);
            returnService.status = returnService.isUrgent ? 'URGENTE' : returnService.status;
            servicesToAdd.push(returnService);
        }

        const batchData = {
            notes: `Escala Manual: ${newService.passageiro}`,
            centroCustoId: newService.centroCustoId || (selectedCentroCusto !== 'all' ? selectedCentroCusto : ''),
            referenceDate: selectedDate
        };

        const result = await createScaleBatch(batchData, servicesToAdd);

        if (result.success) {
            addNotification({
                id: crypto.randomUUID(),
                type: 'system_alert',
                data: {
                    message: 'Serviço(s) criado(s) com sucesso!',
                    title: 'Sucesso'
                },
                status: 'pending',
                timestamp: new Date().toISOString()
            });
        } else {
            alert('Erro ao criar serviço: ' + result.error);
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
            centroCustoId: '',
            validationPoints: []
        });
    };

    const handleAssign = async () => {
        if (!selectedMotoristaForAssign || selectedPendentes.length === 0) return;

        const servicesToUpdate = servicos.filter(s => selectedPendentes.includes(s.id));
        await Promise.all(servicesToUpdate.map(s => updateServico({ ...s, motoristaId: selectedMotoristaForAssign })));
        await Promise.all(
            servicesToUpdate
                .filter(s => isUrgentService(s))
                .map(s => notifyUrgentAssignment(s, selectedMotoristaForAssign))
        );

        if (autoEmailEnabled) {
            const driver = motoristas.find(m => m.id === selectedMotoristaForAssign);
            if (driver?.email) {
                await Promise.all(
                    servicesToUpdate.map(service =>
                        emailService.sendDriverScheduleEmail(
                            emailService.mapDriverSchedulePayload(service, driver.nome, driver.email!, selectedDate)
                        )
                    )
                );
            }
        }

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
            addNotification({
                id: crypto.randomUUID(),
                type: 'system_alert',
                data: {
                    message: 'Serviço eliminado com sucesso.',
                    title: 'Eliminado'
                },
                status: 'pending',
                timestamp: new Date().toISOString()
            });
        }
    };

    const handlePublishBatch = async (batchId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setPublishingBatchId(batchId);
        try {
            const result = await publishBatch(batchId);
            if (result.success) {
                setTimelineBatchId(batchId);
            } else {
                alert('Erro ao publicar escala: ' + result.error);
            }
        } finally {
            setPublishingBatchId(null);
        }
    };

    const handleSendScheduleEmail = async (service: Servico) => {
        if (!service.motoristaId) {
            alert('Atribua um motorista antes de enviar a escala por email.');
            return;
        }

        const driver = motoristas.find(m => m.id === service.motoristaId);
        if (!driver?.email) {
            alert('Motorista sem email configurado.');
            return;
        }

        setSendingScheduleServiceId(service.id);
        try {
            await emailService.sendDriverScheduleEmail(
                emailService.mapDriverSchedulePayload(service, driver.nome, driver.email, selectedDate)
            );
            alert('Email enviado com sucesso.');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Falha inesperada';
            alert(`Erro ao enviar email: ${message}`);
        } finally {
            setSendingScheduleServiceId(null);
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

    const processedMotoristas = useMemo(() => {
        if (driverOrder.length === 0) return filteredMotoristas;
        return [...filteredMotoristas].sort((a, b) => {
            const indexA = driverOrder.indexOf(a.id);
            const indexB = driverOrder.indexOf(b.id);
            if (indexA === -1 && indexB === -1) return 0;
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });
    }, [filteredMotoristas, driverOrder]);

    const handleDragDriverEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        setDriverOrder((items) => {
            // Ensure we have a complete list of IDs including new ones if not present
            const currentIds = items.length > 0 ? items : processedMotoristas.map(m => m.id);
            // If the list is still empty (edge case), use processed
            const baseList = currentIds.length === 0 ? processedMotoristas.map(m => m.id) : currentIds;

            const oldIndex = baseList.indexOf(active.id as string);
            const newIndex = baseList.indexOf(over.id as string);

            if (oldIndex !== -1 && newIndex !== -1) {
                return arrayMove(baseList, oldIndex, newIndex);
            }
            return baseList;
        });
    };




    useEffect(() => {
        if (driverOrder.length > 0)
            localStorage.setItem('escalas_driver_order', JSON.stringify(driverOrder));
    }, [driverOrder]);


    return (
        <div className="flex flex-col w-full h-full bg-[#0f172a] relative overflow-y-auto md:overflow-hidden custom-scrollbar">

            {/* HEADER TOOLBAR */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept=".xlsx, .xls, .csv"
            />

            <PageHeader
                title="Gestão de Escalas"
                subtitle="Mapas, Escalas e Distribuição"
                icon={Calendar}
                breadcrumbs={[]}
                actions={
                    <>



                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                            {/* Date Picker */}
                            <div className="relative group">
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => {
                                        setSelectedDate(e.target.value);
                                        setSelectedBatchId(null);
                                    }}
                                    className="bg-[#1e293b] text-white text-sm font-bold px-3 py-2 pl-9 rounded-lg border border-white/5 outline-none focus:border-blue-500 transition-colors shadow-sm"
                                />
                                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            </div>

                            {/* Action Buttons */}
                            {hasAccess(userRole, 'escalas_create') && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setShowNewServiceModal(true)}
                                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <span className="hidden md:inline">Novo Serviço</span>
                                    </button>

                                    <button
                                        onClick={() => setShowUrgentModal(true)}
                                        className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-red-900/20 active:scale-95 transition-all"
                                        title="Transporte de Emergência"
                                    >
                                        <Siren className="w-4 h-4" />
                                        <span className="hidden md:inline">Emergência</span>
                                    </button>

                                    <button
                                        onClick={handleRunAutomation}
                                        disabled={isAutoLoading || selectedCentroCusto === 'all'}
                                        className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/20 active:scale-95 transition-all"
                                    >
                                        {isAutoLoading ? <Clock className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                        <span className="hidden md:inline">Automação</span>
                                    </button>

                                    <button
                                        onClick={handleGenerateAutoDispatch}
                                        disabled={isAutoLoading}
                                        className="bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-fuchsia-900/20 active:scale-95 transition-all"
                                    >
                                        {isAutoLoading ? <Clock className="w-4 h-4 animate-spin" /> : <CloudLightning className="w-4 h-4" />}
                                        <span className="hidden md:inline">Gerar Serviços Automaticamente</span>
                                    </button>

                                    <button
                                        onClick={() => setShowTemplateModal(true)}
                                        className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-900/40 active:scale-95 transition-all"
                                    >
                                        <CloudLightning className="w-4 h-4 text-amber-300" />
                                        <span className="hidden md:inline">Modelos</span>
                                    </button>

                                    <button
                                        onClick={handleDownloadTemplate}
                                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 border border-white/10 shadow-lg active:scale-95 transition-all"
                                        title="Descarregar ou Atualizar Modelo Excel com locais atuais"
                                    >
                                        <FileText className="w-4 h-4 text-emerald-400" />
                                        <span className="hidden md:inline">Modelo Excel</span>
                                    </button>

                                    <button
                                        onClick={() => setShowAutoSettings(true)}
                                        className="bg-[#1e293b] hover:bg-slate-700 text-white p-2 rounded-lg border border-white/5 transition-colors"
                                        title="Definições de Automação"
                                    >
                                        <Settings className="w-5 h-5" />
                                    </button>
                                </div>
                            )}
                        </div>

                    </>
                }
            >
                {/* Header Children (Filters & Stats) */}
                <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 w-full">

                    {/* Stats Group */}
                    <div className="flex items-center gap-4 md:gap-8 overflow-x-auto pb-2 xl:pb-0 w-full xl:w-auto">
                        <div className="flex items-center gap-4 shrink-0">
                            <div className="flex flex-col items-center">
                                <span className="text-[10px] uppercase text-slate-500 font-bold">Total</span>
                                <span className="text-xl font-bold text-white">{totalServices}</span>
                            </div>
                            <div className="w-px h-8 bg-white/5"></div>
                            <div className="flex flex-col items-center">
                                <span className="text-[10px] uppercase text-red-400 font-bold">Urgentes</span>
                                <div className="flex items-center gap-1">
                                    <span className={`text-xl font-bold ${urgentServices.length > 0 ? 'text-red-400' : 'text-slate-500'}`}>{urgentServices.length}</span>
                                    {urgentServices.length > 0 && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                                </div>
                            </div>
                            <div className="w-px h-8 bg-white/5"></div>
                            <div className="flex flex-col items-center">
                                <span className="text-[10px] uppercase text-slate-500 font-bold">Atribuídos</span>
                                <span className="text-xl font-bold text-blue-400">{assigned.length}</span>
                            </div>
                            <div className="w-px h-8 bg-white/5"></div>

                            {/* Pendentes Indicator */}
                            <div
                                className="flex flex-col items-center group relative"
                            >
                                <span className="text-[10px] uppercase text-slate-500 font-bold group-hover:text-amber-400 transition-colors">Pendentes</span>
                                <div className="flex items-center gap-1">
                                    <span className={`text-xl font-bold ${pendentes.length > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                                        {pendentes.length}
                                    </span>
                                    {pendentes.length > 0 && (
                                        <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="hidden md:flex flex-col gap-1 min-w-[120px]">
                            <div className="flex justify-between text-[10px] font-medium text-slate-400">
                                <span>Progresso</span>
                                <span>{progressPercentage}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                                    style={{ width: `${progressPercentage}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* Filters & Tools */}
                    <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                        {/* Search */}
                        <div className="relative flex-1 xl:flex-none min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Procurar serviço..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-[#1e293b] border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-blue-500/50 placeholder:text-slate-600"
                            />
                        </div>

                        {/* Cost Center Filter */}
                        <div className="hidden md:block w-40">
                            <select
                                value={selectedCentroCusto}
                                onChange={(e) => setSelectedCentroCusto(e.target.value)}
                                className="w-full bg-[#1e293b] border border-white/10 rounded-xl py-2 px-3 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
                            >
                                <option value="all">Todos Centros</option>
                                {centrosCustos.map(cc => (
                                    <option key={cc.id} value={cc.id}>{cc.nome}</option>
                                ))}
                            </select>
                        </div>

                        {/* View Mode Toggle */}
                        {hasAccess(userRole, 'escalas_create') && (
                            <div className="flex bg-[#1e293b] rounded-lg p-1 border border-white/5 shrink-0">
                                <button
                                    onClick={() => setViewMode('cards')}
                                    className={`p-1.5 rounded-md transition-all ${viewMode === 'cards' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                    title="Cartões"
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode('table')}
                                    className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                    title="Lista"
                                >
                                    <TableIcon className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </PageHeader>

            {urgentPendingServices.length > 0 && (
                <div className="mx-6 mt-4 mb-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-red-300 text-sm font-bold">
                        <AlertTriangle className="w-4 h-4" />
                        ⚠ {urgentPendingServices.length} serviço(s) URGENTE(s) pendente(s) de atribuição.
                    </div>
                </div>
            )}

            {/* MAIN CONTENT AREA */}

            <div className="flex-1 overflow-hidden relative">
                <div className="flex flex-col md:flex-row h-full w-full overflow-hidden">
                    {/* DRIVERS GRID WIDGET */}
                    <div className="flex-1 flex flex-col min-w-0 h-full relative md:border-r border-white/5">

                        {/* Status Tabs (Stick to top of widget) */}

                        {viewMode === 'cards' && (
                            <div className="flex-1 min-h-0 p-3 md:p-4 overflow-hidden">
                                <DispatchBoard
                                    motoristas={processedMotoristas}
                                    pendentes={pendentes}
                                    assigned={assigned}
                                    onMoveService={async (service, targetDriverId) => {
                                        await updateServico({ ...service, motoristaId: targetDriverId });
                                        if (targetDriverId && isUrgentService(service)) {
                                            await notifyUrgentAssignment(service, targetDriverId);
                                        }
                                    }}
                                    isUrgentService={isUrgentService}
                                />
                            </div>
                        )}

                        {viewMode === 'table' && (
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
                                            {filteredServicos.map((service) => (
                                                <div
                                                    key={service.id}
                                                    className={`grid grid-cols-[50px_80px_1fr_1fr_1fr_120px_200px_120px] gap-4 px-6 py-3 items-center hover:bg-white/[0.02] transition-colors ${selectedPendentes.includes(service.id) ? 'bg-blue-500/5' : ''}`}
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
                                                    <div className="text-sm font-medium text-slate-200 truncate flex items-center gap-2" title={service.passageiro}>
                                                        <span className="truncate">{service.passageiro}</span>
                                                        {isUrgentService(service) && (
                                                            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border border-red-500/40 bg-red-500/20 text-red-300 shrink-0">⚠ URGENTE</span>
                                                        )}
                                                    </div>

                                                    {/* Origem */}
                                                    <div className="text-sm text-slate-400 flex flex-col justify-center" title={service.origem}>
                                                        <span className="truncate">{service.origem}</span>
                                                        {service.originConfirmed && (
                                                            <div className="flex items-center gap-1 text-[10px] text-emerald-400 mt-0.5" title="Chegada à Origem Confirmada (Geofence)">
                                                                <CheckCircle className="w-3 h-3" />
                                                                <span>{service.originArrivalTime ? new Date(service.originArrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Confirmado'}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Destino */}
                                                    <div className="text-sm text-slate-400 flex flex-col justify-center" title={service.destino}>
                                                        <span className="truncate">{service.destino}</span>
                                                        {service.destinationConfirmed && (
                                                            <div className="flex items-center gap-1 text-[10px] text-emerald-400 mt-0.5" title="Chegada ao Destino Confirmada (Geofence)">
                                                                <CheckCircle className="w-3 h-3" />
                                                                <span>{service.destinationArrivalTime ? new Date(service.destinationArrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Confirmado'}</span>
                                                            </div>
                                                        )}
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
                                                                    if (isUrgentService(service)) {
                                                                        await notifyUrgentAssignment(service, newDriverId);
                                                                    }
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
                                                            onClick={() => handleSendScheduleEmail(service)}
                                                            disabled={sendingScheduleServiceId === service.id}
                                                            className="px-2 py-1.5 text-slate-500 hover:text-cyan-300 hover:bg-cyan-500/10 rounded-lg transition-colors disabled:opacity-60 flex items-center gap-1"
                                                            title="Enviar Escala"
                                                        >
                                                            <Send className="w-4 h-4" />
                                                            <span className="text-[11px] font-semibold">Enviar</span>
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleDeleteService(service.id, e)}
                                                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* MODAL: NEW SERVICE */}
                        {
                            showNewServiceModal && (
                                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 overflow-y-auto">
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
                                                            list="colaboradores-list"
                                                        />
                                                        <datalist id="colaboradores-list">
                                                            {colaboradores.map(c => (
                                                                <option key={c.id} value={c.nome}>{c.numero}</option>
                                                            ))}
                                                        </datalist>
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


                                            {/* Validation Points Selection */}
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Pontos de Validação (POIs)</label>
                                                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto custom-scrollbar p-2 border border-slate-700 rounded-xl bg-slate-950/50">
                                                    {locais.map(poi => (
                                                        <label key={poi.id} className="flex items-center gap-2 p-1.5 hover:bg-white/5 rounded-lg cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={newService.validationPoints.includes(poi.id)}
                                                                onChange={e => {
                                                                    const isChecked = e.target.checked;
                                                                    setNewService(prev => ({
                                                                        ...prev,
                                                                        validationPoints: isChecked
                                                                            ? [...prev.validationPoints, poi.id]
                                                                            : prev.validationPoints.filter(id => id !== poi.id)
                                                                    }));
                                                                }}
                                                                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-0"
                                                            />
                                                            <span className="text-xs text-slate-300">{poi.nome}</span>
                                                        </label>
                                                    ))}
                                                    {locais.length === 0 && <span className="text-xs text-slate-500 italic p-1">Nenhum POI criado.</span>}
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
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            )
                        }
                    </div >
                </div >
                {
                    hasAccess(userRole, 'escalas_view_pending') && viewMode === 'table' && (
                        <div className="w-full md:w-[350px] lg:w-[400px] shrink-0 h-full bg-[#0f172a] border-t md:border-t-0 md:border-l border-white/5">
                            <div className="h-full flex flex-col bg-[#0f172a] border-l border-white/5 overflow-hidden">
                                <div className="p-4 bg-[#0f172a]/95 backdrop-blur border-b border-white/5 flex items-center gap-3 shrink-0">
                                    <div className="p-2 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg shadow-lg shadow-purple-900/20">
                                        <Upload className="w-4 h-4 text-white" />
                                    </div>
                                    <h2 className="text-lg font-bold text-white truncate flex-1">
                                        {t('schedule.pending.title')}
                                    </h2>
                                    <span className="bg-slate-800 text-slate-300 text-xs px-2.5 py-1 rounded-full border border-white/10 font-mono">
                                        {globalPendentes.length}
                                    </span>
                                </div>

                                {/* Batch Assign Control */}
                                {!isDistributeMode && pendentes.length > 0 && (
                                    <div className="p-4 border-b border-white/5 space-y-2">
                                        <div className="flex gap-2 p-1 bg-slate-900/50 rounded-xl border border-white/10">
                                            <select
                                                className="flex-1 bg-transparent text-sm px-3 py-2 text-slate-300 outline-none focus:text-white cursor-pointer w-full"
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
                                                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-all shadow-lg shrink-0"
                                                title="Atribuir"
                                            >
                                                <ArrowRight className="w-4 h-4" />
                                            </button>
                                            {selectedPendentes.length > 0 && (
                                                <button
                                                    onClick={handleBatchDelete}
                                                    className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 p-2 rounded-lg transition-all shrink-0"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between px-1">
                                            <button onClick={toggleSelectAll} className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-white">Selecionar Todos</button>
                                            <span className="text-[10px] text-slate-600">{selectedPendentes.length} selecionados</span>
                                        </div>
                                    </div>
                                )}

                                <div className="p-4 border-b border-white/5 bg-slate-900/30">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Pendentes Rápidos</h3>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300">Arrastar para motorista</span>
                                    </div>
                                    <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                                        {pendentes.slice(0, 12).map(service => {
                                            const visual = getServiceVisualStyles(service);
                                            const passengerCount = Number(service.passengerCount || 1);
                                            const vehicleCapacity = Number(viaturaById.get(service.vehicleId || '')?.vehicleCapacity || 8);
                                            return (
                                                <div
                                                    key={`quick-${service.id}`}
                                                    draggable
                                                    onDragStart={handlePendingDragStart(service.id)}
                                                    className={`rounded-xl border ${visual.border} bg-[#0f172a] p-3 cursor-grab active:cursor-grabbing hover:border-blue-400/40`}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-[11px] font-mono font-bold text-blue-300">{service.hora}</span>
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${visual.badge}`}>{visual.label}</span>
                                                    </div>
                                                    <div className="mt-2 text-[11px] text-slate-300 truncate" title={service.origem}>{service.origem}</div>
                                                    <div className="flex items-center gap-1 text-[10px] text-slate-500 my-1">
                                                        <ArrowRight className="w-3 h-3" />
                                                        <span className="truncate" title={service.destino}>{service.destino}</span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 flex items-center justify-between">
                                                        <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {passengerCount} passageiros</span>
                                                        <span>{passengerCount} / {vehicleCapacity} lugares</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {pendentes.length === 0 && <div className="text-xs text-slate-500 py-2">Sem pendentes para arrastar.</div>}
                                    </div>
                                </div>

                                {/* List */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 bg-[#0b1120]">
                                    {(() => {
                                        // 1. Group ALL services by batchId
                                        const batchesMap = new Map<string, typeof globalPendentes>();
                                        const adHoc: typeof globalPendentes = [];

                                        globalPendentes.forEach(s => {
                                            if (s.batchId) {
                                                const existing = batchesMap.get(s.batchId) || [];
                                                existing.push(s);
                                                batchesMap.set(s.batchId, existing);
                                            } else {
                                                adHoc.push(s);
                                            }
                                        });

                                        // 2. Resolve Batches (Real or Pseudo)
                                        // Get all batch IDs that have services
                                        const activeBatchIds = Array.from(batchesMap.keys());

                                        // Sort batches by creation time (using ScaleBatch info if available, or fallback)
                                        // We prioritize showing the NEWEST batches first
                                        const sortedBatchIds = activeBatchIds.sort((a, b) => {
                                            const batchA = scaleBatches.find(sb => sb.id === a);
                                            const batchB = scaleBatches.find(sb => sb.id === b);
                                            const timeA = batchA ? new Date(batchA.created_at).getTime() : 0;
                                            const timeB = batchB ? new Date(batchB.created_at).getTime() : 0;
                                            return timeB - timeA;
                                        });

                                        return (
                                            <>
                                                {/* Ad-Hoc (Ideally empty now) */}
                                                {adHoc.length > 0 && (
                                                    <div className={`rounded-xl border transition-all overflow-hidden ${expandedBatchId === 'adhoc' ? 'bg-[#1e293b] border-blue-500/50' : 'bg-[#1e293b] border-white/5 hover:bg-[#1e293b]/80'}`}>
                                                        <div
                                                            onClick={() => setExpandedBatchId(expandedBatchId === 'adhoc' ? null : 'adhoc')}
                                                            className="p-4 cursor-pointer"
                                                        >
                                                            <div className="flex justify-between items-start mb-2"><div className="font-bold text-white text-sm">Escalas Manuais / Legado</div><span className="bg-slate-800 text-slate-400 text-[10px] px-1.5 py-0.5 rounded border border-white/5">{adHoc.length}</span></div>
                                                            <div className="text-xs text-slate-500">Serviços sem lote associado</div>
                                                        </div>

                                                        {/* EXPANDED CONTENT AD-HOC */}
                                                        {expandedBatchId === 'adhoc' && (
                                                            <div className="bg-slate-900/50 border-t border-white/5 p-3 space-y-2">
                                                                {adHoc.map(service => (
                                                                    <div key={service.id} className="bg-[#0f172a] p-3 rounded-lg border border-white/5 space-y-2">
                                                                        <div className="flex justify-between items-start">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-blue-400 font-mono font-bold text-xs bg-blue-400/10 px-1.5 py-0.5 rounded">{service.hora}</span>
                                                                                <span className="text-slate-300 text-xs font-medium truncate max-w-[120px]" title={service.passageiro}>{service.passageiro}</span>
                                                                                {isUrgentService(service) && (
                                                                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border border-red-500/40 bg-red-500/20 text-red-300">⚠ URGENTE</span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex gap-2">
                                                                                <button
                                                                                    onClick={() => handleSendScheduleEmail(service)}
                                                                                    disabled={sendingScheduleServiceId === service.id}
                                                                                    className="text-slate-600 hover:text-cyan-400 p-1 disabled:opacity-60"
                                                                                    title="Enviar Escala"
                                                                                >
                                                                                    <Send className="w-3 h-3" />
                                                                                </button>
                                                                                <button
                                                                                    onClick={(e) => handleDeleteService(service.id, e)}
                                                                                    className="text-slate-600 hover:text-red-400 p-1"
                                                                                    title="Eliminar"
                                                                                >
                                                                                    <Trash2 className="w-3 h-3" />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center text-[10px] text-slate-500">
                                                                            <span className="truncate" title={service.origem}>{service.origem}</span>
                                                                            <ArrowRight className="w-3 h-3 text-slate-600" />
                                                                            <span className="truncate text-right" title={service.destino}>{service.destino}</span>
                                                                        </div>
                                                                        <div className="pt-2 border-t border-white/5">
                                                                            <select
                                                                                className="w-full bg-slate-800 text-slate-300 text-[10px] px-2 py-1.5 rounded border border-white/10 outline-none focus:border-blue-500/50"
                                                                                value=""
                                                                                onChange={(e) => {
                                                                                    if (e.target.value) {
                                                                                        updateServico({ ...service, motoristaId: e.target.value });
                                                                                        if (isUrgentService(service)) {
                                                                                            notifyUrgentAssignment(service, e.target.value);
                                                                                        }
                                                                                    }
                                                                                }}
                                                                            >
                                                                                <option value="">Atribuir a...</option>
                                                                                {motoristas.filter(m => m.status === 'disponivel').map(m => (
                                                                                    <option key={m.id} value={m.id}>{m.nome}</option>
                                                                                ))}
                                                                                <option disabled>──────────</option>
                                                                                {motoristas.filter(m => m.status !== 'disponivel').map(m => (
                                                                                    <option key={m.id} value={m.id} className="text-slate-500">{m.nome} ({m.status})</option>
                                                                                ))}
                                                                            </select>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Batches (Real & Orphaned) */}
                                                {sortedBatchIds.map(batchId => {
                                                    const batchServices = batchesMap.get(batchId) || [];
                                                    const batch = scaleBatches.find(b => b.id === batchId);
                                                    const isExpanded = expandedBatchId === batchId;

                                                    // Fallback info if batch is missing (Orphaned due to RLS/Sync)
                                                    const createdBy = batch?.created_by || 'Lote Desconhecido';
                                                    const createdByRole = batch?.created_by_role || 'Erro Sync';
                                                    const createdAt = batch?.created_at ? batch.created_at.split('T')[1].substring(0, 5) : '--:--';
                                                    const centroCustoName = batch?.centro_custo_id ? centrosCustos.find(c => c.id === batch.centro_custo_id)?.nome : 'Sem Centro Custo';

                                                    return (
                                                        <div key={batchId} className={`rounded-xl border transition-all overflow-hidden ${isExpanded ? 'bg-[#1e293b] border-blue-500/50' : 'bg-[#1e293b] border-white/5 hover:bg-[#1e293b]/80'}`}>
                                                            <div
                                                                onClick={() => setExpandedBatchId(isExpanded ? null : batchId)}
                                                                className="p-4 cursor-pointer"
                                                            >
                                                                <div className="flex justify-between items-start mb-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${batch ? 'bg-gradient-to-br from-blue-500 to-cyan-500' : 'bg-slate-700'}`}>
                                                                            {createdBy.charAt(0).toUpperCase()}
                                                                        </div>
                                                                        <div>
                                                                            <div className="font-bold text-white text-sm flex items-center gap-2">
                                                                                {createdBy}
                                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-normal capitalize ${batch ? 'bg-slate-800 text-slate-400 border-white/10' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                                                                    {createdByRole}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                                {batch?.centro_custo_id && (
                                                                                    <span className="text-[10px] text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 truncate max-w-[150px]">
                                                                                        {centroCustoName}
                                                                                    </span>
                                                                                )}
                                                                                <span className="text-[10px] text-slate-500 font-mono">{createdAt}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="bg-blue-500/20 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/20">{batchServices.length}</span>
                                                                        {batch?.is_published ? (
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); setTimelineBatchId(batchId); }}
                                                                                className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25 transition-colors whitespace-nowrap"
                                                                                title="Ver linha cronológica"
                                                                            >
                                                                                Ver Linha
                                                                            </button>
                                                                        ) : batch && (
                                                                            <button
                                                                                onClick={(e) => handlePublishBatch(batchId, e)}
                                                                                disabled={publishingBatchId === batchId}
                                                                                className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-blue-600/20 text-blue-300 border-blue-500/40 hover:bg-blue-600/40 disabled:opacity-50 transition-colors whitespace-nowrap"
                                                                                title="Publicar escala e gerar linha cronológica"
                                                                            >
                                                                                {publishingBatchId === batchId ? '...' : 'Publicar'}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                                                    <Calendar className="w-3.5 h-3.5" />
                                                                    <span className="font-mono">{batch?.reference_date || selectedDate}</span>
                                                                    {batch?.is_published && (
                                                                        <span className="ml-auto text-[10px] text-emerald-400 flex items-center gap-1">
                                                                            <CheckCircle className="w-3 h-3" /> Publicada
                                                                        </span>
                                                                    )}
                                                                    {!batch && <span className="text-red-400 text-[10px] ml-auto italic">Erro de Sincronização</span>}
                                                                </div>

                                                            </div>

                                                            {/* EXPANDED CONTENT */}
                                                            {isExpanded && (
                                                                <div className="bg-slate-900/50 border-t border-white/5 p-3 space-y-2">
                                                                    {batchServices.map(service => (
                                                                        <div key={service.id} className="bg-[#0f172a] p-3 rounded-lg border border-white/5 space-y-2">
                                                                            <div className="flex justify-between items-start">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-blue-400 font-mono font-bold text-xs bg-blue-400/10 px-1.5 py-0.5 rounded">{service.hora}</span>
                                                                                    <span className="text-slate-300 text-xs font-medium truncate max-w-[120px]" title={service.passageiro}>{service.passageiro}</span>
                                                                                    {isUrgentService(service) && (
                                                                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border border-red-500/40 bg-red-500/20 text-red-300">⚠ URGENTE</span>
                                                                                    )}
                                                                                </div>
                                                                                <button
                                                                                    onClick={(e) => handleDeleteService(service.id, e)}
                                                                                    className="text-slate-600 hover:text-red-400 p-1"
                                                                                    title="Eliminar"
                                                                                >
                                                                                    <Trash2 className="w-3 h-3" />
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleSendScheduleEmail(service)}
                                                                                    disabled={sendingScheduleServiceId === service.id}
                                                                                    className="text-slate-600 hover:text-cyan-400 p-1 disabled:opacity-60"
                                                                                    title="Enviar Escala"
                                                                                >
                                                                                    <Send className="w-3 h-3" />
                                                                                </button>
                                                                            </div>

                                                                            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center text-[10px] text-slate-500">
                                                                                <span className="truncate" title={service.origem}>{service.origem}</span>
                                                                                <ArrowRight className="w-3 h-3 text-slate-600" />
                                                                                <span className="truncate text-right" title={service.destino}>{service.destino}</span>
                                                                            </div>

                                                                            <div className="pt-2 border-t border-white/5">
                                                                                <select
                                                                                    className="w-full bg-slate-800 text-slate-300 text-[10px] px-2 py-1.5 rounded border border-white/10 outline-none focus:border-blue-500/50"
                                                                                    value=""
                                                                                    onChange={(e) => {
                                                                                        if (e.target.value) {
                                                                                            updateServico({ ...service, motoristaId: e.target.value });
                                                                                            if (isUrgentService(service)) {
                                                                                                notifyUrgentAssignment(service, e.target.value);
                                                                                            }
                                                                                        }
                                                                                    }}
                                                                                >
                                                                                    <option value="">Atribuir a...</option>
                                                                                    {motoristas.filter(m => m.status === 'disponivel').map(m => (
                                                                                        <option key={m.id} value={m.id}>{m.nome}</option>
                                                                                    ))}
                                                                                    <option disabled>──────────</option>
                                                                                    {motoristas.filter(m => m.status !== 'disponivel').map(m => (
                                                                                        <option key={m.id} value={m.id} className="text-slate-500">{m.nome} ({m.status})</option>
                                                                                    ))}
                                                                                </select>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                {pendingBatches.length === 0 && adHocPendentes.length === 0 && (
                                                    <div className="h-40 flex flex-col items-center justify-center text-slate-600 text-center"><CheckSquare className="w-8 h-8 mb-3 opacity-20" /><p className="text-sm">Tudo limpo!</p></div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>



                            </div>
                        </div>
                    )
                }
            </div >




            {/* MODAL: AUTO SETTINGS */}
            {showAutoSettings && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-[#1e293b] border border-white/10 p-6 rounded-2xl w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <MoreVertical className="w-5 h-5 text-blue-400" />
                            Configuração de Automação
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Google Sheet Albufeira (CSV/Export URL)</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm"
                                    placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv"
                                    value={autoSettings.albufeiraUrl}
                                    onChange={e => setAutoSettings({ ...autoSettings, albufeiraUrl: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Google Sheet Quarteira (CSV/Export URL)</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm"
                                    placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv"
                                    value={autoSettings.quarteiraUrl}
                                    onChange={e => setAutoSettings({ ...autoSettings, quarteiraUrl: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setShowAutoSettings(false)}
                                className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700 transition-colors"
                            >
                                Fechar
                            </button>
                            <button
                                onClick={() => {
                                    localStorage.setItem('auto_sheet_albufeira', autoSettings.albufeiraUrl);
                                    localStorage.setItem('auto_sheet_quarteira', autoSettings.quarteiraUrl);
                                    setShowAutoSettings(false);
                                }}
                                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: AUTOMATION PREVIEW */}
            {showAutoModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-[#1e293b] border border-emerald-500/20 p-6 rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                                    <CloudLightning className="w-8 h-8 text-emerald-500" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white">{automationMode === 'auto-dispatch' ? 'Pré-visualização do Auto Dispatch' : 'Pré-visualização da Escala'}</h2>
                                    <p className="text-slate-400 text-sm">Verifique, edite e remova propostas antes de confirmar.</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={applyAutoGroupingByZone}
                                    className="bg-blue-600/20 text-blue-400 border border-blue-500/30 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-600/30 transition-all"
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                    AUTO AGRUPAR POR ZONA
                                </button>
                                <button
                                    onClick={() => setShowAutoModal(false)}
                                    className="text-slate-400 hover:text-white p-2"
                                >
                                    <Trash2 className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                            {automationTrips.map((trip, idx) => {
                                const computedPassengers = Number(trip.passengerCount || trip.servicos.length || 1);
                                const computedCapacity = Number(trip.vehicleCapacity || viaturaById.get(trip.vehicleId || '')?.vehicleCapacity || 8);
                                const computedOccupancy = Number((((computedPassengers / Math.max(computedCapacity, 1)) * 100)).toFixed(2));

                                return (
                                    <div key={trip.id} className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center group">
                                        <div className="flex items-center gap-3 min-w-[100px]">
                                            <span className="bg-emerald-500/20 text-emerald-400 font-mono font-bold px-2 py-1 rounded border border-emerald-500/20">{trip.hora}</span>
                                        </div>

                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-xs text-slate-500 uppercase font-bold tracking-wider">
                                                    <MapPin className="w-3 h-3" /> Origem
                                                    {trip.areaOrigem && <span className="bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded ml-1">{trip.areaOrigem}</span>}
                                                </div>
                                                <div className="text-white font-medium">{trip.origem}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-xs text-slate-500 uppercase font-bold tracking-wider">
                                                    <ArrowRight className="w-3 h-3" /> Destino
                                                    {trip.areaDestino && <span className="bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded ml-1">{trip.areaDestino}</span>}
                                                </div>
                                                <div className="text-white font-medium">{trip.destino}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="bg-[#0f172a] rounded-lg px-3 py-1.5 border border-white/5 text-center min-w-[40px]">
                                                <div className="text-[10px] text-slate-500 font-bold leading-none mb-1">Pass.</div>
                                                <div className="text-white font-bold leading-none">{computedPassengers}</div>
                                            </div>

                                            <div className="bg-[#0f172a] rounded-lg px-3 py-1.5 border border-white/5 text-center min-w-[72px]">
                                                <div className="text-[10px] text-slate-500 font-bold leading-none mb-1">Ocupação</div>
                                                <div className="text-emerald-300 font-bold leading-none">{computedOccupancy.toFixed(0)}%</div>
                                            </div>

                                            <select
                                                className="bg-[#0f172a] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-emerald-500/50 outline-none w-48"
                                                value={trip.vehicleId || ''}
                                                onChange={(e) => {
                                                    const vehicleId = e.target.value;
                                                    const vehicle = viaturaById.get(vehicleId);
                                                    const capacity = Number(vehicle?.vehicleCapacity || 8);
                                                    const passengerCount = Number(computedPassengers);
                                                    const occupancyRate = Number(((passengerCount / Math.max(capacity, 1)) * 100).toFixed(2));
                                                    const newTrips = [...automationTrips];
                                                    newTrips[idx].vehicleId = vehicleId || undefined;
                                                    newTrips[idx].vehicleCapacity = capacity;
                                                    newTrips[idx].occupancyRate = occupancyRate;
                                                    setAutomationTrips(newTrips);
                                                }}
                                            >
                                                <option value="">🚗 Sem viatura</option>
                                                {viaturas.map(v => (
                                                    <option key={v.id} value={v.id}>{v.matricula} ({v.vehicleCapacity || 8} lugares)</option>
                                                ))}
                                            </select>

                                            <select
                                                className="bg-[#0f172a] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-emerald-500/50 outline-none w-48"
                                                value={trip.motoristaId || ''}
                                                onChange={(e) => {
                                                    const newTrips = [...automationTrips];
                                                    newTrips[idx].motoristaId = e.target.value;
                                                    setAutomationTrips(newTrips);
                                                }}
                                            >
                                                <option value="">🚫 Sem motorista</option>
                                                {motoristas.map(m => (
                                                    <option key={m.id} value={m.id}>{m.nome}</option>
                                                ))}
                                            </select>

                                            <button
                                                onClick={() => setAutomationTrips(prev => prev.filter((_, tripIndex) => tripIndex !== idx))}
                                                className="bg-red-500/15 text-red-400 border border-red-500/30 px-3 py-2 rounded-xl text-xs font-bold hover:bg-red-500/25"
                                            >
                                                Remover
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-6 pt-6 border-t border-white/10 flex justify-between items-center">
                            <div className="text-slate-400 text-sm">
                                <span className="text-white font-bold">{automationTrips.length}</span> serviços propostos. PRONTO PARA CONFIRMAR.
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setShowAutoModal(false)}
                                    className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmAutomation}
                                    className="px-10 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/20 transform hover:scale-[1.02] active:scale-95 flex items-center gap-2"
                                >
                                    <CloudLightning className="w-5 h-5" />
                                    Confirmar Escala
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: URGENT REQUEST */}
            {
                showUrgentModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4 overflow-y-auto">
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
            {/* Template Selection Modal */}
            {showTemplateModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <div className="bg-[#1e293b] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
                        <div className="p-6 bg-slate-900/50 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <h2 className="text-xl font-bold text-white">Lançar Escala Permanente (Modelo)</h2>
                            </div>
                            <button
                                onClick={() => setShowTemplateModal(false)}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <Plus className="w-6 h-6 rotate-45" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {escalaTemplates.map(template => (
                                    <button
                                        key={template.id}
                                        onClick={() => setSelectedTemplateId(template.id)}
                                        className={`group p-5 rounded-2xl border transition-all text-left relative overflow-hidden ${selectedTemplateId === template.id
                                            ? 'bg-indigo-500/10 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xl shadow-indigo-900/20'
                                            : 'bg-slate-800/40 border-white/5 hover:border-white/10 hover:bg-slate-800/60'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className={`p-2 rounded-lg ${selectedTemplateId === template.id ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400 group-hover:bg-slate-600 transition-colors'}`}>
                                                <FileText className="w-4 h-4" />
                                            </div>
                                            {selectedTemplateId === template.id && (
                                                <div className="bg-indigo-500 text-[10px] font-black text-white px-2 py-0.5 rounded-full uppercase tracking-tighter animate-pulse">
                                                    Selecionado
                                                </div>
                                            )}
                                        </div>
                                        <div className="font-black text-lg text-white mb-1 group-hover:translate-x-1 transition-transform">{template.nome}</div>
                                        <div className="flex items-center gap-2 text-xs text-slate-400">
                                            <Users className="w-3 h-3" />
                                            {escalaTemplateItems.filter(i => i.template_id === template.id).length} Serviços Registrados
                                        </div>

                                        {/* Decorative background element */}
                                        <div className={`absolute -right-4 -bottom-4 w-24 h-24 blur-3xl rounded-full transition-opacity duration-500 ${selectedTemplateId === template.id ? 'bg-indigo-500/20 opacity-100' : 'bg-transparent opacity-0'}`} />
                                    </button>
                                ))}

                                <button
                                    onClick={() => {
                                        setShowTemplateModal(false);
                                        setShowManageTemplates(true);
                                    }}
                                    className="p-5 rounded-2xl border border-dashed border-white/10 bg-slate-800/20 hover:bg-slate-800/40 transition-all text-center flex flex-col items-center justify-center gap-3 group min-h-[140px]"
                                >
                                    <div className="p-3 bg-slate-700/50 rounded-xl group-hover:scale-110 group-hover:bg-slate-700 transition-all">
                                        <Settings className="w-6 h-6 text-slate-400 group-hover:text-white" />
                                    </div>
                                    <span className="text-sm font-black text-slate-400 group-hover:text-white uppercase tracking-widest">Painel de Gestão</span>
                                </button>
                            </div>

                            {selectedTemplateId && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Pré-visualização de Itens</h3>
                                    </div>
                                    <div className="bg-slate-950/50 rounded-xl border border-white/5 overflow-hidden">
                                        <table className="w-full text-left text-xs">
                                            <thead>
                                                <tr className="border-b border-white/5 bg-white/5">
                                                    <th className="px-4 py-3 font-bold text-slate-300">Entrada</th>
                                                    <th className="px-4 py-3 font-bold text-slate-300">Saída</th>
                                                    <th className="px-4 py-3 font-bold text-slate-300">Passageiro</th>
                                                    <th className="px-4 py-3 font-bold text-slate-300">Local</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {escalaTemplateItems.filter(i => i.template_id === selectedTemplateId).map(item => (
                                                    <tr key={item.id} className="hover:bg-white/5">
                                                        <td className="px-4 py-3 text-emerald-400 font-medium">{item.hora_entrada || '-'}</td>
                                                        <td className="px-4 py-3 text-amber-400 font-medium">{item.hora_saida || '-'}</td>
                                                        <td className="px-4 py-3 text-white">{item.passageiro}</td>
                                                        <td className="px-4 py-3 text-slate-300">{item.local}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-slate-900/50 border-t border-white/5 flex gap-4">
                            <button
                                onClick={() => setShowTemplateModal(false)}
                                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                disabled={!selectedTemplateId}
                                onClick={() => selectedTemplateId && handleLaunchTemplate(selectedTemplateId)}
                                className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold shadow-lg shadow-indigo-900/40 flex items-center justify-center gap-2 transform active:scale-95 transition-all"
                            >
                                <Send className="w-5 h-5" />
                                Lançar para {selectedDate}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Template Management Modal */}
            {showManageTemplates && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[80] flex items-center justify-center p-4">
                    <div className="bg-[#1e293b] border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col overflow-hidden h-[85vh]">
                        <div className="p-6 bg-slate-900/50 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500">
                                    <Settings className="w-5 h-5" />
                                </div>
                                <h2 className="text-xl font-bold text-white">Gestão de Modelos de Escala</h2>
                            </div>
                            <button
                                onClick={() => {
                                    setShowManageTemplates(false);
                                    setShowTemplateModal(true);
                                }}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <Plus className="w-6 h-6 rotate-45" />
                            </button>
                        </div>

                        <div className="flex-1 flex overflow-hidden">
                            {/* Templates Lateral List */}
                            <div className="w-64 border-r border-white/5 bg-slate-900/30 p-4 space-y-4 overflow-y-auto">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Modelos</span>
                                    <button
                                        onClick={() => setIsCreatingTemplate(true)}
                                        className="p-1 text-indigo-400 hover:text-white"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>

                                {isCreatingTemplate && (
                                    <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/50 space-y-2">
                                        <input
                                            autoFocus
                                            className="w-full bg-slate-950 border border-indigo-500/30 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                            placeholder="Nome do Modelo..."
                                            value={newTemplateName}
                                            onChange={e => setNewTemplateName(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    addEscalaTemplate({ nome: newTemplateName }, []);
                                                    setIsCreatingTemplate(false);
                                                    setNewTemplateName('');
                                                }
                                            }}
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setIsCreatingTemplate(false)}
                                                className="flex-1 text-[10px] text-slate-400 hover:text-white font-bold"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={() => {
                                                    addEscalaTemplate({ nome: newTemplateName }, []);
                                                    setIsCreatingTemplate(false);
                                                    setNewTemplateName('');
                                                }}
                                                className="flex-1 text-[10px] text-indigo-400 hover:text-white font-bold"
                                            >
                                                Criar
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {escalaTemplates.map(template => (
                                    <div key={template.id} className="relative group">
                                        <button
                                            onClick={() => setSelectedTemplateId(template.id)}
                                            className={`w-full p-3 rounded-xl text-left text-sm transition-all flex items-center justify-between ${selectedTemplateId === template.id
                                                ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-900/40'
                                                : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                                }`}
                                        >
                                            <span className="truncate">{template.nome}</span>
                                            <FileText className="w-4 h-4 opacity-50" />
                                        </button>
                                        {selectedTemplateId === template.id && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm('Eliminar este modelo?')) deleteEscalaTemplate(template.id);
                                                }}
                                                className="absolute -right-2 -top-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Template Items Content */}
                            <div className="flex-1 p-6 overflow-y-auto">
                                {selectedTemplateId ? (
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-xl font-bold text-white mb-1">
                                                    {escalaTemplates.find(t => t.id === selectedTemplateId)?.nome}
                                                </h3>
                                                <p className="text-xs text-slate-400">Gerir funcionários e locais deste modelo permanente</p>
                                            </div>
                                            <div className="flex gap-2">
                                                {/* Add Item form toggle or similar could go here */}
                                            </div>
                                        </div>

                                        {/* New Item Form */}
                                        <div className="bg-slate-800/20 rounded-2xl border border-white/5 p-4 space-y-4">
                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Funcionário</label>
                                                    <input
                                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                                                        placeholder="Ex: João Silva"
                                                        value={templateItemForm.passageiro}
                                                        onChange={e => setTemplateItemForm({ ...templateItemForm, passageiro: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Local/Hotel</label>
                                                    <input
                                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                                                        placeholder="Ex: Hilton Vilamoura"
                                                        value={templateItemForm.local}
                                                        onChange={e => setTemplateItemForm({ ...templateItemForm, local: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Hora Entrada</label>
                                                    <input
                                                        type="time"
                                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                                                        value={templateItemForm.hora_entrada}
                                                        onChange={e => setTemplateItemForm({ ...templateItemForm, hora_entrada: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Hora Saída</label>
                                                    <input
                                                        type="time"
                                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                                                        value={templateItemForm.hora_saida}
                                                        onChange={e => setTemplateItemForm({ ...templateItemForm, hora_saida: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex justify-end">
                                                <button
                                                    onClick={() => {
                                                        if (!templateItemForm.local) return alert('Local é obrigatório');
                                                        addTemplateItem({
                                                            template_id: selectedTemplateId!,
                                                            ...templateItemForm
                                                        });
                                                        setTemplateItemForm({
                                                            hora_entrada: '09:00',
                                                            hora_saida: '18:00',
                                                            passageiro: '',
                                                            local: '',
                                                            obs: ''
                                                        });
                                                    }}
                                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    Adicionar ao Modelo
                                                </button>
                                            </div>
                                        </div>

                                        {/* Items List */}
                                        <div className="space-y-3">
                                            {escalaTemplateItems.filter(ti => ti.template_id === selectedTemplateId).length === 0 ? (
                                                <div className="text-center py-20 bg-slate-900/40 rounded-3xl border border-dashed border-white/5 flex flex-col items-center justify-center">
                                                    <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mb-4">
                                                        <FileText className="w-8 h-8 text-indigo-500/30" />
                                                    </div>
                                                    <h4 className="text-white font-bold mb-1">Modelo Vazio</h4>
                                                    <p className="text-slate-500 text-xs max-w-[200px]">Adicione funcionários e locais acima para começar a construir este modelo.</p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 gap-2">
                                                    <div className="grid grid-cols-12 px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">
                                                        <div className="col-span-3">Horários</div>
                                                        <div className="col-span-4">Funcionário / Passageiro</div>
                                                        <div className="col-span-4">Destino / Local</div>
                                                        <div className="col-span-1 text-right">Ações</div>
                                                    </div>
                                                    {escalaTemplateItems.filter(ti => ti.template_id === selectedTemplateId).map(item => (
                                                        <div key={item.id} className="grid grid-cols-12 items-center bg-slate-800/30 border border-white/5 hover:border-indigo-500/40 hover:bg-slate-800/50 rounded-2xl px-6 py-4 group transition-all">
                                                            <div className="col-span-3 flex items-center gap-3">
                                                                <div className="flex flex-col">
                                                                    <div className="flex items-center gap-1.5 mb-1">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                                                                        <span className="text-sm font-black text-white">{item.hora_entrada || '--:--'}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
                                                                        <span className="text-sm font-black text-white">{item.hora_saida || '--:--'}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="col-span-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                                                        {item.passageiro?.charAt(0) || 'S'}
                                                                    </div>
                                                                    <span className="text-sm font-bold text-white group-hover:text-indigo-200 transition-colors truncate">
                                                                        {item.passageiro || 'Staff Geral'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="col-span-4 flex items-center gap-2">
                                                                <div className="p-1.5 bg-slate-800 rounded-lg border border-white/5">
                                                                    <MapPin className="w-3 h-3 text-indigo-400" />
                                                                </div>
                                                                <span className="text-sm text-slate-300 font-medium truncate">{item.local}</span>
                                                            </div>
                                                            <div className="col-span-1 text-right">
                                                                <button
                                                                    onClick={() => deleteTemplateItem(item.id)}
                                                                    className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                                        <div className="p-4 bg-indigo-500/5 rounded-full mb-4">
                                            <FileText className="w-12 h-12 text-indigo-500/30" />
                                        </div>
                                        <h3 className="text-lg font-bold text-white mb-2">Selecione um Modelo</h3>
                                        <p className="text-sm text-slate-400 max-w-xs">
                                            Escolha um modelo à esquerda ou crie um novo para gerir as escalas recorrentes.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Datalist for geofences suggestions */}
            <datalist id="geofences-list">
                {geofences.map(geo => (
                    <option key={geo.id} value={geo.name} />
                ))}
            </datalist>

            {/* Timeline Modal */}
            {timelineBatchId && (() => {
                const timelineBatch = scaleBatches.find(b => b.id === timelineBatchId);
                const timelineServices = servicos.filter(s => s.batchId === timelineBatchId);
                if (!timelineBatch) return null;
                return (
                    <EscalaTimelineModal
                        batch={timelineBatch}
                        services={timelineServices}
                        motoristas={motoristas}
                        viaturas={viaturas}
                        centrosCustos={centrosCustos}
                        onClose={() => setTimelineBatchId(null)}
                    />
                );
            })()}
        </div>


    )
}

