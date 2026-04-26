'use client';

import dynamic from 'next/dynamic';

// MonitoringSystem is invisible until triggered — load it lazily to avoid
// adding its Supabase client and event listeners to the initial bundle.
const MonitoringSystem = dynamic(() => import('./MonitoringSystem'), {
    ssr: false,
    loading: () => null,
});

export default function MonitoringSystemLazy() {
    return <MonitoringSystem />;
}
