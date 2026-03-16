# Gestão Frota

A Portuguese fleet management web application built with React + Vite and Supabase as the backend.

## Architecture

- **Frontend**: React 19 + TypeScript + Tailwind CSS + Vite
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Build Tool**: Vite 5
- **Package Manager**: npm
- **PWA**: vite-plugin-pwa (Progressive Web App support)

## Features

- Fleet vehicle management (Viaturas)
- Driver management (Motoristas)
- Work schedules (Escalas)
- Work hours tracking (Horas)
- Fuel management (Combustível)
- Maintenance/workshop management
- Cost center tracking
- Requisitions/requests system
- Dashboard with charts (Recharts)
- Real-time chat (Supabase Realtime)
- PDF generation (jsPDF)
- Map integration (Leaflet)
- Role-based permissions

## Environment Variables

- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD` - FTP deployment credentials
- `SMTP_*` - Email configuration for the email-api service

## Development

```bash
npm run dev       # Start dev server on port 5000
npm run build     # Build for production
npm run preview   # Preview production build
```

## Project Structure

- `src/` - React application source
  - `pages/` - Page components
  - `components/` - Reusable components
  - `contexts/` - React contexts (Auth, Permissions, Chat)
  - `hooks/` - Custom hooks
  - `lib/` - Supabase client and utilities
  - `services/` - API service layers
  - `types/` - TypeScript type definitions
- `public/` - Static assets
- `email-api/` - Optional Node.js email service (port 4001)
- `supabase/` - Supabase configuration/migrations

## Deployment

Configured as a **static** deployment:
- Build: `npm run build`
- Public dir: `dist`
