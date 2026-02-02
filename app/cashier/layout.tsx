import type { Metadata } from "next";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata: Metadata = {
    title: "Casaleña - Caja",
    description: "Sistema de Punto de Venta para pizzería",
};

import { CashierProvider } from "@/contexts/CashierContext";
import Sidebar from "@/components/Sidebar";

export default function CashierLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthProvider>
            <CashierProvider>
                <div className="flex h-screen w-full bg-[#fcfbf9] overflow-hidden">
                    <Sidebar />
                    <div className="flex-1 flex flex-col min-w-0">
                        {children}
                    </div>
                </div>
            </CashierProvider>
        </AuthProvider>
    );
}
