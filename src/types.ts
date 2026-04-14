export interface Fornecedor {
    id: string;
    nome: string;
    nif: string;
    morada: string;
    contacto: string;
    email: string;
    obs: string;
    foto?: string; // URL or Base64 string for supplier logo/photo
}

export interface Viatura {
    id: string;
    matricula: string;
    marca: string;
    modelo: string;
    ano: string;
    obs: string;
    estado?: 'disponivel' | 'em_uso' | 'em_manutencao'; // Added missing field
    // New fields for Vehicle Profile
    seguro?: Seguro;
    documentos?: DocumentoViatura[];
    multas?: Multa[]; // Reuse Multa type
    manutencoes?: Manutencao[];
    precoDiario?: number; // Daily rental rate
    centro_custo_id?: string; // Cost Center Association
    vehicleCapacity?: number;
}


export interface Seguro {
    apolice: string;
    validade: string;
    companhia: string;
    pdfUrl?: string; // Link to uploaded PDF
}

export interface DocumentoViatura {
    id: string;
    nome: string; // e.g. "Livrete", "Inspeção"
    url: string;
    validade?: string;
}

export interface Manutencao {
    id: string;
    data: string;
    tipo: 'preventiva' | 'corretiva' | 'inspecao' | 'outros';
    km: number;
    oficina: string;
    custo: number;
    descricao: string;
    pdfUrl?: string; // Invoice/Report
}

export interface ItemRequisicao {
    id: string;
    descricao: string;
    quantidade: number;
    valor_unitario?: number;
    valor_total?: number;
}

export interface CentroCusto {
    id: string;
    nome: string;
    localizacao?: string;
    codigo?: string;
}

export interface Requisicao {
    id: string;
    numero: string;
    data: string;
    tipo: 'Oficina' | 'Stock' | 'Viatura' | 'CentroCusto';
    clienteId?: string;
    viaturaId?: string;
    centroCustoId?: string;
    fornecedorId: string;
    itens: ItemRequisicao[];
    obs: string;
    status?: 'pendente' | 'concluida';
    erp_status?: 'pending' | 'awaiting_invoice' | 'invoiced' | 'closed';
    approved_value?: number;
    financial_status?: 'PENDING' | 'PARTIAL' | 'INVOICED';
    total_invoiced_amount?: number;
    fatura?: string;
    custo?: number; // Invoice Amount
    faturas_dados?: {
        numero: string;
        valor_liquido: number;
        iva_taxa: number;
        iva_valor: number;
        valor_total: number;
    }[]; // Multiple invoices support
    criadoPor?: string; // Name of the user who created it
    supplier_confirmed?: boolean;
    supplier_confirmed_at?: string;
    supplier_refused?: boolean;
    supplier_refused_at?: string;
    supplier_rejected?: boolean;
    supplier_comment?: string;
    supplier_response_date?: string;
}

export interface Acidente {
    id: string;
    data: string;
    descricao: string;
    custo?: number;
    pagamentoStatus?: 'pendente' | 'pago' | 'nao_aplicavel';
    fotos?: string[]; // URLs or base64
    status: 'resolvido' | 'pendente' | 'em_analise';
}

export interface Multa {
    id: string;
    data: string;
    valor: number;
    motivo: string;
    local?: string;
    pago: boolean;
    obs?: string;
}

export interface Avaliacao {
    id: string;
    motoristaId: string;
    adminId: string;
    periodo: string; // "YYYY-MM"
    pontuacao: number; // 0-5
    criterios: {
        pontualidade: number;
        apresentacao: number;
        cuidadoViatura: number;
        comportamento: number;
    };
    obs: string;
    dataAvaliacao: string;
}

export interface Ausencia {
    id: string;
    inicio: string;
    fim: string;
    tipo: 'ferias' | 'baixa' | 'folga' | 'outros';
    motivo?: string;
    aprovado: boolean;
}

export interface Shift {
    id: string;
    inicio: string; // HH:mm
    fim: string;    // HH:mm
    label?: string; // e.g., "Manhã", "Tarde"
}

export interface BlockedPeriod {
    id: string;
    inicio: string; // HH:mm
    fim: string;    // HH:mm
    reason: string; // e.g., "Condução Autocarro"
}

export interface Motorista {
    id: string;
    nome: string;
    foto?: string; // Base64 or URL
    contacto: string;
    cartaConducao?: string;
    email?: string;
    centroCustoId: string;
    obs?: string;
    pin?: string;
    acidentes?: Acidente[];
    multas?: Multa[];
    ausencias?: Ausencia[];
    folgas?: string[]; // Fixed weekly days off (e.g., ['segunda', 'terca'])
    vencimentoBase?: number; // Monthly Base Salary
    valorHora?: number; // Hourly Rate for overtime
    blockedPermissions?: string[]; // permissions explicitly blocked for this user
    dataRegisto?: string; // Registration date
    rating?: number; // Driver rating (0-5)
    turnoInicio?: string; // HH:mm (Legacy, keeping for compatibility)
    turnoFim?: string;    // HH:mm (Legacy, keeping for compatibility)
    shifts?: Shift[];     // Multiple shifts support
    zones?: ('albufeira' | 'quarteira')[]; // Operational zones
    blockedPeriods?: BlockedPeriod[];      // Locked times outside shifts
    maxDailyServices?: number;             // Workload limit
    minIntervalMinutes?: number;           // Minimum break between services
    status?: 'disponivel' | 'ocupado' | 'indisponivel' | 'ferias';
    cartrackKey?: string;
    cartrackId?: string;
    viaturaId?: string;
    currentVehicle?: string;
    tipoUtilizador?: 'motorista' | 'supervisor' | 'oficina';
    estadoOperacional?: 'disponivel' | 'em_servico' | 'a_abastecer' | 'em_oficina' | 'indisponivel';
}

export interface Local {
    id: string;
    nome: string;
    latitude: number;
    longitude: number;
    raio: number;
    tipo: 'hotel' | 'aeroporto' | 'oficina' | 'outros';
    cor: string;
    userId?: string;
    centroCustoId?: string; // NEW: Map Geofence to specific Cost Center
}

export interface ServiceEvent {
    id: string;
    serviceId: string;
    vehicleId?: string | null;
    eventType: 'approaching_origin' | 'entered_origin' | 'left_origin' | 'entered_destination' | 'left_destination' | string;
    timestamp: string;
    locationId?: string | null;
    metadata?: Record<string, any> | null;
}

export interface DriverVehicleSession {
    id: string;
    driverId: string;
    vehicleId: string;
    startTime: string;
    endTime?: string | null;
    active: boolean;
}

export interface Servico {
    id: string;
    data?: string; // YYYY-MM-DD - Data da escala operacional
    motoristaId?: string | null; // Pode ser nulo se não atribuído
    passageiro: string;
    colaboradorId?: string;
    hora: string;
    origem: string;
    destino: string;
    voo?: string; // Opcional
    obs?: string;
    concluido: boolean;
    centroCustoId?: string;
    validationPoints?: string[]; // IDs of required POIs to visit
    tipo?: 'entrada' | 'saida' | 'outro';
    departamento?: string;
    status?:
        | 'SCHEDULED'
        | 'DRIVER_ASSIGNED'
        | 'EN_ROUTE_ORIGIN'
        | 'ARRIVED_ORIGIN'
        | 'BOARDING'
        | 'EN_ROUTE_DESTINATION'
        | 'COMPLETED'
        | 'scheduled'
        | 'active'
        | 'delayed'
        | 'completed'
        | 'pending'
        | 'started'
        | 'failed'
        | 'URGENTE';
    failureReason?: string;
    batchId?: string; // Link to ScaleBatch
    isUrgent?: boolean;
    vehicleId?: string | null;
    passengerCount?: number;
    occupancyRate?: number | null;
    originLocationId?: string | null;
    destinationLocationId?: string | null;
    originArrivalTime?: string | null;
    destinationArrivalTime?: string | null;
    originConfirmed?: boolean;
    destinationConfirmed?: boolean;
    originDepartureTime?: string | null;
    destinationDepartureTime?: string | null;
    originStopDurationSeconds?: number | null;
    serviceEvents?: ServiceEvent[];
}

export interface ScaleBatch {
    id: string;
    serial_number?: number;
    created_by: string;
    centro_custo_id: string;
    reference_date: string;
    notes?: string;
    created_at: string;
    created_by_role?: string;
    status?: 'active' | 'cancelled';
    is_published?: boolean;
    published_at?: string;
    published_by?: string;
}

export interface Supervisor {
    id: string;
    nome: string;
    foto?: string;
    email: string;
    telemovel: string;
    password?: string; // Optional if using PIN only
    pin?: string;      // The PIN generated by Admin
    status: 'pending' | 'active' | 'blocked';
    blockedPermissions?: string[];
    dataRegisto?: string;
    centroCustoId?: string; // NEW
    cartrackKey?: string; // NEW
    role: 'SUPERVISOR';
}

export interface OficinaUser {
    id: string;
    nome: string;
    foto?: string;
    email?: string;
    telemovel: string; // Required for login
    pin: string;
    status: 'active' | 'blocked';
    blockedPermissions?: string[];
    dataRegisto?: string;
    centroCustoId?: string; // NEW
    role: 'OFICINA';
}

export interface Notification {
    id: string;
    type: 'registration_request' | 'urgent_transport_request' | 'transport_assignment' | 'transport_cancelled' | 'fuel_confirmation_request' | 'system_alert' | 'driver_request' | 'pin_request';
    data: {
        // Registration Data
        nome?: string;
        email?: string;
        telemovel?: string;
        foto?: string;
        password?: string;
        role?: string;

        // Transport Request Data
        origin?: string;
        destination?: string;
        time?: string;
        passenger?: string;
        obs?: string;

        // Transport Assignment Data (Service)
        serviceId?: string;

        // Fuel Request Data
        liters?: number;
        km?: number;
        vehicleId?: string; // License Plate related
        licensePlate?: string; // Store plate directly for ease
        staffId?: string; // Who initiated

        // System Alert / Generic
        title?: string;
        message?: string;
        priority?: 'normal' | 'high';
        requestId?: string; // For linking back to request type
    };
    status: 'pending' | 'approved' | 'rejected' | 'assigned' | 'accepted' | 'confirmed';
    response?: {
        pin?: string;
        driverId?: string;
        serviceId?: string;
    };
    timestamp: string;
}

export interface FuelTank {
    id: string; // usually 'main'
    capacity: number;
    currentLevel: number; // Stock Level
    pumpTotalizer: number; // Pump "Odometer"
    lastRefillDate: string;
    averagePrice?: number; // Weighted Average Price (PMP)
    baselineDate?: string; // Date of confirmed balance
    baselineLevel?: number; // Level at baseline date
    baselineTotalizer?: number; // Totalizer at baseline date
}

export interface FuelTransaction {
    id: string;
    driverId: string;
    vehicleId: string; // or license plate
    liters: number;
    km: number;
    staffId: string;
    staffName?: string; // Captured Name
    status: 'pending' | 'confirmed';
    timestamp: string;
    pumpCounterAfter?: number;
    pricePerLiter?: number;
    totalCost?: number;
    centroCustoId?: string;
    isExternal?: boolean;
    is_external?: boolean;
    vehicle_id?: string;
    driver_id?: string;
    centro_custo_id?: string;
    price_per_liter?: number;
    total_cost?: number;
    staff_name?: string;
    station?: string;
    consumoCalculado?: number;
    isAnormal?: boolean;
}

export interface TankRefillLog {
    id: string;
    litersAdded: number;
    levelBefore: number;
    levelAfter: number;
    totalSpentSinceLast: number; // Calculated from Tank Level Drop
    pumpMeterReading: number; // Manual Pump Reading
    systemExpectedReading?: number; // What the system thought it was
    supplier: string;
    timestamp: string;
    staffId: string;
    staffName?: string; // Captured Name
    pricePerLiter?: number;
    totalCost?: number;
}

export interface EscalaDia {
    id: string;
    data: string;
    servicos: Servico[];
}

export type MessageType = 'normal' | 'operacional' | 'alerta' | 'sistema';

export interface Message {
    id: string;
    senderId: string;
    senderName?: string;
    senderRole?: 'admin' | 'motorista' | 'supervisor' | 'oficina' | 'gestor';
    receiverId: string; // 'admin' or UUID
    content: string;
    timestamp: string;
    read: boolean;
    type?: MessageType;
    metadata?: {
        serviceId?: string;
        vehicleId?: string;
        location?: { lat: number; lng: number };
        attachmentUrl?: string;
    };
}

export interface Conversation {
    id: string;
    participantId: string;
    participantName: string;
    participantRole: 'admin' | 'motorista' | 'supervisor' | 'oficina' | 'gestor';
    lastMessage?: string;
    lastMessageTime?: string;
    unreadCount: number;
    isOnline: boolean;
    lastSeen?: string;
    avatar?: string;
}

export interface ConversationState {
    conversations: Conversation[];
    currentConversationId: string | null;
    messages: Message[];
    isLoading: boolean;
    notificationSound: boolean;
}

export interface EvaDailyUsage {
    id: string;
    date: string;
    hasIssue: boolean;
    issueType?: 'delay' | 'mechanical' | 'accident' | 'other';
    issueDescription?: string;
    issueSeverity?: 'low' | 'medium' | 'high';
}

export interface EvaTransport {
    id: string;
    referenceDate: string; // Usually the first day of usage or current date
    route: string;
    amount: number;
    notes?: string;
    loggedBy: string;
    createdAt: string;
    days: EvaDailyUsage[];
}

export interface Cliente {
    id: string;
    nome: string;
    nif: string;
    email: string;
    morada: string;
    telefone: string;
}

export interface ItemFatura {
    id: string;
    descricao: string;
    quantidade: number;
    precoUnitario: number;
    taxaImposto: number; // Percentage (e.g., 14 for 14%)
    total: number;
}

export interface Fatura {
    id: string;
    numero: string; // e.g. "FT 2024/001"
    data: string;
    vencimento: string;
    clienteId: string;
    status: 'rascunho' | 'emitida' | 'paga' | 'anulada';
    itens: ItemFatura[];
    subtotal: number;
    imposto: number;
    desconto: number;
    total: number;
    notas?: string;
    tipo?: 'geral' | 'aluguer';
    aluguerDetails?: {
        viaturaId: string;
        viaturasIds?: string[]; // New: support multiple vehicles
        viaturas?: {
            viaturaId: string;
            centroCustoId?: string;
            dias: number;
            precoDia: number;
            total: number;
            dataInicio?: string;
            dataFim?: string;
        }[];
        dias: number;
        dataInicio: string;
        dataFim: string;
        centroCustoId?: string;
        periodoReferencia?: string; // YYYY-MM
        detalhesViaturas?: {
            viaturaId: string;
            dias: number;
            dataInicio: string;
            dataFim: string;
            precoDia: number;
            total: number;
            precoDiario?: number;
            centroCustoId?: string;
        }[];
    };
    cliente?: Cliente;
    isExpense?: boolean;
}

export interface SupplierInvoice {
    id: string;
    supplier_id: string;
    invoice_number: string;
    issue_date: string;
    due_date: string;
    base_amount: number;
    iva_rate: 0 | 6 | 13 | 23;
    iva_value: number;
    discount: {
        type: 'amount' | 'percentage';
        value: number;
        applied_value: number;
    };
    extra_expenses: {
        description: string;
        value: number;
    }[];
    total: number;
    total_liquido: number;
    total_iva: number;
    total_final: number;
    net_value: number;
    vat_value: number;
    total_value: number;
    expense_type: string;
    requisition_id?: string;
    cost_center_id?: string;
    vehicle_id?: string;
    payment_status: 'pending' | 'scheduled' | 'paid' | 'overdue';
    payment_method?: string;
    notes?: string;
    pdf_url?: string;
    created_at: string;
    updated_at: string;
    supplier?: Fornecedor;
    cost_center?: CentroCusto;
    vehicle?: Viatura;
    requisition?: Requisicao;
    lines?: SupplierInvoiceLine[];
}

export const ALLOWED_INVOICE_UNITS = ['UN', 'H', 'L', 'CX'] as const;
export type InvoiceUnit = typeof ALLOWED_INVOICE_UNITS[number];

export interface SupplierInvoiceLine {
    id?: string;
    supplier_invoice_id?: string;
    description: string;
    unidade_medida: InvoiceUnit;
    quantity: number;
    unit_price: number;
    discount_percentage: number;
    net_value: number;
    iva_rate: 0 | 6 | 13 | 23;
    iva_value: number;
    total_value: number;
    created_at?: string;
    updated_at?: string;
}

export type InvoiceImportStatus = 'processing' | 'ready' | 'failed' | 'confirmed';

export interface InvoiceImportExtractedLine {
    description: string;
    unidade_medida?: InvoiceUnit;
    qty: number;
    unit_price: number;
    vat_percent: 0 | 6 | 13 | 23;
    vat_value?: number;
}

export interface InvoiceImportExtractedData {
    supplier: string;
    invoice_number: string;
    date: string;
    total: number;
    vat_total: number;
    lines: InvoiceImportExtractedLine[];
}

export interface InvoiceImport {
    id: string;
    file_path: string;
    status: InvoiceImportStatus;
    extracted_json?: InvoiceImportExtractedData | null;
    error?: string | null;
    created_at: string;
}

export interface AdminUser {
    id: string; // auth.uid
    email: string;
    nome?: string;
    role: 'admin';
    createdAt: string;
}

export interface Expense {
    id: string;
    category: 'fixo' | 'variavel' | 'imposto' | 'salario' | 'outro';
    description: string;
    amount: number;
    date: string;
    paid: boolean;
    recurring: boolean;
    recurrence_period?: 'monthly' | 'yearly';
    cost_center_id?: string;
    receipt_url?: string;
    created_at?: string;
}

export interface FinancialSummary {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    pendingPayments: number;
    expenseBreakdown: { category: string; value: number; color: string }[];
    topCostCenters: { id: string; nome: string; total: number }[];
}

export interface FinancialMovement {
    id: string;
    date: string;
    document_type: 'invoice' | 'requisition' | 'fuel' | 'expense' | 'adjustment';
    document_id: string;
    description: string;
    debit: number;
    credit: number;
    amount: number;
    cost_center_id?: string;
    vehicle_id?: string;
    supplier_id?: string;
    source_requisition_id?: string;
    account_code: '12' | '21' | '60' | '61' | '62' | '63' | '64' | '70' | '71' | '72';
    account_name?: string;
    is_reversal?: boolean;
    reversal_of?: string | null;
    created_at?: string;
}

export interface RolePermissions {
    id: string;
    role: 'admin' | 'gestor' | 'motorista' | 'mecanico';
    can_view_financials: boolean;
    can_manage_users: boolean;
    can_delete_records: boolean;
    can_view_reports: boolean;
}

export interface ManualHourRecord {
    id: string;
    motoristaId: string;
    adminId?: string;
    date: string;
    startTime: string;
    endTime: string;
    breakDuration: number;
    obs?: string;
    createdAt?: string;
}

export interface DriverPayrollManual {
    id: string;
    driver_id: string;
    mes: number;
    ano: number;
    ordenado_base: number;
    horas_extra: number;
    valor_horas_extra: number;
    folgas_trabalhadas: number;
    valor_folgas: number;
    outros_abonos: number;
    descontos: number;
    total_bruto: number;
    observacoes?: string;
    created_at?: string;
    updated_at?: string;
}

export interface Gestor {
    id: string;
    nome: string;
    foto?: string;
    email: string;
    telemovel: string;
    password?: string;
    pin?: string;
    status: 'active' | 'blocked';
    blockedPermissions?: string[];
    dataRegisto?: string;
    centroCustoIds?: string[]; // NEW: Multi-select
    allCostCenters?: boolean; // NEW: Access to all
}

export interface TollRecord {
    id: string;
    vehicle_id: string;
    driver_id?: string;
    entry_point: string;
    exit_point: string;
    entry_time: string;
    exit_time?: string;
    amount: number;
    distance?: number;
    cost_center_id?: string; // NEW
    type?: 'toll' | 'parking'; // NEW
    created_at: string;
    created_by: string;
    vehicle?: Viatura;
    driver?: Motorista;
    cost_center?: CentroCusto; // NEW
}

export interface ElectricChargingRecord {
    id: string;
    vehicle_id: string;
    driver_id?: string;
    cost_center_id?: string;
    station_name: string;
    date: string;
    kwh: number;
    cost: number;
    duration: number; // minutes
    created_at: string;
    created_by: string;
    vehicle?: Viatura;
    driver?: Motorista;
    cost_center?: CentroCusto;
}

export interface VehicleMetrics {
    vehicleId: string;
    consumoMedio: number;
    totalLitrosMes: number;
    totalCustoMes: number;
    ultimaKm: number;
    estimativaAutonomia: number;
    updatedAt: string;
}

export interface RotaPlaneada {
    id: string;
    motorista_id: string;
    viatura_id: string;
    data: string;
    distancia_estimada: number;
    tempo_estimado: number;
    consumo_estimado: number;
    custo_estimado: number;
    rota_json: any;
    estado: 'planeada' | 'concluida' | 'cancelada';
    flag_desvio?: boolean;
    justificacao_desvio?: string;
    distancia_real?: number;
    created_at?: string;
    concluida_at?: string;
}

export interface LogOperacional {
    id: string;
    utilizador: string;
    acao: string;
    data_hora: string;
    referencia_id?: string;
    detalhes_json?: any;
    cost_center_id?: string;
}

export interface ZonaOperacional {
    id: string;
    nome_local: string;
    area_operacional: string;
    created_at?: string;
}

export interface AreaOperacional {
    id: string;
    nome: string;
    color?: string;
    created_at?: string;
}

export interface EscalaTemplate {
    id: string;
    nome: string;
    centro_custo_id?: string;
    created_at: string;
    created_by?: string;
}

export interface EscalaTemplateItem {
    id: string;
    template_id: string;
    hora_entrada?: string;
    hora_saida?: string;
    passageiro?: string;
    local: string;
    referencia?: string;
    obs?: string;
    created_at: string;
}

export type PermissionAction = 'ver' | 'criar' | 'editar' | 'eliminar' | 'exportar' | 'aprovar';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

export type UserRole = 'ADMIN_MASTER' | 'ADMIN' | 'GESTOR' | 'SUPERVISOR' | 'OFICINA' | 'MOTORISTA';

export interface UserProfile {
    id: string;
    email: string;
    nome: string;
    role: UserRole;
    status: UserStatus;
    email_confirmed: boolean;
    avatar?: string;
    foto?: string;
    permissions?: DetailedPermissions;
    createdAt?: string;
    updatedAt?: string;
}

export type SystemModule =
    | 'dashboard'
    | 'frota'
    | 'escalas'
    | 'horas'
    | 'combustivel'
    | 'requisicoes'
    | 'equipa'
    | 'financeiro'
    | 'relatorios'
    | 'utilizadores'
    | 'permissoes'
    | 'mensagens'
    | 'configuracoes'
    | 'backoffice'
    | 'oficina';

export type ModulePermissions = PermissionAction[];

export type DetailedPermissions = Partial<Record<SystemModule, ModulePermissions>>;

export interface StockItem {
    id: string;
    name: string;
    sku?: string;
    category?: string;
    stock_quantity: number;
    minimum_stock: number;
    average_cost: number;
    location?: string;
    supplier_id?: string;
    created_at?: string;
    updated_at?: string;
    supplier?: Fornecedor;
}

export interface WorkshopAsset {
    id: string;
    name: string;
    category?: string;
    serial_number?: string;
    purchase_date?: string;
    purchase_value?: number;
    assigned_technician_id?: string | null;
    status: 'available' | 'assigned' | 'maintenance' | 'retired';
    location?: string;
    notes?: string;
    created_at?: string;
    updated_at?: string;
}

export interface StockMovement {
    id: string;
    item_id: string;
    movement_type: 'entry' | 'exit' | 'adjustment';
    quantity: number;
    average_cost_at_time?: number;
    source_document?: 'invoice' | 'requisition' | 'manual';
    document_id?: string;
    notes?: string;
    created_at: string;
    item?: StockItem;
}

export type OperationType = 'alert' | 'schedule' | 'fleet' | 'team' | 'general';

export interface OperationThread {
    id: string;
    type: OperationType;
    title: string;
    related_user?: string;
    related_vehicle?: string;
    related_schedule?: string;
    status: 'active' | 'resolved' | 'archived';
    created_at: string;
}

export interface OperationMessage {
    id: string;
    thread_id: string;
    sender_id: string;
    message: string;
    system_generated: boolean;
    created_at: string;
}

export type OperationCategory = OperationType | 'escalas' | 'equipa' | 'frota' | 'geral';

export interface OperationEvent {
    id: string;
    category: OperationCategory;
    title: string;
    description?: string;
    entity_id?: string;
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    priority: 'low' | 'normal' | 'high' | 'critical';
    created_at: string;
}
