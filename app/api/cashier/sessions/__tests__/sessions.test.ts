import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

const mockValidateApiAccess = vi.fn();
const mockRequireSupabaseAdminConfig = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/utils/supabase/server', () => ({
    validateApiAccess: (...args: any[]) => mockValidateApiAccess(...args),
    requireSupabaseAdminConfig: (...args: any[]) => mockRequireSupabaseAdminConfig(...args),
    handleServerError: (err: any) =>
        NextResponse.json({ error: 'Error interno del servidor. Por favor intente más tarde.', detail: err?.message }, { status: 500 }),
    supabaseAdmin: {
        from: (...args: any[]) => mockFrom(...args),
    },
}));

import { POST as openSessionPOST } from '../open/route';
import { GET as statusSessionGET } from '../status/route';

describe('Cashier Sessions API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockValidateApiAccess.mockResolvedValue({
            errorResponse: null,
            user: { id: '11111111-1111-4111-8111-111111111111', role: 'administrador' },
        });
        mockRequireSupabaseAdminConfig.mockReturnValue(null);
    });

    it('GET /status returns 500 if SUPABASE_SERVICE_ROLE_KEY is missing instead of false isOpen', async () => {
        mockRequireSupabaseAdminConfig.mockReturnValue(
            NextResponse.json(
                { error: 'Configuración incompleta del servidor: falta la clave de servicio de Supabase.' },
                { status: 500 }
            )
        );

        const req = new Request('http://localhost/api/cashier/sessions/status');
        const res = await statusSessionGET(req);
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body.error).toContain('Configuración incompleta del servidor');
        expect(mockFrom).not.toHaveBeenCalled();
    });

    it('POST /open returns 500 with config error when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
        mockRequireSupabaseAdminConfig.mockReturnValue(
            NextResponse.json(
                { error: 'Configuración incompleta del servidor: falta la clave de servicio de Supabase.' },
                { status: 500 }
            )
        );

        const req = new Request('http://localhost/api/cashier/sessions/open', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cashier_name: 'Luis Gotopo', initial_fund: 500, notes: 'EMPTY' }),
        });
        const res = await openSessionPOST(req);
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body.error).toContain('Configuración incompleta del servidor');
    });

    it('POST /open returns 400 when initial_fund is negative', async () => {
        const req = new Request('http://localhost/api/cashier/sessions/open', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cashier_name: 'Luis Gotopo', initial_fund: -10, notes: '' }),
        });
        const res = await openSessionPOST(req);

        expect(res.status).toBe(400);
    });

    it('POST /open returns existing open session with opened_at and initial_fund without inserting duplicate', async () => {
        const existing = {
            id: 'fe02dac1-436c-46c5-bcef-766295462e33',
            opened_at: '2026-09-08T13:19:57.758+00:00',
            initial_fund: 500,
        };
        const maybeSingle = vi.fn().mockResolvedValue({ data: existing, error: null });
        const limit = vi.fn().mockReturnValue({ maybeSingle });
        const order = vi.fn().mockReturnValue({ limit });
        const eq2 = vi.fn().mockReturnValue({ order });
        const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
        const select = vi.fn().mockReturnValue({ eq: eq1 });
        mockFrom.mockReturnValue({ select });

        const req = new Request('http://localhost/api/cashier/sessions/open', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cashier_name: 'Luis Gotopo', initial_fund: 500, notes: 'EMPTY' }),
        });
        const res = await openSessionPOST(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.session).toEqual(existing);
        expect(select).toHaveBeenCalledWith('id, opened_at, initial_fund');
    });

    it('POST /open inserts new session when no open session exists', async () => {
        const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        const limit = vi.fn().mockReturnValue({ maybeSingle });
        const order = vi.fn().mockReturnValue({ limit });
        const eq2 = vi.fn().mockReturnValue({ order });
        const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
        const checkSelect = vi.fn().mockReturnValue({ eq: eq1 });

        const created = {
            id: '22222222-2222-4222-8222-222222222222',
            cashier_name: 'Luis Gotopo',
            initial_fund: 500,
            status: 'open',
            opened_at: '2026-11-14T20:00:00.000Z',
        };
        const insertSingle = vi.fn().mockResolvedValue({ data: created, error: null });
        const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
        const insert = vi.fn().mockReturnValue({ select: insertSelect });

        mockFrom
            .mockReturnValueOnce({ select: checkSelect })
            .mockReturnValueOnce({ insert });

        const req = new Request('http://localhost/api/cashier/sessions/open', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cashier_name: 'Luis Gotopo', initial_fund: 500, notes: '' }),
        });
        const res = await openSessionPOST(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.session).toEqual(created);
        expect(insert).toHaveBeenCalledWith([
            expect.objectContaining({
                cashier_name: 'Luis Gotopo',
                user_id: '11111111-1111-4111-8111-111111111111',
                initial_fund: 500,
                notes: 'EMPTY',
                status: 'open',
            }),
        ]);
    });
});

