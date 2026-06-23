'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    const navItems = [
        { name: 'Ventas', href: '/admin/reports/sales', icon: 'payments' },
        { name: 'Analítica', href: '/admin/reports/insights', icon: 'insights' },
        { name: 'Estrategia IA', href: '/admin/reports/ai', icon: 'psychology' },
        { name: 'Cierres', href: '/admin/cierres', icon: 'account_balance_wallet' },
    ];

    return (
        <main className="flex-1 overflow-y-auto bg-[#f8f7f5]">
            <div className="max-w-[1400px] mx-auto px-6 py-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-[#181511]">Reportes y Analítica</h1>
                        <p className="text-[#8c785f] text-sm font-medium">Gestiona y visualiza el rendimiento de tu negocio.</p>
                    </div>
                    
                    {/* Horizontal Nav */}
                    <nav className="flex gap-1 bg-white p-1.5 rounded-2xl border border-[#e6e1db] shadow-sm">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href || (item.href !== '/admin/reports' && pathname.startsWith(item.href));
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                                        isActive
                                            ? 'bg-[#181511] text-white shadow-md'
                                            : 'text-[#8c785f] hover:bg-gray-50'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-lg">{item.icon}</span>
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {children}
            </div>
        </main>
    );
}
