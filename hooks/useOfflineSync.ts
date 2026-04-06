'use client';

import { useState, useEffect } from 'react';
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

    // Sincronizar automáticamente cuando vuelve la conexión
    useEffect(() => {
        if (isOnline && !isSyncing) {
            syncOrders();
        }
    }, [isOnline]);

    const syncOrders = async () => {
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

        for (const order of pending) {
            try {
                // Guard: skip corrupt entries without payload
                if (!order.payload || typeof order.payload !== 'object') {
                    console.warn('⚠️ [OfflineSync] Descartando entrada corrupta (sin payload):', order.id);
                    continue;
                }

                // 1. Insertar la Orden
                const { data: orderData, error: orderError } = await supabase
                    .from('orders')
                    .insert(order.payload)
                    .select();

                if (orderError) {
                    console.error('❌ [OfflineSync] Error Supabase al insertar orden:', {
                        message: orderError.message,
                        code: orderError.code,
                        details: orderError.details,
                        hint: orderError.hint,
                        payload: order.payload
                    });
                    throw orderError;
                }
                const createdOrder = orderData?.[0];

                if (!createdOrder) throw new Error('No se pudo crear la orden en la BD.');

                // 2. Insertar los Items de esa Orden
                const orderItems = order.items.map(item => ({
                    ...item,
                    order_id: createdOrder.id
                }));

                const { error: itemsError } = await supabase
                    .from('order_items')
                    .insert(orderItems);

                if (itemsError) {
                    console.error('❌ [OfflineSync] Error Supabase al insertar items:', {
                        message: itemsError.message,
                        code: itemsError.code,
                        details: itemsError.details,
                    });
                    throw itemsError;
                }

                console.log(`✅ [OfflineSync] Pedido sincronizado éxito: ID local ${order.id} -> DB ${createdOrder.id}`);
            } catch (err) {
                console.error('❌ [OfflineSync] Fallo al sincronizar pedido individual:', err);
                remaining.push(order); // Mantener para el siguiente intento
            }
        }

        localStorage.setItem('pending_orders', JSON.stringify(remaining));
        setPendingCount(remaining.length);
        setIsSyncing(false);
    };

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
