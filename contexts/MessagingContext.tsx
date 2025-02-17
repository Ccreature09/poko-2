"use client";

import type React from "react";
import { createContext, useContext, useState, useEffect } from "react";
import { collection, onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Conversation } from "@/lib/interfaces";
import { useAuth } from "@/components/AuthProvider";

type MessagingContextType = {
  conversations: Conversation[];
  loading: boolean;
  error: string | null;
};

const MessagingContext = createContext<MessagingContextType>({
  conversations: [],
  loading: true,
  error: null,
});

export const useMessagingContext = () => useContext(MessagingContext);

export const MessagingProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !user.userId || !user.schoolId) {
      setLoading(false);
      setError("User not authenticated");
      return;
    }

    const schoolRef = doc(db, "schools", user.schoolId);
    const userRef = doc(schoolRef, "users", user.userId);
    const inboxRef = collection(userRef, "inbox");

    const unsubscribe = onSnapshot(
      inboxRef,
      (querySnapshot) => {
        const conversationsList = querySnapshot.docs.map(
          (doc) =>
            ({
              ...doc.data(),
              conversationId: doc.id,
            } as Conversation)
        );
        setConversations(conversationsList);
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

  return (
    <MessagingContext.Provider value={{ conversations, loading, error }}>
      {children}
    </MessagingContext.Provider>
  );
};
