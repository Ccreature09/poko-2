import type React from "react";
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { CoursesProvider } from "@/contexts/CoursesContext";
import { ClassesProvider } from "@/contexts/ClassesContext";
import { TimetableProvider } from "@/contexts/TimetableContext";
import { QuizProvider } from "@/contexts/QuizContext";
import { MessagingProvider } from "@/contexts/MessagingContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "POKO - School Administration",
  description: "A comprehensive school administration system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <CoursesProvider>
            <ClassesProvider>
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
            </ClassesProvider>
          </CoursesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
