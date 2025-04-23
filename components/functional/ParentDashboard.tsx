'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext';
import { getParentChildren, getChildGrades, getChildAssignments, getChildQuizResults, getChildCheatingAttempts } from '@/lib/parentManagement';
import { getConversations, getMessages, sendMessage } from '@/lib/messageManagement';
import { getSubjects } from '@/lib/subjectManagement';
import type { Student, Grade, Assignment, AssignmentSubmission, Quiz, QuizResult, CheatAttempt, Parent, Conversation, Message, Subject } from '@/lib/interfaces';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import Sidebar from './Sidebar';
import { 
  Users, 
  BookOpen, 
  GraduationCap, 
  Bell, 
  ClipboardList, 
  CheckCircle,
  Calendar,
  FileText,
  MessageSquare,
  Send,
  User,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

// Custom interface to align with what our components expect
interface SimpleMessageListProps {
  messages: Message[];
  currentUserId: string;
}

// Create a simple MessageList component that works with our data structure
const SimpleMessageList: React.FC<SimpleMessageListProps> = ({ messages, currentUserId }) => {
  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <div 
          key={message.messageId}
          className={`p-3 rounded-lg ${message.senderId === currentUserId ? 'bg-blue-100 ml-auto max-w-[80%]' : 'bg-gray-100 max-w-[80%]'}`}
        >
          <div className="text-sm">{message.content}</div>
          <div className="text-xs text-gray-500 mt-1">
            {message.timestamp instanceof Timestamp 
              ? format(message.timestamp.toDate(), 'Pp') 
              : typeof message.timestamp === 'string' 
                ? format(new Date(message.timestamp), 'Pp')
                : 'Unknown time'}
          </div>
        </div>
      ))}
      {messages.length === 0 && (
        <div className="text-center text-gray-500 py-4">No messages</div>
      )}
    </div>
  );
};

// Create a simple ConversationList component
interface SimpleConversationListProps {
  conversations: Conversation[];
  selectedConversationId?: string;
  onSelectAction: (conversationId: string) => void;
  currentUserId: string;
}

const SimpleConversationList: React.FC<SimpleConversationListProps> = ({ 
  conversations, 
  selectedConversationId,
  onSelectAction,
  currentUserId 
}) => {
  return (
    <div className="space-y-2 p-2">
      {conversations.map((conversation) => {
        // Find the other participant(s) in the conversation
        const otherParticipants = conversation.participants.filter(id => id !== currentUserId);
        const title = otherParticipants.join(', ');
        
        return (
          <div
            key={conversation.conversationId}
            className={`p-3 rounded-md cursor-pointer ${
              selectedConversationId === conversation.conversationId
                ? 'bg-blue-100'
                : 'hover:bg-gray-100'
            }`}
            onClick={() => onSelectAction(conversation.conversationId)}
          >
            <div className="font-medium">{title}</div>
            <div className="text-sm text-gray-500 truncate">
              {conversation.lastMessage?.content || 'No messages'}
            </div>
          </div>
        );
      })}
      {conversations.length === 0 && (
        <div className="text-center p-4 text-gray-500">No conversations yet</div>
      )}
    </div>
  );
};

// Simple compose message component
interface SimpleComposeMessageProps {
  onSendMessage: (content: string) => void;
}

const SimpleComposeMessage: React.FC<SimpleComposeMessageProps> = ({ onSendMessage }) => {
  const [message, setMessage] = useState('');
  
  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };
  
  return (
    <div className="flex gap-2 items-center">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message..."
        className="flex-1 p-2 border rounded"
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
      />
      <Button 
        onClick={handleSend}
        size="sm"
        disabled={!message.trim()}
      >
        <Send className="h-4 w-4 mr-1" />
        Send
      </Button>
    </div>
  );
};

const ParentDashboard: React.FC = () => {
  const { user, loading: userLoading, error: userError } = useUser();
  const parent = user as Parent | null;

  const [children, setChildren] = useState<Student[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [isLoadingChildren, setIsLoadingChildren] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectMap, setSubjectMap] = useState<Record<string, string>>({});
  const [assignmentsData, setAssignmentsData] = useState<{ assignments: Assignment[], submissions: Record<string, AssignmentSubmission> } | null>(null);
  const [quizData, setQuizData] = useState<{ quizzes: Quiz[], results: QuizResult[] } | null>(null);
  const [cheatingAttempts, setCheatingAttempts] = useState<Record<string, CheatAttempt[]>>({});

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messagingError, setMessagingError] = useState<string | null>(null);

  const [stats, setStats] = useState([
    { title: "My Children", value: 0, icon: Users },
    { title: "Assignments", value: 0, icon: FileText },
    { title: "Quizzes", value: 0, icon: ClipboardList },
    { title: "Messages", value: 0, icon: MessageSquare },
  ]);

  useEffect(() => {
    if (userLoading) return;
    if (parent && parent.role === 'parent') {
      setIsLoadingChildren(true);
      getParentChildren(parent.schoolId, parent.userId)
        .then(fetchedChildren => {
          setChildren(fetchedChildren);
          
          // Update the stats
          setStats(prev => [
            { ...prev[0], value: fetchedChildren.length },
            ...prev.slice(1)
          ]);
          
          if (fetchedChildren.length > 0) {
            setSelectedChildId(fetchedChildren[0].userId);
          } else {
            setError("No children linked to this account.");
          }
        })
        .catch(err => {
          console.error("Error fetching children:", err);
          setError("Failed to load children data.");
        })
        .finally(() => setIsLoadingChildren(false));
    } else if (!userLoading && !parent) {
      setError("Access Denied. You must be logged in as a parent.");
      setIsLoadingChildren(false);
    }
  }, [parent, userLoading]);

  useEffect(() => {
    if (userLoading || !parent) return;
    if (selectedChildId && parent) {
      setIsLoadingData(true);
      setError(null);
      setGrades([]);
      setAssignmentsData(null);
      setQuizData(null);
      setCheatingAttempts({});

      const schoolId = parent.schoolId;
      const childId = selectedChildId;

      Promise.allSettled([
        getChildGrades(schoolId, childId),
        getChildAssignments(schoolId, childId),
        getChildQuizResults(schoolId, childId)
      ]).then(([gradesResult, assignmentsResult, quizResult]) => {

        if (gradesResult.status === 'fulfilled') {
          setGrades(gradesResult.value);
        } else {
          console.error("Error fetching grades:", gradesResult.reason);
          setError(prev => prev ? prev + "\nFailed to load grades." : "Failed to load grades.");
        }

        if (assignmentsResult.status === 'fulfilled') {
          setAssignmentsData(assignmentsResult.value);
          
          // Update assignments stats
          setStats(prev => [
            prev[0],
            { ...prev[1], value: assignmentsResult.value.assignments.length },
            ...prev.slice(2)
          ]);
        } else {
          console.error("Error fetching assignments:", assignmentsResult.reason);
          setError(prev => prev ? prev + "\nFailed to load assignments." : "Failed to load assignments.");
        }

        if (quizResult.status === 'fulfilled') {
          setQuizData(quizResult.value);
          
          // Update quiz stats
          setStats(prev => [
            prev[0],
            prev[1],
            { ...prev[2], value: quizResult.value.quizzes.length },
            prev[3]
          ]);
          
          const attemptPromises = quizResult.value.results.map(result =>
            getChildCheatingAttempts(schoolId, result.quizId, childId)
              .then(attempts => ({ quizId: result.quizId, attempts }))
              .catch(err => {
                  console.error(`Error fetching cheating attempts for quiz ${result.quizId}:`, err);
                  return { quizId: result.quizId, attempts: [] };
              })
          );
          Promise.all(attemptPromises).then(attemptResults => {
            const attemptsMap: Record<string, CheatAttempt[]> = {};
            attemptResults.forEach(res => {
              attemptsMap[res.quizId] = res.attempts;
            });
            setCheatingAttempts(attemptsMap);
          });
        } else {
          console.error("Error fetching quizzes:", quizResult.reason);
          setError(prev => prev ? prev + "\nFailed to load quizzes." : "Failed to load quizzes.");
        }

      }).finally(() => setIsLoadingData(false));
    }
  }, [selectedChildId, parent, userLoading]);

  useEffect(() => {
    if (userLoading || !parent) return;
    if (parent && parent.role === 'parent') {
      setIsLoadingConversations(true);
      setMessagingError(null);
      getConversations(parent.schoolId, parent.userId)
        .then(fetchedConversations => {
          setConversations(fetchedConversations);
          
          // Update message stats
          const unreadCount = fetchedConversations.reduce((count, conv) => {
            if (conv.lastMessage && !conv.lastMessage.readBy.includes(parent.userId)) {
              return count + 1;
            }
            return count;
          }, 0);
          
          setStats(prev => [
            prev[0],
            prev[1],
            prev[2],
            { ...prev[3], value: unreadCount }
          ]);
        })
        .catch(err => {
          console.error("Error fetching conversations:", err);
          setMessagingError("Failed to load conversations.");
        })
        .finally(() => setIsLoadingConversations(false));
    }
  }, [parent, userLoading]);

  useEffect(() => {
    if (userLoading || !parent) return;
    if (selectedConversation && parent) {
      setIsLoadingMessages(true);
      setMessagingError(null);
      getMessages(parent.schoolId, selectedConversation.conversationId)
        .then(fetchedMessages => {
          setMessages(fetchedMessages);
        })
        .catch(err => {
          console.error("Error fetching messages:", err);
          setMessagingError("Failed to load messages for this conversation.");
        })
        .finally(() => setIsLoadingMessages(false));
    } else {
      setMessages([]);
    }
  }, [selectedConversation, parent, userLoading]);

  useEffect(() => {
    if (userLoading || !parent) return;
    if (parent && parent.role === 'parent' && parent.schoolId) {
      // Fetch subjects to map subject IDs to names
      getSubjects(parent.schoolId)
        .then(fetchedSubjects => {
          setSubjects(fetchedSubjects);
          // Create a mapping from subject IDs to subject names
          const mapping: Record<string, string> = {};
          fetchedSubjects.forEach(subject => {
            mapping[subject.subjectId] = subject.name;
          });
          setSubjectMap(mapping);
        })
        .catch(err => {
          console.error("Error fetching subjects:", err);
        });
    }
  }, [parent, userLoading]);

  const handleChildChange = (value: string) => {
    setSelectedChildId(value);
  };

  const handleSelectConversation = useCallback((conversationId: string) => {
    const convo = conversations.find(c => c.conversationId === conversationId);
    if (convo) setSelectedConversation(convo);
  }, [conversations]);

  const handleSendMessage = async (content: string) => {
    if (!parent || !selectedConversation) {
      toast({ title: "Error", description: "Cannot send message. User or conversation not selected.", variant: "destructive" });
      return;
    }

    const recipientId = selectedConversation.participants.find(pId => pId !== parent.userId);
    if (!recipientId) {
        toast({ title: "Error", description: "Cannot determine recipient for this conversation.", variant: "destructive" });
        return;
    }

    try {
      const optimisticTimestamp = Timestamp.fromDate(new Date());
      await sendMessage(parent.schoolId, parent, recipientId, content);
      const newMessage: Message = {
          messageId: `temp-${Date.now()}`,
          senderId: parent.userId,
          content,
          timestamp: optimisticTimestamp,
          readBy: [parent.userId],
          status: 'sending'
      };
      setMessages(prev => [...prev, newMessage]);
      setTimeout(() => {
          if (selectedConversation) {
              getMessages(parent.schoolId, selectedConversation.conversationId)
                  .then(setMessages)
                  .catch(err => console.error("Error refetching messages after send:", err));
          }
      }, 1500);
      getConversations(parent.schoolId, parent.userId).then(setConversations);

    } catch (error: any) {
      console.error("Error sending message:", error);
      toast({ title: "Send Failed", description: error.message || "Could not send message.", variant: "destructive" });
      setMessages(prev => prev.filter(m => m.status !== 'sending'));
    }
  };

  const selectedChild = children.find(c => c.userId === selectedChildId);

  if (userLoading || isLoadingChildren) {
    return (
      <div className="flex flex-col lg:flex-row h-screen">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <div className="flex-1 p-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-gray-800">Parent Dashboard</h1>
            <div className="flex justify-center items-center h-64">
              <p>Loading...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (userError) {
    return (
      <div className="flex flex-col lg:flex-row h-screen">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <div className="flex-1 p-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-gray-800">Parent Dashboard</h1>
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
              Error loading user data: {userError}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!parent || parent.role !== 'parent') {
    return (
      <div className="flex flex-col lg:flex-row h-screen">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <div className="flex-1 p-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-gray-800">Parent Dashboard</h1>
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
              Access Denied. You must be logged in as a parent.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (children.length === 0 && !error) {
    return (
      <div className="flex flex-col lg:flex-row h-screen">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <div className="flex-1 p-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-gray-800">Parent Dashboard</h1>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium">No Children Found</h3>
                  <p className="text-gray-500 mt-2">
                    No children are currently linked to your account. Please contact the school administration.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="flex-1 p-8 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-gray-800">Parent Dashboard</h1>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-6">
              {error.split('\n').map((line, i) => <p key={i}>{line}</p>)}
            </div>
          )}

          {/* Child Selector */}
          {children.length > 0 && (
            <div className="flex items-center space-x-4 mb-6">
              <label htmlFor="child-select" className="font-medium flex items-center">
                <User className="h-5 w-5 text-blue-500 mr-2" />
                Viewing data for:
              </label>
              <Select onValueChange={handleChildChange} value={selectedChildId ?? ''}>
                <SelectTrigger id="child-select" className="w-[250px]">
                  <SelectValue placeholder="Select Child" />
                </SelectTrigger>
                <SelectContent>
                  {children.map(child => (
                    <SelectItem key={child.userId} value={child.userId}>
                      {child.firstName} {child.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Tabs */}
          <Tabs defaultValue="grades" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="grades">Grades</TabsTrigger>
              <TabsTrigger value="assignments">Assignments</TabsTrigger>
              <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
              <TabsTrigger value="messages">Messages</TabsTrigger>
            </TabsList>

            <TabsContent value="grades">
              {isLoadingData ? (
                <Card>
                  <CardContent className="flex justify-center items-center h-64">
                    <p>Loading child data...</p>
                  </CardContent>
                </Card>
              ) : selectedChild && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center">
                      <GraduationCap className="h-5 w-5 mr-2 text-blue-500" />
                      {selectedChild.firstName}'s Grades
                    </CardTitle>
                    <CardDescription>
                      View all grades and academic performance
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {grades.length > 0 ? (
                      <ScrollArea className="h-[400px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Subject</TableHead>
                              <TableHead>Title</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Grade</TableHead>
                              <TableHead>Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {grades.map(grade => (
                              <TableRow key={grade.id}>
                                <TableCell className="font-medium">{subjectMap[grade.subjectId] || grade.subjectId}</TableCell>
                                <TableCell>{grade.title}</TableCell>
                                <TableCell>{grade.type}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200">
                                    {grade.value}
                                  </Badge>
                                </TableCell>
                                <TableCell>{format(grade.date.toDate(), 'PPP')}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    ) : (
                      <div className="text-center py-10">
                        <GraduationCap className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium">No Grades Yet</h3>
                        <p className="text-gray-500 mt-2">No grades found for {selectedChild.firstName}.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="assignments">
              {isLoadingData ? (
                <Card>
                  <CardContent className="flex justify-center items-center h-64">
                    <p>Loading child data...</p>
                  </CardContent>
                </Card>
              ) : selectedChild && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center">
                      <FileText className="h-5 w-5 mr-2 text-green-500" />
                      {selectedChild.firstName}'s Assignments
                    </CardTitle>
                    <CardDescription>
                      Track assignment progress and submissions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {assignmentsData && assignmentsData.assignments.length > 0 ? (
                      <Accordion type="single" collapsible className="w-full">
                        {assignmentsData.assignments.map(assignment => {
                          const submission = assignmentsData.submissions[assignment.assignmentId];
                          
                          let statusBadge;
                          if (submission) {
                            switch(submission.status) {
                              case 'graded':
                                statusBadge = <Badge className="ml-2 bg-green-500">Graded</Badge>;
                                break;
                              case 'submitted':
                                statusBadge = <Badge variant="secondary" className="ml-2">Submitted</Badge>;
                                break;
                              default:
                                statusBadge = <Badge variant="outline" className="ml-2">{submission.status}</Badge>;
                            }
                          } else {
                            statusBadge = <Badge variant="outline" className="ml-2 bg-yellow-50 text-yellow-700 border-yellow-200">Not Submitted</Badge>;
                          }
                          
                          return (
                            <AccordionItem key={assignment.assignmentId} value={assignment.assignmentId}>
                              <AccordionTrigger className="hover:bg-gray-50 px-4 py-3">
                                <div className="flex items-center">
                                  <span className="font-medium">{assignment.title}</span>
                                  {statusBadge}
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="space-y-3 px-4 py-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-500">Subject</h4>
                                    <p>{assignment.subjectName}</p>
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-500">Due Date</h4>
                                    <p>{format(assignment.dueDate.toDate(), 'PPP')}</p>
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className="text-sm font-medium text-gray-500">Description</h4>
                                  <p className="text-gray-700">{assignment.description}</p>
                                </div>
                                
                                {submission ? (
                                  <div className="mt-4 border-t pt-4">
                                    <h4 className="font-medium mb-2">Submission Details</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                                      <div>
                                        <h5 className="text-sm font-medium text-gray-500">Submitted At</h5>
                                        <p>{format(submission.submittedAt.toDate(), 'Pp')}</p>
                                      </div>
                                      <div>
                                        <h5 className="text-sm font-medium text-gray-500">Status</h5>
                                        <p className="capitalize">{submission.status}</p>
                                      </div>
                                    </div>
                                    
                                    <div className="mb-4">
                                      <h5 className="text-sm font-medium text-gray-500">Content</h5>
                                      <div className="bg-gray-50 p-3 rounded border mt-1">
                                        <p>{submission.content}</p>
                                      </div>
                                    </div>
                                    
                                    {submission.feedback && (
                                      <div className="bg-blue-50 p-4 rounded-md">
                                        <h5 className="font-medium mb-2 text-blue-700">Teacher Feedback</h5>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          {submission.feedback.grade && (
                                            <div>
                                              <h6 className="text-sm font-medium text-blue-600">Grade</h6>
                                              <p className="font-bold text-lg">{submission.feedback.grade}</p>
                                            </div>
                                          )}
                                          <div>
                                            <h6 className="text-sm font-medium text-blue-600">Graded On</h6>
                                            <p>{format(submission.feedback.gradedAt.toDate(), 'Pp')}</p>
                                          </div>
                                        </div>
                                        <div className="mt-2">
                                          <h6 className="text-sm font-medium text-blue-600">Comment</h6>
                                          <p>{submission.feedback.comment}</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center bg-yellow-50 p-4 rounded-md mt-4">
                                    <div className="text-center">
                                      <p className="text-yellow-700 mb-1">Assignment not submitted yet</p>
                                      <p className="text-sm text-gray-500">
                                        {selectedChild.firstName} has not submitted this assignment yet.
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                    ) : (
                      <div className="text-center py-10">
                        <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium">No Assignments Yet</h3>
                        <p className="text-gray-500 mt-2">No assignments found for {selectedChild.firstName}.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="quizzes">
              {isLoadingData ? (
                <Card>
                  <CardContent className="flex justify-center items-center h-64">
                    <p>Loading child data...</p>
                  </CardContent>
                </Card>
              ) : selectedChild && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center">
                      <ClipboardList className="h-5 w-5 mr-2 text-purple-500" />
                      {selectedChild.firstName}'s Quizzes
                    </CardTitle>
                    <CardDescription>
                      Review quiz results and performance metrics
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {quizData && quizData.quizzes.length > 0 ? (
                      <Accordion type="single" collapsible className="w-full">
                        {quizData.quizzes.map(quiz => {
                          const result = quizData.results.find(r => r.quizId === quiz.quizId);
                          const attempts = cheatingAttempts[quiz.quizId] || [];
                          
                          let statusBadge;
                          if (result) {
                            const scorePercent = Math.round((result.score / result.totalPoints) * 100);
                            if (scorePercent >= 90) {
                              statusBadge = <Badge className="ml-2 bg-green-500">Excellent {scorePercent}%</Badge>;
                            } else if (scorePercent >= 70) {
                              statusBadge = <Badge className="ml-2 bg-blue-500">Good {scorePercent}%</Badge>;
                            } else if (scorePercent >= 50) {
                              statusBadge = <Badge className="ml-2 bg-yellow-500">Average {scorePercent}%</Badge>;
                            } else {
                              statusBadge = <Badge className="ml-2 bg-red-500">Needs Work {scorePercent}%</Badge>;
                            }
                          } else {
                            statusBadge = <Badge variant="outline" className="ml-2">Not Taken</Badge>;
                          }
                          
                          return (
                            <AccordionItem key={quiz.quizId} value={quiz.quizId}>
                              <AccordionTrigger className="hover:bg-gray-50 px-4 py-3">
                                <div className="flex items-center">
                                  <span className="font-medium">{quiz.title}</span>
                                  {statusBadge}
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="space-y-3 px-4 py-3">
                                <div>
                                  <h4 className="text-sm font-medium text-gray-500">Description</h4>
                                  <p className="text-gray-700">{quiz.description}</p>
                                </div>
                                
                                {result ? (
                                  <div className="mt-4 border-t pt-4">
                                    <h4 className="font-medium mb-3">Result Summary</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                      <div className="bg-gray-50 p-3 rounded-md text-center">
                                        <h5 className="text-sm font-medium text-gray-500">Score</h5>
                                        <p className="text-2xl font-bold">{result.score} / {result.totalPoints}</p>
                                      </div>
                                      <div className="bg-gray-50 p-3 rounded-md text-center">
                                        <h5 className="text-sm font-medium text-gray-500">Percentage</h5>
                                        <p className="text-2xl font-bold">
                                          {Math.round((result.score / result.totalPoints) * 100)}%
                                        </p>
                                      </div>
                                      <div className="bg-gray-50 p-3 rounded-md text-center">
                                        <h5 className="text-sm font-medium text-gray-500">Completed On</h5>
                                        <p className="text-lg">{format(result.timestamp.toDate(), 'PP')}</p>
                                      </div>
                                    </div>
                                    
                                    {attempts.length > 0 && (
                                      <div className="bg-orange-50 p-4 rounded-md mt-4">
                                        <h5 className="font-medium text-orange-700 flex items-center">
                                          <AlertTriangle className="h-4 w-4 mr-2" />
                                          Potential Cheating Attempts Detected ({attempts.length})
                                        </h5>
                                        <ul className="list-disc list-inside mt-2 space-y-1 text-orange-800">
                                          {attempts.map((attempt, index) => (
                                            <li key={index} className="text-sm">
                                              <span className="font-medium">{format(attempt.timestamp.toDate(), 'Pp')}</span>: {attempt.type} - {attempt.description}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center bg-gray-50 p-6 rounded-md mt-4">
                                    <div className="text-center">
                                      <p className="text-gray-700 mb-1">Quiz not taken yet</p>
                                      <p className="text-sm text-gray-500">
                                        {selectedChild.firstName} has not completed this quiz.
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                    ) : (
                      <div className="text-center py-10">
                        <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium">No Quizzes Yet</h3>
                        <p className="text-gray-500 mt-2">No quizzes found for {selectedChild.firstName}.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="messages">
              <Card className="h-[600px] flex flex-col">
                <CardHeader className="pb-0">
                  <CardTitle className="flex items-center">
                    <MessageSquare className="h-5 w-5 mr-2 text-amber-500" />
                    Messages
                  </CardTitle>
                  <CardDescription>
                    Communicate with teachers and staff
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex overflow-hidden p-0 pt-6">
                  {messagingError && (
                    <div className="w-full p-4 text-red-600 bg-red-50 rounded-md">
                      {messagingError}
                    </div>
                  )}
                  
                  {!messagingError && (
                    <>
                      <div className="w-1/3 border-r overflow-y-auto">
                        {isLoadingConversations ? (
                          <div className="p-4 text-center">
                            <p>Loading conversations...</p>
                          </div>
                        ) : (
                          <>
                            <div className="px-4 py-2 border-b">
                              <h3 className="font-medium">Conversations</h3>
                            </div>
                            <SimpleConversationList
                              conversations={conversations}
                              selectedConversationId={selectedConversation?.conversationId}
                              onSelectAction={handleSelectConversation}
                              currentUserId={parent?.userId ?? ''}
                            />
                          </>
                        )}
                      </div>
                      <div className="w-2/3 flex flex-col">
                        {selectedConversation ? (
                          <>
                            <div className="px-4 py-2 border-b bg-gray-50">
                              <h3 className="font-medium">
                                {selectedConversation.participants
                                  .filter(id => id !== parent.userId)
                                  .join(', ')}
                              </h3>
                            </div>
                            <ScrollArea className="flex-1 p-4">
                              {isLoadingMessages ? (
                                <div className="text-center py-4">
                                  <p>Loading messages...</p>
                                </div>
                              ) : (
                                <SimpleMessageList 
                                  messages={messages} 
                                  currentUserId={parent?.userId ?? ''} 
                                />
                              )}
                            </ScrollArea>
                            <div className="border-t p-4">
                              <SimpleComposeMessage onSendMessage={handleSendMessage} />
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-500">
                            <div className="text-center">
                              <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                              <p>Select a conversation to view messages</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default ParentDashboard;