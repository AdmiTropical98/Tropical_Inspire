import {
    Shield, User, Wrench, Globe, LayoutDashboard, MessageSquare, MapPin,
    FileText, Truck, Users, Truck as TruckIcon, UserCog, Building2,
    Briefcase, BarChart3, Wallet, Clock, Fuel, Calendar, Lock
} from 'lucide-react';
import { usePermissions } from '../../contexts/PermissionsContext';
import type { PermissionModule } from '../../contexts/PermissionsContext';
import { useTranslation } from '../../hooks/useTranslation';

interface PermissionGroup {
    id: string;
    labelKey: string;
    icon: React.ElementType;
    descriptionKey?: string;
    permissions: {
        id: PermissionModule;
        labelKey: string;
        descriptionKey?: string; 
    }[];
}

const PERMISSION_GROUPS: PermissionGroup[] = [
    {
        id: 'geral',
        labelKey: 'menu.general',
        icon: Globe,
        permissions: [
            { id: 'dashboard', labelKey: 'menu.dashboard' },
            { id: 'mensagens', labelKey: 'menu.messages' },
            { id: 'geofences', labelKey: 'menu.geofences' }
        ]
    },
    {
        id: 'requisicoes',
        labelKey: 'menu.requisitions',
        icon: FileText,
        descriptionKey: 'permission.description.requisicoes',
        permissions: [
            { id: 'requisicoes', labelKey: 'menu.requisitions' },
            { id: 'requisicoes_edit', labelKey: 'permission.edit' },
            { id: 'requisicoes_delete', labelKey: 'permission.delete' },
        ]
    },
    {
        id: 'viaturas',
        labelKey: 'menu.vehicles',
        icon: Truck,
        descriptionKey: 'permission.description.viaturas',
        permissions: [{ id: 'viaturas', labelKey: 'menu.vehicles' }]
    },
    {
        id: 'motoristas',
        labelKey: 'menu.drivers',
        icon: UserCog,
        descriptionKey: 'permission.description.motoristas',
        permissions: [{ id: 'motoristas', labelKey: 'menu.drivers' }]
    },
    {
        id: 'fornecedores',
        labelKey: 'menu.suppliers',
        icon: Building2,
        descriptionKey: 'permission.description.fornecedores',
        permissions: [{ id: 'fornecedores', labelKey: 'menu.suppliers' }]
    },
    {
        id: 'clientes',
        labelKey: 'menu.clients',
        icon: Briefcase,
        permissions: [{ id: 'clientes', labelKey: 'menu.clients' }]
    },
    {
        id: 'equipa-oficina',
        labelKey: 'menu.workshop_team',
        icon: Wrench,
        permissions: [{ id: 'equipa-oficina', labelKey: 'menu.workshop_team' }]
    },
    {
        id: 'supervisores',
        labelKey: 'menu.supervisors',
        icon: Shield,
        permissions: [{ id: 'supervisores', labelKey: 'menu.supervisors' }]
    },
    {
        id: 'escalas',
        labelKey: 'menu.schedule',
        icon: Calendar,
        descriptionKey: 'permission.description.escalas',
        permissions: [
            { id: 'escalas', labelKey: 'menu.schedule' },
            { id: 'escalas_import', labelKey: 'schedule.action.import' },
            { id: 'escalas_print', labelKey: 'schedule.action.pdf' },
            { id: 'escalas_create', labelKey: 'schedule.action.manual' },
            { id: 'escalas_urgent', labelKey: 'schedule.action.urgent' },
            { id: 'escalas_view_pending', labelKey: 'schedule.action.pending' },
        ]
    },
    {
        id: 'horas',
        labelKey: 'menu.hours',
        icon: Clock,
        permissions: [
            { id: 'horas', labelKey: 'menu.hours' },
            { id: 'hours_view_costs', labelKey: 'hours.view_costs' }
        ]
    },
    {
        id: 'combustivel',
        labelKey: 'menu.fuel',
        icon: Fuel,
        descriptionKey: 'permission.description.combustivel',
        permissions: [
            { id: 'combustivel', labelKey: 'menu.fuel' },
            { id: 'combustivel_calibrate', labelKey: 'fuel.entry.calibrate' },
            { id: 'combustivel_edit_history', labelKey: 'fuel.action.history' }
        ]
    },
    {
        id: 'admin_financas',
        labelKey: 'menu.admin',
        icon: Wallet,
        permissions: [
            { id: 'contabilidade', labelKey: 'menu.accounting' },
            { id: 'centros_custos', labelKey: 'menu.cost_centers' },
            { id: 'relatorios', labelKey: 'menu.reports' }
        ]
    },
    {
        id: 'extras',
        labelKey: 'menu.extras',
        icon: Lock,
        permissions: [
            { id: 'central_motorista', labelKey: 'menu.driver_central' },
            { id: 'plataformas_externas', labelKey: 'menu.external_platforms' }
        ]
    }
];

export default function Permissoes() {
    const { permissions, updatePermission } = usePermissions();
    const { t } = useTranslation();

    const togglePermission = (role: 'supervisor' | 'motorista' | 'oficina', module: PermissionModule) => {
        // Safe access with type assertion since we know the keys
        const rolePermissions = permissions[role] as PermissionModule[];
        const hasAccess = rolePermissions.includes(module);
        updatePermission(role, module, !hasAccess);
    };


    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-6 pb-24 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <Shield className="w-8 h-8 text-blue-500" />
                        {t('permissions.title')}
                    </h1>
                    <p className="text-slate-400 max-w-2xl">
                        Gerencie os níveis de acesso de cada função no sistema.
                        As alterações são aplicadas imediatamente, mas os utilizadores podem precisar de recarregar a página.
                    </p>
                </div>
            </div>

            {/* Matrix View */}
            <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-900/80 border-b border-slate-700">
                                <th className="px-6 py-5 text-slate-300 font-bold w-1/3">Módulo de Acesso</th>
                                <th className="px-6 py-5">
                                    <div className="flex flex-col items-center">
                                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 mb-2">
                                            <Shield className="w-5 h-5 text-purple-400" />
                                        </div>
                                        <span className="text-purple-400 font-bold text-sm">Supervisor</span>
                                    </div>
                                </th>
                                <th className="px-6 py-5">
                                    <div className="flex flex-col items-center">
                                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 mb-2">
                                            <Wrench className="w-5 h-5 text-orange-400" />
                                        </div>
                                        <span className="text-orange-400 font-bold text-sm">Oficina</span>
                                    </div>
                                </th>
                                <th className="px-6 py-5">
                                    <div className="flex flex-col items-center">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 mb-2">
                                            <User className="w-5 h-5 text-emerald-400" />
                                        </div>
                                        <span className="text-emerald-400 font-bold text-sm">Motorista</span>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/30">
                            {PERMISSION_GROUPS.map((group) => {
                                const GroupIcon = group.icon;
                                return (
                                    <>
                                        {/* Group Header */}
                                        <tr key={`header-${group.id}`} className="bg-slate-800/30">
                                            <td colSpan={4} className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                                        <GroupIcon className="w-4 h-4 text-blue-400" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                                                            {t(group.labelKey)}
                                                        </div>
                                                        {group.descriptionKey && (
                                                            <div className="text-xs text-slate-500 mt-0.5">
                                                                {t(group.descriptionKey)}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Sub Permissions */}
                                        {group.permissions.map((perm) => (
                                            <tr key={perm.id} className="hover:bg-slate-800/30 transition-colors group">
                                                <td className="px-6 py-4 pl-16">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm text-slate-300 font-medium group-hover:text-white transition-colors">
                                                            {t(perm.labelKey)}
                                                        </span>
                                                        {perm.descriptionKey && (
                                                            <span className="text-xs text-slate-500 italic mt-0.5">
                                                                {t(perm.descriptionKey)}
                                                            </span>
                                                        )}
                                                        {/* Debug ID optional, helpful for Admin but maybe confusing for user. Keeping small. */}
                                                        {/* <span className="text-[10px] text-slate-600 font-mono mt-0.5 opacity-0 group-hover:opacity-50 transition-opacity">{perm.id}</span> */}
                                                    </div>
                                                </td>

                                                {/* Role Toggles */}
                                                {(['supervisor', 'oficina', 'motorista'] as const).map((role) => {
                                                    const isActive = permissions[role].includes(perm.id);
                                                    const colorClass = role === 'supervisor' ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                                                        : role === 'oficina' ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.4)]'
                                                            : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]';

                                                    const ringClass = role === 'supervisor' ? 'focus:ring-purple-500'
                                                        : role === 'oficina' ? 'focus:ring-orange-500'
                                                            : 'focus:ring-emerald-500';

                                                    return (
                                                        <td key={`${role}-${perm.id}`} className="px-6 py-4 text-center">
                                                            <button
                                                                onClick={() => togglePermission(role, perm.id)}
                                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 ${isActive ? colorClass : 'bg-slate-700'
                                                                    } ${ringClass}`}
                                                            >
                                                                <span
                                                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${isActive ? 'translate-x-6' : 'translate-x-1'
                                                                    }`}
                                                                />
                                                            </button>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
