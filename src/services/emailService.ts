import type { Fatura, Requisicao, Servico } from '../types';
import { supabase } from '../lib/supabase';

type SupplierRequestPayload = {
    to: string;
    numeroRequisicao: string;
    matricula?: string;
    descricao?: string;
    data: string;
};

type InvoicePayload = {
    to: string;
    numeroFatura: string;
    data: string;
    attachmentUrl?: string;
};

type DriverSchedulePayload = {
    to: string;
    nome: string;
    data: string;
    horario: string;
};

type PlainEmailPayload = {
    to: string;
    subject: string;
    message: string;
};

type EmailType = 'supplier_request' | 'invoice' | 'driver_schedule';
type EmailPayload = SupplierRequestPayload | InvoicePayload | DriverSchedulePayload;
type EmailLogStatus = 'sent' | 'failed';

class EmailService {
    private readonly apiBaseUrl: string;

    constructor() {
        this.apiBaseUrl = import.meta.env.VITE_EMAIL_API_URL || '/api/email';
    }

    private async getCurrentUserId(): Promise<string | null> {
        const { data } = await supabase.auth.getUser();
        return data.user?.id || null;
    }

    private async writeLog(type: EmailType, payload: EmailPayload, status: EmailLogStatus, errorMessage?: string) {
        const userId = await this.getCurrentUserId();
        await supabase.from('email_logs').insert({
            user_id: userId,
            email_type: type,
            recipient_email: payload.to,
            payload: payload as unknown as Record<string, unknown>,
            status,
            error_message: errorMessage || null,
        });
    }

    private async send(type: EmailType, payload: EmailPayload) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, payload }),
            });

            if (!response.ok) {
                let message = 'Erro ao enviar email';
                try {
                    const data = await response.json();
                    message = data?.details || data?.error || message;
                } catch {
                    // Keep default message if response body is not JSON.
                }
                throw new Error(message);
            }

            await this.writeLog(type, payload, 'sent');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Erro ao enviar email';
            try {
                await this.writeLog(type, payload, 'failed', message);
            } catch {
                // Never block user flow if audit logging fails.
            }

            if (error instanceof Error) {
                throw error;
            }

            throw new Error(message);
        }
    }

    async sendSupplierRequestEmail(payload: SupplierRequestPayload) {
        await this.send('supplier_request', payload);
    }

    async sendInvoiceEmail(payload: InvoicePayload) {
        await this.send('invoice', payload);
    }

    async sendDriverScheduleEmail(payload: DriverSchedulePayload) {
        await this.send('driver_schedule', payload);
    }

    async sendPlainEmail(payload: PlainEmailPayload) {
        const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            let message = 'Erro ao enviar email';
            try {
                const data = await response.json();
                message = data?.details || data?.error || message;
            } catch {
                // Keep default message if response body is not JSON.
            }
            throw new Error(message);
        }
    }

    mapSupplierRequestPayload(req: Requisicao, supplierEmail: string, vehiclePlate?: string): SupplierRequestPayload {
        const description = (req.itens || []).map(item => item.descricao).filter(Boolean).join(' | ') || req.obs || 'Sem descrição';
        return {
            to: supplierEmail,
            numeroRequisicao: req.numero,
            matricula: vehiclePlate,
            descricao: description,
            data: req.data,
        };
    }

    mapInvoicePayload(invoice: Fatura, clientEmail: string): InvoicePayload {
        return {
            to: clientEmail,
            numeroFatura: invoice.numero,
            data: invoice.data,
        };
    }

    mapDriverSchedulePayload(service: Servico, driverName: string, driverEmail: string, fallbackDate?: string): DriverSchedulePayload {
        return {
            to: driverEmail,
            nome: driverName,
            data: service.data || fallbackDate || new Date().toISOString().split('T')[0],
            horario: service.hora,
        };
    }
}

export const emailService = new EmailService();
