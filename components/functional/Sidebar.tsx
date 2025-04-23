/**
 * Компонент за странична навигационна лента
 * 
 * Предоставя основната навигация в приложението със специфични менюта според ролята на потребителя:
 * - Ученик: достъп до курсове, тестове, задания, оценки и разписание
 * - Учител: създаване на курсове, задания, тестове и управление на оценки
 * - Администратор: управление на училището и учебния процес
 * 
 * Функционалности:
 * - Адаптивен дизайн с различен изглед за мобилни и десктоп устройства
 * - Категоризирано меню с възможност за разгъване/свиване
 * - Показване на информация за текущия потребител
 * - Динамично генериране на менюта според потребителската роля
 */

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
import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

// Интерфейс за пропсите на компонента
interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  className?: string;
}

export default function Sidebar({ className }: SidebarProps) {
  // Състояния за управление на компонента
  const { user } = useUser();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  // Превеждане на роли на български
  const translateRole = (role: string): string => {
    const translations: { [key: string]: string } = {
      student: "Ученик",
      teacher: "Учител",
      admin: "Администратор",
      parent: "Родител"
    };
    return translations[role] || role;
  };

  // Инициализация след зареждане в браузъра
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !user) return null;

  // Управление на разгъването/свиването на категориите
  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  // Конфигурация на менютата според ролята на потребителя
  // Меню за ученици
  const studentCategories = [
    {
      name: "Начало",
      icon: Home,
      items: [
        { href: `/dashboard/${user.schoolId}`, label: "Табло", icon: Home },
      ],
    },
    {
      name: "Курсове",
      icon: BookOpen,
      items: [{ href: "/courses", label: "Курсове", icon: BookOpen }],
    },
    {
      name: "Оценяване",
      icon: FileText,
      items: [
        { href: "/quizzes", label: "Тестове", icon: BookOpenText },
        { href: "/assignments", label: "Задания", icon: FileText },
        { href: "/report-card", label: "Оценки", icon: BarChart2 },
      ],
    },
    {
      name: "График",
      icon: Calendar,
      items: [{ href: "/timetable", label: "Разписание", icon: Calendar }],
    },
  ];

  // Меню за учители
  const teacherCategories = [
    {
      name: "Начало",
      icon: Home,
      items: [
        { href: `/dashboard/${user.schoolId}`, label: "Табло", icon: Home },
      ],
    },
    {
      name: "Курсове",
      icon: BookOpen,
      items: [
        { href: "/courses", label: "Курсове", icon: BookOpen },
        { href: "/create-course", label: "Създаване на курс", icon: BookOpen },
      ],
    },
    {
      name: "Задания",
      icon: FileText,
      items: [
        { href: "/assignments", label: "Задания", icon: FileText },
        {
          href: "/create-assignment",
          label: "Създаване на задание",
          icon: FileText,
        },
      ],
    },
    {
      name: "Тестове",
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
      name: "Оценяване",
      icon: BarChart2,
      items: [
        { href: "/add-grades", label: "Добавяне на оценки", icon: BarChart2 },
      ],
    },
    {
      name: "Комуникация",
      icon: Bell,
      items: [{ href: "/messages", label: "Съобщения", icon: Bell }],
    },
  ];

  // Меню за администратори
  const adminCategories = [
    {
      name: "Начало",
      icon: Home,
      items: [
        { href: `/dashboard/${user.schoolId}`, label: "Табло", icon: Home },
      ],
    },
    {
      name: "Управление на училището",
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

  // Меню за родители
  const parentCategories = [
    {
      name: "Начало",
      icon: Home,
      items: [
        { href: `/dashboard/${user.schoolId}`, label: "Табло", icon: Home },
      ],
    },
    {
      name: "Успех на детето",
      icon: BookOpen,
      items: [
        { href: "/report-card", label: "Оценки", icon: BarChart2 },
        { href: "/assignments", label: "Преглед на задания", icon: FileText },
        { href: "/quizzes", label: "Преглед на тестове", icon: BookOpenText },
      ],
    },
    {
      name: "Комуникация",
      icon: Bell,
      items: [{ href: "/messages", label: "Съобщения", icon: Bell }],
    },
  ];

  const categories =
    user.role === "student"
      ? studentCategories
      : user.role === "teacher"
      ? teacherCategories
      : user.role === "parent"
      ? parentCategories
      : adminCategories;

  // Navigation links component shared between desktop and mobile
  const NavigationLinks = () => (
    <nav className="space-y-2 w-full">
      {categories.map((category) => (
        <div key={category.name} className="space-y-1 w-full">
          <Button
            variant="ghost"
            className="w-full flex justify-between font-medium px-3"
            onClick={() => toggleCategory(category.name)}
          >
            <div className="flex items-center overflow-hidden mr-1 max-w-[80%]">
              <category.icon className="mr-2 h-4 w-4 flex-shrink-0" />
              <span className="text-xs">{category.name}</span>
            </div>
            <div className="flex-shrink-0">
              {expandedCategories.includes(category.name) ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </div>
          </Button>
          {expandedCategories.includes(category.name) && (
            <div className="ml-4 space-y-1 w-full">
              {category.items.map((item) => (
                <Link key={item.href} href={item.href} passHref className="w-full block">
                  <Button
                    variant="ghost"
                    className="w-full flex justify-start font-normal px-3 py-1.5"
                    onClick={() => setIsOpen(false)}
                  >
                    <div className="flex items-center overflow-hidden w-full">
                      <item.icon className="mr-2 h-4 w-4 flex-shrink-0" />
                      <span className="text-xs">{item.label}</span>
                    </div>
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
    <div className="mb-6 p-2 w-full overflow-hidden">
      <div className="text-lg font-semibold truncate pr-1">
        {user.firstName} {user.lastName}
      </div>
      <div className="text-sm text-muted-foreground truncate pr-1">
        {translateRole(user.role)}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Sidebar using Sheet */}
      <div className="lg:hidden">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <button
              className="flex items-center justify-center h-12 w-12 rounded-md text-white hover:bg-white/10 transition-colors"
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
              <div className="p-4 w-full">
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
          "hidden lg:block w-56 border-r bg-background relative overflow-hidden",
          className
        )}
      >
        <ScrollArea className="h-screen">
          <div className="p-4 w-full">
            <UserInfo />
            <NavigationLinks />
          </div>
        </ScrollArea>
      </aside>
    </>
  );
}
