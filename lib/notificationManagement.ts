import { db } from "@/lib/firebase";
import {
  doc,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  limit,
  getDoc,
  writeBatch,
  deleteDoc,
  setDoc
} from "firebase/firestore";

// ====================================
// NOTIFICATION TYPES AND INTERFACES
// ====================================

export type NotificationCategory = 
  | "assignments"  // Assignment related notifications
  | "quizzes"      // Quiz related notifications
  | "grades"       // Grades related notifications
  | "attendance"   // Attendance related notifications
  | "feedback"     // Reviews, feedbacks and comments
  | "system"       // System notifications
  | "messages";    // Messages notifications

export type NotificationPriority = 
  | "low"      // Informational, not urgent
  | "medium"   // Somewhat important
  | "high"     // Important, time-sensitive
  | "urgent";  // Critical notifications

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
  icon?: string;       // Icon to display with the notification
  color?: string;      // Color theme for the notification
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;       // Label for the action button
  url?: string;        // URL to navigate to when clicked
  action?: string;     // Action identifier for custom handler
  icon?: string;       // Icon for the action button
}

export interface Notification {
  id?: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  relatedId?: string;          // Related entity ID (assignment, quiz, etc.)
  createdAt: Timestamp;
  expiresAt?: Timestamp;       // When the notification should expire
  read: boolean;
  link?: string;               // Link to related content
  icon?: string;               // Icon to display with the notification
  color?: string;              // Color theme for the notification
  actions?: NotificationAction[];
  metadata?: Record<string, any>; // Additional data related to the notification
  sendPush?: boolean;          // Whether to send as push notification
}

export interface NotificationSettings {
  userId: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  categoryPreferences: Record<NotificationCategory, {
    enabled: boolean;
    email: boolean;
    push: boolean;
  }>;
  doNotDisturbStart?: string;  // Time in HH:MM format
  doNotDisturbEnd?: string;    // Time in HH:MM format
  doNotDisturbDays?: number[]; // Days of week (0 = Sunday)
}

// Default notification settings
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  userId: '',
  emailEnabled: true,
  pushEnabled: true,
  categoryPreferences: {
    assignments: { enabled: true, email: true, push: true },
    quizzes: { enabled: true, email: true, push: true },
    grades: { enabled: true, email: true, push: true },
    attendance: { enabled: true, email: true, push: true },
    feedback: { enabled: true, email: true, push: true },
    system: { enabled: true, email: true, push: false },
    messages: { enabled: true, email: false, push: true }
  }
};

// ====================================
// NOTIFICATION TEMPLATES
// ====================================

const NOTIFICATION_TEMPLATES: Record<NotificationType, (params: Record<string, any>) => NotificationTemplate> = {
  // Assignment templates
  "new-assignment": (params) => ({
    title: "Нова задача",
    message: `Имате нова задача "${params.title}" по ${params.subjectName}`,
    category: "assignments",
    priority: "medium",
    icon: "📝",
    color: "#4f46e5"
  }),
  "assignment-due-soon": (params) => ({
    title: "Наближаващ краен срок",
    message: `Крайният срок за задача "${params.title}" по ${params.subjectName} изтича след ${params.daysLeft} ${params.daysLeft === 1 ? 'ден' : 'дни'}`,
    category: "assignments",
    priority: "high",
    icon: "⏰",
    color: "#f59e0b"
  }),
  "assignment-graded": (params) => ({
    title: "Оценена задача",
    message: `Вашата задача "${params.title}" по ${params.subjectName} беше оценена${params.grade ? ` с ${params.grade}` : ''}`,
    category: "assignments",
    priority: "medium",
    icon: "✅",
    color: "#10b981"
  }),
  "assignment-feedback": (params) => ({
    title: "Обратна връзка за задача",
    message: `Получихте обратна връзка за задача "${params.title}" по ${params.subjectName}`,
    category: "assignments",
    priority: "medium",
    icon: "💬",
    color: "#4f46e5"
  }),
  "late-submission": (params) => ({
    title: "Късно предаване",
    message: `Задача "${params.title}" по ${params.subjectName} бе предадена след крайния срок`,
    category: "assignments",
    priority: "medium",
    icon: "⚠️",
    color: "#f97316"
  }),
  "assignment-updated": (params) => ({
    title: "Актуализирана задача",
    message: `Задача "${params.title}" по ${params.subjectName} беше актуализирана`,
    category: "assignments",
    priority: "medium",
    icon: "🔄",
    color: "#4f46e5"
  }),
  "assignment-reminder": (params) => ({
    title: "Напомняне за задача",
    message: `Задача "${params.title}" по ${params.subjectName} все още не е предадена`,
    category: "assignments",
    priority: "medium",
    icon: "🔔",
    color: "#f59e0b"
  }),

  // Quiz templates
  "quiz-published": (params) => ({
    title: "Нов тест",
    message: `Публикуван е нов тест "${params.title}" по ${params.subjectName}`,
    category: "quizzes",
    priority: "medium",
    icon: "📋",
    color: "#4f46e5"
  }),
  "quiz-updated": (params) => ({
    title: "Актуализиран тест",
    message: `Тест "${params.title}" по ${params.subjectName} беше актуализиран`,
    category: "quizzes",
    priority: "medium",
    icon: "🔄",
    color: "#4f46e5"
  }),
  "quiz-graded": (params) => ({
    title: "Оценен тест",
    message: `Вашият тест "${params.title}" по ${params.subjectName} беше оценен${params.grade ? ` с ${params.grade}` : ''}`,
    category: "quizzes",
    priority: "medium",
    icon: "✅",
    color: "#10b981"
  }),
  "quiz-reminder": (params) => ({
    title: "Напомняне за тест",
    message: `Тест "${params.title}" по ${params.subjectName} все още не е завършен`,
    category: "quizzes",
    priority: "medium",
    icon: "🔔",
    color: "#f59e0b"
  }),
  "quiz-due-soon": (params) => ({
    title: "Наближаващ краен срок за тест",
    message: `Крайният срок за тест "${params.title}" по ${params.subjectName} изтича след ${params.daysLeft} ${params.daysLeft === 1 ? 'ден' : 'дни'}`,
    category: "quizzes",
    priority: "high",
    icon: "⏰",
    color: "#f59e0b"
  }),

  // Grade templates
  "new-grade": (params) => ({
    title: "Нова оценка",
    message: `Имате нова оценка ${params.grade} по ${params.subjectName}: ${params.title}`,
    category: "grades",
    priority: "medium",
    icon: "🎓",
    color: params.grade >= 4.5 ? "#10b981" : (params.grade >= 3 ? "#f59e0b" : "#ef4444")
  }),
  "edited-grade": (params) => ({
    title: "Променена оценка",
    message: `Вашата оценка по ${params.subjectName}: ${params.title} беше променена на ${params.grade}`,
    category: "grades",
    priority: "medium",
    icon: "✏️",
    color: "#4f46e5"
  }),
  "deleted-grade": (params) => ({
    title: "Изтрита оценка",
    message: `Вашата оценка ${params.grade} по ${params.subjectName}: ${params.title} беше изтрита`,
    category: "grades",
    priority: "medium",
    icon: "🗑️",
    color: "#ef4444"
  }),
  "grade-comment": (params) => ({
    title: "Коментар към оценка",
    message: `Получихте коментар към оценка по ${params.subjectName}: ${params.title}`,
    category: "grades",
    priority: "low",
    icon: "💬",
    color: "#4f46e5"
  }),

  // Feedback templates
  "student-review": (params) => ({
    title: params.type === 'positive' ? "Положителна забележка" : "Отрицателна забележка",
    message: `${params.isForStudent ? 'Имате' : `Детето ви ${params.studentName} има`} ${params.type === 'positive' ? 'положителна' : 'отрицателна'} забележка: ${params.title}`,
    category: "feedback",
    priority: params.type === 'positive' ? "medium" : "high",
    icon: params.type === 'positive' ? "👍" : "⚠️",
    color: params.type === 'positive' ? "#10b981" : "#ef4444"
  }),
  "teacher-feedback": (params) => ({
    title: "Обратна връзка от учител",
    message: `Получихте обратна връзка от ${params.teacherName}: ${params.summary}`,
    category: "feedback",
    priority: "medium",
    icon: "👨‍🏫",
    color: "#4f46e5"
  }),
  "parent-comment": (params) => ({
    title: "Коментар от родител",
    message: `Родителят на ${params.studentName} остави коментар: ${params.summary}`,
    category: "feedback",
    priority: "medium",
    icon: "👨‍👩‍👧‍👦",
    color: "#4f46e5"
  }),

  // Attendance templates
  "attendance-absent": (params) => ({
    title: "Отсъствие",
    message: `${params.isForStudent ? 'Имате' : `Детето ви ${params.studentName} има`} отсъствие по ${params.subjectName} на ${params.date}, ${params.periodNumber}-и час`,
    category: "attendance",
    priority: "high",
    icon: "❌",
    color: "#ef4444"
  }),
  "attendance-late": (params) => ({
    title: "Закъснение",
    message: `${params.isForStudent ? 'Имате' : `Детето ви ${params.studentName} има`} закъснение по ${params.subjectName} на ${params.date}, ${params.periodNumber}-и час`,
    category: "attendance",
    priority: "medium",
    icon: "⏰",
    color: "#f59e0b"
  }),
  "attendance-excused": (params) => ({
    title: "Извинено отсъствие",
    message: `${params.isForStudent ? 'Имате' : `Детето ви ${params.studentName} има`} извинено отсъствие по ${params.subjectName} на ${params.date}, ${params.periodNumber}-и час`,
    category: "attendance",
    priority: "low",
    icon: "📝",
    color: "#4f46e5"
  }),
  "attendance-updated": (params) => ({
    title: "Актуализирано присъствие",
    message: `Присъствието по ${params.subjectName} на ${params.date} беше актуализирано`,
    category: "attendance",
    priority: "medium",
    icon: "🔄",
    color: "#4f46e5"
  }),

  // System templates
  "system-announcement": (params) => ({
    title: "Системно съобщение",
    message: params.message,
    category: "system",
    priority: params.priority || "medium",
    icon: "📢",
    color: "#4b5563"
  }),
  "system-maintenance": (params) => ({
    title: "Планирана поддръжка",
    message: `Системата ще бъде недостъпна на ${params.date} от ${params.startTime} до ${params.endTime} поради планирана поддръжка`,
    category: "system",
    priority: "medium",
    icon: "🔧",
    color: "#f59e0b"
  }),
  "password-changed": (params) => ({
    title: "Променена парола",
    message: "Вашата парола беше променена успешно",
    category: "system",
    priority: "medium",
    icon: "🔒",
    color: "#10b981"
  }),
  "account-updated": (params) => ({
    title: "Актуализиран профил",
    message: "Вашият профил беше актуализиран успешно",
    category: "system",
    priority: "low",
    icon: "👤",
    color: "#4f46e5"
  }),

  // Message templates
  "new-message": (params) => ({
    title: "Ново съобщение",
    message: `Получихте ново съобщение от ${params.senderName}`,
    category: "messages",
    priority: "medium",
    icon: "✉️",
    color: "#4f46e5"
  }),
  "message-reply": (params) => ({
    title: "Отговор на съобщение",
    message: `${params.senderName} отговори на вашето съобщение`,
    category: "messages",
    priority: "medium",
    icon: "↩️",
    color: "#4f46e5"
  })
};

// ====================================
// NOTIFICATION CREATION
// ====================================

/**
 * Create a notification for a single user
 */
export const createNotification = async (
  schoolId: string,
  notification: Omit<Notification, "id" | "createdAt" | "read" | "category" | "priority"> & { 
    category?: NotificationCategory;
    priority?: NotificationPriority;
    params?: Record<string, any>;
  }
): Promise<string> => {
  try {
    // Apply template if params are provided
    let processedNotification: Omit<Notification, "id" | "createdAt" | "read"> = { 
      ...notification,
      // Ensure these required properties are always defined with defaults
      category: notification.category || getCategoryFromType(notification.type),
      priority: notification.priority || getPriorityFromType(notification.type)
    };
    
    if (notification.params && NOTIFICATION_TEMPLATES[notification.type]) {
      const template = NOTIFICATION_TEMPLATES[notification.type](notification.params);
      
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
        actions: notification.actions || template.actions
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
      console.log(`Notification suppressed based on user preferences: ${notification.type} for user ${notification.userId}`);
      return '';
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
      expiresAt: processedNotification.expiresAt || getDefaultExpiryTime(processedNotification.priority),
      read: false,
    };
    
    // If link is not explicitly provided, generate it
    const notificationData = {
      ...baseData,
      link: processedNotification.link || await generateNotificationLink(
        processedNotification.type, 
        processedNotification.relatedId,
        schoolId,
        notification.userId
      ),
    };
    
    // Add notification to Firestore
    const docRef = await addDoc(notificationsCollection, notificationData);
    await updateDoc(docRef, { id: docRef.id });
    
    // Send push notification if enabled
    if (notificationData.sendPush) {
      await sendPushNotification(
        schoolId, 
        notification.userId, 
        notificationData.title, 
        notificationData.message, 
        notificationData.link || ''
      );
    }
    
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
  notificationBase: Omit<Notification, "id" | "createdAt" | "read" | "userId" | "category" | "priority"> & { 
    params?: Record<string, any>;
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
      
      // Get user settings for this batch to check notification preferences
      const userSettings = await getUsersNotificationSettings(schoolId, userBatch);
      
      const processedNotifications: Array<{userId: string, notification: any}> = [];
      
      // Process each user's notification
      for (const userId of userBatch) {
        // Apply template if params are provided
        let processedNotification: any = { ...notificationBase };
        
        if (notificationBase.params && NOTIFICATION_TEMPLATES[notificationBase.type]) {
          const template = NOTIFICATION_TEMPLATES[notificationBase.type](notificationBase.params);
          
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
            actions: notificationBase.actions || template.actions
          };
        }
        
        // Ensure category is set
        if (!processedNotification.category) {
          processedNotification.category = getCategoryFromType(notificationBase.type);
        }

        // Ensure priority is set
        if (!processedNotification.priority) {
          processedNotification.priority = getPriorityFromType(notificationBase.type);
        }

        // Check if notification should be sent based on user preferences
        const userSetting = userSettings.find(s => s.userId === userId);
        if (userSetting) {
          const category = processedNotification.category as NotificationCategory;
          const categoryPref = userSetting.categoryPreferences[category];
          if (!categoryPref?.enabled) {
            // Skip this user if they have disabled this notification category
            continue;
          }
        }

        // Generate link for each user based on their role
        const link = await generateNotificationLink(
          processedNotification.type,
          processedNotification.relatedId,
          schoolId,
          userId
        );
        
        const notificationData = {
          ...processedNotification,
          userId,
          createdAt: Timestamp.now(),
          expiresAt: processedNotification.expiresAt || getDefaultExpiryTime(processedNotification.priority),
          read: false,
          link
        };
        
        processedNotifications.push({
          userId,
          notification: notificationData
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
      
      // Send push notifications if enabled
      for (const { userId, notification } of processedNotifications) {
        if (notification.sendPush) {
          // We do this outside the batch to prevent batch size limits
          await sendPushNotification(
            schoolId, 
            userId, 
            notification.title, 
            notification.message, 
            notification.link || ''
          );
        }
      }
    }
  } catch (error) {
    console.error("Error creating bulk notifications:", error);
    throw error;
  }
};

// ====================================
// NOTIFICATION RETRIEVAL & MANAGEMENT
// ====================================

/**
 * Get notifications for a user with filtering options
 */
export const getUserNotifications = async (
  schoolId: string,
  userId: string,
  options?: { 
    limit?: number; 
    unreadOnly?: boolean;
    category?: NotificationCategory;
    after?: Timestamp;
    before?: Timestamp;
  }
): Promise<Notification[]> => {
  try {
    const notificationsCollection = collection(
      db, "schools", schoolId, "users", userId, "notifications"
    );
    
    // Start with ordering
    let q = query(notificationsCollection, orderBy("createdAt", "desc"));
    
    // Apply filters
    if (options?.unreadOnly) {
      q = query(q, where("read", "==", false));
    }
    
    if (options?.category) {
      q = query(q, where("category", "==", options.category));
    }
    
    if (options?.after) {
      q = query(q, where("createdAt", ">=", options.after));
    }
    
    if (options?.before) {
      q = query(q, where("createdAt", "<=", options.before));
    }
    
    // Apply limit last
    if (options?.limit) {
      q = query(q, limit(options.limit));
    }
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ 
      ...doc.data(), 
      id: doc.id 
    } as Notification));
  } catch (error) {
    console.error("Error fetching notifications:", error);
    throw error;
  }
};

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
      db, "schools", schoolId, "users", userId, "notifications", notificationId
    );
    await updateDoc(notificationRef, { read: true });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = async (
  schoolId: string,
  userId: string,
  category?: NotificationCategory
): Promise<void> => {
  try {
    const notificationsCollection = collection(
      db, "schools", schoolId, "users", userId, "notifications"
    );
    
    // Build the query
    let q = query(notificationsCollection, where("read", "==", false));
    
    if (category) {
      q = query(q, where("category", "==", category));
    }
    
    const querySnapshot = await getDocs(q);
    
    // Use a batch for better performance
    const BATCH_SIZE = 500;
    let batch = writeBatch(db);
    let operationCount = 0;
    
    for (const doc of querySnapshot.docs) {
      batch.update(doc.ref, { read: true });
      operationCount++;
      
      // If batch size limit reached, commit and start a new batch
      if (operationCount >= BATCH_SIZE) {
        await batch.commit();
        batch = writeBatch(db);
        operationCount = 0;
      }
    }
    
    // Commit any remaining operations
    if (operationCount > 0) {
      await batch.commit();
    }
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    throw error;
  }
};

/**
 * Delete a notification
 */
export const deleteNotification = async (
  schoolId: string,
  userId: string,
  notificationId: string
): Promise<void> => {
  try {
    const notificationRef = doc(
      db, "schools", schoolId, "users", userId, "notifications", notificationId
    );
    await deleteDoc(notificationRef);
  } catch (error) {
    console.error("Error deleting notification:", error);
    throw error;
  }
};

/**
 * Delete all read notifications
 */
export const deleteAllReadNotifications = async (
  schoolId: string,
  userId: string,
  olderThanDays?: number
): Promise<void> => {
  try {
    const notificationsCollection = collection(
      db, "schools", schoolId, "users", userId, "notifications"
    );
    
    // Build the query
    let q = query(notificationsCollection, where("read", "==", true));
    
    // Add date filter if provided
    if (olderThanDays) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      q = query(q, where("createdAt", "<=", Timestamp.fromDate(cutoffDate)));
    }
    
    const querySnapshot = await getDocs(q);
    
    // Use a batch for better performance
    const BATCH_SIZE = 500;
    let batch = writeBatch(db);
    let operationCount = 0;
    
    for (const doc of querySnapshot.docs) {
      batch.delete(doc.ref);
      operationCount++;
      
      // If batch size limit reached, commit and start a new batch
      if (operationCount >= BATCH_SIZE) {
        await batch.commit();
        batch = writeBatch(db);
        operationCount = 0;
      }
    }
    
    // Commit any remaining operations
    if (operationCount > 0) {
      await batch.commit();
    }
  } catch (error) {
    console.error("Error deleting read notifications:", error);
    throw error;
  }
};

/**
 * Get unread notifications count
 */
export const getUnreadNotificationsCount = async (
  schoolId: string,
  userId: string,
  category?: NotificationCategory
): Promise<number> => {
  try {
    const notificationsCollection = collection(
      db, "schools", schoolId, "users", userId, "notifications"
    );
    
    // Build the query
    let q = query(notificationsCollection, where("read", "==", false));
    
    if (category) {
      q = query(q, where("category", "==", category));
    }
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error("Error getting unread notifications count:", error);
    throw error;
  }
};

/**
 * Get counts of notifications by category
 */
export const getNotificationCountsByCategory = async (
  schoolId: string,
  userId: string,
  unreadOnly: boolean = true
): Promise<Record<NotificationCategory, number>> => {
  try {
    const notificationsCollection = collection(
      db, "schools", schoolId, "users", userId, "notifications"
    );
    
    // Base query
    let q = query(notificationsCollection);
    
    // Add read filter if requested
    if (unreadOnly) {
      q = query(q, where("read", "==", false));
    }
    
    const querySnapshot = await getDocs(q);
    
    // Initialize counts for all categories
    const counts: Record<NotificationCategory, number> = {
      assignments: 0,
      quizzes: 0,
      grades: 0,
      attendance: 0,
      feedback: 0,
      system: 0,
      messages: 0
    };
    
    // Count notifications by category
    querySnapshot.docs.forEach(doc => {
      const notification = doc.data() as Notification;
      if (notification.category) {
        counts[notification.category]++;
      }
    });
    
    return counts;
  } catch (error) {
    console.error("Error getting notification counts by category:", error);
    throw error;
  }
};

// ====================================
// NOTIFICATION PREFERENCES
// ====================================

/**
 * Get user's notification settings
 */
export const getUserNotificationSettings = async (
  schoolId: string,
  userId: string
): Promise<NotificationSettings> => {
  try {
    const settingsRef = doc(
      db, "schools", schoolId, "users", userId, "settings", "notifications"
    );
    const settingsDoc = await getDoc(settingsRef);
    
    if (settingsDoc.exists()) {
      return settingsDoc.data() as NotificationSettings;
    }
    
    // Create default settings if none exist
    const defaultSettings: NotificationSettings = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      userId
    };
    
    await setDoc(settingsRef, defaultSettings);
    return defaultSettings;
  } catch (error) {
    console.error("Error getting user notification settings:", error);
    // Return default settings if there's an error
    return {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      userId
    };
  }
};

/**
 * Get notification settings for multiple users
 */
export const getUsersNotificationSettings = async (
  schoolId: string,
  userIds: string[]
): Promise<NotificationSettings[]> => {
  try {
    const promises = userIds.map(userId => 
      getUserNotificationSettings(schoolId, userId)
    );
    
    return await Promise.all(promises);
  } catch (error) {
    console.error("Error getting multiple users' notification settings:", error);
    // Return default settings for all users if there's an error
    return userIds.map(userId => ({
      ...DEFAULT_NOTIFICATION_SETTINGS,
      userId
    }));
  }
};

/**
 * Update user's notification settings
 */
export const updateUserNotificationSettings = async (
  schoolId: string,
  userId: string,
  settings: Partial<NotificationSettings>
): Promise<void> => {
  try {
    const settingsRef = doc(
      db, "schools", schoolId, "users", userId, "settings", "notifications"
    );
    
    // Get current settings
    const currentSettings = await getUserNotificationSettings(schoolId, userId);
    
    // Merge with new settings
    const updatedSettings = {
      ...currentSettings,
      ...settings,
      // Merge category preferences if provided
      categoryPreferences: settings.categoryPreferences 
        ? { ...currentSettings.categoryPreferences, ...settings.categoryPreferences }
        : currentSettings.categoryPreferences
    };
    
    await setDoc(settingsRef, updatedSettings);
  } catch (error) {
    console.error("Error updating user notification settings:", error);
    throw error;
  }
};

// ====================================
// PUSH NOTIFICATIONS
// ====================================

/**
 * Register a push notification subscription for a user
 */
export const registerPushSubscription = async (
  schoolId: string,
  userId: string,
  subscription: PushSubscription
): Promise<void> => {
  try {
    const subscriptionRef = doc(
      db, "schools", schoolId, "users", userId, "push_subscriptions", subscription.endpoint
    );
    
    await setDoc(subscriptionRef, {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.toJSON().keys?.p256dh,
        auth: subscription.toJSON().keys?.auth
      },
      createdAt: Timestamp.now()
    });
  } catch (error) {
    console.error("Error registering push subscription:", error);
    throw error;
  }
};

/**
 * Unregister a push notification subscription
 */
export const unregisterPushSubscription = async (
  schoolId: string,
  userId: string,
  endpoint: string
): Promise<void> => {
  try {
    const subscriptionRef = doc(
      db, "schools", schoolId, "users", userId, "push_subscriptions", endpoint
    );
    
    await deleteDoc(subscriptionRef);
  } catch (error) {
    console.error("Error unregistering push subscription:", error);
    throw error;
  }
};

/**
 * Send a push notification to a user
 * This would typically call a backend API that uses web-push
 */
export const sendPushNotification = async (
  schoolId: string,
  userId: string,
  title: string,
  message: string,
  url: string
): Promise<void> => {
  try {
    // In a real implementation, this would call a server-side function
    // that would use the web-push library to send the notification
    console.log(`Would send push notification to user ${userId}: ${title}`);
    
    // This is just a placeholder. In a real implementation, you would:
    // 1. Get all push subscriptions for this user
    // 2. Send the notification to each subscription
    // 3. Handle failed subscriptions (e.g., remove them)
  } catch (error) {
    console.error("Error sending push notification:", error);
    // Don't throw, just log - push notification failure shouldn't break the app
  }
};

// ====================================
// HELPER FUNCTIONS
// ====================================

/**
 * Determine if a notification should be sent based on user preferences
 */
const shouldSendNotification = async (
  schoolId: string,
  userId: string,
  category: NotificationCategory,
  priority: NotificationPriority
): Promise<boolean> => {
  try {
    // Get user settings
    const settings = await getUserNotificationSettings(schoolId, userId);
    
    // Check if the category is enabled
    const categoryPref = settings.categoryPreferences[category];
    if (!categoryPref?.enabled) {
      return false;
    }
    
    // Check if we're in do-not-disturb time (except for urgent notifications)
    if (priority !== 'urgent' && isInDoNotDisturbPeriod(settings)) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error checking notification preferences:", error);
    // Default to sending if there's an error
    return true;
  }
};

/**
 * Check if the current time is within the user's do-not-disturb period
 */
const isInDoNotDisturbPeriod = (settings: NotificationSettings): boolean => {
  if (!settings.doNotDisturbStart || !settings.doNotDisturbEnd) {
    return false;
  }
  
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Check if today is in the do-not-disturb days
  if (settings.doNotDisturbDays && settings.doNotDisturbDays.includes(dayOfWeek)) {
    const [startHour, startMinute] = settings.doNotDisturbStart.split(':').map(Number);
    const [endHour, endMinute] = settings.doNotDisturbEnd.split(':').map(Number);
    
    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    // Handle ranges that span midnight
    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      return currentTime >= startTime || currentTime <= endTime;
    }
  }
  
  return false;
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
  let rolePrefix = '';
  if (userId && schoolId) {
    try {
      const userDoc = await getDoc(doc(db, "schools", schoolId, "users", userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role) {
          rolePrefix = `/${userData.role}`;
        }
      }
    } catch (error) {
      console.error("Error fetching user role for notification link:", error);
    }
  }
  
  // Map notification types to their corresponding URLs
  const categoryMap: Record<NotificationCategory, string> = {
    assignments: `${rolePrefix}/assignments`,
    quizzes: `${rolePrefix}/quizzes`,
    grades: `${rolePrefix}/grades`,
    attendance: `${rolePrefix}/attendance`,
    feedback: `${rolePrefix}/feedback`,
    system: `${rolePrefix}/dashboard`,
    messages: `${rolePrefix}/messages`
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
 * Get the category for a notification type
 */
const getCategoryFromType = (type: NotificationType): NotificationCategory => {
  if (type.startsWith('assignment')) return 'assignments';
  if (type.startsWith('quiz')) return 'quizzes';
  if (type.includes('grade')) return 'grades';
  if (type.startsWith('attendance')) return 'attendance';
  if (type === 'student-review' || type === 'teacher-feedback' || type === 'parent-comment') return 'feedback';
  if (type.startsWith('system') || type === 'password-changed' || type === 'account-updated') return 'system';
  if (type.includes('message')) return 'messages';
  
  // Default fallback
  return 'system';
};

/**
 * Get the default priority for a notification type
 */
const getPriorityFromType = (type: NotificationType): NotificationPriority => {
  // High priority notifications
  if ([
    'assignment-due-soon',
    'attendance-absent',
    'quiz-due-soon',
    'system-maintenance'
  ].includes(type)) {
    return 'high';
  }
  
  // Low priority notifications
  if ([
    'attendance-excused',
    'account-updated',
    'grade-comment'
  ].includes(type)) {
    return 'low';
  }
  
  // Default to medium priority
  return 'medium';
};

/**
 * Get the default expiry time based on priority
 */
const getDefaultExpiryTime = (priority: NotificationPriority): Timestamp => {
  const now = new Date();
  
  switch (priority) {
    case 'urgent':
      // Urgent notifications expire after 1 day
      now.setDate(now.getDate() + 1);
      break;
    case 'high':
      // High priority notifications expire after 3 days
      now.setDate(now.getDate() + 3);
      break;
    case 'medium':
      // Medium priority notifications expire after 7 days
      now.setDate(now.getDate() + 7);
      break;
    case 'low':
      // Low priority notifications expire after 14 days
      now.setDate(now.getDate() + 14);
      break;
  }
  
  return Timestamp.fromDate(now);
};

// ====================================
// SPECIFIC NOTIFICATION TEMPLATES
// ====================================

/**
 * Create an assignment due soon notification
 */
export const createAssignmentDueSoonNotifications = async (
  schoolId: string,
  assignmentId: string,
  assignmentTitle: string,
  subjectName: string,
  dueDate: Timestamp,
  studentIds: string[]
): Promise<void> => {
  // Calculate days left
  const now = new Date();
  const dueDateTime = dueDate.toDate();
  const daysLeft = Math.ceil((dueDateTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  try {
    // Create notification base with explicit title and message that will be overridden by template
    const notificationBase = {
      type: "assignment-due-soon" as NotificationType,
      title: "Наближаващ краен срок", // Will be overridden by template if params are provided
      message: `Крайният срок за задача "${assignmentTitle}" наближава`, // Will be overridden by template
      relatedId: assignmentId,
      params: {
        title: assignmentTitle,
        subjectName,
        daysLeft
      },
      sendPush: true
    };
    
    await createNotificationBulk(schoolId, studentIds, notificationBase);
  } catch (error) {
    console.error("Error creating assignment due soon notifications:", error);
    throw error;
  }
};

/**
 * Create attendance notification for a student
 */
export const createAttendanceNotification = async (
  schoolId: string,
  studentId: string,
  studentName: string,
  subjectName: string,
  status: 'absent' | 'late' | 'excused',
  date: Timestamp,
  periodNumber: number
): Promise<void> => {
  try {
    const formattedDate = date.toDate().toLocaleDateString();
    const notificationType = `attendance-${status}` as NotificationType;
    
    // For the student
    await createNotification(schoolId, {
      userId: studentId,
      title: `${status === 'absent' ? 'Отсъствие' : (status === 'late' ? 'Закъснение' : 'Извинено отсъствие')}`,
      message: `Имате ${status === 'absent' ? 'отсъствие' : (status === 'late' ? 'закъснение' : 'извинено отсъствие')} по ${subjectName} на ${formattedDate}, ${periodNumber}-и час`,
      type: notificationType,
      relatedId: studentId,
      params: {
        isForStudent: true,
        studentName,
        subjectName,
        date: formattedDate,
        periodNumber
      },
      link: `/student/attendance`,
      sendPush: status === 'absent' // Only send push for absences
    });
    
    // Find and notify parents
    const parentsQuery = query(
      collection(db, "schools", schoolId, "users"),
      where("role", "==", "parent"),
      where("childrenIds", "array-contains", studentId)
    );
    
    const parentsSnapshot = await getDocs(parentsQuery);
    
    // Send notification to each parent
    for (const parentDoc of parentsSnapshot.docs) {
      const parentId = parentDoc.id;
      await createNotification(schoolId, {
        userId: parentId,
        title: `${status === 'absent' ? 'Отсъствие' : (status === 'late' ? 'Закъснение' : 'Извинено отсъствие')}`,
        message: `Детето ви ${studentName} има ${status === 'absent' ? 'отсъствие' : (status === 'late' ? 'закъснение' : 'извинено отсъствие')} по ${subjectName} на ${formattedDate}, ${periodNumber}-и час`,
        type: notificationType,
        relatedId: studentId,
        params: {
          isForStudent: false,
          studentName,
          subjectName,
          date: formattedDate,
          periodNumber
        },
        link: `/parent/attendance`,
        sendPush: status === 'absent' // Only send push for absences
      });
    }
  } catch (error) {
    console.error("Error creating attendance notification:", error);
    // Don't throw, just log - attendance notification failure shouldn't break the app
  }
};

/**
 * Create a system-wide announcement
 */
export const createSystemAnnouncement = async (
  schoolId: string,
  title: string,
  message: string,
  roles?: string[],
  priority: NotificationPriority = 'medium'
): Promise<void> => {
  try {
    // Get all users in the school, filtered by role if provided
    const usersCollection = collection(db, "schools", schoolId, "users");
    let usersQuery = query(usersCollection);
    
    if (roles && roles.length > 0) {
      usersQuery = query(usersCollection, where("role", "in", roles));
    }
    
    const usersSnapshot = await getDocs(usersQuery);
    const userIds = usersSnapshot.docs.map(doc => doc.id);
    
    if (userIds.length === 0) {
      console.warn("No users found for system announcement");
      return;
    }
    
    // Create the notification
    await createNotificationBulk(schoolId, userIds, {
      type: "system-announcement",
      title,
      message,
      priority,
      params: {
        message,
        priority
      },
      sendPush: priority === 'urgent' || priority === 'high'
    });
  } catch (error) {
    console.error("Error creating system announcement:", error);
    throw error;
  }
};

/**
 * Clean up old notifications across the system
 * This would typically be run as a scheduled function
 */
export const cleanupOldNotifications = async (
  schoolId: string,
  olderThanDays: number = 30
): Promise<void> => {
  try {
    // Get all users in the school
    const usersCollection = collection(db, "schools", schoolId, "users");
    const usersSnapshot = await getDocs(usersCollection);
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoffTimestamp = Timestamp.fromDate(cutoffDate);
    
    // Process each user's notifications
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const notificationsCollection = collection(db, "schools", schoolId, "users", userId, "notifications");
      
      // Find notifications older than the cutoff date
      const oldNotificationsQuery = query(
        notificationsCollection,
        where("createdAt", "<", cutoffTimestamp)
      );
      
      const oldNotificationsSnapshot = await getDocs(oldNotificationsQuery);
      
      // Delete old notifications in batches
      const BATCH_SIZE = 500;
      let batch = writeBatch(db);
      let operationCount = 0;
      
      for (const doc of oldNotificationsSnapshot.docs) {
        batch.delete(doc.ref);
        operationCount++;
        
        if (operationCount >= BATCH_SIZE) {
          await batch.commit();
          batch = writeBatch(db);
          operationCount = 0;
        }
      }
      
      if (operationCount > 0) {
        await batch.commit();
      }
    }
  } catch (error) {
    console.error("Error cleaning up old notifications:", error);
    throw error;
  }
};