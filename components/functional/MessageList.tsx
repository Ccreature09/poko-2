"use client";

import { useState, useRef, useEffect } from 'react';
import { formatRelative } from 'date-fns';
import { useUser } from '@/contexts/UserContext';
import { useMessaging } from '@/contexts/MessagingContext';
import { Conversation, Message as MessageType } from '@/lib/interfaces';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, CornerDownLeft } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

interface MessageListProps {
  conversation: Conversation;
}

// Make Message component properly exportable
interface MessageProps {
  message: MessageType;
  isOwnMessage: boolean;
  senderName: string;
  // Rename to avoid Next.js serialization error
  onReplyAction: () => void;
  onDeleteAction: () => void;
  replyToMessage?: MessageType;
}

export const Message = ({ 
  message, 
  isOwnMessage, 
  senderName, 
  onReplyAction, 
  onDeleteAction,
  replyToMessage 
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
          ? 'bg-blue-600 text-white' // Changed from primary to blue-600 for better visibility
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
              {replyToMessage.senderId === message.senderId ? 'You wrote:' : `${senderName} wrote:`}
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
              {message.status === 'read' ? 'Read' : message.status}
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
                Delete
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
  const { sendMessage, deleteMessage } = useMessaging();
  const [newMessage, setNewMessage] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
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

  const getMessageSender = (senderId: string) => {
    // This would ideally fetch the user's name from a user context or props
    // For now we'll just indicate if it's the current user or someone else
    return senderId === user.userId ? 'You' : 'Other User';
  };

 

  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex-none pb-2 border-b">
        <h3 className="font-medium text-lg">
          {conversation.isGroup && conversation.groupName
            ? conversation.groupName
            : conversation.participants
                .filter(id => id !== user.userId)
                .map(id => id)
                .join(', ')}
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
                senderName={getMessageSender(message.senderId)}
                onReplyAction={() => handleReply(message.messageId)}
                onDeleteAction={() => handleDelete(message.messageId)}
                replyToMessage={message.replyTo ? getReplyToMessage(message.replyTo) : undefined}
              />
            ))
          ) : (
            <div className="text-center text-gray-500 py-8">No messages yet</div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      
      <div className="flex-none mt-2">
        {replyTo && (
          <div className="bg-gray-100 p-2 mb-2 rounded-md flex justify-between items-center">
            <div className="text-sm text-gray-600">
              <span className="font-medium">Replying to: </span>
              {getReplyToMessage(replyTo)?.content.slice(0, 50)}
              {(getReplyToMessage(replyTo)?.content.length || 0) > 50 ? '...' : ''}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setReplyTo(null)}>
              Cancel
            </Button>
          </div>
        )}
        
        <div className="flex items-end gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="resize-none min-h-[80px]"
          />
          <Button 
            onClick={handleSend} 
            disabled={sending || !newMessage.trim()}
            className="mb-1"
          >
            <Send size={18} className="mr-1" />
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};