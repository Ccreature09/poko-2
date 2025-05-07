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

import React from "react";
import { useUser } from "@/contexts/UserContext";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
  MessageSquare,
  Users,
  GraduationCap,
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
import { Badge } from "@/components/ui/badge";
import { getUnreadNotificationsCount } from "@/lib/management/notificationManagement";

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
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Превеждане на роли на български
  const translateRole = (role: string): string => {
    const translations: { [key: string]: string } = {
      student: "Ученик",
      teacher: "Учител",
      admin: "Администратор",
      parent: "Родител",
    };
    return translations[role] || role;
  };

  // Инициализация след зареждане в браузъра
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch unread notifications count
  useEffect(() => {
    if (user && user.schoolId) {
      const fetchUnreadCount = async () => {
        try {
          const count = await getUnreadNotificationsCount(
            user.schoolId,
            user.userId!
          );
          setUnreadNotifications(count);
        } catch (error) {
          console.error("Error fetching unread notifications count:", error);
        }
      };

      fetchUnreadCount();

      // Refresh unread count every minute
      const intervalId = setInterval(fetchUnreadCount, 60000);

      return () => clearInterval(intervalId);
    }
  }, [user]);

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
        {
          href: `/student/dashboard`,
          label: "Табло",
          icon: Home,
        },
        {
          href: "/notifications",
          label: "Известия",
          icon: Bell,
          badge: unreadNotifications > 0 ? unreadNotifications : undefined,
        },
      ],
    },
    {
      name: "Курсове",
      icon: BookOpen,
      items: [{ href: "/student/courses", label: "Курсове", icon: BookOpen }],
    },
    {
      name: "Оценяване",
      icon: FileText,
      items: [
        { href: "/student/quizzes", label: "Тестове", icon: BookOpenText },
        { href: "/student/assignments", label: "Задания", icon: FileText },
        { href: "/student/grades", label: "Оценки", icon: BarChart2 },
        { href: "/student/feedback", label: "Отзиви", icon: MessageSquare },
      ],
    },
    {
      name: "График",
      icon: Calendar,
      items: [
        { href: "/student/timetable", label: "Разписание", icon: Calendar },
        { href: "/student/attendance", label: "Присъствия", icon: FileText },
      ],
    },
  ];

  // Меню за учители
  const teacherCategories = [
    {
      name: "Начало",
      icon: Home,
      items: [
        {
          href: `/teacher/dashboard`,
          label: "Табло",
          icon: Home,
        },
        {
          href: "/notifications",
          label: "Известия",
          icon: Bell,
          badge: unreadNotifications > 0 ? unreadNotifications : undefined,
        },
      ],
    },
    {
      name: "Курсове",
      icon: BookOpen,
      items: [
        { href: "/teacher/courses", label: "Курсове", icon: BookOpen },
        {
          href: "/teacher/courses/create",
          label: "Създаване",
          icon: BookOpen,
        },
      ],
    },
    {
      name: "Задания",
      icon: FileText,
      items: [
        { href: "/teacher/assignments", label: "Задания", icon: FileText },
        {
          href: "/teacher/assignments/create",
          label: "Създаване",
          icon: FileText,
        },
      ],
    },
    {
      name: "Тестове",
      icon: BookOpenText,
      items: [
        { href: "/teacher/quizzes", label: "Тестове", icon: BookOpenText },
        {
          href: "/teacher/quizzes/create",
          label: "Създаване",
          icon: BookOpenText,
        },
        {
          href: "/teacher/quizzes/review",
          label: "Преглед",
          icon: BookOpenText,
        },
      ],
    },
    {
      name: "Оценки",
      icon: BarChart2,
      items: [
        {
          href: "/teacher/grades/add",
          label: "Добавяне",
          icon: BarChart2,
        },
        {
          href: "/teacher/grades/overview",
          label: "Преглед",
          icon: BarChart2,
        },
      ],
    },
    {
      name: "График",
      icon: Calendar,
      items: [
        { href: "/teacher/timetable", label: "Разписание", icon: Calendar },
        {
          href: "/teacher/attendance",
          label: "Присъствия",
          icon: FileText,
        },
      ],
    },
    {
      name: "Комуникация",
      icon: Bell,
      items: [
        { href: "/messages", label: "Съобщения", icon: Bell },
        {
          href: "/teacher/feedback",
          label: "Отзиви",
          icon: MessageSquare,
        },
      ],
    },
  ];

  // Меню за администратори
  const adminCategories = [
    {
      name: "Начало",
      icon: Home,
      items: [
        {
          href: `/admin/dashboard`,
          label: "Табло",
          icon: Home,
        },
        {
          href: "/notifications",
          label: "Известия",
          icon: Bell,
          badge: unreadNotifications > 0 ? unreadNotifications : undefined,
        },
      ],
    },
    {
      name: "Управление",
      icon: School,
      items: [
        { href: "/admin/users", label: "Потребители", icon: Users },
        { href: "/admin/classes", label: "Класове", icon: GraduationCap },
        { href: "/admin/subjects", label: "Предмети", icon: BookOpen },
        { href: "/admin/timetable", label: "Разписание", icon: Calendar },
        // More admin management items can be added here in the future
      ],
    },
  ];

  // Меню за родители
  const parentCategories = [
    {
      name: "Начало",
      icon: Home,
      items: [
        {
          href: `/parent/dashboard`,
          label: "Табло",
          icon: Home,
        },
        {
          href: "/parent/linked-children",
          label: "Свързани деца",
          icon: Users,
        },
        {
          href: "/notifications",
          label: "Известия",
          icon: Bell,
          badge: unreadNotifications > 0 ? unreadNotifications : undefined,
        },
      ],
    },
    {
      name: "Успех на детето",
      icon: BookOpen,
      items: [
        { href: "/parent/grades", label: "Оценки", icon: BarChart2 },
        {
          href: "/parent/assignments",
          label: "Преглед на задания",
          icon: FileText,
        },
        {
          href: "/parent/quizzes",
          label: "Преглед на тестове",
          icon: BookOpenText,
        },
        {
          href: "/parent/feedback",
          label: "Отзиви",
          icon: MessageSquare,
        },
      ],
    },
    {
      name: "График",
      icon: Calendar,
      items: [
        { href: "/parent/timetable", label: "Разписание", icon: Calendar },
        { href: "/parent/attendance", label: "Присъствия", icon: FileText },
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
      {categories.map((category) => {
        // Check if category has only one item
        const hasOnlyOneItem = category.items.length === 1;
        const singleItem = hasOnlyOneItem ? category.items[0] : null;

        return (
          <div key={category.name} className="space-y-1 w-full">
            {hasOnlyOneItem ? (
              // For categories with only one item, make the category directly link to that item
              <Link href={singleItem!.href} passHref className="w-full block">
                <Button
                  variant="ghost"
                  className="w-full flex justify-between font-medium px-3"
                  onClick={() => setIsOpen(false)}
                >
                  <div className="flex items-center overflow-hidden w-full">
                    <category.icon className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="text-xs">{category.name}</span>
                  </div>
                </Button>
              </Link>
            ) : (
              // For categories with multiple items, keep the expandable behavior
              <>
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
                      <Link
                        key={item.href}
                        href={item.href}
                        passHref
                        className="w-full block"
                      >
                        <Button
                          variant="ghost"
                          className="w-full flex justify-start font-normal px-3 py-1.5"
                          onClick={() => setIsOpen(false)}
                        >
                          <div className="flex items-center overflow-hidden w-full">
                            <item.icon className="mr-2 h-4 w-4 flex-shrink-0" />
                            <span className="text-xs">{item.label}</span>
                            {item.badge && (
                              <Badge
                                variant="destructive"
                                className="ml-auto text-[10px] h-5 min-w-[20px] flex items-center justify-center"
                              >
                                {item.badge > 99 ? "99+" : item.badge}
                              </Badge>
                            )}
                          </div>
                        </Button>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
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

  // Extract the navigation links content to prevent unnecessary re-renders
  const navigationContent = (
    <div className="p-4 w-full">
      <UserInfo />
      <NavigationLinks />
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
            <div className="h-[calc(100vh-60px)] overflow-y-auto">
              {navigationContent}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:block w-56 border-r bg-background relative overflow-auto",
          className
        )}
      >
        {navigationContent}
      </aside>
    </>
  );
}
