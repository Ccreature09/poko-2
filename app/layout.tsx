// Глобален layout файл - основната структура на всички страници
// Включва:
// - Инициализация на основни стилове и шрифтове
// - Контекст провайдъри за споделено състояние
// - Основни метаданни на приложението
// - Глобална навигация (Header) и Footer

import type React from "react";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { UserProvider } from "@/contexts/UserContext";
import { CoursesProvider } from "@/contexts/CoursesContext";
import { TimetableProvider } from "@/contexts/TimetableContext";
import { QuizProvider } from "@/contexts/QuizContext";
import { MessagingProvider } from "@/contexts/MessagingContext";
import Header from "@/components/functional/Header";
import Footer from "@/components/functional/Footer";
import PWAProvider from "@/components/functional/PWAProvider";
import "react-calendar/dist/Calendar.css";

// Инициализиране на системния шрифт
const inter = Inter({ subsets: ["latin"] });

// Viewport configuration
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#4f46e5",
};

// Метаданни за основното приложение
// Включва SEO информация и PWA конфигурация
export const metadata: Metadata = {
  title: "POKO - School Administration",
  description: "Цялостна система за управление на училище",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "POKO App",
  },
};

// Основен компонент за layout - обвива всички страници
// Предоставя общата структура и контекст на приложението
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="application-name" content="POKO App" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="POKO App" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="shortcut icon" href="/icons/icon-512x512.png" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        {/* Обвиване на приложението с всички необходими контекст провайдъри */}
        <UserProvider>
          <CoursesProvider>
            <TimetableProvider>
              <QuizProvider>
                <MessagingProvider>
                  <PWAProvider>
                    {/* Основна структура на страницата */}
                    <div className="flex flex-col min-h-screen">
                      <Header />
                      <main className="flex-grow">{children}</main>
                      <Footer />
                    </div>
                  </PWAProvider>
                </MessagingProvider>
              </QuizProvider>
            </TimetableProvider>
          </CoursesProvider>
        </UserProvider>
      </body>
    </html>
  );
}
