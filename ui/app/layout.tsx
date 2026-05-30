export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, background: '#0d0d0d', color: '#e4e4e7', fontFamily: 'system-ui' }}>
        {children}
      </body>
    </html>
  );
}
