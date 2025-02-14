import { ThemingProvider } from "../lib/next-themes"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body>
        <ThemingProvider>{children}</ThemingProvider>
      </body>
    </html>
  )
}
