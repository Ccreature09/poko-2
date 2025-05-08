"use client";

/**
 * Student Quizzes Page
 *
 * Interactive interface for students to access and manage their academic quizzes.
 * This page provides:
 *
 * Key features:
 * - Comprehensive list of all available and upcoming quizzes
 * - Real-time quiz availability status and deadline information
 * - Time-sensitive access controls based on quiz schedules
 * - Quiz attempt tracking and results access
 * - Security features for proctored quizzes
 *
 * Data flow:
 * - Retrieves quiz data from QuizContext
 * - Calculates quiz availability based on time windows and student attempt history
 * - Processes quiz metadata (points, questions, time limits)
 * - Manages access control based on quiz settings and student permissions
 *
 * The interface adapts dynamically to quiz status, showing appropriate actions
 * for upcoming, available, completed, or expired quizzes.
 */

import { useUser } from "@/contexts/UserContext";
import type { Quiz } from "@/lib/interfaces";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import Sidebar from "@/components/functional/layout/Sidebar";
import Link from "next/link";
import { useQuiz } from "@/contexts/QuizContext";
import { Calendar, Clock, Eye } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { isPast, isFuture, format } from "date-fns";
import { useRouter } from "next/navigation";

export default function StudentQuizzes() {
  const { user } = useUser();
  const router = useRouter();
  const { quizzes, isQuizAvailable, getRemainingAttempts } = useQuiz();
  const [quizzesWithMetadata, setQuizzesWithMetadata] = useState<
    (Quiz & { remainingAttempts: number; isAvailable: boolean })[]
  >([]);

  useEffect(() => {
    // Redirect teachers to teacher quizzes page
    if (user && user.role === "teacher") {
      router.push("/teacher/quizzes");
    }
  }, [user, router]);

  useEffect(() => {
    const loadQuizMetadata = async () => {
      const withMetadata = await Promise.all(
        quizzes.map(async (quiz) => {
          const remainingAttempts = await getRemainingAttempts(quiz);
          return {
            ...quiz,
            remainingAttempts,
            isAvailable: isQuizAvailable(quiz),
          };
        })
      );
      setQuizzesWithMetadata(withMetadata);
    };

    loadQuizMetadata();
  }, [quizzes, getRemainingAttempts, isQuizAvailable]);

  const calculateTotalPoints = (quiz: Quiz) => {
    return quiz.questions.reduce(
      (total, question) => total + (question.points || 0),
      0
    );
  };

  const formatAvailabilityTime = (quiz: Quiz) => {
    if (quiz.availableFrom && isFuture(quiz.availableFrom.toDate())) {
      return `Започва: ${format(
        quiz.availableFrom.toDate(),
        "dd.MM.yyyy HH:mm"
      )}`;
    }
    if (quiz.availableTo) {
      return `Краен срок: ${format(
        quiz.availableTo.toDate(),
        "dd.MM.yyyy HH:mm"
      )}`;
    }
    return "";
  };

  const getQuizAvailabilityStatus = (quiz: Quiz) => {
    if (quiz.availableFrom && isFuture(quiz.availableFrom.toDate())) {
      return "upcoming";
    }

    if (quiz.availableTo && isPast(quiz.availableTo.toDate())) {
      return "expired";
    }

    return quiz.isAvailable ? "available" : "unavailable";
  };

  if (!user || user.role === "teacher") return null;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-2">Моите тестове</h1>
        <p className="text-muted-foreground mb-8">
          Преглед на всички достъпни тестове и техния статус
        </p>

        {quizzesWithMetadata.length === 0 ? (
          <div className="text-center p-12 border rounded-lg bg-muted/20">
            <p className="text-muted-foreground">
              Няма налични тестове в момента
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quizzesWithMetadata.map((quiz) => {
              const availabilityStatus = getQuizAvailabilityStatus(quiz);
              const hasTakenQuiz =
                quiz.tookTest && quiz.tookTest.includes(user?.userId || "");

              // A quiz is available if it's in the available time window AND user hasn't taken it yet
              const canTakeQuiz = quiz.isAvailable;

              return (
                <div key={quiz.quizId} className="relative">
                  <Card
                    className={`transition-colors h-full ${
                      canTakeQuiz ? "hover:bg-muted/50" : ""
                    }`}
                  >
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle>{quiz.title}</CardTitle>
                      </div>
                      <CardDescription>{quiz.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">
                            {quiz.questions.length} въпроси
                          </span>
                          <span className="font-medium">
                            {calculateTotalPoints(quiz)} точки
                          </span>
                        </div>

                        {quiz.timeLimit && (
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Clock className="h-4 w-4 mr-1" />
                            <span>{quiz.timeLimit} минути</span>
                          </div>
                        )}

                        {(quiz.availableFrom || quiz.availableTo) && (
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4 mr-1" />
                            <span>{formatAvailabilityTime(quiz)}</span>
                          </div>
                        )}

                        {quiz.proctored && (
                          <div className="flex items-center text-sm text-amber-500">
                            <Eye className="h-4 w-4 mr-1" />
                            <span>Наблюдаван тест</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter>
                      <div className="flex gap-2 w-full">
                        {hasTakenQuiz ? (
                          <div className="w-full">
                            <Button
                              variant="outline"
                              className="w-full"
                              asChild
                            >
                              <Link
                                href={`/student/quizzes/results/${quiz.quizId}`}
                              >
                                Виж резултат
                              </Link>
                            </Button>
                          </div>
                        ) : (
                          <>
                            {availabilityStatus === "available" ? (
                              <Button
                                variant={"outline"}
                                className="w-full"
                                asChild
                              >
                                <Link href={`/student/quizzes/${quiz.quizId}`}>
                                  Започни теста
                                </Link>
                              </Button>
                            ) : (
                              <Button disabled className="w-full">
                                {availabilityStatus === "upcoming"
                                  ? "Предстои"
                                  : availabilityStatus === "expired"
                                  ? "Изтекъл"
                                  : "Неактивен"}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </CardFooter>
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
