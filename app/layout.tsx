import type { Metadata } from "next"

import "./globals.css"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL
  ? new URL(process.env.NEXT_PUBLIC_APP_URL)
  : process.env.VERCEL_URL
    ? new URL(`https://${process.env.VERCEL_URL}`)
    : new URL("http://localhost:3000")

const TITLE = "SF Bay Area Events — All hidden events in a List"
const DESCRIPTION =
  "Discover every Bay Area event on Luma without the map. Search and filter hundreds of hidden events, all in one place."

export const metadata: Metadata = {
  metadataBase: APP_URL,
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "San Francisco events",
    "Bay Area events",
    "Luma events",
    "SF tech events",
    "things to do in SF",
    "Bay Area meetups",
    "event discovery",
  ],
  openGraph: {
    type: "website",
    url: "/",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "SF Bay Area Events",
    images: [
      {
        url: "/sf.png",
        width: 1280,
        height: 640,
        alt: "Cartoon illustration of the San Francisco skyline and Golden Gate Bridge",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/sf.png"],
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
