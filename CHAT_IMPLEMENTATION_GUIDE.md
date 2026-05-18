# Central de Mensagens - Implementation Details

## Component Hierarchy

```
ChatPage (Container)
│
├── Header
│   └── Unread Badge Counter
│
└── Main Layout (Grid: 4-6-2 columns on desktop, 1 column on mobile)
    │
    ├── ConversationList (Left Panel - 4 cols / Full width on mobile)
    │   ├── Search Bar
    │   ├── Filter Pills
    │   └── Conversation Items
    │       ├── Avatar
    │       ├── Name + Role Badge
    │       ├── Last Message Preview
    │       ├── Timestamp
    │       ├── Unread Badge
    │       └── Online Indicator
    │
    ├── ChatWindow (Center Panel - 6 cols / Full width on mobile)
    │   ├── Chat Header
    │   │   ├── Back Button (mobile)
    │   │   ├── Avatar + Name
    │   │   ├── Online Status
    │   │   └── Call/Video Buttons
    │   ├── Messages Area
    │   │   ├── Message Bubble (Own)
    │   │   │   ├── Content
    │   │   │   ├── Type Badge
    │   │   │   ├── Timestamp
    │   │   │   └── Read Status (✓/✓✓)
    │   │   └── Message Bubble (Other)
    │   │       ├── Type Styling
    │   │       ├── Content
    │   │       └── Timestamp
    │   ├── QuickShortcuts
    │   │   └── Action Buttons (Location, Service, Presence, Alert)
    │   └── Input Area
    │       ├── Text Input
    │       └── Send Button
    │
    └── QuickActionsPanel (Right Panel - 2 cols / Hidden on mobile)
        ├── Toggle Button
        ├── Participant Info
        ├── Action Buttons
        │   ├── Ver Perfil
        │   ├── Ver Escalas
        │   ├── Ver Viatura
        │   └── Enviar Alerta
        └── Status Card
```

## Data Flow

```
User Input
    │
    ├─→ Send Message
    │   └─→ ChatContext.sendMessage()
    │       └─→ Create Message object
    │           └─→ setMessages() [localStorage]
    │               └─→ useEffect: Conversations auto-update
    │
    ├─→ Select Conversation
    │   └─→ ChatPage: setCurrentConversationId()
    │       └─→ ChatContext: markAsRead()
    │           └─→ Update message.read = true
    │
    ├─→ Quick Action
    │   └─→ ChatContext.sendQuickAction()
    │       └─→ Generate structured message
    │           └─→ sendMessage() with type + metadata
    │
    └─→ Search
        └─→ Filter conversations in ConversationList
            └─→ memo() prevents unnecessary re-render
```

## State Management

### ChatContext State
```typescript
// Core messaging
const [messages, setMessages] = useState<Message[]>()
const [conversations, setConversations] = useState<Conversation[]>()
const [currentConversationId, setCurrentConversationId] = useState<string | null>()

// User preferences
const [notificationSound, setNotificationSound] = useState(boolean)

// Auto-calculated from messages
useEffect(() => {
    const convMap = new Map<string, Conversation>();
    messages.forEach(msg => {
        // Build conversation data
        convMap.set(participantId, {
            id, participantId, name, role,
            lastMessage, lastMessageTime,
            unreadCount, isOnline
        });
    });
    setConversations(Array.from(convMap.values()).sort());
}, [messages, myId])
```

### Component State
```typescript
// ChatPage
const [searchTerm, setSearchTerm] = useState('')
const [showMobileChat, setShowMobileChat] = useState(false)
const [shortcutsExpanded, setShortcutsExpanded] = useState(true)
const [actionsCollapsed, setActionsCollapsed] = useState(false)

// ConversationList uses searchTerm prop for filtering
// ChatWindow is fully controlled by parent ChatPage

// QuickActionsPanel
const [isCollapsed, setIsCollapsed] = useState(false)

// QuickShortcuts
const [isExpanded, setIsExpanded] = useState(true)
```

## Message Type System

### Type: NORMAL
```typescript
{
    type: 'normal',
    content: "Olá, tudo bem?",
    // Renders as: Blue bubble (own) or grey bubble (other)
}
```

### Type: OPERACIONAL
```typescript
{
    type: 'operacional',
    content: "🚐 Serviço atribuído: Transporte VIP",
    metadata: {
        serviceId: 'SRV-001',
        vehicleId: 'VH-001'
    }
    // Renders as: Blue badge + content with blue ring
}
```

### Type: ALERTA
```typescript
{
    type: 'alerta',
    content: "⚠️ ALERTA OPERACIONAL: Desvio de rota detectado",
    metadata: {
        severity: 'high',
        location: { lat: 38.72, lng: -9.14 }
    }
    // Renders as: Orange badge + content with orange ring
}
```

### Type: SISTEMA
```typescript
{
    type: 'sistema',
    content: "✅ Presença confirmada às 09:15",
    // Renders as: Grey italic text with robot emoji
}
```

## Quick Actions Mapping

### Location Sharing
```
Button: 📍 Partilhar Localização
└─→ onShortcutClick('location')
    └─→ sendQuickAction(receiverId, 'location', {
        address: 'Current location',
        lat: number,
        lng: number
    })
    └─→ sendMessage with type='operacional'
        Message: "📍 Localização partilhada: [address]"
```

### Service Assignment
```
Button: 🚐 Atribuir Serviço
└─→ onShortcutClick('service')
    └─→ sendQuickAction(receiverId, 'service', {
        serviceName: 'Service name',
        serviceId: 'SRV-XXX'
    })
    └─→ sendMessage with type='operacional'
        Message: "🚐 Serviço atribuído: [serviceName]"
```

### Presence Confirmation
```
Button: ⏰ Confirmar Presença
└─→ onShortcutClick('presence')
    └─→ sendQuickAction(receiverId, 'presence', {
        time: HH:MM
    })
    └─→ sendMessage with type='sistema'
        Message: "✅ Presença confirmada às [time]"
```

### Operational Alert
```
Button: ⚠️ Enviar Alerta
└─→ onShortcutClick('alert')
    └─→ sendQuickAction(receiverId, 'alert', {
        message: 'Alert message'
    })
    └─→ sendMessage with type='alerta'
        Message: "⚠️ ALERTA OPERACIONAL: [message]"
```

## Styling System

### Role Color Palette
```css
/* ADMIN */
bg-blue-500/10, border-blue-500, text-blue-400

/* SUPERVISOR */
bg-purple-500/10, border-purple-500, text-purple-400

/* OFICINA */
bg-orange-500/10, border-orange-500, text-orange-400

/* GESTOR */
bg-indigo-500/10, border-indigo-500, text-indigo-400

/* MOTORISTA */
bg-emerald-500/10, border-emerald-500, text-emerald-400
```

### Message Type Styling
```css
/* ALERTA */
bg-orange-600/20, border-orange-500/40, ring-orange-500/20
Icon: AlertCircle (orange-400)
Badge: "⚠️ ALERTA"

/* OPERACIONAL */
bg-blue-600/20, border-blue-500/40, ring-blue-500/20
Icon: Gear emoji (⚙️)
Badge: "⚙️ OPERACIONAL"

/* SISTEMA */
bg-slate-700/30, border-slate-600/40, italic text-slate-300
Icon: Robot emoji (🤖)
Badge: "🤖 SISTEMA"

/* NORMAL (Own) */
bg-blue-600, text-white, rounded-br-none

/* NORMAL (Other) */
bg-slate-800, text-slate-100, border-slate-700, rounded-bl-none
```

## Responsive Breakpoints

### Mobile First (< 768px)
```
┌─────────────────────────────┐
│ Header (Search hidden)      │
├─────────────────────────────┤
│ Conversation List (visible) │
│ Chat (hidden by default)    │
├─────────────────────────────┤
│ When chat selected:         │
│ ← Back | Chat Window | ...  │
│ Full width chat             │
│ Quick Shortcuts (compact)   │
│ Input Area                  │
└─────────────────────────────┘
```

### Tablet (768px - 1024px)
```
┌─────────────────────────────────────────┐
│ Header                                  │
├────────────┬──────────────────────────┐ │
│ List       │ Chat Window              │ │
│ (compact)  │ + Quick Shortcuts        │ │
│            │                          │ │
│            │ (Actions hidden)         │ │
└────────────┴──────────────────────────┘ │
```

### Desktop (> 1024px)
```
┌──────────────────────────────────────────────────────┐
│ Header                                              │
├────────────┬──────────────────────┬─────────────────┤
│ List       │ Chat Window          │ Actions Panel   │
│ (4 cols)   │ + Quick Shortcuts    │ (2 cols)        │
│            │ (6 cols)             │ (collapsible)   │
│            │                      │                 │
└────────────┴──────────────────────┴─────────────────┘
```

## Performance Optimizations

### Memoization
```typescript
// ConversationList filters
const filteredConversations = useMemo(() => {
    if (!searchTerm.trim()) return conversations;
    return conversations.filter(convo =>
        convo.participantName.toLowerCase().includes(searchTerm.toLowerCase())
    );
}, [conversations, searchTerm]);

// Auto-sort conversations by recent
conversations.sort((a, b) => {
    const aTime = new Date(a.lastMessageTime || 0).getTime();
    const bTime = new Date(b.lastMessageTime || 0).getTime();
    return bTime - aTime;
});
```

### LocalStorage Sync
```typescript
// Persist on change
useEffect(() => {
    localStorage.setItem('chat_messages', JSON.stringify(messages));
}, [messages]);

// Sync across tabs
useEffect(() => {
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
}, []);
```

### Notification Sound
```typescript
// Web Audio API for no-dependency sound
function playNotificationSound() {
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.frequency.value = 800;
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
}
```

## Testing Scenarios

### Scenario 1: Creating a Conversation
```
1. User selects a contact from ConversationList
2. setCurrentConversationId() → currentConversationId state updates
3. ChatPage finds conversation with currentConversationId
4. ChatWindow renders with selected conversation
5. User types message and submits
6. sendMessage() → new message added to messages array
7. useEffect in ChatContext auto-generates Conversation object
8. Conversation appears in list with updated lastMessage and timestamp
```

### Scenario 2: Mobile Message Flow
```
1. User clicks conversation item
2. showMobileChat = true
3. ConversationList hidden (md:hidden)
4. ChatWindow shown (flex)
5. Back button visible
6. User sends message
7. Quick shortcuts shown at bottom
8. User clicks back button
9. showMobileChat = false
10. Chat hidden, list shown
```

### Scenario 3: Quick Action
```
1. User clicks "Atribuir Serviço" button
2. onShortcutClick('service', {serviceName: 'X'})
3. sendQuickAction() creates structured message
4. Message content: "🚐 Serviço atribuído: X"
5. Message type: 'operacional'
6. Message metadata: {actionType: 'service', serviceName: 'X'}
7. Message added to context
8. ChatWindow re-renders with new message
9. Quick actions panel can show service details
```

## Database Integration (Future)

When migrating to Supabase Realtime:

```typescript
// Replace localStorage with:
useEffect(() => {
    const subscription = supabase
        .from('messages')
        .on('INSERT', (payload) => {
            setMessages(prev => [...prev, payload.new]);
        })
        .subscribe();
    
    return () => {
        subscription.unsubscribe();
    };
}, []);

// Replace sendMessage with:
const sendMessage = async (content, receiverId, type) => {
    const { data, error } = await supabase
        .from('messages')
        .insert([{
            senderId: myId,
            receiverId,
            content,
            type,
            timestamp: new Date().toISOString(),
            read: false
        }]);
    
    if (error) console.error(error);
};
```

---

**Last Updated:** 2026-02-22
**Version:** 1.0 (MVP Complete)
**Status:** Ready for Testing
