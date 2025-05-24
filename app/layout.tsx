import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/hooks/useAuth";
import { AdvancedOfflineBanner } from "@/components/offline-banner";

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'iRankHub - Debate Platform',
  description: 'Your Voice, Your Ideas, Your Impact – More Than Just Debates',
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
        <AuthProvider>
          <AdvancedOfflineBanner />
          <div className="min-h-screen">
            {children}
          </div>
          <Toaster richColors closeButton position="top-right" />
        </AuthProvider>
      </ConvexClientProvider>
    </ThemeProvider>
    </body>
    </html>
  );
}