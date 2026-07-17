import { Metadata } from 'next';

const logoUrl = process.env.NEXT_PUBLIC_LOGO_URL || 'https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/images/logo.png';

export const metadata: Metadata = {
  title: 'Ficha de Cadastro | Mais Trilha Menos Estresse',
  description: 'Preencha seus dados para o seguro aventura e assine o termo de responsabilidade da Mais Trilha Menos Estresse.',
  openGraph: {
    title: 'Ficha de Cadastro | Mais Trilha Menos Estresse',
    description: 'Preencha seus dados para o seguro aventura e assine o termo de responsabilidade da Mais Trilha Menos Estresse.',
    siteName: 'Mais Trilha Menos Estresse',
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
    title: 'Ficha de Cadastro | Mais Trilha Menos Estresse',
    description: 'Preencha seus dados para o seguro aventura e assine o termo de responsabilidade.',
    images: [logoUrl],
  },
  icons: {
    icon: logoUrl,
  }
};

export default function CadastroLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
