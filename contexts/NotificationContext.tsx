"use client";

import type React from "react";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import {
  Notification,
  NotificationCategory,
  NotificationPriority,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteAllReadNotifications,
  getNotificationCountsByCategory,
} from "@/lib/management/notificationManagement";

// Define the context type
type NotificationContextType = {
  // State
  notifications: Notification[];
  unreadCount: number;
  categoryCounts: Record<NotificationCategory, number>;
  loading: boolean;
  error: string | null;

  // Filter options
  selectedCategory: NotificationCategory | "all";
  showUnreadOnly: boolean;

  // Actions
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteRead: () => Promise<void>;
  setSelectedCategory: (category: NotificationCategory | "all") => void;
  setShowUnreadOnly: (show: boolean) => void;
  refresh: () => Promise<void>;
};

// Create the context with default values
const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  categoryCounts: {
    assignments: 0,
    quizzes: 0,
    grades: 0,
    attendance: 0,
    feedback: 0,
    messages: 0,
    system: 0,
  },
  loading: true,
  error: null,

  selectedCategory: "all",
  showUnreadOnly: false,

  markAsRead: async () => {},
  markAllAsRead: async () => {},
  deleteRead: async () => {},
  setSelectedCategory: () => {},
  setShowUnreadOnly: () => {},
  refresh: async () => {},
});

// Export a hook for easy context usage
export const useNotifications = () => useContext(NotificationContext);

// Provider component to wrap the application with
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useUser();
  const { toast } = useToast();

  // State for notifications data
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [categoryCounts, setCategoryCounts] = useState<
    Record<NotificationCategory, number>
  >({
    assignments: 0,
    quizzes: 0,
    grades: 0,
    attendance: 0,
    feedback: 0,
    messages: 0,
    system: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState<
    NotificationCategory | "all"
  >("all");
  const [showUnreadOnly, setShowUnreadOnly] = useState<boolean>(false);

  // Ref to store unsubscribe function for snapshot listener
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Setup real-time listener for notifications
  useEffect(() => {
    if (!user?.userId || !user?.schoolId) {
      setLoading(false);
      return;
    }

    // Clean up any existing listener
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    setLoading(true);

    try {
      // Create reference to user's notifications collection
      const notificationsRef = collection(
        db,
        "schools",
        user.schoolId,
        "users",
        user.userId,
        "notifications"
      );

      // Create query for notifications, sorted by creation date (newest first)
      const notificationsQuery = query(
        notificationsRef,
        orderBy("createdAt", "desc")
      );

      // Set up real-time listener
      const unsubscribe = onSnapshot(
        notificationsQuery,
        (snapshot) => {
          const notificationsData = snapshot.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
          })) as Notification[];

          // Update notifications state
          setNotifications(notificationsData);

          // Count unread notifications
          const unread = notificationsData.filter(
            (notification) => !notification.read
          ).length;
          setUnreadCount(unread);

          // Count notifications by category
          const counts = notificationsData.reduce((acc, notification) => {
            if (!notification.read) {
              acc[notification.category] =
                (acc[notification.category] || 0) + 1;
            }
            return acc;
          }, {} as Record<NotificationCategory, number>);

          // Create a new object with default zeros for all categories first
          const fullCounts: Record<NotificationCategory, number> = {
            assignments: 0,
            quizzes: 0,
            grades: 0,
            attendance: 0,
            feedback: 0,
            messages: 0,
            system: 0,
          };

          // Then apply any actual counts over the defaults
          Object.keys(counts).forEach((category) => {
            fullCounts[category as NotificationCategory] =
              counts[category as NotificationCategory];
          });

          setCategoryCounts(fullCounts);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error("Error in notifications snapshot listener:", err);
          setError("Failed to load notifications");
          setLoading(false);
          toast({
            title: "Error",
            description: "Failed to load notifications",
            variant: "destructive",
          });
        }
      );

      // Store unsubscribe function
      unsubscribeRef.current = unsubscribe;

      // Clean up listener when component unmounts or dependencies change
      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
      };
    } catch (err) {
      console.error("Error setting up notifications listener:", err);
      setError("Failed to load notifications");
      setLoading(false);
    }
  }, [user, toast]);

  // Mark a notification as read
  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!user?.userId || !user?.schoolId) return;

      try {
        await markNotificationAsRead(
          user.schoolId,
          user.userId,
          notificationId
        );

        // No need to update state manually since the real-time listener will do it
      } catch (err) {
        console.error("Error marking notification as read:", err);
        toast({
          title: "Error",
          description: "Failed to mark notification as read",
          variant: "destructive",
        });
      }
    },
    [user, toast]
  );

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!user?.userId || !user?.schoolId) return;

    try {
      await markAllNotificationsAsRead(user.schoolId, user.userId);

      // No need to update state manually since the real-time listener will do it
      toast({
        title: "Success",
        description: "All notifications marked as read",
      });
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
      toast({
        title: "Error",
        description: "Failed to mark all notifications as read",
        variant: "destructive",
      });
    }
  }, [user, toast]);

  // Delete all read notifications
  const deleteRead = useCallback(async () => {
    if (!user?.userId || !user?.schoolId) return;

    try {
      await deleteAllReadNotifications(user.schoolId, user.userId);

      // No need to update state manually since the real-time listener will do it
      toast({
        title: "Success",
        description: "Read notifications deleted",
      });
    } catch (err) {
      console.error("Error deleting read notifications:", err);
      toast({
        title: "Error",
        description: "Failed to delete read notifications",
        variant: "destructive",
      });
    }
  }, [user, toast]);

  // Function to refresh notifications manually
  const refresh = useCallback(async () => {
    if (!user?.userId || !user?.schoolId) return;

    setLoading(true);

    try {
      // If we have a real-time listener, just force re-render
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;

        // The useEffect will re-establish the connection
        // This forces a fresh data load
      }
    } catch (err) {
      console.error("Error refreshing notifications:", err);
      toast({
        title: "Error",
        description: "Failed to refresh notifications",
        variant: "destructive",
      });
      setLoading(false);
    }
  }, [user, toast]);

  // Get filtered notifications based on selected category and unread filter
  const filteredNotifications = useCallback(() => {
    if (selectedCategory === "all") {
      return showUnreadOnly
        ? notifications.filter((n) => !n.read)
        : notifications;
    } else {
      return showUnreadOnly
        ? notifications.filter(
            (n) => !n.read && n.category === selectedCategory
          )
        : notifications.filter((n) => n.category === selectedCategory);
    }
  }, [notifications, selectedCategory, showUnreadOnly]);

  // Context value
  const contextValue: NotificationContextType = {
    notifications: filteredNotifications(),
    unreadCount,
    categoryCounts,
    loading,
    error,

    selectedCategory,
    showUnreadOnly,

    markAsRead,
    markAllAsRead,
    deleteRead,
    setSelectedCategory,
    setShowUnreadOnly,
    refresh,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};
