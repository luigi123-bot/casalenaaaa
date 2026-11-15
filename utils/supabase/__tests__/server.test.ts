import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('next/headers', () => ({
    cookies: vi.fn(),
}));

import { isSupabaseAdminConfigured, requireSupabaseAdminConfig } from '../server';

describe('utils/supabase/server admin configuration guards', () => {
    const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const origServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        if (origUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        else process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;

        if (origServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        else process.env.SUPABASE_SERVICE_ROLE_KEY = origServiceKey;

        vi.restoreAllMocks();
    });

    it('returns false and a 500 response when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;

        expect(isSupabaseAdminConfigured()).toBe(false);
        const res = requireSupabaseAdminConfig();
        expect(res).not.toBeNull();
        expect(res!.status).toBe(500);
        const body = await res!.json();
        expect(body.error).toContain('clave de servicio');
    });

    it('returns true and null when both URL and SUPABASE_SERVICE_ROLE_KEY are set', () => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret';

        expect(isSupabaseAdminConfigured()).toBe(true);
        expect(requireSupabaseAdminConfig()).toBeNull();
    });
});

