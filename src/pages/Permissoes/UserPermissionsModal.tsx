import { useState, useEffect } from 'react';
import { X, Shield, Check, Lock, Unlock } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { usePermissions } from '../../contexts/PermissionsContext';
import type { PermissionModule } from '../../contexts/PermissionsContext';
import type { Motorista, Supervisor, OficinaUser } from '../../types';

interface UserPermissionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: Motorista | Supervisor | OficinaUser;
    role: 'motorista' | 'supervisor' | 'oficina';
    onSave: (updatedUser: any) => void;
}

// Duplicated from index.tsx to keep self-contained for now
interface PermissionGroup {
    id: string;
    labelKey: string;
    permissions: {
        id: PermissionModule;
        labelKey: string;
    }[];
}

const PERMISSION_GROUPS: PermissionGroup[] = [
    {
        id: 'fleet',
        labelKey: 'menu.fleet_management',
        permissions: [
            { id: 'central_motorista', labelKey: 'menu.driver_central' },
            { id: 'viaturas', labelKey: 'menu.vehicles' },
            { id: 'geofences', labelKey: 'menu.geofences' },
            { id: 'locais', labelKey: 'menu.places' },
            { id: 'avaliacao', labelKey: 'menu.evaluation' },
            // Add granular permissions from old list if they fit here
            // Old list had 'viaturas', 'motoristas', 'fornecedores' as single items in separate groups.
            // Check 'motoristas' is in 'Equipa' now.
        ]
    },
    {
        id: 'operations',
        labelKey: 'menu.operations',
        permissions: [
            { id: 'escalas', labelKey: 'menu.schedule' },
            { id: 'escalas_import', labelKey: 'schedule.action.import' },
            { id: 'escalas_print', labelKey: 'schedule.action.pdf' },
            { id: 'escalas_create', labelKey: 'schedule.action.manual' },
            { id: 'escalas_urgent', labelKey: 'schedule.action.urgent' },
            { id: 'escalas_view_pending', labelKey: 'schedule.action.pending' },
            { id: 'horas', labelKey: 'menu.hours' },
            { id: 'hours_view_costs', labelKey: 'hours.view_costs' },
            { id: 'plataformas_externas', labelKey: 'menu.transport_eva' }
        ]
    },
    {
        id: 'workshop',
        labelKey: 'menu.workshop',
        permissions: [
            { id: 'combustivel', labelKey: 'menu.fuel' },
            { id: 'combustivel_calibrate', labelKey: 'fuel.entry.calibrate' },
            { id: 'combustivel_edit_history', labelKey: 'fuel.action.history' },
            { id: 'requisicoes', labelKey: 'menu.requisitions' },
            { id: 'requisicoes_edit', labelKey: 'permission.edit' },
            { id: 'requisicoes_delete', labelKey: 'permission.delete' }
        ]
    },
    {
        id: 'team',
        labelKey: 'menu.team',
        permissions: [
            { id: 'equipa-oficina', labelKey: 'menu.workshop_team' },
            { id: 'supervisores', labelKey: 'menu.supervisors' },
            { id: 'motoristas', labelKey: 'menu.drivers' }
        ]
    },
    {
        id: 'financial',
        labelKey: 'menu.financial',
        permissions: [
            { id: 'contabilidade', labelKey: 'menu.accounting' },
            { id: 'centros_custos', labelKey: 'menu.cost_centers' },
            { id: 'fornecedores', labelKey: 'menu.suppliers' },
            { id: 'clientes', labelKey: 'menu.clients' },
            { id: 'relatorios', labelKey: 'menu.reports' }
        ]
    },
    {
        id: 'communication',
        labelKey: 'menu.communication',
        permissions: [
            { id: 'mensagens', labelKey: 'menu.messages' }
        ]
    }
];

export default function UserPermissionsModal({ isOpen, onClose, user, role, onSave }: UserPermissionsModalProps) {
    const { t } = useTranslation();
    const { permissions } = usePermissions(); // Get role defaults
    const [blocked, setBlocked] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen && user) {
            setBlocked(user.blockedPermissions || []);
        }
    }, [isOpen, user]);

    if (!isOpen) return null;

    const rolePermissions = permissions[role] || [];

    const handleToggle = (permId: string) => {
        setBlocked(prev => {
            if (prev.includes(permId)) {
                return prev.filter(p => p !== permId); // Unblock
            } else {
                return [...prev, permId]; // Block
            }
        });
    };

    const handleSave = () => {
        onSave({ ...user, blockedPermissions: blocked });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-[#1e293b] w-full max-w-2xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Shield className="w-5 h-5 text-blue-400" />
                            Gestão de Acesso Individual
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">
                            Utilizador: <span className="text-white font-medium">{user.nome}</span> ({t(`permissions.role.${role === 'oficina' ? 'workshop' : role === 'motorista' ? 'driver' : 'supervisor'}`)})
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="space-y-6">
                        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-sm text-blue-200">
                            <p>Defina exceções para este utilizador. Desative switches para <strong>bloquear</strong> o acesso a funcionalidades específicas que o papel normalmente permite.</p>
                        </div>

                        {PERMISSION_GROUPS.map(group => {
                            // Filter permissions available to this role
                            const availablePerms = group.permissions.filter(p => rolePermissions.includes(p.id));

                            if (availablePerms.length === 0) return null;

                            return (
                                <div key={group.id} className="bg-slate-800/20 rounded-xl border border-slate-700/50 overflow-hidden">
                                    <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-700/50">
                                        <h3 className="font-bold text-slate-300 text-sm uppercase tracking-wider">{t(group.labelKey)}</h3>
                                    </div>
                                    <div className="divide-y divide-slate-700/50">
                                        {availablePerms.map(perm => {
                                            const isBlocked = blocked.includes(perm.id);
                                            const isAllowed = !isBlocked;

                                            return (
                                                <div key={perm.id} className="flex items-center justify-between p-4 hover:bg-slate-700/20 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-lg ${isAllowed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                                            {isAllowed ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-slate-200">
                                                                {perm.id === 'hours_view_costs' ? 'Ver Custos/Valores' : t(perm.labelKey)}
                                                            </p>
                                                            <p className="text-xs text-slate-500">
                                                                {isAllowed ? 'Acesso Permitido' : 'Acesso Bloqueado'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Toggle Switch */}
                                                    <button
                                                        onClick={() => handleToggle(perm.id)}
                                                        className={`w-12 h-6 rounded-full transition-colors relative focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#1e293b] focus:ring-blue-500 ${isAllowed ? 'bg-emerald-500' : 'bg-slate-600'}`}
                                                    >
                                                        <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${isAllowed ? 'translate-x-6' : 'translate-x-0'}`} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Empty State if no permissions available */}
                        {rolePermissions.length === 0 && (
                            <div className="text-center py-12 text-slate-500">
                                <Shield className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p>Este papel não tem permissões atribuídas para bloquear.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-700 bg-slate-800/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
                    >
                        <Check className="w-4 h-4" />
                        Guardar Alterações
                    </button>
                </div>
            </div>
        </div>
    );
}
