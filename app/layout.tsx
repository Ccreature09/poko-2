// Глобален layout файл - основната структура на всички страници
import type React from "react";
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { UserProvider } from "@/contexts/UserContext";
import { CoursesProvider } from "@/contexts/CoursesContext";
import { TimetableProvider } from "@/contexts/TimetableContext";
import { QuizProvider } from "@/contexts/QuizContext";
import { MessagingProvider } from "@/contexts/MessagingContext";
import Header from "@/components/functional/Header";
import Footer from "@/components/functional/Footer";
import 'react-calendar/dist/Calendar.css';

// Инициализиране на шрифта
const inter = Inter({ subsets: ["latin"] });

// Метаданни за страницата
export const metadata: Metadata = {
  title: "POKO - School Administration",
  description: "Цялостна система за управление на училище",
};

// Основен компонент за layout - обвива всички страници
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Обвиване на приложението с всички необходими контекст провайдъри */}
        <UserProvider>
          <CoursesProvider>
            <TimetableProvider>
              <QuizProvider>
                <MessagingProvider>
                  {/* Основна структура на страницата */}
                  <div className="flex flex-col min-h-screen">
                    <Header />
                    <main className="flex-grow">{children}</main>
                    <Footer />
                  </div>
                </MessagingProvider>
              </QuizProvider>
            </TimetableProvider>
          </CoursesProvider>
        </UserProvider>
      </body>
    </html>
  );
}
