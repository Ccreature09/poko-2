"use client";

/**
 * Teacher Quiz Live Monitoring Page
 *
 * Real-time proctoring interface for active assessment supervision.
 * This page provides:
 *
 * Key features:
 * - Live student activity tracking with real-time updates
 * - Automated cheating detection with incident reporting
 * - Student progress visualization across all quiz questions
 * - Detailed session metrics including timing and submission data
 * - Academic integrity monitoring with cheating type classification
 * - Ability to intervene by sending warnings or disqualifying students
 *
 * Data flow:
 * - Establishes real-time connection to active quiz sessions
 * - Processes and categorizes potential cheating incidents as they occur
 * - Calculates student progress metrics and performance indicators
 * - Maintains persistent monitoring state with historical incident tracking
 *
 * This interface enables teachers to actively supervise online assessments,
 * enforce academic integrity policies, and intervene in real-time when
 * suspicious activities are detected, ensuring fair and valid assessment conditions.
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { useUser } from "@/contexts/UserContext";
import { useParams, useRouter } from "next/navigation";
import { useQuiz } from "@/contexts/QuizContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import type { Quiz, LiveStudentSession, CheatAttempt } from "@/lib/interfaces";
import { format, formatDistance, formatDistanceToNow } from "date-fns";
import Sidebar from "@/components/functional/layout/Sidebar";
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
  AlertTriangle,
  ArrowLeft,
  Clock,
  Users,
  Eye,
  Bell,
} from "lucide-react";

export default function LiveQuizMonitoringPage() {
  const { user } = useUser();
  const router = useRouter();
  const params = useParams<{ quizId: string }>();
  const quizId = params?.quizId || "";

  const { liveQuizzes, liveQuizResults, monitorQuiz, stopMonitoring } =
    useQuiz();

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

  // Get the live session data for this quiz
  const liveSession = liveQuizzes[quizId];
  // Filter out duplicate results, keeping only the valid one (with actual points) for each student
  const results = (liveQuizResults[quizId] || []).reduce((acc, current) => {
    const existing = acc.find((r) => r.userId === current.userId);
    if (!existing || (existing && existing.score < current.score)) {
      // Remove the existing entry with lower score if it exists
      const filtered = acc.filter((r) => r.userId !== current.userId);
      return [...filtered, current];
    }
    return acc;
  }, [] as (typeof liveQuizResults)[string]);

  // Get active students (those who haven't completed yet)
  const activeStudents = liveSession?.activeStudents || [];

  // Set up real-time monitoring once when component mounts
  useEffect(() => {
    if (
      !user ||
      !user.schoolId ||
      user.role !== "teacher" ||
      monitoringInitiatedRef.current
    ) {
      return;
    }

    let mounted = true;
    // Save a copy of the current state for cleanup to avoid the exhaustive-deps issue
    const currentStateRef = monitoringStateRef.current;

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

        const quizData = {
          ...quizSnapshot.data(),
          quizId: quizSnapshot.id,
        } as Quiz;

        // Check if there are recent active users (less than 3 hours old)
        const hasRecentActivity = Boolean(
          quizData.inProgress &&
            quizData.activeUsers &&
            quizData.activeUsers.length > 0 &&
            quizData.lastActiveTimestamp &&
            new Date().getTime() -
              quizData.lastActiveTimestamp.toDate().getTime() <
              3 * 60 * 60 * 1000
        );

        // If no recent activity, update the quiz to mark it as not in progress
        if (quizData.inProgress && !hasRecentActivity && mounted) {
          console.debug(
            "[QuizMonitor] No recent activity detected, updating quiz status"
          );
          try {
            await updateDoc(quizRef, {
              inProgress: false,
              activeUsers: [], // Clear the active users list as it's stale
            });
            quizData.inProgress = false;
            quizData.activeUsers = [];
          } catch (updateError) {
            console.error("Error updating quiz status:", updateError);
          }
        }

        if (mounted) {
          setQuiz(quizData);

          // Start monitoring only once
          await monitorQuiz(quizId);
          monitoringInitiatedRef.current = true;
          monitoringStateRef.current.monitoringActive = true;
          console.debug("[QuizMonitor] Monitoring initialized successfully");
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
      currentStateRef.monitoringActive = false;
      console.debug(
        "[QuizMonitor] Component unmounting, cleaning up monitoring"
      );
      stopMonitoring(quizId);
    };
  }, [user, quizId, router, monitorQuiz, stopMonitoring]);

  // Update the "last refreshed" time every second to reflect real-time nature
  useEffect(() => {
    const updateTimerInterval = setInterval(() => {
      setLastRefreshed(new Date());

      // Force re-render of the suspected cheaters list to ensure immediate display of new attempts
      if (liveSession?.activeStudents) {
        // Find students with cheating attempts
        const studentsWithCheatingAttempts = liveSession.activeStudents.filter(
          (student) => student.cheatingAttempts.length > 0
        );

        // Update the cache immediately when new cheating attempts are detected
        studentsWithCheatingAttempts.forEach((student) => {
          const cachedStudent =
            monitoringStateRef.current.suspectedCheatersCache.get(
              student.studentId
            );

          // If this is a new cheater or they have more attempts than before, update cache
          if (
            !cachedStudent ||
            student.cheatingAttempts.length >
              cachedStudent.cheatingAttempts.length
          ) {
            console.debug(
              `[QuizMonitor] Immediately updating cache with new cheating attempt for ${student.studentName}`
            );
            monitoringStateRef.current.suspectedCheatersCache.set(
              student.studentId,
              {
                ...student,
                cheatingAttempts: [...student.cheatingAttempts],
              }
            );

            // If "cheating" tab isn't active and there's a new attempt, switch to it
            if (
              activeTab !== "cheating" &&
              (!cachedStudent ||
                student.cheatingAttempts.length >
                  cachedStudent.cheatingAttempts.length)
            ) {
              setActiveTab("cheating");
            }
          }
        });
      }
    }, 1000); // Update every 1 second

    return () => clearInterval(updateTimerInterval);
  }, [liveSession?.activeStudents, activeTab]);

  // Get suspected cheaters and cache them to prevent disappearing
  const suspectedCheaters = useMemo(() => {
    if (!liveSession?.activeStudents) return [];

    const newSuspectedCheaters = liveSession.activeStudents.filter(
      (student) =>
        student.status === "suspected_cheating" ||
        student.cheatingAttempts.length > 0
    );

    // Update cache with new cheaters
    newSuspectedCheaters.forEach((cheater) => {
      const cachedCheater =
        monitoringStateRef.current.suspectedCheatersCache.get(
          cheater.studentId
        );

      if (!cachedCheater) {
        // New cheater, just add to cache
        monitoringStateRef.current.suspectedCheatersCache.set(
          cheater.studentId,
          cheater
        );
      } else if (
        cheater.cheatingAttempts.length >= cachedCheater.cheatingAttempts.length
      ) {
        // Update if we have same or more cheating attempts
        monitoringStateRef.current.suspectedCheatersCache.set(
          cheater.studentId,
          {
            ...cheater,
            // Merge the cheating attempts to make sure we don't lose any
            cheatingAttempts: [...cheater.cheatingAttempts],
          }
        );
      } else {
        // Keep existing cheating attempts if the new list has fewer attempts
        monitoringStateRef.current.suspectedCheatersCache.set(
          cheater.studentId,
          {
            ...cheater,
            cheatingAttempts: [...cachedCheater.cheatingAttempts],
          }
        );
      }
    });

    // Return all cached cheaters - this way they never disappear
    return Array.from(
      monitoringStateRef.current.suspectedCheatersCache.values()
    );
  }, [liveSession?.activeStudents]);

  // Calculate quiz statistics
  const totalStudentsStarted = results.length;
  const studentsCompleted = results.filter((r) => r.completed).length;
  const studentsInProgress = totalStudentsStarted - studentsCompleted;

  // Format time for display
  const formatTime = (seconds: number | undefined): string => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Calculate progress percentage for a student
  const calculateProgress = (student: LiveStudentSession): number => {
    if (!quiz) return 0;
    return Math.round(
      (student.questionsAnswered / quiz.questions.length) * 100
    );
  };

  // Get status badge for a student
  const getStatusBadge = (student: LiveStudentSession) => {
    switch (student.status) {
      case "suspected_cheating":
        return <Badge className="bg-red-500">Съмнение за измама</Badge>;
      case "idle":
        return (
          <Badge variant="outline" className="text-amber-500 border-amber-500">
            Неактивен
          </Badge>
        );
      case "submitted":
        return (
          <Badge variant="outline" className="text-green-500 border-green-500">
            Предаден
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-blue-500 border-blue-500">
            Активен
          </Badge>
        );
    }
  };

  // Format a cheating attempt for display
  const formatCheatAttempt = (attempt: CheatAttempt) => {
    let typeLabel = "Неизвестен";
    let badgeClass = "bg-gray-500";

    switch (attempt.type) {
      case "tab_switch":
        typeLabel = "Смяна на раздел";
        badgeClass = "bg-amber-500";
        break;
      case "window_blur":
        typeLabel = "Напускане на прозореца";
        badgeClass = "bg-amber-500";
        break;
      case "copy_detected":
        typeLabel = "Опит за копиране";
        badgeClass = "bg-red-500";
        break;
      case "browser_close":
        typeLabel = "Затваряне на браузъра";
        badgeClass = "bg-orange-500";
        break;
      case "multiple_devices":
        typeLabel = "Множество устройства";
        badgeClass = "bg-red-600";
        break;
      case "time_anomaly":
        typeLabel = "Времева аномалия";
        badgeClass = "bg-red-600";
        break;
    }

    return (
      <div
        key={attempt.timestamp.toDate().getTime()}
        className="flex items-center justify-between py-2 border-b last:border-0"
      >
        <div className="flex items-center gap-2">
          <Badge className={badgeClass}>{typeLabel}</Badge>
          <span className="text-sm">{attempt.description}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {format(attempt.timestamp.toDate(), "HH:mm:ss")}
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
            <div className="text-lg font-medium mb-2">
              Започване на наблюдение...
            </div>
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
            <div className="text-lg font-medium mb-2">Тестът не е намерен</div>
            <Button onClick={() => router.push("/teacher/quizzes")}>
              Назад към тестовете
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Check if there are any active students taking the quiz
  const hasActiveStudents = Boolean(
    quiz.activeUsers && quiz.activeUsers.length > 0
  );

  if (!hasActiveStudents) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 p-8 flex items-center justify-center">
          <div className="text-center">
            <div className="text-xl font-medium mb-3">Няма активни ученици</div>
            <div className="text-muted-foreground max-w-md mb-6">
              В момента няма ученици, които правят този тест. Функцията за
              наблюдение е достъпна само когато има активни участници в теста.
            </div>
            <Button onClick={() => router.push("/teacher/quizzes")}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Назад към тестовете
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/teacher/quizzes")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Назад
          </Button>
          <h1 className="text-2xl font-bold text-gray-800">
            Наблюдение на тест на живо
          </h1>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center text-xs">
              <Clock className="h-3 w-3 mr-1 text-muted-foreground" />
              <span className="text-muted-foreground">
                Актуализации на живо
              </span>
              <span className="mx-1 text-muted-foreground">•</span>
              <span className="text-green-600 font-medium">
                Последна актуализация:{" "}
                {formatDistanceToNow(lastRefreshed, { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Заглавие на теста
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{quiz.title}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ученици в процес
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
                Завършили ученици
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-2xl font-bold">{studentsCompleted}</div>
              <Users className="h-5 w-5 text-green-500" />
            </CardContent>
          </Card>

          <Card
            className={
              suspectedCheaters.length > 0 ? "border-red-300 bg-red-50" : ""
            }
          >
            <CardHeader className="pb-2">
              <CardTitle
                className={`text-sm font-medium ${
                  suspectedCheaters.length > 0
                    ? "text-red-600"
                    : "text-muted-foreground"
                }`}
              >
                Съмнения за измама
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div
                className={`text-2xl font-bold ${
                  suspectedCheaters.length > 0 ? "text-red-600" : ""
                }`}
              >
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

        <Tabs
          defaultValue="students"
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="students">Активни ученици</TabsTrigger>
            <TabsTrigger value="cheating" className="relative">
              Опити за измама
              {suspectedCheaters.length > 0 && (
                <Badge className="ml-1.5 bg-red-500">
                  {suspectedCheaters.reduce(
                    (total, student) => total + student.cheatingAttempts.length,
                    0
                  )}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed">Завършени</TabsTrigger>
            <TabsTrigger value="analytics">Анализи</TabsTrigger>
          </TabsList>

          <TabsContent value="students" className="space-y-4">
            {activeStudents.length === 0 ? (
              <Card>
                <CardContent className="pt-6 pb-4 text-center text-muted-foreground">
                  Няма активни ученици в момента
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Активни ученици</CardTitle>
                  <CardDescription>
                    Ученици, които в момента правят теста
                    <span className="ml-2 text-xs text-green-600">
                      (Актуализира се в реално време)
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ученик</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead>Напредък</TableHead>
                        <TableHead>Започнат</TableHead>
                        <TableHead>Последна активност</TableHead>
                        <TableHead>Опити за измама</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeStudents.map((student) => (
                        <TableRow
                          key={student.studentId}
                          className={
                            student.status === "suspected_cheating"
                              ? "bg-red-50"
                              : ""
                          }
                        >
                          <TableCell className="font-medium">
                            <div>
                              {student.studentName}
                              {student.cheatingAttempts.length > 0 && (
                                <div className="mt-1 text-xs text-red-600 flex items-center">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Последно нарушение:{" "}
                                  {formatDistance(
                                    student.cheatingAttempts[
                                      student.cheatingAttempts.length - 1
                                    ].timestamp.toDate(),
                                    new Date(),
                                    { addSuffix: true }
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(student)}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Progress
                                value={calculateProgress(student)}
                                className="h-2 w-[80px]"
                              />
                              <span className="text-xs text-muted-foreground">
                                {student.questionsAnswered} /{" "}
                                {quiz.questions.length}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            преди{" "}
                            {formatDistanceToNow(student.startedAt.toDate())}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            преди{" "}
                            {formatDistanceToNow(student.lastActive.toDate())}
                          </TableCell>
                          <TableCell>
                            {/* Use the cached cheating attempts for consistency */}
                            {(() => {
                              const cachedStudent =
                                monitoringStateRef.current.suspectedCheatersCache.get(
                                  student.studentId
                                );
                              const cheatingAttemptsCount =
                                cachedStudent?.cheatingAttempts.length ||
                                student.cheatingAttempts.length ||
                                0;

                              return cheatingAttemptsCount > 0 ? (
                                <Badge
                                  variant="outline"
                                  className="text-red-500 border-red-500"
                                >
                                  {cheatingAttemptsCount} опита
                                </Badge>
                              ) : (
                                <Badge variant="outline">Няма</Badge>
                              );
                            })()}
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
                  Няма засечени опити за измама
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
                          {student.cheatingAttempts.length} нарушения
                        </Badge>
                      </div>
                      <CardDescription>
                        Започнал преди{" "}
                        {formatDistanceToNow(student.startedAt.toDate())}
                        {" • "}
                        Последна активност преди{" "}
                        {formatDistanceToNow(student.lastActive.toDate())}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        {[...student.cheatingAttempts]
                          .sort(
                            (a, b) =>
                              b.timestamp.toDate().getTime() -
                              a.timestamp.toDate().getTime()
                          )
                          .map(formatCheatAttempt)}
                      </div>
                    </CardContent>
                    <CardFooter className="bg-gray-50 border-t flex justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 border-red-200"
                      >
                        <Bell className="h-4 w-4 mr-2" />
                        Изпрати предупреждение
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          // Implement disqualification logic here
                          alert(
                            "Функцията за дисквалификация ще бъде добавена скоро"
                          );
                        }}
                      >
                        Дисквалифицирай ученика
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed">
            {results.filter((r) => r.completed).length === 0 ? (
              <Card>
                <CardContent className="pt-6 pb-4 text-center text-muted-foreground">
                  Все още няма ученици, завършили теста
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Завършени предавания</CardTitle>
                  <CardDescription>
                    Ученици, които са завършили теста
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ученик</TableHead>
                        <TableHead>Резултат</TableHead>
                        <TableHead>Час на предаване</TableHead>
                        <TableHead>Времетраене</TableHead>
                        <TableHead>Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results
                        .filter((r) => r.completed)
                        .map((result) => {
                          const percentageScore =
                            (result.score / result.totalPoints) * 100;
                          let scoreClass = "";
                          if (percentageScore >= 90)
                            scoreClass = "text-green-600";
                          else if (percentageScore >= 75)
                            scoreClass = "text-emerald-600";
                          else if (percentageScore >= 60)
                            scoreClass = "text-amber-600";
                          else scoreClass = "text-red-600";

                          return (
                            <TableRow key={result.userId}>
                              <TableCell className="font-medium">
                                {result.studentName || "Неизвестен ученик"}
                              </TableCell>
                              <TableCell className={scoreClass}>
                                <div className="flex items-center gap-2">
                                  {result.score}/{result.totalPoints}
                                  <span className="text-xs">
                                    ({percentageScore.toFixed(1)}%)
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {result.timestamp
                                  ? format(
                                      result.timestamp.toDate(),
                                      "dd MMM, HH:mm:ss"
                                    )
                                  : "N/A"}
                              </TableCell>
                              <TableCell>
                                {formatTime(result.totalTimeSpent)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    router.push(
                                      `/quiz-reviews/${quizId}/student/${result.userId}`
                                    )
                                  }
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  Преглед
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
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
                  <CardTitle>Статус на завършване</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] flex items-center justify-center">
                    {/* Placeholder for chart - you can implement with recharts or other library */}
                    <div className="text-center text-muted-foreground">
                      <p className="mb-2">Статистика на завършване</p>
                      <p>
                        {studentsCompleted} от {totalStudentsStarted} ученици са
                        завършили
                      </p>
                      <p>{studentsInProgress} ученици в процес</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Разпределение на резултатите</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] flex items-center justify-center">
                    {/* Placeholder for chart */}
                    <div className="text-center text-muted-foreground">
                      <p>Графиката на разпределение на резултатите</p>
                      <p>ще се появи когато повече ученици завършат теста</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Време за решаване спрямо резултат</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] flex items-center justify-center">
                    {/* Placeholder for chart */}
                    <div className="text-center text-muted-foreground">
                      <p>Корелация между време за решаване и резултат</p>
                      <p>ще се появи когато повече ученици завършат теста</p>
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
