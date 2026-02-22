import { MapPin, Truck, Clock, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';

interface QuickShortcutsProps {
    onShortcutClick: (type: 'location' | 'service' | 'presence' | 'alert', data?: any) => void;
    isExpanded: boolean;
    onToggleExpand: (expanded: boolean) => void;
}

export default function QuickShortcuts({
    onShortcutClick,
    isExpanded,
    onToggleExpand,
}: QuickShortcutsProps) {
    const shortcuts = [
        {
            id: 'location',
            icon: MapPin,
            label: 'Partilhar Localização',
            color: 'bg-blue-600/20 border-blue-500/40 text-blue-400 hover:bg-blue-600/30',
            type: 'location' as const,
        },
        {
            id: 'service',
            icon: Truck,
            label: 'Atribuir Serviço',
            color: 'bg-purple-600/20 border-purple-500/40 text-purple-400 hover:bg-purple-600/30',
            type: 'service' as const,
        },
        {
            id: 'presence',
            icon: Clock,
            label: 'Confirmar Presença',
            color: 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-600/30',
            type: 'presence' as const,
        },
        {
            id: 'alert',
            icon: AlertTriangle,
            label: 'Enviar Alerta',
            color: 'bg-orange-600/20 border-orange-500/40 text-orange-400 hover:bg-orange-600/30',
            type: 'alert' as const,
        },
    ];

    return (
        <div className="relative">
            {/* Collapsed/Expanded Toggle */}
            <button
                onClick={() => onToggleExpand(!isExpanded)}
                className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-800/30 border border-slate-700/50 text-slate-300 hover:text-white hover:border-slate-600 transition-colors group"
            >
                <span className="text-xs font-bold uppercase tracking-wider">⚡ Ações Rápidas</span>
                {isExpanded ? (
                    <ChevronUp className="w-4 h-4 group-hover:scale-110 transition-transform" />
                ) : (
                    <ChevronDown className="w-4 h-4 group-hover:scale-110 transition-transform" />
                )}
            </button>

            {/* Quick Buttons Grid */}
            {isExpanded && (
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    {shortcuts.map((shortcut) => {
                        const Icon = shortcut.icon;
                        return (
                            <button
                                key={shortcut.id}
                                onClick={() => onShortcutClick(shortcut.type)}
                                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all active:scale-95 font-medium text-xs md:text-sm ${shortcut.color}`}
                            >
                                <Icon className="w-5 h-5 md:w-6 md:h-6" />
                                <span className="text-xs text-center leading-tight font-semibold truncate">
                                    {shortcut.label.split(' ')[0]}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
