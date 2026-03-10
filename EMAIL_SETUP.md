# SmartFleet Email Setup

## 1) Backend SMTP API (secure)

The email backend is in `email-api/` and uses `nodemailer` with Hostinger SMTP.

### Install dependencies

```bash
cd email-api
npm install
```

### Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your real SMTP credentials:

- `SMTP_HOST=smtp.hostinger.com`
- `SMTP_PORT=465`
- `SMTP_SECURE=true`
- `SMTP_USER=...`
- `SMTP_PASS=...`
- `SMTP_FROM="SmartFleet <...>"`
- `EMAIL_API_ALLOWED_ORIGIN=https://your-domain.com`

### Run backend locally

```bash
npm run dev
```

Health check:

```bash
curl http://localhost:4001/health
```

## 2) Frontend integration

Frontend calls `POST /api/email/send` through `src/services/emailService.ts`.

In development, Vite proxies `/api/email` to `http://localhost:4001`.

For production, set:

- `VITE_EMAIL_API_URL=https://your-email-api-domain/api/email`

Optional automatic sends:

- `VITE_EMAIL_AUTO_SEND=true`

When enabled:

- New requisitions auto-send email to supplier (if supplier email exists)
- Bulk driver assignment in schedules auto-sends scale emails (if driver email exists)

## 3) UI buttons added

- Requisições: "Enviar Email"
- Faturas: "Enviar Fatura"
- Escalas: "Enviar Escala"

## 4) Security note

SMTP credentials are never exposed in frontend code. Only the backend API holds and uses SMTP secrets.
