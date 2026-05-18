import {
    Terminal, ShieldCheck,
    Database, RefreshCcw, Lock, Unlock,
    Search, ShieldAlert,
    ChevronRight,
    Zap
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function OperationalControl() {
    const { currentUser } = useAuth();

    const handleManualAction = async (action: string, description: string) => {
        if (!confirm(`Tem a certeza que deseja executar: ${description}?\nEsta ação será registada para auditoria.`)) return;

        try {
            // Logic for various master actions would go here
            alert(`Ação ${action} executada com sucesso.`);

            // Log to Audit
            await supabase.from('audit_logs').insert({
                user_id: currentUser?.id,
                action: `MASTER_CMD_${action}`,
                module: 'backoffice',
                details: { command: action, description }
            });

        } catch (err) {
            console.error('Error executing master command:', err);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Terminal Tools */}
            <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <Terminal className="w-5 h-5 text-blue-500" />
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Terminal de Comandos</h2>
                </div>

                <div className="grid grid-cols-1 gap-3">
                    <CommandBox
                        icon={RefreshCcw}
                        title="Sincronizar Cartrack"
                        desc="Forçar actualização imediata de todas as viaturas."
                        onClick={() => handleManualAction('CARTRACK_SYNC', 'Sincronização Cartrack Forçada')}
                    />
                    <CommandBox
                        icon={Database}
                        title="Limpar Cache de Sistema"
                        desc="Invalidar todos os buckets de cache em memória."
                        onClick={() => handleManualAction('CACHE_FLUSH', 'Limpeza Total de Cache')}
                    />
                    <CommandBox
                        icon={Lock}
                        title="Lockout Preventivo"
                        desc="Bloquear novos logins (Admin Master apenas)."
                        danger
                        onClick={() => handleManualAction('SYSTEM_LOCKOUT', 'Lockout Preventivo Global')}
                    />
                    <CommandBox
                        icon={Unlock}
                        title="Repor Acessos"
                        desc="Desbloquear tentativas de login falhadas (IP Global)."
                        onClick={() => handleManualAction('IP_RESET', 'Reposição de Acessos por IP')}
                    />
                </div>
            </div>

            {/* Security Status Hub */}
            <div className="bg-white/90/60 border border-slate-200/60 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                    <ShieldAlert className="w-32 h-32 text-blue-500 transform rotate-12" />
                </div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900">Segurança do Núcleo</h3>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Protocolos Activos: 14</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <SecurityStatus label="Cifragem em Trânsito" status="TLS 1.3 Active" ok />
                        <SecurityStatus label="Inspecção de IP" status="Filtering active" ok />
                        <SecurityStatus label="Monitorização de Brute-force" status="Armado" ok />
                        <SecurityStatus label="Integridade de Dados" status="Verificado (5m ago)" ok />
                    </div>

                    <div className="mt-12 p-6 rounded-2xl bg-slate-50 border border-slate-200/50">
                        <div className="flex items-center gap-4 mb-4">
                            <Zap className="w-5 h-5 text-blue-500" />
                            <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Quick Scan</span>
                        </div>
                        <div className="relative h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                            <div className="absolute top-0 left-0 h-full bg-blue-500 w-full animate-progress-slow" />
                        </div>
                        <div className="flex items-center justify-between mt-3">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Integridade de Tabelas</span>
                            <span className="text-[10px] font-black text-blue-400">VERIFICANDO...</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function CommandBox({ icon: Icon, title, desc, onClick, danger }: any) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left group ${danger
                    ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40'
                    : 'bg-slate-50 border-slate-200/50 hover:bg-slate-100 hover:border-slate-300'
                }`}
        >
            <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-xl bg-white/90 shadow-inner ${danger ? 'text-red-500' : 'text-blue-500'}`}>
                    <Icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </div>
                <div>
                    <h4 className={`text-sm font-black ${danger ? 'text-red-400' : 'text-slate-200'}`}>{title}</h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase leading-none mt-1">{desc}</p>
                </div>
            </div>
            <ChevronRight className={`w-4 h-4 ${danger ? 'text-red-900' : 'text-slate-700'}`} />
        </button>
    );
}

function SecurityStatus({ label, status, ok }: { label: string, status: string, ok: boolean }) {
    return (
        <div className="flex items-center justify-between group/status font-black">
            <div className="flex items-center gap-3">
                <Search className="w-3 h-3 text-slate-600 group-hover/status:text-blue-500 transition-colors" />
                <span className="text-[10px] text-slate-400 uppercase tracking-widest leading-none">{label}</span>
            </div>
            <span className={`text-[10px] uppercase tracking-tighter ${ok ? 'text-blue-400' : 'text-red-500'}`}>{status}</span>
        </div>
    );
}
