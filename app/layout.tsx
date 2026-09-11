import { Plus_Jakarta_Sans } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata, Viewport } from 'next';
import { UpdatesProvider } from '@/context/UpdatesContext';
import HomeworkDuePopup from '@/components/HomeworkDuePopup';
import { QueryProvider } from '@/components/providers/query-provider';
import { AuthSessionProvider } from '@/components/providers/auth-session-provider';
import Navigation from '@/components/Navigation';
import ChatWidget from '@/components/ChatWidget';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SchoolPulse - Daily School Schedule',
  description:
    "Stay updated with your child's daily school activities, schedule, and important dates",
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'SchoolPulse',
    description: "Your child's daily school schedule at your fingertips",
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={plusJakarta.variable}>
      <body className="font-sans antialiased bg-[var(--sp-bg)] text-[var(--sp-ink)] overflow-x-hidden">
        <QueryProvider>
          <AuthSessionProvider>
            <UpdatesProvider>
              <Navigation />
              <HomeworkDuePopup />

              <main className="min-h-screen pb-24 sm:pb-16">{children}</main>

              <footer className="hidden sm:block bg-white border-t border-[var(--sp-border)] py-5 mb-0">
                <div className="max-w-3xl mx-auto px-4 text-center text-sm text-[var(--sp-muted)]">
                  <div className="font-semibold text-[var(--sp-primary)]">SchoolPulse</div>
                  <div className="font-medium text-[var(--sp-ink)]/80">
                    BGS National Public School
                  </div>
                  <div className="text-[11px] text-[var(--sp-subtle)] mt-1 max-w-md mx-auto leading-relaxed">
                    Currently showing Class 1 planner only. Built by parents, for parents — not an
                    official school app.
                  </div>
                </div>
              </footer>
              <ChatWidget />
              <Analytics />
              <SpeedInsights />
            </UpdatesProvider>
          </AuthSessionProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
