import { Script } from '../components/Script'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body>
        <Script />
        {children}
      </body>
    </html>
  )
}
