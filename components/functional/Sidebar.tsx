"use client";

import { useUser } from "../../contexts/UserContext";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Home,
  BookOpen,
  FileText,
  BarChart2,
  Calendar,
  BookOpenText,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  className?: string;
}

export default function Sidebar({ className }: SidebarProps) {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  const studentLinks = [
    { href: `/dashboard/${user.schoolId}`, label: "Табло", icon: Home },
    { href: "/courses", label: "Курсове", icon: BookOpen },
    { href: "/quizzes", label: "Тестове", icon: BookOpenText },
    { href: "/assignments", label: "Задачи", icon: FileText },
    { href: "/report-card", label: "Оценки", icon: BarChart2 },
    { href: "/timetable", label: "Разписание", icon: Calendar },
    { href: "/statistics", label: "Статистика", icon: BarChart2 },
  ];

  const teacherLinks = [
    { href: `/dashboard/${user.schoolId}`, label: "Табло", icon: Home },
    { href: "/create-course", label: "Създаване на курс", icon: BookOpen },
    { href: "/create-quiz", label: "Създаване на тест", icon: FileText },
    { href: "/add-grades", label: "Добавяне на оценки", icon: BarChart2 },
  ];

  const adminLinks = [
    { href: `/dashboard/${user.schoolId}`, label: "Табло", icon: Home },
    { href: "/create-timetable", label: "Създаване на разписание", icon: Calendar },
    { href: "/manage-subjects", label: "Управление на предмети", icon: BookOpen },
  ];

  const links =
    user.role === "student"
      ? studentLinks
      : user.role === "teacher"
      ? teacherLinks
      : adminLinks;

  return (
    <>
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-background border"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Menu className="h-6 w-6" />
      </button>
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static",
          isOpen ? "translate-x-0" : "-translate-x-full",
          className
        )}
      >
        <ScrollArea className="h-full">
          <div className="p-4">
            <div className="text-lg font-semibold mb-4">
              {user.firstName} {user.lastName}
              <div className="text-sm text-muted-foreground">{user.role}</div>
            </div>
            <nav className="space-y-2">
              {links.map((link) => (
                <Link key={link.href} href={link.href} passHref>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start"
                    onClick={() => setIsOpen(false)}
                  >
                    <link.icon className="mr-2 h-4 w-4" />
                    {link.label}
                  </Button>
                </Link>
              ))}
            </nav>
          </div>
        </ScrollArea>
      </aside>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 lg:hidden z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
