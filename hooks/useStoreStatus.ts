'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';

export interface StoreSettings {
    restaurant_name: string;
    is_open: boolean;
    automatic_schedule: boolean;
    open_time: string;
    close_time: string;
}

export function useStoreStatus() {
    const [status, setStatus] = useState({
        isOpen: true,
        isAutomatic: false,
        isLoading: true
    });

    useEffect(() => {
        let interval: NodeJS.Timeout;

        const checkStatus = async () => {
            try {
                const { data, error } = await supabase
                    .from('settings')
                    .select('is_open, automatic_schedule, open_time, close_time')
                    .eq('id', 1)
                    .single();

                if (error || !data) {
                    console.warn("⚠️ [StoreStatus] Error fetching, checking cache...");
                    const cached = localStorage.getItem('cached_store_settings');
                    if (cached) {
                        updateStatusFromData(JSON.parse(cached));
                    }
                    setStatus(prev => ({ ...prev, isLoading: false }));
                    return;
                }

                // Cache the successful result
                localStorage.setItem('cached_store_settings', JSON.stringify(data));
                updateStatusFromData(data);

            } catch (err) {
                console.warn("⚠️ [StoreStatus] Network error, checking cache...");
                const cached = localStorage.getItem('cached_store_settings');
                if (cached) {
                    const data = JSON.parse(cached);
                    updateStatusFromData(data);
                }
                setStatus(prev => ({ ...prev, isLoading: false }));
            }
        };

        const updateStatusFromData = (data: any) => {
            const now = new Date();
            const currentTimeStr = now.toLocaleTimeString('es-ES', { hour12: false, hour: '2-digit', minute: '2-digit' });

            let isOpen = data.is_open;

            if (data.automatic_schedule && data.open_time && data.close_time) {
                const open = data.open_time.slice(0, 5);
                const close = data.close_time.slice(0, 5);
                const current = currentTimeStr;

                if (close < open) {
                    // Overnight schedule
                    isOpen = current >= open || current < close;
                } else {
                    // Same day schedule
                    isOpen = current >= open && current < close;
                }
            }

            setStatus({
                isOpen,
                isAutomatic: data.automatic_schedule,
                isLoading: false
            });
        };

        // Initial fetch
        checkStatus();

        // Realtime Subscription
        const channel = supabase
            .channel('settings_changes')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'settings',
                    filter: 'id=eq.1'
                },
                (payload) => {
                    console.log('Settings updated realtime:', payload.new);
                    updateStatusFromData(payload.new);
                }
            )
            .subscribe();

        // Polling interaction for automatic schedule time changes
        interval = setInterval(checkStatus, 60000);

        return () => {
            clearInterval(interval);
            supabase.removeChannel(channel);
        };
    }, []);

    return status;
}
