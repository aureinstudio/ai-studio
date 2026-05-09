import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthProvider } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/server";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ai-studio | KEG AI 교육 플랫폼",
  description: "13 AI 에이전트로 교재·강의·평가를 동시 생성",
  metadataBase: new URL("https://ai-studio-drab-nine.vercel.app"),
  openGraph: {
    title: "ai-studio | KEG AI 교육 플랫폼",
    description: "13 AI 에이전트로 교재·강의·평가를 동시 생성",
    type: "website",
    locale: "ko_KR",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // SSR 단계에서 user 1회 조회 → AuthProvider initialUser로 hydration 깜빡임 제거
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="ko"
      className={`dark ${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AuthProvider initialUser={user}>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
