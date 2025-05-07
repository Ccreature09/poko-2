"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { Quiz, QuizResult, Question, CheatAttempt } from "@/lib/interfaces";
import Sidebar from "@/components/functional/layout/Sidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowLeft,
  HelpCircle,
} from "lucide-react";
import { formatTimeSpent } from "@/lib/utils";
import { format } from "date-fns";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Skeleton } from "@/components/ui/skeleton";

// Extend the QuizResult type to include optional cheatingAttempts
interface ExtendedQuizResult extends QuizResult {
  cheatingAttempts?: CheatAttempt[];
}

export default function QuizResultPage() {
  const { user } = useUser();
  const router = useRouter();
  const params = useParams();
  const quizId = params?.quizId as string;

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [quizResult, setQuizResult] = useState<ExtendedQuizResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !quizId) return;

    async function fetchQuizAndResult() {
      try {
        setLoading(true);

        // 1. Fetch the quiz data
        const quizRef = doc(
          db,
          "schools",
          user?.schoolId || "",
          "quizzes",
          quizId
        );
        const quizSnapshot = await getDoc(quizRef);

        if (!quizSnapshot.exists()) {
          setError("Тест не е намерен");
          setLoading(false);
          return;
        }

        const quizData = { ...quizSnapshot.data(), quizId } as Quiz;
        setQuiz(quizData);

        // 2. Fetch the quiz result for this student
        const resultsRef = collection(
          db,
          "schools",
          user?.schoolId || "",
          "quizResults"
        );
        const resultsQuery = query(
          resultsRef,
          where("quizId", "==", quizId),
          where("userId", "==", user?.userId || ""),
          where("completed", "==", true)
        );

        const resultsSnapshot = await getDocs(resultsQuery);
        if (resultsSnapshot.empty) {
          setError("Не са намерени резултати за този тест");
          setLoading(false);
          return;
        }

        // If there are multiple results, get the most recent one
        if (resultsSnapshot.docs.length > 1) {
          console.debug(
            `[QuizResult] Found ${resultsSnapshot.docs.length} results, using the most recent one`
          );
          const sortedResults = resultsSnapshot.docs
            .map((doc) => doc.data() as ExtendedQuizResult)
            .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
          setQuizResult(sortedResults[0]);
        } else {
          setQuizResult(resultsSnapshot.docs[0].data() as ExtendedQuizResult);
        }

        setLoading(false);
      } catch (err) {
        console.error("[QuizResult] Error fetching quiz result:", err);
        setError("Възникна грешка при зареждане на резултатите");
        setLoading(false);
      }
    }

    fetchQuizAndResult();
  }, [user, quizId]);

  // Check if an answer is correct
  const isAnswerCorrect = (
    question: Question,
    userAnswer: string | string[]
  ) => {
    if (!question.correctAnswer) return null;

    switch (question.type) {
      case "singleChoice":
        return question.correctAnswer === userAnswer;

      case "trueFalse":
        return question.correctAnswer === userAnswer;

      case "multipleChoice":
        if (
          !Array.isArray(userAnswer) ||
          !Array.isArray(question.correctAnswer)
        ) {
          return false;
        }

        // Check if the arrays have the same length and contain the same elements
        if (userAnswer.length !== question.correctAnswer.length) {
          return false;
        }

        // Sort both arrays to make comparison easier
        const sortedUserAnswer = [...userAnswer].sort();
        const sortedCorrectAnswer = [...question.correctAnswer].sort();

        return sortedUserAnswer.every(
          (value, index) => value === sortedCorrectAnswer[index]
        );

      case "openEnded":
        // Open-ended questions need manual review
        return null;

      default:
        return false;
    }
  };

  // Calculate points earned for a question
  const getPointsEarned = (
    question: Question,
    userAnswer: string | string[]
  ) => {
    if (!question.correctAnswer || !userAnswer) return 0;

    const isCorrect = isAnswerCorrect(question, userAnswer);
    if (isCorrect === true) {
      return question.points || 0;
    } else if (isCorrect === false) {
      return 0;
    } else {
      // For manual review (null result), show pending
      return "?";
    }
  };

  // Get the answer display text
  const getAnswerDisplay = (question: Question, answer: string | string[]) => {
    if (!answer) return "-";

    switch (question.type) {
      case "trueFalse":
        return answer === "true" ? "Вярно" : "Невярно";

      case "singleChoice": {
        // Find the choice text for the selected answer
        const choiceIndex = parseInt(answer as string, 10);
        return question.choices && question.choices[choiceIndex]
          ? question.choices[choiceIndex].text
          : String(answer);
      }

      case "multipleChoice": {
        if (!Array.isArray(answer) || !question.choices) return String(answer);

        // Join all selected choices
        return answer
          .map((choice) => {
            const choiceIndex = parseInt(choice, 10);
            return question.choices && question.choices[choiceIndex]
              ? question.choices[choiceIndex].text
              : choice;
          })
          .join(", ");
      }

      case "openEnded":
        return answer as string;

      default:
        return String(answer);
    }
  };

  // Get correct answer display
  const getCorrectAnswerDisplay = (question: Question) => {
    if (!question.correctAnswer) return "-";

    switch (question.type) {
      case "trueFalse":
        return question.correctAnswer === "true" ? "Вярно" : "Невярно";

      case "singleChoice": {
        const choiceIndex = parseInt(question.correctAnswer as string, 10);
        return question.choices && question.choices[choiceIndex]
          ? question.choices[choiceIndex].text
          : String(question.correctAnswer);
      }

      case "multipleChoice": {
        if (!Array.isArray(question.correctAnswer) || !question.choices)
          return String(question.correctAnswer);

        return question.correctAnswer
          .map((choice) => {
            const choiceIndex = parseInt(choice, 10);
            return question.choices && question.choices[choiceIndex]
              ? question.choices[choiceIndex].text
              : choice;
          })
          .join(", ");
      }

      case "openEnded":
        return "Въпрос с отворен отговор";

      default:
        return String(question.correctAnswer);
    }
  };

  if (!user) {
    router.push("/login");
    return null;
  }

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 p-8">
          <div className="flex items-center mb-8">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад
            </Button>
            <h1 className="text-3xl font-bold">Зареждане на резултат...</h1>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-1/4" />
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-6 w-5/6" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 p-8">
          <div className="flex items-center mb-8">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад
            </Button>
            <h1 className="text-3xl font-bold">Грешка</h1>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                <h2 className="text-2xl font-semibold mb-2">
                  Не можем да заредим резултата
                </h2>
                <p className="text-muted-foreground mb-6">{error}</p>
                <Button onClick={() => router.back()}>
                  Назад към тестовете
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!quiz || !quizResult) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 p-8">
          <div className="flex items-center mb-8">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад
            </Button>
            <h1 className="text-3xl font-bold">Няма информация</h1>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <HelpCircle className="h-12 w-12 text-amber-500 mb-4" />
                <h2 className="text-2xl font-semibold mb-2">
                  Няма намерен резултат
                </h2>
                <p className="text-muted-foreground mb-6">
                  Не можем да открием информация за този тест
                </p>
                <Button
                  className="text-white"
                  onClick={() => router.push("/student/quizzes")}
                >
                  Към всички тестове
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Calculate percentage score
  const percentage =
    Math.round((quizResult.score / quizResult.totalPoints) * 100) || 0;

  // Get all questions from the quiz
  const questions = quiz.questions || [];

  // Get answers from the result
  const answers = quizResult.answers || {};

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto pb-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div className="flex items-center">
            <Button
              variant="ghost"
              onClick={() => router.push("/student/quizzes")}
              className="mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{quiz.title}</h1>
              <p className="text-muted-foreground">Резултати от теста</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              className="text-white"
              onClick={() => router.push(`/student/quizzes`)}
            >
              Към всички тестове
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Score Card */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Резултат</CardTitle>
              <CardDescription>Вашето представяне на теста</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div className="flex-1">
                  <div className="text-center p-6 bg-muted/50 rounded-lg">
                    <div className="text-4xl font-bold mb-2">
                      {quizResult.score} / {quizResult.totalPoints}
                    </div>
                    <div className="text-muted-foreground">точки</div>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-center p-6 bg-muted/50 rounded-lg">
                    <div className="text-4xl font-bold mb-2">{percentage}%</div>
                    <div className="text-muted-foreground">процент верни</div>
                  </div>
                </div>

                <div className="flex-1">
                  <div className="text-center p-6 bg-muted/50 rounded-lg">
                    <div className="text-4xl font-bold mb-2">
                      {formatTimeSpent(quizResult.totalTimeSpent || 0)}
                    </div>
                    <div className="text-muted-foreground">време</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>Информация</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Дата на изпълнение
                  </dt>
                  <dd className="text-base">
                    {quizResult.timestamp
                      ? format(
                          quizResult.timestamp.toDate(),
                          "dd.MM.yyyy HH:mm"
                        )
                      : "Неизвестна"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Статус
                  </dt>
                  <dd className="flex items-center mt-1">
                    <Badge className="text-white">Завършен</Badge>

                    {quizResult?.cheatingAttempts &&
                      quizResult.cheatingAttempts.length > 0 && (
                        <Badge
                          variant="outline"
                          className="ml-2 bg-amber-50 text-amber-700 border-amber-200"
                        >
                          <AlertCircle className="h-3 w-3 mr-1" /> Има
                          предупреждения
                        </Badge>
                      )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Въпроси
                  </dt>
                  <dd className="text-base">
                    {quiz.questions?.length || 0} въпроса
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        {/* Questions and Answers */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Преглед на въпросите</CardTitle>
            <CardDescription>
              Вашите отговори и верните отговори
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {questions.map((question, index) => {
                const userAnswer = answers[question.questionId];
                const isCorrect = isAnswerCorrect(
                  question,
                  userAnswer as string | string[]
                );
                const pointsEarned = getPointsEarned(
                  question,
                  userAnswer as string | string[]
                );

                return (
                  <div
                    key={question.questionId}
                    className="pb-6 border-b last:border-0"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-medium flex items-center">
                        <span className="mr-2">Въпрос {index + 1}:</span>
                        {isCorrect === true ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : isCorrect === false ? (
                          <XCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <HelpCircle className="h-5 w-5 text-amber-500" />
                        )}
                      </h3>
                      <span className="text-sm font-medium">
                        {typeof pointsEarned === "string"
                          ? "Проверява се"
                          : `${pointsEarned}/${question.points || 0} точки`}
                      </span>
                    </div>

                    <div className="mb-4">{question.text}</div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-md">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">
                          Вашият отговор:
                        </p>
                        <div className="p-3 bg-background rounded border">
                          {userAnswer
                            ? getAnswerDisplay(
                                question,
                                userAnswer as string | string[]
                              )
                            : "Без отговор"}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">
                          Верен отговор:
                        </p>
                        <div className="p-3 bg-background rounded border">
                          {getCorrectAnswerDisplay(question)}
                        </div>
                      </div>
                    </div>

                    {question.explanation && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-muted-foreground mb-2">
                          Обяснение:
                        </p>
                        <div className="p-3 bg-background rounded border">
                          {question.explanation}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
