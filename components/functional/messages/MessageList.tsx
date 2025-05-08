/**
 * Компонент за показване на съобщения в разговор
 *
 * Съдържа два основни компонента:
 * 1. Message - Компонент за единично съобщение:
 *    - Показва съдържанието на съобщението
 *    - Информация за подателя
 *    - Статус на съобщението (изпратено/доставено/прочетено)
 *    - Възможност за отговор и изтриване
 *    - Показва цитирано съобщение, ако е отговор
 *
 * 2. MessageList - Основен компонент за списък със съобщения:
 *    - Показва всички съобщения в разговора
 *    - Автоматично превъртане до най-новото съобщение
 *    - Форма за изпращане на нови съобщения
 *    - Поддържа отговори на конкретни съобщения
 *    - Кеширане на информация за потребителите
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { formatRelative } from "date-fns";
import { useUser } from "@/contexts/UserContext";
import { useMessaging } from "@/contexts/MessagingContext";
import { Conversation, Message as MessageType, User } from "@/lib/interfaces";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, CornerDownLeft } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface MessageListProps {
  conversation: Conversation;
}

interface MessageProps {
  message: MessageType;
  isOwnMessage: boolean;
  senderName: string;
  onReplyAction: () => void;
  onDeleteAction: () => void;
  replyToMessage?: MessageType;
  getReplyingUserNameAction: (userId: string) => string;
}

export const Message = ({
  message,
  isOwnMessage,
  senderName,
  onReplyAction,
  onDeleteAction,
  replyToMessage,
  getReplyingUserNameAction,
}: MessageProps) => {
  const formatMessageTimestamp = (timestamp: string | Timestamp) => {
    try {
      // Handle Firestore Timestamp
      if (timestamp && typeof timestamp === "object" && "toDate" in timestamp) {
        return formatRelative(timestamp.toDate(), new Date());
      }

      // Handle ISO string or any other date format
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return String(timestamp);
      return formatRelative(date, new Date());
    } catch (err) {
      console.error("Error formatting timestamp:", err);
      return String(timestamp);
    }
  };

  // Check if the message is a system message (like a deleted message)
  const isSystemMessage = message.isSystemMessage;

  return (
    <div
      className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} mb-3`}
    >
      <div
        className={`max-w-[75%] rounded-2xl p-3 shadow-sm ${
          isSystemMessage
            ? "bg-gray-200 text-gray-600 italic"
            : isOwnMessage
            ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white"
            : "bg-gray-100 text-gray-900 border border-gray-200"
        }`}
      >
        {!isOwnMessage && !isSystemMessage && (
          <div className="font-medium text-sm mb-1">{senderName}</div>
        )}

        {replyToMessage && !isSystemMessage && (
          <div
            className={`text-xs p-2 mb-2 rounded-lg ${
              isOwnMessage ? "bg-blue-700/50" : "bg-gray-200"
            }`}
          >
            <div className="font-medium">
              {replyToMessage.senderId === message.senderId
                ? "Вие написахте:"
                : `${getReplyingUserNameAction(
                    replyToMessage.senderId
                  )} написа:`}
            </div>
            <div className="truncate">{replyToMessage.content}</div>
          </div>
        )}

        <div className="whitespace-pre-wrap break-words">{message.content}</div>

        {!isSystemMessage && (
          <div className="flex flex-col mt-1 text-xs">
            <span
              className={`${isOwnMessage ? "text-white/70" : "text-gray-500"}`}
            >
              {formatMessageTimestamp(message.timestamp)}
            </span>

            <div className="flex justify-between items-center mt-1">
              <span
                className={`${
                  isOwnMessage ? "text-white/70" : "text-gray-500"
                }`}
              >
                {message.status === "read"
                  ? "Прочетено"
                  : message.status === "delivered"
                  ? "Доставено"
                  : "Изпратено"}
              </span>

              <div className="flex space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onReplyAction}
                  className={`p-1 h-auto rounded-full hover:bg-opacity-10 ${
                    isOwnMessage
                      ? "text-white hover:bg-black"
                      : "text-gray-700 hover:bg-white"
                  }`}
                >
                  <CornerDownLeft size={14} />
                </Button>

                {(isOwnMessage || message.senderId === "admin") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDeleteAction}
                    className={`p-1 h-auto rounded-full hover:bg-opacity-10 ${
                      isOwnMessage
                        ? "text-white hover:bg-white hover:text-red-500"
                        : "text-gray-700 hover:bg-gray-800"
                    }`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18"></path>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const MessageList = ({ conversation }: MessageListProps) => {
  const { user } = useUser();
  const {
    sendMessage,
    deleteMessage,
    fetchUsersByRole,
    setCurrentConversation,
  } = useMessaging();
  const [newMessage, setNewMessage] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userCache, setUserCache] = useState<Record<string, User>>({});
  const { toast } = useToast();

  // Load users data for displaying names
  useEffect(() => {
    const loadUsers = async () => {
      if (!user || !conversation) return;

      try {
        const userIds = new Set<string>();
        conversation.participants.forEach((participantId) => {
          if (participantId !== user.userId) {
            userIds.add(participantId);
          }
        });

        if (conversation.messages) {
          conversation.messages.forEach((message) => {
            if (message.senderId !== user.userId) {
              userIds.add(message.senderId);
            }
          });
        }

        if (
          userIds.size === 0 ||
          Array.from(userIds).every((id) => userCache[id])
        ) {
          return;
        }

        const teachers = await fetchUsersByRole("teacher");
        const students = await fetchUsersByRole("student");
        const admins = await fetchUsersByRole("admin");
        const allUsers = [...teachers, ...students, ...admins];

        const newCache = { ...userCache };
        allUsers.forEach((user) => {
          newCache[user.id] = user;
        });

        setUserCache(newCache);
      } finally {
      }
    };

    loadUsers();
  }, [user, conversation, fetchUsersByRole, userCache]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.messages]);

  if (!user) return null;

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      const success = await sendMessage(
        conversation.conversationId,
        newMessage,
        replyTo || undefined
      );
      if (success) {
        setNewMessage("");
        setReplyTo(null);
      } else {
        toast({
          title: "Грешка",
          description: "Съобщението не беше изпратено. Моля, опитайте отново.",
          variant: "destructive",
        });
      }
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReply = (messageId: string) => {
    setReplyTo(messageId);
    // Focus the textarea after setting replyTo
    const textarea = document.querySelector("textarea");
    if (textarea) {
      textarea.focus();
    }
  };

  const handleDelete = async (messageId: string) => {
    if (deleting) return;

    setDeleting(true);
    try {
      const success = await deleteMessage(
        conversation.conversationId,
        messageId
      );
      if (success) {
        // Force re-render with the updated conversation
        setCurrentConversation(conversation.conversationId);

        toast({
          title: "Успешно",
          description: "Съобщението беше изтрито",
        });
      } else {
        toast({
          title: "Грешка",
          description: "Съобщението не беше изтрито. Проверете правата си.",
          variant: "destructive",
        });
      }
    } finally {
      setDeleting(false);
    }
  };

  const getReplyToMessage = (replyToId: string) => {
    return conversation.messages.find((m) => m.messageId === replyToId);
  };

  const getUserName = (userId: string): string => {
    if (userId === user.userId) {
      return `${user.firstName} ${user.lastName}`;
    }

    const cachedUser = userCache[userId];
    if (cachedUser) {
      return `${cachedUser.firstName} ${cachedUser.lastName}`;
    }

    return userId;
  };

  const getConversationTitle = () => {
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

  // Get participant avatars for the header
  const getParticipantAvatars = () => {
    if (!conversation.isGroup) {
      const otherParticipantId = conversation.participants.find(
        (id) => id !== user.userId
      );
      if (!otherParticipantId) return null;

      const name = getUserName(otherParticipantId);
      const initials = name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase();

      return (
        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-medium text-sm">
          {initials}
        </div>
      );
    } else {
      // For group conversations, show up to 3 participant avatars
      const otherParticipants = conversation.participants
        .filter((id) => id !== user.userId)
        .slice(0, 3);

      return (
        <div className="flex -space-x-2">
          {otherParticipants.map((id) => {
            const name = getUserName(id);
            const initials = name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase();

            return (
              <div
                key={id}
                className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-medium text-xs border-2 border-white"
              >
                {initials}
              </div>
            );
          })}

          {conversation.participants.length > 4 && (
            <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs border-2 border-white">
              +{conversation.participants.length - 4}
            </div>
          )}
        </div>
      );
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-lg shadow-sm border">
      <div className="flex-none p-4 border-b flex items-center space-x-3">
        {conversation.isGroup ? (
          <Dialog>
            <DialogTrigger asChild>
              <div className="cursor-pointer">{getParticipantAvatars()}</div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-center text-xl">
                  {conversation.groupName &&
                  !conversation.groupName.includes("Group Conversation")
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
                        <div className="font-medium">{getUserName(id)}</div>
                        {id === user.userId && (
                          <div className="text-xs text-blue-600">Вие</div>
                        )}
                        {(() => {
                          const participantUser = userCache[id];
                          if (!participantUser) return null;

                          return (
                            <div className="text-xs text-gray-500">
                              {participantUser.role && (
                                <div className="capitalize">
                                  Роля: {participantUser.role}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          <Dialog>
            <DialogTrigger asChild>
              <div className="cursor-pointer">{getParticipantAvatars()}</div>
            </DialogTrigger>
            <DialogContent className="w-64 p-3">
              <DialogHeader>
                <DialogTitle className="text-center text-md mb-2">
                  Информация за потребителя
                </DialogTitle>
              </DialogHeader>
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
                        <span className="font-medium">{getUserName(id)}</span>
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

        <div className="flex-1">
          <h3 className="font-semibold text-lg">{getConversationTitle()}</h3>
          <p className="text-sm text-gray-500">
            {conversation.isGroup
              ? `${conversation.participants.length} участници`
              : "Лично съобщение"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {conversation.type === "class" && (
            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
              Клас
            </span>
          )}
          {conversation.type === "announcement" && (
            <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full">
              Обявление
            </span>
          )}
        </div>
      </div>

      <ScrollArea className="flex-grow p-4">
        <div className="space-y-1">
          {conversation.messages && conversation.messages.length > 0 ? (
            conversation.messages.map((message) => (
              <Message
                key={message.messageId}
                message={message}
                isOwnMessage={message.senderId === user.userId}
                senderName={getUserName(message.senderId)}
                onReplyAction={() => handleReply(message.messageId)}
                onDeleteAction={() => handleDelete(message.messageId)}
                replyToMessage={
                  message.replyTo
                    ? getReplyToMessage(message.replyTo)
                    : undefined
                }
                getReplyingUserNameAction={getUserName}
              />
            ))
          ) : (
            <div className="text-center text-gray-500 py-12">
              <div className="mb-2">📩</div>
              Няма съобщения в този разговор
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="flex-none p-4 border-t bg-gray-50">
        {replyTo && (
          <div className="bg-blue-50 p-2 mb-2 rounded-md flex justify-between items-center border-l-4 border-blue-400">
            <div className="text-sm text-gray-700">
              <span className="font-medium text-blue-600">Отговор на: </span>
              {getReplyToMessage(replyTo)?.content.slice(0, 50)}
              {(getReplyToMessage(replyTo)?.content.length || 0) > 50
                ? "..."
                : ""}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReplyTo(null)}
              className="h-6 text-gray-500"
            >
              ✕
            </Button>
          </div>
        )}

        <div className="flex items-end gap-2 relative">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Напишете съобщение..."
            className="resize-none min-h-[80px] pr-16 rounded-2xl border-gray-200 focus:border-blue-400"
          />
          <Button
            onClick={handleSend}
            disabled={sending || !newMessage.trim()}
            className="absolute bottom-2 right-2 rounded-full w-10 h-10 p-0 text-white"
          >
            <Send size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
};
