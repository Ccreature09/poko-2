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
  Bell,
  ChevronDown,
  ChevronRight,
  School,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  className?: string;
}

export default function Sidebar({ className }: SidebarProps) {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  if (!user) return null;

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const studentCategories = [
    {
      name: "Dashboard",
      icon: Home,
      items: [
        { href: `/dashboard/${user.schoolId}`, label: "Табло", icon: Home },
      ],
    },
    {
      name: "Courses",
      icon: BookOpen,
      items: [{ href: "/courses", label: "Курсове", icon: BookOpen }],
    },
    {
      name: "Assessments",
      icon: FileText,
      items: [
        { href: "/quizzes", label: "Тестове", icon: BookOpenText },
        { href: "/assignments", label: "Задачи", icon: FileText },
        { href: "/report-card", label: "Оценки", icon: BarChart2 },
      ],
    },
    {
      name: "Schedule",
      icon: Calendar,
      items: [{ href: "/timetable", label: "Разписание", icon: Calendar }],
    },
  ];

  const teacherCategories = [
    {
      name: "Dashboard",
      icon: Home,
      items: [
        { href: `/dashboard/${user.schoolId}`, label: "Табло", icon: Home },
      ],
    },
    {
      name: "Courses",
      icon: BookOpen,
      items: [
        { href: "/courses", label: "Курсове", icon: BookOpen },
        { href: "/create-course", label: "Създаване на курс", icon: BookOpen },
      ],
    },
    {
      name: "Assignments",
      icon: FileText,
      items: [
        { href: "/assignments", label: "Задачи", icon: FileText },
        {
          href: "/create-assignment",
          label: "Създаване на задача",
          icon: FileText,
        },
       
      ],
    },
    {
      name: "Quizzes",
      icon: BookOpenText,
      items: [
        { href: "/quizzes", label: "Тестове", icon: BookOpenText },
        { href: "/create-quiz", label: "Създаване на тест", icon: BookOpenText },
        {
          href: "/quiz-reviews",
          label: "Преглед на тестове",
          icon: BookOpenText,
        },
      ],
    },
    {
      name: "Grading",
      icon: BarChart2,
      items: [
        { href: "/add-grades", label: "Добавяне на оценки", icon: BarChart2 },
      ],
    },
    {
      name: "Communication",
      icon: Bell,
      items: [{ href: "/messages", label: "Съобщения", icon: Bell }],
    },
  ];

  const adminCategories = [
    {
      name: "Dashboard",
      icon: Home,
      items: [
        { href: `/dashboard/${user.schoolId}`, label: "Табло", icon: Home },
      ],
    },
    {
      name: "School Management",
      icon: School,
      items: [
        {
          href: "/create-timetable",
          label: "Създаване на разписание",
          icon: Calendar,
        },
        {
          href: "/manage-subjects",
          label: "Управление на предмети",
          icon: BookOpen,
        },
      ],
    },
  ];

  const categories =
    user.role === "student"
      ? studentCategories
      : user.role === "teacher"
      ? teacherCategories
      : adminCategories;

  // Navigation links component shared between desktop and mobile
  const NavigationLinks = () => (
    <nav className="space-y-2">
      {categories.map((category) => (
        <div key={category.name} className="space-y-1">
          <Button
            variant="ghost"
            className="w-full justify-between font-medium"
            onClick={() => toggleCategory(category.name)}
          >
            <div className="flex items-center">
              <category.icon className="mr-2 h-4 w-4" />
              {category.name}
            </div>
            {expandedCategories.includes(category.name) ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
          {expandedCategories.includes(category.name) && (
            <div className="ml-4 space-y-1">
              {category.items.map((item) => (
                <Link key={item.href} href={item.href} passHref>
                  <Button
                    variant="ghost"
                    className="w-full justify-start font-normal"
                    onClick={() => setIsOpen(false)}
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );

  // User info component shared between desktop and mobile
  const UserInfo = () => (
    <div className="mb-6 p-2">
      <div className="text-lg font-semibold">
        {user.firstName} {user.lastName}
      </div>
      <div className="text-sm text-muted-foreground">{user.role}</div>
    </div>
  );

  return (
    <>
      {/* Mobile Sidebar using Sheet */}
      <div className="lg:hidden">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <button
              className="fixed top-4 left-4 z-40 p-2 rounded-md bg-background border"
              aria-label="Toggle menu"
            >
              <Menu className="h-6 w-6" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[80%] sm:w-[350px] p-0">
            <SheetHeader className="p-4 border-b">
              <SheetTitle>Меню</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-60px)]">
              <div className="p-4">
                <UserInfo />
                <NavigationLinks />
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:block w-56 border-r bg-background relative",
          className
        )}
      >
        <ScrollArea className="h-screen">
          <div className="p-4">
            <UserInfo />
            <NavigationLinks />
          </div>
        </ScrollArea>
      </aside>
    </>
  );
}
