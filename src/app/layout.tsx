import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import VisualEditorBridge from "@/components/VisualEditorBridge";
import { Navigation } from "@/components/Navigation";
import { Toaster } from "sonner";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.maistrilhasmenosestresse.com'),
  title: "Mais Trilha Menos Estresse » Ecoturismo, Trilhas e Bate-Volta",
  description: "Conheça um pouco da nossa história. Somos uma comunidade apaixonada pela natureza, aventura e bem-estar. Venha se desconectar do estresse e se reconectar com a vida através de trilhas incríveis!",
  keywords: ["Mais Trilha", "Mais Trilha, menos estresse", "Mais Trilha Menos Estresse", "Ecoturismo", "Trilhas", "Trekking", "Aventura", "Bate-Volta", "Viagens", "Natureza"],
  openGraph: {
    title: "Mais Trilha Menos Estresse",
    description: "Conheça um pouco da nossa história. Somos uma comunidade apaixonada pela natureza, aventura e bem-estar. Venha se desconectar do estresse e se reconectar com a vida através de trilhas incríveis!",
    images: [{
      url: 'https://nyavgcggwygkywjboaxh.supabase.co/storage/v1/object/public/fotos_agendas/logo.png',
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
    images: ['https://nyavgcggwygkywjboaxh.supabase.co/storage/v1/object/public/fotos_agendas/logo.png'],
  },
  icons: {
    icon: 'https://nyavgcggwygkywjboaxh.supabase.co/storage/v1/object/public/fotos_agendas/logo.png',
    shortcut: 'https://nyavgcggwygkywjboaxh.supabase.co/storage/v1/object/public/fotos_agendas/logo.png',
    apple: 'https://nyavgcggwygkywjboaxh.supabase.co/storage/v1/object/public/fotos_agendas/logo.png',
  },
  manifest: '/manifest.json'
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
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
        
        {/* Google Analytics - Ativado via Variável de Ambiente */}
        {process.env.NEXT_PUBLIC_GA_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`} strategy="afterInteractive" />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
              `}
            </Script>
          </>
        )}
        {/* Isca para o Warsaw (Diebold Nixdorf) - Evita Hydration Mismatch */}
        <div id="_tela" style={{ display: 'none' }}></div>
        
        {/* JSON-LD Schema.org para o Google Search (Associação da Marca e Sitelinks) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Mais Trilha Menos Estresse",
              "alternateName": [
                "Mais Trilha",
                "Mais Trilha, menos estresse",
                "MaisTrilha"
              ],
              "url": "https://www.maistrilhasmenosestresse.com",
              "logo": "https://nyavgcggwygkywjboaxh.supabase.co/storage/v1/object/public/fotos_agendas/logo.png",
              "sameAs": [
                "https://www.instagram.com/maistrilhamenosestresse"
              ]
            })
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "Mais Trilha Menos Estresse",
              "url": "https://www.maistrilhasmenosestresse.com"
            })
          }}
        />

        <Navigation />
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(registration) {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                  }, function(err) {
                    console.log('ServiceWorker registration failed: ', err);
                  });
                });
              }
            `,
          }}
        />
        <VisualEditorBridge />
        <Toaster theme="dark" position="bottom-right" />
      </body>
    </html>
  );
}
