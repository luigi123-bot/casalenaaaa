import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import InstallPWA from "@/components/InstallPWA";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
};

export const metadata: Metadata = {
  title: {
    default: "Casaleña - Pizza & Grill",
    template: "%s | Casaleña"
  },
  description: "La mejor experiencia culinaria en Ometepec. Pizzas artesanales, cortes premium y el mejor ambiente. ¡Pide en línea ahora!",
  keywords: ["Casaleña", "Pizza Ometepec", "Grill Ometepec", "Restaurante Guerrero", "Pizza artesanal", "Cortes de carne", "Comida a domicilio"],
  authors: [{ name: "Casaleña Team" }],
  creator: "Casaleña",
  publisher: "Casaleña",
  manifest: "/manifest.json",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: "https://casalena.app.netlify.app",
    title: "Casaleña - Pizza & Grill",
    description: "Pizzas artesanales y cortes premium en Ometepec, Guerrero. Vive la experiencia Casaleña.",
    siteName: "Casaleña",
    images: [
      {
        url: "/logo-main.jpg",
        width: 1200,
        height: 630,
        alt: "Casaleña Pizza & Grill",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Casaleña - Pizza & Grill",
    description: "Las mejores pizzas y cortes de Ometepec.",
    images: ["/logo-main.jpg"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Casaleña",
  },
  formatDetection: {
    telephone: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Google Tag Manager */}
        <Script id="gtm-script" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','GTM-M895BM72');`}
        </Script>
        {/* End Google Tag Manager */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Round" rel="stylesheet" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${plusJakartaSans.variable} font-sans antialiased bg-background-light dark:bg-background-dark text-text-dark dark:text-text-light transition-colors duration-300`}
      >
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-M895BM72"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          ></iframe>
        </noscript>
        {/* End Google Tag Manager (noscript) */}
        <Script id="json-ld" type="application/ld+json" strategy="afterInteractive">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Restaurant",
            "name": "Casaleña Pizza & Grill",
            "image": "https://casalena.app.netlify.app/logo-main.jpg",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "Blvd. Juan N Alvarez",
              "addressLocality": "Ometepec",
              "addressRegion": "Guerrero",
              "postalCode": "41706",
              "addressCountry": "MX"
            },
            "geo": {
              "@type": "GeoCoordinates",
              "latitude": 16.685,
              "longitude": -98.405
            },
            "url": "https://casalena.app.netlify.app",
            "telephone": "+527411011595",
            "servesCuisine": ["Pizza", "Steakhouse", "Grill"],
            "priceRange": "$$",
            "openingHoursSpecification": [
              {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
                "opens": "13:00",
                "closes": "21:30"
              }
            ]
          })}
        </Script>
        <InstallPWA />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}


