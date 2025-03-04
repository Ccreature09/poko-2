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

// Feature card component with hover effects
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
      <CardTitle className="text-xl font-bold text-gray-800">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-gray-600">{description}</p>
    </CardContent>
  </Card>
);

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex justify-center items-center h-[50vh]">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
  </div>
);

// Testimonials component that can be lazy-loaded
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
                {Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <span key={i} className="text-xl">
                      ★
                    </span>
                  ))}
              </div>
              <p className="text-gray-700 italic mb-6">
                &quot;{testimonial.quote}&quot;
              </p>
              <p className="font-semibold text-gray-800">
                {testimonial.author}
              </p>
              <p className="text-sm text-gray-500">{testimonial.role}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  </section>
);

// Features section component
const FeaturesSection = () => (
  <section id="features" className="py-20">
    <div className="container mx-auto px-4">
      <div className="text-center mb-16">
        <span className="bg-blue-100 text-blue-700 text-sm font-medium px-4 py-1 rounded-full">
          Възможности
        </span>
        <h2 className="text-3xl font-bold text-gray-800 mt-4 mb-3">
          Основни функции
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Цялостна система за управление на образователни институции с
          интуитивен интерфейс
        </p>
      </div>

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

      <div className="mt-16 text-center">
        <Link href="/login">
          <Button variant="outline" className="group">
            Започнете сега
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </Link>
      </div>
    </div>
  </section>
);

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#E3F2FD] to-white">
      <main>
        <section className="py-24 text-center bg-gradient-to-r from-[#1565C0] to-[#1976D2] text-white relative overflow-hidden">
          {/* Abstract shape decorations */}
          <div className="absolute top-0 left-0 w-full h-full opacity-10">
            <div className="absolute top-10 left-10 w-64 h-64 rounded-full bg-white"></div>
            <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-white"></div>
          </div>

          <div className="container mx-auto px-4 relative z-10">
            <h2 className="text-5xl font-bold mb-6 animate-fade-in">
              Оптимизирайте управлението на вашето училище
            </h2>
            <p className="text-xl mb-10 opacity-90 max-w-2xl mx-auto">
              Ефективни инструменти за управление за съвременни образователни
              институции
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/login">
                <Button className="bg-white text-[#1565C0] hover:bg-blue-50 text-lg py-6 px-8 rounded-xl transition-all shadow-lg hover:shadow-xl font-medium">
                  Вход в системата
                </Button>
              </Link>
              <Link href="/create-school">
                <Button className="bg-transparent border-2 border-white text-white hover:bg-white/10 text-lg py-6 px-8 rounded-xl transition-all">
                  Създайте училище
                </Button>
              </Link>
            </div>
          </div>
        </section>

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
