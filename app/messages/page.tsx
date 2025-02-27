"use client";

import { useState, useEffect } from "react";
import { useMessaging } from "@/contexts/MessagingContext";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageFilter, Conversation } from "@/lib/interfaces";
import { ConversationList } from "@/components/functional/ConversationList";
import { MessageList } from "@/components/functional/MessageList";
import { SearchMessages } from "@/components/functional/SearchMessages";
import { ComposeMessage } from "@/components/functional/ComposeMessage";

export default function Messages() {
  const { user } = useUser();
  const { 
    conversations, 
    unreadCount, 
    loading, 
    currentConversation, 
    setCurrentConversation,
    permissions,
    searchMessages
  } = useMessaging();
  
  const [activeTab, setActiveTab] = useState("inbox");
  const [searchFilter, setSearchFilter] = useState<MessageFilter>({});
  const [searchResults, setSearchResults] = useState<Conversation[]>([]);
  const [showCompose, setShowCompose] = useState(false);
  const [searching, setSearching] = useState(false);

  // When filter changes, execute search
  useEffect(() => {
    const executeSearch = async () => {
      // Only search if there's at least one filter criteria
      if (Object.values(searchFilter).some(val => val !== undefined && val !== false && val !== "")) {
        setSearching(true);
        try {
          const results = await searchMessages(searchFilter);
          setSearchResults(results);
        } finally {
          setSearching(false);
        }
      }
    };

    executeSearch();
  }, [searchFilter, searchMessages]);

  // Handle filter changes from SearchMessages component
  const handleFilterChange = async (filter: MessageFilter) => {
    setSearchFilter(filter);
  };

  if (!user) {
    return <div className="p-8 text-center">Please log in to access messages</div>;
  }

  if (loading) {
    return <div className="p-8 text-center">Loading messages...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Messages</h1>
        <div className="flex items-center space-x-2">
          {unreadCount > 0 && (
            <Badge variant="destructive" className="mr-2">
              {unreadCount} unread
            </Badge>
          )}
          <Button onClick={() => setShowCompose(true)}>New Message</Button>
          {permissions.canSendAnnouncement && (
            <Button variant="outline" onClick={() => setShowCompose(true)}>
              New Announcement
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="inbox" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
          {permissions.canModerateMessages && (
            <TabsTrigger value="moderate">Moderate</TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value="inbox" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1 border rounded-lg p-4 bg-white">
              <ConversationList 
                conversations={conversations} 
                onSelectAction={(id) => {
                  setCurrentConversation(id);
                }} 
              />
            </div>
            <div className="md:col-span-2 border rounded-lg p-4 bg-white">
              {currentConversation ? (
                <>
                  <MessageList conversation={currentConversation} />
                </>
              ) : (
                <div className="text-center p-8 text-gray-500">
                  Select a conversation or start a new one
                </div>
              )}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="search">
          <SearchMessages 
            onFilterChangeAction={handleFilterChange}
            onConversationSelectAction={(id) => {
              setCurrentConversation(id);
              setActiveTab("inbox");
            }}
          />
          
          {searching ? (
            <div className="text-center py-4">
              <p className="text-gray-500">Searching messages...</p>
            </div>
          ) : searchResults.length > 0 ? (
            <div className="mt-6">
              <h3 className="font-medium text-lg mb-4">Search Results ({searchResults.length})</h3>
              <div className="border rounded-lg p-4 bg-white">
                <ConversationList 
                  conversations={searchResults} 
                  onSelectAction={(id) => {
                    setCurrentConversation(id);
                    setActiveTab("inbox");
                  }} 
                />
              </div>
            </div>
          ) : Object.values(searchFilter).some(val => val !== undefined && val !== false && val !== "") ? (
            <div className="mt-6 text-center py-4 border rounded-lg bg-white">
              <p className="text-gray-500">No messages match your search criteria</p>
            </div>
          ) : null}
        </TabsContent>
        
        {permissions.canModerateMessages && (
          <TabsContent value="moderate">
            <div className="border rounded-lg p-4 bg-white">
              <h3 className="font-medium text-lg mb-2">Message Moderation</h3>
              <p className="text-gray-500">
                As an administrator, you can review and moderate messages here.
              </p>
              {/* Additional moderation tools would go here */}
            </div>
          </TabsContent>
        )}
      </Tabs>
      
      {showCompose && (
        <ComposeMessage 
          onCloseAction={() => setShowCompose(false)}
          isAnnouncement={activeTab === "announcements"}
        />
      )}
    </div>
  );
}