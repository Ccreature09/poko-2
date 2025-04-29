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
} from "firebase/firestore";

export type NotificationType = 
  | "new-assignment" 
  | "assignment-due-soon" 
  | "assignment-graded" 
  | "assignment-feedback" 
  | "late-submission"
  | "quiz-published"
  | "quiz-updated"
  | "quiz-graded"
  | "new-grade"
  | "edited-grade"
  | "deleted-grade"
  | "student-review"
  | "attendance-absent"
  | "attendance-late"
  | "attendance-excused"; // Added attendance notification types

export interface Notification {
  id?: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  relatedId?: string; // Assignment ID, submission ID, etc.
  createdAt: Timestamp;
  read: boolean;
  link?: string; // Link to related content
  targetClasses?: string[]; // For class-wide notifications
}

// Create notification for a user
export const createNotification = async (
  schoolId: string,
  notification: Omit<Notification, "id" | "createdAt" | "read">
): Promise<string> => {
  try {
    const notificationsCollection = collection(db, "schools", schoolId, "users", notification.userId, "notifications");
    
    // Prepare notification data
    const baseData = {
      ...notification,
      createdAt: Timestamp.now(),
      read: false,
    };
    
    // If link is not explicitly provided, generate it
    const notificationData = {
      ...baseData,
      // If link is already provided, use it, otherwise generate it
      link: notification.link || await getNotificationLink(
        notification.type, 
        notification.relatedId,
        notification,
        schoolId
      ),
    };
    
    const docRef = await addDoc(notificationsCollection, notificationData);
    await updateDoc(docRef, { id: docRef.id });
    
    return docRef.id;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

// Create notifications for multiple users
export const createNotificationBulk = async (
  schoolId: string,
  userIds: string[],
  notificationBase: Omit<Notification, "id" | "createdAt" | "read" | "userId">
): Promise<void> => {
  try {
    // For each user, create a notification with the base information
    const promises = userIds.map(async userId => {
      // Create a notification object for this user
      const userNotification = {
        ...notificationBase,
        userId
      };
      
      // If link is not provided in the base notification, it will be generated 
      // for each user in the createNotification function
      return createNotification(schoolId, userNotification);
    });
    
    await Promise.all(promises);
  } catch (error) {
    console.error("Error creating bulk notifications:", error);
    throw error;
  }
};

// Get notifications for a user
export const getUserNotifications = async (
  schoolId: string,
  userId: string,
  options?: { limit?: number; unreadOnly?: boolean }
): Promise<Notification[]> => {
  try {
    const notificationsCollection = collection(db, "schools", schoolId, "users", userId, "notifications");
    
    let q = query(notificationsCollection, orderBy("createdAt", "desc"));
    
    if (options?.unreadOnly) {
      q = query(q, where("read", "==", false));
    }
    
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

// Mark notification as read
export const markNotificationAsRead = async (
  schoolId: string,
  userId: string,
  notificationId: string
): Promise<void> => {
  try {
    const notificationRef = doc(db, "schools", schoolId, "users", userId, "notifications", notificationId);
    await updateDoc(notificationRef, { read: true });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (
  schoolId: string,
  userId: string
): Promise<void> => {
  try {
    const notificationsCollection = collection(db, "schools", schoolId, "users", userId, "notifications");
    const unreadQuery = query(notificationsCollection, where("read", "==", false));
    const querySnapshot = await getDocs(unreadQuery);
    
    const updatePromises = querySnapshot.docs.map(doc => 
      updateDoc(doc.ref, { read: true })
    );
    
    await Promise.all(updatePromises);
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    throw error;
  }
};

// Get unread notifications count
export const getUnreadNotificationsCount = async (
  schoolId: string,
  userId: string
): Promise<number> => {
  try {
    const notificationsCollection = collection(db, "schools", schoolId, "users", userId, "notifications");
    const unreadQuery = query(notificationsCollection, where("read", "==", false));
    const querySnapshot = await getDocs(unreadQuery);
    
    return querySnapshot.size;
  } catch (error) {
    console.error("Error getting unread notifications count:", error);
    throw error;
  }
};

/**
 * Get appropriate notification link based on notification type and related data
 */
export const getNotificationLink = async (
  type: NotificationType,
  relatedId?: string,
  notification?: Omit<Notification, "id" | "createdAt" | "read">,
  schoolId?: string
): Promise<string> => {
  // Get user role to create the appropriate link prefix
  let rolePrefix = '';
  if (notification && notification.userId && schoolId) {
    try {
      const userDoc = await getDoc(doc(db, "schools", schoolId, "users", notification.userId));
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

  switch (type) {
    // Assignment related notifications
    case "new-assignment":
    case "assignment-due-soon":
      return relatedId ? `${rolePrefix}/assignments/${relatedId}` : `${rolePrefix}/assignments`;
    
    case "assignment-graded":
    case "assignment-feedback":
    case "late-submission":
      return relatedId ? `${rolePrefix}/assignments/${relatedId}` : `${rolePrefix}/assignments`;
    
    // Quiz related notifications
    case "quiz-published":
    case "quiz-updated":
      return relatedId ? `${rolePrefix}/quizzes/${relatedId}` : `${rolePrefix}/quizzes`;
    
    case "quiz-graded":
      return relatedId ? `${rolePrefix}/quiz-reviews/${relatedId}` : `${rolePrefix}/quizzes`;
    
    // Grade related notifications
    case "new-grade":
    case "edited-grade":
    case "deleted-grade":
      return `${rolePrefix}/grades`;
    
    // Student review notifications
    case "student-review":
      if (notification && notification.userId && schoolId) {
        const userDoc = await getDoc(doc(db, "schools", schoolId, "users", notification.userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          return `/${userData.role}/feedback`;
        }
      }
      // Default fallback if user role cannot be determined
      return '/teacher/feedback';
      
    // Attendance related notifications
    case "attendance-absent":
    case "attendance-late":
    case "attendance-excused":
      return `${rolePrefix}/attendance`;
    
    // Default fallback
    default:
      return '/';
  }
};

// Create notifications for assignment deadlines (24 hours before due)
export const createAssignmentDueSoonNotifications = async (
  schoolId: string,
  assignmentId: string,
  assignmentTitle: string,
  dueDate: Timestamp,
  studentIds: string[]
): Promise<void> => {
  try {
    // Since we know these are for students, we can use the student role prefix directly
    const notificationBase = {
      title: "Наближаващ краен срок",
      message: `Вашата задача "${assignmentTitle}" трябва да бъде предадена до 24 часа`,
      type: "assignment-due-soon" as NotificationType,
      relatedId: assignmentId
      // Remove the hardcoded link so it will be generated with the appropriate role prefix
      // by the createNotification function based on user role
    };
    
    await createNotificationBulk(schoolId, studentIds, notificationBase);
  } catch (error) {
    console.error("Error creating assignment due soon notifications:", error);
    throw error;
  }
};