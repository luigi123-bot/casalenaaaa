import { Manrope } from "next/font/google";
import "../globals.css";
import type { Metadata } from 'next';

const manrope = Manrope({
    subsets: ["latin"],
    variable: "--font-manrope",
    weight: ["400", "500", "700", "800"],
});

export const metadata: Metadata = {
    metadataBase: new URL("https://casalena.app.netlify.app"),
    title: "Menú Online — Casaleña Pizza & Grill",
    description: "Pide tu pizza a leña favorita en línea. Pick Up o Domicilio. Elige tu pizza, tu tamaño y nosotros nos encargamos del resto.",
    openGraph: {
        title: "Casaleña | Menú Online 🍕",
        description: "Pide tu pizza favorita directamente desde aquí. Sin app, sin registro.",
        images: ['/logo-main.jpg'],
    }
};

export default function MenuLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className={`${manrope.variable} font-sans min-h-screen bg-[#f8f7f5]`}>
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#e6e1db] shadow-sm">
                <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src="/logo-main.jpg" alt="Casaleña" className="size-10 rounded-full object-cover shadow-sm" />
                        <div>
                            <h1 className="text-base font-black text-[#181511] leading-none">Casaleña</h1>
                            <p className="text-[10px] text-[#8c785f] font-bold tracking-widest uppercase">Pizza & Grill</p>
                        </div>
                    </div>
                    <a
                        href="tel:7411011595"
                        className="flex items-center gap-2 bg-[#F27405] text-white px-4 py-2 rounded-xl text-xs font-black shadow-md shadow-orange-200 hover:bg-orange-600 transition-all active:scale-95"
                    >
                        <span className="material-symbols-outlined text-base">call</span>
                        Llamar
                    </a>
                </div>
            </header>

            <main className="pt-[65px] pb-10 min-h-screen">
                {children}
            </main>

            {/* Footer */}
            <footer className="bg-[#181511] text-white py-8 px-6 text-center">
                <p className="font-black text-lg mb-1">Casaleña Pizza & Grill</p>
                <p className="text-gray-400 text-sm">Blvd. Juan N Álvarez · Tel: 741-101-1595</p>
                <p className="text-gray-600 text-xs mt-4">© 2025 Casaleña. Todos los derechos reservados.</p>
            </footer>
        </div>
    );
}
