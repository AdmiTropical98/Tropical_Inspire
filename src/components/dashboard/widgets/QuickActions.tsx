import { PlusCircle, UserPlus, MapPin, Truck } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { usePermissions } from '../../../contexts/PermissionsContext';

interface QuickActionsProps {
    onNewService?: () => void;
    onNewClient?: () => void;
    onNewDriver?: () => void;
    onNewVehicle?: () => void;
}

export default function QuickActions({ onNewService, onNewClient, onNewDriver, onNewVehicle }: QuickActionsProps) {
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
            label: 'Novo Local',
            icon: MapPin,
            color: 'amber',
            show: hasAccess(userRole, 'locais')
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
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 h-full flex flex-col justify-center">
            <h3 className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-4">Acesso Rápido</h3>
            <div className="grid grid-cols-2 gap-3">
                {actions.filter(a => a.show).map((action, idx) => (
                    <button
                        key={idx}
                        onClick={action.onClick}
                        className={`
                            group relative overflow-hidden
                            flex flex-col items-center justify-center gap-2 p-3
                            bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-${action.color}-500/50
                            rounded-xl transition-all duration-300
                        `}
                    >
                        <div className={`
                            p-2 rounded-lg bg-${action.color}-500/10 text-${action.color}-500
                            group-hover:scale-110 transition-transform
                        `}>
                            <action.icon className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
                            {action.label}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}
