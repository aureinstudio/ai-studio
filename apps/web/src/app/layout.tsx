import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CookieConsent } from "@/components/CookieConsent";
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

  // FOUC 회피 — 페인트 전 .dark 클래스 결정.
  // localStorage('theme') 우선 → prefers-color-scheme → 기본 dark.
  const themeInitScript = `
    (function(){try{
      var s=localStorage.getItem('theme');
      var d=s?s==='dark':(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);
      if(d===false){document.documentElement.classList.remove('dark');}
      else{document.documentElement.classList.add('dark');}
    }catch(e){document.documentElement.classList.add('dark');}})();
  `;

  return (
    <html
      lang="ko"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AuthProvider initialUser={user}>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <CookieConsent />
        </AuthProvider>
      </body>
    </html>
  );
}
