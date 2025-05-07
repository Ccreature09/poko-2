/**
 * Компонент за главната навигационна лента
 *
 * Предоставя:
 * - Лого и име на приложението
 * - Име на текущото училище
 * - Известия в реално време
 * - Меню за съобщения
 * - Потребителско меню с опции за профил и изход
 *
 * Адаптивен дизайн с различен изглед за мобилни и десктоп устройства
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useUser } from "../../contexts/UserContext";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  MessageSquare,
  LogOut,
  User,
  Check,
  Settings,
  Calendar,
  Trash2,
  BookOpen,
  GraduationCap,
  Clock,
} from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

import {
  getUserNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteAllReadNotifications,
  getNotificationCountsByCategory,
  Notification,
  NotificationCategory,
} from "@/lib/management/notificationManagement";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Sidebar from "./Sidebar";

// Icon mapping for notification categories
const CATEGORY_ICONS: Record<NotificationCategory, React.ReactNode> = {
  assignments: <BookOpen className="h-4 w-4" />,
  quizzes: <GraduationCap className="h-4 w-4" />,
  grades: <BookOpen className="h-4 w-4" />,
  attendance: <Calendar className="h-4 w-4" />,
  feedback: <MessageSquare className="h-4 w-4" />,
  system: <Settings className="h-4 w-4" />,
  messages: <MessageSquare className="h-4 w-4" />,
};

export default function Header() {
  // Component state
  const { user } = useUser();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState<
    Record<NotificationCategory, number>
  >({
    assignments: 0,
    quizzes: 0,
    grades: 0,
    attendance: 0,
    feedback: 0,
    system: 0,
    messages: 0,
  });
  const [activeCategory, setActiveCategory] = useState<
    NotificationCategory | "all"
  >("all");
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  // Initialize after browser load
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  // Load school name
  useEffect(() => {
    const fetchSchoolName = async (schoolId: string) => {
      console.log(schoolId);
      const schoolDoc = await getDoc(doc(db, "schools", schoolId));
      return schoolDoc.exists() ? schoolDoc.data()?.name : null;
    };

    if (user?.schoolId) {
      fetchSchoolName(user.schoolId).then(setSchoolName);
    }
  }, [user?.schoolId]);

  // Filtered notifications based on selected category
  const filteredNotifications = useMemo(() => {
    if (activeCategory === "all") {
      return notifications;
    }
    return notifications.filter(
      (notification) => notification.category === activeCategory
    );
  }, [notifications, activeCategory]);

  // Load notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user?.schoolId || !user?.userId) return;

      try {
        const [recentNotifications, count, counts] = await Promise.all([
          getUserNotifications(user.schoolId, user.userId, { limit: 20 }),
          getUnreadNotificationsCount(user.schoolId, user.userId),
          getNotificationCountsByCategory(user.schoolId, user.userId, true),
        ]);

        setNotifications(recentNotifications);
        setUnreadCount(count);
        setCategoryCounts(counts);
      } catch (error) {
        console.error("Error fetching notifications:", error);
      }
    };

    fetchNotifications();

    // Poll for notifications every minute
    const intervalId = setInterval(fetchNotifications, 60000);

    // Poll more frequently when notification panel is open
    const quickUpdateId = isNotificationOpen
      ? setInterval(fetchNotifications, 10000)
      : undefined;

    return () => {
      clearInterval(intervalId);
      if (quickUpdateId) clearInterval(quickUpdateId);
    };
  }, [user?.schoolId, user?.userId, isNotificationOpen]);

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.id || !user?.schoolId || !user?.userId) return;

    try {
      // Only mark as read if it's not already read
      if (!notification.read) {
        await markNotificationAsRead(
          user.schoolId,
          user.userId,
          notification.id
        );
        setNotifications((prev) =>
          prev.map((notif) =>
            notif.id === notification.id ? { ...notif, read: true } : notif
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));

        // Update category counts
        if (notification.category) {
          setCategoryCounts((prev) => ({
            ...prev,
            [notification.category]: Math.max(
              0,
              prev[notification.category] - 1
            ),
          }));
        }
      }

      // If notification has actions with URLs, use the first one
      const firstAction = notification.actions?.find((action) => action.url);
      const linkToNavigate = notification.link || firstAction?.url;

      if (linkToNavigate) router.push(linkToNavigate);
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    if (!user?.schoolId || !user?.userId) return;

    try {
      const categoryParam =
        activeCategory !== "all" ? activeCategory : undefined;
      await markAllNotificationsAsRead(
        user.schoolId,
        user.userId,
        categoryParam
      );

      // Update UI
      setNotifications((prev) =>
        prev.map((notif) =>
          activeCategory === "all" || notif.category === activeCategory
            ? { ...notif, read: true }
            : notif
        )
      );

      // Update counts
      if (activeCategory === "all") {
        setUnreadCount(0);
        setCategoryCounts({
          assignments: 0,
          quizzes: 0,
          grades: 0,
          attendance: 0,
          feedback: 0,
          system: 0,
          messages: 0,
        });
      } else {
        setUnreadCount((prev) => prev - categoryCounts[activeCategory]);
        setCategoryCounts((prev) => ({
          ...prev,
          [activeCategory]: 0,
        }));
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  // Clear all read notifications
  const handleClearReadNotifications = async () => {
    if (!user?.schoolId || !user?.userId) return;

    try {
      await deleteAllReadNotifications(user.schoolId, user.userId);

      // Update UI - remove read notifications from the list
      setNotifications((prev) => prev.filter((notif) => !notif.read));
    } catch (error) {
      console.error("Error clearing read notifications:", error);
    }
  };

  if (!mounted) return null;

  return (
    <header className="bg-gradient-to-r from-blue-500 to-purple-600 shadow-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-3 items-center py-4">
          <div className="flex items-center gap-4">
            {user && (
              <div className="lg:hidden">
                <Sidebar />
              </div>
            )}
            <Link href="/" className={`${!user ? "mx-auto col-span-3" : ""}`}>
              <div className="flex items-center">
                <div className="flex flex-col items-center justify-center w-10 h-10 sm:hidden">
                  <span className="text-lg font-bold leading-none text-white">
                    PO
                  </span>
                  <span className="text-lg font-bold leading-none text-white">
                    KO
                  </span>
                </div>

                <div className="hidden sm:flex items-center">
                  <span className="text-xl font-bold text-white tracking-[0.5em]">
                    POKO
                  </span>
                </div>
              </div>
            </Link>
          </div>

          {user && (
            <>
              {/* School name in center */}
              <Link
                href={
                  user && user.role
                    ? `/${user.role}/dashboard/${user.schoolId}`
                    : `/dashboard/${user.schoolId}`
                }
                className="justify-self-center"
              >
                <div className="text-center text-lg font-semibold text-white hidden sm:block">
                  {schoolName}
                </div>
              </Link>

              {/* Right section with user controls */}
              <div className="flex items-center space-x-4 justify-self-end">
                {/* Notifications dropdown */}
                <Popover onOpenChange={setIsNotificationOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white relative hidden sm:inline-flex"
                    >
                      <Bell className="h-5 w-5" />
                      {/* Badge for unread notifications count */}
                      {unreadCount > 0 && (
                        <Badge className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-red-500 text-white text-xs min-w-[18px] h-[18px] flex items-center justify-center rounded-full">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  {/* Notification dropdown content */}
                  <PopoverContent className="w-96 p-0" align="end">
                    <div className="font-medium text-sm px-4 py-2 border-b flex justify-between items-center">
                      <h3>Уведомления</h3>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleMarkAllAsRead}
                          disabled={unreadCount === 0}
                          title="Маркирай всички като прочетени"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleClearReadNotifications}
                          title="Изчисти прочетените"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <Tabs
                      defaultValue="all"
                      onValueChange={(value) =>
                        setActiveCategory(value as NotificationCategory | "all")
                      }
                    >
                      <div className="border-b px-2">
                        <TabsList className="w-full bg-transparent">
                          <Link href="/notifications">
                            <TabsTrigger
                              value="all"
                              className="flex-1 relative data-[state=active]:text-blue-600"
                            >
                              Всички
                              {unreadCount > 0 && (
                                <Badge className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-red-500 text-white text-xs min-w-[18px] h-[18px] flex items-center justify-center rounded-full">
                                  {unreadCount > 9 ? "9+" : unreadCount}
                                </Badge>
                              )}
                            </TabsTrigger>
                          </Link>
                          {Object.entries(categoryCounts).map(
                            ([category, count]) =>
                              count > 0 && (
                                <TabsTrigger
                                  key={category}
                                  value={category}
                                  className="relative data-[state=active]:text-blue-600"
                                  title={getCategoryTitle(
                                    category as NotificationCategory
                                  )}
                                >
                                  {
                                    CATEGORY_ICONS[
                                      category as NotificationCategory
                                    ]
                                  }
                                  <Badge className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-red-500 text-white text-xs min-w-[18px] h-[18px] flex items-center justify-center rounded-full">
                                    {count > 9 ? "9+" : count}
                                  </Badge>
                                </TabsTrigger>
                              )
                          )}
                        </TabsList>
                      </div>

                      <TabsContent value="all" className="m-0">
                        <NotificationList
                          notifications={notifications}
                          onNotificationClick={handleNotificationClick}
                        />
                      </TabsContent>

                      {Object.keys(categoryCounts).map((category) => (
                        <TabsContent
                          key={category}
                          value={category}
                          className="m-0"
                        >
                          <NotificationList
                            notifications={filteredNotifications}
                            onNotificationClick={handleNotificationClick}
                            emptyMessage={`Няма уведомления в категория ${getCategoryTitle(
                              category as NotificationCategory
                            )}`}
                          />
                        </TabsContent>
                      ))}
                    </Tabs>
                  </PopoverContent>
                </Popover>

                {/* Messages button */}
                <Link href="/messages">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hidden sm:inline-flex"
                  >
                    <MessageSquare className="h-5 w-5" />
                  </Button>
                </Link>

                {/* User dropdown menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex items-center space-x-2 text-white"
                    >
                      <User className="h-5 w-5" />
                      <span className="hidden sm:inline-block">
                        {user?.lastName}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href="/profile">Профил</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Изход
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

// Helper function to get category title in Bulgarian
function getCategoryTitle(category: NotificationCategory): string {
  const titles: Record<NotificationCategory, string> = {
    assignments: "Задачи",
    quizzes: "Тестове",
    grades: "Оценки",
    attendance: "Присъствие",
    feedback: "Обратна връзка",
    system: "Система",
    messages: "Съобщения",
  };
  return titles[category] || category;
}

// Notification list component
type NotificationListProps = {
  notifications: Notification[];
  onNotificationClick: (notification: Notification) => void;
  emptyMessage?: string;
};

function NotificationList({
  notifications,
  onNotificationClick,
  emptyMessage = "Няма уведомления",
}: NotificationListProps) {
  return (
    <ScrollArea className="h-[300px]">
      {notifications.length > 0 ? (
        <div className="py-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${
                !notification.read ? "bg-blue-50" : ""
              }`}
              onClick={() => onNotificationClick(notification)}
            >
              <div className="flex gap-3">
                {/* Icon */}
                {notification.icon && (
                  <div
                    className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full"
                    style={{
                      backgroundColor: notification.color
                        ? `${notification.color}15`
                        : "#f3f4f6",
                    }}
                  >
                    <span style={{ color: notification.color }}>
                      {notification.icon}
                    </span>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4
                      className={`text-sm font-medium ${
                        !notification.read ? "text-blue-600" : "text-gray-900"
                      }`}
                    >
                      {notification.title}
                    </h4>
                    <div className="flex items-center ml-2">
                      {/* Priority indicator */}
                      {notification.priority === "high" && (
                        <span
                          className="w-2 h-2 bg-red-500 rounded-full mr-2"
                          title="Висок приоритет"
                        />
                      )}
                      {notification.priority === "urgent" && (
                        <span
                          className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"
                          title="Спешно"
                        />
                      )}

                      {/* Timestamp */}
                      <span className="text-xs text-gray-500 whitespace-nowrap flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatTimestamp(notification.createdAt)}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {notification.message}
                  </p>

                  {/* Action buttons */}
                  {notification.actions && notification.actions.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      {notification.actions.map((action, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs py-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (action.url) {
                              onNotificationClick({
                                ...notification,
                                link: action.url,
                              });
                            }
                          }}
                        >
                          {action.icon && (
                            <span className="mr-1">{action.icon}</span>
                          )}
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 py-8 text-center text-sm text-gray-500">
          {emptyMessage}
        </div>
      )}
    </ScrollArea>
  );
}

// Format timestamp for display
function formatTimestamp(timestamp: {
  seconds: number;
  nanoseconds: number;
}): string {
  const date = new Date(timestamp.seconds * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Току-що";
  if (diffMins < 60) return `Преди ${diffMins} мин.`;
  if (diffHours < 24) return `Преди ${diffHours} ч.`;
  if (diffDays < 7) return `Преди ${diffDays} д.`;

  return date.toLocaleDateString();
}
