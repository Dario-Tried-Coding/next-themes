import { Script } from '../components/Script'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en'>
      <body>
        <Script />
        {children}
      </body>
    </html>
  )
}
