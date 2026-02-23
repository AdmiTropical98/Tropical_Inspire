import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Search,
  Filter,
  Calendar,
  User,
  Truck,
  Eye,
  UserCheck,
  CheckCircle,
  Clock
} from 'lucide-react';

interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  entity: {
    type: 'vehicle' | 'driver';
    name: string;
    id: string;
  };
  timestamp: Date;
  status: 'open' | 'assigned' | 'resolved';
  assignedTo?: string;
}

// Mock alerts data
const mockAlerts: Alert[] = [
  {
    id: '1',
    severity: 'critical',
    title: 'Veículo Fora de Rota',
    description: 'Veículo VI-123 desviou da rota programada há mais de 30 minutos',
    entity: { type: 'vehicle', name: 'VI-123', id: 'vi-123' },
    timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 min ago
    status: 'open'
  },
  {
    id: '2',
    severity: 'critical',
    title: 'Motorista Não Responde',
    description: 'Motorista João Silva não responde há 45 minutos',
    entity: { type: 'driver', name: 'João Silva', id: 'js123' },
    timestamp: new Date(Date.now() - 1000 * 60 * 45),
    status: 'assigned',
    assignedTo: 'Supervisor A'
  },
  {
    id: '3',
    severity: 'warning',
    title: 'Nível de Combustível Baixo',
    description: 'Veículo VI-456 tem menos de 20% de combustível',
    entity: { type: 'vehicle', name: 'VI-456', id: 'vi-456' },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    status: 'open'
  },
  {
    id: '4',
    severity: 'warning',
    title: 'Atraso na Entrega',
    description: 'Entrega programada para as 14:00 está atrasada',
    entity: { type: 'vehicle', name: 'VI-789', id: 'vi-789' },
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    status: 'open'
  },
  {
    id: '5',
    severity: 'info',
    title: 'Manutenção Concluída',
    description: 'Revisão periódica do veículo VI-101 foi concluída',
    entity: { type: 'vehicle', name: 'VI-101', id: 'vi-101' },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4),
    status: 'resolved'
  },
  {
    id: '6',
    severity: 'info',
    title: 'Novo Motorista Registrado',
    description: 'Motorista Maria Santos foi adicionada ao sistema',
    entity: { type: 'driver', name: 'Maria Santos', id: 'ms456' },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6),
    status: 'resolved'
  }
];

const AlertItem: React.FC<{
  alert: Alert;
  onView: (alert: Alert) => void;
  onAssign: (alert: Alert) => void;
  onResolve: (alert: Alert) => void;
}> = ({ alert, onView, onAssign, onResolve }) => {
  const getSeverityConfig = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return {
          color: 'border-red-500',
          bgColor: 'bg-red-500/10',
          textColor: 'text-red-400',
          icon: AlertTriangle,
          label: 'Crítico'
        };
      case 'warning':
        return {
          color: 'border-amber-500',
          bgColor: 'bg-amber-500/10',
          textColor: 'text-amber-400',
          icon: AlertCircle,
          label: 'Aviso'
        };
      case 'info':
        return {
          color: 'border-blue-500',
          bgColor: 'bg-blue-500/10',
          textColor: 'text-blue-400',
          icon: Info,
          label: 'Info'
        };
    }
  };

  const config = getSeverityConfig(alert.severity);
  const Icon = config.icon;

  const getStatusColor = (status: Alert['status']) => {
    switch (status) {
      case 'open': return 'text-red-400';
      case 'assigned': return 'text-amber-400';
      case 'resolved': return 'text-emerald-400';
    }
  };

  const getStatusLabel = (status: Alert['status']) => {
    switch (status) {
      case 'open': return 'Aberto';
      case 'assigned': return 'Atribuído';
      case 'resolved': return 'Resolvido';
    }
  };

  return (
    <div className={`border-l-4 ${config.color} ${config.bgColor} rounded-r-xl p-4 mb-3 hover:bg-slate-800/30 transition-all duration-200`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className={`p-2 rounded-lg ${config.bgColor}`}>
            <Icon className={`w-5 h-5 ${config.textColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-white text-sm">{alert.title}</h3>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${config.bgColor} ${config.textColor}`}>
                {config.label}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-slate-700 ${getStatusColor(alert.status)}`}>
                {getStatusLabel(alert.status)}
              </span>
            </div>
            <p className="text-slate-400 text-sm mb-2">{alert.description}</p>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-1">
                {alert.entity.type === 'vehicle' ? <Truck className="w-3 h-3" /> : <User className="w-3 h-3" />}
                <span>{alert.entity.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{alert.timestamp.toLocaleString('pt-PT')}</span>
              </div>
              {alert.assignedTo && (
                <div className="flex items-center gap-1">
                  <UserCheck className="w-3 h-3" />
                  <span>{alert.assignedTo}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={() => onView(alert)}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-all"
            title="Ver detalhes"
          >
            <Eye className="w-4 h-4" />
          </button>
          {alert.status !== 'resolved' && (
            <>
              <button
                onClick={() => onAssign(alert)}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-all"
                title="Atribuir"
              >
                <UserCheck className="w-4 h-4" />
              </button>
              <button
                onClick={() => onResolve(alert)}
                className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all"
                title="Resolver"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default function AlertsPage() {
  const [alerts] = useState<Alert[]>(mockAlerts);
  const [filters, setFilters] = useState({
    severity: 'all' as 'all' | Alert['severity'],
    status: 'all' as 'all' | Alert['status'],
    vehicle: '',
    driver: '',
    search: ''
  });

  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      if (filters.severity !== 'all' && alert.severity !== filters.severity) return false;
      if (filters.status !== 'all' && alert.status !== filters.status) return false;
      if (filters.vehicle && !alert.entity.name.toLowerCase().includes(filters.vehicle.toLowerCase())) return false;
      if (filters.driver && !alert.entity.name.toLowerCase().includes(filters.driver.toLowerCase())) return false;
      if (filters.search && !alert.title.toLowerCase().includes(filters.search.toLowerCase()) &&
          !alert.description.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    }).sort((a, b) => {
      // Critical first, then by timestamp
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  }, [alerts, filters]);

  const alertCounts = useMemo(() => {
    const total = alerts.length;
    const critical = alerts.filter(a => a.severity === 'critical').length;
    const open = alerts.filter(a => a.status === 'open').length;
    return { total, critical, open };
  }, [alerts]);

  const handleView = (alert: Alert) => {
    // TODO: Open modal with alert details
    console.log('View alert:', alert);
  };

  const handleAssign = (alert: Alert) => {
    // TODO: Assign alert to user
    console.log('Assign alert:', alert);
  };

  const handleResolve = (alert: Alert) => {
    // TODO: Mark alert as resolved
    console.log('Resolve alert:', alert);
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-6 bg-slate-950">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white mb-2 tracking-tight">
            Gestão de Alertas
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-slate-400 text-sm">
                {alertCounts.critical} Críticos
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <span className="text-slate-400 text-sm">
                {alertCounts.open} Abertos
              </span>
            </div>
            <div className="text-slate-400 text-sm">
              Total: {alertCounts.total}
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-4 border border-slate-800/50">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Severity Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Severidade
            </label>
            <select
              value={filters.severity}
              onChange={(e) => setFilters(prev => ({ ...prev, severity: e.target.value as any }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas</option>
              <option value="critical">Crítico</option>
              <option value="warning">Aviso</option>
              <option value="info">Info</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Estado
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos</option>
              <option value="open">Aberto</option>
              <option value="assigned">Atribuído</option>
              <option value="resolved">Resolvido</option>
            </select>
          </div>

          {/* Vehicle Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Veículo
            </label>
            <input
              type="text"
              placeholder="Buscar veículo..."
              value={filters.vehicle}
              onChange={(e) => setFilters(prev => ({ ...prev, vehicle: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Driver Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Motorista
            </label>
            <input
              type="text"
              placeholder="Buscar motorista..."
              value={filters.driver}
              onChange={(e) => setFilters(prev => ({ ...prev, driver: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date Range - Placeholder */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Período
            </label>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span className="text-slate-500 text-sm">Hoje</span>
            </div>
          </div>

          {/* Search */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar alertas..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-12">
            <Info className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Nenhum alerta encontrado com os filtros aplicados.</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <AlertItem
              key={alert.id}
              alert={alert}
              onView={handleView}
              onAssign={handleAssign}
              onResolve={handleResolve}
            />
          ))
        )}
      </div>
    </div>
  );
}