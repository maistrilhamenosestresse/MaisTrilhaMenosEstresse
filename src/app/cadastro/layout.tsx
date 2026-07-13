import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ficha de Cadastro | Mais Trilha Menos Estresse',
  description: 'Preencha seus dados para o seguro aventura e assine o termo de responsabilidade da Mais Trilha Menos Estresse.',
  openGraph: {
    title: 'Ficha de Cadastro | Mais Trilha Menos Estresse',
    description: 'Preencha seus dados para o seguro aventura e assine o termo de responsabilidade da Mais Trilha Menos Estresse.',
    siteName: 'Mais Trilha Menos Estresse',
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
    title: 'Ficha de Cadastro | Mais Trilha Menos Estresse',
    description: 'Preencha seus dados para o seguro aventura e assine o termo de responsabilidade.',
    images: ['https://nyavgcggwygkywjboaxh.supabase.co/storage/v1/object/public/fotos_agendas/logo.png'],
  },
  icons: {
    icon: 'https://nyavgcggwygkywjboaxh.supabase.co/storage/v1/object/public/fotos_agendas/logo.png',
  }
};

export default function CadastroLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
