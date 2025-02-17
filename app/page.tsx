import Link from "next/link"
import { ArrowRight, BookOpen, Shield, Users, GraduationCap, BarChart, Clock } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Navigation */}
      <header className="fixed top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">POKO</span>
          </div>
          <nav className="hidden space-x-6 md:block">
            <Link href="#features" className="text-sm font-medium text-muted-foreground hover:text-primary">
              Features
            </Link>
            <Link href="#testimonials" className="text-sm font-medium text-muted-foreground hover:text-primary">
              Testimonials
            </Link>
            <Link href="#contact" className="text-sm font-medium text-muted-foreground hover:text-primary">
              Contact
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 lg:pt-36">
        <div className="container relative z-10 mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-4xl font-bold tracking-tight sm:text-6xl">
              Welcome to POKO
            </h1>
            <p className="mt-6 text-lg text-muted-foreground sm:text-xl">Secure School Administration Platform</p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Button size="lg" asChild className="bg-white text-black hover:bg-black hover:text-white">
                <Link href="/login">
                  Get Started <ArrowRight className="ml-2 h-5 w-5" />
               </Link>
             </Button>
              <Button size="lg" variant="outline" className="bg-white text-black hover:bg-black hover:text-white">
                Learn More <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 transform">
            <div className="h-[400px] w-[800px] rounded-full bg-primary/5 blur-3xl" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container py-24">
        <h2 className="text-center text-3xl font-bold tracking-tight">Everything you need to manage your school</h2>
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div className="group rounded-2xl border bg-card p-8 transition-all hover:shadow-lg">
            <Shield className="h-10 w-10 text-primary" />
            <h3 className="mt-4 text-xl font-semibold">Secure Platform</h3>
            <p className="mt-2 text-muted-foreground">
              State-of-the-art security measures to protect sensitive educational data
            </p>
          </div>
          <div className="group rounded-2xl border bg-card p-8 transition-all hover:shadow-lg">
            <Users className="h-10 w-10 text-primary" />
            <h3 className="mt-4 text-xl font-semibold">User Management</h3>
            <p className="mt-2 text-muted-foreground">
              Efficiently manage students, teachers, and administrative staff
            </p>
          </div>
          <div className="group rounded-2xl border bg-card p-8 transition-all hover:shadow-lg">
            <BookOpen className="h-10 w-10 text-primary" />
            <h3 className="mt-4 text-xl font-semibold">Learning Tools</h3>
            <p className="mt-2 text-muted-foreground">Comprehensive tools for enhanced learning experiences</p>
          </div>
          <div className="group rounded-2xl border bg-card p-8 transition-all hover:shadow-lg">
            <BarChart className="h-10 w-10 text-primary" />
            <h3 className="mt-4 text-xl font-semibold">Analytics</h3>
            <p className="mt-2 text-muted-foreground">Detailed insights into student performance and school metrics</p>
          </div>
          <div className="group rounded-2xl border bg-card p-8 transition-all hover:shadow-lg">
            <Clock className="h-10 w-10 text-primary" />
            <h3 className="mt-4 text-xl font-semibold">Scheduling</h3>
            <p className="mt-2 text-muted-foreground">Easy-to-use tools for managing classes and events</p>
          </div>
          <div className="group rounded-2xl border bg-card p-8 transition-all hover:shadow-lg">
            <Shield className="h-10 w-10 text-primary" />
            <h3 className="mt-4 text-xl font-semibold">Support</h3>
            <p className="mt-2 text-muted-foreground">24/7 support to help you with any questions or issues</p>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="border-t bg-slate-50">
        <div className="container py-24">
          <h2 className="text-center text-3xl font-bold tracking-tight">Trusted by educators worldwide</h2>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <blockquote key={i} className="rounded-2xl border bg-white p-8">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10" />
                  <div>
                    <div className="font-semibold">School Administrator</div>
                    <div className="text-sm text-muted-foreground">International School</div>
                  </div>
                </div>
                <p className="mt-4 text-muted-foreground">
                  "POKO has transformed how we manage our school. The platform is intuitive and has greatly improved our
                  efficiency."
                </p>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white">
        <div className="container py-12">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2">
                <GraduationCap className="h-6 w-6 text-primary" />
                <span className="font-bold">POKO</span>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">Making school administration secure and efficient</p>
            </div>
            <div>
              <h3 className="font-semibold">Product</h3>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>Features</li>
                <li>Security</li>
                <li>Pricing</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold">Company</h3>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>About</li>
                <li>Careers</li>
                <li>Contact</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold">Legal</h3>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>Privacy</li>
                <li>Terms</li>
                <li>Cookie Policy</li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
            © 2024 POKO. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}