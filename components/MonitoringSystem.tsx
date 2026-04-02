'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ActivityLog {
    id?: string;
    userId: string;
    userName: string;
    email: string;
    loginTime: string;
    lastSeen: string;
    clicks: number;
    pagesVisited: string[];
    userAgent: string;
}

export default function MonitoringSystem() {
    const { user } = useAuth();
    const [isVisible, setIsVisible] = useState(false);
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [clicks, setClicks] = useState(0);
    const [pages, setPages] = useState<string[]>([]);
    const [startTime] = useState(new Date().toISOString());
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(interval);
    }, []);

    // Secret code tracking
    const [inputBuffer, setInputBuffer] = useState('');
    const secretCode = 'adminmode';

    // 1. Sync Current Session to Supabase
    useEffect(() => {
        if (!user) return;

        const syncSession = async () => {
            const currentPath = window.location.pathname;
            const updatedPages = [...pages];
            if (updatedPages.length === 0 || updatedPages[updatedPages.length - 1] !== currentPath) {
                updatedPages.push(currentPath);
                setPages(updatedPages);
            }

            try {
                // UPSERT activity log for the current session (keyed by user_id for simplicity, 
                // or you could use a session ID in localStorage for more granularity)
                const { error } = await supabase
                    .from('user_activity_logs')
                    .upsert({
                        user_id: user.id,
                        full_name: user.full_name,
                        email: user.email,
                        login_time: startTime,
                        last_seen: new Date().toISOString(),
                        clicks: clicks,
                        pages_visited: updatedPages,
                        user_agent: navigator.userAgent
                    }, { onConflict: 'user_id' }); // Simplificado: 1 log por usuario activo

                if (error) console.warn('Monitoring Sync Error:', error.message);
            } catch (err) {
                console.error('Failed to sync monitoring data:', err);
            }
        };

        // Sync initially and then every 30 seconds
        syncSession();
        const interval = setInterval(syncSession, 30000);
        return () => clearInterval(interval);
    }, [user, clicks, pages, startTime]);

    // 2. Secret code listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
            const newBuffer = (inputBuffer + e.key).slice(-secretCode.length);
            setInputBuffer(newBuffer);
            if (newBuffer.toLowerCase() === secretCode.toLowerCase()) {
                setIsVisible(true);
                setInputBuffer('');
            }
            if (e.key === 'Escape' && isVisible) setIsVisible(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [inputBuffer, isVisible]);

    // 3. Activity listeners (Local state only, synced by the syncSession useEffect)
    useEffect(() => {
        const handleClick = () => setClicks(prev => prev + 1);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // 4. Fetch All Activity Logs (Real Data)
    useEffect(() => {
        if (isVisible) {
            const fetchLogs = async () => {
                const { data } = await supabase
                    .from('user_activity_logs')
                    .select('*')
                    .order('last_seen', { ascending: false });

                if (data) {
                    const formatted = data.map(d => ({
                        userId: d.user_id,
                        userName: d.full_name,
                        email: d.email,
                        loginTime: d.login_time,
                        lastSeen: d.last_seen,
                        clicks: d.clicks,
                        pagesVisited: d.pages_visited || [],
                        userAgent: d.user_agent
                    }));
                    setLogs(formatted);
                }
            };
            fetchLogs();
            const interval = setInterval(fetchLogs, 5000); // Live update modal
            return () => clearInterval(interval);
        }
    }, [isVisible]);

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-[#181511] w-full max-w-4xl max-h-[85vh] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#1f1b16]">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">monitoring</span>
                            Sistema de Monitoreo en Tiempo Real
                        </h2>
                        <p className="text-gray-400 text-sm">Actividad actual de usuarios y sesiones activas.</p>
                    </div>
                    <button 
                        onClick={() => setIsVisible(false)}
                        className="size-10 rounded-full hover:bg-white/10 flex items-center justify-center text-gray-400 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-[#28231d] p-4 rounded-xl border border-white/5">
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Sesiones Activas</p>
                            <p className="text-2xl font-bold text-white">{logs.length}</p>
                        </div>
                        <div className="bg-[#28231d] p-4 rounded-xl border border-white/5">
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Mis Clicks Hoy</p>
                            <p className="text-2xl font-bold text-primary">{clicks}</p>
                        </div>
                        <div className="bg-[#28231d] p-4 rounded-xl border border-white/5">
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Tiempo en Sesión</p>
                            <p className="text-2xl font-bold text-green-400">
                                {Math.floor((now - new Date(startTime).getTime()) / 60000)} min
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-white font-bold text-lg mb-4">Registro de Sesiones</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-gray-400 text-xs uppercase border-b border-white/10">
                                        <th className="pb-3 pr-4">Usuario</th>
                                        <th className="pb-3 pr-4">Ingreso</th>
                                        <th className="pb-3 pr-4">Actividad</th>
                                        <th className="pb-3 pr-4">Métricas</th>
                                        <th className="pb-3">Ruta Actual</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {logs.map((log, i) => (
                                        <tr key={i} className={`group hover:bg-white/[0.02] transition-colors ${log.userId === user?.id ? 'bg-primary/5' : ''}`}>
                                            <td className="py-4 pr-4">
                                                <div className="flex flex-col">
                                                    <span className="text-white font-bold text-sm">
                                                        {log.userName}
                                                        {log.userId === user?.id && <span className="ml-2 text-[10px] bg-primary text-black px-1.5 py-0.5 rounded font-black italic uppercase">Tú</span>}
                                                    </span>
                                                    <span className="text-gray-500 text-xs">{log.email}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 pr-4">
                                                <span className="text-gray-300 text-xs">
                                                    {new Date(log.loginTime).toLocaleTimeString()}
                                                </span>
                                            </td>
                                            <td className="py-4 pr-4">
                                                <span className="text-gray-300 text-xs">
                                                    Hace {Math.floor((now - new Date(log.lastSeen).getTime()) / 60000)} min
                                                </span>
                                            </td>
                                            <td className="py-4 pr-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-primary font-bold text-xs">{log.clicks}</span>
                                                        <span className="text-gray-500 text-[10px]">clicks</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4">
                                                <span className="px-2 py-1 bg-white/10 rounded text-[10px] text-gray-300 font-mono">
                                                    {log.pagesVisited[log.pagesVisited.length - 1]}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-black/40 border-t border-white/10 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                        <span className="size-2 rounded-full bg-green-500 animate-pulse"></span>
                        Monitoreando actividad de forma anónima
                    </div>
                    <p className="text-[10px] text-gray-600">Pulsa &apos;Esc&apos; o el botón para cerrar</p>
                </div>
            </div>
        </div>
    );
}
