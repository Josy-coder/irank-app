import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'iRankHub - World Schools Debate Platform',
  description: 'A real-time, scalable platform for World Schools Debate and other formats',
  icons: {
    icon: "/icons/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light">
          <ConvexClientProvider>
            {children}
            <Toaster richColors closeButton position="top-right" />
          </ConvexClientProvider>
        </ThemeProvider>
        </body>
      </html>
  );
}
