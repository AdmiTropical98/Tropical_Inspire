import React, { useState } from 'react';
import {
    LayoutDashboard, Users, ShieldAlert, Activity,
    Terminal, ShieldCheck, AlertTriangle, Search
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import BackofficeDashboard from './Dashboard';
import UserManagement from './UserManagement';
import AuditLogs from './AuditLogs';
import SystemMonitor from './SystemMonitor';
import OperationalControl from './OperationalControl';

type BackofficeTab = 'overview' | 'users' | 'audit' | 'monitor' | 'control';

export default function Backoffice() {
    const { userRole } = useAuth();
    const [activeTab, setActiveTab] = useState<BackofficeTab>('overview');

    if (userRole !== 'ADMIN_MASTER') {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in duration-500">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 ring-4 ring-red-500/20">
                    <ShieldAlert className="w-10 h-10 text-red-500" />
                </div>
                <h1 className="text-2xl font-black text-white mb-2 tracking-tight">ACESSO RESTRITO</h1>
                <p className="text-slate-400 max-w-md">
                    Esta área é reservada exclusivamente para o cargo <span className="text-red-400 font-bold tracking-widest">ADMIN_MASTER</span>.
                    O seu acesso foi negado e registado por motivos de segurança.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#0f172a]">
            {/* Backoffice Header */}
            <header className="p-6 border-b border-slate-800/60 bg-slate-900/40 backdrop-blur-md">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-500/20">
                                LOCKED SECURE
                            </span>
                            <h1 className="text-2xl font-black text-white tracking-tight">MASTER CONTROL CENTRE</h1>
                        </div>
                        <p className="text-slate-500 text-sm font-medium">Gestão operacional de alto nível e auditoria de sistema.</p>
                    </div>

                    <div className="flex items-center gap-2 p-1 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                        <TabButton
                            active={activeTab === 'overview'}
                            onClick={() => setActiveTab('overview')}
                            icon={LayoutDashboard}
                            label="Overview"
                        />
                        <TabButton
                            active={activeTab === 'users'}
                            onClick={() => setActiveTab('users')}
                            icon={Users}
                            label="Utilizadores"
                        />
                        <TabButton
                            active={activeTab === 'audit'}
                            onClick={() => setActiveTab('audit')}
                            icon={ShieldCheck}
                            label="Audit Logs"
                        />
                        <TabButton
                            active={activeTab === 'monitor'}
                            onClick={() => setActiveTab('monitor')}
                            icon={Activity}
                            label="Monitor"
                        />
                        <TabButton
                            active={activeTab === 'control'}
                            onClick={() => setActiveTab('control')}
                            icon={Terminal}
                            label="Terminal"
                        />
                    </div>
                </div>
            </header>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                {activeTab === 'overview' && <BackofficeDashboard />}
                {activeTab === 'users' && <UserManagement />}
                {activeTab === 'audit' && <AuditLogs />}
                {activeTab === 'monitor' && <SystemMonitor />}
                {activeTab === 'control' && <OperationalControl />}
            </div>
        </div>
    );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30 ring-1 ring-blue-400/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
        >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
        </button>
    );
}
