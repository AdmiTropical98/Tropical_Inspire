import { useState, useEffect } from 'react';
import { MessageSquare, Bell } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useChat } from '../../contexts/ChatContext';
import ConversationList from './ConversationList';
import ChatWindow from './ChatWindow';
import QuickActionsPanel from './QuickActionsPanel';
import QuickShortcuts from './QuickShortcuts';

export default function ChatPage() {
    const { userRole } = useAuth();
    const { motoristas, supervisors, oficinaUsers } = useWorkshop();
    const {
        sendMessage,
        conversations,
        currentConversationId,
        setCurrentConversationId,
        getConversationMessages,
        sendQuickAction,
        unreadCount,
        markAsRead,
    } = useChat();

    const [searchTerm, setSearchTerm] = useState('');
    const [showMobileChat, setShowMobileChat] = useState(false);
    const [shortcutsExpanded, setShortcutsExpanded] = useState(true);
    const [actionsCollapsed, setActionsCollapsed] = useState(false);

    // Get current conversation
    const currentConversation = conversations.find(c => c.participantId === currentConversationId) || null;

    // Handle sending message
    const handleSendMessage = (content: string) => {
        if (currentConversationId) {
            sendMessage(content, currentConversationId);
        }
    };

    // Handle quick action
    const handleQuickAction = (type: 'location' | 'service' | 'presence' | 'alert', data?: any) => {
        if (currentConversationId) {
            sendQuickAction(currentConversationId, type, data);
        }
    };

    // Handle conversation select
    const handleSelectConversation = (conversationId: string) => {
        setCurrentConversationId(conversationId);
        setShowMobileChat(true);
        markAsRead(conversationId);
    };

    // Handle back on mobile
    const handleMobileBack = () => {
        setShowMobileChat(false);
        setCurrentConversationId(null);
    };

    return (
        <div className="flex flex-col h-full bg-[#0f172a] overflow-hidden">
            {/* Header */}
            <div className={`shrink-0 mb-4 flex justify-between items-center p-4 md:px-8 ${showMobileChat ? 'hidden md:flex' : ''}`}>
                <div className="flex-1">
                    <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 flex items-center gap-3">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-blue-600/10 flex items-center justify-center border border-blue-600/20">
                            <MessageSquare className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
                        </div>
                        Central de Mensagens
                    </h1>
                    <p className="text-slate-400 text-xs md:text-sm">Comunicação operacional em tempo real</p>
                </div>
                
                {/* Unread Badge */}
                {unreadCount > 0 && (
                    <div className="relative">
                        <Bell className="w-6 h-6 text-slate-400" />
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse min-w-fit">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    </div>
                )}
            </div>

            {/* Main Layout - Flex Container */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 pb-2 md:pb-4 px-4 md:px-0 auto-rows-fr">

                {/* LEFT SIDEBAR - Conversation List (4 cols) */}
                <div className={`lg:col-span-4 flex flex-col gap-3 h-full min-h-0 ${
                    showMobileChat ? 'hidden lg:flex' : 'flex'
                }`}>
                    <ConversationList
                        selectedConversationId={currentConversationId}
                        onSelectConversation={handleSelectConversation}
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                    />
                </div>

                {/* CENTER - Chat Window (6 cols on desktop, full width on mobile) */}
                <div className={`lg:col-span-6 h-full min-h-0 bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl overflow-hidden flex flex-col shadow-2xl ${
                    showMobileChat ? 'flex' : 'hidden lg:flex'
                }`}>
                    <ChatWindow
                        conversation={currentConversation}
                        onBack={handleMobileBack}
                        onSendMessage={handleSendMessage}
                    />

                    {/* Quick Shortcuts - shown above input on mobile, below on desktop */}
                    {currentConversation && (
                        <div className="shrink-0 px-4 pb-3 pt-2 bg-slate-900/80 backdrop-blur-md border-t border-slate-700/50">
                            <QuickShortcuts
                                onShortcutClick={handleQuickAction}
                                isExpanded={shortcutsExpanded}
                                onToggleExpand={setShortcutsExpanded}
                            />
                        </div>
                    )}
                </div>

                {/* RIGHT SIDEBAR - Quick Actions Panel (2 cols on desktop, hidden on mobile) */}
                <QuickActionsPanel
                    conversation={currentConversation}
                    isCollapsed={actionsCollapsed}
                    onToggleCollapse={setActionsCollapsed}
                />
            </div>
        </div>
    );
}
