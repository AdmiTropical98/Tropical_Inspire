import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Activity,
  Users,
  Truck,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Settings,
  Bell,
  Wifi,
  WifiOff
} from 'lucide-react';

// Types for the command center
interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  timestamp: Date;
  source: string;
  assignedTo?: string;
  status: 'active' | 'resolved' | 'acknowledged';
}

interface ActivityItem {
  id: string;
  type: 'driver_change' | 'schedule_update' | 'system_event' | 'vehicle_status';
  title: string;
  description: string;
  timestamp: Date;
  user?: string;
  priority: 'high' | 'medium' | 'low';
}

interface ActiveSchedule {
  id: string;
  vehicle: string;
  driver: string;
  route: string;
  startTime: Date;
  estimatedEnd: Date;
  status: 'on_time' | 'delayed' | 'early' | 'critical';
  progress: number;
}

// Mock data - in real app, this would come from contexts/APIs
const mockAlerts: Alert[] = [
  {
    id: '1',
    severity: 'critical',
    title: 'Vehicle Breakdown',
    description: 'Truck ABC-123 reported engine failure on Route 45',
    timestamp: new Date(Date.now() - 300000),
    source: 'GPS System',
    status: 'active'
  },
  {
    id: '2',
    severity: 'warning',
    title: 'Driver Overtime',
    description: 'Driver João Silva exceeded 8-hour shift limit',
    timestamp: new Date(Date.now() - 600000),
    source: 'Time Tracking',
    status: 'active'
  },
  {
    id: '3',
    severity: 'info',
    title: 'Route Completed',
    description: 'Delivery route RT-202 completed successfully',
    timestamp: new Date(Date.now() - 900000),
    source: 'Route Management',
    status: 'resolved'
  }
];

const mockActivities: ActivityItem[] = [
  {
    id: '1',
    type: 'driver_change',
    title: 'Driver Assignment Changed',
    description: 'Maria Santos reassigned to Route 12',
    timestamp: new Date(Date.now() - 120000),
    user: 'System',
    priority: 'medium'
  },
  {
    id: '2',
    type: 'schedule_update',
    title: 'Schedule Modified',
    description: 'Route 45 delayed by 30 minutes due to traffic',
    timestamp: new Date(Date.now() - 300000),
    user: 'Dispatch',
    priority: 'high'
  },
  {
    id: '3',
    type: 'vehicle_status',
    title: 'Vehicle Status Update',
    description: 'Truck DEF-456 now available for assignment',
    timestamp: new Date(Date.now() - 600000),
    user: 'Maintenance',
    priority: 'low'
  }
];

const mockSchedules: ActiveSchedule[] = [
  {
    id: '1',
    vehicle: 'ABC-123',
    driver: 'João Silva',
    route: 'Route 45 - Lisbon to Porto',
    startTime: new Date(Date.now() - 3600000),
    estimatedEnd: new Date(Date.now() + 1800000),
    status: 'on_time',
    progress: 65
  },
  {
    id: '2',
    vehicle: 'DEF-456',
    driver: 'Maria Santos',
    route: 'Route 12 - Porto to Coimbra',
    startTime: new Date(Date.now() - 1800000),
    estimatedEnd: new Date(Date.now() + 3600000),
    status: 'delayed',
    progress: 40
  }
];

// Global Status Bar Component
const GlobalStatusBar: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-16 bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/50 flex items-center justify-between px-6 sticky top-0 z-40">
      {/* Left: Key Metrics */}
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-emerald-400" />
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Vehicles</div>
            <div className="text-lg font-black text-white">24</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-400" />
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Drivers Online</div>
            <div className="text-lg font-black text-white">18</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Critical Alerts</div>
            <div className="text-lg font-black text-white">3</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-400" />
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today's Ops</div>
            <div className="text-lg font-black text-white">47</div>
          </div>
        </div>
      </div>

      {/* Center: System Health */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">System Online</span>
        </div>
        <div className="text-sm font-mono text-slate-400">
          {currentTime.toLocaleTimeString('pt-PT', { hour12: false })}
        </div>
      </div>

      {/* Right: Quick Actions */}
      <div className="flex items-center gap-3">
        <button className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors">
          <Bell className="w-5 h-5 text-slate-400" />
        </button>
        <button className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors">
          <Settings className="w-5 h-5 text-slate-400" />
        </button>
      </div>
    </div>
  );
};

// Priority Alerts Panel
const PriorityAlertsPanel: React.FC = () => {
  const [alerts] = useState<Alert[]>(mockAlerts);

  const getSeverityColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical': return 'border-red-500/50 bg-red-500/5';
      case 'warning': return 'border-amber-500/50 bg-amber-500/5';
      case 'info': return 'border-blue-500/50 bg-blue-500/5';
    }
  };

  const getSeverityIcon = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical': return <XCircle className="w-4 h-4 text-red-400" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'info': return <AlertCircle className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-white uppercase tracking-tight">Priority Alerts</h2>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors">
            All
          </button>
          <button className="px-3 py-1.5 text-xs font-bold bg-red-600/20 text-red-400 rounded-lg">
            Critical
          </button>
        </div>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`p-4 rounded-xl border ${getSeverityColor(alert.severity)} hover:bg-slate-800/30 transition-all cursor-pointer group`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                {getSeverityIcon(alert.severity)}
                <span className="text-sm font-bold text-white">{alert.title}</span>
              </div>
              <span className="text-xs text-slate-500">
                {alert.timestamp.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="text-sm text-slate-400 mb-3">{alert.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{alert.source}</span>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="px-2 py-1 text-xs font-bold bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30 transition-colors">
                  Resolve
                </button>
                <button className="px-2 py-1 text-xs font-bold bg-slate-600/20 text-slate-400 rounded hover:bg-slate-600/30 transition-colors">
                  Assign
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Live Operations Panel
const LiveOperationsPanel: React.FC = () => {
  return (
    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-white uppercase tracking-tight">Live Operations</h2>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Live</span>
        </div>
      </div>

      {/* Placeholder for map or live monitoring */}
      <div className="h-64 bg-slate-800/50 rounded-xl border border-slate-700/50 flex items-center justify-center mb-4">
        <div className="text-center">
          <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-500 font-bold">Live Operations Map</p>
          <p className="text-xs text-slate-600 mt-1">Real-time fleet tracking visualization</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/30 rounded-lg p-3">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Active Routes</div>
          <div className="text-2xl font-black text-white">12</div>
        </div>
        <div className="bg-slate-800/30 rounded-lg p-3">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">On Time</div>
          <div className="text-2xl font-black text-emerald-400">89%</div>
        </div>
      </div>
    </div>
  );
};

// Real-Time Activity Feed
const ActivityFeedPanel: React.FC = () => {
  const [activities] = useState<ActivityItem[]>(mockActivities);

  const getTypeColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'driver_change': return 'text-blue-400';
      case 'schedule_update': return 'text-amber-400';
      case 'system_event': return 'text-indigo-400';
      case 'vehicle_status': return 'text-emerald-400';
    }
  };

  const getPriorityColor = (priority: ActivityItem['priority']) => {
    switch (priority) {
      case 'high': return 'border-red-500/50';
      case 'medium': return 'border-amber-500/50';
      case 'low': return 'border-slate-500/50';
    }
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-white uppercase tracking-tight">Activity Feed</h2>
        <button className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors">
          View All
        </button>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className={`p-3 rounded-lg border-l-4 ${getPriorityColor(activity.priority)} bg-slate-800/20 hover:bg-slate-800/40 transition-all`}
          >
            <div className="flex items-start justify-between mb-1">
              <span className={`text-sm font-bold ${getTypeColor(activity.type)}`}>
                {activity.title}
              </span>
              <span className="text-xs text-slate-500">
                {activity.timestamp.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="text-sm text-slate-400 mb-2">{activity.description}</p>
            {activity.user && (
              <div className="text-xs text-slate-500">
                by {activity.user}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Active Schedules Panel
const ActiveSchedulesPanel: React.FC = () => {
  const [schedules] = useState<ActiveSchedule[]>(mockSchedules);

  const getStatusColor = (status: ActiveSchedule['status']) => {
    switch (status) {
      case 'on_time': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'delayed': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'early': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/20';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-white uppercase tracking-tight">Active Schedules</h2>
        <button className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors">
          Manage
        </button>
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto">
        {schedules.map((schedule) => (
          <div
            key={schedule.id}
            className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 hover:bg-slate-800/50 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-bold text-white">{schedule.vehicle}</div>
                <div className="text-xs text-slate-400">{schedule.driver}</div>
              </div>
              <div className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusColor(schedule.status)}`}>
                {schedule.status.replace('_', ' ')}
              </div>
            </div>

            <div className="text-xs text-slate-500 mb-2 truncate">
              {schedule.route}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
              <span>Started: {formatTime(schedule.startTime)}</span>
              <span>ETA: {formatTime(schedule.estimatedEnd)}</span>
            </div>

            <div className="w-full bg-slate-700/50 rounded-full h-2">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${schedule.progress}%` }}
              />
            </div>
            <div className="text-right text-xs text-slate-500 mt-1">
              {schedule.progress}% complete
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Main Command Center Component
export default function CommandCenter() {
  return (
    <div className="min-h-screen bg-slate-950">
      <GlobalStatusBar />

      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-black text-white uppercase tracking-tight mb-2">
              Centro Operacional
            </h1>
            <p className="text-slate-400 font-medium">
              Enterprise Operations Command Center - Real-time fleet management and monitoring
            </p>
          </div>

          {/* Main 2x2 Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-280px)]">
            {/* Left Top: Priority Alerts */}
            <div className="min-h-[300px]">
              <PriorityAlertsPanel />
            </div>

            {/* Right Top: Live Operations */}
            <div className="min-h-[300px]">
              <LiveOperationsPanel />
            </div>

            {/* Left Bottom: Activity Feed */}
            <div className="min-h-[300px]">
              <ActivityFeedPanel />
            </div>

            {/* Right Bottom: Active Schedules */}
            <div className="min-h-[300px]">
              <ActiveSchedulesPanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}