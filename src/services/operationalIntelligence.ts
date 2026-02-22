import { supabase } from '../lib/supabase';
import { createOperationEvent } from './operationService';
import type { Motorista, Viatura, FuelTransaction } from '../types';

/**
 * Checks for drivers without an assigned vehicle and generates events.
 */
export async function auditDriversWithoutVehicles(drivers: Motorista[]) {
    const unassignedDrivers = drivers.filter(d => !d.currentVehicle);

    for (const driver of unassignedDrivers) {
        // Check if an open event already exists to avoid duplication
        const { data: existing } = await supabase
            .from('operation_events')
            .select('id')
            .eq('category', 'equipa')
            .eq('entity_id', driver.id)
            .eq('status', 'open')
            .single();

        if (!existing) {
            await createOperationEvent(
                'equipa',
                `Motorista sem viatura: ${driver.nome}`,
                'Este motorista está ativo no sistema mas não tem nenhuma viatura atribuída.',
                'high',
                driver.id
            );
        }
    }
}

/**
 * Checks for vehicles without recent fuel records and generates events.
 */
export async function auditFleetFuelStatus(vehicles: Viatura[], transactions: FuelTransaction[]) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    for (const vehicle of vehicles) {
        const lastTransaction = transactions
            .filter(t => t.vehicleId === vehicle.id && t.status === 'confirmed')
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

        const needsEvent = !lastTransaction || new Date(lastTransaction.timestamp) < sevenDaysAgo;

        if (needsEvent) {
            const { data: existing } = await supabase
                .from('operation_events')
                .select('id')
                .eq('category', 'frota')
                .eq('entity_id', vehicle.id)
                .eq('status', 'open')
                .single();

            if (!existing) {
                await createOperationEvent(
                    'frota',
                    `Sem registo de combustível: ${vehicle.matricula}`,
                    `A viatura ${vehicle.matricula} não tem registos de abastecimento nos últimos 7 dias.`,
                    'normal',
                    vehicle.id
                );
            }
        }
    }
}
