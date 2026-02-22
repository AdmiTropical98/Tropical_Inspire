import { useState, useEffect, useRef } from 'react';
import {
    MessageSquare, Send, User, Shield,
    Search, AlertTriangle, Calendar, Truck, Users, Info,
    Clock, Tag, Activity, Bell
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useChat } from '../../contexts/ChatContext';
import { supabase } from '../../lib/supabase';
import type { OperationThread, OperationMessage, OperationType, OperationEvent, OperationCategory } from '../../types';

export default function ChatPage() {
    const { userRole, currentUser } = useAuth();
    const { motoristas, supervisors, oficinaUsers, viaturas, servicos, fuelTransactions } = useWorkshop();
    const { messages: legacyMessages, sendMessage: sendLegacyMessage, markAsRead: markLegacyAsRead } = useChat();

    // State for categories and selection
    const [selectedCategory, setSelectedCategory] = useState<OperationCategory>('alert');
    const [selectedThread, setSelectedThread] = useState<OperationThread | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<OperationEvent | null>(null);
    const [selectedUser, setSelectedUser] = useState<{ id: string; name: string; role: string } | null>(null);

    // DB State
    const [operationalThreads, setOperationalThreads] = useState<OperationThread[]>([]);
    const [operationalEvents, setOperationalEvents] = useState<OperationEvent[]>([]);
    const [threadMessages, setThreadMessages] = useState<OperationMessage[]>([]);

    // UI State
    const [inputMessage, setInputMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const myDbId = currentUser?.id;

    // Fetch Operational Data
    useEffect(() => {
        const fetchOperationalData = async () => {
            const [threadsRes, eventsRes] = await Promise.all([
                supabase.from('operation_threads').select('*').order('created_at', { ascending: false }),
                supabase.from('operation_events').select('*').order('created_at', { ascending: false })
            ]);

            if (threadsRes.data) setOperationalThreads(threadsRes.data as OperationThread[]);
            if (eventsRes.data) setOperationalEvents(eventsRes.data as OperationEvent[]);
        };

        fetchOperationalData();

        // Realtime subscriptions
        const threadsChannel = supabase.channel('op_threads').on('postgres_changes', { event: '*', schema: 'public', table: 'operation_threads' }, fetchOperationalData).subscribe();
        const eventsChannel = supabase.channel('op_events').on('postgres_changes', { event: '*', schema: 'public', table: 'operation_events' }, fetchOperationalData).subscribe();

        return () => {
            supabase.removeChannel(threadsChannel);
            supabase.removeChannel(eventsChannel);
        };
    }, []);

    // Periodic Audits for Intelligence (Step 2)
    useEffect(() => {
        if (userRole === 'admin' || userRole === 'gestor') {
            import('../../services/operationalIntelligence').then(m => {
                m.auditDriversWithoutVehicles(motoristas);
                m.auditFleetFuelStatus(viaturas, fuelTransactions);
            });
        }
    }, [motoristas, viaturas, fuelTransactions, userRole]);

    // Fetch Messages for selected thread
    useEffect(() => {
        if (!selectedThread) {
            setThreadMessages([]);
            return;
        }

        const fetchMessages = async () => {
            const { data } = await supabase
                .from('operation_messages')
                .select('*')
                .eq('thread_id', selectedThread.id)
                .order('created_at', { ascending: true });

            if (data) setThreadMessages(data as OperationMessage[]);
        };

        fetchMessages();

        const channel = supabase.channel(`msg_${selectedThread.id}`).on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'operation_messages', filter: `thread_id=eq.${selectedThread.id}`
        }, (payload) => {
            setThreadMessages(prev => [...prev, payload.new as OperationMessage]);
        }).subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [selectedThread]);

    const filteredEvents = operationalEvents.filter(e => {
        // Search filter matches title or description
        const matchesSearch = e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.description?.toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchesSearch) return false;

        // If 'alert' is selected, show every event (Global Feed), otherwise filter by specific category
        if (selectedCategory === 'alert') return true;

        const categoryMap: Record<string, string[]> = {
            'schedule': ['schedule', 'escalas'],
            'fleet': ['fleet', 'frota'],
            'team': ['team', 'equipa', 'motoristas'],
            'general': ['general', 'geral']
        };

        const allowedSubCategories = categoryMap[selectedCategory as string] || [selectedCategory];
        return allowedSubCategories.includes(e.category);
    });

    const filteredThreads = operationalThreads.filter(t =>
        t.type === selectedCategory &&
        t.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputMessage.trim()) return;

        if (selectedCategory === 'general' && selectedUser) {
            sendLegacyMessage(inputMessage, selectedUser.id);
            setInputMessage('');
        } else if (selectedThread && myDbId) {
            await supabase.from('operation_messages').insert({
                thread_id: selectedThread.id,
                sender_id: myDbId,
                message: inputMessage,
                system_generated: false
            });
            setInputMessage('');
        }
    };

    const categories = [
        { id: 'alert', label: 'Alertas', icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10' },
        { id: 'schedule', label: 'Escalas', icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { id: 'fleet', label: 'Frota', icon: Truck, color: 'text-orange-500', bg: 'bg-orange-500/10' },
        { id: 'team', label: 'Equipa', icon: Users, color: 'text-purple-500', bg: 'bg-purple-500/10' },
        { id: 'general', label: 'Geral', icon: MessageSquare, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    ];

    return (
        <div className="flex flex-col h-full bg-[#0f172a] overflow-hidden">
            <div className="shrink-0 mb-4 flex justify-between items-center p-4 md:px-8">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Activity className="w-6 h-6 text-blue-500" />
                        Centro Operacional
                    </h1>
                </div>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 pb-4 px-4 text-white">
                {/* COLUMN 1: Categories */}
                <div className="lg:col-span-1 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto pb-2 lg:pb-0 scrollbar-hide">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => {
                                setSelectedCategory(cat.id as OperationCategory);
                                setSelectedThread(null);
                                setSelectedEvent(null);
                                setSelectedUser(null);
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

                {/* COLUMN 2: List */}
                <div className="lg:col-span-3 flex flex-col gap-3 h-full min-h-0">
                    <div className="shrink-0 bg-[#1e293b]/50 border border-slate-700/50 rounded-2xl p-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Procurar..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs text-white focus:border-blue-500/50 outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 bg-[#1e293b]/50 border border-slate-700/50 rounded-2xl p-2 overflow-y-auto custom-scrollbar space-y-2">
                        {/* Show Events First */}
                        {filteredEvents.map(event => (
                            <button
                                key={event.id}
                                onClick={() => { setSelectedEvent(event); setSelectedThread(null); }}
                                className={`w-full flex flex-col gap-1 p-3 rounded-xl transition-all border
                                ${selectedEvent?.id === event.id ? 'bg-blue-600/20 border-blue-500/50' : 'bg-slate-800/30 border-transparent hover:bg-slate-800/60'}`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <Bell className={`w-3 h-3 ${event.priority === 'critical' || event.priority === 'high' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`} />
                                        <span className="font-bold text-xs text-white truncate">{event.title}</span>
                                    </div>
                                    <span className={`text-[8px] px-1.5 rounded-full border ${event.priority === 'critical' ? 'bg-red-500/20 border-red-500/50 text-red-500' :
                                        event.priority === 'high' ? 'bg-orange-500/20 border-orange-500/50 text-orange-500' :
                                            'bg-slate-700 border-slate-600 text-slate-400'
                                        }`}>
                                        {event.priority}
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-400 line-clamp-2 text-left">{event.description}</p>
                            </button>
                        ))}

                        {/* Show Threads */}
                        {filteredThreads.map(thread => (
                            <button
                                key={thread.id}
                                onClick={() => { setSelectedThread(thread); setSelectedEvent(null); }}
                                className={`w-full flex flex-col gap-1 p-3 rounded-xl transition-all border
                                ${selectedThread?.id === thread.id ? 'bg-blue-600/10 border-blue-500/50' : 'bg-slate-800/20 border-transparent hover:bg-slate-800/40'}`}
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-xs text-slate-200">{thread.title}</span>
                                    <MessageSquare className="w-3 h-3 text-slate-500" />
                                </div>
                                <span className="text-[9px] text-slate-500">{new Date(thread.created_at).toLocaleString()}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* COLUMN 3: Content */}
                <div className="lg:col-span-8 h-full min-h-0 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-3 h-full min-h-0 bg-[#1e293b]/50 border border-slate-700/50 rounded-2xl overflow-hidden flex flex-col">
                        {selectedEvent ? (
                            <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-4">
                                <div className={`w-16 h-16 rounded-3xl flex items-center justify-center border shadow-2xl ${selectedEvent.priority === 'critical' ? 'bg-red-500/10 border-red-500/50 text-red-500' :
                                    'bg-blue-500/10 border-blue-500/50 text-blue-500'
                                    }`}>
                                    <Bell className="w-8 h-8" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white mb-2">{selectedEvent.title}</h2>
                                    <p className="text-slate-400 text-sm max-w-md">{selectedEvent.description}</p>
                                </div>
                                <div className="flex gap-4 text-xs font-bold uppercase tracking-widest text-slate-500">
                                    <span>Status: {selectedEvent.status}</span>
                                    <span>Prioridade: {selectedEvent.priority}</span>
                                </div>
                            </div>
                        ) : selectedThread ? (
                            <>
                                <div className="p-3 bg-slate-900/80 border-b border-slate-700/50 flex items-center gap-3">
                                    <MessageSquare className="w-4 h-4 text-blue-400" />
                                    <h2 className="text-sm font-bold">{selectedThread.title}</h2>
                                </div>
                                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-slate-950/20">
                                    {threadMessages.map(msg => (
                                        <div key={msg.id} className={`flex ${msg.sender_id === myDbId ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] p-3 rounded-2xl text-xs ${msg.sender_id === myDbId ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200 border border-slate-700'}`}>
                                                {msg.message}
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>
                                <form onSubmit={handleSend} className="p-3 bg-slate-900/80 border-t border-slate-700/50 flex gap-2">
                                    <input
                                        type="text"
                                        value={inputMessage}
                                        onChange={e => setInputMessage(e.target.value)}
                                        placeholder="Responder..."
                                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs outline-none focus:border-blue-500/50"
                                    />
                                    <button type="submit" className="bg-blue-600 p-2 rounded-xl hover:bg-blue-500 transition-colors">
                                        <Send className="w-4 h-4" />
                                    </button>
                                </form>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center opacity-30">
                                <Activity className="w-12 h-12 mb-4" />
                                <p className="font-bold">Selecione um evento ou tópico</p>
                            </div>
                        )}
                    </div>

                    <div className="h-full min-h-0 bg-[#1e293b]/30 border border-slate-700/50 rounded-2xl p-4 overflow-y-auto custom-scrollbar">
                        <h3 className="text-xs font-bold text-slate-500 uppercase mb-4">Painel de Contexto</h3>
                        {selectedEvent || selectedThread ? (
                            <div className="space-y-4 text-xs">
                                <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                                    <p className="text-slate-400 mb-1 font-medium">Relacionado com:</p>
                                    <p className="text-white font-bold">{selectedEvent?.title || selectedThread?.title}</p>
                                </div>
                                <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                                    <p className="text-slate-400 mb-1 font-medium">Data de Criação:</p>
                                    <p className="text-white">{new Date(selectedEvent?.created_at || selectedThread?.created_at || '').toLocaleString()}</p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-[10px] text-slate-600 italic">Nenhum item selecionado</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
