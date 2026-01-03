import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import type { Message } from '../types';

interface ChatContextType {
    messages: Message[];
    sendMessage: (content: string, receiverId: string) => void;
    markAsRead: (senderId: string) => void;
    unreadCount: number;
    getUnreadCountForUser: (userId: string) => number;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
    const { userRole, currentUser } = useAuth();
    // Helper for safe initialization
    const safeInit = <T,>(key: string, defaultVal: T): T => {
        try {
            const stored = localStorage.getItem(key);
            if (!stored) return defaultVal;
            const parsed = JSON.parse(stored);
            return Array.isArray(parsed) ? (parsed as T) : defaultVal;
        } catch (error) {
            console.error(`Error loading ${key} from localStorage`, error);
            return defaultVal;
        }
    };

    const [messages, setMessages] = useState<Message[]>(() => safeInit('chat_messages', []));

    useEffect(() => {
        localStorage.setItem('chat_messages', JSON.stringify(messages));
    }, [messages]);

    // Cross-tab sync
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'chat_messages' && e.newValue) {
                try {
                    setMessages(JSON.parse(e.newValue));
                } catch (err) {
                    console.error('Error syncing messages', err);
                }
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const myId = userRole === 'admin' ? 'admin' : currentUser?.id || 'unknown';

    const sendMessage = (content: string, receiverId: string) => {
        const newMessage: Message = {
            id: crypto.randomUUID(),
            senderId: myId,
            receiverId: receiverId,
            content,
            timestamp: new Date().toISOString(),
            read: false
        };
        setMessages(prev => [...prev, newMessage]);
    };

    const markAsRead = (senderId: string) => {
        setMessages(prev => prev.map(msg =>
            (msg.senderId === senderId && msg.receiverId === myId && !msg.read)
                ? { ...msg, read: true }
                : msg
        ));
    };

    const unreadCount = messages.filter(m => m.receiverId === myId && !m.read).length;

    const getUnreadCountForUser = (userId: string) => {
        return messages.filter(m => m.senderId === userId && m.receiverId === myId && !m.read).length;
    };

    return (
        <ChatContext.Provider value={{ messages, sendMessage, markAsRead, unreadCount, getUnreadCountForUser }}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChat() {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
}
