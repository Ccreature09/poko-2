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

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useUser } from '@/contexts/UserContext';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Conversation, User } from '@/lib/interfaces';
import { Timestamp } from 'firebase/firestore';
import { useMessaging } from '@/contexts/MessagingContext';

interface ConversationListProps {
  conversations: Conversation[];
  onSelectAction: (conversationId: string) => void;
}

export const ConversationList = ({ conversations, onSelectAction }: ConversationListProps) => {
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
        conversations.forEach(conversation => {
          conversation.participants.forEach(participantId => {
            if (participantId !== user.userId) {
              userIds.add(participantId);
            }
          });
        });
        
        // Skip if no users to fetch or all users are already cached
        if (userIds.size === 0 || 
            Array.from(userIds).every(id => userCache[id])) {
          return;
        }
        
        // Fetch users by all possible roles to ensure we get everyone
        const teachers = await fetchUsersByRole('teacher');
        const students = await fetchUsersByRole('student');
        const admins = await fetchUsersByRole('admin');
        const allUsers = [...teachers, ...students, ...admins];
        
        // Update cache
        const newCache = { ...userCache };
        allUsers.forEach(user => {
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
    if (!timestamp) return '';
    
    try {
      // Handle Firestore Timestamp
      if (timestamp instanceof Timestamp) {
        return formatDistanceToNow(timestamp.toDate(), { addSuffix: true });
      }
      
      // Handle ISO string or any other date format
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '';
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (err) {
      console.error('Error formatting timestamp:', err);
      return '';
    }
  };

  // Sort conversations by date (most recent first)
  const sortedConversations = [...conversations].sort((a, b) => {
    const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : new Date(a.createdAt).getTime();
    const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : new Date(b.createdAt).getTime();
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
    if (conversation.isGroup && conversation.groupName) {
      return conversation.groupName;
    }
    
    // For one-to-one conversations, show the other participant's name
    const otherParticipants = conversation.participants.filter(id => id !== user.userId);
    
    // Map participant IDs to names
    return otherParticipants.map(id => getUserName(id)).join(', ');
  };

  return (
    <div className="h-full">
      <h3 className="font-medium text-lg mb-4">Разговори</h3>
      {conversations.length === 0 ? (
        <div className="text-center p-4 text-gray-500">Все още няма разговори</div>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-2">
            {sortedConversations.map((conversation) => (
              <div
                key={conversation.conversationId}
                className={`p-3 rounded-md cursor-pointer transition-colors ${
                  selectedId === conversation.conversationId
                    ? 'bg-primary/10'
                    : 'hover:bg-gray-100'
                }`}
                onClick={() => handleSelect(conversation.conversationId)}
              >
                <div className="flex justify-between items-start">
                  <div className="font-medium">{getConversationTitle(conversation)}</div>
                  {conversation.unreadCount > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {conversation.unreadCount}
                    </Badge>
                  )}
                </div>
                
                <div className="text-sm text-gray-500 mt-1 truncate">
                  {conversation.lastMessage?.content || 'Няма съобщения'}
                </div>
                
                <div className="text-xs text-gray-400 mt-1">
                  {formatTimestamp(conversation.updatedAt)}
                </div>
                
                <div className="text-xs mt-1">
                  {conversation.type === 'announcement' && (
                    <Badge variant="outline" className="text-xs">Обявление</Badge>
                  )}
                  {conversation.type === 'class' && (
                    <Badge variant="outline" className="text-xs">Клас</Badge>
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