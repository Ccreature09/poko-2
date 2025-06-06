/**
 * @fileoverview Utilities for managing messages and conversations within the Poko application.
 *
 * This module handles the sending of messages, creation and retrieval of conversations,
 * and fetching messages for a specific conversation. It includes authorization logic
 * to determine if a user is permitted to send a message to another user based on their roles
 * (e.g., parent to teacher, student to admin) and relationships (e.g., parent to their child,
 * teacher to their student). All operations are performed within the context of a specific school.
 */
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  orderBy,
  doc,
  getDoc,
  updateDoc,
  increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Message, Conversation, UserBase, Parent } from "@/lib/interfaces";

/**
 * Checks if a sender is authorized to send a message to a recipient within a school.
 * Implements role-based communication rules:
 * - Parents can message admins, their own children, and teachers of their children.
 * - Students can message their teachers, admins, and their parents.
 * - Teachers can message their students, parents of their students, and admins.
 * - Admins can message anyone.
 * @param sender - The UserBase object of the sender.
 * @param recipientId - The ID of the recipient user.
 * @param schoolId - The ID of the school.
 * @returns A promise that resolves to true if authorized, false otherwise.
 */
const canSendMessage = async (
  sender: UserBase,
  recipientId: string,
  schoolId: string
): Promise<boolean> => {
  if (!sender || !sender.userId || !recipientId || !schoolId) return false;

  const recipientDoc = await getDoc(
    doc(db, "schools", schoolId, "users", recipientId)
  );
  if (!recipientDoc.exists()) return false;
  const recipient = recipientDoc.data() as UserBase;

  // Define allowed communication paths
  if (sender.role === "parent") {
    // Parents can message admins, their own children, and teachers of their children
    if (recipient.role === "admin") return true;

    // Check if sender is Parent before accessing childrenIds
    if (
      recipient.role === "student" &&
      (sender as Parent).childrenIds?.includes(recipientId)
    )
      return true;

    // Check if recipient is a teacher of one of the parent's children
    if (recipient.role === "teacher") {
      const parent = sender as Parent;
      if (parent.childrenIds && parent.childrenIds.length > 0) {
        // Get all classes taught by this teacher
        const teacherClassesQuery = query(
          collection(db, "schools", schoolId, "timetable"),
          where("teacherId", "==", recipientId)
        );
        const teacherClassesSnapshot = await getDocs(teacherClassesQuery);
        const teacherClasses = teacherClassesSnapshot.docs.map((doc) =>
          doc.data()
        );

        // Get classes of each child
        for (const childId of parent.childrenIds) {
          const childDoc = await getDoc(
            doc(db, "schools", schoolId, "users", childId)
          );
          if (childDoc.exists()) {
            const childData = childDoc.data();
            // Check if any of the teacher's classes contains this child's class
            if (
              childData.homeroomClassId &&
              teacherClasses.some(
                (cls) => cls.classId === childData.homeroomClassId
              )
            ) {
              return true;
            }
          }
        }
      }
      return false; // Not a teacher of any of the parent's children
    }
    return false; // Not allowed to message other roles
  } else if (sender.role === "student") {
    // Students can message their teachers, admins, and parents
    if (recipient.role === "parent") {
      // Check if recipient is one of the student's parents
      const parentsQuery = query(
        collection(db, "schools", schoolId, "users"),
        where("role", "==", "parent"),
        where("childrenIds", "array-contains", sender.userId)
      );
      const parentsSnapshot = await getDocs(parentsQuery);
      return (
        !parentsSnapshot.empty &&
        parentsSnapshot.docs.some((doc) => doc.id === recipientId)
      );
    }

    if (recipient.role === "teacher") {
      // Check if teacher teaches this student
      const studentDoc = await getDoc(
        doc(db, "schools", schoolId, "users", sender.userId)
      );
      if (studentDoc.exists()) {
        const studentData = studentDoc.data();
        if (studentData.homeroomClassId) {
          // Check if teacher teaches this student's class
          const teacherClassesQuery = query(
            collection(db, "schools", schoolId, "timetable"),
            where("teacherId", "==", recipientId),
            where("classId", "==", studentData.homeroomClassId)
          );
          const teacherClassesSnapshot = await getDocs(teacherClassesQuery);
          return !teacherClassesSnapshot.empty;
        }
      }
      return false; // Not a teacher of this student
    }

    if (recipient.role === "admin") return true;
    return false; // Not allowed to message other roles
  } else if (sender.role === "teacher") {
    // Teachers can message their students, parents of their students, and admins
    if (recipient.role === "admin") return true;

    // Get all classes taught by this teacher
    const teacherClassesQuery = query(
      collection(db, "schools", schoolId, "timetable"),
      where("teacherId", "==", sender.userId)
    );
    const teacherClassesSnapshot = await getDocs(teacherClassesQuery);
    const teacherClasses = teacherClassesSnapshot.docs.map((doc) => doc.data());
    const teacherClassIds = teacherClasses.map((cls) => cls.classId);

    if (recipient.role === "student") {
      // Check if student is in any of the teacher's classes
      const studentDoc = await getDoc(
        doc(db, "schools", schoolId, "users", recipientId)
      );
      if (studentDoc.exists()) {
        const studentData = studentDoc.data();
        return (
          studentData.homeroomClassId &&
          teacherClassIds.includes(studentData.homeroomClassId)
        );
      }
      return false;
    }

    if (recipient.role === "parent") {
      // Check if parent has any children in teacher's classes
      const parentDoc = await getDoc(
        doc(db, "schools", schoolId, "users", recipientId)
      );
      if (parentDoc.exists() && parentDoc.data().childrenIds) {
        const parentData = parentDoc.data() as Parent;

        // Check each child
        for (const childId of parentData.childrenIds || []) {
          const childDoc = await getDoc(
            doc(db, "schools", schoolId, "users", childId)
          );
          if (childDoc.exists()) {
            const childData = childDoc.data();
            if (
              childData.homeroomClassId &&
              teacherClassIds.includes(childData.homeroomClassId)
            ) {
              return true;
            }
          }
        }
      }
      return false; // Not a parent of any student in teacher's classes
    }

    return false; // Not allowed to message other roles
  } else if (sender.role === "admin") {
    // Admins can message anyone
    return true;
  }

  return false; // Default deny
};

/**
 * Sends a message from a sender to a recipient within a specific school.
 * If a one-to-one conversation between the two users doesn't exist, it creates one.
 * Updates the conversation with the new message, timestamp, and unread count for the recipient.
 * Performs an authorization check using `canSendMessage` before proceeding.
 * @param schoolId - The ID of the school.
 * @param sender - The UserBase object of the sender, must include `userId` and `role`.
 * @param recipientId - The ID of the recipient user.
 * @param content - The text content of the message.
 * @returns A promise that resolves when the message has been sent and conversation updated.
 * @throws Will throw an error if the sender's user ID is missing, if unauthorized, or if database operations fail.
 */
export const sendMessage = async (
  schoolId: string,
  sender: UserBase,
  recipientId: string,
  content: string
): Promise<void> => {
  try {
    // Check if sender has a userId
    if (!sender.userId) {
      throw new Error("Sender user ID is required");
    }

    // Authorization Check
    const isAuthorized = await canSendMessage(sender, recipientId, schoolId);
    if (!isAuthorized) {
      throw new Error("Unauthorized to send message to this recipient.");
    }

    // Find existing conversation (simple 1-on-1 for now)
    const participants = [sender.userId, recipientId].sort(); // Consistent participant order
    const conversationsRef = collection(
      db,
      "schools",
      schoolId,
      "conversations"
    );
    const q = query(
      conversationsRef,
      where("participants", "==", participants),
      where("type", "==", "one-to-one") // Assuming 1-on-1 chats for now
    );
    const querySnapshot = await getDocs(q);

    let conversationRef;

    if (querySnapshot.empty) {
      // Create new conversation
      // Fetch recipient role to store it
      const recipientDoc = await getDoc(
        doc(db, "schools", schoolId, "users", recipientId)
      );
      const recipientRole = recipientDoc.exists()
        ? (recipientDoc.data() as UserBase).role
        : undefined;

      const newConversationData: Omit<
        Conversation,
        "conversationId" | "messages"
      > = {
        participants: participants,
        participantRoles: {
          [sender.userId]: sender.role,
          ...(recipientRole && { [recipientId]: recipientRole }), // Add recipient role if found
        },
        createdAt: new Date().toISOString(), // Convert to ISO string instead of serverTimestamp
        updatedAt: new Date().toISOString(), // Convert to ISO string instead of serverTimestamp
        type: "one-to-one",
        isGroup: false,
        unreadCount: { [recipientId]: 1 } as Record<string, number>, // Explicitly type as Record
        lastMessage: undefined, // Initialize as undefined instead of null
      };
      const newConversationRef = await addDoc(
        conversationsRef,
        newConversationData
      );
      conversationRef = newConversationRef;
    } else {
      // Use existing conversation
      conversationRef = querySnapshot.docs[0].ref;
    }

    // Add the message to the conversation's subcollection
    const messagesRef = collection(conversationRef, "messages");
    const newMessageData: Omit<Message, "messageId"> = {
      senderId: sender.userId,
      content: content,
      timestamp: new Date().toISOString(), // Use ISO string instead of serverTimestamp
      readBy: [sender.userId], // Sender has read it
      status: "sent" as const,
    };
    const newMessageRef = await addDoc(messagesRef, newMessageData);

    // Update conversation metadata (last message, timestamp, unread count)
    const recipientDoc = await getDoc(
      doc(db, "schools", schoolId, "users", recipientId)
    );
    const finalRecipientRole = recipientDoc.exists()
      ? (recipientDoc.data() as UserBase).role
      : undefined;

    // Create properly typed update object for Firestore using Record instead of interface
    // This approach is more compatible with Firestore's update operation typing
    const updateData = {
      updatedAt: new Date().toISOString(),
      "lastMessage.messageId": newMessageRef.id,
      "lastMessage.senderId": sender.userId,
      "lastMessage.content": content.substring(0, 50),
      "lastMessage.timestamp": new Date().toISOString(),
      "lastMessage.readBy": [sender.userId],
      "lastMessage.status": "sent",
      [`unreadCount.${recipientId}`]: increment(1),
    };

    // Add recipient role if available
    if (finalRecipientRole) {
      updateData[`participantRoles.${recipientId}`] = finalRecipientRole;
    }

    await updateDoc(conversationRef, updateData);
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};

/**
 * Retrieves all conversations for a given user within a specific school.
 * Conversations are ordered by the last update time (most recent first).
 * The `messages` array within each conversation object is initialized as empty;
 * messages should be fetched separately using `getMessages`.
 * @param schoolId - The ID of the school.
 * @param userId - The ID of the user whose conversations are to be fetched.
 * @returns A promise that resolves to an array of Conversation objects.
 * @throws Will throw an error if database operations fail.
 */
export const getConversations = async (
  schoolId: string,
  userId: string
): Promise<Conversation[]> => {
  try {
    const conversationsRef = collection(
      db,
      "schools",
      schoolId,
      "conversations"
    );
    const q = query(
      conversationsRef,
      where("participants", "array-contains", userId),
      orderBy("updatedAt", "desc")
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      conversationId: doc.id,
      ...(doc.data() as Omit<Conversation, "conversationId" | "messages">), // Exclude subcollection
      messages: [], // Messages fetched separately
    }));
  } catch (error) {
    console.error("Error getting conversations:", error);
    throw error;
  }
};

/**
 * Retrieves all messages for a specific conversation, ordered chronologically (oldest first).
 * @param schoolId - The ID of the school.
 * @param conversationId - The ID of the conversation whose messages are to be fetched.
 * @returns A promise that resolves to an array of Message objects.
 * @throws Will throw an error if database operations fail.
 */
export const getMessages = async (
  schoolId: string,
  conversationId: string
): Promise<Message[]> => {
  try {
    const messagesRef = collection(
      db,
      "schools",
      schoolId,
      "conversations",
      conversationId,
      "messages"
    );
    const q = query(messagesRef, orderBy("timestamp", "asc")); // Order messages chronologically
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      messageId: doc.id,
      ...(doc.data() as Omit<Message, "messageId">),
    }));
  } catch (error) {
    console.error("Error getting messages:", error);
    throw error;
  }
};
