import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, User, ChevronLeft, Shield, Wrench } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useChat } from '../../contexts/ChatContext';

export default function ChatWidget() {
    const { userRole, currentUser } = useAuth();
    const { motoristas, supervisors, oficinaUsers } = useWorkshop();
    const { messages, sendMessage, markAsRead, getUnreadCountForUser } = useChat();

    const [isOpen, setIsOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<{ id: string; name: string; role: string } | null>(null);
    const [inputMessage, setInputMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const myId = userRole === 'admin' ? 'admin' : currentUser?.id || 'unknown';

    // Build list of chat users based on permissions
    const getChatUsers = () => {
        let users: { id: string; name: string; role: string }[] = [];

        // Admin defaults
        const adminUser = { id: 'admin', name: 'Administrador', role: 'admin' };

        if (userRole === 'admin') {
            // Admin sees everyone
            users = [
                ...supervisors.map(s => ({ id: s.id, name: s.nome, role: 'supervisor' })),
                ...oficinaUsers.map(o => ({ id: o.id, name: o.nome, role: 'oficina' })),
                ...motoristas.map(m => ({ id: m.id, name: m.nome, role: 'motorista' }))
            ];
        } else if (userRole === 'supervisor') {
            // Supervisor sees Admin + Motoristas
            users = [
                adminUser,
                ...motoristas.map(m => ({ id: m.id, name: m.nome, role: 'motorista' }))
            ];
        } else if (userRole === 'oficina') {
            // Oficina sees Admin
            users = [adminUser];
        } else if (userRole === 'motorista') {
            // Motorista sees Admin + Supervisors
            users = [
                adminUser,
                ...supervisors.map(s => ({ id: s.id, name: s.nome, role: 'supervisor' }))
            ];
        }

        // Add 'role' label for display if needed, but the structure above handles it
        return users;
    };

    const chatUsers = getChatUsers();

    // Scroll to bottom of chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, selectedUser, isOpen]);

    // Mark as read when opening a chat
    useEffect(() => {
        if (isOpen && selectedUser) {
            markAsRead(selectedUser.id);
        }
    }, [selectedUser, isOpen, messages]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputMessage.trim() || !selectedUser) return;

        sendMessage(inputMessage, selectedUser.id);
        setInputMessage('');
    };

    // Filter messages for current view
    const currentMessages = selectedUser
        ? messages.filter(m =>
            (m.senderId === myId && m.receiverId === selectedUser.id) ||
            (m.senderId === selectedUser.id && m.receiverId === myId)
        )
        : [];

    if (!userRole) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
            {/* Chat Window */}
            {isOpen && (
                <div className="mb-4 w-96 h-[500px] bg-[#1e293b] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto">
                    {/* Header */}
                    <div className="bg-slate-900/50 p-4 border-b border-slate-700 flex items-center justify-between">
                        {selectedUser ? (
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setSelectedUser(null)}
                                    className="p-1 hover:bg-slate-800 rounded-full transition-colors mr-1"
                                >
                                    <ChevronLeft className="w-5 h-5 text-slate-400" />
                                </button>
                                <div className="flex flex-col">
                                    <h3 className="font-bold text-white text-sm">{selectedUser.name}</h3>
                                    <span className="text-[10px] text-slate-400 uppercase">{selectedUser.role}</span>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <h3 className="font-bold text-white">Mensagens</h3>
                                <p className="text-xs text-slate-400">Comunicação Interna</p>
                            </div>
                        )}
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto bg-[#0f172a] p-4 custom-scrollbar">
                        {!selectedUser ? (
                            // User List
                            <div className="space-y-2">
                                {chatUsers.length === 0 ? (
                                    <p className="text-center text-slate-500 text-sm mt-10">Não existem contactos disponíveis.</p>
                                ) : (
                                    chatUsers.map(user => {
                                        const unread = getUnreadCountForUser(user.id);
                                        return (
                                            <button
                                                key={user.id}
                                                onClick={() => setSelectedUser(user)}
                                                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/50 transition-all border border-transparent hover:border-slate-700 group"
                                            >
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border
                                                    ${user.role === 'admin' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                                                        user.role === 'supervisor' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' :
                                                            user.role === 'oficina' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' :
                                                                'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}
                                                `}>
                                                    {user.role === 'admin' && <Shield className="w-5 h-5" />}
                                                    {user.role === 'supervisor' && <Shield className="w-5 h-5" />}
                                                    {user.role === 'oficina' && <Wrench className="w-5 h-5" />}
                                                    {user.role === 'motorista' && <User className="w-5 h-5" />}
                                                </div>
                                                <div className="flex-1 text-left">
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-medium text-slate-200 text-sm">{user.name}</span>
                                                        {unread > 0 && (
                                                            <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                                {unread}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-slate-500 uppercase">{user.role}</span>
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        ) : (
                            // Chat Area
                            <div className="space-y-4">
                                {currentMessages.length === 0 ? (
                                    <div className="text-center py-8">
                                        <p className="text-slate-500 text-xs">Inicie a conversa com {selectedUser.name}</p>
                                    </div>
                                ) : (
                                    currentMessages.map(msg => (
                                        <div
                                            key={msg.id}
                                            className={`flex ${msg.senderId === myId ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.senderId === myId
                                                ? 'bg-blue-600 text-white rounded-br-none'
                                                : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                                                }`}>
                                                <p>{msg.content}</p>
                                                <p className={`text-[10px] mt-1 text-right ${msg.senderId === myId ? 'text-blue-200' : 'text-slate-500'}`}>
                                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    {selectedUser && (
                        <form onSubmit={handleSend} className="p-4 bg-slate-900/50 border-t border-slate-700 flex gap-2">
                            <input
                                type="text"
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                placeholder="Escreva uma mensagem..."
                                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                            <button
                                type="submit"
                                disabled={!inputMessage.trim()}
                                className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </form>
                    )}
                </div>
            )}

            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="pointer-events-auto p-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg shadow-blue-600/30 transition-all hover:scale-110 active:scale-95 group relative"
            >
                {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
            </button>
        </div>
    );
}
