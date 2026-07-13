import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Painel Administrativo | Mais Trilha Menos Estresse',
  description: 'Área restrita para gerenciamento de trilhas, clientes e seguros.',
  openGraph: {
    title: 'Painel Administrativo | Mais Trilha Menos Estresse',
    description: 'Área restrita para gerenciamento de trilhas, clientes e seguros.',
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
    title: 'Painel Administrativo | Mais Trilha Menos Estresse',
    description: 'Área restrita para gerenciamento de trilhas, clientes e seguros.',
    images: ['https://nyavgcggwygkywjboaxh.supabase.co/storage/v1/object/public/fotos_agendas/logo.png'],
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // SECURITY: A proteção de rota agora é feita exclusivamente pelo src/middleware.ts usando Supabase Auth.
  // Removemos o next-auth daqui para evitar o loop infinito de redirecionamento (ERR_TOO_MANY_REDIRECTS).
  
  return <>{children}</>;
}
