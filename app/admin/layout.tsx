'use client';

import { Manrope } from "next/font/google";
import "../globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import AdminChatPanel from "@/components/AdminChatPanel";
import { useState, useEffect } from "react";

const manrope = Manrope({
    subsets: ["latin"],
    variable: "--font-manrope",
    weight: ["400", "500", "700", "800"],
});

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [selectedChatUser, setSelectedChatUser] = useState<string | null>(null);

    useEffect(() => {
        const handleOpenChat = (e: any) => {
            const userId = e.detail?.userId;
            if (userId && userId !== 'latest') {
                setSelectedChatUser(userId);
            } else {
                setSelectedChatUser(null);
            }
            setIsChatOpen(true);
        };

        window.addEventListener('open-admin-chat' as any, handleOpenChat);
        return () => window.removeEventListener('open-admin-chat' as any, handleOpenChat);
    }, []);

    return (
        <div className={`${manrope.variable} font-sans h-full`}>
            <AuthProvider>
                <div className="flex h-screen w-full bg-[#f8f7f5] text-[#181511] overflow-hidden relative">
                    <Sidebar />
                    <div className="flex-1 flex flex-col min-w-0">
                        <Header role="admin" />
                        {children}
                    </div>

                    {/* Floating Chat Panel */}
                    {isChatOpen && (
                        <AdminChatPanel
                            onClose={() => {
                                setIsChatOpen(false);
                                setSelectedChatUser(null);
                            }}
                            preselectedUserId={selectedChatUser}
                        />
                    )}
                </div>
            </AuthProvider>
        </div>
    );
}
