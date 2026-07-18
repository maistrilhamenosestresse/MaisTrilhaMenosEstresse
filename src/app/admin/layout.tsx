import { Metadata } from 'next';

const logoUrl = process.env.NEXT_PUBLIC_LOGO_URL || 'https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/images/logo.png';

export const metadata: Metadata = {
  title: 'Painel Administrativo | Mais Trilha Menos Estresse',
  description: 'Área restrita para gerenciamento de trilhas, clientes e seguros.',
  openGraph: {
    title: 'Painel Administrativo | Mais Trilha Menos Estresse',
    description: 'Área restrita para gerenciamento de trilhas, clientes e seguros.',
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
    title: 'Painel Administrativo | Mais Trilha Menos Estresse',
    description: 'Área restrita para gerenciamento de trilhas, clientes e seguros.',
    images: [logoUrl],
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // A proteção otimista de rota usa o Proxy; cada API administrativa revalida
  // autenticação e autorização no servidor com Supabase Auth.
  return <>{children}</>;
}
