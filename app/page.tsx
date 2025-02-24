import type React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, Users, Calendar, BarChartIcon as ChartBar } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen bg-[#E3F2FD]">
    

      <main>
        <section className="py-20 text-center bg-gradient-to-b from-[#1565C0] to-[#1976D2] text-white">
          <div className="container mx-auto px-4">
            <h2 className="text-5xl font-bold mb-4">Оптимизирайте управлението на вашето училище</h2>
            <p className="text-xl mb-8 opacity-90">Ефективни инструменти за управление за съвременни образователни институции</p>
            <Link href="/login">
              <Button className="bg-white text-[#1565C0] hover:bg-[#E3F2FD] text-lg py-2 px-6 rounded-full transition-colors">
                Вход
              </Button>
            </Link>
            <Link href="/create-school">
              <Button className="bg-white text-[#1565C0] hover:bg-[#E3F2FD] mx-4 text-lg py-2 px-6 rounded-full transition-colors">
                Създайте училище
              </Button>
            </Link>
          </div>
        </section>

        <section id="features" className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-[#1565C0] mb-12 text-center">Основни функции</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <FeatureCard
                icon={<BookOpen className="h-12 w-12 text-[#1976D2]" />}
                title="Управление на курсове"
                description="Лесно създаване, актуализиране и управление на курсове и учебни програми"
              />
              <FeatureCard
                icon={<Users className="h-12 w-12 text-[#1976D2]" />}
                title="Информация за учениците"
                description="Подробни профили на учениците и академични записи"
              />
              <FeatureCard
                icon={<Calendar className="h-12 w-12 text-[#1976D2]" />}
                title="График"
                description="Интуитивно създаване и управление на разписания"
              />
              <FeatureCard
                icon={<ChartBar className="h-12 w-12 text-[#1976D2]" />}
                title="Проследяване на представянето"
                description="Разширени инструменти за анализ и отчитане"
              />
            </div>
          </div>
        </section>

        <section id="about" className="py-16 bg-[#E3F2FD]">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-[#1565C0] mb-8 text-center">За POKO</h2>
            <p className="text-lg text-[#0D47A1] max-w-3xl mx-auto text-center">
              POKO е съвременна система за управление на училища, създадена да подпомага образователните институции. Нашата платформа оптимизира административните задачи, подобрява комуникацията между персонала, учениците и родителите и предоставя мощни инструменти за академично управление и анализ.
            </p>
          </div>
        </section>

        <section id="contact" className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-[#1565C0] mb-8 text-center">Свържете се с нас</h2>
            <div className="max-w-md mx-auto">
              <form className="space-y-4">
                <input
                  type="text"
                  placeholder="Вашето име"
                  className="w-full p-2 border border-[#90CAF9] rounded focus:outline-none focus:ring-2 focus:ring-[#1976D2] transition-all"
                />
                <input
                  type="email"
                  placeholder="Вашият имейл"
                  className="w-full p-2 border border-[#90CAF9] rounded focus:outline-none focus:ring-2 focus:ring-[#1976D2] transition-all"
                />
                <textarea
                  placeholder="Вашето съобщение"
                  rows={4}
                  className="w-full p-2 border border-[#90CAF9] rounded focus:outline-none focus:ring-2 focus:ring-[#1976D2] transition-all"
                ></textarea>
                <Button className="w-full bg-[#1976D2] hover:bg-[#1565C0] text-white transition-colors">
                  Изпрати съобщение
                </Button>
              </form>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="text-center hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-center mb-4">{icon}</div>
        <CardTitle className="text-xl font-semibold text-[#1565C0]">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-[#0D47A1]">{description}</p>
      </CardContent>
    </Card>
  )
}

