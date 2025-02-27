"use client";

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useUser } from '@/contexts/UserContext';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Conversation } from '@/lib/interfaces';
import { Timestamp } from 'firebase/firestore';
interface ConversationListProps {
  conversations: Conversation[];
  onSelectAction: (conversationId: string) => void;
}

export const ConversationList = ({ conversations, onSelectAction }: ConversationListProps) => {
  const { user } = useUser();
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  // Helper to display participant names
  const getConversationTitle = (conversation: Conversation) => {
    if (conversation.isGroup && conversation.groupName) {
      return conversation.groupName;
    }
    
    // For one-to-one conversations, show the other participant's name
    const otherParticipants = conversation.participants.filter(id => id !== user.userId);
    
    // This would need to fetch user details from context or props
    // For now, just show IDs, but you'd want to replace this with actual names
    return otherParticipants.join(', ');
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