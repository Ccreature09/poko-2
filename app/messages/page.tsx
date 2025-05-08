"use client";

/**
 * Messages Page Component
 *
 * Comprehensive messaging interface that allows users to:
 * - View and manage conversations organized by inbox
 * - Search through message history with advanced filtering
 * - Compose new messages to individuals or groups
 * - Send announcements (if user has appropriate permissions)
 *
 * Key features:
 * - Responsive design with mobile-optimized conversation view
 * - Real-time unread count indicators
 * - Tabbed interface for inbox and search functionality
 * - Context-aware conversation management
 *
 * Implementation uses MessagingContext for state management and
 * separate specialized components for different messaging functions.
 */

import { useState, useEffect } from "react";
import { useMessaging } from "@/contexts/MessagingContext";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageFilter, Conversation } from "@/lib/interfaces";
import { ConversationList } from "@/components/functional/messages/ConversationList";
import { MessageList } from "@/components/functional/messages/MessageList";
import { SearchMessages } from "@/components/functional/messages/SearchMessages";
import { ComposeMessage } from "@/components/functional/messages/ComposeMessage";
import { PenSquare, Bell } from "lucide-react";

export default function Messages() {
  const { user } = useUser();
  const {
    conversations,
    unreadCount,
    loading,
    currentConversation,
    setCurrentConversation,
    permissions,
    searchMessages,
  } = useMessaging();

  const [activeTab, setActiveTab] = useState("inbox");
  const [searchFilter, setSearchFilter] = useState<MessageFilter>({});
  const [searchResults, setSearchResults] = useState<Conversation[]>([]);
  const [showCompose, setShowCompose] = useState(false);
  const [searching, setSearching] = useState(false);
  const [showConversations, setShowConversations] = useState(true);

  // When filter changes, execute search
  useEffect(() => {
    const executeSearch = async () => {
      // Only search if there's at least one filter criteria
      if (
        Object.values(searchFilter).some(
          (val) => val !== undefined && val !== false && val !== ""
        )
      ) {
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

  // Hide conversation list when a conversation is selected on mobile
  useEffect(() => {
    if (currentConversation && window.innerWidth < 768) {
      setShowConversations(false);
    }
  }, [currentConversation]);

  const handleFilterChange = async (filter: MessageFilter) => {
    setSearchFilter(filter);
  };

  const handleSelectConversation = (id: string) => {
    setCurrentConversation(id);
    // On mobile, hide the conversation list when a conversation is selected
    if (window.innerWidth < 768) {
      setShowConversations(false);
    }
  };

  const handleBackToConversations = () => {
    setShowConversations(true);
  };

  if (!user) {
    return (
      <div className="p-4 sm:p-8 text-center">
        Моля, влезте в профила си за достъп до съобщенията
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-8 text-center">Зареждане на съобщения...</div>
    );
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-3 sm:py-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 sm:mb-4 gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">Съобщения</h1>
        <div className="flex items-center space-x-2">
          {unreadCount > 0 && (
            <Badge variant="destructive" className="mr-2 text-xs sm:text-sm">
              {unreadCount} непрочетени
            </Badge>
          )}
          <Button
            variant="outline"
            onClick={() => setShowCompose(true)}
            className="text-xs sm:text-sm h-8 sm:h-10"
          >
            <PenSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
            <span className="hidden xs:inline">Ново съобщение</span>
            <span className="xs:hidden">Съобщение</span>
          </Button>
          {permissions.canSendAnnouncement && (
            <Button
              variant="outline"
              onClick={() => setShowCompose(true)}
              className="text-xs sm:text-sm h-8 sm:h-10"
            >
              <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
              <span className="hidden xs:inline">Ново обявление</span>
              <span className="xs:hidden">Обявление</span>
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="inbox" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-3 sm:mb-4 h-8 sm:h-10 text-xs sm:text-sm">
          <TabsTrigger value="inbox">Входяща кутия</TabsTrigger>
          <TabsTrigger value="search">Търсене</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            {/* Conversation list - hidden on mobile when a conversation is selected */}
            {showConversations && (
              <div className="md:col-span-1 border rounded-lg p-3 sm:p-4 bg-white">
                <ConversationList
                  conversations={conversations}
                  onSelectAction={handleSelectConversation}
                />
              </div>
            )}

            {/* Message detail view */}
            {(!showConversations || window.innerWidth >= 768) && (
              <div
                className={`${
                  showConversations ? "md:col-span-2" : "col-span-1"
                } border rounded-lg p-3 sm:p-4 bg-white`}
              >
                {currentConversation ? (
                  <>
                    {/* Back button shown only on mobile */}
                    {!showConversations && (
                      <Button
                        variant="ghost"
                        onClick={handleBackToConversations}
                        className="mb-3 text-xs sm:text-sm h-8"
                      >
                        ← Назад към разговори
                      </Button>
                    )}
                    <MessageList conversation={currentConversation} />
                  </>
                ) : (
                  <div className="text-center p-4 sm:p-8 text-gray-500 text-sm">
                    Изберете разговор или започнете нов
                  </div>
                )}
              </div>
            )}
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
            <div className="text-center py-3 sm:py-4">
              <p className="text-gray-500 text-xs sm:text-sm">
                Търсене на съобщения...
              </p>
            </div>
          ) : searchResults.length > 0 ? (
            <div className="mt-4 sm:mt-6">
              <h3 className="font-medium text-base sm:text-lg mb-3 sm:mb-4">
                Резултати от търсенето ({searchResults.length})
              </h3>
              <div className="border rounded-lg p-3 sm:p-4 bg-white">
                <ConversationList
                  conversations={searchResults}
                  onSelectAction={(id) => {
                    setCurrentConversation(id);
                    setActiveTab("inbox");
                  }}
                />
              </div>
            </div>
          ) : Object.values(searchFilter).some(
              (val) => val !== undefined && val !== false && val !== ""
            ) ? (
            <div className="mt-4 sm:mt-6 text-center py-3 sm:py-4 border rounded-lg bg-white">
              <p className="text-gray-500 text-xs sm:text-sm">
                Няма съобщения, отговарящи на критериите за търсене
              </p>
            </div>
          ) : null}
        </TabsContent>
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
