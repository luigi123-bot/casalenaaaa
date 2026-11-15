import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

const mockValidateApiAccess = vi.fn();
const mockRequireSupabaseAdminConfig = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/utils/supabase/server', () => ({
    validateApiAccess: (...args: any[]) => mockValidateApiAccess(...args),
    requireSupabaseAdminConfig: (...args: any[]) => mockRequireSupabaseAdminConfig(...args),
    handleServerError: () =>
        NextResponse.json(
            { error: 'Error interno del servidor. Por favor intente más tarde.' },
            { status: 500 }
        ),
    supabaseAdmin: {
        from: (...args: any[]) => mockFrom(...args),
    },
}));

import { POST as closeSessionPOST } from '../sessions/close/route';
import { GET as closureSummaryGET } from '../closure-summary/route';
import { POST as saveOrderPOST } from '../save-order/route';

const SESSION_UUID = '11111111-1111-4111-8111-111111111111';
const USER_A = '22222222-2222-4222-8222-222222222222';
const USER_B = '33333333-3333-4333-8333-333333333333';

const validCloseBody = (overrides: Record<string, any> = {}) => ({
    activeSessionId: SESSION_UUID,
    metrics: {
        status: 'closed',
        notes: 'Fin turno',
        initial_fund: 9999, // intentionally tampered
        expected_cash: 0,
        final_cash: 700,
    },
    legacyPayload: {
        fecha_turno: '15 noviembre',
        cajero: 'Cajero Test',
        total_ordenes: 2,
        total_productos: 3,
        total_ventas: 400,
        ventas_efectivo: 250,
        ventas_tarjeta: 150,
        ventas_otro: 0,
        ticket_promedio: 200,
        fondo_inicial: 9999,
        efectivo_esperado: 0,
        efectivo_contado: 700,
        diferencia: 700,
        top_productos: [],
        gastos_combustible: 20,
        gastos_insumo_cocina: 30,
        gastos_insumo_limpieza: 0,
        total_gastos: 50,
    },
    ...overrides,
});

describe('Cashier API Routes Hardening', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockValidateApiAccess.mockResolvedValue({
            errorResponse: null,
            user: { id: USER_A, role: 'cajero' },
        });
        mockRequireSupabaseAdminConfig.mockReturnValue(null);
    });

    describe('POST /api/cashier/sessions/close', () => {
        it('rejects IDOR when non-admin cashier tries to close another user session', async () => {
            const maybeSingle = vi.fn().mockResolvedValue({
                data: { id: SESSION_UUID, user_id: USER_B, initial_fund: 500, opened_at: '2026-11-15T12:00:00.000Z', status: 'open' },
                error: null,
            });
            mockFrom.mockReturnValue({
                select: () => ({ eq: () => ({ maybeSingle }) }),
            });

            const req = new Request('http://localhost/api/cashier/sessions/close', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(validCloseBody()),
            });

            const res = await closeSessionPOST(req);
            expect(res.status).toBe(403);
        });

        it('recalculates expected_cash & difference from DB initial_fund and rolls back if cash_closures insert fails', async () => {
            let capturedSessionUpdate: any = null;
            let rollbackPayload: any = null;
            let updateCallCount = 0;

            mockFrom.mockImplementation((table: string) => {
                if (table === 'cashier_sessions') {
                    return {
                        select: () => ({
                            eq: () => ({
                                maybeSingle: vi.fn().mockResolvedValue({
                                    data: {
                                        id: SESSION_UUID,
                                        user_id: USER_A,
                                        initial_fund: 500,
                                        opened_at: '2026-11-15T12:00:00.000Z',
                                        status: 'open',
                                    },
                                    error: null,
                                }),
                            }),
                        }),
                        update: (payload: any) => {
                            updateCallCount++;
                            if (updateCallCount === 1) {
                                capturedSessionUpdate = payload;
                                return {
                                    eq: () => ({
                                        eq: () => ({
                                            select: () => ({
                                                maybeSingle: vi.fn().mockResolvedValue({
                                                    data: { id: SESSION_UUID },
                                                    error: null,
                                                }),
                                            }),
                                        }),
                                    }),
                                };
                            }
                            rollbackPayload = payload;
                            return { eq: vi.fn().mockResolvedValue({ error: null }) };
                        },
                    };
                }
                if (table === 'cash_closures') {
                    return {
                        insert: vi.fn().mockResolvedValue({ error: new Error('DB insert failed') }),
                    };
                }
                return {};
            });

            const req = new Request('http://localhost/api/cashier/sessions/close', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(validCloseBody()),
            });

            const res = await closeSessionPOST(req);
            expect(res.status).toBe(500);
            // Expected cash = DB initial_fund (500) + ventas_efectivo (250) - total_gastos (50) = 700
            expect(capturedSessionUpdate.expected_cash).toBe(700);
            expect(capturedSessionUpdate.difference).toBe(0);
            // Rollback reopens the session so cashier can retry
            expect(rollbackPayload).toEqual({ status: 'open', closed_at: null });
        });

        it('returns 409 if atomic open -> closed conditional update finds no open session', async () => {
            mockFrom.mockImplementation((table: string) => {
                if (table === 'cashier_sessions') {
                    return {
                        select: () => ({
                            eq: () => ({
                                maybeSingle: vi.fn().mockResolvedValue({
                                    data: {
                                        id: SESSION_UUID,
                                        user_id: USER_A,
                                        initial_fund: 500,
                                        opened_at: '2026-11-15T12:00:00.000Z',
                                        status: 'open',
                                    },
                                    error: null,
                                }),
                            }),
                        }),
                        update: () => ({
                            eq: () => ({
                                eq: () => ({
                                    select: () => ({
                                        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                                    }),
                                }),
                            }),
                        }),
                    };
                }
                return {};
            });

            const req = new Request('http://localhost/api/cashier/sessions/close', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(validCloseBody()),
            });

            const res = await closeSessionPOST(req);
            expect(res.status).toBe(409);
        });
    });

    describe('GET /api/cashier/closure-summary', () => {
        it('uses session.user_id for orders query, computes Mexico City hours, and preserves zero quantities', async () => {
            mockValidateApiAccess.mockResolvedValue({
                errorResponse: null,
                user: { id: USER_A, role: 'administrador' },
            });

            let queriedUserId: string | null = null;

            mockFrom.mockImplementation((table: string) => {
                if (table === 'cashier_sessions') {
                    return {
                        select: () => ({
                            eq: () => ({
                                maybeSingle: vi.fn().mockResolvedValue({
                                    data: {
                                        id: SESSION_UUID,
                                        opened_at: '2026-11-14T14:00:00.000Z',
                                        closed_at: null,
                                        user_id: USER_B,
                                    },
                                    error: null,
                                }),
                            }),
                        }),
                    };
                }
                if (table === 'orders') {
                    const queryChain: any = {
                        eq: (col: string, val: string) => {
                            if (col === 'user_id') queriedUserId = val;
                            return queryChain;
                        },
                        gte: () => queryChain,
                        neq: () =>
                            Promise.resolve({
                                data: [
                                    {
                                        id: 1,
                                        ticket_number: 1,
                                        total_amount: 120.1,
                                        payment_method: 'transferencia',
                                        order_type: 'takeout',
                                        status: 'completado',
                                        // 05:30 UTC Nov 15 = 23:30 Mexico City Nov 14
                                        created_at: '2026-11-15T05:30:00.000Z',
                                        order_items: [
                                            { product_name: 'Pizza Pepperoni', quantity: 0 },
                                            { product_name: 'Coca Cola', quantity: 2 },
                                        ],
                                    },
                                ],
                                error: null,
                            }),
                    };
                    return { select: () => queryChain };
                }
                return {};
            });

            const req = new Request(`http://localhost/api/cashier/closure-summary?sessionId=${SESSION_UUID}`);
            const res = await closureSummaryGET(req);
            const summary = await res.json();

            expect(res.status).toBe(200);
            expect(queriedUserId).toBe(USER_B);
            expect(summary.totalProductos).toBe(2); // zero quantity did NOT fallback to 1
            expect(summary.ventasOtro).toBe(120.1);
            expect(summary.ventasPorHora[23]).toEqual({ hora: 23, total: 120.1, count: 1 });
        });
    });

    describe('POST /api/cashier/save-order', () => {
        it('treats empty string table_number/id as null and rolls back newly created order if order_items insert fails', async () => {
            let deletedOrderId: number | null = null;
            let insertedOrderRow: any = null;

            mockFrom.mockImplementation((table: string) => {
                if (table === 'orders') {
                    return {
                        select: () => ({
                            eq: () => ({
                                eq: () => ({
                                    gte: () => ({
                                        order: () => ({
                                            limit: () => ({
                                                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                                            }),
                                        }),
                                    }),
                                }),
                            }),
                            gte: () => ({
                                not: () => ({
                                    order: vi.fn().mockResolvedValue({ data: [], error: null }),
                                }),
                            }),
                        }),
                        insert: (row: any) => {
                            insertedOrderRow = row;
                            return {
                                select: () => ({
                                    single: vi.fn().mockResolvedValue({ data: { id: 777, ...row }, error: null }),
                                }),
                            };
                        },
                        delete: () => ({
                            eq: (_col: string, id: number) => {
                                deletedOrderId = id;
                                return Promise.resolve({ error: null });
                            },
                        }),
                    };
                }
                if (table === 'order_items') {
                    return {
                        insert: vi.fn().mockResolvedValue({ error: new Error('Items insert failed') }),
                    };
                }
                return {};
            });

            const req = new Request('http://localhost/api/cashier/save-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order: {
                        id: '',
                        order_type: 'takeout',
                        table_number: '',
                        total_amount: 150,
                        payment_method: 'efectivo',
                    },
                    items: [
                        { product_name: 'Pizza Margarita', quantity: 1, unit_price: 150 },
                    ],
                }),
            });

            const res = await saveOrderPOST(req);
            const body = await res.json();

            expect(res.status).toBe(500);
            expect(body.error).toBe('Error interno del servidor. Por favor intente más tarde.');
            expect(insertedOrderRow.table_number).toBeNull();
            expect(deletedOrderId).toBe(777);
        });
    });
});

