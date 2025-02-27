"use client";

import { useState } from 'react';
import { useMessaging } from '@/contexts/MessagingContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { MessageFilter, Conversation } from '@/lib/interfaces';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Timestamp } from 'firebase/firestore';

interface SearchMessagesProps {
  onFilterChangeAction: (filter: MessageFilter) => void;
  onConversationSelectAction: (conversationId: string) => void;
}

export const SearchMessages = ({ 
  onFilterChangeAction, 
  onConversationSelectAction 
}: SearchMessagesProps) => {
  const { searchMessages } = useMessaging();
  const [keyword, setKeyword] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Conversation[]>([]);

  const handleSearch = async () => {
    const filter: MessageFilter = {
      keyword: keyword || undefined,
      unreadOnly: unreadOnly || undefined,
      dateFrom: dateFrom ? format(dateFrom, 'yyyy-MM-dd') : undefined,
      dateTo: dateTo ? format(dateTo, 'yyyy-MM-dd') : undefined,
    };
    
    setSearching(true);
    try {
      const results = await searchMessages(filter);
      setSearchResults(results);
      onFilterChangeAction(filter);
    } finally {
      setSearching(false);
    }
  };

  const handleReset = () => {
    setKeyword('');
    setUnreadOnly(false);
    setDateFrom(undefined);
    setDateTo(undefined);
    setSearchResults([]);
    onFilterChangeAction({});
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="keyword">Търси текст</Label>
          <Input
            id="keyword"
            placeholder="Търсене на ключови думи..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
        
        <div className="space-y-2">
          <Label>От дата</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left"
              >
                {dateFrom ? (
                  format(dateFrom, 'PPP')
                ) : (
                  <span className="text-gray-500">Изберете дата</span>
                )}
                <CalendarIcon className="ml-auto h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={setDateFrom}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        
        <div className="space-y-2">
          <Label>До дата</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left"
              >
                {dateTo ? (
                  format(dateTo, 'PPP')
                ) : (
                  <span className="text-gray-500">Изберете дата</span>
                )}
                <CalendarIcon className="ml-auto h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={setDateTo}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        
        <div className="flex items-end space-x-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="unreadOnly"
              checked={unreadOnly}
              onCheckedChange={() => setUnreadOnly(!unreadOnly)}
            />
            <Label htmlFor="unreadOnly">Само непрочетени</Label>
          </div>
        </div>
      </div>
      
      <div className="flex space-x-2">
        <Button onClick={handleSearch} disabled={searching}>
          {searching ? 'Търсене...' : 'Търси съобщения'}
        </Button>
        <Button variant="outline" onClick={handleReset}>
          Изчисти филтри
        </Button>
      </div>
      
      <div className="border rounded-lg p-4 bg-white">
        <h3 className="font-medium text-lg mb-4">Резултати от търсенето</h3>
        
        {searchResults.length === 0 ? (
          <div className="text-center p-4 text-gray-500">
            Няма намерени резултати. Опитайте да промените филтрите за търсене.
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {searchResults.map(conversation => (
                <div 
                  key={conversation.conversationId}
                  className="border p-3 rounded-md hover:bg-gray-50 cursor-pointer"
                  onClick={() => onConversationSelectAction(conversation.conversationId)}
                >
                  <div className="font-medium">
                    {conversation.isGroup && conversation.groupName
                      ? conversation.groupName
                      : `Разговор с ${conversation.participants.length} участника`}
                  </div>
                  
                  <div className="mt-2 space-y-2">
                    {conversation.messages.map(message => {
                      const formatMessageTimestamp = (timestamp: string | Timestamp) => {
                        try {
                          // Handle Firestore Timestamp
                          if (timestamp instanceof Timestamp) {
                            return timestamp.toDate().toLocaleDateString();
                          }
                          
                          // Handle ISO string or any other date format
                          const date = new Date(timestamp);
                          return isNaN(date.getTime()) 
                            ? String(timestamp)
                            : date.toLocaleDateString();
                        } catch (err) {
                          console.error('Error formatting timestamp:', err);
                          return String(timestamp);
                        }
                      };

                      return (
                        <div 
                          key={message.messageId} 
                          className="bg-gray-100 p-2 rounded"
                        >
                          <div className="text-sm">{message.content}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {formatMessageTimestamp(message.timestamp)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
};