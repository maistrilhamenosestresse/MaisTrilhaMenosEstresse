import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';

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

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  
  // SECURITY: Redireciona usuários não logados imediatamente para a tela de login
  // Isso impede o vazamento do Layout do Painel (Casca visual)
  if (!session) {
    redirect('/login');
  }

  return <>{children}</>;
}
