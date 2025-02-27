"use client";

import { useState } from "react";
import { useMessaging } from "@/contexts/MessagingContext";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageFilter } from "@/lib/interfaces";
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
    permissions
  } = useMessaging();
  const [activeTab, setActiveTab] = useState("inbox");
  const [searchFilter, setSearchFilter] = useState<MessageFilter>({});
  const [showCompose, setShowCompose] = useState(false);

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
            onFilterChangeAction={setSearchFilter}
            onConversationSelectAction={(id) => {
              setCurrentConversation(id);
              setActiveTab("inbox");
            }}
          />
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