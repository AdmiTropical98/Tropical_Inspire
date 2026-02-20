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
    viaturaId?: string;
    centroCustoId?: string;
    fornecedorId: string;
    itens: ItemRequisicao[];
    obs: string;
    status?: 'pendente' | 'concluida';
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
    turnoInicio?: string; // HH:mm
    turnoFim?: string; // HH:mm
    status?: 'disponivel' | 'ocupado' | 'indisponivel' | 'ferias'; // Added missing field
    cartrackKey?: string; // Cartrack identification key (tag)
    cartrackId?: string; // Internal Cartrack Driver ID
    currentVehicle?: string; // Registration (matricula) of the current vehicle
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

export interface Servico {
    id: string;
    data?: string; // YYYY-MM-DD - Data da escala operacional
    motoristaId?: string | null; // Pode ser nulo se não atribuído
    passageiro: string;
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
    status?: 'pending' | 'started' | 'completed' | 'failed';
    failureReason?: string;
    batchId?: string; // Link to ScaleBatch
}

export interface ScaleBatch {
    id: string;
    serial_number?: number;
    created_by: string;
    centro_custo_id: string;
    reference_date: string;
    notes?: string;
    created_at: string;
    created_by_role?: string; // NEW
    status?: 'active' | 'cancelled'; // NEW: Soft delete status
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
}

export interface Notification {
    id: string;
    type: 'registration_request' | 'urgent_transport_request' | 'transport_assignment' | 'transport_cancelled' | 'fuel_confirmation_request' | 'system_alert' | 'driver_request' | 'pin_request';
    data: {
        // Registration Data
        nome?: string;
        email?: string;
        telemovel?: string;
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

export interface Message {
    id: string;
    senderId: string;
    receiverId: string; // 'admin' or UUID
    content: string;
    timestamp: string;
    read: boolean;
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
            precoDiario: number;
            centroCustoId?: string;
        }[];
    };
    cliente?: Cliente;
    isExpense?: boolean;
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



