import { supabase } from '../lib/supabase';
import type { OperationType, OperationThread, OperationEvent, OperationCategory } from '../types';

/**
 * Creates a new operational thread in the database.
 */
export async function createOperationalThread(
    type: OperationType,
    title: string,
    relations?: {
        userId?: string;
        vehicleId?: string;
        scheduleId?: string;
    }
): Promise<OperationThread | null> {
    try {
        const { data, error } = await supabase
            .from('operation_threads')
            .insert({
                type,
                title,
                related_user: relations?.userId,
                related_vehicle: relations?.vehicleId,
                related_schedule: relations?.scheduleId,
                status: 'active'
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating operational thread:', error);
            return null;
        }

        return data as OperationThread;
    } catch (err) {
        console.error('Unexpected error creating operational thread:', err);
        return null;
    }
}

/**
 * Sends a message within an operational thread.
 */
export async function sendOperationMessage(
    threadId: string,
    senderId: string,
    message: string,
    systemGenerated: boolean = false
) {
    try {
        const { error } = await supabase
            .from('operation_messages')
            .insert({
                thread_id: threadId,
                sender_id: senderId,
                message,
                system_generated: systemGenerated
            });

        if (error) {
            console.error('Error sending operation message:', error);
            return false;
        }

        return true;
    } catch (err) {
        console.error('Unexpected error sending operation message:', err);
        return false;
    }
}

/**
 * Creates an operational event.
 */
export async function createOperationEvent(
    category: OperationCategory,
    title: string,
    description?: string,
    priority: OperationEvent['priority'] = 'normal',
    relatedEntity?: string
) {
    try {
        const { data, error } = await supabase
            .from('operation_events')
            .insert({
                category,
                title,
                description,
                priority,
                related_entity: relatedEntity,
                status: 'open'
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating operation event:', error);
            return null;
        }

        return data as OperationEvent;
    } catch (err) {
        console.error('Unexpected error creating operation event:', err);
        return null;
    }
}

/**
 * Fetches events for a specific category.
 */
export async function fetchOperationEvents(category: OperationCategory): Promise<OperationEvent[]> {
    try {
        const { data, error } = await supabase
            .from('operation_events')
            .select('*')
            .eq('category', category)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching operation events:', error);
            return [];
        }

        return data as OperationEvent[];
    } catch (err) {
        console.error('Unexpected error fetching operation events:', err);
        return [];
    }
}
