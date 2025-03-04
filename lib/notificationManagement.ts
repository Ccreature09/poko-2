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
} from "firebase/firestore";

export type NotificationType = 
  | "new-assignment" 
  | "assignment-due-soon" 
  | "assignment-graded" 
  | "assignment-feedback" 
  | "late-submission"
  | "quiz-published"
  | "quiz-updated"
  | "quiz-graded";

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
    
    const notificationData = {
      ...notification,
      createdAt: Timestamp.now(),
      read: false,
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
    // For each user, create a notification
    const promises = userIds.map(userId => 
      createNotification(schoolId, {
        ...notificationBase,
        userId
      })
    );
    
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

// Create notifications for assignment deadlines (24 hours before due)
export const createAssignmentDueSoonNotifications = async (
  schoolId: string,
  assignmentId: string,
  assignmentTitle: string,
  dueDate: Timestamp,
  studentIds: string[]
): Promise<void> => {
  try {
    const notificationBase = {
      title: "Assignment Due Soon",
      message: `Your assignment "${assignmentTitle}" is due in 24 hours`,
      type: "assignment-due-soon" as NotificationType,
      relatedId: assignmentId,
      link: `/assignments/${assignmentId}`
    };
    
    await createNotificationBulk(schoolId, studentIds, notificationBase);
  } catch (error) {
    console.error("Error creating assignment due soon notifications:", error);
    throw error;
  }
};