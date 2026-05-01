'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, memo, useCallback } from 'react';

// Define the shape of our navigation items
interface NavItem {
    label: string;
    icon: string;
    href: string;
    filled?: boolean;
}

// Moved outside component — pure function, no need to recreate on every render
function isActive(pathname: string, path: string): boolean {
    if (path === '#chat') return false;
    if (path === '/admin' || path === '/cashier' || path === '/cocina' || path === '/tienda') {
        return pathname === path;
    }
    return pathname.startsWith(path);
}

// Navigation arrays are static — defined outside to avoid recreation on every render
const adminNavItems: NavItem[] = [
    { label: 'Dashboard', icon: 'grid_view', href: '/admin' },
    { label: 'Terminal Caja', icon: 'point_of_sale', href: '/cashier' },
    { label: 'Envíos / Repartos', icon: 'two_wheeler', href: '/cashier/deliveries' },
    { label: 'Productos', icon: 'inventory_2', href: '/admin/productos' },
    { label: 'Órdenes', icon: 'receipt_long', href: '/admin/orders' },
    { label: 'Cierres de Caja', icon: 'history', href: '/admin/cierres' },
    { label: 'Reportes', icon: 'analytics', href: '/admin/reports' },
    { label: 'Usuarios', icon: 'group', href: '/admin/users' },
    { label: 'Configuración', icon: 'settings', href: '/admin/settings' },
    { label: 'Chat Soporte', icon: 'forum', href: '#chat' },
];

const cashierNavItems: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', href: '/cashier/dashboard' },
    { label: 'Terminal Caja', icon: 'point_of_sale', href: '/cashier' },
    { label: 'Envíos / Repartos', icon: 'two_wheeler', href: '/cashier/deliveries' },
    { label: 'Órdenes Hoy', icon: 'receipt_long', href: '/cashier/orders' },
    { label: 'Chat Soporte', icon: 'forum', href: '#chat' },
];

const kitchenNavItems: NavItem[] = [
    { label: 'Monitor Cocina', icon: 'kitchen', href: '/cocina' },
    { label: 'Órdenes', icon: 'receipt_long', href: '/cocina/orders' },
];

const clientNavItems: NavItem[] = [
    { label: 'Menú Digital', icon: 'restaurant_menu', href: '/tienda' },
    { label: 'Mis Pedidos', icon: 'receipt_long', href: '/tienda/mis-pedidos' },
    { label: 'Historial', icon: 'history', href: '/tienda/history' },
];

function SidebarComponent() {
    const pathname = usePathname();
    const { user, loading, signOut } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isWindows, setIsWindows] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    useEffect(() => {
        const userAgent = navigator.userAgent.toLowerCase();
        const isWin = userAgent.includes('win');
        const isDesktop = !/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
        setIsWindows(isWin || isDesktop);

        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleDownloadDesktop = useCallback(() => {
        const link = document.createElement('a');
        link.href = '/CasalenaPOS.exe';
        link.download = 'CasalenaPOS.exe';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, []);

    const handleInstallMobile = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
            }
        } else {
            alert('Para instalar en celular:\n\n📱 iPhone (Safari): Toca el botón de "Compartir" y selecciona "Agregar a Inicio".\n\n🤖 Android (Chrome): Toca el menú de los 3 puntos y selecciona "Agregar a la pantalla principal".');
        }
    };

    // Determine which items to show based on role
    const normalizedRole = user?.role?.toLowerCase() || 'cliente';

    let navItems: NavItem[] = [];

    if (loading) {
        navItems = [];
    } else if (normalizedRole === 'administrador' || normalizedRole === 'admin') {
        navItems = adminNavItems;
    } else if (normalizedRole === 'cajero' || normalizedRole === 'mesero') {
        navItems = cashierNavItems;
    } else if (normalizedRole === 'cocina' || normalizedRole === 'chef') {
        navItems = kitchenNavItems;
    } else {
        navItems = clientNavItems;
    }

    const handleLinkClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        if (href === '#chat') {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('open-admin-chat'));
        }
        setIsMobileMenuOpen(false);
    }, []);

    return (
        <>
            {/* Mobile Menu Button - Fixed */}
            <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden fixed top-4 left-4 z-40 p-2 rounded-xl bg-white border border-[#e6e1db] shadow-lg hover:bg-gray-50 transition-colors"
            >
                <span className="material-icons-round text-2xl text-[#181511]">menu</span>
            </button>

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-40"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar - Mini rail on desktop, expands on hover */}
            <aside className={`
                fixed inset-y-0 left-0 z-50
                flex flex-col bg-white border-r border-[#e6e1db] h-full
                transition-all duration-300 ease-in-out group/sidebar overflow-hidden shadow-2xl
                ${isMobileMenuOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-[72px] lg:hover:w-64'}
            `}>
                {/* Mobile Close Button */}
                <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="lg:hidden absolute top-4 right-4 p-2 rounded-xl hover:bg-gray-100 transition-colors"
                >
                    <span className="material-icons-round text-2xl text-[#181511]">close</span>
                </button>

                {/* Logo Section - Fixed width container to prevent layout shifts */}
                <div className="h-20 flex items-center px-[15px] shrink-0">
                    <div className="flex items-center gap-3">
                        <div
                            className="bg-center bg-no-repeat bg-cover rounded-full size-10 shrink-0 shadow-sm border border-gray-100 ring-2 ring-gray-50 transition-transform group-hover/sidebar:scale-105"
                            style={{ backgroundImage: 'url("/logo-main.jpg")' }}
                        ></div>
                        <div className="flex flex-col transition-all duration-300 lg:opacity-0 lg:-translate-x-4 lg:group-hover/sidebar:opacity-100 lg:group-hover/sidebar:translate-x-0">
                            <h1 className="text-[#181511] text-base font-black leading-none whitespace-nowrap">Casa Leña</h1>
                            <p className="text-[#8c785f] text-[10px] font-bold leading-normal whitespace-nowrap uppercase tracking-tighter">Kitchen & Grill</p>
                        </div>
                    </div>
                </div>

                {/* Navigation Items */}
                <nav className="flex-1 flex flex-col gap-2 p-3 mt-4 overflow-y-auto scrollbar-hide">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={(e) => handleLinkClick(e, item.href)}
                            className={`flex items-center px-4 lg:px-[11px] lg:group-hover/sidebar:px-4 overflow-hidden rounded-xl transition-all h-11 ${isActive(pathname, item.href)
                                ? 'bg-[#f7951d] text-white shadow-md'
                                : 'text-[#8c785f] hover:bg-[#f8f7f5] hover:text-[#181511]'
                                }`}
                        >
                            <span className={`material-icons-round text-2xl shrink-0 transition-transform duration-300 flex items-center justify-center ${isActive(pathname, item.href) ? 'scale-110' : 'group-hover/sidebar:scale-105'}`}>
                                {item.icon}
                            </span>
                            <span className={`ml-4 text-sm whitespace-nowrap transition-all duration-300 lg:opacity-0 lg:-translate-x-4 lg:group-hover/sidebar:opacity-100 lg:group-hover/sidebar:translate-x-0 ${isActive(pathname, item.href) ? 'font-black' : 'font-bold'}`}>
                                {item.label}
                            </span>
                        </Link>
                    ))}
                </nav>

                {/* Footer Section */}
                <div className="p-3 border-t border-[#e6e1db] mb-2">
                    {user?.role === 'administrador' && pathname.startsWith('/cashier') ? (
                        <Link
                            href="/admin"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="flex items-center px-4 lg:px-[11px] lg:group-hover/sidebar:px-4 overflow-hidden h-11 rounded-xl text-[#f7951d] hover:bg-orange-50 cursor-pointer transition-all"
                        >
                            <span className="material-icons-round text-2xl shrink-0 flex items-center justify-center">arrow_back</span>
                            <span className="ml-4 text-sm font-black whitespace-nowrap transition-all duration-300 lg:opacity-0 lg:-translate-x-4 lg:group-hover/sidebar:opacity-100 lg:group-hover/sidebar:translate-x-0">Volver al Admin</span>
                        </Link>
                    ) : (
                        <div className="flex flex-col gap-1">
                            <button
                                onClick={handleDownloadDesktop}
                                className="flex w-full items-center px-4 lg:px-[11px] lg:group-hover/sidebar:px-4 overflow-hidden h-11 rounded-xl text-[#F7941D] hover:bg-orange-50 cursor-pointer transition-all border border-orange-100"
                            >
                                <span className="material-icons-round text-2xl shrink-0 flex items-center justify-center">desktop_windows</span>
                                <span className="ml-4 text-[11px] font-black whitespace-nowrap transition-all duration-300 lg:opacity-0 lg:-translate-x-4 lg:group-hover/sidebar:opacity-100 lg:group-hover/sidebar:translate-x-0">App Escritorio</span>
                            </button>

                            <button
                                onClick={handleInstallMobile}
                                className="flex w-full items-center px-4 lg:px-[11px] lg:group-hover/sidebar:px-4 overflow-hidden h-11 rounded-xl text-[#F7941D] hover:bg-orange-50 cursor-pointer transition-all border border-orange-100 mb-1"
                            >
                                <span className="material-icons-round text-2xl shrink-0 flex items-center justify-center">phone_iphone</span>
                                <span className="ml-4 text-[11px] font-black whitespace-nowrap transition-all duration-300 lg:opacity-0 lg:-translate-x-4 lg:group-hover/sidebar:opacity-100 lg:group-hover/sidebar:translate-x-0">App Celular</span>
                            </button>

                            <button
                                onClick={async () => {
                                    console.log('Iniciando cierre de sesión...');
                                    try {
                                        await signOut();
                                    } catch (error) {
                                        console.error('Error al cerrar sesión:', error);
                                        window.location.href = '/tienda';
                                    }
                                    setIsMobileMenuOpen(false);
                                }}
                                className="flex w-full items-center px-4 lg:px-[11px] lg:group-hover/sidebar:px-4 overflow-hidden h-11 rounded-xl text-[#8c785f] hover:bg-red-50 hover:text-red-500 cursor-pointer transition-all"
                            >
                                <span className="material-icons-round text-2xl shrink-0 flex items-center justify-center">logout</span>
                                <span className="ml-4 text-sm font-bold whitespace-nowrap transition-all duration-300 lg:opacity-0 lg:-translate-x-4 lg:group-hover/sidebar:opacity-100 lg:group-hover/sidebar:translate-x-0">Cerrar Sesión</span>
                            </button>
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
}

export default memo(SidebarComponent);
