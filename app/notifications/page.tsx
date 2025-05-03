"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteAllReadNotifications,
  getNotificationCountsByCategory,
  NotificationCategory,
  Notification,
} from "@/lib/notificationManagement";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/contexts/UserContext";

// Import missing components without file extensions
import NotificationItem from "./NotificationItem";
import NotificationFilter from "./NotificationFilter";
import EmptyState from "./EmptyState";

export default function NotificationsPage() {
  const { user } = useUser();
  const schoolId = user?.schoolId;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<
    NotificationCategory | "all"
  >("all");
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
  const [showOnlyUnread, setShowOnlyUnread] = useState(false);
  const router = useRouter();

  // Move loadNotifications outside useEffect and memoize with useCallback
  const loadNotifications = useCallback(async () => {
    try {
      setIsLoading(true);

      // Only proceed if user and schoolId are defined
      if (!user || !schoolId) return;

      // Get category counts for badges
      const counts = await getNotificationCountsByCategory(
        schoolId,
        user.userId,
        true
      );
      setCategoryCounts(counts);

      // Get notifications based on active category and filters
      const options: {
        category?: NotificationCategory;
        onlyUnread?: boolean;
      } = {
        onlyUnread: showOnlyUnread,
      };

      if (activeCategory !== "all") {
        options.category = activeCategory as NotificationCategory;
      }

      const fetchedNotifications = await getUserNotifications(
        schoolId,
        user.userId,
        options
      );
      setNotifications(fetchedNotifications);
    } catch (error) {
      console.error("Error loading notifications:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, schoolId, activeCategory, showOnlyUnread]);

  useEffect(() => {
    if (!user || !schoolId) {
      router.push("/login");
      return;
    }

    loadNotifications();
  }, [user, schoolId, loadNotifications, router]);

  const handleNotificationClick = async (notification: Notification) => {
    try {
      if (!notification.read && notification.id && user && schoolId) {
        await markNotificationAsRead(schoolId, user.userId, notification.id);

        // Update local state
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === notification.id ? { ...item, read: true } : item
          )
        );

        // Update category counts
        setCategoryCounts((prev) => ({
          ...prev,
          [notification.category]: Math.max(0, prev[notification.category] - 1),
        }));
      }

      // Navigate to the notification link if available
      if (notification.link) {
        router.push(notification.link);
      }
    } catch (error) {
      console.error("Error handling notification click:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      if (!user || !schoolId) return;

      const category =
        activeCategory !== "all"
          ? (activeCategory as NotificationCategory)
          : undefined;
      await markAllNotificationsAsRead(schoolId, user.userId, category);

      // Update local state
      setNotifications((prev) =>
        prev.map((item) => {
          if (
            !item.read &&
            (activeCategory === "all" || item.category === activeCategory)
          ) {
            return { ...item, read: true };
          }
          return item;
        })
      );

      // Update category counts
      if (activeCategory === "all") {
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
        setCategoryCounts((prev) => ({
          ...prev,
          [activeCategory as NotificationCategory]: 0,
        }));
      }
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const handleClearReadNotifications = async () => {
    try {
      if (!user || !schoolId) return;

      await deleteAllReadNotifications(schoolId, user.userId);

      // Update local state by removing read notifications
      setNotifications((prev) => prev.filter((item) => !item.read));
    } catch (error) {
      console.error("Error clearing read notifications:", error);
    }
  };

  // Calculate total count of unread notifications
  const totalUnread = Object.values(categoryCounts).reduce(
    (sum, count) => sum + count,
    0
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Известия</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleMarkAllAsRead}
            disabled={isLoading || notifications.every((n) => n.read)}
          >
            Маркирай всички като прочетени
          </Button>
          <Button
            variant="outline"
            onClick={handleClearReadNotifications}
            disabled={isLoading || !notifications.some((n) => n.read)}
          >
            Изчисти прочетените
          </Button>
        </div>
      </div>

      <NotificationFilter
        showOnlyUnread={showOnlyUnread}
        setShowOnlyUnread={setShowOnlyUnread}
      />

      <Tabs
        defaultValue="all"
        className="mt-6"
        value={activeCategory}
        onValueChange={(value) =>
          setActiveCategory(value as NotificationCategory | "all")
        }
      >
        <TabsList className="mb-6 grid grid-cols-4 lg:grid-cols-8 w-full">
          <TabsTrigger value="all" className="relative">
            Всички
            {totalUnread > 0 && (
              <Badge
                variant="destructive"
                className="ml-2 absolute -top-2 -right-2"
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
                className="ml-2 absolute -top-2 -right-2"
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
                className="ml-2 absolute -top-2 -right-2"
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
                className="ml-2 absolute -top-2 -right-2"
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
                className="ml-2 absolute -top-2 -right-2"
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
                className="ml-2 absolute -top-2 -right-2"
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
                className="ml-2 absolute -top-2 -right-2"
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
                className="ml-2 absolute -top-2 -right-2"
              >
                {categoryCounts.system}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* All categories content pane */}
        <TabsContent value="all" className="mt-0">
          <Card className="p-6">
            {isLoading ? (
              // Skeleton loading state
              Array(5)
                .fill(0)
                .map((_, index) => (
                  <div key={index} className="mb-4">
                    <Skeleton className="h-8 w-full mb-2" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ))
            ) : notifications.length > 0 ? (
              <div className="space-y-4">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={() => handleNotificationClick(notification)}
                    onAction={loadNotifications}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                category={activeCategory !== "all" ? activeCategory : undefined}
                showOnlyUnread={showOnlyUnread}
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
            <Card className="p-6">
              {isLoading ? (
                // Skeleton loading state
                Array(3)
                  .fill(0)
                  .map((_, index) => (
                    <div key={index} className="mb-4">
                      <Skeleton className="h-8 w-full mb-2" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ))
              ) : notifications.length > 0 ? (
                <div className="space-y-4">
                  {notifications
                    .filter((n) => n.category === category)
                    .map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onClick={() => handleNotificationClick(notification)}
                        onAction={loadNotifications}
                      />
                    ))}
                </div>
              ) : (
                <EmptyState
                  category={category}
                  showOnlyUnread={showOnlyUnread}
                />
              )}
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
