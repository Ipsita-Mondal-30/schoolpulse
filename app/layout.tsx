import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { UpdatesProvider } from "@/context/UpdatesContext";
import HomeworkDuePopup from '@/components/HomeworkDuePopup';

import "./globals.css";
import Navigation from "@/components/Navigation";
import InstallPrompt from "@/components/InstallPrompt";
import ChatWidget from "@/components/ChatWidget";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SchoolPulse - Daily School Schedule",
  description: "Stay updated with your child's daily school activities, schedule, and important dates",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SchoolPulse",
  },
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
  themeColor: "#ea580c",
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
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={`${inter.className} antialiased bg-gray-50 overflow-x-hidden`}>
        <UpdatesProvider>
          <Navigation />
          <HomeworkDuePopup />

          <main className="min-h-screen pb-20">
            {children}
          </main>
          <footer className="bg-white border-t border-gray-200 py-4">
            <div className="max-w-4xl mx-auto px-4 text-center text-sm text-gray-500">
              <div className="font-semibold text-orange-600">SchoolPulse</div>
              <div>BGS National Public School</div>
              <div className="text-xs text-gray-400 mt-1">Currently showing PP3 planner only</div>
            </div>
          </footer>
          <InstallPrompt />
          <ChatWidget />
          <Analytics />
          <SpeedInsights />
        </UpdatesProvider>
      </body>
    </html>
  );
}
