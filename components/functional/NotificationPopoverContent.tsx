"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Check,
  Clock,
  Trash2,
  BookOpen,
  GraduationCap,
  Calendar,
  MessageSquare,
  Settings,
} from "lucide-react";
import { useNotifications } from "@/contexts/NotificationContext";
import {
  Notification,
  NotificationCategory,
} from "@/lib/management/notificationManagement";

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

export default function NotificationPopoverContent() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    categoryCounts,
    selectedCategory,
    setSelectedCategory,
    markAsRead,
    markAllAsRead,
    deleteRead,
  } = useNotifications();

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.id) return;

    try {
      // Only mark as read if it's not already read
      if (!notification.read) {
        await markAsRead(notification.id);
      }

      // If notification has a link, navigate to it
      if (notification.link) {
        router.push(notification.link);
      }
    } catch (error) {
      console.error("Error handling notification click:", error);
    }
  };

  // Helper function to get category title in Bulgarian
  const getCategoryTitle = (category: NotificationCategory): string => {
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
  };

  return (
    <>
      <div className="font-medium text-sm px-4 py-2 border-b flex justify-between items-center">
        <h3>Уведомления</h3>
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllAsRead()}
            disabled={unreadCount === 0}
            title="Маркирай всички като прочетени"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => deleteRead()}
            title="Изчисти прочетените"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs
        defaultValue="all"
        value={selectedCategory}
        onValueChange={(value) =>
          setSelectedCategory(value as NotificationCategory | "all")
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
                    title={getCategoryTitle(category as NotificationCategory)}
                  >
                    {CATEGORY_ICONS[category as NotificationCategory]}
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
          <TabsContent key={category} value={category} className="m-0">
            <NotificationList
              notifications={notifications.filter(
                (n) => n.category === category
              )}
              onNotificationClick={handleNotificationClick}
              emptyMessage={`Няма уведомления в категория ${getCategoryTitle(
                category as NotificationCategory
              )}`}
            />
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
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
