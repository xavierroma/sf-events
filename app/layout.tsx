import type { Metadata } from "next"

import "./globals.css"

export const metadata: Metadata = {
  title: "Luma Event Explorer",
  description: "Server-rendered event explorer with shared cached data.",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
