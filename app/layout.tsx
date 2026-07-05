import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { UpdatesProvider } from "@/context/UpdatesContext";
import HomeworkDuePopup from '@/components/HomeworkDuePopup';

import "./globals.css";
import Navigation from "@/components/Navigation";
import ChatWidget from "@/components/ChatWidget";

export const metadata: Metadata = {
  title: "SchoolPulse - Daily School Schedule",
  description: "Stay updated with your child's daily school activities, schedule, and important dates",
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "SchoolPulse",
    description: "Your child's daily school schedule at your fingertips",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head></head>
      <body className="font-sans antialiased bg-gray-50 overflow-x-hidden">
        <UpdatesProvider>
          <Navigation />
          <HomeworkDuePopup />

          <main className="min-h-screen pb-20">
            {children}
          </main>
          <footer className="bg-white border-t border-gray-200 py-4">
            <div className="max-w-4xl mx-auto px-4 text-center text-sm text-gray-500">
              <div className="font-semibold text-orange-600">SchoolPulse</div>
              <div className="font-medium">BGS National Public School</div>
              <div className="text-[10px] text-gray-400 mt-1 max-w-md mx-auto leading-relaxed">
                Currently showing Class 1 planner only.
              </div>
              <div className="text-[10px] text-orange-500/80 font-semibold mt-1.5 uppercase tracking-wider">
                Disclaimer: This app is not official from the school. It is built by parents, for parents.
              </div>
            </div>
          </footer>
          <ChatWidget />
          <Analytics />
          <SpeedInsights />
        </UpdatesProvider>
      </body>
    </html>
  );
}
