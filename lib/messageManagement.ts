/**
 * Utilities for managing messages and conversations.
 */
import { collection, query, where, getDocs, addDoc, orderBy, doc, getDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "./firebase";
import type { Message, Conversation, UserBase, Parent } from "./interfaces";

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
    
    // Check if recipient is a teacher of one of the parent's children
    if (recipient.role === 'teacher') {
      const parent = sender as Parent;
      if (parent.childrenIds && parent.childrenIds.length > 0) {
        // Get all classes taught by this teacher
        const teacherClassesQuery = query(
          collection(db, "schools", schoolId, "timetable"),
          where("teacherId", "==", recipientId)
        );
        const teacherClassesSnapshot = await getDocs(teacherClassesQuery);
        const teacherClasses = teacherClassesSnapshot.docs.map(doc => doc.data());
        
        // Get classes of each child
        for (const childId of parent.childrenIds) {
          const childDoc = await getDoc(doc(db, "schools", schoolId, "users", childId));
          if (childDoc.exists()) {
            const childData = childDoc.data();
            // Check if any of the teacher's classes contains this child's class
            if (childData.homeroomClassId && 
                teacherClasses.some(cls => cls.classId === childData.homeroomClassId)) {
              return true;
            }
          }
        }
      }
      return false; // Not a teacher of any of the parent's children
    }
    return false; // Not allowed to message other roles
  } else if (sender.role === 'student') {
    // Students can message their teachers, admins, and parents
    if (recipient.role === 'parent') {
      // Check if recipient is one of the student's parents
      const parentsQuery = query(
        collection(db, "schools", schoolId, "users"),
        where("role", "==", "parent"),
        where("childrenIds", "array-contains", sender.userId)
      );
      const parentsSnapshot = await getDocs(parentsQuery);
      return !parentsSnapshot.empty && parentsSnapshot.docs.some(doc => doc.id === recipientId);
    }
    
    if (recipient.role === 'teacher') {
      // Check if teacher teaches this student
      const studentDoc = await getDoc(doc(db, "schools", schoolId, "users", sender.userId));
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
    
    if (recipient.role === 'admin') return true;
    return false; // Not allowed to message other roles
  } else if (sender.role === 'teacher') {
    // Teachers can message their students, parents of their students, and admins
    if (recipient.role === 'admin') return true;
    
    // Get all classes taught by this teacher
    const teacherClassesQuery = query(
      collection(db, "schools", schoolId, "timetable"),
      where("teacherId", "==", sender.userId)
    );
    const teacherClassesSnapshot = await getDocs(teacherClassesQuery);
    const teacherClasses = teacherClassesSnapshot.docs.map(doc => doc.data());
    const teacherClassIds = teacherClasses.map(cls => cls.classId);
    
    if (recipient.role === 'student') {
      // Check if student is in any of the teacher's classes
      const studentDoc = await getDoc(doc(db, "schools", schoolId, "users", recipientId));
      if (studentDoc.exists()) {
        const studentData = studentDoc.data();
        return studentData.homeroomClassId && teacherClassIds.includes(studentData.homeroomClassId);
      }
      return false;
    }
    
    if (recipient.role === 'parent') {
      // Check if parent has any children in teacher's classes
      const parentDoc = await getDoc(doc(db, "schools", schoolId, "users", recipientId));
      if (parentDoc.exists() && parentDoc.data().childrenIds) {
        const parentData = parentDoc.data() as Parent;
        
        // Check each child
        for (const childId of parentData.childrenIds || []) {
          const childDoc = await getDoc(doc(db, "schools", schoolId, "users", childId));
          if (childDoc.exists()) {
            const childData = childDoc.data();
            if (childData.homeroomClassId && teacherClassIds.includes(childData.homeroomClassId)) {
              return true;
            }
          }
        }
      }
      return false; // Not a parent of any student in teacher's classes
    }
    
    return false; // Not allowed to message other roles
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
