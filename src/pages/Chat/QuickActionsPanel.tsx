import { User, Calendar, Truck, AlertTriangle, ChevronRight, ChevronLeft } from 'lucide-react';
import type { Conversation } from '../../types';

interface QuickActionsPanelProps {
    conversation: Conversation | null;
    isCollapsed: boolean;
    onToggleCollapse: (collapsed: boolean) => void;
}

export default function QuickActionsPanel({
    conversation,
    isCollapsed,
    onToggleCollapse,
}: QuickActionsPanelProps) {
    if (!conversation) return null;

    const actions = [
        {
            id: 'profile',
            icon: User,
            label: 'Ver Perfil',
            color: 'bg-blue-600/20 border-blue-500/40 text-blue-400 hover:bg-blue-600/30',
        },
        {
            id: 'schedule',
            icon: Calendar,
            label: 'Ver Escalas Hoje',
            color: 'bg-purple-600/20 border-purple-500/40 text-purple-400 hover:bg-purple-600/30',
        },
        {
            id: 'vehicle',
            icon: Truck,
            label: 'Ver Viatura Atual',
            color: 'bg-indigo-600/20 border-indigo-500/40 text-indigo-400 hover:bg-indigo-600/30',
        },
        {
            id: 'alert',
            icon: AlertTriangle,
            label: 'Enviar Alerta Op.',
            color: 'bg-orange-600/20 border-orange-500/40 text-orange-400 hover:bg-orange-600/30',
        },
    ];

    return (
        <div className={`relative bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden transition-all duration-300 ${
            isCollapsed ? 'w-16 hidden lg:flex flex-col items-center p-2' : 'lg:col-span-2 lg:flex flex-col p-4 hidden'
        }`}>
            {/* Header */}
            <div className={`shrink-0 flex items-center gap-2 mb-4 w-full ${isCollapsed ? 'flex-col' : 'flex-row justify-between'}`}>
                {!isCollapsed && (
                    <>
                        <div>
                            <h3 className="text-sm font-bold text-white mb-1">Ações Rápidas</h3>
                            <p className="text-xs text-slate-500">{conversation.participantName}</p>
                        </div>
                        <button
                            onClick={() => onToggleCollapse(true)}
                            className="p-1.5 bg-slate-800/50 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                            title="Colapsar painel"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </>
                )}

                {isCollapsed && (
                    <button
                        onClick={() => onToggleCollapse(false)}
                        className="p-1.5 bg-slate-800/50 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                        title="Expandir painel"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Divider */}
            {!isCollapsed && <div className="h-px bg-slate-700/50 w-full mb-4"></div>}

            {/* Actions Grid */}
            <div className={`flex-1 flex flex-col gap-2 w-full ${isCollapsed ? 'items-center' : ''}`}>
                {actions.map((action) => {
                    const Icon = action.icon;
                    return (
                        <button
                            key={action.id}
                            className={`p-3 rounded-xl border transition-all hover:scale-105 active:scale-95 group ${action.color} ${
                                isCollapsed ? 'w-12 h-12 flex items-center justify-center' : 'w-full flex items-center gap-3'
                            }`}
                            title={action.label}
                        >
                            <Icon className={`w-5 h-5 flex-shrink-0 ${isCollapsed ? '' : ''}`} />
                            {!isCollapsed && (
                                <div className="text-left flex-1 min-w-0">
                                    <span className="block text-sm font-semibold group-hover:translate-x-0.5 transition-transform">
                                        {action.label}
                                    </span>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Driver Status Card */}
            {!isCollapsed && (
                <div className="mt-4 pt-4 border-t border-slate-700/50 w-full">
                    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
                            <span className="text-xs font-bold text-slate-400 uppercase">Status</span>
                        </div>
                        <p className="text-xs text-emerald-400 font-semibold">Online • Ativo</p>
                        <p className="text-xs text-slate-500">Última atualização: Agora</p>
                    </div>
                </div>
            )}

            {/* Collapsed Status Indicator */}
            {isCollapsed && (
                <div className="mt-auto pt-2 border-t border-slate-700/50 w-full flex justify-center">
                    <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
                </div>
            )}
        </div>
    );
}
