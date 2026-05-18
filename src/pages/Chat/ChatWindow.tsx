import React, { useEffect, useRef, useMemo } from 'react';
import { ChevronLeft, Send, Phone, Video, AlertCircle, MessageCircle } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import type { Conversation } from '../../types';

interface ChatWindowProps {
    conversation: Conversation | null;
    onBack?: () => void;
    onSendMessage: (content: string) => void;
    isLoading?: boolean;
}

export default function ChatWindow({
    conversation,
    onBack,
    onSendMessage,
    isLoading = false,
}: ChatWindowProps) {
    const { getConversationMessages, markAsRead } = useChat();
    const [inputMessage, setInputMessage] = React.useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const conversationMessages = useMemo(() => {
        if (!conversation) return [];
        return getConversationMessages(conversation.participantId);
    }, [conversation, getConversationMessages]);

    // Auto scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversationMessages]);

    // Mark messages as read
    useEffect(() => {
        if (conversation) {
            markAsRead(conversation.participantId);
        }
    }, [conversation, markAsRead]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputMessage.trim() || !conversation) return;
        onSendMessage(inputMessage);
        setInputMessage('');
    };

    const getMessageTypeStyles = (type?: string) => {
        switch (type) {
            case 'alerta':
                return 'bg-orange-600/20 border border-orange-500/40 ring-1 ring-orange-500/20';
            case 'operacional':
                return 'bg-blue-600/20 border border-blue-500/40 ring-1 ring-blue-500/20';
            case 'sistema':
                return 'bg-slate-700/30 border border-slate-300/40 italic text-slate-300';
            default:
                return '';
        }
    };

    const getMessageTypeIcon = (type?: string) => {
        switch (type) {
            case 'alerta':
                return <AlertCircle className="w-3.5 h-3.5 text-orange-400" />;
            case 'operacional':
                return <span className="text-sm font-bold">⚙️</span>;
            case 'sistema':
                return <span className="text-sm">🤖</span>;
            default:
                return null;
        }
    };

    const formatTime = (timestamp: string) => {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (!conversation) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4 animate-pulse">
                    <MessageCircle className="w-10 h-10 text-slate-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Selecione uma conversa</h2>
                <p className="text-slate-400 text-sm max-w-xs">
                    Escolha um contacto da lista para iniciar um chat.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-slate-950/30 to-slate-950/10 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none"></div>

            {/* Chat Header */}
            <div className="shrink-0 bg-white/90/80 backdrop-blur-md p-4 border-b border-slate-200/50 flex justify-between items-center z-10">
                <div className="flex items-center gap-3">
                    {/* Mobile Back Button */}
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="lg:hidden p-1.5 -ml-1 text-slate-400 hover:text-slate-900 transition-colors"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                    )}

                    {/* Avatar */}
                    <div className="avatar-3d w-10 h-10 rounded-full flex items-center justify-center border-2 font-semibold
                        bg-emerald-500/10 border-emerald-500 text-emerald-400">
                        {conversation.participantName.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div>
                        <h2 className="text-base font-bold text-slate-900 leading-tight">
                            {conversation.participantName}
                        </h2>
                        <div className="flex items-center gap-1.5">
                            {conversation.isOnline ? (
                                <>
                                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                    <span className="text-[11px] text-emerald-400 font-bold uppercase">Online</span>
                                </>
                            ) : (
                                <>
                                    <span className="w-2 h-2 bg-slate-600 rounded-full"></span>
                                    <span className="text-[11px] text-slate-500 uppercase">
                                        Offline
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                    <button className="p-2 bg-slate-100 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-900 transition-colors border border-slate-200/50 hover:border-slate-300">
                        <Phone className="w-4 h-4" />
                    </button>
                    <button className="p-2 bg-slate-100 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-900 transition-colors border border-slate-200/50 hover:border-slate-300">
                        <Video className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {conversationMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                        <MessageCircle className="w-12 h-12 mb-3" />
                        <p className="text-sm">Comece a conversa com {conversation.participantName}</p>
                    </div>
                ) : (
                    <>
                        {conversationMessages.map((msg) => {
                            const isOwn = msg.senderId !== conversation.participantId;
                            const typeStyles = getMessageTypeStyles(msg.type);

                            return (
                                <div
                                    key={msg.id}
                                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}
                                >
                                    <div className={`max-w-[85%] md:max-w-[70%] relative group`}>
                                        {/* Message bubble */}
                                        <div className={`p-3 rounded-2xl shadow-md transition-all ${
                                            isOwn
                                                ? 'bg-blue-600 text-white rounded-br-none'
                                                : `bg-slate-100 text-slate-100 rounded-bl-none border border-slate-200 ${typeStyles}`
                                        }`}>
                                            {/* Message type badge for special messages */}
                                            {msg.type && msg.type !== 'normal' && (
                                                <div className="flex items-center gap-1.5 mb-1 text-[11px] font-bold uppercase opacity-75">
                                                    {getMessageTypeIcon(msg.type)}
                                                    <span>{msg.type}</span>
                                                </div>
                                            )}

                                            <p className="text-sm leading-relaxed break-words">
                                                {msg.content}
                                            </p>

                                            {/* Timestamp and Read Status */}
                                            <div className={`flex items-center justify-end gap-1 mt-1.5 opacity-70 text-xs`}>
                                                <span>{formatTime(msg.timestamp)}</span>
                                                {isOwn && (
                                                    <span className="text-[10px] font-bold">
                                                        {msg.read ? '✓✓' : '✓'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Input Area */}
            <div className="shrink-0 p-4 bg-white/90/80 backdrop-blur-md border-t border-slate-200/50 relative z-10">
                <form onSubmit={handleSend} className="w-full min-w-0 flex gap-2">
                    <div className="flex-1 bg-white/90 border border-slate-200 rounded-xl flex items-center p-1 focus-within:ring-2 focus-within:ring-blue-500/50 transition-all">
                        <input
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            placeholder="Escreva..."
                            className="flex-1 bg-transparent px-3 py-2 text-white text-sm outline-none placeholder:text-slate-600"
                            autoFocus
                            disabled={isLoading}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!inputMessage.trim() || isLoading}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-all shadow-lg hover:shadow-blue-600/20 active:scale-95 flex items-center gap-2 font-bold"
                    >
                        <span className="hidden md:inline text-sm">Enviar</span>
                        <Send className="w-4 h-4" />
                    </button>
                </form>
            </div>
        </div>
    );
}
