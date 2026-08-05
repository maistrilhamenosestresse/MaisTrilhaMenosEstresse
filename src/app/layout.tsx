import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import VisualEditorBridge from "@/components/VisualEditorBridge";
import { Navigation } from "@/components/Navigation";
import { Toaster } from "sonner";
import PwaRuntime from "@/components/PwaRuntime";
import CookieConsentManager from "@/components/privacy/CookieConsentManager";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const logoUrl = process.env.NEXT_PUBLIC_LOGO_URL || 'https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/images/logo.png';
const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Mais Trilha Menos Estresse',
  alternateName: ['Mais Trilha', 'Mais Trilha, menos estresse', 'MaisTrilha'],
  url: 'https://www.maistrilhasmenosestresse.com',
  logo: logoUrl,
  sameAs: ['https://www.instagram.com/maistrilhamenosestresse'],
};
const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Mais Trilha Menos Estresse',
  url: 'https://www.maistrilhasmenosestresse.com',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://www.maistrilhasmenosestresse.com'),
  title: "Mais Trilha Menos Estresse » Ecoturismo, Trilhas e Bate-Volta",
  description: "Conheça um pouco da nossa história. Somos uma comunidade apaixonada pela natureza, aventura e bem-estar. Venha se desconectar do estresse e se reconectar com a vida através de trilhas incríveis!",
  keywords: ["Mais Trilha", "Mais Trilha, menos estresse", "Mais Trilha Menos Estresse", "Ecoturismo", "Trilhas", "Trekking", "Aventura", "Bate-Volta", "Viagens", "Natureza"],
  openGraph: {
    title: "Mais Trilha Menos Estresse",
    description: "Conheça um pouco da nossa história. Somos uma comunidade apaixonada pela natureza, aventura e bem-estar. Venha se desconectar do estresse e se reconectar com a vida através de trilhas incríveis!",
    images: [{
      url: logoUrl,
      width: 1200,
      height: 630,
      alt: 'Mais Trilha Menos Estresse Logo',
    }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Mais Trilha Menos Estresse",
    description: "Conheça um pouco da nossa história. Venha se desconectar do estresse e se reconectar com a vida através do ecoturismo!",
    images: [logoUrl],
  },
  icons: {
    icon: logoUrl,
    shortcut: logoUrl,
    apple: logoUrl,
  },
  manifest: '/manifest.webmanifest',
  applicationName: 'Mais Trilha Menos Estresse',
  appleWebApp: {
    capable: true,
    title: 'Mais Trilha',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#071829',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased md:snap-y md:snap-proximity`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col max-w-full overflow-x-hidden">
        
        {/* Isca para o Warsaw (Diebold Nixdorf) - Evita Hydration Mismatch */}
        <div id="_tela" style={{ display: 'none' }}></div>
        
        {/* JSON-LD Schema.org para o Google Search (Associação da Marca e Sitelinks) */}
        <script
          id="json-ld-organization"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd).replace(/</g, '\\u003c'),
          }}
        />
        <script
          id="json-ld-website"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteJsonLd).replace(/</g, '\\u003c'),
          }}
        />

        <Navigation />
        {children}
        <PwaRuntime />
        <CookieConsentManager gaId={process.env.NEXT_PUBLIC_GA_ID || ""} />
        <VisualEditorBridge />
        <Toaster theme="dark" position="bottom-right" />
      </body>
    </html>
  );
}
