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
            <h2 className="text-5xl font-bold mb-4">Streamline Your School Administration</h2>
            <p className="text-xl mb-8 opacity-90">Efficient management tools for modern educational institutions</p>
            <Link href="/login">
              <Button className="bg-white text-[#1565C0] hover:bg-[#E3F2FD] text-lg py-2 px-6 rounded-full transition-colors">
                Log in
              </Button>
            </Link>
            <Link href="/create-school">
              <Button className="bg-white text-[#1565C0] hover:bg-[#E3F2FD] mx-4 text-lg py-2 px-6 rounded-full transition-colors">
                Create a School
              </Button>
            </Link>
          </div>
        </section>

        <section id="features" className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-[#1565C0] mb-12 text-center">Key Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <FeatureCard
                icon={<BookOpen className="h-12 w-12 text-[#1976D2]" />}
                title="Course Management"
                description="Easily create, update, and manage courses and curricula"
              />
              <FeatureCard
                icon={<Users className="h-12 w-12 text-[#1976D2]" />}
                title="Student Information"
                description="Comprehensive student profiles and academic records"
              />
              <FeatureCard
                icon={<Calendar className="h-12 w-12 text-[#1976D2]" />}
                title="Scheduling"
                description="Intuitive timetable creation and management"
              />
              <FeatureCard
                icon={<ChartBar className="h-12 w-12 text-[#1976D2]" />}
                title="Performance Tracking"
                description="Advanced analytics and reporting tools"
              />
            </div>
          </div>
        </section>

        <section id="about" className="py-16 bg-[#E3F2FD]">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-[#1565C0] mb-8 text-center">About POKO</h2>
            <p className="text-lg text-[#0D47A1] max-w-3xl mx-auto text-center">
              POKO is a cutting-edge school administration system designed to empower educational institutions. Our
              platform streamlines administrative tasks, enhances communication between staff, students, and parents,
              and provides powerful tools for academic management and analysis.
            </p>
          </div>
        </section>

        <section id="contact" className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-[#1565C0] mb-8 text-center">Contact Us</h2>
            <div className="max-w-md mx-auto">
              <form className="space-y-4">
                <input
                  type="text"
                  placeholder="Your Name"
                  className="w-full p-2 border border-[#90CAF9] rounded focus:outline-none focus:ring-2 focus:ring-[#1976D2] transition-all"
                />
                <input
                  type="email"
                  placeholder="Your Email"
                  className="w-full p-2 border border-[#90CAF9] rounded focus:outline-none focus:ring-2 focus:ring-[#1976D2] transition-all"
                />
                <textarea
                  placeholder="Your Message"
                  rows={4}
                  className="w-full p-2 border border-[#90CAF9] rounded focus:outline-none focus:ring-2 focus:ring-[#1976D2] transition-all"
                ></textarea>
                <Button className="w-full bg-[#1976D2] hover:bg-[#1565C0] text-white transition-colors">
                  Send Message
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

