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
} from "lucide-react";

export default function Sidebar() {
  const { user } = useUser();

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
    <aside className="bg-background border-r w-64 h-screen">
      <ScrollArea className="h-full">
        <div className="p-4">
          <div className="text-lg font-semibold mb-4">
            {user.firstName} {user.lastName}
            <div className="text-sm text-muted-foreground">{user.role}</div>
          </div>
          <nav className="space-y-2">
            {links.map((link) => (
              <Link key={link.href} href={link.href} passHref>
                <Button variant="ghost" className="w-full justify-start">
                  <link.icon className="mr-2 h-4 w-4" />
                  {link.label}
                </Button>
              </Link>
            ))}
          </nav>
        </div>
      </ScrollArea>
    </aside>
  );
}
