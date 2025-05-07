/**
 * Компонент за списък с разговори
 *
 * Този компонент показва списък с всички активни разговори на потребителя:
 * - Индивидуални разговори
 * - Групови разговори
 * - Обявления
 * - Съобщения до класове
 *
 * Функционалности:
 * - Показване на име/имена на участниците
 * - Индикатор за непрочетени съобщения
 * - Сортиране по време на последно съобщение
 * - Показване на последното съобщение
 * - Различни типове badge-ове за различните видове разговори
 */

"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { useUser } from "@/contexts/UserContext";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Conversation, User } from "@/lib/interfaces";
import { Timestamp } from "firebase/firestore";
import { useMessaging } from "@/contexts/MessagingContext";
import { UsersRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ConversationListProps {
  conversations: Conversation[];
  onSelectAction: (conversationId: string) => void;
}

export const ConversationList = ({
  conversations,
  onSelectAction,
}: ConversationListProps) => {
  const { user } = useUser();
  const { fetchUsersByRole } = useMessaging();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userCache, setUserCache] = useState<Record<string, User>>({});

  useEffect(() => {
    // Load users data for displaying names
    const loadUsers = async () => {
      if (!user) return;

      try {
        // Collect all unique user IDs from conversations
        const userIds = new Set<string>();
        conversations.forEach((conversation) => {
          conversation.participants.forEach((participantId) => {
            if (participantId !== user.userId) {
              userIds.add(participantId);
            }
          });
        });

        // Skip if no users to fetch or all users are already cached
        if (
          userIds.size === 0 ||
          Array.from(userIds).every((id) => userCache[id])
        ) {
          return;
        }

        // Fetch users by all possible roles to ensure we get everyone
        const teachers = await fetchUsersByRole("teacher");
        const students = await fetchUsersByRole("student");
        const admins = await fetchUsersByRole("admin");
        const allUsers = [...teachers, ...students, ...admins];

        // Update cache
        const newCache = { ...userCache };
        allUsers.forEach((user) => {
          newCache[user.id] = user;
        });

        setUserCache(newCache);
      } finally {
      }
    };

    loadUsers();
  }, [user, conversations, fetchUsersByRole, userCache]);

  if (!user) return null;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    onSelectAction(id);
  };

  const formatTimestamp = (timestamp: string | Timestamp | null) => {
    if (!timestamp) return "";

    try {
      // Handle Firestore Timestamp
      if (timestamp instanceof Timestamp) {
        return formatDistanceToNow(timestamp.toDate(), { addSuffix: true });
      }

      // Handle ISO string or any other date format
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return "";
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (err) {
      console.error("Error formatting timestamp:", err);
      return "";
    }
  };

  // Sort conversations by date (most recent first)
  const sortedConversations = [...conversations].sort((a, b) => {
    const dateA = a.updatedAt
      ? new Date(a.updatedAt).getTime()
      : new Date(a.createdAt).getTime();
    const dateB = b.updatedAt
      ? new Date(b.updatedAt).getTime()
      : new Date(b.createdAt).getTime();
    return dateB - dateA;
  });

  // Helper to get user name from ID
  const getUserName = (userId: string): string => {
    if (userId === user.userId) {
      return `${user.firstName} ${user.lastName}`;
    }

    const cachedUser = userCache[userId];
    if (cachedUser) {
      return `${cachedUser.firstName} ${cachedUser.lastName}`;
    }

    // Fallback to ID if user not found in cache
    return userId;
  };

  // Helper to display participant names
  const getConversationTitle = (conversation: Conversation) => {
    // For one-to-one conversations, show the other participant's name
    const otherParticipants = conversation.participants.filter(
      (id) => id !== user.userId
    );
    const participantNames = otherParticipants.map((id) => getUserName(id));

    if (conversation.isGroup) {
      // Use custom group name if available and it's not the default "Group Conversation"
      if (
        conversation.groupName &&
        !conversation.groupName.includes("Group Conversation") &&
        !conversation.groupName.includes("Групов разговор")
      ) {
        return conversation.groupName;
      }

      // For group chats, truncate after the second name (instead of third)
      if (participantNames.length <= 2) {
        return participantNames.join(", ");
      } else {
        return `${participantNames.slice(0, 2).join(", ")} +${
          participantNames.length - 2
        }`;
      }
    }

    // For one-to-one conversations, just return the other person's name
    return participantNames.join(", ");
  };

  const participantRoleLabel = (conversation: Conversation, id: string) => {
    const participantUser = userCache[id];
    if (!participantUser) return null;

    return (
      <div className="text-xs text-gray-500">
        {participantUser.role && (
          <div className="capitalize">Роля: {participantUser.role}</div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full">
      <h3 className="font-medium text-lg mb-4">Разговори</h3>
      {conversations.length === 0 ? (
        <div className="text-center p-4 text-gray-500">
          Все още няма разговори
        </div>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-2">
            {sortedConversations.map((conversation) => (
              <div
                key={conversation.conversationId}
                className={`p-3 rounded-md cursor-pointer transition-colors ${
                  selectedId === conversation.conversationId
                    ? "bg-primary/10"
                    : "hover:bg-gray-100"
                }`}
                onClick={() => handleSelect(conversation.conversationId)}
              >
                <div className="flex justify-between items-start">
                  <div className="font-medium flex items-center">
                    {conversation.isGroup ? (
                      <>
                        <Dialog>
                          <DialogTrigger asChild>
                            <button
                              className="mr-1 text-gray-400 hover:text-gray-600"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <UsersRound size={16} />
                            </button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle className="text-center text-xl">
                                {conversation.groupName &&
                                !conversation.groupName.includes(
                                  "Group Conversation"
                                )
                                  ? conversation.groupName
                                  : "Групов разговор"}
                              </DialogTitle>
                            </DialogHeader>
                            <div className="mt-4">
                              <h4 className="font-medium text-sm text-gray-500 mb-3">
                                Участници ({conversation.participants.length})
                              </h4>
                              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                                {conversation.participants.map((id) => (
                                  <div
                                    key={id}
                                    className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50"
                                  >
                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">
                                      {getUserName(id)
                                        .split(" ")
                                        .map((n) => n[0])
                                        .join("")
                                        .toUpperCase()}
                                    </div>
                                    <div>
                                      <div className="font-medium">
                                        {getUserName(id)}
                                      </div>
                                      {id === user.userId && (
                                        <div className="text-xs text-blue-600">
                                          Вие
                                        </div>
                                      )}
                                      {participantRoleLabel(conversation, id)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        {getConversationTitle(conversation)}
                      </>
                    ) : (
                      <Dialog>
                        <DialogTrigger asChild>
                          <div>{getConversationTitle(conversation)}</div>
                        </DialogTrigger>
                        <DialogContent className="w-64 p-3">
                          {conversation.participants
                            .filter((id) => id !== user.userId)
                            .map((id) => {
                              const participantUser = userCache[id];
                              if (!participantUser) return null;

                              return (
                                <div key={id} className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">
                                      {getUserName(id)
                                        .split(" ")
                                        .map((n) => n[0])
                                        .join("")
                                        .toUpperCase()}
                                    </div>
                                    <span className="font-medium">
                                      {getUserName(id)}
                                    </span>
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {participantUser.role && (
                                      <div className="capitalize">
                                        Роля: {participantUser.role}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                  {conversation.unreadCount &&
                    user?.userId &&
                    user.userId in conversation.unreadCount &&
                    conversation.unreadCount[user.userId] > 0 && (
                      <Badge variant="destructive" className="ml-2">
                        {conversation.unreadCount[user.userId]}
                      </Badge>
                    )}
                </div>

                <div className="text-sm text-gray-500 mt-1 truncate">
                  {conversation.lastMessage?.content || "Няма съобщения"}
                </div>

                <div className="text-xs text-gray-400 mt-1">
                  {formatTimestamp(conversation.updatedAt)}
                </div>

                <div className="text-xs mt-1">
                  {conversation.type === "announcement" && (
                    <Badge variant="outline" className="text-xs">
                      Обявление
                    </Badge>
                  )}
                  {conversation.type === "class" && (
                    <Badge variant="outline" className="text-xs">
                      Клас
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};
