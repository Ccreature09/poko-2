"use client";

/**
 * Teacher Quiz Review Page
 *
 * Advanced analytics dashboard for monitoring student assessment performance.
 * This page provides:
 *
 * Key features:
 * - Comprehensive quiz result analysis across all teacher-created assessments
 * - Student performance tracking with detailed submission metrics
 * - Cheating detection monitoring with incident reporting
 * - Statistical breakdowns of completion rates and scores
 * - Customizable filtering and sorting of submission data
 * - Individual submission inspection capabilities
 *
 * Data flow:
 * - Retrieves quiz data and associated submissions from database
 * - Correlates student information with assessment results
 * - Processes cheating detection data from assessment security monitoring
 * - Calculates performance metrics and statistical summaries
 *
 * This interface provides teachers with powerful analytical tools to review
 * student assessment performance, identify potential academic integrity issues,
 * and gain insights into overall assessment effectiveness and student mastery.
 */

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import type { Quiz, QuizResult, CheatAttempt } from "@/lib/interfaces";
import Sidebar from "@/components/functional/layout/Sidebar";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertCircle,
  Search,
  FileBarChart,
  AlertTriangle,
  Clock,
  Users,
  User,
} from "lucide-react";

interface QuizWithStats extends Quiz {
  totalSubmissions: number;
  averageScore: number;
  cheatingIncidents: number;
}

interface EnrichedQuizResult extends QuizResult {
  studentName: string;
  cheatingAttempts: CheatAttempt[];
  percentageScore: number;
}

export default function QuizReviews() {
  const { user } = useUser();
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<QuizWithStats[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<EnrichedQuizResult[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"score" | "date" | "cheating">("date");
  const [filter, setFilter] = useState<"all" | "cheating" | "low_score">("all");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    // Redirect non-teachers
    if (user && user.role !== "teacher") {
      router.push("/dashboard");
      return;
    }

    if (!user?.schoolId || user.role !== "teacher") {
      return;
    }

    const fetchQuizzes = async () => {
      try {
        console.debug(
          "[QuizReviews] Fetching quizzes for teacher:",
          user.userId
        );
        const schoolId = user.schoolId;
        const userId = user.userId || "";

        // Fetch quizzes created by this teacher
        const quizzesRef = collection(db, "schools", schoolId, "quizzes");
        const q = query(quizzesRef, where("teacherId", "==", userId));
        const quizzesSnapshot = await getDocs(q);

        const quizzesData = await Promise.all(
          quizzesSnapshot.docs.map(async (quizDoc) => {
            console.debug(`[QuizReviews] Processing quiz: ${quizDoc.id}`);
            const quizData = { ...quizDoc.data(), quizId: quizDoc.id } as Quiz;

            // Get quiz results for this quiz
            const resultsRef = collection(
              db,
              "schools",
              schoolId,
              "quizResults"
            );
            const resultsQuery = query(
              resultsRef,
              where("quizId", "==", quizDoc.id)
            );
            const resultsSnapshot = await getDocs(resultsQuery);
            const results = resultsSnapshot.docs.map(
              (doc) => doc.data() as QuizResult
            );

            // Calculate statistics
            const totalSubmissions = results.length;
            const totalScore = results.reduce(
              (sum, result) => sum + result.score,
              0
            );
            const averageScore =
              totalSubmissions > 0 ? totalScore / totalSubmissions : 0;

            // Count cheating incidents
            let cheatingIncidents = 0;
            const cheatingAttempts = quizData.cheatingAttempts || {};
            Object.values(cheatingAttempts).forEach((attempts) => {
              cheatingIncidents += attempts.length;
            });

            return {
              ...quizData,
              totalSubmissions,
              averageScore,
              cheatingIncidents,
            };
          })
        );

        setQuizzes(quizzesData);
        console.debug(`[QuizReviews] Loaded ${quizzesData.length} quizzes`);
      } catch (error) {
        console.error("[QuizReviews] Error fetching quizzes:", error);
      }
    };

    fetchQuizzes();
  }, [user, router]);

  useEffect(() => {
    if (!selectedQuiz || !user?.schoolId) return;

    const fetchSubmissionsAndStudents = async () => {
      try {
        console.debug(
          `[QuizReviews] Fetching submissions for quiz: ${selectedQuiz}`
        );
        const schoolId = user.schoolId;

        // Fetch quiz results for the selected quiz
        const resultsRef = collection(db, "schools", schoolId, "quizResults");
        const resultsQuery = query(
          resultsRef,
          where("quizId", "==", selectedQuiz)
        );
        const resultsSnapshot = await getDocs(resultsQuery);
        const results = resultsSnapshot.docs.map(
          (doc) => doc.data() as QuizResult
        );

        if (selectedQuiz) {
          const quizRef = doc(db, "schools", schoolId, "quizzes", selectedQuiz);
          const quizSnapshot = await getDoc(quizRef);
          const quizData = quizSnapshot.data() as Quiz;
          const cheatingAttempts = quizData?.cheatingAttempts || {};
          const studentIds = results.map((result) => result.userId);
          const uniqueStudentIds = [...new Set(studentIds)];

          const studentData: Record<
            string,
            { firstName: string; lastName: string }
          > = {};

          for (const studentId of uniqueStudentIds) {
            if (!user?.schoolId) continue; // Skip if schoolId is undefined
            const studentRef = doc(
              db,
              "schools",
              user.schoolId,
              "users",
              studentId
            );
            const studentSnapshot = await getDoc(studentRef);
            if (studentSnapshot.exists()) {
              const data = studentSnapshot.data();
              studentData[studentId] = {
                firstName: data?.firstName || "",
                lastName: data?.lastName || "",
              };
            }
          }

          // Log submission stats
          console.debug(
            `[QuizReviews] Found ${results.length} submissions, ${
              cheatingAttempts ? Object.keys(cheatingAttempts).length : 0
            } students with cheating attempts`
          );

          // Enrich quiz results with student names and cheating attempts
          const enrichedResults: EnrichedQuizResult[] = results.map(
            (result) => {
              const studentCheatingAttempts =
                cheatingAttempts[result.userId] || [];
              const student = studentData[result.userId] || {
                firstName: "Unknown",
                lastName: "Student",
              };
              const studentName = `${student.firstName} ${student.lastName}`;
              const percentageScore = (result.score / result.totalPoints) * 100;

              return {
                ...result,
                studentName,
                cheatingAttempts: studentCheatingAttempts,
                percentageScore,
              };
            }
          );

          setSubmissions(enrichedResults);
          console.debug(
            `[QuizReviews] Processed ${enrichedResults.length} submissions`
          );
        }

        // Fetch all student names
      } catch (error) {
        console.error("[QuizReviews] Error fetching submissions:", error);
      }
    };

    fetchSubmissionsAndStudents();
  }, [selectedQuiz, user?.schoolId, user]);

  // Log filter and sort operations
  const filteredSubmissions = submissions
    .filter((submission) => {
      // Log search and filter operations
      if (searchTerm || filter !== "all") {
        console.debug(
          `[QuizReviews] Filtering submissions - Search: "${searchTerm}", Filter: ${filter}`
        );
      }

      // Apply search term filter
      if (
        searchTerm &&
        !submission.studentName.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }

      // Apply category filter
      switch (filter) {
        case "cheating":
          return submission.cheatingAttempts.length > 0;
        case "low_score":
          return submission.percentageScore < 60; // Under 60% is considered low
        default:
          return true;
      }
    })
    .sort((a, b) => {
      console.debug(`[QuizReviews] Sorting submissions by: ${sortBy}`);
      // Apply sorting
      switch (sortBy) {
        case "score":
          return b.percentageScore - a.percentageScore;
        case "cheating":
          return b.cheatingAttempts.length - a.cheatingAttempts.length;
        case "date":
        default:
          return b.timestamp.toMillis() - a.timestamp.toMillis();
      }
    });

  const getScoreColor = (score: number): string => {
    if (score >= 90) return "text-green-600";
    if (score >= 75) return "text-emerald-600";
    if (score >= 60) return "text-amber-600";
    return "text-red-600";
  };

  if (!user || user.role !== "teacher") {
    return null; // Or a redirect/access denied message
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 p-4 sm:p-8 overflow-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-gray-800">
          Преглед на тестове
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8">
          Преглед на резултатите и статистиките от тестовете
        </p>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4 sm:space-y-6"
        >
          <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-6">
            <TabsTrigger value="overview">Общ преглед</TabsTrigger>
            <TabsTrigger value="submissions">
              Индивидуални резултати
            </TabsTrigger>
          </TabsList>{" "}
          <TabsContent value="overview" className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              <Card>
                <CardHeader className="py-3 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">
                    Общ брой тестове
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 sm:pt-2">
                  <div className="text-xl sm:text-2xl font-bold">
                    {quizzes.length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">
                    Общ брой предадени тестове
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 sm:pt-2">
                  <div className="text-xl sm:text-2xl font-bold">
                    {quizzes.reduce(
                      (sum, quiz) => sum + quiz.totalSubmissions,
                      0
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="sm:col-span-2 md:col-span-1">
                <CardHeader className="py-3 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">
                    Опити за измама
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 sm:pt-2">
                  <div className="text-xl sm:text-2xl font-bold text-amber-500">
                    {quizzes.reduce(
                      (sum, quiz) => sum + quiz.cheatingIncidents,
                      0
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>{" "}
            <h2 className="text-lg sm:text-xl font-semibold mt-4 sm:mt-6 mb-3">
              Вашите тестове
            </h2>
            {quizzes.length === 0 ? (
              <div className="text-center p-6 sm:p-12 border rounded-lg bg-muted/10">
                <p className="text-sm sm:text-base text-muted-foreground">
                  Нямате създадени тестове все още
                </p>
                <Button
                  className="mt-4 text-white"
                  onClick={() => router.push("/teacher/quizzes/create")}
                >
                  Създаване на нов тест
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {quizzes.map((quiz) => (
                  <Card
                    key={quiz.quizId}
                    className="hover:shadow-md transition-shadow"
                  >
                    <CardHeader className="p-4 sm:p-6">
                      <CardTitle className="text-base sm:text-lg line-clamp-1">
                        {quiz.title}
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-sm line-clamp-2">
                        {quiz.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                      <div className="space-y-2 text-xs sm:text-sm">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            Предадени:
                          </span>
                          <span>{quiz.totalSubmissions}</span>
                        </div>

                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground flex items-center">
                            <FileBarChart className="h-4 w-4 mr-1" />
                            Среден резултат:
                          </span>
                          <span className={getScoreColor(quiz.averageScore)}>
                            {quiz.averageScore.toFixed(2)} / {quiz.points}
                          </span>
                        </div>

                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground flex items-center">
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            Подозрителни действия:
                          </span>
                          <span
                            className={
                              quiz.cheatingIncidents > 0
                                ? "text-amber-500 font-medium"
                                : ""
                            }
                          >
                            {quiz.cheatingIncidents}
                          </span>
                        </div>

                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            Създаден:
                          </span>
                          <span>
                            {quiz.createdAt &&
                              format(quiz.createdAt.toDate(), "dd.MM.yyyy")}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setSelectedQuiz(quiz.quizId);
                          setActiveTab("submissions");
                        }}
                      >
                        Виж резултатите
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="submissions">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle className="text-base sm:text-lg">
                      Резултати от тестове
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      Преглед на индивидуални резултати и статистики
                    </CardDescription>
                  </div>

                  <Select
                    value={selectedQuiz || ""}
                    onValueChange={(value) => setSelectedQuiz(value)}
                  >
                    <SelectTrigger className="w-full md:w-[220px] text-sm">
                      <SelectValue placeholder="Изберете тест" />
                    </SelectTrigger>
                    <SelectContent>
                      {quizzes.map((quiz) => (
                        <SelectItem key={quiz.quizId} value={quiz.quizId}>
                          {quiz.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>

              <CardContent>
                {selectedQuiz ? (
                  <>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                      <div className="flex items-center w-full md:w-auto relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Търсене по име..."
                          className="pl-8 w-full md:w-[300px] text-sm"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center w-full md:w-auto">
                        <Select
                          value={sortBy}
                          onValueChange={(
                            value: "score" | "date" | "cheating"
                          ) => setSortBy(value)}
                        >
                          <SelectTrigger className="w-full sm:w-[180px] text-sm">
                            <SelectValue placeholder="Сортиране по" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="date">
                              Последно предадени
                            </SelectItem>
                            <SelectItem value="score">Резултат</SelectItem>
                            <SelectItem value="cheating">
                              Подозрителни действия
                            </SelectItem>
                          </SelectContent>
                        </Select>

                        <Select
                          value={filter}
                          onValueChange={(
                            value: "all" | "cheating" | "low_score"
                          ) => setFilter(value)}
                        >
                          <SelectTrigger className="w-full sm:w-[180px] text-sm">
                            <SelectValue placeholder="Филтриране" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">
                              Всички резултати
                            </SelectItem>
                            <SelectItem value="cheating">
                              Само с измами
                            </SelectItem>
                            <SelectItem value="low_score">
                              Ниски резултати
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {filteredSubmissions.length === 0 ? (
                      <div className="text-center py-6 sm:py-12">
                        <p className="text-muted-foreground text-sm">
                          {submissions.length === 0
                            ? "Няма предадени тестове все още"
                            : "Няма намерени резултати, отговарящи на филтъра"}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-md border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="whitespace-nowrap">
                                Ученик
                              </TableHead>
                              <TableHead className="whitespace-nowrap">
                                Дата на предаване
                              </TableHead>
                              <TableHead className="whitespace-nowrap">
                                Резултат
                              </TableHead>
                              <TableHead className="whitespace-nowrap">
                                Подозрителни действия
                              </TableHead>
                              <TableHead className="text-right whitespace-nowrap">
                                Действия
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredSubmissions.map((submission) => (
                              <TableRow
                                key={`${
                                  submission.userId
                                }-${submission.timestamp.toMillis()}`}
                              >
                                <TableCell className="flex items-center gap-2 font-medium text-xs sm:text-sm">
                                  <User className="h-3 w-3 sm:h-4 sm:w-4" />
                                  {submission.studentName}
                                </TableCell>
                                <TableCell className="text-xs sm:text-sm">
                                  {format(
                                    submission.timestamp.toDate(),
                                    "dd.MM.yyyy HH:mm"
                                  )}
                                  <div className="text-xs text-muted-foreground hidden sm:block">
                                    {formatDistanceToNow(
                                      submission.timestamp.toDate(),
                                      { addSuffix: true }
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs sm:text-sm">
                                  <span
                                    className={getScoreColor(
                                      submission.percentageScore
                                    )}
                                  >
                                    {submission.score} /{" "}
                                    {submission.totalPoints}{" "}
                                    <span className="text-xs">
                                      ({submission.percentageScore.toFixed(1)}%)
                                    </span>
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {submission.cheatingAttempts.length > 0 ? (
                                    <Badge
                                      variant="outline"
                                      className="bg-amber-50 text-amber-700 hover:bg-amber-50 text-xs"
                                    >
                                      <AlertCircle className="h-3 w-3 mr-1" />
                                      {submission.cheatingAttempts.length}{" "}
                                      открити
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-xs sm:text-sm">
                                      Няма
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Link
                                    href={`/teacher/quiz-reviews/${selectedQuiz}/student/${submission.userId}`}
                                    className="text-xs sm:text-sm text-blue-600 hover:underline"
                                  >
                                    Детайли
                                  </Link>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6 sm:py-12">
                    <p className="text-muted-foreground text-sm">
                      Моля изберете тест за преглед на резултатите
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
