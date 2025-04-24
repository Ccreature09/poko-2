"use client";

import type React from "react";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { 
  setDoc,
  collection, 
  onSnapshot, 
  doc, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs,
  serverTimestamp,
  arrayUnion,
  Timestamp,
  getDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { v4 as uuidv4 } from 'uuid';
import type { 
  Conversation, 
  Message, 
  MessageFilter, 
  MessagePermissions, 
  ConversationType,
  User,
  HomeroomClass
} from "@/lib/interfaces";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";

type MessagingContextType = {
  conversations: Conversation[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  currentConversation: Conversation | null;
  permissions: MessagePermissions;
  
  // Actions
  sendMessage: (conversationId: string, content: string, replyToId?: string) => Promise<boolean>;
  createConversation: (participants: string[], isGroup: boolean, groupName?: string, type?: ConversationType) => Promise<string | null>;
  markAsRead: (conversationId: string, messageIds: string[]) => Promise<void>;
  setCurrentConversation: (conversationId: string | null) => Promise<void>;
  searchMessages: (filter: MessageFilter) => Promise<Conversation[]>;
  fetchUsersByRole: (role: string) => Promise<User[]>;
  fetchClasses: () => Promise<HomeroomClass[]>;
  canMessageUser: (userId: string) => Promise<boolean>; // Changed to return Promise<boolean>
  deleteMessage: (conversationId: string, messageId: string) => Promise<boolean>;
  sendAnnouncement: (content: string, recipientRoles: string[]) => Promise<boolean>;
  sendClassMessage: (classId: string, content: string) => Promise<boolean>;
};

const MessagingContext = createContext<MessagingContextType>({
  conversations: [],
  unreadCount: 0,
  loading: true,
  error: null,
  currentConversation: null,
  permissions: {
    canSendToStudents: false,
    canSendToTeachers: false,
    canSendToAdmins: false,
    canSendToClass: false,
    canSendAnnouncement: false,
    canModerateMessages: false,
  },
  
  sendMessage: async () => false,
  createConversation: async () => null,
  markAsRead: async () => {},
  setCurrentConversation: async () => {},
  searchMessages: async () => [],
  fetchUsersByRole: async () => [],
  fetchClasses: async () => [],
  canMessageUser: async () => false,
  deleteMessage: async () => false,
  sendAnnouncement: async () => false,
  sendClassMessage: async () => false,
});

export const useMessaging = () => useContext(MessagingContext);

export const MessagingProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentConversation, setCurrentConversationState] = useState<Conversation | null>(null);
  const [permissions, setPermissions] = useState<MessagePermissions>({
    canSendToStudents: false,
    canSendToTeachers: false,
    canSendToAdmins: false,
    canSendToClass: false,
    canSendAnnouncement: false,
    canModerateMessages: false,
  });
  const { user } = useUser();
  const { toast } = useToast();

  // Set permissions based on user role
  useEffect(() => {
    if (!user) return;

    const newPermissions: MessagePermissions = {
      canSendToStudents: false,
      canSendToTeachers: false,
      canSendToAdmins: false,
      canSendToClass: false,
      canSendAnnouncement: false,
      canModerateMessages: false,
    };

    switch (user.role) {
      case "admin":
        newPermissions.canSendToStudents = true;
        newPermissions.canSendToTeachers = true;
        newPermissions.canSendToAdmins = true;
        newPermissions.canSendToClass = true;
        newPermissions.canSendAnnouncement = true;
        newPermissions.canModerateMessages = true;
        break;
      case "teacher":
        newPermissions.canSendToStudents = true;
        newPermissions.canSendToTeachers = true;
        newPermissions.canSendToAdmins = true;
        newPermissions.canSendToClass = true;
        break;
      case "student":
        newPermissions.canSendToTeachers = true;
        newPermissions.canSendToAdmins = true;
        break;
      case "parent":
        newPermissions.canSendToTeachers = true;
        newPermissions.canSendToAdmins = true;
        break;
    }

    setPermissions(newPermissions);
  }, [user]);

  // Fetch conversations
  useEffect(() => {
    if (!user || !user.userId || !user.schoolId) {
      setLoading(false);
      setError("User not authenticated");
      return;
    }

    const schoolRef = doc(db, "schools", user.schoolId);
    const userRef = doc(schoolRef, "users", user.userId);
    const conversationsRef = collection(userRef, "conversations");

    const unsubscribe = onSnapshot(
      conversationsRef,
      (querySnapshot) => {
        const conversationsList = querySnapshot.docs.map(
          (doc) => ({
            ...doc.data(),
            conversationId: doc.id,
          } as Conversation)
        );
        
        // Sort conversations by most recent message
        conversationsList.sort((a, b) => 
          new Date(b.updatedAt || b.createdAt).getTime() - 
          new Date(a.updatedAt || a.createdAt).getTime()
        );
        
        setConversations(conversationsList);
        
        // Calculate total unread messages
        const totalUnread = conversationsList.reduce(
          (acc, conv) => {
            if (!conv.unreadCount) return acc;
            // Handle case where unreadCount is a Record<string, number>
            if (typeof conv.unreadCount === 'object') {
              return acc + (conv.unreadCount[user.userId] || 0);
            }
            // Backward compatibility for when unreadCount was a number
            return acc + (typeof conv.unreadCount === 'number' ? conv.unreadCount : 0);
          }, 0
        );
        setUnreadCount(totalUnread);
        
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Error fetching conversations:", err);
        setError("Failed to fetch conversations");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Set current conversation
  const setCurrentConversation = useCallback(async (conversationId: string | null) => {
    if (!conversationId || !user) {
      setCurrentConversationState(null);
      return;
    }

    // Find conversation in state first for immediate UI update
    const existingConversation = conversations.find(c => c.conversationId === conversationId);
    if (existingConversation) {
      setCurrentConversationState(existingConversation);
    }

    // Then fetch fresh data from Firestore
    try {
      const schoolRef = doc(db, "schools", user.schoolId);
      const userRef = doc(schoolRef, "users", user.userId);
      const conversationRef = doc(collection(userRef, "conversations"), conversationId);
      const conversationSnap = await getDoc(conversationRef);
      
      if (conversationSnap.exists()) {
        const conversationData = {
          ...conversationSnap.data(),
          conversationId: conversationSnap.id
        } as Conversation;
        setCurrentConversationState(conversationData);
        
        // Mark all messages as read when opening a conversation
        if (conversationData.unreadCount) {
          // Check if there are unread messages for this user
          const hasUnread = typeof conversationData.unreadCount === 'object' 
            ? (conversationData.unreadCount[user.userId] || 0) > 0
            : conversationData.unreadCount > 0;
            
          if (hasUnread) {
            const unreadMessages = conversationData.messages
              .filter(msg => !msg.readBy.includes(user.userId))
              .map(msg => msg.messageId);
            
            if (unreadMessages.length > 0) {
              await markAsRead(conversationId, unreadMessages);
            }
          }
        }
      } else {
        setError("Conversation not found");
      }
    } catch (err) {
      console.error("Error fetching conversation:", err);
      setError("Failed to fetch conversation details");
    }
  }, [conversations, user]);

  // Send message
  const sendMessage = useCallback(async (
    conversationId: string, 
    content: string, 
    replyToId?: string
  ): Promise<boolean> => {
    if (!user || !content.trim()) return false;
    
    try {
      const schoolRef = doc(db, "schools", user.schoolId);
      const conversationRef = doc(collection(schoolRef, "conversations"), conversationId);
      const conversationSnap = await getDoc(conversationRef);
      
      if (!conversationSnap.exists()) {
        toast({
          title: "Error",
          description: "Conversation not found",
          variant: "destructive"
        });
        return false;
      }
      
      const newMessage: Message = {
        messageId: uuidv4(),
        senderId: user.userId,
        content: content.trim(),
        timestamp: new Date().toISOString(),
        readBy: [user.userId], // Sender has read the message
        status: "sent",
        ...(replyToId && { replyTo: replyToId }),
      };
      
      // Get the current conversation data to update messages locally
      const conversationData = conversationSnap.data() as Conversation;
      const updatedMessages = [...(conversationData.messages || []), newMessage];
      
      // Update the master conversation with the new message
      await updateDoc(conversationRef, {
        messages: updatedMessages,
        updatedAt: serverTimestamp(),
        lastMessage: newMessage
      });
      
      // Update all participants' conversation copies (including the sender)
      for (const participantId of conversationData.participants) {
        const participantRef = doc(schoolRef, "users", participantId);
        const userConvRef = doc(collection(participantRef, "conversations"), conversationId);
        
        // Get the participant's conversation copy
        const userConvSnap = await getDoc(userConvRef);
        const userConvData = userConvSnap.exists() 
          ? userConvSnap.data() as Conversation 
          : { 
              messages: [],
              unreadCount: 0,
              participants: conversationData.participants,
              isGroup: conversationData.isGroup,
              createdAt: conversationData.createdAt,
              updatedAt: conversationData.updatedAt,
              type: conversationData.type,
              ...(conversationData.isGroup && { groupName: conversationData.groupName })
            };
          
        // Update with different unread count based on if it's the sender or not
        const currentUnreadCount = typeof userConvData.unreadCount === 'object' 
          ? userConvData.unreadCount 
          : { [user.userId]: 0 }; // Initialize as object if it's not already
          
        await updateDoc(userConvRef, {
          messages: [...(userConvData.messages || []), newMessage],
          unreadCount: participantId === user.userId 
            ? currentUnreadCount // Don't increase unread count for sender
            : { 
                ...currentUnreadCount,
                [participantId]: ((currentUnreadCount[participantId] || 0) + 1) 
              }, // Increase for other participants
          updatedAt: serverTimestamp(),
          lastMessage: newMessage
        });
      }
      
      // Update current conversation locally if this is the active conversation
      if (currentConversation && currentConversation.conversationId === conversationId) {
        setCurrentConversationState(prev => {
          if (!prev) return null;
          return {
            ...prev,
            messages: [...(prev.messages || []), newMessage],
            updatedAt: new Date().toISOString()
          };
        });
      }
      
      return true;
    } catch (err) {
      console.error("Error sending message:", err);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
      return false;
    }
  }, [user, toast, currentConversation]);

  // Create new conversation
  const createConversation = useCallback(async (
    participants: string[], 
    isGroup: boolean = false,
    groupName?: string,
    type: ConversationType = "one-to-one"
  ): Promise<string | null> => {
    if (!user) return null;
    
    // Ensure current user is included in participants
    if (!participants.includes(user.userId)) {
      participants.push(user.userId);
    }
    
    try {
      const schoolRef = doc(db, "schools", user.schoolId);
      
      // Check if conversation already exists (for one-to-one)
      if (!isGroup && participants.length === 2) {
        const otherParticipantId = participants.find(id => id !== user.userId) || '';
        
        // Query for existing conversations
        const userRef = doc(schoolRef, "users", user.userId);
        const conversationsRef = collection(userRef, "conversations");
        const q = query(
          conversationsRef, 
          where("isGroup", "==", false),
          where("participants", "array-contains", otherParticipantId)
        );
        
        const existingConversations = await getDocs(q);
        if (!existingConversations.empty) {
          // Return the existing conversation ID
          const existingId = existingConversations.docs[0].id;
          
          // Set as current conversation for immediate access
          await setCurrentConversation(existingId);
          
          return existingId;
        }
      }
      
      // Initialize base conversation object
      const conversationBase = {
        participants,
        messages: [],
        isGroup,
        ...(isGroup && { groupName }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type,
        unreadCount: 0
      };
      
      // Create new conversation
      const conversationsCollectionRef = collection(schoolRef, "conversations");
      const newConversationRef = await addDoc(conversationsCollectionRef, conversationBase);
      const newConversationId = newConversationRef.id;
      
      // Create references for each participant
      for (const participantId of participants) {
        const participantRef = doc(schoolRef, "users", participantId);
        const userConversationsRef = collection(participantRef, "conversations");
        
        await setDoc(doc(userConversationsRef, newConversationId), {
          ...conversationBase,
          conversationId: newConversationId
        });
      }
      
      // Set as current conversation for immediate access
      await setCurrentConversation(newConversationId);
      
      return newConversationId;
    } catch (err) {
      console.error("Error creating conversation:", err);
      toast({
        title: "Error",
        description: "Failed to create conversation",
        variant: "destructive"
      });
      return null;
    }
  }, [user, toast, setCurrentConversation]);

  // Mark messages as read
  const markAsRead = useCallback(async (
    conversationId: string, 
    messageIds: string[]
  ): Promise<void> => {
    if (!user || !conversationId || messageIds.length === 0) return;
    
    try {
      const schoolRef = doc(db, "schools", user.schoolId);
      const userRef = doc(schoolRef, "users", user.userId);
      const conversationRef = doc(collection(userRef, "conversations"), conversationId);
      const conversationSnap = await getDoc(conversationRef);
      
      if (!conversationSnap.exists()) return;
      
      const conversationData = conversationSnap.data() as Conversation;
      const updatedMessages = conversationData.messages.map(msg => {
        if (messageIds.includes(msg.messageId) && !msg.readBy.includes(user.userId)) {
          return {
            ...msg,
            readBy: [...msg.readBy, user.userId],
            status: "read"
          };
        }
        return msg;
      });
      
      await updateDoc(conversationRef, {
        messages: updatedMessages,
        unreadCount: { [user.userId]: 0 } // Initialize or reset unread count for this user as an object
      });
      
      // Also update the master conversation document for other participants
      const masterConversationRef = doc(collection(schoolRef, "conversations"), conversationId);
      await updateDoc(masterConversationRef, {
        messages: updatedMessages
      });
      
    } catch (err) {
      console.error("Error marking messages as read:", err);
    }
  }, [user]);

  // Search messages
  const searchMessages = useCallback(async (filter: MessageFilter): Promise<Conversation[]> => {
    if (!user) return [];
    
    try {
      let filteredConversations = [...conversations];
      
      // Apply filters
      if (filter.sender) {
        filteredConversations = filteredConversations.filter(conv => 
          conv.participants.includes(filter.sender || '')
        );
      }
      
      if (filter.keyword) {
        const keyword = filter.keyword.toLowerCase();
        filteredConversations = filteredConversations.map(conv => {
          return {
            ...conv,
            messages: conv.messages.filter(msg => 
              msg.content.toLowerCase().includes(keyword)
            )
          };
        }).filter(conv => conv.messages.length > 0);
      }
      
      if (filter.dateFrom || filter.dateTo) {
        filteredConversations = filteredConversations.map(conv => {
          return {
            ...conv,
            messages: conv.messages && Array.isArray(conv.messages) ? 
              conv.messages.filter(msg => {
                // Convert timestamp to Date
                let msgDate: Date;
                if (msg.timestamp && typeof msg.timestamp === 'object' && 'toDate' in msg.timestamp) {
                  msgDate = msg.timestamp.toDate();
                } else {
                  msgDate = new Date(msg.timestamp);
                }

                const fromDate = filter.dateFrom ? new Date(filter.dateFrom) : null;
                const toDate = filter.dateTo ? new Date(filter.dateTo) : null;
                
                if (fromDate && toDate) {
                  return msgDate >= fromDate && msgDate <= toDate;
                } else if (fromDate) {
                  return msgDate >= fromDate;
                } else if (toDate) {
                  return msgDate <= toDate;
                }
                return true;
              }) : []
          };
        }).filter(conv => conv.messages.length > 0);
      }
      
      if (filter.unreadOnly) {
        filteredConversations = filteredConversations.filter(conv => {
          if (!conv.unreadCount) return false;
          
          if (typeof conv.unreadCount === 'object') {
            return (conv.unreadCount[user.userId] || 0) > 0;
          }
          
          return typeof conv.unreadCount === 'number' ? conv.unreadCount > 0 : false;
        });
      }
      
      return filteredConversations;
    } catch (err) {
      console.error("Error searching messages:", err);
      return [];
    }
  }, [conversations, user]);

  // Fetch users by role
  const fetchUsersByRole = useCallback(async (role: string): Promise<User[]> => {
    if (!user) return [];
    
    try {
      const schoolRef = doc(db, "schools", user.schoolId);
      const usersRef = collection(schoolRef, "users");
      const q = query(usersRef, where("role", "==", role));
      
      const usersSnap = await getDocs(q);
      return usersSnap.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as User));
    } catch (err) {
      console.error("Error fetching users:", err);
      return [];
    }
  }, [user]);

  // Fetch classes
  const fetchClasses = useCallback(async (): Promise<HomeroomClass[]> => {
    if (!user) return [];
    
    try {
      const schoolRef = doc(db, "schools", user.schoolId);
      const classesRef = collection(schoolRef, "classes");
      
      const classesSnap = await getDocs(classesRef);
      return classesSnap.docs.map(doc => ({
        ...doc.data(),
        classId: doc.id
      } as HomeroomClass));
    } catch (err) {
      console.error("Error fetching classes:", err);
      return [];
    }
  }, [user]);

  // Check if user can message another user
  const canMessageUser = useCallback(async (userId: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      // Logic based on roles
      switch (user.role) {
        case "admin":
          return true; // Admins can message anyone
        case "teacher":
          // Teachers can message anyone except other students
          return userId !== user.userId;
        case "student":
          // Students can only message teachers and admins
          const schoolRef = doc(db, "schools", user.schoolId);
          const userRef = doc(schoolRef, "users", userId);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const targetRole = userSnap.data().role;
            return targetRole === "teacher" || targetRole === "admin";
          }
          return false;
        case "parent":
          // Parents can only message teachers and admins
          const parentSchoolRef = doc(db, "schools", user.schoolId);
          const targetUserRef = doc(parentSchoolRef, "users", userId);
          const targetUserSnap = await getDoc(targetUserRef);
          
          if (targetUserSnap.exists()) {
            const targetRole = targetUserSnap.data().role;
            return targetRole === "teacher" || targetRole === "admin";
          }
          return false;
        default:
          return false;
      }
    } catch (err) {
      console.error("Error checking user messaging permissions:", err);
      return false;
    }
  }, [user]);

  // Delete a message (admin/moderator only or own messages)
  const deleteMessage = useCallback(async (
    conversationId: string, 
    messageId: string
  ): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const schoolRef = doc(db, "schools", user.schoolId);
      const conversationRef = doc(collection(schoolRef, "conversations"), conversationId);
      const conversationSnap = await getDoc(conversationRef);
      
      if (!conversationSnap.exists()) return false;
      
      const conversationData = conversationSnap.data() as Conversation;
      const message = conversationData.messages.find(msg => msg.messageId === messageId);
      
      // Check permissions
      if (!message) return false;
      const canDelete = message.senderId === user.userId || 
                        user.role === "admin" || 
                        permissions.canModerateMessages;
                        
      if (!canDelete) {
        toast({
          title: "Permission Denied",
          description: "You don't have permission to delete this message",
          variant: "destructive"
        });
        return false;
      }
      
      // Replace with system message
      const updatedMessages = conversationData.messages.map(msg => {
        if (msg.messageId === messageId) {
          return {
            ...msg,
            content: "This message was deleted",
            isSystemMessage: true
          };
        }
        return msg;
      });
      
      // Update conversation
      await updateDoc(conversationRef, {
        messages: updatedMessages
      });
      
      // Update for all participants
      for (const participantId of conversationData.participants) {
        const participantRef = doc(schoolRef, "users", participantId);
        const userConvRef = doc(collection(participantRef, "conversations"), conversationId);
        
        await updateDoc(userConvRef, {
          messages: updatedMessages
        });
      }
      
      return true;
    } catch (err) {
      console.error("Error deleting message:", err);
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive"
      });
      return false;
    }
  }, [user, permissions, toast]);

  // Send announcement (admin only)
  const sendAnnouncement = useCallback(async (
    content: string,
    recipientRoles: string[]
  ): Promise<boolean> => {
    if (!user || user.role !== "admin" || !content.trim()) return false;
    
    try {
      const schoolRef = doc(db, "schools", user.schoolId);
      
      // Find all users with the specified roles
      const userPromises = recipientRoles.map(async role => {
        const usersRef = collection(schoolRef, "users");
        const q = query(usersRef, where("role", "==", role));
        const usersSnap = await getDocs(q);
        return usersSnap.docs.map(doc => doc.id);
      });
      
      const recipientsByRole = await Promise.all(userPromises);
      const recipients = recipientsByRole.flat();
      
      if (recipients.length === 0) {
        toast({
          title: "Warning",
          description: "No recipients found for the selected roles",
        });
        return false;
      }
      
      // Create announcement conversation
      const announcementId = await createConversation(
        recipients,
        true,
        `Уведомление: ${new Date().toLocaleDateString()}`,
        "announcement"
      );
      
      if (!announcementId) return false;
      
      // Send the message
      return await sendMessage(announcementId, content);
      
    } catch (err) {
      console.error("Error sending announcement:", err);
      toast({
        title: "Error",
        description: "Failed to send announcement",
        variant: "destructive"
      });
      return false;
    }
  }, [user, createConversation, sendMessage, toast]);

  // Send message to class (teachers only)
  const sendClassMessage = useCallback(async (
    classId: string,
    content: string
  ): Promise<boolean> => {
    if (!user || (user.role !== "teacher" && user.role !== "admin") || !content.trim()) return false;
    
    try {
      const schoolRef = doc(db, "schools", user.schoolId);
      const classRef = doc(schoolRef, "classes", classId);
      const classSnap = await getDoc(classRef);
      
      if (!classSnap.exists()) {
        toast({
          title: "Error",
          description: "Class not found",
          variant: "destructive"
        });
        return false;
      }
      
      const classData = classSnap.data() as HomeroomClass;
      
      // Create class conversation if it doesn't exist
      const conversationsRef = collection(schoolRef, "conversations");
      const q = query(
        conversationsRef,
        where("type", "==", "class"),
        where("classId", "==", classId)
      );
      
      const existingConversations = await getDocs(q);
      let classConversationId: string;
      
      if (existingConversations.empty) {
        // Create new class conversation
        const participants = [...classData.studentIds, classData.classTeacherId, user.userId];
        // Remove duplicates
        const uniqueParticipants = [...new Set(participants)];
        
        classConversationId = await createConversation(
          uniqueParticipants,
          true,
          `Class ${classData.className}`,
          "class"
        ) || '';
      } else {
        classConversationId = existingConversations.docs[0].id;
      }
      
      if (!classConversationId) return false;
      
      // Send the message
      return await sendMessage(classConversationId, content);
      
    } catch (err) {
      console.error("Error sending class message:", err);
      toast({
        title: "Error",
        description: "Failed to send message to class",
        variant: "destructive"
      });
      return false;
    }
  }, [user, createConversation, sendMessage, toast]);

  return (
    <MessagingContext.Provider value={{ 
      conversations, 
      unreadCount,
      loading, 
      error, 
      currentConversation,
      permissions,
      sendMessage,
      createConversation,
      markAsRead,
      setCurrentConversation,
      searchMessages,
      fetchUsersByRole,
      fetchClasses,
      canMessageUser,
      deleteMessage,
      sendAnnouncement,
      sendClassMessage
    }}>
      {children}
    </MessagingContext.Provider>
  );
};
