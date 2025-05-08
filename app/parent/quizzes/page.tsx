"use client";

/**
 * Parent Quizzes Page
 *
 * Provides a comprehensive interface for parents to monitor their children's quiz performance
 * with detailed analytics and transparency about quiz completion and integrity. This page offers:
 *
 * Key features:
 * - Multi-child selector for families with multiple students
 * - Performance dashboard with key metrics (average scores, completion rates)
 * - Categorized quiz views (all, completed, pending, missed)
 * - Academic integrity monitoring with alerts for potential quiz violations
 * - Detailed quiz results with score breakdowns and completion time
 *
 * Data flow:
 * 1. Fetches parent-child relationships from the user database
 * 2. Loads quiz data, results, and academic integrity information
 * 3. Processes data to calculate performance metrics and statistics
 * 4. Organizes quizzes into different status categories for filtered views
 *
 * The page implements comprehensive visual feedback for different performance levels,
 * academic integrity monitoring, and detailed score breakdowns in an intuitive interface.
 */

import React, { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import {
  FileText,
  Clock,
  AlertCircle,
  Users,
  XCircle,
  AlertTriangle,
  Calendar,
  Eye,
  PieChart,
  Percent,
  Timer,
  Smartphone,
} from "lucide-react";
import Sidebar from "@/components/functional/layout/Sidebar";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { Quiz, QuizResult, CheatAttempt } from "@/lib/interfaces";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getChildQuizResults,
  getChildCheatingAttempts,
} from "@/lib/management/parentManagement";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

interface Child {
  id: string;
  name: string;
  classId?: string;
  className?: string;
}

// Helper function to determine score color based on percentage
const getScoreColor = (percentage: number): string => {
  if (percentage >= 90) return "text-green-600 font-medium";
  if (percentage >= 70) return "text-blue-600 font-medium";
  if (percentage >= 50) return "text-amber-600 font-medium";
  return "text-red-600 font-medium";
};

// Format quiz status badge
const getStatusBadge = (quiz: Quiz, result?: QuizResult) => {
  if (!result) {
    // Calculate if the quiz is overdue
    const isOverdue =
      quiz.availableTo &&
      new Date() > new Date(quiz.availableTo.seconds * 1000);

    if (isOverdue) {
      return (
        <Badge
          variant="outline"
          className="bg-red-50 text-red-700 border-red-200"
        >
          Пропуснат
        </Badge>
      );
    }

    if (
      quiz.availableFrom &&
      new Date() < new Date(quiz.availableFrom.seconds * 1000)
    ) {
      return (
        <Badge
          variant="outline"
          className="bg-gray-50 text-gray-700 border-gray-200"
        >
          Предстоящ
        </Badge>
      );
    }

    return (
      <Badge
        variant="outline"
        className="bg-amber-50 text-amber-700 border-amber-200"
      >
        Не е направен
      </Badge>
    );
  }

  if (result.completed) {
    const percentScore = Math.round((result.score / result.totalPoints) * 100);

    if (percentScore >= 90) {
      return (
        <Badge
          variant="outline"
          className="bg-green-50 text-green-700 border-green-200"
        >
          Отличен ({percentScore}%)
        </Badge>
      );
    }
    if (percentScore >= 70) {
      return (
        <Badge
          variant="outline"
          className="bg-blue-50 text-blue-700 border-blue-200"
        >
          Добър ({percentScore}%)
        </Badge>
      );
    }
    if (percentScore >= 50) {
      return (
        <Badge
          variant="outline"
          className="bg-yellow-50 text-yellow-700 border-yellow-200"
        >
          Среден ({percentScore}%)
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="bg-red-50 text-red-700 border-red-200"
      >
        Под очакванията ({percentScore}%)
      </Badge>
    );
  }

  // For incomplete quizzes or special states
  // Check if it has a status that might indicate abandonment (checking the timestamp only)
  if (result.timestamp && !result.completed) {
    return (
      <Badge
        variant="outline"
        className="bg-gray-50 text-gray-700 border-gray-200"
      >
        Прекъснат
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="bg-blue-50 text-blue-700 border-blue-200"
    >
      В прогрес
    </Badge>
  );
};

// Format quiz availability time
const formatAvailabilityTime = (quiz: Quiz) => {
  if (quiz.availableFrom && quiz.availableTo) {
    return `${format(
      new Date(quiz.availableFrom.seconds * 1000),
      "dd.MM.yyyy HH:mm"
    )} - ${format(
      new Date(quiz.availableTo.seconds * 1000),
      "dd.MM.yyyy HH:mm"
    )}`;
  } else if (quiz.availableFrom) {
    return `От ${format(
      new Date(quiz.availableFrom.seconds * 1000),
      "dd.MM.yyyy HH:mm"
    )}`;
  } else if (quiz.availableTo) {
    return `До ${format(
      new Date(quiz.availableTo.seconds * 1000),
      "dd.MM.yyyy HH:mm"
    )}`;
  }
  return "Винаги достъпен";
};

// Format the date when the quiz was taken
const formatQuizDate = (result?: QuizResult) => {
  if (!result || !result.startedAt) return "Не е направен";
  return format(new Date(result.startedAt.seconds * 1000), "dd.MM.yyyy HH:mm");
};

// Format quiz time spent
const formatTimeSpent = (seconds?: number) => {
  if (!seconds) return "Неизвестно";

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds} секунди`;
  }

  return `${minutes} мин. ${remainingSeconds} сек.`;
};

export default function ParentQuizzes() {
  const { user } = useUser();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Define valid tab types
  type TabType = "all" | "completed" | "pending" | "missed";
  const [activeTab, setActiveTab] = useState<TabType>("all");

  const [quizData, setQuizData] = useState<{
    quizzes: Quiz[];
    results: QuizResult[];
    cheatingAttempts: Record<string, CheatAttempt[]>;
    teacherNames: Record<string, string>; // Add teacher names mapping
  } | null>(null);

  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [selectedResult, setSelectedResult] = useState<QuizResult | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Fetch parent's children
  useEffect(() => {
    if (!user || user.role !== "parent" || !user.schoolId || !user.userId)
      return;

    const fetchChildren = async () => {
      try {
        // Get the parent document to access childrenIds
        const parentDoc = await getDoc(
          doc(
            db,
            "schools",
            user.schoolId as string,
            "users",
            user.userId as string
          )
        );
        if (!parentDoc.exists()) {
          console.error("Parent document not found");
          return;
        }

        const parentData = parentDoc.data();
        const childrenIds = parentData.childrenIds || [];
        const childrenList: Child[] = [];

        // Fetch details for each child
        for (const childId of childrenIds) {
          const childDoc = await getDoc(
            doc(db, "schools", user.schoolId as string, "users", childId)
          );
          if (childDoc.exists() && childDoc.data().role === "student") {
            const childData = childDoc.data();

            // Get class name if available
            let className = "";
            if (childData.homeroomClassId) {
              const classDoc = await getDoc(
                doc(
                  db,
                  "schools",
                  user.schoolId as string,
                  "classes",
                  childData.homeroomClassId
                )
              );
              if (classDoc.exists()) {
                className = classDoc.data().name || "";
              }
            }

            childrenList.push({
              id: childId,
              name: `${childData.firstName} ${childData.lastName}`,
              classId: childData.homeroomClassId,
              className: className,
            });
          }
        }

        setChildren(childrenList);
        if (childrenList.length > 0) {
          setSelectedChildId(childrenList[0].id);
        }
      } catch (error) {
        console.error("Failed to fetch children:", error);
        setError("Failed to load children information.");
      }
    };

    fetchChildren();
  }, [user]);

  // Fetch quizzes for selected child
  useEffect(() => {
    if (!user || !selectedChildId) return;

    const fetchQuizzes = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Get quiz results for the selected child
        const data = await getChildQuizResults(user.schoolId, selectedChildId);

        // Create a mapping of quiz IDs to cheating attempts
        const cheatingAttempts: Record<string, CheatAttempt[]> = {};
        // Create a mapping of teacher IDs to names
        const teacherNames: Record<string, string> = {};

        // Fetch teacher information for each quiz
        for (const quiz of data.quizzes) {
          if (quiz.teacherId && !teacherNames[quiz.teacherId]) {
            try {
              const teacherDoc = await getDoc(
                doc(
                  db,
                  "schools",
                  user.schoolId as string,
                  "users",
                  quiz.teacherId
                )
              );
              if (teacherDoc.exists()) {
                const teacherData = teacherDoc.data();
                teacherNames[
                  quiz.teacherId
                ] = `${teacherData.firstName} ${teacherData.lastName}`;
              } else {
                teacherNames[quiz.teacherId] = "Неизвестен учител";
              }
            } catch (err) {
              console.error(
                `Error fetching teacher for quiz ${quiz.quizId}:`,
                err
              );
              teacherNames[quiz.teacherId] = "Неизвестен учител";
            }
          }
        }

        // Fetch cheating attempts for each quiz with results
        for (const result of data.results) {
          try {
            const attempts = await getChildCheatingAttempts(
              user.schoolId,
              result.quizId,
              selectedChildId
            );
            if (attempts.length > 0) {
              cheatingAttempts[result.quizId] = attempts;
            }
          } catch (err) {
            console.error(
              `Error fetching cheating attempts for quiz ${result.quizId}:`,
              err
            );
          }
        }

        setQuizData({
          ...data,
          cheatingAttempts,
          teacherNames,
        });
      } catch (error) {
        console.error("Error fetching quizzes:", error);
        setError("Failed to load quizzes. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    if (selectedChildId) {
      fetchQuizzes();
    }
  }, [user, selectedChildId]);

  // Create categorized quiz lists
  const getQuizzesByCategory = () => {
    if (!quizData) {
      return {
        all: [] as Quiz[],
        completed: [] as Quiz[],
        pending: [] as Quiz[],
        missed: [] as Quiz[],
      };
    }

    const { quizzes, results } = quizData;
    const now = new Date();

    // Map results by quiz ID for easier lookup
    const resultsByQuizId: Record<string, QuizResult> = {};
    results.forEach((result) => {
      resultsByQuizId[result.quizId] = result;
    });

    const all = [...quizzes];

    // Completed quizzes (has a result and is completed)
    const completed = quizzes.filter((quiz) => {
      const result = resultsByQuizId[quiz.quizId];
      return result && result.completed;
    });

    // Pending quizzes (available but not taken yet)
    const pending = quizzes.filter((quiz) => {
      const result = resultsByQuizId[quiz.quizId];

      // Not taken yet and still available
      const isAvailable =
        (!quiz.availableFrom ||
          new Date(quiz.availableFrom.seconds * 1000) <= now) &&
        (!quiz.availableTo || new Date(quiz.availableTo.seconds * 1000) >= now);

      return !result && isAvailable;
    });

    // Missed quizzes (not taken and past availability)
    const missed = quizzes.filter((quiz) => {
      const result = resultsByQuizId[quiz.quizId];

      // Not taken and past availability
      const isPastDeadline =
        quiz.availableTo && new Date(quiz.availableTo.seconds * 1000) < now;

      return !result && isPastDeadline;
    });

    return {
      all,
      completed,
      pending,
      missed,
    };
  };

  const quizzesByCategory = getQuizzesByCategory();

  // Calculate performance statistics
  const calculateStats = () => {
    if (!quizData) return null;

    const { quizzes, results } = quizData;
    const completedResults = results.filter((r) => r.completed);

    const totalQuizzes = quizzes.length;
    const completedQuizzes = completedResults.length;
    const pendingQuizzes = quizzesByCategory.pending.length;
    const missedQuizzes = quizzesByCategory.missed.length;

    // Calculate average score percentage
    let totalScorePercentage = 0;
    let highestScore = 0;
    let lowestScore = 100;

    completedResults.forEach((result) => {
      const percentage = Math.round((result.score / result.totalPoints) * 100);
      totalScorePercentage += percentage;
      highestScore = Math.max(highestScore, percentage);
      lowestScore =
        completedResults.length > 0 ? Math.min(lowestScore, percentage) : 0;
    });

    const averageScore =
      completedResults.length > 0
        ? Math.round(totalScorePercentage / completedResults.length)
        : 0;

    // Calculate total time spent on quizzes
    const totalTimeSpent = completedResults.reduce(
      (total, result) => total + (result.totalTimeSpent || 0),
      0
    );

    // Count quizzes with cheating attempts
    const quizzesWithCheatingAttempts = Object.keys(
      quizData.cheatingAttempts
    ).length;

    return {
      totalQuizzes,
      completedQuizzes,
      pendingQuizzes,
      missedQuizzes,
      averageScore,
      highestScore,
      lowestScore,
      totalTimeSpent,
      quizzesWithCheatingAttempts,
    };
  };

  const stats = calculateStats();

  // Function to show quiz details
  const showQuizDetails = (quiz: Quiz, result?: QuizResult) => {
    setSelectedQuiz(quiz);
    setSelectedResult(result || null);
    setIsDetailsOpen(true);
  };

  // Find a result for a quiz
  const findResultForQuiz = (quizId: string): QuizResult | undefined => {
    if (!quizData) return undefined;
    return quizData.results.find((r) => r.quizId === quizId);
  };

  // Get cheating attempts for a quiz
  const getCheatingAttemptsForQuiz = (quizId: string): CheatAttempt[] => {
    if (!quizData || !quizData.cheatingAttempts[quizId]) return [];
    return quizData.cheatingAttempts[quizId];
  };

  if (!user || user.role !== "parent") {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex-1 p-8 bg-gray-50 flex items-center justify-center">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <h3 className="text-lg font-medium">Достъп отказан</h3>
                <p className="text-gray-500 mt-2">
                  Само родители могат да достъпват тази страница.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const filteredQuizzes = quizzesByCategory[activeTab];
  const selectedChild = children.find((child) => child.id === selectedChildId);

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Sidebar />
      <div className="flex-1 p-4 md:p-8 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-2 text-gray-800">
            Тестове на детето
          </h1>
          <p className="text-gray-600 mb-6">
            Преглед на тестовете и резултатите на вашето дете
          </p>

          {/* Child selector */}
          {children.length > 0 ? (
            <div className="mb-6">
              <label
                htmlFor="childSelect"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Изберете дете
              </label>
              <Select
                value={selectedChildId || ""}
                onValueChange={(value) => setSelectedChildId(value)}
              >
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue placeholder="Изберете дете" />
                </SelectTrigger>
                <SelectContent>
                  {children.map((child) => (
                    <SelectItem key={child.id} value={child.id}>
                      {child.name}{" "}
                      {child.className ? `(${child.className})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-yellow-700">
                Не са намерени деца към вашия акаунт.
              </p>
            </div>
          )}

          {!selectedChildId ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-800">
                Моля, изберете дете
              </h3>
              <p className="text-gray-500 mt-2">
                Изберете дете от падащото меню, за да видите неговите тестове.
              </p>
            </div>
          ) : isLoading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Зареждане на тестовете...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-2" />
              <p className="text-red-500">{error}</p>
            </div>
          ) : quizData && stats ? (
            <>
              {/* Performance Statistics */}
              <Card className="bg-white mb-6">
                <CardHeader>
                  <CardTitle>Обобщена статистика</CardTitle>
                  <CardDescription>
                    Преглед на представянето на {selectedChild?.name} на тестове
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Quizzes summary */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium text-gray-700">
                        Тестове
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-3 rounded-md">
                          <p className="text-xs text-gray-500">Общо</p>
                          <p className="text-2xl font-semibold">
                            {stats.totalQuizzes}
                          </p>
                        </div>
                        <div className="bg-green-50 p-3 rounded-md">
                          <p className="text-xs text-gray-500">Направени</p>
                          <p className="text-2xl font-semibold text-green-700">
                            {stats.completedQuizzes}
                          </p>
                        </div>
                        <div className="bg-amber-50 p-3 rounded-md">
                          <p className="text-xs text-gray-500">Очакващи</p>
                          <p className="text-2xl font-semibold text-amber-700">
                            {stats.pendingQuizzes}
                          </p>
                        </div>
                        <div className="bg-red-50 p-3 rounded-md">
                          <p className="text-xs text-gray-500">Пропуснати</p>
                          <p className="text-2xl font-semibold text-red-700">
                            {stats.missedQuizzes}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Performance summary */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium text-gray-700">
                        Резултати
                      </h3>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <p className="text-sm text-gray-500 flex items-center">
                            <Percent className="h-4 w-4 mr-1" />
                            Среден резултат
                          </p>
                          <p
                            className={`text-lg font-semibold ${getScoreColor(
                              stats.averageScore
                            )}`}
                          >
                            {stats.averageScore}%
                          </p>
                        </div>

                        <div className="flex justify-between items-center">
                          <p className="text-sm text-gray-500 flex items-center">
                            <PieChart className="h-4 w-4 mr-1" />
                            Най-висок резултат
                          </p>
                          <p
                            className={`text-lg font-semibold ${getScoreColor(
                              stats.highestScore
                            )}`}
                          >
                            {stats.highestScore}%
                          </p>
                        </div>

                        <div className="flex justify-between items-center">
                          <p className="text-sm text-gray-500 flex items-center">
                            <XCircle className="h-4 w-4 mr-1" />
                            Най-нисък резултат
                          </p>
                          <p
                            className={`text-lg font-semibold ${getScoreColor(
                              stats.lowestScore
                            )}`}
                          >
                            {stats.lowestScore}%
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Time and security summary */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium text-gray-700">
                        Допълнителна информация
                      </h3>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <p className="text-sm text-gray-500 flex items-center">
                            <Timer className="h-4 w-4 mr-1" />
                            Общо прекарано време
                          </p>
                          <p className="text-lg font-semibold">
                            {formatTimeSpent(stats.totalTimeSpent)}
                          </p>
                        </div>

                        {stats.quizzesWithCheatingAttempts > 0 && (
                          <div className="flex justify-between items-center">
                            <p className="text-sm text-gray-500 flex items-center">
                              <AlertTriangle className="h-4 w-4 mr-1" />
                              Тестове с предупреждения
                            </p>
                            <p className="text-lg font-semibold text-amber-600">
                              {stats.quizzesWithCheatingAttempts}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quizzes Tabs */}
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle>Тестове за {selectedChild?.name}</CardTitle>
                  <CardDescription>
                    Преглед на всички тестове и резултати
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs
                    value={activeTab}
                    onValueChange={(value: string) =>
                      setActiveTab(value as TabType)
                    }
                    className="mb-4"
                  >
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="all">Всички</TabsTrigger>
                      <TabsTrigger value="completed">Направени</TabsTrigger>
                      <TabsTrigger value="pending">Очакващи</TabsTrigger>
                      <TabsTrigger value="missed">Пропуснати</TabsTrigger>
                    </TabsList>

                    <TabsContent value="all">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Заглавие</TableHead>
                            <TableHead>Учител</TableHead>
                            <TableHead>Време за изпълнение</TableHead>
                            <TableHead>Дата</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead>Резултат</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredQuizzes.length > 0 ? (
                            filteredQuizzes.map((quiz) => {
                              const result = findResultForQuiz(quiz.quizId);
                              const cheatingAttempts =
                                getCheatingAttemptsForQuiz(quiz.quizId);

                              return (
                                <TableRow key={quiz.quizId}>
                                  <TableCell className="font-medium">
                                    {quiz.title}
                                    {cheatingAttempts.length > 0 && (
                                      <Badge
                                        variant="outline"
                                        className="ml-2 bg-amber-50 text-amber-700 border-amber-200"
                                      >
                                        <AlertTriangle className="h-3 w-3 mr-1" />{" "}
                                        Предупреждения
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {quizData?.teacherNames[quiz.teacherId] ||
                                      "Учител"}
                                  </TableCell>
                                  <TableCell>
                                    {quiz.timeLimit
                                      ? `${quiz.timeLimit} минути`
                                      : "Неограничено"}
                                  </TableCell>
                                  <TableCell>
                                    {formatQuizDate(result)}
                                  </TableCell>
                                  <TableCell>
                                    {getStatusBadge(quiz, result)}
                                  </TableCell>
                                  <TableCell>
                                    {result && result.completed ? (
                                      <span
                                        className={getScoreColor(
                                          Math.round(
                                            (result.score /
                                              result.totalPoints) *
                                              100
                                          )
                                        )}
                                      >
                                        {result.score} / {result.totalPoints}
                                      </span>
                                    ) : (
                                      <span className="text-gray-500">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        showQuizDetails(quiz, result)
                                      }
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          ) : (
                            <TableRow>
                              <TableCell
                                colSpan={7}
                                className="text-center py-4"
                              >
                                Не са намерени тестове в тази категория
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>

                    <TabsContent value="completed">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Заглавие</TableHead>
                            <TableHead>Учител</TableHead>
                            <TableHead>Време за изпълнение</TableHead>
                            <TableHead>Дата</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead>Резултат</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredQuizzes.length > 0 ? (
                            filteredQuizzes.map((quiz) => {
                              const result = findResultForQuiz(quiz.quizId);
                              const cheatingAttempts =
                                getCheatingAttemptsForQuiz(quiz.quizId);

                              return (
                                <TableRow key={quiz.quizId}>
                                  <TableCell className="font-medium">
                                    {quiz.title}
                                    {cheatingAttempts.length > 0 && (
                                      <Badge
                                        variant="outline"
                                        className="ml-2 bg-amber-50 text-amber-700 border-amber-200"
                                      >
                                        <AlertTriangle className="h-3 w-3 mr-1" />{" "}
                                        Предупреждения
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {quizData?.teacherNames[quiz.teacherId] ||
                                      "Учител"}
                                  </TableCell>
                                  <TableCell>
                                    {quiz.timeLimit
                                      ? `${quiz.timeLimit} минути`
                                      : "Неограничено"}
                                  </TableCell>
                                  <TableCell>
                                    {formatQuizDate(result)}
                                  </TableCell>
                                  <TableCell>
                                    {getStatusBadge(quiz, result)}
                                  </TableCell>
                                  <TableCell>
                                    {result && result.completed ? (
                                      <span
                                        className={getScoreColor(
                                          Math.round(
                                            (result.score /
                                              result.totalPoints) *
                                              100
                                          )
                                        )}
                                      >
                                        {result.score} / {result.totalPoints}
                                      </span>
                                    ) : (
                                      <span className="text-gray-500">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        showQuizDetails(quiz, result)
                                      }
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          ) : (
                            <TableRow>
                              <TableCell
                                colSpan={7}
                                className="text-center py-4"
                              >
                                Не са намерени тестове в тази категория
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>

                    <TabsContent value="pending">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Заглавие</TableHead>
                            <TableHead>Учител</TableHead>
                            <TableHead>Време за изпълнение</TableHead>
                            <TableHead>Достъпност</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead>Резултат</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredQuizzes.length > 0 ? (
                            filteredQuizzes.map((quiz) => {
                              const result = findResultForQuiz(quiz.quizId);

                              return (
                                <TableRow key={quiz.quizId}>
                                  <TableCell className="font-medium">
                                    {quiz.title}
                                  </TableCell>
                                  <TableCell>
                                    {quizData?.teacherNames[quiz.teacherId] ||
                                      "Учител"}
                                  </TableCell>
                                  <TableCell>
                                    {quiz.timeLimit
                                      ? `${quiz.timeLimit} минути`
                                      : "Неограничено"}
                                  </TableCell>
                                  <TableCell>
                                    {formatAvailabilityTime(quiz)}
                                  </TableCell>
                                  <TableCell>
                                    {getStatusBadge(quiz, result)}
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-gray-500">-</span>
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        showQuizDetails(quiz, result)
                                      }
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          ) : (
                            <TableRow>
                              <TableCell
                                colSpan={7}
                                className="text-center py-4"
                              >
                                Не са намерени тестове в тази категория
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>

                    <TabsContent value="missed">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Заглавие</TableHead>
                            <TableHead>Учител</TableHead>
                            <TableHead>Време за изпълнение</TableHead>
                            <TableHead>Достъпност</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead>Резултат</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredQuizzes.length > 0 ? (
                            filteredQuizzes.map((quiz) => {
                              const result = findResultForQuiz(quiz.quizId);

                              return (
                                <TableRow key={quiz.quizId}>
                                  <TableCell className="font-medium">
                                    {quiz.title}
                                  </TableCell>
                                  <TableCell>
                                    {quizData?.teacherNames[quiz.teacherId] ||
                                      "Учител"}
                                  </TableCell>
                                  <TableCell>
                                    {quiz.timeLimit
                                      ? `${quiz.timeLimit} минути`
                                      : "Неограничено"}
                                  </TableCell>
                                  <TableCell>
                                    {formatAvailabilityTime(quiz)}
                                  </TableCell>
                                  <TableCell>
                                    {getStatusBadge(quiz, result)}
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-gray-500">-</span>
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        showQuizDetails(quiz, result)
                                      }
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          ) : (
                            <TableRow>
                              <TableCell
                                colSpan={7}
                                className="text-center py-4"
                              >
                                Не са намерени тестове в тази категория
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-800">
                Няма тестове за показване
              </h3>
              <p className="text-gray-500 mt-2">
                Не са намерени тестове за {selectedChild?.name}.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quiz Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedQuiz && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedQuiz.title}</DialogTitle>
                <DialogDescription className="pt-2">
                  Детайлен преглед на теста и резултатите
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Quiz Information */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Информация за теста:</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 text-gray-500 mr-1" />
                      <span className="text-gray-600">
                        Време за изпълнение:
                      </span>
                    </div>
                    <div>
                      {selectedQuiz.timeLimit
                        ? `${selectedQuiz.timeLimit} минути`
                        : "Неограничено"}
                    </div>

                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 text-gray-500 mr-1" />
                      <span className="text-gray-600">Достъпност:</span>
                    </div>
                    <div>{formatAvailabilityTime(selectedQuiz)}</div>

                    <div className="flex items-center">
                      <FileText className="h-4 w-4 text-gray-500 mr-1" />
                      <span className="text-gray-600">Въпроси:</span>
                    </div>
                    <div>{selectedQuiz.questions.length}</div>

                    <div className="flex items-center">
                      <PieChart className="h-4 w-4 text-gray-500 mr-1" />
                      <span className="text-gray-600">Максимални точки:</span>
                    </div>
                    <div>
                      {selectedQuiz.points ||
                        selectedQuiz.questions.reduce(
                          (sum, q) => sum + (q.points || 0),
                          0
                        )}
                    </div>

                    <div className="flex items-center">
                      <Users className="h-4 w-4 text-gray-500 mr-1" />
                      <span className="text-gray-600">Учител:</span>
                    </div>
                    <div>
                      {quizData?.teacherNames[selectedQuiz.teacherId] ||
                        "Неизвестен учител"}
                    </div>
                  </div>
                </div>

                {/* Quiz Description if available */}
                {selectedQuiz.description && (
                  <div>
                    <h3 className="text-sm font-medium mb-1">Описание:</h3>
                    <div className="text-sm p-3 bg-gray-50 rounded-md">
                      {selectedQuiz.description}
                    </div>
                  </div>
                )}

                {/* Quiz Result if available */}
                {selectedResult ? (
                  <div className="space-y-3">
                    <div className="border-t pt-3">
                      <h3 className="text-sm font-medium mb-2">Резултат:</h3>
                      <div className="flex flex-col space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Статус:</span>
                          <div>
                            {getStatusBadge(selectedQuiz, selectedResult)}
                          </div>
                        </div>

                        {selectedResult.completed && (
                          <>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Точки:</span>
                              <span
                                className={getScoreColor(
                                  Math.round(
                                    (selectedResult.score /
                                      selectedResult.totalPoints) *
                                      100
                                  )
                                )}
                              >
                                {selectedResult.score} /{" "}
                                {selectedResult.totalPoints}
                              </span>
                            </div>

                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">
                                Процент верни отговори:
                              </span>
                              <span
                                className={getScoreColor(
                                  Math.round(
                                    (selectedResult.score /
                                      selectedResult.totalPoints) *
                                      100
                                  )
                                )}
                              >
                                {Math.round(
                                  (selectedResult.score /
                                    selectedResult.totalPoints) *
                                    100
                                )}
                                %
                              </span>
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600">
                                  Напредък по въпроси:
                                </span>
                                <span>
                                  {
                                    Object.keys(selectedResult.answers || {})
                                      .length
                                  }{" "}
                                  / {selectedQuiz.questions.length} въпроса
                                </span>
                              </div>
                              <Progress
                                value={Math.round(
                                  (Object.keys(selectedResult.answers || {})
                                    .length /
                                    selectedQuiz.questions.length) *
                                    100
                                )}
                                className="h-2"
                              />
                            </div>

                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">
                                Време за изпълнение:
                              </span>
                              <span>
                                {formatTimeSpent(selectedResult.totalTimeSpent)}
                              </span>
                            </div>

                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">
                                Дата на изпълнение:
                              </span>
                              <span>
                                {format(
                                  new Date(
                                    selectedResult.startedAt.seconds * 1000
                                  ),
                                  "dd.MM.yyyy HH:mm"
                                )}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Cheating attempts section */}
                    {selectedQuiz &&
                      quizData?.cheatingAttempts[selectedQuiz.quizId] &&
                      quizData?.cheatingAttempts[selectedQuiz.quizId].length >
                        0 && (
                        <div className="border-t pt-3">
                          <h3 className="text-sm font-medium mb-2 flex items-center text-amber-600">
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            Предупреждения при изпълнение:
                          </h3>
                          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 space-y-2">
                            <p className="text-sm text-amber-700">
                              По време на теста са отчетени следните
                              предупреждения за нередности:
                            </p>
                            <div className="max-h-40 overflow-y-auto pr-1 my-2">
                              <ul className="space-y-2">
                                {quizData.cheatingAttempts[
                                  selectedQuiz.quizId
                                ].map((attempt, index) => (
                                  <li
                                    key={index}
                                    className="text-sm flex items-start"
                                  >
                                    <div className="flex-shrink-0 mr-2 mt-0.5">
                                      {attempt.type === "tab_switch" && (
                                        <XCircle className="h-4 w-4 text-amber-600" />
                                      )}
                                      {attempt.type === "window_blur" && (
                                        <Clock className="h-4 w-4 text-amber-600" />
                                      )}
                                      {attempt.type === "copy_detected" && (
                                        <FileText className="h-4 w-4 text-amber-600" />
                                      )}
                                      {attempt.type === "browser_close" && (
                                        <AlertCircle className="h-4 w-4 text-amber-600" />
                                      )}
                                      {attempt.type === "multiple_devices" && (
                                        <Smartphone className="h-4 w-4 text-amber-600" />
                                      )}
                                      {attempt.type === "time_anomaly" && (
                                        <Timer className="h-4 w-4 text-amber-600" />
                                      )}
                                      {attempt.type === "quiz_abandoned" && (
                                        <XCircle className="h-4 w-4 text-amber-600" />
                                      )}
                                    </div>
                                    <div>
                                      <span className="text-amber-800 font-medium">
                                        {format(
                                          new Date(
                                            attempt.timestamp.seconds * 1000
                                          ),
                                          "dd.MM.yyyy HH:mm:ss"
                                        )}{" "}
                                        -
                                      </span>{" "}
                                      <span className="text-amber-700">
                                        {attempt.description}
                                      </span>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <p className="text-xs text-amber-600 italic mt-2">
                              Забележка: Предупрежденията са автоматично
                              генерирани от системата и могат да бъдат причинени
                              от технически проблеми или нормално поведение,
                              като например смяна на прозорци.
                            </p>
                          </div>
                        </div>
                      )}

                    {/* Security violations if any */}
                    {selectedResult.securityViolations &&
                      selectedResult.securityViolations > 0 &&
                      (!quizData?.cheatingAttempts[selectedQuiz.quizId] ||
                        quizData?.cheatingAttempts[selectedQuiz.quizId]
                          .length === 0) && (
                        <div className="border-t pt-3">
                          <h3 className="text-sm font-medium mb-2 flex items-center text-amber-600">
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            Предупреждения за сигурност:
                          </h3>
                          <p className="text-sm text-amber-600">
                            По време на изпълнението на теста са отбелязани{" "}
                            {selectedResult.securityViolations} предупреждения
                            (напр. смяна на прозорец, опит за копиране).
                          </p>
                        </div>
                      )}
                  </div>
                ) : (
                  <div className="border-t pt-3">
                    <p className="text-sm text-gray-500 italic">
                      Този тест все още не е изпълнен от {selectedChild?.name}.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
