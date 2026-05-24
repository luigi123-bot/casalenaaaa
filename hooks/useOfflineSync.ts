'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase/client';

interface PendingOrder {
    id: string; // ID temporal local
    payload: any;
    items: any[];
    timestamp: number;
}

export function useOfflineSync() {
    const [isOnline, setIsOnline] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        // Inicializar estado de conexión
        if (typeof navigator !== 'undefined') {
            setIsOnline(navigator.onLine);
        }

        const handleOnline = () => {
            console.log('🌐 [OfflineSync] Conexión restablecida.');
            setIsOnline(true);
        };

        const handleOffline = () => {
            console.log('🚫 [OfflineSync] Sin conexión a internet.');
            setIsOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Cargar contador de órdenes pendientes
        const loadPending = () => {
            try {
                const pending = JSON.parse(localStorage.getItem('pending_orders') || '[]');
                setPendingCount(pending.length);
            } catch (e) {
                setPendingCount(0);
            }
        };

        loadPending();

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // ✅ FIX: syncOrders wrapped in useCallback to avoid stale closure
    const syncOrders = useCallback(async () => {
        let pending: PendingOrder[] = [];
        try {
            pending = JSON.parse(localStorage.getItem('pending_orders') || '[]');
        } catch (e) {
            return;
        }

        if (pending.length === 0) return;

        setIsSyncing(true);
        console.log(`🔄 [OfflineSync] Sincronizando ${pending.length} pedidos guardados localmente...`);

        const remaining: PendingOrder[] = [];

        // Obtener el ID del usuario actual de la sesión cargada para evitar bloqueos
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id;

        for (const order of pending) {
            // Pequeño retardo entre pedidos para evitar saturación y errores de 'AbortError/Locks'
            await new Promise(resolve => setTimeout(resolve, 300));

            try {
                // Guard: skip corrupt entries without payload
                if (!order.payload || typeof order.payload !== 'object') {
                    console.warn('⚠️ [OfflineSync] Descartando entrada corrupta (sin payload):', order.id);
                    continue;
                }

                // Parche automático: Si una orden offline vieja guardó el estado inválido 'abierta', lo corregimos a 'pendiente'
                if (order.payload.status === 'abierta') {
                    order.payload.status = 'pendiente';
                }

                // Parche automático: Eliminar columnas de nueva versión que no existen en la base de datos Supabase remota del usuario
                if ('cashier_name' in order.payload) delete order.payload.cashier_name;
                if ('ticket_number' in order.payload) delete order.payload.ticket_number;
                if ('updated_at' in order.payload) delete order.payload.updated_at;
                if ('closed_at' in order.payload) delete order.payload.closed_at;

                // Parche automático: Si el user_id es nulo o 'offline-placeholder', intentamos poner el ID real del cajero actual
                const isPlaceholder = order.payload.user_id === 'offline-placeholder';
                const isNull = order.payload.user_id === null;
                
                if (isPlaceholder || isNull) {
                    if (currentUserId) {
                        order.payload.user_id = currentUserId;
                    } else {
                        // Si no hay usuario y Postgres da error, mejor eliminar el campo para que Supabase intente 
                        // usar las políticas de 'anon' o el default de la tabla si existe.
                        delete order.payload.user_id; 
                    }
                }

                // 1. Sincronizar usando la API consolidada (más robusto y no requiere RLS de sesión)
                const response = await fetch('/api/cashier/save-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        order: order.payload,
                        items: order.items
                    })
                });

                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || 'Error en servidor durante sincronización');
                }

                const result = await response.json();
                const createdOrder = result.order;

                if (!createdOrder) throw new Error('No se pudo confirmar la creación en la BD.');

                console.log(`✅ [OfflineSync] Pedido sincronizado éxito: ID local ${order.id} -> DB ${createdOrder.id}`);
            } catch (err) {
                console.error('❌ [OfflineSync] Fallo al sincronizar pedido individual:', err);
                remaining.push(order); // Mantener para el siguiente intento
            }
        }

        localStorage.setItem('pending_orders', JSON.stringify(remaining));
        setPendingCount(remaining.length);
        setIsSyncing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // stable ref — reads isSyncing via closure but doesn't need to re-bind

    // Sincronizar automáticamente cuando vuelve la conexión
    useEffect(() => {
        if (isOnline && !isSyncing) {
            syncOrders();
        }
    }, [isOnline, syncOrders]); // ✅ FIX: correct deps

    const saveOrderOffline = (payload: any, items: any[]) => {
        try {
            const pending: PendingOrder[] = JSON.parse(localStorage.getItem('pending_orders') || '[]');
            const newOrder: PendingOrder = {
                id: crypto.randomUUID(),
                payload,
                items,
                timestamp: Date.now()
            };
            pending.push(newOrder);
            localStorage.setItem('pending_orders', JSON.stringify(pending));
            setPendingCount(pending.length);
            console.log('📦 [OfflineSync] Pedido guardado en almacenamiento local (Modo Offline).');
            return newOrder.id;
        } catch (err) {
            console.error('❌ [OfflineSync] Error al guardar pedido localmente:', err);
            return null;
        }
    };

    return {
        isOnline,
        isSyncing,
        pendingCount,
        saveOrderOffline,
        syncOrders
    };
}
