import { Manrope } from "next/font/google";
import "../globals.css";

const manrope = Manrope({
    subsets: ["latin"],
    variable: "--font-manrope",
    weight: ["400", "500", "700", "800"],
});

export const metadata = {
    title: "Menú Digital - Casaleña",
    description: "Explora nuestro menú de pizzas y más.",
};

export default function MenuLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className={`${manrope.variable} font-sans min-h-screen bg-[#f8f7f5]`}>
            {/* Simple Mobile Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#e6e1db] px-6 py-4 flex items-center justify-center shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                        CL
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-[#181511] leading-none">Casa Leña</h1>
                        <p className="text-xs text-[#8c785f] font-medium tracking-wider">WOOD FIRED KITCHEN</p>
                    </div>
                </div>
            </header>

            <main className="pt-20 pb-10 min-h-screen">
                {children}
            </main>
        </div>
    );
}
