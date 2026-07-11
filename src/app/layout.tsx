export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body style={{ backgroundColor: '#0F1722', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', margin: 0, fontFamily: 'sans-serif' }}>
        <h1>Em Manutenção</h1>
      </body>
    </html>
  );
}
