import { useState, useEffect, useRef } from 'react';
import {
    MessageSquare, Send, User, Shield,
    Search, AlertTriangle, Calendar, Truck, Users, Info,
    Clock, Tag, Activity
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useChat } from '../../contexts/ChatContext';
import { supabase } from '../../lib/supabase';
import type { OperationThread, OperationMessage, OperationType } from '../../types';

export default function ChatPage() {
    const { userRole, currentUser } = useAuth();
    const { motoristas, supervisors, oficinaUsers, viaturas, servicos } = useWorkshop();
    const { messages: legacyMessages, sendMessage: sendLegacyMessage, markAsRead: markLegacyAsRead, getUnreadCountForUser } = useChat();

    // State for categories and selection
    const [selectedCategory, setSelectedCategory] = useState<OperationType>('general');
    const [selectedUser, setSelectedUser] = useState<{ id: string; name: string; role: string } | null>(null);
    const [selectedThread, setSelectedThread] = useState<OperationThread | null>(null);

    // DB State
    const [operationalThreads, setOperationalThreads] = useState<OperationThread[]>([]);
    const [threadMessages, setThreadMessages] = useState<OperationMessage[]>([]);

    // UI State
    const [inputMessage, setInputMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const myId = userRole === 'admin' ? 'admin' : currentUser?.id || 'unknown';
    const myDbId = currentUser?.id;

    // Fetch Operational Threads
    useEffect(() => {
        const fetchThreads = async () => {
            const { data, error } = await supabase
                .from('operation_threads')
                .select('*')
                .order('created_at', { ascending: false });

            if (!error && data) {
                setOperationalThreads(data as OperationThread[]);
            }
        };

        fetchThreads();

        // Realtime subscription
        const channel = supabase
            .channel('operation_threads_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'operation_threads' }, fetchThreads)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Fetch Messages for selected thread
    useEffect(() => {
        if (!selectedThread) {
            setThreadMessages([]);
            return;
        }

        const fetchMessages = async () => {
            const { data, error } = await supabase
                .from('operation_messages')
                .select('*')
                .eq('thread_id', selectedThread.id)
                .order('created_at', { ascending: true });

            if (!error && data) {
                setThreadMessages(data as OperationMessage[]);
            }
        };

        fetchMessages();

        // Realtime subscription
        const channel = supabase
            .channel(`thread_${selectedThread.id}_messages`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'operation_messages',
                filter: `thread_id=eq.${selectedThread.id}`
            }, (payload) => {
                setThreadMessages((prev: OperationMessage[]) => [...prev, payload.new as OperationMessage]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedThread]);

    // Build list of legacy chat users (contacts)
    const getChatUsers = () => {
        const allUsers = [
            { id: 'admin', name: 'Administrador', role: 'admin' },
            ...supervisors.map(s => ({ id: s.id, name: s.nome, role: 'supervisor' })),
            ...oficinaUsers.map(o => ({ id: o.id, name: o.nome, role: 'oficina' })),
            ...motoristas.map(m => ({ id: m.id, name: m.nome, role: 'motorista' }))
        ];
        return allUsers.filter(u => u.id !== myId);
    };

    const chatUsers = getChatUsers().filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.role.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredThreads = operationalThreads.filter((t: OperationThread) =>
        t.type === selectedCategory &&
        (t.title.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [legacyMessages, threadMessages, selectedUser, selectedThread]);

    // Mark legacy as read
    useEffect(() => {
        if (selectedUser) {
            markLegacyAsRead(selectedUser.id);
        }
    }, [selectedUser, legacyMessages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputMessage.trim()) return;

        if (selectedCategory === 'general' && selectedUser) {
            sendLegacyMessage(inputMessage, selectedUser.id);
            setInputMessage('');
        } else if (selectedThread && myDbId) {
            const { error } = await supabase
                .from('operation_messages')
                .insert({
                    thread_id: selectedThread.id,
                    sender_id: myDbId,
                    message: inputMessage,
                    system_generated: false
                });

            if (!error) {
                setInputMessage('');
            }
        }
    };

    // Context Helpers
    const getRelatedVehicle = (vehicleId?: string) => viaturas.find(v => v.id === vehicleId);
    const getRelatedUser = (userId?: string) => motoristas.find(m => m.id === userId);
    const getRelatedSchedule = (scheduleId?: string) => servicos.find(s => s.id === scheduleId);

    const categories = [
        { id: 'alert', label: 'Alertas', icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10' },
        { id: 'schedule', label: 'Escalas', icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { id: 'fleet', label: 'Frota', icon: Truck, color: 'text-orange-500', bg: 'bg-orange-500/10' },
        { id: 'team', label: 'Equipa', icon: Users, color: 'text-purple-500', bg: 'bg-purple-500/10' },
        { id: 'general', label: 'Geral', icon: MessageSquare, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    ];

    return (
        <div className="flex flex-col h-full bg-[#0f172a] overflow-hidden">
            {/* Header */}
            <div className="shrink-0 mb-4 flex justify-between items-center p-4 md:px-8">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 flex items-center gap-3">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-blue-600/10 flex items-center justify-center border border-blue-600/20">
                            <Activity className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
                        </div>
                        Centro Operacional
                    </h1>
                    <p className="text-slate-400 text-xs md:text-sm">Hub de comunicação e alertas do sistema</p>
                </div>
            </div>

            {/* Main Layout - 3 Columns */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 pb-4 px-4 text-white">

                {/* COLUMN 1: Categories (Narrow Sidebar) */}
                <div className="lg:col-span-1 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto pb-2 lg:pb-0 scrollbar-hide">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => {
                                setSelectedCategory(cat.id as OperationType);
                                setSelectedUser(null);
                                setSelectedThread(null);
                            }}
                            className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all border shrink-0 lg:w-full
                                ${selectedCategory === cat.id
                                    ? `${cat.bg} border-blue-500/50 text-blue-400`
                                    : 'bg-slate-800/20 border-transparent text-slate-500 hover:bg-slate-800/40'}`}
                        >
                            <cat.icon className={`w-6 h-6 mb-1 ${selectedCategory === cat.id ? cat.color : ''}`} />
                            <span className="text-[10px] font-bold uppercase tracking-wider">{cat.label}</span>
                        </button>
                    ))}
                </div>

                {/* COLUMN 2: Thread/User List */}
                <div className="lg:col-span-3 flex flex-col gap-3 h-full min-h-0">
                    <div className="shrink-0 bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Procurar..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs text-white focus:border-blue-500/50 outline-none placeholder:text-slate-600"
                            />
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-2 overflow-y-auto custom-scrollbar space-y-1">
                        {selectedCategory === 'general' ? (
                            // Use threads for general contact list as requested
                            filteredThreads.map((thread: OperationThread) => {
                                const isSelected = selectedThread?.id === thread.id;
                                // Try to find the user role/icon for the related_user
                                const relUser = [...supervisors, ...oficinaUsers, ...motoristas].find(u => u.id === thread.related_user);
                                const role = relUser ? (motoristas.some(m => m.id === relUser.id) ? 'motorista' : supervisors.some(s => s.id === relUser.id) ? 'supervisor' : 'oficina') : 'utilizador';

                                return (
                                    <button
                                        key={thread.id}
                                        onClick={() => setSelectedThread(thread)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all border group
                                        ${isSelected
                                                ? 'bg-blue-600/10 border-blue-500/50'
                                                : 'bg-slate-800/20 border-transparent hover:bg-slate-800/60'}`}
                                    >
                                        <div className="relative shrink-0">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border 
                                                ${role === 'admin' ? 'bg-blue-500/10 border-blue-500 text-blue-400' :
                                                    role === 'supervisor' ? 'bg-purple-500/10 border-purple-500 text-purple-400' :
                                                        'bg-emerald-500/10 border-emerald-500 text-emerald-400'}
                                            `}>
                                                {role === 'admin' ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                            </div>
                                        </div>
                                        <div className="flex-1 text-left min-w-0">
                                            <div className="flex justify-between items-center">
                                                <span className={`font-bold text-xs truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>{thread.title}</span>
                                            </div>
                                            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{role}</span>
                                        </div>
                                    </button>
                                );
                            })
                        ) : (
                            // Operational Threads
                            filteredThreads.map((thread: OperationThread) => {
                                const isSelected = selectedThread?.id === thread.id;
                                return (
                                    <button
                                        key={thread.id}
                                        onClick={() => setSelectedThread(thread)}
                                        className={`w-full flex flex-col gap-1 p-3 rounded-xl transition-all border group
                                        ${isSelected
                                                ? 'bg-blue-600/10 border-blue-500/50'
                                                : 'bg-slate-800/20 border-transparent hover:bg-slate-800/60'}`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <span className={`font-bold text-xs ${isSelected ? 'text-white' : 'text-slate-200'}`}>{thread.title}</span>
                                            <span className={`text-[10px] px-1.5 bg-slate-800 border border-slate-700 rounded-full ${thread.status === 'active' ? 'text-blue-400' : 'text-slate-500'}`}>
                                                {thread.status}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-slate-500">{new Date(thread.created_at).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* COLUMN 3: Chat + Context Panel */}
                <div className="lg:col-span-8 h-full min-h-0 grid grid-cols-1 md:grid-cols-4 gap-4">

                    {/* Chat Window (3 cols or full if no context) */}
                    <div className={`md:col-span-3 h-full min-h-0 bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden flex flex-col relative`}>
                        {selectedThread ? (
                            <>
                                {/* Chat Header */}
                                <div className="shrink-0 bg-slate-900/80 backdrop-blur-md p-3 border-b border-slate-700/50 flex justify-between items-center z-10">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border bg-slate-700/50 border-slate-600 text-white`}>
                                            <Info className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h2 className="text-sm font-bold text-white leading-tight">
                                                {selectedThread.title}
                                            </h2>
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                                                <span className="text-[10px] text-emerald-400 font-bold uppercase">Ativo</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Messages Area */}
                                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-950/30">
                                    {threadMessages.map((msg: any) => {
                                        const isMyMessage = (msg as any).sender_id === myDbId;
                                        const content = (msg as any).message;
                                        const timestamp = (msg as any).created_at;
                                        const isSystem = (msg as any).system_generated;

                                        return (
                                            <div
                                                key={(msg as any).id}
                                                className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'} ${isSystem ? 'justify-center my-4' : ''}`}
                                            >
                                                {isSystem ? (
                                                    <div className="bg-blue-900/20 border border-blue-500/20 text-blue-400 text-[10px] font-bold py-1 px-3 rounded-full flex items-center gap-2">
                                                        <Activity className="w-3 h-3" />
                                                        {content}
                                                    </div>
                                                ) : (
                                                    <div className={`max-w-[85%] p-3 rounded-2xl shadow-sm ${isMyMessage
                                                        ? 'bg-blue-600 text-white rounded-br-none'
                                                        : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                                                        }`}>
                                                        <p className="text-xs leading-relaxed">{content}</p>
                                                        <div className="flex items-center justify-end gap-1 mt-1 opacity-50">
                                                            <span className="text-[10px]">
                                                                {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Input Area */}
                                <div className="shrink-0 p-3 bg-slate-900/80 backdrop-blur-md border-t border-slate-700/50">
                                    <form onSubmit={handleSend} className="flex gap-2">
                                        <input
                                            type="text"
                                            value={inputMessage}
                                            onChange={(e) => setInputMessage(e.target.value)}
                                            placeholder="Escreva uma mensagem..."
                                            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-xs outline-none focus:border-blue-500/50 placeholder:text-slate-600"
                                        />
                                        <button
                                            type="submit"
                                            disabled={!inputMessage.trim()}
                                            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white p-2 rounded-xl"
                                        >
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </form>
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
                                <MessageSquare className="w-12 h-12 mb-4" />
                                <h2 className="text-lg font-bold text-white">Selecione uma categoria e um item para visualizar</h2>
                            </div>
                        )}
                    </div>

                    {/* Context Panel (1 col) */}
                    <div className="h-full min-h-0 bg-[#1e293b]/30 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 overflow-y-auto custom-scrollbar">
                        <div className="flex items-center gap-2 mb-4 border-b border-slate-700/50 pb-2">
                            <Info className="w-4 h-4 text-blue-400" />
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Informação do Contexto</h3>
                        </div>

                        {selectedThread ? (
                            <div className="space-y-4">
                                {selectedThread.type === 'alert' && (
                                    <div className="bg-red-900/10 p-3 rounded-xl border border-red-500/20">
                                        <div className="flex items-center gap-2 mb-2">
                                            <AlertTriangle className="w-4 h-4 text-red-500" />
                                            <span className="text-xs font-bold text-red-400">Detalhes do Alerta</span>
                                        </div>
                                        <p className="text-[10px] text-slate-300 leading-relaxed font-medium">
                                            Este é um alerta gerado pelo sistema. Verifique as mensagens para mais detalhes sobre a ação necessária.
                                        </p>
                                    </div>
                                )}

                                {selectedThread.type === 'schedule' && selectedThread.related_schedule && (
                                    <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Calendar className="w-4 h-4 text-blue-400" />
                                            <span className="text-xs font-bold text-white">Escala Relacionada</span>
                                        </div>
                                        {(() => {
                                            const sch = getRelatedSchedule(selectedThread.related_schedule);
                                            return sch ? (
                                                <div className="space-y-1 text-slate-300">
                                                    <p className="text-[10px]"><span className="text-slate-500">Passageiro:</span> {sch.passageiro}</p>
                                                    <p className="text-[10px]"><span className="text-slate-500">Hora:</span> {sch.hora}</p>
                                                    <p className="text-[10px]"><span className="text-slate-500">Rota:</span> {sch.origem} → {sch.destino}</p>
                                                </div>
                                            ) : <p className="text-xs text-slate-500 italic">Detalhes não encontrados</p>;
                                        })()}
                                    </div>
                                )}

                                {selectedThread.type === 'fleet' && selectedThread.related_vehicle && (
                                    <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Truck className="w-4 h-4 text-orange-400" />
                                            <span className="text-xs font-bold text-white">Viatura Relacionada</span>
                                        </div>
                                        {(() => {
                                            const v = getRelatedVehicle(selectedThread.related_vehicle);
                                            return v ? (
                                                <div className="space-y-1 text-slate-300">
                                                    <p className="text-[10px]"><span className="text-slate-500">Matrícula:</span> {v.matricula}</p>
                                                    <p className="text-[10px]"><span className="text-slate-500">Modelo:</span> {v.marca} {v.modelo}</p>
                                                </div>
                                            ) : <p className="text-xs text-slate-500 italic">Viatura não encontrada</p>;
                                        })()}
                                    </div>
                                )}

                                {selectedThread.related_user && (
                                    <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                                        <div className="flex items-center gap-2 mb-2">
                                            <User className="w-4 h-4 text-emerald-400" />
                                            <span className="text-xs font-bold text-white">Pessoa Envolvida</span>
                                        </div>
                                        {(() => {
                                            const m = getRelatedUser(selectedThread.related_user);
                                            return m ? (
                                                <div className="space-y-1 text-slate-300">
                                                    <p className="text-[10px] font-bold text-white">{m.nome}</p>
                                                    <p className="text-[10px]"><span className="text-slate-500">Contacto:</span> {m.contacto}</p>
                                                </div>
                                            ) : <p className="text-xs text-slate-500 italic">Utilizador não encontrado</p>;
                                        })()}
                                    </div>
                                )}

                                <div className="pt-2 border-t border-slate-700/50">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Clock className="w-3 h-3 text-slate-500" />
                                        <span className="text-[10px] text-slate-400">Criado em:</span>
                                    </div>
                                    <p className="text-[10px] text-slate-300">{new Date(selectedThread.created_at).toLocaleString('pt-PT')}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-48 opacity-20">
                                <Tag className="w-8 h-8 mb-2" />
                                <p className="text-[10px] font-bold">Sem Contexto</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
