import nodemailer from 'nodemailer';

export class EmailService {
    constructor() {
        const host = process.env.SMTP_HOST || 'smtp.hostinger.com';
        const port = Number(process.env.SMTP_PORT || 465);
        const secure = String(process.env.SMTP_SECURE ?? 'true') !== 'false';

        this.from = process.env.SMTP_FROM || process.env.SMTP_USER;
        this.transporter = nodemailer.createTransport({
            host,
            port,
            secure,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }

    async verifyConnection() {
        return this.transporter.verify();
    }

    async sendSupplierRequestEmail({ to, numeroRequisicao, matricula, descricao, data }) {
        return this.transporter.sendMail({
            from: this.from,
            to,
            subject: 'Nova Requisição - SmartFleet',
            text: [
                'Boa tarde,',
                '',
                'Foi criada uma nova requisição de serviço.',
                '',
                `Número: ${numeroRequisicao}`,
                `Viatura: ${matricula || 'N/A'}`,
                `Descrição: ${descricao || 'Sem descrição'}`,
                `Data: ${data}`,
                '',
                'Por favor confirme a receção.',
                '',
                'Cumprimentos',
                'SmartFleet',
            ].join('\n'),
        });
    }

    async sendInvoiceEmail({ to, numeroFatura, data, attachmentUrl }) {
        const attachments = attachmentUrl
            ? [{ filename: `Fatura_${numeroFatura}.pdf`, path: attachmentUrl }]
            : [];

        return this.transporter.sendMail({
            from: this.from,
            to,
            subject: 'Fatura - SmartFleet',
            text: [
                'Boa tarde,',
                '',
                'Segue em anexo a fatura referente ao serviço realizado.',
                '',
                `Número da fatura: ${numeroFatura}`,
                `Data: ${data}`,
                '',
                'Cumprimentos',
                'SmartFleet',
            ].join('\n'),
            attachments,
        });
    }

    async sendDriverScheduleEmail({ to, nome, data, horario }) {
        return this.transporter.sendMail({
            from: this.from,
            to,
            subject: 'Nova Escala - SmartFleet',
            text: [
                'Boa tarde,',
                '',
                'Foi atribuída uma nova escala.',
                '',
                `Motorista: ${nome}`,
                `Data: ${data}`,
                `Horário: ${horario}`,
                '',
                'Cumprimentos',
                'SmartFleet',
            ].join('\n'),
        });
    }
}
