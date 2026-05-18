-- EXECUTAR ESTE SCRIPT NO SQL EDITOR DO SUPABASE
-- Objetivo: Resetar a senha do usuário 'rafael.rocha.tech@gmail.com' para '123456' com segurança.

create extension if not exists pgcrypto;

DO $$
BEGIN
    -- 1. Tenta atualizar se o usuário já existir
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'rafael.rocha.tech@gmail.com') THEN
        UPDATE auth.users 
        SET 
            encrypted_password = crypt('123456', gen_salt('bf')),
            email_confirmed_at = now(),
            updated_at = now(),
            raw_app_meta_data = '{"provider":"email","providers":["email"]}'
        WHERE email = 'rafael.rocha.tech@gmail.com';
        
    -- 2. Se não existir, cria o usuário
    ELSE
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            recovery_sent_at,
            last_sign_in_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            'rafael.rocha.tech@gmail.com',
            crypt('123456', gen_salt('bf')),
            now(),
            now(),
            now(),
            '{"provider":"email","providers":["email"]}',
            '{}',
            now(),
            now(),
            '',
            '',
            '',
            ''
        );
    END IF;
END $$;
