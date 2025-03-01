"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useUser } from "@/contexts/UserContext";
import { useRouter } from "next/navigation";
import { useQuiz } from "@/contexts/QuizContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { Quiz, LiveStudentSession, CheatAttempt } from "@/lib/interfaces";
import { format, formatDistance, formatDistanceToNow } from "date-fns";
import Sidebar from "@/components/functional/Sidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  AlertCircle,
  AlertTriangle, 
  ArrowLeft, 
  Clock, 
  Users,
  Eye,
  ChevronsUpDown,
  RefreshCcw,
  Bell
} from "lucide-react";
import { use } from "react";

interface PageParams {
  quizId: string;
}

export default function LiveQuizMonitoringPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { user } = useUser();
  const router = useRouter();
  const unwrappedParams = use(params);
  const { quizId } = unwrappedParams;
  
  const { liveQuizzes, liveQuizResults, monitorQuiz, stopMonitoring } = useQuiz();
  
  // Move monitoringStateRef inside the component
  const monitoringStateRef = useRef({
    lastUpdate: new Date(),
    monitoringActive: false,
    suspectedCheatersCache: new Map<string, LiveStudentSession>(),
  });
  
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("students");
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const monitoringInitiatedRef = useRef(false);

  // Set up real-time monitoring once when component mounts
  useEffect(() => {
    if (!user || !user.schoolId || user.role !== "teacher" || monitoringInitiatedRef.current) {
      return;
    }

    let mounted = true;

    async function setupMonitoring() {
      setLoading(true);
      try {
        // Fetch quiz data
        const quizRef = doc(db, "schools", user!.schoolId, "quizzes", quizId);
        const quizSnapshot = await getDoc(quizRef);
          
        if (!quizSnapshot.exists()) {
          console.error("Quiz not found");
          router.push("/quiz-reviews");
          return;
        }
          
        const quizData = { ...quizSnapshot.data(), quizId: quizSnapshot.id } as Quiz;
        
        if (mounted) {
          setQuiz(quizData);
          
          // Start monitoring only once
          await monitorQuiz(quizId);
          monitoringInitiatedRef.current = true;
          monitoringStateRef.current.monitoringActive = true;
          console.debug('[QuizMonitor] Monitoring initialized successfully');
        }
      } catch (error) {
        console.error("Error setting up quiz monitoring:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    setupMonitoring();
    
    // Clean up on component unmount
    return () => {
      mounted = false;
      monitoringStateRef.current.monitoringActive = false;
      console.debug('[QuizMonitor] Component unmounting, cleaning up monitoring');
      stopMonitoring(quizId);
    };
  }, [user, quizId, router, monitorQuiz, stopMonitoring]);

  // Update the "last refreshed" time every second to reflect real-time nature
  useEffect(() => {
    const updateTimerInterval = setInterval(() => {
      setLastRefreshed(new Date());
    }, 5000); // Update every 5 seconds
    
    return () => clearInterval(updateTimerInterval);
  }, []);

  // Get the live session data for this quiz
  const liveSession = liveQuizzes[quizId];
  // Filter out duplicate results, keeping only the valid one (with actual points) for each student
  const results = (liveQuizResults[quizId] || []).reduce((acc, current) => {
    const existing = acc.find(r => r.userId === current.userId);
    if (!existing || (existing && existing.score < current.score)) {
      // Remove the existing entry with lower score if it exists
      const filtered = acc.filter(r => r.userId !== current.userId);
      return [...filtered, current];
    }
    return acc;
  }, [] as typeof liveQuizResults[string]);
  
  // Get active students (those who haven't completed yet)
  const activeStudents = liveSession?.activeStudents || [];
  
  // Get suspected cheaters and cache them to prevent disappearing
  const suspectedCheaters = useMemo(() => {
    if (!liveSession?.activeStudents) return [];
    
    const newSuspectedCheaters = liveSession.activeStudents.filter(
      student => student.status === "suspected_cheating"
    );
    
    // Update cache with new cheaters
    newSuspectedCheaters.forEach(cheater => {
      const cachedCheater = monitoringStateRef.current.suspectedCheatersCache.get(cheater.studentId);
      if (!cachedCheater || 
          cheater.cheatingAttempts.length > cachedCheater.cheatingAttempts.length) {
        monitoringStateRef.current.suspectedCheatersCache.set(cheater.studentId, cheater);
      }
    });
    
    // Combine cached and new cheaters, preferring new data
    const allCheaters = Array.from(monitoringStateRef.current.suspectedCheatersCache.values());
    return allCheaters.filter(cheater => 
      newSuspectedCheaters.some(newCheater => newCheater.studentId === cheater.studentId)
    );
  }, [liveSession?.activeStudents]);
  
  // Calculate quiz statistics
  const totalStudentsStarted = results.length;
  const studentsCompleted = results.filter(r => r.completed).length;
  const studentsInProgress = totalStudentsStarted - studentsCompleted;
  
  // Format time for display
  const formatTime = (seconds: number | undefined): string => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Calculate progress percentage for a student
  const calculateProgress = (student: LiveStudentSession): number => {
    if (!quiz) return 0;
    return Math.round((student.questionsAnswered / quiz.questions.length) * 100);
  };
  
  // Get status badge for a student
  const getStatusBadge = (student: LiveStudentSession) => {
    switch (student.status) {
      case "suspected_cheating":
        return <Badge className="bg-red-500">Suspected Cheating</Badge>;
      case "idle":
        return <Badge variant="outline" className="text-amber-500 border-amber-500">Idle</Badge>;
      case "submitted":
        return <Badge variant="outline" className="text-green-500 border-green-500">Submitted</Badge>;
      default:
        return <Badge variant="outline" className="text-blue-500 border-blue-500">Active</Badge>;
    }
  };
  
  // Format a cheating attempt for display
  const formatCheatAttempt = (attempt: CheatAttempt) => {
    let typeLabel = "Unknown";
    let badgeClass = "bg-gray-500";
    
    switch (attempt.type) {
      case "tab_switch":
        typeLabel = "Tab Switch";
        badgeClass = "bg-amber-500";
        break;
      case "window_blur":
        typeLabel = "Window Blur";
        badgeClass = "bg-amber-500";
        break;
      case "copy_detected":
        typeLabel = "Copy Attempt";
        badgeClass = "bg-red-500";
        break;
      case "browser_close":
        typeLabel = "Browser Close";
        badgeClass = "bg-orange-500";
        break;
      case "multiple_devices":
        typeLabel = "Multiple Devices";
        badgeClass = "bg-red-600";
        break;
      case "time_anomaly":
        typeLabel = "Time Anomaly";
        badgeClass = "bg-red-600";
        break;
    }
    
    return (
      <div key={attempt.timestamp.toDate().getTime()} className="flex items-center justify-between py-2 border-b last:border-0">
        <div className="flex items-center gap-2">
          <Badge className={badgeClass}>{typeLabel}</Badge>
          <span className="text-sm">{attempt.description}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDistance(attempt.timestamp.toDate(), new Date(), { addSuffix: true })}
        </span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 p-8 flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg font-medium mb-2">Starting monitoring session...</div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!quiz) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 p-8 flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg font-medium mb-2">Quiz not found</div>
            <Button onClick={() => router.push("/quiz-reviews")}>Back to Quiz Reviews</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/quiz-reviews")}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <h1 className="text-2xl font-bold text-gray-800">
              Live Quiz Monitoring
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center text-xs">
              <Clock className="h-3 w-3 mr-1 text-muted-foreground" />
              <span className="text-muted-foreground">Live updates active</span>
              <span className="mx-1 text-muted-foreground">•</span>
              <span className="text-green-600 font-medium">
                Last update: {formatDistanceToNow(lastRefreshed, { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Quiz Title
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{quiz.title}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Students In Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-2xl font-bold">{studentsInProgress}</div>
              <Users className="h-5 w-5 text-blue-500" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Students Completed
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-2xl font-bold">{studentsCompleted}</div>
              <Users className="h-5 w-5 text-green-500" />
            </CardContent>
          </Card>
          
          <Card className={suspectedCheaters.length > 0 ? "border-red-300 bg-red-50" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className={`text-sm font-medium ${suspectedCheaters.length > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                Suspected Cheaters
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className={`text-2xl font-bold ${suspectedCheaters.length > 0 ? "text-red-600" : ""}`}>
                {suspectedCheaters.length}
              </div>
              {suspectedCheaters.length > 0 ? (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              ) : (
                <Eye className="h-5 w-5 text-muted-foreground" />
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="students" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="students">Active Students</TabsTrigger>
            <TabsTrigger value="cheating" className="relative">
              Cheating Attempts
              {suspectedCheaters.length > 0 && (
                <Badge className="ml-1.5 bg-red-500">{suspectedCheaters.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          
          <TabsContent value="students" className="space-y-4">
            {activeStudents.length === 0 ? (
              <Card>
                <CardContent className="pt-6 pb-4 text-center text-muted-foreground">
                  No active students at the moment
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Active Students</CardTitle>
                  <CardDescription>
                    Students currently taking the quiz 
                    <span className="ml-2 text-xs text-green-600">(Updates in real-time)</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Last Active</TableHead>
                        <TableHead>Cheating Attempts</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeStudents.map((student) => (
                        <TableRow key={student.studentId} className={
                          student.status === "suspected_cheating" ? "bg-red-50" : ""
                        }>
                          <TableCell className="font-medium">
                            <div>
                              {student.studentName}
                              {student.cheatingAttempts.length > 0 && 
                                <div className="mt-1 text-xs text-red-600 flex items-center">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Latest violation: {formatDistance(
                                    student.cheatingAttempts[student.cheatingAttempts.length - 1].timestamp.toDate(),
                                    new Date(),
                                    { addSuffix: true }
                                  )}
                                </div>
                              }
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(student)}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Progress value={calculateProgress(student)} className="h-2 w-[80px]" />
                              <span className="text-xs text-muted-foreground">
                                {student.questionsAnswered} / {quiz.questions.length}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDistance(student.startedAt.toDate(), new Date(), { addSuffix: true })}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDistance(student.lastActive.toDate(), new Date(), { addSuffix: true })}
                          </TableCell>
                          <TableCell>
                            {student.cheatingAttempts.length > 0 ? (
                              <Badge variant="outline" className="text-red-500 border-red-500">
                                {student.cheatingAttempts.length} attempts
                              </Badge>
                            ) : (
                              <Badge variant="outline">None</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="cheating">
            {suspectedCheaters.length === 0 ? (
              <Card>
                <CardContent className="pt-6 pb-4 text-center text-muted-foreground">
                  No cheating attempts detected
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {suspectedCheaters.map((student) => (
                  <Card key={student.studentId} className="border-red-200">
                    <CardHeader className="bg-red-50 border-b border-red-100">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg text-red-700">
                          {student.studentName}
                        </CardTitle>
                        <Badge className="bg-red-500">
                          {student.cheatingAttempts.length} Violations
                        </Badge>
                      </div>
                      <CardDescription>
                        Started {formatDistance(student.startedAt.toDate(), new Date(), { addSuffix: true })}
                        {" • "}
                        Last active {formatDistance(student.lastActive.toDate(), new Date(), { addSuffix: true })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        {student.cheatingAttempts.map(formatCheatAttempt)}
                      </div>
                    </CardContent>
                    <CardFooter className="bg-gray-50 border-t flex justify-between">
                      <Button variant="outline" size="sm" className="text-red-500 border-red-200">
                        <Bell className="h-4 w-4 mr-2" />
                        Send Warning
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          // Implement disqualification logic here
                          alert("Disqualification feature will be implemented soon");
                        }}
                      >
                        Disqualify Student
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="completed">
            {results.filter(r => r.completed).length === 0 ? (
              <Card>
                <CardContent className="pt-6 pb-4 text-center text-muted-foreground">
                  No students have completed the quiz yet
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Completed Submissions</CardTitle>
                  <CardDescription>
                    Students who have finished the quiz
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Submission Time</TableHead>
                        <TableHead>Time Spent</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results
                        .filter(r => r.completed)
                        .map((result) => {
                          const percentageScore = (result.score / result.totalPoints) * 100;
                          let scoreClass = "";
                          if (percentageScore >= 90) scoreClass = "text-green-600";
                          else if (percentageScore >= 75) scoreClass = "text-emerald-600";
                          else if (percentageScore >= 60) scoreClass = "text-amber-600";
                          else scoreClass = "text-red-600";
                          
                          return (
                            <TableRow key={result.userId}>
                              <TableCell className="font-medium">{result.studentName || "Unknown Student"}</TableCell>
                              <TableCell className={scoreClass}>
                                <div className="flex items-center gap-2">
                                  {result.score}/{result.totalPoints}
                                  <span className="text-xs">
                                    ({percentageScore.toFixed(1)}%)
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {result.timestamp ? format(result.timestamp.toDate(), "dd MMM, HH:mm:ss") : "N/A"}
                              </TableCell>
                              <TableCell>
                                {formatTime(result.totalTimeSpent)}
                              </TableCell>
                              <TableCell>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => router.push(`/quiz-reviews/${quizId}/student/${result.userId}`)}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  View
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      }
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="analytics">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Completion Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] flex items-center justify-center">
                    {/* Placeholder for chart - you can implement with recharts or other library */}
                    <div className="text-center text-muted-foreground">
                      <p className="mb-2">Completion statistics</p>
                      <p>{studentsCompleted} of {totalStudentsStarted} students completed</p>
                      <p>{studentsInProgress} students in progress</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Score Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] flex items-center justify-center">
                    {/* Placeholder for chart */}
                    <div className="text-center text-muted-foreground">
                      <p>Score distribution chart will appear here</p>
                      <p>when more students complete the quiz</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Time Spent vs. Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] flex items-center justify-center">
                    {/* Placeholder for chart */}
                    <div className="text-center text-muted-foreground">
                      <p>Correlation between time spent and score</p>
                      <p>will appear here as students complete the quiz</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}