import { Metadata } from 'next';

const logoUrl = process.env.NEXT_PUBLIC_LOGO_URL || 'https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/images/logo.png';

export const metadata: Metadata = {
  title: 'Agenda Oficial | Mais Trilha Menos Estresse',
  description: 'Confira nossas próximas trilhas, veja os roteiros detalhados e garanta a sua vaga em nossas expedições incríveis!',
  openGraph: {
    title: 'Agenda Oficial | Mais Trilha Menos Estresse',
    description: 'Confira nossas próximas trilhas, veja os roteiros detalhados e garanta a sua vaga em nossas expedições incríveis!',
    images: [{
      url: logoUrl,
      width: 1200,
      height: 630,
      alt: 'Logo Mais Trilha',
    }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Agenda Oficial | Mais Trilha Menos Estresse',
    description: 'Confira nossas próximas trilhas, veja os roteiros detalhados e garanta a sua vaga em nossas expedições incríveis!',
    images: [logoUrl],
  },
};

export default function AgendaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
