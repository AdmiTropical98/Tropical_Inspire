import { PlusCircle, UserPlus, Truck } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { usePermissions } from '../../../contexts/PermissionsContext';

interface QuickActionsProps {
    onNewService?: () => void;
    onNewClient?: () => void;
    onNewDriver?: () => void;
    onNewVehicle?: () => void;
}

export default function QuickActions({ onNewService, onNewClient, onNewVehicle }: QuickActionsProps) {
    const { userRole } = useAuth();
    const { hasAccess } = usePermissions();

    const actions = [
        {
            label: 'Novo Serviço',
            icon: PlusCircle,
            color: 'blue',
            onClick: onNewService,
            show: hasAccess(userRole, 'requisicoes')
        },
        {
            label: 'Novo Cliente',
            icon: UserPlus,
            color: 'emerald',
            onClick: onNewClient,
            show: hasAccess(userRole, 'clientes')
        },
        {
            label: 'Nova Viatura',
            icon: Truck,
            color: 'indigo',
            onClick: onNewVehicle,
            show: hasAccess(userRole, 'viaturas')
        }
    ];

    return (
        <div className="bg-white/90 border border-slate-200/70 rounded-2xl p-6 h-full flex flex-col" style={{ boxShadow: '0 4px 20px -6px rgba(15,23,42,0.10)' }}>
            <h3 className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-6 opacity-80">Acesso Rápido</h3>
            <div className="grid grid-cols-2 gap-4 h-full">
                {actions.filter(a => a.show).map((action, idx) => (
                    <button
                        key={idx}
                        onClick={action.onClick}
                        className={`
                            group relative overflow-hidden
                            flex flex-col items-start justify-between p-5
                            bg-slate-50 hover:bg-white border border-slate-200 rounded-2xl transition-all duration-300 hover:shadow-md hover:-translate-y-1
                        `}
                    >
                        {/* Hover Glow */}
                        <div className={`absolute -right-10 -bottom-10 w-24 h-24 bg-${action.color}-500 blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500`} />

                        <div className={`
                            p-3 rounded-2xl bg-${action.color}-500/10 text-${action.color}-400 ring-1 ring-${action.color}-500/20
                            group-hover:scale-110 group-hover:bg-${action.color}-500/20 transition-all duration-500
                        `}>
                            <action.icon className="w-6 h-6" />
                        </div>
                        <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors relative z-10 mt-4">
                            {action.label}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}
