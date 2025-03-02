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

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "POKO - School Administration",
  description: "Цялостна система за управление на училище",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <UserProvider>
          <CoursesProvider>
            <TimetableProvider>
              <QuizProvider>
                <MessagingProvider>
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
