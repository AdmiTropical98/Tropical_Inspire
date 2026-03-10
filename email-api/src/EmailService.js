import nodemailer from 'nodemailer';

export class EmailService {
    constructor() {
        const host = process.env.SMTP_HOST || 'smtp.office365.com';
        const port = Number(process.env.SMTP_PORT || 587);
        const secure = String(process.env.SMTP_SECURE ?? 'false') === 'true';
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;

        this.from = '"Miguel Madeira - Tropical Inspire" <frota@tropicalinspire.pt>';
        this.transporter = nodemailer.createTransport({
            host,
            port,
            secure,
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
        });
    }

    async verifyConnection() {
        return this.transporter.verify();
    }

    async sendPlainEmail({ to, subject, message }) {
        console.log('Sending email to:', to);
        console.log('Subject:', subject);

        try {
            await this.transporter.verify();
            console.log('SMTP connection OK');
        } catch (error) {
            console.error('SMTP connection failed', error);
            throw error;
        }

        try {
            const result = await this.transporter.sendMail({
                from: this.from,
                to,
                subject,
                html: message,
            });
            console.log('Email sent successfully');
            return result;
        } catch (error) {
            console.error('Email sending failed', error);
            throw error;
        }
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
