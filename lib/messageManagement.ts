/**
 * Utilities for managing messages and conversations.
 */
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, doc, getDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "./firebase";
import type { Message, Conversation, UserBase, Role, Parent } from "./interfaces";

// Placeholder for authorization logic - refine this based on specific rules
const canSendMessage = async (sender: UserBase, recipientId: string, schoolId: string): Promise<boolean> => {
  if (!sender || !recipientId || !schoolId) return false;

  const recipientDoc = await getDoc(doc(db, "schools", schoolId, "users", recipientId));
  if (!recipientDoc.exists()) return false;
  const recipient = recipientDoc.data() as UserBase;

  // Define allowed communication paths
  if (sender.role === 'parent') {
    // Parents can message admins, their own children, and teachers of their children
    if (recipient.role === 'admin') return true;
    // Check if sender is Parent before accessing childrenIds
    if (recipient.role === 'student' && (sender as Parent).childrenIds?.includes(recipientId)) return true;
    // TODO: Add logic to check if recipient is a teacher of one of the parent's children
    // This might involve fetching the child's classes/subjects and then the teachers for those
    console.warn("Teacher messaging authorization for parents not fully implemented.");
    return false; // Placeholder
  } else if (sender.role === 'student') {
    // Students can message their parents, teachers, and admins (adjust as needed)
     if (recipient.role === 'parent') {
        // Check if recipient is one of the student's parents (requires parent data or reverse link)
        console.warn("Student to Parent messaging authorization not fully implemented.");
        return false; // Placeholder - needs parent data access or reverse link
     }
     if (recipient.role === 'teacher') return true; // TODO: Refine to only teachers of the student
     if (recipient.role === 'admin') return true;
  } else if (sender.role === 'teacher') {
     // Teachers can message their students, parents of their students, admins
     if (recipient.role === 'student') return true; // TODO: Refine to only students in their classes
     if (recipient.role === 'parent') return true; // TODO: Refine to only parents of their students
     if (recipient.role === 'admin') return true;
  } else if (sender.role === 'admin') {
    // Admins can message anyone
    return true;
  }

  return false; // Default deny
};


/**
 * Send a message between two users.
 * Creates a new conversation if one doesn't exist.
 */
export const sendMessage = async (schoolId: string, sender: UserBase, recipientId: string, content: string): Promise<void> => {
  try {
    // Authorization Check
    const isAuthorized = await canSendMessage(sender, recipientId, schoolId);
    if (!isAuthorized) {
      throw new Error("Unauthorized to send message to this recipient.");
    }

    // Find existing conversation (simple 1-on-1 for now)
    const participants = [sender.userId, recipientId].sort(); // Consistent participant order
    const conversationsRef = collection(db, "schools", schoolId, "conversations");
    const q = query(
      conversationsRef,
      where("participants", "==", participants),
      where("type", "==", "one-to-one") // Assuming 1-on-1 chats for now
    );
    const querySnapshot = await getDocs(q);

    let conversationId: string;
    let conversationRef;

    if (querySnapshot.empty) {
      // Create new conversation
      // Fetch recipient role to store it
      const recipientDoc = await getDoc(doc(db, "schools", schoolId, "users", recipientId));
      const recipientRole = recipientDoc.exists() ? (recipientDoc.data() as UserBase).role : undefined;

      const newConversationData: Omit<Conversation, 'conversationId' | 'messages'> = {
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
      const newConversationRef = await addDoc(conversationsRef, newConversationData);
      conversationId = newConversationRef.id;
      conversationRef = newConversationRef;
    } else {
      // Use existing conversation
      conversationId = querySnapshot.docs[0].id;
      conversationRef = querySnapshot.docs[0].ref;
    }

    // Add the message to the conversation's subcollection
    const messagesRef = collection(conversationRef, "messages");
    const newMessageData: Omit<Message, 'messageId'> = {
      senderId: sender.userId,
      content: content,
      timestamp: new Date().toISOString(), // Use ISO string instead of serverTimestamp
      readBy: [sender.userId], // Sender has read it
      status: "sent" as const,
    };
    const newMessageRef = await addDoc(messagesRef, newMessageData);

    // Update conversation metadata (last message, timestamp, unread count)
    const recipientDoc = await getDoc(doc(db, "schools", schoolId, "users", recipientId));
    const finalRecipientRole = recipientDoc.exists() ? (recipientDoc.data() as UserBase).role : undefined;

    await updateDoc(conversationRef, {
        updatedAt: new Date().toISOString(), // Use ISO string instead of serverTimestamp
        lastMessage: {
            messageId: newMessageRef.id,
            senderId: sender.userId,
            content: content.substring(0, 50),
            timestamp: new Date().toISOString(), // Use ISO string for consistency
            readBy: [sender.userId],
            status: "sent",
        },
        [`unreadCount.${recipientId}`]: increment(1),
        ...(finalRecipientRole && { [`participantRoles.${recipientId}`]: finalRecipientRole }), // Ensure role is updated if missing
    });


  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};

/**
 * Get all conversations for a user.
 */
export const getConversations = async (schoolId: string, userId: string): Promise<Conversation[]> => {
  try {
    const conversationsRef = collection(db, "schools", schoolId, "conversations");
    const q = query(conversationsRef, where("participants", "array-contains", userId), orderBy("updatedAt", "desc"));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => ({
      conversationId: doc.id,
      ...(doc.data() as Omit<Conversation, 'conversationId' | 'messages'>), // Exclude subcollection
      messages: [], // Messages fetched separately
    }));
  } catch (error) {
    console.error("Error getting conversations:", error);
    throw error;
  }
};

/**
 * Get messages for a specific conversation.
 */
export const getMessages = async (schoolId: string, conversationId: string): Promise<Message[]> => {
  try {
    const messagesRef = collection(db, "schools", schoolId, "conversations", conversationId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc")); // Order messages chronologically
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => ({
      messageId: doc.id,
      ...(doc.data() as Omit<Message, 'messageId'>)
    }));
  } catch (error) {
    console.error("Error getting messages:", error);
    throw error;
  }
};
