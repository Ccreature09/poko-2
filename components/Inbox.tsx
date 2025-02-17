"use client";
import { useMessagingContext } from "@/contexts/MessagingContext";
import type { UserBase } from "@/lib/interfaces";
import Link from "next/link";

interface InboxProps {
  user: UserBase & { schoolId: string };
}

export default function Inbox({ user }: InboxProps) {
  const { conversations, loading, error } = useMessagingContext();

  if (loading) {
    return <div>Loading conversations...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Inbox</h2>
      <div className="space-y-4">
        {conversations.map((conversation) => (
          <Link
            key={conversation.conversationId}
            href={`/messages/${conversation.conversationId}`}
            className="block border p-4 rounded-lg hover:bg-gray-100"
          >
            <h3 className="font-semibold">
              {conversation.isGroup
                ? conversation.groupName
                : conversation.participants
                    .filter((p) => p.userId !== user.userId)
                    .map((p) => `${p.firstName} ${p.lastName}`)
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
}
