import { supabase } from '../lib/supabase';
import type { OperationType, OperationThread } from '../types';

/**
 * Creates a new operational thread in the database.
 * This is intended for use by system events like schedule conflicts, driver absence, or fleet alerts.
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
