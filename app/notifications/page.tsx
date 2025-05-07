"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  NotificationCategory,
  Notification,
} from "@/lib/management/notificationManagement";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/contexts/UserContext";
import { useNotifications } from "@/contexts/NotificationContext";

// Import components
import NotificationItem from "./NotificationItem";
import NotificationFilter from "./NotificationFilter";
import EmptyState from "./EmptyState";

export default function NotificationsPage() {
  const { user } = useUser();
  const router = useRouter();

  // Use our notification context instead of direct state
  const {
    notifications,
    unreadCount,
    categoryCounts,
    loading,
    selectedCategory,
    showUnreadOnly,
    markAsRead,
    markAllAsRead,
    deleteRead,
    setSelectedCategory,
    setShowUnreadOnly,
    refresh,
  } = useNotifications();

  useEffect(() => {
    if (!user || !user.schoolId) {
      router.push("/login");
      return;
    }
  }, [user, router]);
  const handleNotificationClick = async (notification: Notification) => {
    try {
      if (!notification.read && notification.id) {
        await markAsRead(notification.id);
      }

      // Navigate to the notification link if available
      if (notification.link && user?.role) {
        // Handle URLs that might be missing the role prefix
        const link = notification.link;

        // Check if this link doesn't already have a role prefix
        if (!link.startsWith(`/${user.role}/`)) {
          // Remove leading slash if present
          const path = link.startsWith("/") ? link.substring(1) : link;

          if (path.includes("/")) {
            // Handle paths with section and ID (e.g., "assignments/123")
            const [section, id] = path.split("/");
            router.push(`/${user.role}/${section}/${id}`);
          } else {
            // Handle section-only paths (e.g., "assignments")
            router.push(`/${user.role}/${path}`);
          }
        } else {
          // Link already has the correct role prefix
          router.push(link);
        }
      } else if (notification.link) {
        // No user role available, use link as is
        router.push(notification.link);
      }
    } catch (error) {
      console.error("Error handling notification click:", error);
    }
  };

  // Calculate total count of unread notifications
  const totalUnread = unreadCount;

  return (
    <div className="container mx-auto px-2 sm:px-4 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold">Известия</h1>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs sm:text-sm"
            onClick={() => markAllAsRead()}
            disabled={loading || !unreadCount}
          >
            Маркирай прочетени
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs sm:text-sm"
            onClick={() => deleteRead()}
            disabled={loading || notifications.every((n) => !n.read)}
          >
            Изчисти прочетените
          </Button>
        </div>
      </div>

      <NotificationFilter
        showOnlyUnread={showUnreadOnly}
        setShowOnlyUnread={setShowUnreadOnly}
      />

      <Tabs
        defaultValue="all"
        className="mt-4 sm:mt-6"
        value={selectedCategory}
        onValueChange={(value) =>
          setSelectedCategory(value as NotificationCategory | "all")
        }
      >
        <div className="overflow-x-auto pb-2">
          <TabsList className="mb-4 sm:mb-6 flex sm:grid sm:grid-cols-4 lg:grid-cols-8 w-max sm:w-full">
            <TabsTrigger value="all" className="relative">
              Всички
              {totalUnread > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-1 sm:ml-2 absolute -top-2 -right-2 text-xs px-1.5"
                >
                  {totalUnread}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="assignments" className="relative">
              Задачи
              {categoryCounts.assignments > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-1 sm:ml-2 absolute -top-2 -right-2 text-xs px-1.5"
                >
                  {categoryCounts.assignments}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="quizzes" className="relative">
              Тестове
              {categoryCounts.quizzes > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-1 sm:ml-2 absolute -top-2 -right-2 text-xs px-1.5"
                >
                  {categoryCounts.quizzes}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="grades" className="relative">
              Оценки
              {categoryCounts.grades > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-1 sm:ml-2 absolute -top-2 -right-2 text-xs px-1.5"
                >
                  {categoryCounts.grades}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="attendance" className="relative">
              Присъствия
              {categoryCounts.attendance > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-1 sm:ml-2 absolute -top-2 -right-2 text-xs px-1.5"
                >
                  {categoryCounts.attendance}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="feedback" className="relative">
              Отзиви
              {categoryCounts.feedback > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-1 sm:ml-2 absolute -top-2 -right-2 text-xs px-1.5"
                >
                  {categoryCounts.feedback}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="messages" className="relative">
              Съобщения
              {categoryCounts.messages > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-1 sm:ml-2 absolute -top-2 -right-2 text-xs px-1.5"
                >
                  {categoryCounts.messages}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="system" className="relative">
              Система
              {categoryCounts.system > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-1 sm:ml-2 absolute -top-2 -right-2 text-xs px-1.5"
                >
                  {categoryCounts.system}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* All categories content pane */}
        <TabsContent value="all" className="mt-0">
          <Card className="p-3 sm:p-6">
            {loading ? (
              // Skeleton loading state
              Array(5)
                .fill(0)
                .map((_, index) => (
                  <div key={index} className="mb-4">
                    <Skeleton className="h-6 sm:h-8 w-full mb-2" />
                    <Skeleton className="h-12 sm:h-16 w-full" />
                  </div>
                ))
            ) : notifications.length > 0 ? (
              <div className="space-y-3 sm:space-y-4">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={() => handleNotificationClick(notification)}
                    onAction={refresh}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                category={
                  selectedCategory !== "all" ? selectedCategory : undefined
                }
                showOnlyUnread={showUnreadOnly}
              />
            )}
          </Card>
        </TabsContent>

        {/* Generate content panes for each category */}
        {(
          [
            "assignments",
            "quizzes",
            "grades",
            "attendance",
            "feedback",
            "messages",
            "system",
          ] as const
        ).map((category) => (
          <TabsContent key={category} value={category} className="mt-0">
            <Card className="p-3 sm:p-6">
              {loading ? (
                // Skeleton loading state
                Array(3)
                  .fill(0)
                  .map((_, index) => (
                    <div key={index} className="mb-4">
                      <Skeleton className="h-6 sm:h-8 w-full mb-2" />
                      <Skeleton className="h-12 sm:h-16 w-full" />
                    </div>
                  ))
              ) : notifications.length > 0 ? (
                <div className="space-y-3 sm:space-y-4">
                  {notifications
                    .filter((n) => n.category === category)
                    .map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onClick={() => handleNotificationClick(notification)}
                        onAction={refresh}
                      />
                    ))}
                </div>
              ) : (
                <EmptyState
                  category={category}
                  showOnlyUnread={showUnreadOnly}
                />
              )}
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
