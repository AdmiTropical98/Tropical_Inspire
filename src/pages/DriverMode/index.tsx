import { useMemo } from 'react';
import { AlertTriangle, MapPinned, Navigation, Phone, Route, ShieldAlert, Truck } from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { useWorkshop } from '../../contexts/WorkshopContext';
import type { Notification, Servico } from '../../types';

const ACTIVE_SERVICE_STATUSES = new Set([
  'SCHEDULED',
  'DRIVER_ASSIGNED',
  'EN_ROUTE_ORIGIN',
  'ARRIVED_ORIGIN',
  'BOARDING',
  'EN_ROUTE_DESTINATION',
  'scheduled',
  'active',
  'pending',
  'started',
  'delayed',
  'URGENTE',
]);

const normalizePhone = (value?: string | null) => String(value || '').replace(/[^\d+]/g, '');

const getServiceTimestamp = (service: Servico) => {
  const datePart = service.data || new Date().toISOString().slice(0, 10);
  const timePart = service.hora || '00:00';
  const timestamp = new Date(`${datePart}T${timePart}`);
  return Number.isNaN(timestamp.getTime()) ? Number.MAX_SAFE_INTEGER : timestamp.getTime();
};

const isActiveService = (service: Servico) => !service.concluido && ACTIVE_SERVICE_STATUSES.has(String(service.status || 'pending'));

const buildNavigationUrl = (destination: string) => {
  const encodedDestination = encodeURIComponent(destination);
  if (navigator.userAgent.includes('Android')) {
    return `google.navigation:q=${encodedDestination}`;
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}`;
};

const formatServiceTime = (service: Servico) => {
  const label = [service.data, service.hora].filter(Boolean).join(' • ');
  return label || 'Sem hora definida';
};

export default function DriverMode() {
  const { isAuthenticated, currentUser } = useAuth();
  const { servicos, notifications, supervisors, oficinaUsers, gestores } = useWorkshop();

  const assignedTrips = useMemo(() => {
    if (!currentUser?.id) {
      return [] as Servico[];
    }

    return (servicos as Servico[])
      .filter((service) => service.motoristaId === currentUser.id && isActiveService(service))
      .sort((left, right) => getServiceTimestamp(left) - getServiceTimestamp(right));
  }, [currentUser?.id, servicos]);

  const urgentAlerts = useMemo(() => {
    return (notifications as Notification[])
      .filter((notification) => notification.type === 'system_alert' && notification.data.priority === 'high')
      .slice(0, 3);
  }, [notifications]);

  const operationsPhone = useMemo(() => {
    const phoneCandidates = [
      ...supervisors.filter((item) => item.status === 'active').map((item) => item.telemovel),
      ...oficinaUsers.filter((item) => item.status === 'active').map((item) => item.telemovel),
      ...gestores.filter((item) => item.status === 'active').map((item) => item.telemovel),
    ];

    return phoneCandidates.map(normalizePhone).find(Boolean) || '';
  }, [gestores, oficinaUsers, supervisors]);

  const currentTrip = assignedTrips[0];
  const nextTrips = assignedTrips.slice(1, 4);

  const handleStartNavigation = () => {
    if (!currentTrip?.destino) {
      return;
    }

    window.location.href = buildNavigationUrl(currentTrip.destino);
  };

  const handleContactOperations = () => {
    if (operationsPhone) {
      window.location.href = `tel:${operationsPhone}`;
      return;
    }

    window.location.href = '/mensagens';
  };

  if (!isAuthenticated) {
    return (
      <main className="driver-mode">
        <section className="driver-mode__hero">
          <span className="driver-mode__eyebrow">Android Auto</span>
          <h1>Modo Condutor</h1>
          <p>Inicie sessão no telemóvel para carregar serviços, alertas e atalhos operacionais.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="driver-mode">
      <section className="driver-mode__hero">
        <span className="driver-mode__eyebrow">Android Auto</span>
        <h1>Modo Condutor</h1>
        <p>
          {currentUser?.nome || 'Motorista'}
          {' • '}
          {assignedTrips.length} serviço{assignedTrips.length === 1 ? '' : 's'} ativo{assignedTrips.length === 1 ? '' : 's'}
        </p>
      </section>

      <section className="driver-mode__grid">
        <article className="driver-mode__panel driver-mode__panel--primary">
          <div className="driver-mode__panel-header">
            <Route className="driver-mode__icon" />
            <div>
              <span className="driver-mode__label">Serviço Atual</span>
              <h2>{currentTrip?.destino || 'Sem destino atribuído'}</h2>
            </div>
          </div>

          <div className="driver-mode__metric">
            <span>Origem</span>
            <strong>{currentTrip?.origem || 'A aguardar escala'}</strong>
          </div>
          <div className="driver-mode__metric">
            <span>Hora</span>
            <strong>{currentTrip ? formatServiceTime(currentTrip) : 'Sem hora definida'}</strong>
          </div>

          <button type="button" className="driver-mode__button driver-mode__button--accent" onClick={handleStartNavigation} disabled={!currentTrip?.destino}>
            <Navigation />
            Iniciar Navegação
          </button>
        </article>

        <article className="driver-mode__panel">
          <div className="driver-mode__panel-header">
            <Truck className="driver-mode__icon" />
            <div>
              <span className="driver-mode__label">Viagens Atribuídas</span>
              <h2>{assignedTrips.length}</h2>
            </div>
          </div>

          <div className="driver-mode__list">
            {assignedTrips.length === 0 && <p className="driver-mode__empty">Sem viagens atribuídas neste momento.</p>}
            {assignedTrips.map((trip) => (
              <div key={trip.id} className="driver-mode__list-item">
                <div>
                  <strong>{trip.destino || 'Destino por definir'}</strong>
                  <span>{trip.origem || 'Origem por definir'}</span>
                </div>
                <small>{formatServiceTime(trip)}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="driver-mode__panel">
          <div className="driver-mode__panel-header">
            <MapPinned className="driver-mode__icon" />
            <div>
              <span className="driver-mode__label">Próximo Destino</span>
              <h2>{nextTrips[0]?.destino || currentTrip?.destino || 'Sem paragem seguinte'}</h2>
            </div>
          </div>

          <div className="driver-mode__stack">
            {nextTrips.length === 0 && <p className="driver-mode__empty">Sem escalas adicionais planeadas.</p>}
            {nextTrips.map((trip) => (
              <div key={trip.id} className="driver-mode__inline-card">
                <strong>{trip.destino}</strong>
                <span>{formatServiceTime(trip)}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="driver-mode__panel driver-mode__panel--warning">
          <div className="driver-mode__panel-header">
            <ShieldAlert className="driver-mode__icon" />
            <div>
              <span className="driver-mode__label">Alertas Urgentes</span>
              <h2>{urgentAlerts.length}</h2>
            </div>
          </div>

          <div className="driver-mode__stack">
            {urgentAlerts.length === 0 && <p className="driver-mode__empty">Sem alertas urgentes.</p>}
            {urgentAlerts.map((alert) => (
              <div key={alert.id} className="driver-mode__alert">
                <AlertTriangle />
                <div>
                  <strong>{alert.data.title || 'Alerta operacional'}</strong>
                  <span>{alert.data.message || 'Verifique a operação.'}</span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="driver-mode__footer-actions">
        <button type="button" className="driver-mode__button driver-mode__button--secondary" onClick={handleContactOperations}>
          <Phone />
          Contactar Operações
        </button>
      </section>
    </main>
  );
}