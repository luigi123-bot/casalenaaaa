import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import CierreCajaModal from '../CierreCajaModal';

describe('CierreCajaModal', () => {
    const mockSummary = {
        fechaTurno: '15 de noviembre',
        totalOrdenes: 3,
        totalVentas: 100.3,
        ventasEfectivo: 0.2,
        ventasTarjeta: 100.1,
        ventasOtro: 0,
        totalProductos: 3,
        topProductos: [{ name: 'Pizza Margarita', qty: 3 }],
        ordenesPorTipo: [{ tipo: 'takeout', count: 3, total: 100.3 }],
        ticketPromedio: 33.43,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    function mockInitialEndpoints(initialFund = 100.1) {
        return vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('/api/cashier/sessions/status')) {
                return new Response(
                    JSON.stringify({
                        isOpen: true,
                        session: { id: '11111111-1111-4111-8111-111111111111', initial_fund: initialFund },
                    }),
                    { status: 200 }
                );
            }
            if (url.includes('/api/cashier/closure-summary')) {
                return new Response(JSON.stringify(mockSummary), { status: 200 });
            }
            if (url.includes('/api/cashier/sessions/close')) {
                return new Response(JSON.stringify({ success: true }), { status: 200 });
            }
            return new Response('{}', { status: 404 });
        });
    }

    it('avoids float precision errors (0.2 + 100.1 - 100.3 === 0) and confirms closure', async () => {
        const fetchMock = mockInitialEndpoints(100.1);
        vi.stubGlobal('fetch', fetchMock);

        render(<CierreCajaModal cashierName="Ana" userId="u-1" onClose={vi.fn()} />);

        // Step 1: Summary loads
        expect(await screen.findByText('Pizza Margarita')).toBeInTheDocument();

        // Next -> Step 2 (Cuadre)
        fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
        const inputs = screen.getAllByPlaceholderText('0.00');
        // Second input is efectivo contado
        fireEvent.change(inputs[1], { target: { value: '100.30' } });

        // Next -> Step 3 (Gastos) -> Next -> Step 4 (Confirm)
        fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
        fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));

        expect(await screen.findByText('+0.00')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Confirmar y Cerrar Turno/i }));

        expect(await screen.findByText('¡Turno Cerrado!')).toBeInTheDocument();
        const closeCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/api/cashier/sessions/close'));
        expect(closeCall).toBeDefined();
    });

    it('blocks negative cash/expense values and shows validation error before posting', async () => {
        const fetchMock = mockInitialEndpoints(100);
        vi.stubGlobal('fetch', fetchMock);

        render(<CierreCajaModal cashierName="Ana" userId="u-2" onClose={vi.fn()} />);
        expect(await screen.findByText('Pizza Margarita')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
        const inputs = screen.getAllByPlaceholderText('0.00');
        fireEvent.change(inputs[1], { target: { value: '-50' } });

        fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
        fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
        fireEvent.click(screen.getByRole('button', { name: /Confirmar y Cerrar Turno/i }));

        expect(await screen.findByText(/no pueden ser negativos/i)).toBeInTheDocument();
        const closeCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes('/api/cashier/sessions/close'));
        expect(closeCalls).toHaveLength(0);
    });

    it('displays Spanish timeout error when AbortController aborts summary fetch after 15s', async () => {
        vi.useFakeTimers();

        vi.stubGlobal(
            'fetch',
            vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
                if (String(input).includes('/api/cashier/sessions/status')) {
                    return Promise.resolve(
                        new Response(
                            JSON.stringify({
                                isOpen: true,
                                session: { id: '11111111-1111-4111-8111-111111111111', initial_fund: 500 },
                            }),
                            { status: 200 }
                        )
                    );
                }
                return new Promise((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => {
                        const err = new Error('The operation was aborted.');
                        err.name = 'AbortError';
                        reject(err);
                    });
                });
            })
        );

        render(<CierreCajaModal cashierName="Ana" userId="u-3" onClose={vi.fn()} />);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(15500);
        });
        vi.useRealTimers();

        await waitFor(() => {
            expect(screen.getByText(/El servidor no respondió a tiempo/i)).toBeInTheDocument();
        });
    });
});

