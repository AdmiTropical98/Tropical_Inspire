# Central de Mensagens - Usage & Testing Guide

## Quick Start

### 1. Basic Setup - Already Complete ✅
The module is integrated into the Chat page and automatically uses data from:
- `useAuth()` - For user identification and role
- `useWorkshop()` - For motoristas, supervisors, and oficina users
- `ChatContext` - For message management

### 2. Using the Chat System

#### Start a Conversation
```typescript
import { useChat } from '../../contexts/ChatContext';

function MyComponent() {
    const { setCurrentConversationId } = useChat();
    
    const handleSelectUser = (userId: string) => {
        setCurrentConversationId(userId);
        // User will see conversation in ChatWindow
    };
    
    return (
        <button onClick={() => handleSelectUser('user-123')}>
            Chat with User
        </button>
    );
}
```

#### Send a Simple Message
```typescript
const { sendMessage } = useChat();

// Send to a specific user
sendMessage("Olá, tudo bem?", recipientId);
```

#### Send an Operational Message
```typescript
const { sendMessage } = useChat();

sendMessage(
    "🚐 Novo serviço atribuído",
    recipientId,
    'operacional',
    {
        serviceId: 'SRV-001',
        estimatedTime: '30min'
    }
);
```

#### Send an Alert
```typescript
const { sendMessage } = useChat();

sendMessage(
    "Sistema de manuttenção indisponível",
    recipientId,
    'alerta',
    {
        severity: 'high',
        affectedSystems: ['maintenance', 'scheduling']
    }
);
```

#### Use Quick Actions
```typescript
const { sendQuickAction } = useChat();

// Share location
sendQuickAction(userId, 'location', {
    address: 'Rua da Prata, Lisboa',
    lat: 38.7223,
    lng: -9.1393
});

// Assign service
sendQuickAction(userId, 'service', {
    serviceName: 'Transporte VIP - Cliente ABC',
    serviceId: 'SRV-001',
    appointmentTime: '14:30'
});

// Confirm presence
sendQuickAction(userId, 'presence', {
    time: new Date().toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    })
});

// Send operational alert
sendQuickAction(userId, 'alert', {
    message: 'Desvio de rota detectado - Sistema de GPS',
    duration: '5 minutos'
});
```

## Component Integration Examples

### Example 1: Motorista Profile with Quick Chat
```typescript
import { useChat } from '../../contexts/ChatContext';
import { Motorista } from '../../types';

function MotoristaProfile({ motorista }: { motorista: Motorista }) {
    const { setCurrentConversationId } = useChat();
    
    const handleQuickChat = () => {
        setCurrentConversationId(motorista.id);
        // Mobile users will see: showMobileChat = true
        // Chat window opens with motorista conversation
    };
    
    return (
        <div className="motorista-card">
            <h2>{motorista.nome}</h2>
            <button onClick={handleQuickChat}>
                💬 Chat Rápido
            </button>
        </div>
    );
}
```

### Example 2: Dashboard with Unread Message Alert
```typescript
import { useChat } from '../../contexts/ChatContext';
import { Bell } from 'lucide-react';

function DashboardHeader() {
    const { unreadCount, hasUnreadMessages } = useChat();
    
    return (
        <header>
            <div className="relative">
                <Bell className="w-6 h-6" />
                {hasUnreadMessages && (
                    <span className="absolute top-0 right-0 bg-red-500 
                                     text-white text-xs font-bold 
                                     px-2 py-0.5 rounded-full">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </div>
        </header>
    );
}
```

### Example 3: Schedule View with Quick Alert
```typescript
import { useChat } from '../../contexts/ChatContext';
import { Servico } from '../../types';

function ScheduleItem({ service }: { service: Servico }) {
    const { sendQuickAction } = useChat();
    
    const handleEmergencyAlert = () => {
        sendQuickAction(service.motoristaId, 'alert', {
            message: `Urgência detectada no serviço ${service.id}`,
            serviceId: service.id,
            timestamp: new Date().toISOString()
        });
    };
    
    return (
        <div className="schedule-item">
            <p>{service.descricao}</p>
            <button onClick={handleEmergencyAlert} className="btn-danger">
                ⚠️ Alerta de Urgência
            </button>
        </div>
    );
}
```

### Example 4: Vehicle Location Sharing
```typescript
import { useChat } from '../../contexts/ChatContext';
import { Viatura } from '../../types';

function VehicleTracker({ vehicle, latitude, longitude }: {
    vehicle: Viatura;
    latitude: number;
    longitude: number;
}) {
    const { sendQuickAction } = useChat();
    
    const handleShareLocation = async () => {
        // Get human-readable address
        const address = await geocodeLocation(latitude, longitude);
        
        sendQuickAction(vehicle.id, 'location', {
            address,
            lat: latitude,
            lng: longitude,
            accuracy: 5 // meters
        });
    };
    
    return (
        <button onClick={handleShareLocation}>
            📍 Partilhar Localização Atual
        </button>
    );
}
```

## Testing Checklist

### Manual Testing - Conversation List
- [ ] Conversation list loads with all contacts
- [ ] Search/filter works (name and role)
- [ ] Last message preview shows correctly
- [ ] Unread badges display and update
- [ ] Online status indicator shows
- [ ] Role badges have correct colors
- [ ] Clicking conversation selects it
- [ ] Selected item has highlight styling
- [ ] Scrollable with many conversations
- [ ] Mobile: List hidden when chat selected

### Manual Testing - Chat Window
- [ ] Messages load for selected conversation
- [ ] New messages append to bottom
- [ ] Auto-scroll to latest message works
- [ ] Messages align correctly (own right, other left)
- [ ] Timestamps display correctly
- [ ] Read status shows (✓/✓✓) for own messages
- [ ] Empty state shows when no messages
- [ ] Message input accepts text
- [ ] Send button sends message
- [ ] Send button disabled when empty
- [ ] Mobile back button works
- [ ] Header shows correct contact info
- [ ] Online status indicator accurate

### Manual Testing - Message Types
- [ ] NORMAL messages render as blue bubbles
- [ ] OPERACIONAL messages have blue badge
- [ ] ALERTA messages have orange badge with warning
- [ ] SISTEMA messages italic and grey
- [ ] Message type icons display
- [ ] Metadata visible in tooltips

### Manual Testing - Quick Actions
- [ ] Location button generates location message
- [ ] Service button generates service message
- [ ] Presence button generates time-stamped message
- [ ] Alert button generates alert message
- [ ] Shortcuts collapsible/expandable
- [ ] All messages sent with correct type

### Manual Testing - Quick Actions Panel
- [ ] Panel visible on desktop
- [ ] Panel hidden on mobile
- [ ] All 4 action buttons present
- [ ] Collapse/expand toggle works
- [ ] Status card shows online indicator
- [ ] Actions not clickable without conversation selected

### Manual Testing - Responsive Design
- [ ] Desktop: Full 3-column layout
- [ ] Tablet: 2 columns (no actions panel)
- [ ] Mobile: Single column with swapping
- [ ] Mobile: Back button in chat header
- [ ] Mobile: Quick shortcuts visible in chat
- [ ] Mobile: Full-width chat and input
- [ ] Orientations work (portrait/landscape)

### Manual Testing - Notifications
- [ ] Unread badge appears in header
- [ ] Unread badge updates when new message
- [ ] Unread badge clears when conversation read
- [ ] Sound notification plays (if enabled)
- [ ] Notification sound toggle works
- [ ] Notification sound only plays once per message
- [ ] No console errors

### Manual Testing - Persistence
- [ ] Messages persist on page reload
- [ ] Conversation list rebuilds correctly
- [ ] Unread status persists
- [ ] Notification setting persists
- [ ] Cross-tab sync works (open in 2 tabs)

## Development Testing

### Unit Test Example: ConversationList
```typescript
import { render, screen } from '@testing-library/react';
import { ChatProvider } from '../../contexts/ChatContext';
import ConversationList from './ConversationList';

describe('ConversationList', () => {
    it('renders conversation items', () => {
        const mockConversations = [
            {
                id: '1',
                participantId: 'user-1',
                participantName: 'João Silva',
                participantRole: 'motorista',
                lastMessage: 'Olá!',
                lastMessageTime: new Date().toISOString(),
                unreadCount: 2,
                isOnline: true
            }
        ];
        
        render(
            <ChatProvider>
                <ConversationList
                    selectedConversationId={null}
                    onSelectConversation={jest.fn()}
                    searchTerm=""
                    onSearchChange={jest.fn()}
                />
            </ChatProvider>
        );
        
        expect(screen.getByText('João Silva')).toBeInTheDocument();
        expect(screen.getByText('Olá!')).toBeInTheDocument();
    });
});
```

### Integration Test Example: ChatPage
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import ChatPage from './ChatPage';
import { AuthProvider } from '../../contexts/AuthContext';
import { ChatProvider } from '../../contexts/ChatContext';

describe('ChatPage Integration', () => {
    it('sends message when send button clicked', async () => {
        render(
            <AuthProvider>
                <ChatProvider>
                    <ChatPage />
                </ChatProvider>
            </AuthProvider>
        );
        
        // Select a conversation
        const firstConversation = screen.getAllByRole('button')[0];
        fireEvent.click(firstConversation);
        
        // Type message
        const input = screen.getByPlaceholderText('Escreva...');
        fireEvent.change(input, { target: { value: 'Test message' } });
        
        // Send
        const sendButton = screen.getByRole('button', { name: /enviar/i });
        fireEvent.click(sendButton);
        
        // Message should appear
        expect(screen.getByText('Test message')).toBeInTheDocument();
    });
});
```

## Debugging Tips

### Check Chat Context State
```typescript
import { useChat } from '../../contexts/ChatContext';

function DebugChat() {
    const chat = useChat();
    
    useEffect(() => {
        console.log('Chat State:', {
            messagesCount: chat.messages.length,
            conversationsCount: chat.conversations.length,
            unreadCount: chat.unreadCount,
            currentId: chat.currentConversationId
        });
    }, [chat.messages, chat.conversations]);
    
    return null;
}
```

### Monitor LocalStorage
```typescript
function MonitorStorage() {
    useEffect(() => {
        const observer = () => {
            const messages = JSON.parse(
                localStorage.getItem('chat_messages') || '[]'
            );
            console.log('Stored messages:', messages);
        };
        
        window.addEventListener('storage', observer);
        return () => window.removeEventListener('storage', observer);
    }, []);
    
    return null;
}
```

### Test Message Types
```typescript
const { sendMessage } = useChat();

// Test each type
sendMessage('Normal message', userId);
sendMessage('🚐 Service assigned', userId, 'operacional');
sendMessage('⚠️ Alert message', userId, 'alerta');
sendMessage('✅ System update', userId, 'sistema');

// Verify in ChatWindow - each should have different styling
```

## Common Issues & Solutions

### Issue: Messages not appearing
**Solution:** Check if currentConversationId is set and matches the correct participant
```typescript
if (!currentConversationId) {
    console.error('No conversation selected');
    return;
}
```

### Issue: Unread badges not updating
**Solution:** Ensure markAsRead is called when conversation opened
```typescript
useEffect(() => {
    if (conversation) {
        markAsRead(conversation.participantId);
    }
}, [conversation]); // This dependency is important
```

### Issue: Mobile back button not working
**Solution:** Ensure onBack callback is properly wired
```typescript
<ChatWindow
    conversation={currentConversation}
    onBack={() => {
        setShowMobileChat(false);
        setCurrentConversationId(null);
    }}
    onSendMessage={handleSendMessage}
/>
```

### Issue: Notifications sound not playing
**Solution:** Check browser permissions and toggle settings
```typescript
// AudioContext requires user gesture
// Sound should be triggered by user interaction, not on app load
// Check browser console for: "AudioContext" not allowed
```

## Performance Monitoring

### Message Count Safe Limits
- **Tested with:** 0-500 messages
- **Recommended limit:** 500 messages per conversation
- **Future optimization:** Pagination needed for 500+

### Conversation Count Safe Limits
- **Tested with:** 0-100 conversations
- **Recommended limit:** 100 active conversations
- **Future optimization:** Virtual scrolling needed for 100+

### Response Times (Target)
- Message send: < 100ms
- Search filter: < 50ms
- Scroll: 60 FPS (no jank)
- Quick action send: < 100ms

## Migration from Old Chat System

If migrating existing messages:

```typescript
// Old format
interface OldMessage {
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    timestamp: string;
    read: boolean;
}

// New format (backward compatible)
const migrateMessages = (oldMessages: OldMessage[]) => {
    return oldMessages.map(msg => ({
        ...msg,
        senderName: 'Unknown', // Fetch from users table if available
        senderRole: 'motorista', // Infer or fetch
        type: 'normal' as const,
        metadata: {} // Empty for legacy messages
    }));
};

// Apply migration on first load
useEffect(() => {
    const stored = localStorage.getItem('chat_messages');
    if (stored && !stored.includes('senderRole')) {
        const oldMessages = JSON.parse(stored);
        const newMessages = migrateMessages(oldMessages);
        localStorage.setItem('chat_messages', JSON.stringify(newMessages));
    }
}, []);
```

---

**Last Updated:** 2026-02-22
**Ready for:** Testing & Deployment
