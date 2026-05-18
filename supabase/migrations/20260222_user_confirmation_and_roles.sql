-- Migration: Unified User System with Roles and Email Confirmation
-- Created: 2026-02-22

-- 1. Create Roles Enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM (
            'ADMIN_MASTER',
            'ADMIN',
            'GESTOR',
            'SUPERVISOR',
            'OFICINA',
            'MOTORISTA'
        );
    END IF;
END $$;

-- 2. Create User Profiles Table
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    nome TEXT,
    role public.user_role NOT NULL DEFAULT 'MOTORISTA',
    email_confirmed BOOLEAN DEFAULT FALSE,
    activation_token UUID DEFAULT gen_random_uuid(),
    token_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 4. Policies for user_profiles
-- ADMIN_MASTER and ADMIN can view all profiles
CREATE POLICY "Admins can view all profiles" ON public.user_profiles
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('ADMIN_MASTER', 'ADMIN')
        )
    );

-- Everyone can view their own profile
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- ADMIN_MASTER can update everything
CREATE POLICY "Admin Master can update all" ON public.user_profiles
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'ADMIN_MASTER'
        )
    );

-- 5. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action TEXT NOT NULL,
    performed_by UUID REFERENCES auth.users(id),
    target_id UUID,
    details JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('ADMIN_MASTER', 'ADMIN')
        )
    );

-- 6. Function to handle profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, nome, role, email_confirmed)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'nome',
        COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'MOTORISTA'),
        (NEW.email_confirmed_at IS NOT NULL)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Update UpdatedAt Trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Migration: Link existing tables to profiles if needed
-- For now, we will treat user_profiles as the source of truth for login/auth.
