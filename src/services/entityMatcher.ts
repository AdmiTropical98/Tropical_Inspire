import type { CentroCusto, Fornecedor, Requisicao, Viatura } from '../../types';
import type { InvoiceEngineCandidate } from './types';

const norm = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');

const digits = (value: unknown) => String(value ?? '').replace(/\D/g, '');

const similarity = (a: string, b: string) => {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.86;
  const aa = new Set(a.split(''));
  const bb = new Set(b.split(''));
  const intersection = [...aa].filter(c => bb.has(c)).length;
  return intersection / Math.max(aa.size, bb.size);
};

export function matchSupplier(
  nif: string,
  name: string,
  suppliers: Fornecedor[],
): InvoiceEngineCandidate<Fornecedor> | null {
  if (!suppliers.length) return null;

  const invoiceNif = digits(nif);
  const invoiceName = norm(name);

  const ranked = suppliers.map(entity => {
    const entityNif = digits(entity.nif);
    const entityName = norm(entity.nome);
    let score = 0;
    const reasons: string[] = [];

    if (invoiceNif && entityNif && invoiceNif === entityNif) {
      score = 100;
      reasons.push('NIF exato');
    } else if (invoiceName && entityName) {
      score = Math.round(similarity(invoiceName, entityName) * 72);
      if (score >= 55) reasons.push('nome semelhante');
    }

    return { entity, score, reasons };
  }).sort((a, b) => b.score - a.score);

  return ranked[0] && ranked[0].score >= 55 ? ranked[0] : null;
}

export function matchVehicle(
  registration: string,
  chassis: string,
  model: string,
  vehicles: Viatura[],
): InvoiceEngineCandidate<Viatura> | null {
  if (!vehicles.length) return null;

  const reg = norm(registration);
  const vin = norm(chassis);
  const mdl = norm(model);

  const ranked = vehicles.map(entity => {
    const entityReg = norm(entity.matricula);
    const entityVin = norm((entity as any).chassis ?? (entity as any).numeroChassis ?? '');
    const entityModel = norm(`${(entity as any).marca ?? ''}${(entity as any).modelo ?? ''}`);

    let score = 0;
    const reasons: string[] = [];

    if (reg && entityReg && reg === entityReg) {
      score = 100;
      reasons.push('matrícula exata');
    } else if (vin && entityVin && vin === entityVin) {
      score = 98;
      reasons.push('chassis exato');
    } else {
      if (reg && entityReg && similarity(reg, entityReg) >= 0.86) {
        score = Math.max(score, 82);
        reasons.push('matrícula semelhante');
      }
      if (mdl && entityModel && similarity(mdl, entityModel) >= 0.72) {
        score = Math.max(score, 65);
        reasons.push('modelo semelhante');
      }
    }

    return { entity, score, reasons };
  }).sort((a, b) => b.score - a.score);

  return ranked[0] && ranked[0].score >= 60 ? ranked[0] : null;
}

export function matchCostCenter(
  requisition: Requisicao | null,
  costCenters: CentroCusto[],
): InvoiceEngineCandidate<CentroCusto> | null {
  if (!requisition?.centroCustoId) return null;
  const entity = costCenters.find(c => c.id === requisition.centroCustoId);
  return entity
    ? { entity, score: 100, reasons: ['centro de custo herdado da requisição'] }
    : null;
}

export function matchRequisition(
  supplierId: string,
  vehicleId: string,
  issueDate: string,
  requisitions: Requisicao[],
): InvoiceEngineCandidate<Requisicao> | null {
  const dateMs = issueDate ? new Date(issueDate).getTime() : NaN;

  const ranked = requisitions.map(req => {
    let score = 0;
    const reasons: string[] = [];

    if (supplierId && req.fornecedorId === supplierId) {
      score += 50;
      reasons.push('fornecedor coincide');
    }

    if (vehicleId && req.viaturaId === vehicleId) {
      score += 40;
      reasons.push('viatura coincide');
    }

    const reqDate = req.data ? new Date(req.data).getTime() : NaN;
    if (Number.isFinite(dateMs) && Number.isFinite(reqDate)) {
      const days = Math.abs(dateMs - reqDate) / 86400000;
      if (days <= 7) {
        score += 10;
        reasons.push('data próxima');
      } else if (days <= 30) {
        score += 5;
        reasons.push('data relativamente próxima');
      }
    }

    return { entity: req, score, reasons };
  }).sort((a, b) => b.score - a.score);

  return ranked[0] && ranked[0].score >= 50 ? ranked[0] : null;
}
