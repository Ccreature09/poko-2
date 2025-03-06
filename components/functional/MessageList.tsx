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

import { useState, useRef, useEffect } from 'react';
import { formatRelative } from 'date-fns';
import { useUser } from '@/contexts/UserContext';
import { useMessaging } from '@/contexts/MessagingContext';
import { Conversation, Message as MessageType, User } from '@/lib/interfaces';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, CornerDownLeft } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

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
  getReplyingUserNameAction
}: MessageProps) => {
  const formatMessageTimestamp = (timestamp: string | Timestamp) => {
    try {
      // Handle Firestore Timestamp
      if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
        return formatRelative(timestamp.toDate(), new Date());
      }
      
      // Handle ISO string or any other date format
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return String(timestamp);
      return formatRelative(date, new Date());
    } catch (err) {
      console.error('Error formatting timestamp:', err);
      return String(timestamp);
    }
  };

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] ${
        isOwnMessage 
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-900'
        } rounded-lg p-3`}
      >
        {!isOwnMessage && (
          <div className="font-medium text-sm mb-1">{senderName}</div>
        )}
        
        {replyToMessage && (
          <div className={`text-xs p-2 mb-2 rounded ${
            isOwnMessage ? 'bg-blue-700/50' : 'bg-gray-200'
          }`}>
            <div className="font-medium">
              {replyToMessage.senderId === message.senderId ? 'Вие написахте:' : `${getReplyingUserNameAction(replyToMessage.senderId)} написа:`}
            </div>
            <div className="truncate">{replyToMessage.content}</div>
          </div>
        )}
        
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
        
        <div className="flex justify-between items-center mt-1 text-xs">
          <span className={`${
            isOwnMessage ? 'text-white/70' : 'text-gray-500'
          }`}>
            {formatMessageTimestamp(message.timestamp)}
          </span>
          
          <div className="flex items-center gap-2">
            <span className={`${
              isOwnMessage ? 'text-white/70' : 'text-gray-500'
            }`}>
              {message.status === 'read' ? 'Прочетено' : message.status === 'delivered' ? 'Доставено' : 'Изпратено'}
            </span>
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onReplyAction} 
              className={`p-0 h-auto ${
                isOwnMessage ? 'text-white hover:text-white/80' : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              <CornerDownLeft size={14} />
            </Button>
            
            {isOwnMessage && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onDeleteAction}
                className={`p-0 h-auto ${
                  isOwnMessage ? 'text-white hover:text-white/80' : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                Изтрий
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const MessageList = ({ conversation }: MessageListProps) => {
  const { user } = useUser();
  const { sendMessage, deleteMessage, fetchUsersByRole } = useMessaging();
  const [newMessage, setNewMessage] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userCache, setUserCache] = useState<Record<string, User>>({});

  // Load users data for displaying names
  useEffect(() => {
    const loadUsers = async () => {
      if (!user || !conversation) return;
      
      try {
        const userIds = new Set<string>();
        conversation.participants.forEach(participantId => {
          if (participantId !== user.userId) {
            userIds.add(participantId);
          }
        });
        
        if (conversation.messages) {
          conversation.messages.forEach(message => {
            if (message.senderId !== user.userId) {
              userIds.add(message.senderId);
            }
          });
        }
        
        if (userIds.size === 0 || 
            Array.from(userIds).every(id => userCache[id])) {
          return;
        }
        
        const teachers = await fetchUsersByRole('teacher');
        const students = await fetchUsersByRole('student');
        const admins = await fetchUsersByRole('admin');
        const allUsers = [...teachers, ...students, ...admins];
        
        const newCache = { ...userCache };
        allUsers.forEach(user => {
          newCache[user.id] = user;
        });
        
        setUserCache(newCache);
      } finally {
      }
    };
    
    loadUsers();
  }, [user, conversation, fetchUsersByRole, userCache]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.messages]);

  if (!user) return null;

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    
    setSending(true);
    try {
      await sendMessage(conversation.conversationId, newMessage, replyTo || undefined);
      setNewMessage('');
      setReplyTo(null);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReply = (messageId: string) => {
    setReplyTo(messageId);
  };

  const handleDelete = async (messageId: string) => {
    await deleteMessage(conversation.conversationId, messageId);
  };

  const getReplyToMessage = (replyToId: string) => {
    return conversation.messages.find(m => m.messageId === replyToId);
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
    if (conversation.isGroup && conversation.groupName) {
      return conversation.groupName;
    }
    
    const otherParticipants = conversation.participants.filter(id => id !== user.userId);
    
    return otherParticipants.map(id => getUserName(id)).join(', ');
  };

  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex-none pb-2 border-b">
        <h3 className="font-medium text-lg">
          {getConversationTitle()}
        </h3>
        <p className="text-sm text-gray-500">
          {conversation.isGroup 
            ? `${conversation.participants.length} participants` 
            : 'Direct message'}
        </p>
      </div>
      
      <ScrollArea className="flex-grow my-4">
        <div className="space-y-4 p-2">
          {conversation.messages && conversation.messages.length > 0 ? (
            conversation.messages.map(message => (
              <Message
                key={message.messageId}
                message={message}
                isOwnMessage={message.senderId === user.userId}
                senderName={getUserName(message.senderId)}
                onReplyAction={() => handleReply(message.messageId)}
                onDeleteAction={() => handleDelete(message.messageId)}
                replyToMessage={message.replyTo ? getReplyToMessage(message.replyTo) : undefined}
                getReplyingUserNameAction={getUserName}
              />
            ))
          ) : (
            <div className="text-center text-gray-500 py-8">Няма съобщения в този разговор</div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      
      <div className="flex-none mt-2">
        {replyTo && (
          <div className="bg-gray-100 p-2 mb-2 rounded-md flex justify-between items-center">
            <div className="text-sm text-gray-600">
              <span className="font-medium">Отговор на: </span>
              {getReplyToMessage(replyTo)?.content.slice(0, 50)}
              {(getReplyToMessage(replyTo)?.content.length || 0) > 50 ? '...' : ''}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setReplyTo(null)}>
              Отказ
            </Button>
          </div>
        )}
        
        <div className="flex items-end gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Напишете съобщение..."
            className="resize-none min-h-[80px]"
          />
          <Button 
            onClick={handleSend} 
            disabled={sending || !newMessage.trim()}
            className="mb-1"
          >
            <Send size={18} className="mr-1" />
            Изпрати
          </Button>
        </div>
      </div>
    </div>
  );
};