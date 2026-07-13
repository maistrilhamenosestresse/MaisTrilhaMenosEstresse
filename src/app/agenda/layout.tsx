import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agenda Oficial | Mais Trilha Menos Estresse',
  description: 'Confira nossas próximas trilhas, veja os roteiros detalhados e garanta a sua vaga em nossas expedições incríveis!',
  openGraph: {
    title: 'Agenda Oficial | Mais Trilha Menos Estresse',
    description: 'Confira nossas próximas trilhas, veja os roteiros detalhados e garanta a sua vaga em nossas expedições incríveis!',
    images: [{
      url: 'https://nyavgcggwygkywjboaxh.supabase.co/storage/v1/object/public/fotos_agendas/logo.png',
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
    images: ['https://nyavgcggwygkywjboaxh.supabase.co/storage/v1/object/public/fotos_agendas/logo.png'],
  },
};

export default function AgendaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
