import { db } from "@/lib/firebase";
import {
  doc,
  collection,
  addDoc,
  updateDoc,
  Timestamp,
  getDoc,
  writeBatch,
  deleteDoc,
} from "firebase/firestore";

// ====================================
// NOTIFICATION TYPES AND INTERFACES
// ====================================

export type NotificationCategory =
  | "assignments" // Assignment related notifications
  | "quizzes" // Quiz related notifications
  | "grades" // Grades related notifications
  | "attendance" // Attendance related notifications
  | "feedback" // Reviews, feedbacks and comments
  | "system" // System notifications
  | "messages"; // Messages notifications

export type NotificationPriority =
  | "low" // Informational, not urgent
  | "medium" // Somewhat important
  | "high" // Important, time-sensitive
  | "urgent"; // Critical notifications

export type NotificationType =
  // Assignment related notifications
  | "new-assignment"
  | "assignment-due-soon"
  | "assignment-graded"
  | "assignment-feedback"
  | "late-submission"
  | "assignment-updated"
  | "assignment-reminder"

  // Quiz related notifications
  | "quiz-published"
  | "quiz-updated"
  | "quiz-graded"
  | "quiz-reminder"
  | "quiz-due-soon"

  // Grade related notifications
  | "new-grade"
  | "edited-grade"
  | "deleted-grade"
  | "grade-comment"

  // Feedback and reviews
  | "student-review"
  | "teacher-feedback"
  | "parent-comment"

  // Attendance related notifications
  | "attendance-absent"
  | "attendance-late"
  | "attendance-excused"
  | "attendance-updated"

  // System notifications
  | "system-announcement"
  | "system-maintenance"
  | "password-changed"
  | "account-updated"

  // Message notifications
  | "new-message"
  | "message-reply";

export interface NotificationTemplate {
  title: string;
  message: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  icon?: string; // Icon to display with the notification
  color?: string; // Color theme for the notification
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string; // Label for the action button
  url?: string; // URL to navigate to when clicked
  action?: string; // Action identifier for custom handler
  icon?: string; // Icon for the action button
}

export interface Notification {
  id?: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  relatedId?: string; // Related entity ID (assignment, quiz, etc.)
  createdAt: Timestamp;
  expiresAt?: Timestamp; // When the notification should expire
  read: boolean;
  link?: string; // Link to related content
  icon?: string; // Icon to display with the notification
  color?: string; // Color theme for the notification
  actions?: NotificationAction[];
  metadata?: Record<string, unknown>; // Additional data related to the notification
  sendPush?: boolean; // Whether to send as push notification
}

// ====================================
// NOTIFICATION TEMPLATES
// ====================================

const NOTIFICATION_TEMPLATES: Record<
  NotificationType,
  (params: Record<string, unknown>) => NotificationTemplate
> = {
  // Assignment templates
  "new-assignment": (params) => ({
    title: "Нова задача",
    message: `Имате нова задача "${params.title}" по ${params.subjectName}`,
    category: "assignments",
    priority: "medium",
    icon: "📝",
    color: "#4f46e5",
  }),
  "assignment-due-soon": (params) => ({
    title: "Наближаващ краен срок",
    message: `Крайният срок за задача "${params.title}" по ${
      params.subjectName
    } изтича след ${params.daysLeft} ${params.daysLeft === 1 ? "ден" : "дни"}`,
    category: "assignments",
    priority: "high",
    icon: "⏰",
    color: "#f59e0b",
  }),
  "assignment-graded": (params) => ({
    title: "Оценена задача",
    message: `Вашата задача "${params.title}" по ${
      params.subjectName
    } беше оценена${params.grade ? ` с ${params.grade as string}` : ""}`,
    category: "assignments",
    priority: "medium",
    icon: "✅",
    color: "#10b981",
  }),
  "assignment-feedback": (params) => ({
    title: "Обратна връзка за задача",
    message: `Получихте обратна връзка за задача "${params.title}" по ${params.subjectName}`,
    category: "assignments",
    priority: "medium",
    icon: "💬",
    color: "#4f46e5",
  }),
  "late-submission": (params) => ({
    title: "Късно предаване",
    message: `Задача "${params.title}" по ${params.subjectName} бе предадена след крайния срок`,
    category: "assignments",
    priority: "medium",
    icon: "⚠️",
    color: "#f97316",
  }),
  "assignment-updated": (params) => ({
    title: "Актуализирана задача",
    message: `Задача "${params.title}" по ${params.subjectName} беше актуализирана`,
    category: "assignments",
    priority: "medium",
    icon: "🔄",
    color: "#4f46e5",
  }),
  "assignment-reminder": (params) => ({
    title: "Напомняне за задача",
    message: `Задача "${params.title}" по ${params.subjectName} все още не е предадена`,
    category: "assignments",
    priority: "medium",
    icon: "🔔",
    color: "#f59e0b",
  }),

  // Quiz templates
  "quiz-published": (params) => ({
    title: "Нов тест",
    message: `Публикуван е нов тест "${params.title}" по ${params.subjectName}`,
    category: "quizzes",
    priority: "medium",
    icon: "📋",
    color: "#4f46e5",
  }),
  "quiz-updated": (params) => ({
    title: "Актуализиран тест",
    message: `Тест "${params.title}" по ${params.subjectName} беше актуализиран`,
    category: "quizzes",
    priority: "medium",
    icon: "🔄",
    color: "#4f46e5",
  }),
  "quiz-graded": (params) => ({
    title: "Оценен тест",
    message: `Вашият тест "${params.title}" по ${
      params.subjectName
    } беше оценен${params.grade ? ` с ${params.grade as string}` : ""}`,
    category: "quizzes",
    priority: "medium",
    icon: "✅",
    color: "#10b981",
  }),
  "quiz-reminder": (params) => ({
    title: "Напомняне за тест",
    message: `Тест "${params.title}" по ${params.subjectName} все още не е завършен`,
    category: "quizzes",
    priority: "medium",
    icon: "🔔",
    color: "#f59e0b",
  }),
  "quiz-due-soon": (params) => ({
    title: "Наближаващ краен срок за тест",
    message: `Крайният срок за тест "${params.title}" по ${
      params.subjectName
    } изтича след ${params.daysLeft} ${params.daysLeft === 1 ? "ден" : "дни"}`,
    category: "quizzes",
    priority: "high",
    icon: "⏰",
    color: "#f59e0b",
  }),

  // Grade templates
  "new-grade": (params) => ({
    title: "Нова оценка",
    message: `Имате нова оценка ${params.grade as string} по ${
      params.subjectName as string
    }: ${params.title as string}`,
    category: "grades",
    priority: "medium",
    icon: "🎓",
    color:
      (params.grade as number) >= 4.5
        ? "#10b981"
        : (params.grade as number) >= 3
        ? "#f59e0b"
        : "#ef4444",
  }),
  "edited-grade": (params) => ({
    title: "Променена оценка",
    message: `Вашата оценка по ${params.subjectName as string}: ${
      params.title as string
    } беше променена на ${params.grade as string}`,
    category: "grades",
    priority: "medium",
    icon: "✏️",
    color: "#4f46e5",
  }),
  "deleted-grade": (params) => ({
    title: "Изтрита оценка",
    message: `Вашата оценка ${params.grade as string} по ${
      params.subjectName as string
    }: ${params.title as string} беше изтрита`,
    category: "grades",
    priority: "medium",
    icon: "🗑️",
    color: "#ef4444",
  }),
  "grade-comment": (params) => ({
    title: "Коментар към оценка",
    message: `Получихте коментар към оценка по ${params.subjectName}: ${params.title}`,
    category: "grades",
    priority: "low",
    icon: "💬",
    color: "#4f46e5",
  }),

  // Feedback templates
  "student-review": (params) => ({
    title:
      (params.type as string) === "positive"
        ? "Положителна забележка"
        : "Отрицателна забележка",
    message: `${
      (params.isForStudent as boolean)
        ? "Имате"
        : `Детето ви ${params.studentName as string} има`
    } ${
      (params.type as string) === "positive" ? "положителна" : "отрицателна"
    } забележка: ${params.title as string}`,
    category: "feedback",
    priority: (params.type as string) === "positive" ? "medium" : "high",
    icon: (params.type as string) === "positive" ? "👍" : "⚠️",
    color: (params.type as string) === "positive" ? "#10b981" : "#ef4444",
  }),
  "teacher-feedback": (params) => ({
    title: "Обратна връзка от учител",
    message: `Получихте обратна връзка от ${params.teacherName as string}: ${
      params.summary as string
    }`,
    category: "feedback",
    priority: "medium",
    icon: "👨‍🏫",
    color: "#4f46e5",
  }),
  "parent-comment": (params) => ({
    title: "Коментар от родител",
    message: `Родителят на ${params.studentName as string} остави коментар: ${
      params.summary as string
    }`,
    category: "feedback",
    priority: "medium",
    icon: "👨‍👩‍👧‍👦",
    color: "#4f46e5",
  }),

  // Attendance templates
  "attendance-absent": (params) => ({
    title: "Отсъствие",
    message: `${
      params.isForStudent ? "Имате" : `Детето ви ${params.studentName} има`
    } отсъствие по ${params.subjectName} на ${params.date}, ${
      params.periodNumber
    }-и час`,
    category: "attendance",
    priority: "high",
    icon: "❌",
    color: "#ef4444",
  }),
  "attendance-late": (params) => ({
    title: "Закъснение",
    message: `${
      params.isForStudent ? "Имате" : `Детето ви ${params.studentName} има`
    } закъснение по ${params.subjectName} на ${params.date}, ${
      params.periodNumber
    }-и час`,
    category: "attendance",
    priority: "medium",
    icon: "⏰",
    color: "#f59e0b",
  }),
  "attendance-excused": (params) => ({
    title: "Извинено отсъствие",
    message: `${
      params.isForStudent ? "Имате" : `Детето ви ${params.studentName} има`
    } извинено отсъствие по ${params.subjectName} на ${params.date}, ${
      params.periodNumber
    }-и час`,
    category: "attendance",
    priority: "low",
    icon: "📝",
    color: "#4f46e5",
  }),
  "attendance-updated": (params) => ({
    title: "Актуализирано присъствие",
    message: `Присъствието по ${params.subjectName} на ${params.date} беше актуализирано`,
    category: "attendance",
    priority: "medium",
    icon: "🔄",
    color: "#4f46e5",
  }),

  // System templates
  "system-announcement": (params) => ({
    title: "Системно съобщение",
    message: params.message as string,
    category: "system",
    priority: (params.priority as NotificationPriority) || "medium",
    icon: "📢",
    color: "#4b5563",
  }),
  "system-maintenance": (params) => ({
    title: "Планирана поддръжка",
    message: `Системата ще бъде недостъпна на ${params.date} от ${params.startTime} до ${params.endTime} поради планирана поддръжка`,
    category: "system",
    priority: "medium",
    icon: "🔧",
    color: "#f59e0b",
  }),
  "password-changed": () => ({
    title: "Променена парола",
    message: "Вашата парола беше променена успешно",
    category: "system",
    priority: "medium",
    icon: "🔒",
    color: "#10b981",
  }),
  "account-updated": () => ({
    title: "Актуализиран профил",
    message: "Вашият профил беше актуализиран успешно",
    category: "system",
    priority: "low",
    icon: "👤",
    color: "#4f46e5",
  }),

  // Message templates
  "new-message": (params) => ({
    title: "Ново съобщение",
    message: `Получихте ново съобщение от ${params.senderName}`,
    category: "messages",
    priority: "medium",
    icon: "✉️",
    color: "#4f46e5",
  }),
  "message-reply": (params) => ({
    title: "Отговор на съобщение",
    message: `${params.senderName} отговори на вашето съобщение`,
    category: "messages",
    priority: "medium",
    icon: "↩️",
    color: "#4f46e5",
  }),
};

// ====================================
// UTILITY FUNCTIONS
// ====================================

/**
 * Get the category based on notification type
 */
export const getCategoryFromType = (
  type: NotificationType
): NotificationCategory => {
  // Assignment related notifications
  if (type.includes("assignment")) {
    return "assignments";
  }

  // Quiz related notifications
  if (type.includes("quiz")) {
    return "quizzes";
  }

  // Grade related notifications
  if (type.includes("grade")) {
    return "grades";
  }

  // Attendance related notifications
  if (type.includes("attendance")) {
    return "attendance";
  }

  // Feedback related notifications
  if (["student-review", "teacher-feedback", "parent-comment"].includes(type)) {
    return "feedback";
  }

  // System related notifications
  if (
    type.includes("system") ||
    type === "password-changed" ||
    type === "account-updated"
  ) {
    return "system";
  }

  // Message related notifications
  if (type.includes("message")) {
    return "messages";
  }

  // Default fallback
  return "system";
};

/**
 * Get the priority based on notification type
 */
export const getPriorityFromType = (
  type: NotificationType
): NotificationPriority => {
  // High priority notifications
  if (
    type === "assignment-due-soon" ||
    type === "quiz-due-soon" ||
    type === "attendance-absent" ||
    type === "student-review"
  ) {
    return "high";
  }

  // Low priority notifications
  if (
    type === "grade-comment" ||
    type === "attendance-excused" ||
    type === "account-updated"
  ) {
    return "low";
  }

  // Default medium priority for all others
  return "medium";
};

/**
 * Get default expiry time based on priority
 */
export const getDefaultExpiryTime = (
  priority: NotificationPriority
): Timestamp => {
  const now = new Date();

  switch (priority) {
    case "urgent":
      // Urgent notifications expire in 1 day
      now.setDate(now.getDate() + 1);
      break;
    case "high":
      // High priority notifications expire in 3 days
      now.setDate(now.getDate() + 3);
      break;
    case "medium":
      // Medium priority notifications expire in 7 days
      now.setDate(now.getDate() + 7);
      break;
    case "low":
      // Low priority notifications expire in 14 days
      now.setDate(now.getDate() + 14);
      break;
  }

  return Timestamp.fromDate(now);
};

/**
 * Get the appropriate notification link based on notification type and related data
 */
export const generateNotificationLink = async (
  type: NotificationType,
  relatedId?: string,
  schoolId?: string,
  userId?: string
): Promise<string> => {
  // Get user role to create the appropriate link prefix
  let rolePrefix = "";
  let userRole = "";
  if (userId && schoolId) {
    try {
      const userDoc = await getDoc(
        doc(db, "schools", schoolId, "users", userId)
      );
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role) {
          userRole = userData.role;
          rolePrefix = `/${userData.role}`;
        }
      }
    } catch (error) {
      console.error("Error fetching user role for notification link:", error);
    }
  }

  // Special case for parent dashboard which needs schoolId
  if (userRole === "parent" && type === "system-announcement" && schoolId) {
    // For system announcements to parents, link to dashboard with schoolId
    return `/parent/dashboard/${schoolId}`;
  }

  // Map notification types to their corresponding URLs
  const categoryMap: Record<NotificationCategory, string> = {
    assignments: `${rolePrefix}/assignments`,
    quizzes: `${rolePrefix}/quizzes`,
    grades: `${rolePrefix}/grades`,
    attendance: `${rolePrefix}/attendance`,
    feedback: `${rolePrefix}/feedback`,
    system:
      userRole === "parent"
        ? `/parent/dashboard/${schoolId}`
        : `${rolePrefix}/dashboard`,
    messages: `${rolePrefix}/messages`,
  };

  // Get the category from the notification type
  const category = getCategoryFromType(type);

  // Build the URL based on type and related ID
  let url = categoryMap[category];

  // Add related ID for detail pages if available
  if (relatedId) {
    // Special case handling
    switch (type) {
      case "new-assignment":
      case "assignment-due-soon":
      case "assignment-graded":
      case "assignment-feedback":
      case "late-submission":
      case "assignment-updated":
      case "assignment-reminder":
        url = `${rolePrefix}/assignments/${relatedId}`;
        break;

      case "quiz-published":
      case "quiz-updated":
      case "quiz-graded":
      case "quiz-reminder":
      case "quiz-due-soon":
        url = `${rolePrefix}/quizzes/${relatedId}`;
        break;

      case "new-message":
      case "message-reply":
        url = `${rolePrefix}/messages/${relatedId}`;
        break;

      // For other types, just use the base category URL
    }
  }

  return url;
};

/**
 * Check if notification should be sent based on user preferences
 */
export const shouldSendNotification = async (
  schoolId: string,
  userId: string,
  category: NotificationCategory,
  priority: NotificationPriority
): Promise<boolean> => {
  try {
    // Get user notification settings
    const userSettingsDoc = await getDoc(
      doc(db, "schools", schoolId, "users", userId, "settings", "notifications")
    );

    // If no settings are found, use default (which is to send all notifications)
    if (!userSettingsDoc.exists()) {
      return true;
    }

    const settings = userSettingsDoc.data();

    // Check if the category is enabled
    const categoryPref = settings.categoryPreferences[category];
    if (!categoryPref?.enabled) {
      return false;
    }

    // Check Do Not Disturb settings
    if (settings.doNotDisturbStart && settings.doNotDisturbEnd) {
      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

      // Check if today is a DND day
      if (settings.doNotDisturbDays?.includes(currentDay)) {
        // Parse DND time ranges
        const [startHours, startMinutes] = settings.doNotDisturbStart
          .split(":")
          .map(Number);
        const [endHours, endMinutes] = settings.doNotDisturbEnd
          .split(":")
          .map(Number);

        // Create date objects for comparison
        const startTime = new Date();
        startTime.setHours(startHours, startMinutes, 0, 0);

        const endTime = new Date();
        endTime.setHours(endHours, endMinutes, 0, 0);

        // Check if current time is within DND period
        // If it crosses midnight, need special handling
        if (endTime < startTime) {
          // DND period crosses midnight
          if (now >= startTime || now <= endTime) {
            // Only allow urgent notifications during DND
            return priority === "urgent";
          }
        } else {
          // Normal time range
          if (now >= startTime && now <= endTime) {
            // Only allow urgent notifications during DND
            return priority === "urgent";
          }
        }
      }
    }

    // All checks passed, notification should be sent
    return true;
  } catch (error) {
    console.error("Error checking notification settings:", error);
    // In case of error, default to sending the notification
    return true;
  }
};

/**
 * Get notification settings for a list of users
 */
export const getUsersNotificationSettings = async (
  schoolId: string,
  userIds: string[]
): Promise<Record<string, unknown>[]> => {
  try {
    const settings: Record<string, unknown>[] = [];

    // Get settings for each user
    for (const userId of userIds) {
      const settingsDoc = await getDoc(
        doc(
          db,
          "schools",
          schoolId,
          "users",
          userId,
          "settings",
          "notifications"
        )
      );

      if (settingsDoc.exists()) {
        settings.push({
          ...(settingsDoc.data() as Record<string, unknown>),
          userId,
        });
      } else {
        // Use default settings if none found
        settings.push({
          userId,
        });
      }
    }

    return settings;
  } catch (error) {
    console.error("Error fetching user notification settings:", error);
    // Return a list of default settings in case of error
    return userIds.map((userId) => ({
      userId,
    }));
  }
};

// ====================================
// NOTIFICATION CREATION
// ====================================

/**
 * Create a notification for a single user
 */
export const createNotification = async (
  schoolId: string,
  notification: Omit<
    Notification,
    "id" | "createdAt" | "read" | "category" | "priority"
  > & {
    category?: NotificationCategory;
    priority?: NotificationPriority;
    params?: Record<string, unknown>;
  }
): Promise<string> => {
  try {
    // Apply template if params are provided
    let processedNotification: Omit<Notification, "id" | "createdAt" | "read"> =
      {
        ...notification,
        // Ensure these required properties are always defined with defaults
        category:
          notification.category || getCategoryFromType(notification.type),
        priority:
          notification.priority || getPriorityFromType(notification.type),
      };

    if (notification.params && NOTIFICATION_TEMPLATES[notification.type]) {
      const template = NOTIFICATION_TEMPLATES[notification.type](
        notification.params
      );

      // Override template values with any explicitly provided values
      processedNotification = {
        ...template,
        ...notification,
        // Don't override these if they were explicitly set
        title: notification.title || template.title,
        message: notification.message || template.message,
        category: notification.category || template.category,
        priority: notification.priority || template.priority,
        icon: notification.icon || template.icon,
        color: notification.color || template.color,
        actions: notification.actions || template.actions,
      };
    }

    // Check if notification should be sent based on user preferences
    const shouldSend = await shouldSendNotification(
      schoolId,
      notification.userId,
      processedNotification.category,
      processedNotification.priority
    );

    if (!shouldSend) {
      console.log(
        `Notification suppressed based on user preferences: ${notification.type} for user ${notification.userId}`
      );
      return "";
    }

    const notificationsCollection = collection(
      db,
      "schools",
      schoolId,
      "users",
      notification.userId,
      "notifications"
    );

    // Prepare notification data
    const baseData = {
      ...processedNotification,
      createdAt: Timestamp.now(),
      expiresAt:
        processedNotification.expiresAt ||
        getDefaultExpiryTime(processedNotification.priority),
      read: false,
    };

    // If link is not explicitly provided, generate it
    const notificationData = {
      ...baseData,
      link:
        processedNotification.link ||
        (await generateNotificationLink(
          processedNotification.type,
          processedNotification.relatedId,
          schoolId,
          notification.userId
        )),
    };

    // Add notification to Firestore
    const docRef = await addDoc(notificationsCollection, notificationData);
    await updateDoc(docRef, { id: docRef.id });

    return docRef.id;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

/**
 * Create notifications for multiple users efficiently
 */
export const createNotificationBulk = async (
  schoolId: string,
  userIds: string[],
  notificationBase: Omit<
    Notification,
    "id" | "createdAt" | "read" | "userId" | "category" | "priority"
  > & {
    params?: Record<string, unknown>;
    category?: NotificationCategory;
    priority?: NotificationPriority;
  }
): Promise<void> => {
  try {
    // Use a batch for better performance with large numbers of recipients
    const BATCH_SIZE = 500; // Firestore batch size limit
    const uniqueUserIds = [...new Set(userIds)]; // Remove duplicates

    // Process in batches to respect Firestore limits
    for (let i = 0; i < uniqueUserIds.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const userBatch = uniqueUserIds.slice(i, i + BATCH_SIZE);

      const processedNotifications: Array<{
        userId: string;
        notification: Record<string, unknown>;
      }> = [];

      // Process each user's notification
      for (const userId of userBatch) {
        // Apply template if params are provided
        let processedNotification: Record<string, unknown> = {
          ...notificationBase,
        };

        if (
          notificationBase.params &&
          NOTIFICATION_TEMPLATES[notificationBase.type]
        ) {
          const template = NOTIFICATION_TEMPLATES[notificationBase.type](
            notificationBase.params
          );

          processedNotification = {
            ...template,
            ...notificationBase,
            // Don't override these if they were explicitly set
            title: notificationBase.title || template.title,
            message: notificationBase.message || template.message,
            category: notificationBase.category || template.category,
            priority: notificationBase.priority || template.priority,
            icon: notificationBase.icon || template.icon,
            color: notificationBase.color || template.color,
            actions: notificationBase.actions || template.actions,
          };
        }

        // Ensure category is set
        if (!processedNotification.category) {
          processedNotification.category = getCategoryFromType(
            notificationBase.type
          );
        }

        // Ensure priority is set
        if (!processedNotification.priority) {
          processedNotification.priority = getPriorityFromType(
            notificationBase.type
          );
        }

        // Always send notification since settings functionality has been removed
        // Generate link for each user based on their role
        const link = await generateNotificationLink(
          processedNotification.type as NotificationType,
          processedNotification.relatedId as string,
          schoolId,
          userId
        );

        const notificationData = {
          ...processedNotification,
          userId,
          createdAt: Timestamp.now(),
          expiresAt:
            processedNotification.expiresAt ||
            getDefaultExpiryTime(
              processedNotification.priority as NotificationPriority
            ),
          read: false,
          link,
        };

        processedNotifications.push({
          userId,
          notification: notificationData,
        });
      }

      // Add all notifications to batch
      for (const { userId, notification } of processedNotifications) {
        const notificationRef = doc(
          collection(db, "schools", schoolId, "users", userId, "notifications")
        );
        batch.set(notificationRef, { ...notification, id: notificationRef.id });
      }

      // Commit the batch
      if (processedNotifications.length > 0) {
        await batch.commit();
      }
    }
  } catch (error) {
    console.error("Error creating bulk notifications:", error);
    throw error;
  }
};

// ====================================
// NOTIFICATION RETRIEVAL
// ====================================

/**
 * Get notifications for a user with optional filtering and pagination
 */
export const getUserNotifications = async (
  schoolId: string,
  userId: string,
  options?: {
    limit?: number;
    startAfter?: Timestamp;
    category?: NotificationCategory;
    onlyUnread?: boolean;
  }
): Promise<Notification[]> => {
  try {
    const {
      limit = 50,
      startAfter,
      category,
      onlyUnread = false,
    } = options || {};

    // Import needed Firestore functions
    const {
      query,
      orderBy,
      limit: limitQuery,
      where,
      startAfter: startAfterQuery,
    } = await import("firebase/firestore");

    // Import getDocs separately to avoid TypeScript error
    const { getDocs } = await import("firebase/firestore");

    // Build query with filters
    let notificationsQuery = query(
      collection(db, "schools", schoolId, "users", userId, "notifications"),
      orderBy("createdAt", "desc")
    );

    // Apply category filter if specified
    if (category) {
      notificationsQuery = query(
        notificationsQuery,
        where("category", "==", category)
      );
    }

    // Filter by read status if requested
    if (onlyUnread) {
      notificationsQuery = query(
        notificationsQuery,
        where("read", "==", false)
      );
    }

    // Apply pagination starting point
    if (startAfter) {
      notificationsQuery = query(
        notificationsQuery,
        startAfterQuery(startAfter)
      );
    }

    // Apply limit for pagination
    notificationsQuery = query(notificationsQuery, limitQuery(limit));

    // Execute query
    const querySnapshot = await getDocs(notificationsQuery);

    // Convert to array of notifications
    return querySnapshot.docs.map((doc) => doc.data() as Notification);
  } catch (error) {
    console.error("Error fetching user notifications:", error);
    return [];
  }
};

/**
 * Get the count of unread notifications for a user
 */
export const getUnreadNotificationsCount = async (
  schoolId: string,
  userId: string
): Promise<number> => {
  try {
    // Import needed Firestore functions
    const { query, where, getCountFromServer } = await import(
      "firebase/firestore"
    );

    // Create a query for unread notifications
    const unreadQuery = query(
      collection(db, "schools", schoolId, "users", userId, "notifications"),
      where("read", "==", false)
    );

    // Use the server-side count feature for efficiency
    const countSnapshot = await getCountFromServer(unreadQuery);
    return countSnapshot.data().count;
  } catch (error) {
    console.error("Error counting unread notifications:", error);
    return 0;
  }
};

/**
 * Get the count of unread notifications by category
 */
export const getNotificationCountsByCategory = async (
  schoolId: string,
  userId: string,
  onlyUnread: boolean = false
): Promise<Record<NotificationCategory, number>> => {
  try {
    // Import needed Firestore functions
    const { query, where, getDocs } = await import("firebase/firestore");

    // Initialize counts with zero for all categories
    const counts: Record<NotificationCategory, number> = {
      assignments: 0,
      quizzes: 0,
      grades: 0,
      attendance: 0,
      feedback: 0,
      system: 0,
      messages: 0,
    };

    // Determine filter conditions
    let baseQuery = query(
      collection(db, "schools", schoolId, "users", userId, "notifications")
    );

    // Add read filter if only counting unread
    if (onlyUnread) {
      baseQuery = query(baseQuery, where("read", "==", false));
    }

    // Fetch notifications
    const querySnapshot = await getDocs(baseQuery);

    // Count by category
    querySnapshot.forEach((doc) => {
      const notification = doc.data() as Notification;
      if (notification.category) {
        counts[notification.category]++;
      }
    });

    return counts;
  } catch (error) {
    console.error("Error counting notifications by category:", error);
    return {
      assignments: 0,
      quizzes: 0,
      grades: 0,
      attendance: 0,
      feedback: 0,
      system: 0,
      messages: 0,
    };
  }
};

// ====================================
// NOTIFICATION MANAGEMENT
// ====================================

/**
 * Mark a notification as read
 */
export const markNotificationAsRead = async (
  schoolId: string,
  userId: string,
  notificationId: string
): Promise<void> => {
  try {
    const notificationRef = doc(
      db,
      "schools",
      schoolId,
      "users",
      userId,
      "notifications",
      notificationId
    );

    await updateDoc(notificationRef, { read: true });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }
};

/**
 * Mark all notifications as read for a user
 * Optionally filter by category
 */
export const markAllNotificationsAsRead = async (
  schoolId: string,
  userId: string,
  category?: NotificationCategory
): Promise<void> => {
  try {
    // Import needed Firestore functions
    const { query, where, getDocs } = await import("firebase/firestore");

    // Build query for unread notifications
    let notificationsQuery = query(
      collection(db, "schools", schoolId, "users", userId, "notifications"),
      where("read", "==", false)
    );

    // Add category filter if specified
    if (category) {
      notificationsQuery = query(
        notificationsQuery,
        where("category", "==", category)
      );
    }

    // Get all relevant notifications
    const querySnapshot = await getDocs(notificationsQuery);

    // Use batch for efficiency
    const batch = writeBatch(db);

    // Mark all as read
    querySnapshot.forEach((docSnapshot) => {
      batch.update(docSnapshot.ref, { read: true });
    });

    // Commit the batch if there are updates
    if (querySnapshot.size > 0) {
      await batch.commit();
    }
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    throw error;
  }
};

/**
 * Delete all read notifications for a user
 */
export const deleteAllReadNotifications = async (
  schoolId: string,
  userId: string
): Promise<void> => {
  try {
    // Import needed Firestore functions
    const { query, where, getDocs } = await import("firebase/firestore");

    // Query for read notifications
    const readQuery = query(
      collection(db, "schools", schoolId, "users", userId, "notifications"),
      where("read", "==", true)
    );

    const querySnapshot = await getDocs(readQuery);

    // Use batch for efficiency
    const batch = writeBatch(db);

    // Mark all for deletion
    querySnapshot.forEach((docSnapshot) => {
      batch.delete(docSnapshot.ref);
    });

    // Commit the batch if there are deletions
    if (querySnapshot.size > 0) {
      await batch.commit();
    }
  } catch (error) {
    console.error("Error deleting read notifications:", error);
    throw error;
  }
};

/**
 * Delete a specific notification
 */
export const deleteNotification = async (
  schoolId: string,
  userId: string,
  notificationId: string
): Promise<void> => {
  try {
    const notificationRef = doc(
      db,
      "schools",
      schoolId,
      "users",
      userId,
      "notifications",
      notificationId
    );

    await deleteDoc(notificationRef);
  } catch (error) {
    console.error("Error deleting notification:", error);
    throw error;
  }
};
