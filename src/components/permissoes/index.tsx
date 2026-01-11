import { Shield, User, Wrench } from 'lucide-react';
import { usePermissions } from '../../contexts/PermissionsContext';
import type { PermissionModule } from '../../contexts/PermissionsContext';
import { useTranslation } from '../../hooks/useTranslation';

// ... imports

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
        id: 'geral',
        labelKey: 'menu.general',
        permissions: [
            { id: 'dashboard', labelKey: 'menu.dashboard' },
            { id: 'mensagens', labelKey: 'menu.messages' },
            { id: 'geofences', labelKey: 'menu.geofences' }
        ]
    },
    {
        id: 'requisicoes',
        labelKey: 'menu.requisitions',
        permissions: [
            { id: 'requisicoes', labelKey: 'menu.requisitions' },
            { id: 'requisicoes_edit', labelKey: 'permission.edit' },
            { id: 'requisicoes_delete', labelKey: 'permission.delete' },
        ]
    },
    {
        id: 'viaturas',
        labelKey: 'menu.vehicles',
        permissions: [{ id: 'viaturas', labelKey: 'menu.vehicles' }]
    },
    {
        id: 'motoristas',
        labelKey: 'menu.drivers',
        permissions: [{ id: 'motoristas', labelKey: 'menu.drivers' }]
    },
    {
        id: 'fornecedores',
        labelKey: 'menu.suppliers',
        permissions: [{ id: 'fornecedores', labelKey: 'menu.suppliers' }]
    },
    {
        id: 'clientes',
        labelKey: 'menu.clients',
        permissions: [{ id: 'clientes', labelKey: 'menu.clients' }]
    },
    {
        id: 'equipa-oficina',
        labelKey: 'menu.workshop_team',
        permissions: [{ id: 'equipa-oficina', labelKey: 'menu.workshop_team' }]
    },
    {
        id: 'supervisores',
        labelKey: 'menu.supervisors',
        permissions: [{ id: 'supervisores', labelKey: 'menu.supervisors' }]
    },
    {
        id: 'escalas',
        labelKey: 'menu.schedule',
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
        permissions: [
            { id: 'horas', labelKey: 'menu.hours' },
            { id: 'hours_view_costs', labelKey: 'hours.view_costs' }
        ]
    },
    {
        id: 'combustivel',
        labelKey: 'menu.fuel',
        permissions: [
            { id: 'combustivel', labelKey: 'menu.fuel' },
            { id: 'combustivel_calibrate', labelKey: 'fuel.entry.calibrate' },
            { id: 'combustivel_edit_history', labelKey: 'fuel.action.history' }
        ]
    },
    {
        id: 'admin_financas',
        labelKey: 'menu.admin',
        permissions: [
            { id: 'contabilidade', labelKey: 'menu.accounting' },
            { id: 'centros_custos', labelKey: 'menu.cost_centers' },
            { id: 'relatorios', labelKey: 'menu.reports' }
        ]
    },
    {
        id: 'extras',
        labelKey: 'menu.extras',
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
                            {PERMISSION_GROUPS.map((group) => (
                                <>
                                    {/* Group Header */}
                                    <tr key={`header-${group.id}`} className="bg-slate-800/30">
                                        <td colSpan={4} className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wilder flex items-center gap-2">
                                            <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                                            {t(group.labelKey)}
                                        </td>
                                    </tr>

                                    {/* Sub Permissions */}
                                    {group.permissions.map((perm) => (
                                        <tr key={perm.id} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-slate-200 font-medium">
                                                    {perm.id === 'hours_view_costs' ? 'Ver Custos/Valores' : t(perm.labelKey)}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-0.5 font-mono opacity-50">{perm.id}</div>
                                            </td>

                                            {/* Role Toggles */}
                                            {(['supervisor', 'oficina', 'motorista'] as const).map((role) => {
                                                const isActive = permissions[role].includes(perm.id);
                                                const colorClass = role === 'supervisor' ? 'bg-purple-500' : role === 'oficina' ? 'bg-orange-500' : 'bg-emerald-500';

                                                return (
                                                    <td key={`${role}-${perm.id}`} className="px-6 py-4 text-center">
                                                        <button
                                                            onClick={() => togglePermission(role as any, perm.id)}
                                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${isActive ? colorClass : 'bg-slate-700'
                                                                }`}
                                                        >
                                                            <span
                                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'
                                                                    }`}
                                                            />
                                                        </button>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
