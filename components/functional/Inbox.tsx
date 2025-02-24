"use client";
import { useEffect, useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import type { Conversation, User } from "@/lib/interfaces";
import Link from "next/link";

const Inbox = () => {
  const { user } = useUser();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const fetchConversations = async () => {
      if (!user) return;

      const q = query(
        collection(db, "conversations"),
        where("participants", "array-contains", user.userId)
      );
      const querySnapshot = await getDocs(q);
      setConversations(querySnapshot.docs.map((doc) => doc.data() as Conversation));
    };

    const fetchUsers = async () => {
      const usersSnapshot = await getDocs(collection(db, "users"));
      setUsers(usersSnapshot.docs.map((doc) => doc.data() as User));
    };

    fetchConversations();
    fetchUsers();
  }, [user]);

  const getUserDetails = (userId: string) => {
    return users.find((u) => u.userId === userId);
  };

  if (!user) return null;

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Входяща поща</h2>
      <div className="space-y-4">
        {conversations.map((conversation: Conversation) => (
          <Link
            key={conversation.conversationId}
            href={`/messages/${conversation.conversationId}`}
            className="block border p-4 rounded-lg hover:bg-gray-100"
          >
            <h3 className="font-semibold">
              {conversation.isGroup
                ? conversation.groupName
                : conversation.participants
                    .filter((p: string) => p !== user.userId)
                    .map((p: string) => {
                      const participant = getUserDetails(p);
                      return participant
                        ? `${participant.firstName} ${participant.lastName}`
                        : "Unknown User";
                    })
                    .join(", ")}
            </h3>
            <p className="text-gray-600 text-sm">
              {conversation.messages[
                conversation.messages.length - 1
              ]?.content.slice(0, 50)}
              ...
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Inbox;
