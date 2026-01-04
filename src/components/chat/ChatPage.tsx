import { useState, useEffect, useRef } from 'react';
import {
    MessageSquare, Send, User, ChevronLeft, Shield, Wrench,
    Search, Check, CheckCheck, MoreVertical, Phone, Video
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useChat } from '../../contexts/ChatContext';

export default function ChatPage() {
    const { userRole, currentUser } = useAuth();
    const { motoristas, supervisors, oficinaUsers } = useWorkshop();
    const { messages, sendMessage, markAsRead, getUnreadCountForUser } = useChat();

    const [selectedUser, setSelectedUser] = useState<{ id: string; name: string; role: string } | null>(null);
    const [inputMessage, setInputMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const myId = userRole === 'admin' ? 'admin' : currentUser?.id || 'unknown';

    // Build list of chat users
    const getChatUsers = () => {
        let users: { id: string; name: string; role: string }[] = [];
        const adminUser = { id: 'admin', name: 'Administrador', role: 'admin' };

        if (userRole === 'admin') {
            users = [
                ...supervisors.map(s => ({ id: s.id, name: s.nome, role: 'supervisor' })),
                ...oficinaUsers.map(o => ({ id: o.id, name: o.nome, role: 'oficina' })),
                ...motoristas.map(m => ({ id: m.id, name: m.nome, role: 'motorista' }))
            ];
        } else if (userRole === 'supervisor') {
            users = [
                adminUser,
                ...motoristas.map(m => ({ id: m.id, name: m.nome, role: 'motorista' }))
            ];
        } else if (userRole === 'oficina') {
            users = [adminUser];
        } else if (userRole === 'motorista') {
            users = [
                adminUser,
                ...supervisors.map(s => ({ id: s.id, name: s.nome, role: 'supervisor' }))
            ];
        }
        return users;
    };

    const chatUsers = getChatUsers().filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.role.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, selectedUser]);

    // Mark as read
    useEffect(() => {
        if (selectedUser) {
            markAsRead(selectedUser.id);
        }
    }, [selectedUser, messages]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputMessage.trim() || !selectedUser) return;
        sendMessage(inputMessage, selectedUser.id);
        setInputMessage('');
    };

    const currentMessages = selectedUser
        ? messages.filter(m =>
            (m.senderId === myId && m.receiverId === selectedUser.id) ||
            (m.senderId === selectedUser.id && m.receiverId === myId)
        )
        : [];

    return (
        <div className="max-w-[1920px] mx-auto p-4 md:p-8 font-sans h-[calc(100dvh-80px)] md:h-[calc(100vh-100px)]">

            {/* Header */}
            <div className={`mb-6 flex justify-between items-center ${selectedUser ? 'hidden md:flex' : ''}`}>
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center border border-blue-600/20">
                            <MessageSquare className="w-6 h-6 text-blue-500" />
                        </div>
                        Central de Mensagens
                    </h1>
                    <p className="text-slate-400">Comunicação direta com a equipa</p>
                </div>
            </div>

            {/* Layout Grid - Full Height */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full pb-0 md:pb-8">

                {/* Sidebar - Contacts List (4 cols) */}
                <div className={`lg:col-span-4 flex flex-col gap-4 h-full ${selectedUser ? 'hidden lg:flex' : 'flex'}`}>
                    {/* Search and Stats */}
                    <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 flex flex-col gap-4">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Procurar contacto..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white focus:border-blue-500/50 outline-none"
                            />
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            <span className="bg-blue-600 px-3 py-1 rounded-full text-xs font-bold text-white whitespace-nowrap">
                                Todos ({chatUsers.length})
                            </span>
                            <span className="bg-slate-800 px-3 py-1 rounded-full text-xs font-bold text-slate-400 border border-slate-700 whitespace-nowrap">
                                Motoristas
                            </span>
                            <span className="bg-slate-800 px-3 py-1 rounded-full text-xs font-bold text-slate-400 border border-slate-700 whitespace-nowrap">
                                Oficina
                            </span>
                        </div>
                    </div>

                    {/* Users List */}
                    <div className="flex-1 bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-4 overflow-y-auto custom-scrollbar space-y-2">
                        {chatUsers.map(user => {
                            const unread = getUnreadCountForUser(user.id);
                            const isSelected = selectedUser?.id === user.id;

                            return (
                                <button
                                    key={user.id}
                                    onClick={() => setSelectedUser(user)}
                                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all border group
                                    ${isSelected
                                            ? 'bg-blue-600/10 border-blue-500/50 shadow-lg shadow-blue-900/20'
                                            : 'bg-slate-800/20 border-transparent hover:bg-slate-800/60 hover:border-slate-700'}`}
                                >
                                    <div className="relative">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 
                                            ${user.role === 'admin' ? 'bg-blue-500/10 border-blue-500 text-blue-400' :
                                                user.role === 'supervisor' ? 'bg-purple-500/10 border-purple-500 text-purple-400' :
                                                    user.role === 'oficina' ? 'bg-orange-500/10 border-orange-500 text-orange-400' :
                                                        'bg-emerald-500/10 border-emerald-500 text-emerald-400'}
                                        `}>
                                            {user.role === 'admin' ? <Shield className="w-6 h-6" /> :
                                                user.role === 'oficina' ? <Wrench className="w-6 h-6" /> :
                                                    <User className="w-6 h-6" />}
                                        </div>
                                        {/* Create a fake online status indicator */}
                                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#1e293b] rounded-full"></div>
                                    </div>

                                    <div className="flex-1 text-left">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className={`font-bold ${isSelected ? 'text-white' : 'text-slate-200'} text-sm`}>{user.name}</span>
                                            {unread > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">{unread}</span>}
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{user.role}</span>
                                            <span className="text-[10px] text-slate-600">Agora</span>
                                        </div>
                                    </div>
                                    <ChevronLeft className={`w-5 h-5 text-slate-500 transition-transform ${isSelected ? 'rotate-180 text-blue-400' : 'rotate-180 lg:rotate-0'}`} />
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Main Content - Chat Window (8 cols) */}
                <div className={`lg:col-span-8 h-full bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl overflow-hidden flex flex-col shadow-2xl relative ${!selectedUser ? 'hidden lg:flex' : 'flex'}`}>
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none"></div>

                    {selectedUser ? (
                        <>
                            {/* Chat Header */}
                            <div className="bg-slate-900/80 backdrop-blur-md p-4 md:p-6 border-b border-slate-700/50 flex justify-between items-center z-10 sticky top-0">
                                <div className="flex items-center gap-3 md:gap-4">
                                    {/* Mobile Back Button */}
                                    <button
                                        onClick={() => setSelectedUser(null)}
                                        className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-white"
                                    >
                                        <ChevronLeft className="w-6 h-6" />
                                    </button>

                                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center border-2 
                                        ${selectedUser.role === 'admin' ? 'bg-blue-500/10 border-blue-500 text-blue-400' :
                                            selectedUser.role === 'supervisor' ? 'bg-purple-500/10 border-purple-500 text-purple-400' :
                                                selectedUser.role === 'oficina' ? 'bg-orange-500/10 border-orange-500 text-orange-400' :
                                                    'bg-emerald-500/10 border-emerald-500 text-emerald-400'}
                                    `}>
                                        <span className="font-bold text-lg">{selectedUser.name.charAt(0)}</span>
                                    </div>
                                    <div>
                                        <h2 className="text-base md:text-xl font-bold text-white">{selectedUser.name}</h2>
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                            <span className="text-[10px] md:text-xs text-emerald-400 font-bold uppercase">Online agora</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 md:gap-2">
                                    <button className="p-2 md:p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors border border-slate-700">
                                        <Phone className="w-4 h-4 md:w-5 md:h-5" />
                                    </button>
                                    <button className="p-2 md:p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors border border-slate-700">
                                        <Video className="w-4 h-4 md:w-5 md:h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Messages Area */}
                            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar bg-slate-950/30">
                                {currentMessages.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                                        <MessageSquare className="w-16 h-16 mb-4" />
                                        <p>Inicie a conversa com {selectedUser.name}</p>
                                    </div>
                                ) : (
                                    currentMessages.map(msg => (
                                        <div
                                            key={msg.id}
                                            className={`flex ${msg.senderId === myId ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}
                                        >
                                            <div className={`max-w-[85%] md:max-w-[70%] p-3 md:p-4 rounded-2xl shadow-md ${msg.senderId === myId
                                                ? 'bg-blue-600 text-white rounded-br-none'
                                                : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                                                }`}>
                                                <p className="text-sm md:text-base leading-relaxed">{msg.content}</p>
                                                <div className="flex items-center justify-end gap-1 mt-1 opacity-70">
                                                    <span className="text-[10px]">
                                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    {msg.senderId === myId && (
                                                        msg.read ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input Area */}
                            <div className="p-4 md:p-6 bg-slate-900/80 backdrop-blur-md border-t border-slate-700/50 pb-6 md:pb-8">
                                <form onSubmit={handleSend} className="flex gap-2 md:gap-4 max-w-5xl mx-auto">
                                    <div className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl flex items-center p-1 focus-within:ring-2 focus-within:ring-blue-500/50 transition-all">
                                        <input
                                            type="text"
                                            value={inputMessage}
                                            onChange={(e) => setInputMessage(e.target.value)}
                                            placeholder="Escreva..."
                                            className="flex-1 bg-transparent px-4 py-3 text-white outline-none placeholder:text-slate-600"
                                            autoFocus
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={!inputMessage.trim()}
                                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white p-3 md:p-4 rounded-2xl transition-all shadow-lg hover:shadow-blue-600/20 active:scale-95 flex items-center gap-2 font-bold"
                                    >
                                        <span className="hidden md:inline">Enviar</span>
                                        <Send className="w-5 h-5" />
                                    </button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8">
                            <div className="w-32 h-32 bg-slate-800/50 rounded-full flex items-center justify-center mb-6 animate-pulse">
                                <MessageSquare className="w-16 h-16 text-slate-600" />
                            </div>
                            <h2 className="text-3xl font-bold text-white mb-2">Selecione uma conversa</h2>
                            <p className="text-slate-400 max-w-md">
                                Escolha um contacto da lista à esquerda para iniciar um chat ou continuar uma conversa existente.
                            </p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
