"use client";
// Начална страница на приложението
// Съдържа основните секции:
// - Герой секция с призив за действие
// - Функционалности на системата
// - Отзиви от потребители
// Използва lazy loading за оптимизация на зареждането

import { Suspense } from "react";
import type React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BookOpen,
  Users,
  Calendar,
  BarChartIcon as ChartBar,
  ArrowRight,
} from "lucide-react";
import { useUser } from "@/contexts/UserContext";

// Компонент за карта с функционалност
// Показва икона, заглавие и описание с hover ефекти
const FeatureCard = ({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) => (
  <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
    <CardHeader className="pb-2">
      <div className="rounded-full bg-blue-50 w-16 h-16 flex items-center justify-center mb-2">
        {icon}
      </div>
      <CardTitle className="text-xl font-bold text-gray-800 truncate">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-gray-600 line-clamp-3">{description}</p>
    </CardContent>
  </Card>
);

// Компонент за зареждане
// Показва се докато основното съдържание се зарежда
const LoadingFallback = () => (
  <div className="flex justify-center items-center h-[50vh]">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
  </div>
);

// Компонент за отзиви от клиенти
// Зарежда се лениво за оптимизация
const Testimonials = () => (
  <section className="py-20 bg-gray-50">
    <div className="container mx-auto px-4">
      <div className="text-center mb-16">
        <span className="bg-blue-100 text-blue-700 text-sm font-medium px-4 py-1 rounded-full">
          Отзиви
        </span>
        <h2 className="text-3xl font-bold text-gray-800 mt-4">
          Какво казват нашите потребители
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Масив с отзиви от клиенти */}
        {[
          {
            quote:
              "POKO трансформира начина, по който управляваме нашето училище. Силно препоръчвам!",
            author: "Мария Иванова",
            role: "Директор на ОУ 'Христо Ботев'",
          },
          {
            quote:
              "Като учител, POKO ми помага да се фокусирам повече върху преподаването и по-малко върху администрацията.",
            author: "Петър Петров",
            role: "Старши учител по математика",
          },
          {
            quote:
              "Интерфейсът е изключително интуитивен и прави управлението на училището много по-ефективно.",
            author: "Елена Димитрова",
            role: "Администратор в СУ 'Иван Вазов'",
          },
        ].map((testimonial, i) => (
          <Card key={i} className="border-none shadow-lg text-center p-6">
            <CardContent className="pt-6">
              <div className="mb-4 text-blue-500">
                {/* Звезди за рейтинг */}
                {Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <span key={i} className="text-xl">
                      ★
                    </span>
                  ))}
              </div>
              <p className="text-gray-700 italic mb-6 line-clamp-4">
                &quot;{testimonial.quote}&quot;
              </p>
              <p className="font-semibold text-gray-800 truncate">
                {testimonial.author}
              </p>
              <p className="text-sm text-gray-500 truncate">{testimonial.role}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  </section>
);

// Секция с основните функционалности
// Показва ключовите възможности на системата
const FeaturesSection = () => {
  const { user } = useUser();

  return (
    <section id="features" className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <span className="bg-blue-100 text-blue-700 text-sm font-medium px-4 py-1 rounded-full">
            Възможности
          </span>
          <h2 className="text-3xl font-bold text-gray-800 mt-4 mb-3">
            Основни функции
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto px-4">
            Цялостна система за управление на образователни институции с
            интуитивен интерфейс
          </p>
        </div>

        {/* Мрежа с карти за функционалностите */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureCard
            icon={<BookOpen className="h-8 w-8 text-[#1976D2]" />}
            title="Управление на курсове"
            description="Лесно създаване, актуализиране и управление на курсове и учебни програми"
          />
          <FeatureCard
            icon={<Users className="h-8 w-8 text-[#1976D2]" />}
            title="Информация за учениците"
            description="Подробни профили на учениците и академични записи"
          />
          <FeatureCard
            icon={<Calendar className="h-8 w-8 text-[#1976D2]" />}
            title="График"
            description="Интуитивно създаване и управление на разписания"
          />
          <FeatureCard
            icon={<ChartBar className="h-8 w-8 text-[#1976D2]" />}
            title="Статистики"
            description="Подробни анализи и доклади за академични постижения"
          />
        </div>

        {/* Бутон за действие */}
        <div className="mt-16 text-center">
          {user ? (
            <Link href={`/${user.role}/dashboard/${user.schoolId}`}>
              <Button variant="outline" className="group">
                Към таблото
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button variant="outline" className="group">
                Започнете сега
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
};

// Основен компонент на началната страница
// Обединява всички секции и управлява състоянието
export default function Home() {
  const { user } = useUser();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#E3F2FD] to-white">
      <main>
        {/* Секция с герой елемент */}
        <section className="py-24 text-center bg-gradient-to-r from-[#1565C0] to-[#1976D2] text-white relative overflow-hidden">
          {/* Абстрактни декоративни форми */}
          <div className="absolute top-0 left-0 w-full h-full opacity-10">
            <div className="absolute top-10 left-10 w-64 h-64 rounded-full bg-white"></div>
            <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-white"></div>
          </div>

          <div className="container mx-auto px-4 relative z-10">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 animate-fade-in px-2 md:px-0">
              Оптимизирайте управлението на вашето училище
            </h2>
            <p className="text-lg md:text-xl mb-10 opacity-90 max-w-2xl mx-auto px-2 md:px-0">
              Ефективни инструменти за управление за съвременни образователни
              институции
            </p>
            {/* Бутони за действие */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {user ? (
                <Link href={`/${user.role}/dashboard/${user.schoolId}`}>
                  <Button className="bg-white text-[#1565C0] hover:bg-blue-50 text-base md:text-lg py-4 md:py-6 px-4 md:px-8 rounded-xl transition-all shadow-lg hover:shadow-xl font-medium">
                    Към таблото
                  </Button>
                </Link>
              ) : (
                <Link href="/login">
                  <Button className="bg-white text-[#1565C0] hover:bg-blue-50 text-base md:text-lg py-4 md:py-6 px-4 md:px-8 rounded-xl transition-all shadow-lg hover:shadow-xl font-medium">
                    Вход в системата
                  </Button>
                </Link>
              )}
              <Link href="/create-school">
                <Button className="bg-transparent border-2 border-white text-white hover:bg-white/10 text-base md:text-lg py-4 md:py-6 px-4 md:px-8 rounded-xl transition-all">
                  Създайте училище
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Лениво зареждащи се секции */}
        <Suspense fallback={<LoadingFallback />}>
          <FeaturesSection />
        </Suspense>
        
        <Suspense fallback={<LoadingFallback />}>
          <Testimonials />
        </Suspense>
      </main>
    </div>
  );
}
