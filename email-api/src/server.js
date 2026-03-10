import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { EmailService } from './EmailService.js';

dotenv.config();

const app = express();
const port = Number(process.env.EMAIL_API_PORT || 4001);
const allowedOrigin = process.env.EMAIL_API_ALLOWED_ORIGIN || '*';

app.use(cors({
    origin: allowedOrigin,
}));
app.use(express.json());

const emailService = new EmailService();

const sendPlainEmail = async (req, res) => {
    try {
        const { to, subject, message } = req.body || {};

        if (!to || !subject || !message) {
            return res.status(400).json({ error: 'Missing to, subject or message' });
        }

        await emailService.sendPlainEmail({ to, subject, message });
        return res.json({ ok: true, message: 'Email sent' });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to send email', details: error.message });
    }
};

app.get('/health', async (_req, res) => {
    try {
        await emailService.verifyConnection();
        res.json({ ok: true, smtp: 'connected' });
    } catch (error) {
        res.status(500).json({ ok: false, smtp: 'failed', error: error.message });
    }
});

app.post('/api/email/send', async (req, res) => {
    try {
        const { type, payload } = req.body || {};

        if (!type || !payload) {
            return res.status(400).json({ error: 'Missing type or payload' });
        }

        if (type === 'supplier_request') {
            const { to, numeroRequisicao, data } = payload;
            if (!to || !numeroRequisicao || !data) {
                return res.status(400).json({ error: 'Invalid supplier request payload' });
            }
            await emailService.sendSupplierRequestEmail(payload);
            return res.json({ ok: true, message: 'Supplier request email sent' });
        }

        if (type === 'invoice') {
            const { to, numeroFatura, data } = payload;
            if (!to || !numeroFatura || !data) {
                return res.status(400).json({ error: 'Invalid invoice payload' });
            }
            await emailService.sendInvoiceEmail(payload);
            return res.json({ ok: true, message: 'Invoice email sent' });
        }

        if (type === 'driver_schedule') {
            const { to, nome, data, horario } = payload;
            if (!to || !nome || !data || !horario) {
                return res.status(400).json({ error: 'Invalid driver schedule payload' });
            }
            await emailService.sendDriverScheduleEmail(payload);
            return res.json({ ok: true, message: 'Driver schedule email sent' });
        }

        return res.status(400).json({ error: 'Unsupported email type' });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to send email', details: error.message });
    }
});

app.post('/api/send-email', sendPlainEmail);

app.listen(port, () => {
    console.log(`Email API listening on port ${port}`);
});
