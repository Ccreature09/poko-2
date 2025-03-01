"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { 
  collection, 
  doc, 
  getDoc,
  getDocs,
  query,
  where,
  Timestamp
} from "firebase/firestore";
import type { Quiz, QuizResult, CheatAttempt, Question } from "@/lib/interfaces";
import Sidebar from "@/components/functional/Sidebar";
import Link from "next/link";
import { format } from "date-fns";
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
import { Badge } from "@/components/ui/badge";
import { 
  AlertCircle,
  FileBarChart, 
  AlertTriangle, 
  Clock, 
  User,
  ArrowLeft,
  CheckCircle,
  XCircle
} from "lucide-react";
import { use } from "react";

interface CheatAttemptDetails extends CheatAttempt {
  typeLabel: string;
  severityColor: string;
}

interface PageParams {
  quizId: string;
  studentId: string;
}

export default function StudentQuizDetails({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { user } = useUser();
  const router = useRouter();
  const unwrappedParams = use(params);
  const { quizId, studentId } = unwrappedParams;
  
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [student, setStudent] = useState<{ firstName: string; lastName: string; } | null>(null);
  const [cheatingAttempts, setCheatingAttempts] = useState<CheatAttemptDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [questionsMap, setQuestionsMap] = useState<Record<string, Question>>({});

  useEffect(() => {
    if (!user || user.role !== "teacher" || !user.schoolId) {
      router.push("/quiz-reviews");
      return;
    }

    const schoolId = user.schoolId;

    async function fetchData() {
      try {
        console.debug(`[QuizReview] Зареждане на детайли за тест за ученик ${studentId}`);
        const quizRef = doc(db, "schools", schoolId, "quizzes", quizId);
        const quizSnapshot = await getDoc(quizRef);

        if (!quizSnapshot.exists()) {
          console.debug(`[QuizReview] Тест ${quizId} не е намерен`);
          router.push("/quiz-reviews");
          return;
        }

        const quizData = quizSnapshot.data() as Quiz;
        setQuiz(quizData);

        // Create a map of questions for easier access
        const questionsMap: Record<string, Question> = {};
        quizData.questions.forEach(q => {
          questionsMap[q.questionId] = q;
        });
        setQuestionsMap(questionsMap);
        console.debug(`[QuizReview] Заредени ${Object.keys(questionsMap).length} въпроса`);

        // Get student info
        const studentRef = doc(db, "schools", schoolId, "users", studentId);
        const studentSnapshot = await getDoc(studentRef);
        if (studentSnapshot.exists()) {
          const studentData = studentSnapshot.data();
          setStudent({
            firstName: studentData.firstName,
            lastName: studentData.lastName
          });
          console.debug(`[QuizReview] Заредена информация за ученик: ${studentData.firstName} ${studentData.lastName}`);
        }

        // Get quiz results
        const resultsRef = collection(db, "schools", schoolId, "quizResults");
        const resultsQuery = query(
          resultsRef,
          where("quizId", "==", quizId),
          where("userId", "==", studentId)
        );
        const resultsSnapshot = await getDocs(resultsQuery);

        let resultData: QuizResult;
        if (resultsSnapshot.docs.length > 1) {
          // If multiple results exist, use the most recent one
          const sortedResults = resultsSnapshot.docs
            .map(doc => doc.data() as QuizResult)
            .sort((a, b) => {
              return b.timestamp.toMillis() - a.timestamp.toMillis();
            });
          
          resultData = sortedResults[0];
          console.debug(`[QuizReview] Намерени ${sortedResults.length} резултата от теста, използван е последният`);
        } else {
          resultData = resultsSnapshot.docs[0].data() as QuizResult;
        }
        
        setQuizResult(resultData);
        console.debug(`[QuizReview] Резултат от теста: ${resultData.score}/${resultData.totalPoints}`);
        
        // Make sure to properly store the answers from the quiz result
        if (resultData.answers) {
          setAnswers(resultData.answers);
          console.debug(`[QuizReview] Заредени ${Object.keys(resultData.answers).length} отговора`);
        } else {
          console.warn("[QuizReview] Не са намерени отговори в резултата от теста");
          setAnswers({});
        }

        // Get and format cheating attempts 
        const cheatingData = quizData.cheatingAttempts?.[studentId] || [];
        console.debug(`[QuizReview] Намерени ${cheatingData.length} опита за измама`);
        
        const formattedCheatingAttempts: CheatAttemptDetails[] = cheatingData.map(attempt => {
          let typeLabel = "Неизвестен проблем";
          let severityColor = "text-gray-500";
          
          switch (attempt.type) {
            case "tab_switch":
              typeLabel = "Смяна на раздел";
              severityColor = "text-amber-500";
              break;
            case "window_blur":
              typeLabel = "Напускане на екрана";
              severityColor = "text-amber-500";
              break;
            case "copy_detected":
              typeLabel = "Опит за копиране";
              severityColor = "text-red-500";
              break;
            case "browser_close":
              typeLabel = "Затваряне на браузъра";
              severityColor = "text-amber-600";
              break;
            case "multiple_devices":
              typeLabel = "Множество устройства";
              severityColor = "text-red-600";
              break;
            case "time_anomaly":
              typeLabel = "Времева аномалия";
              severityColor = "text-red-600";
              break;
            case "quiz_abandoned":
              typeLabel = "Изоставен тест"; 
              severityColor = "text-amber-600";
              break;
          }
          
          return {
            ...attempt,
            typeLabel,
            severityColor
          };
        });
        
        setCheatingAttempts(formattedCheatingAttempts);
      } catch (error) {
        console.error("[QuizReview] Грешка при зареждане на данни за теста:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [quizId, studentId, user, router]);

  const getAnswerDisplay = (questionId: string) => {
    const question = questionsMap[questionId];
    if (!question) return "-";
    
    const answer = answers[questionId];
    if (!answer) return "-";

    switch (question.type) {
      case "trueFalse":
        return answer === "true" ? "Вярно" : "Невярно";
      
      case "singleChoice": {
        // Find the choice text for the selected answer
        const choiceIndex = parseInt(answer as string, 10);
        const choiceText = question.choices?.[choiceIndex]?.text;
        return choiceText || "-";
      }
      
      case "multipleChoice": {
        // Find choice texts for multiple selected answers
        const selectedIndexes = answer as string[];
        return selectedIndexes
          .map(index => {
            const choiceIndex = parseInt(index, 10);
            return question.choices?.[choiceIndex]?.text;
          })
          .filter(Boolean)
          .join(", ") || "-";
      }
      
      case "openEnded":
        return answer as string;
      
      default:
        return "-";
    }
  };

  const isAnswerCorrect = (questionId: string): boolean | null => {
    const question = questionsMap[questionId];
    const answer = answers[questionId];
    
    if (!question || !answer) {
      console.debug(`[QuizReview] Question ${questionId} or answer not found`);
      return null;
    }

    console.debug(`[QuizReview] Checking answer for question ${questionId}, type: ${question.type}`);
    
    switch (question.type) {
      case "trueFalse":
      case "singleChoice":
        const isCorrect = answer === question.correctAnswer;
        console.debug(`[QuizReview] Single choice/T-F answer correct: ${isCorrect}`);
        return isCorrect;
      
      case "multipleChoice":
        const studentAnswers = answer as string[];
        const correctAnswers = question.correctAnswer as string[];
        
        if (studentAnswers.length !== correctAnswers.length) {
          console.debug(`[QuizReview] Multiple choice length mismatch. Student: ${studentAnswers.length}, Correct: ${correctAnswers.length}`);
          return false;
        }
        
        const allCorrect = studentAnswers.every(ans => correctAnswers.includes(ans)) &&
                         correctAnswers.every(ans => studentAnswers.includes(ans));
        console.debug(`[QuizReview] Multiple choice answer correct: ${allCorrect}`);
        return allCorrect;
      
      case "openEnded":
        console.debug(`[QuizReview] Open ended question - manual grading required`);
        return null;
        
      default:
        console.debug(`[QuizReview] Unknown question type: ${question.type}`);
        return false;
    }
  };
  
  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 p-8 flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg font-medium mb-2">Зареждане...</div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!quiz || !quizResult || !student) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 p-8 flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg font-medium mb-2">Не е намерена информация за този тест</div>
            <Button onClick={() => router.push("/quiz-reviews")}>Обратно към прегледа</Button>
          </div>
        </div>
      </div>
    );
  }
  
  const percentageScore = (quizResult.score / quizResult.totalPoints) * 100;
  const scoreColor = 
    percentageScore >= 90 ? "text-green-600" :
    percentageScore >= 75 ? "text-emerald-600" :
    percentageScore >= 60 ? "text-amber-600" :
    "text-red-600";

  const progressColorClass = 
    percentageScore >= 90 ? "bg-green-500" :
    percentageScore >= 75 ? "bg-emerald-500" :
    percentageScore >= 60 ? "bg-amber-500" :
    "bg-red-500";

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="outline" size="sm" onClick={() => router.push("/quiz-reviews")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Назад
          </Button>
          <h1 className="text-2xl font-bold text-gray-800">
            Резултати от тест
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{quiz.title}</CardTitle>
                    <CardDescription>{quiz.description}</CardDescription>
                  </div>
                  <Badge className={`${scoreColor} px-3 py-1 text-sm`}>
                    {percentageScore.toFixed(1)}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-6 border-b space-y-4">
                  <div className="flex items-center">
                    <User className="h-5 w-5 mr-2" />
                    <div className="font-medium">{student.firstName} {student.lastName}</div>
                  </div>
                  
                  <div className="flex items-center">
                    <Clock className="h-5 w-5 mr-2" />
                    <div>
                      Предадено на{" "}
                      {format(quizResult.timestamp.toDate(), "dd.MM.yyyy HH:mm:ss")}
                    </div>
                  </div>
                  
                  <div className="flex items-center">
                    <FileBarChart className="h-5 w-5 mr-2" />
                    <div>
                      Резултат: <span className={scoreColor}>
                        {quizResult.score} от {quizResult.totalPoints} точки
                      </span>
                    </div>
                  </div>
                  
                  {cheatingAttempts.length > 0 && (
                    <div className="flex items-center">
                      <AlertTriangle className="h-5 w-5 mr-2 text-amber-500" />
                      <div className="text-amber-600">
                        <span className="font-medium">{cheatingAttempts.length}</span> подозрителни действия по време на теста
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="p-0">
                  <div className={`h-2.5 rounded-none bg-muted`}>
                    <div 
                      className={`h-full ${progressColorClass}`} 
                      style={{ width: `${percentageScore}%` }}
                    />
                  </div>
                </div>

                <Tabs defaultValue="answers" className="p-6">
                  <TabsList className="mb-6">
                    <TabsTrigger value="answers">Отговори</TabsTrigger>
                    <TabsTrigger value="cheating" className="relative">
                      Подозрителни действия
                      {cheatingAttempts.length > 0 && (
                        <Badge className="ml-1.5 bg-amber-500">{cheatingAttempts.length}</Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="answers" className="space-y-6">
                    {quiz.questions.map((question, index) => {
                      const isCorrect = isAnswerCorrect(question.questionId);
                      return (
                        <div 
                          key={question.questionId} 
                          className="border rounded-md p-4 space-y-3"
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="font-medium">Въпрос {index + 1}</div>
                              <div>{question.text}</div>
                            </div>
                            <Badge variant="outline">{question.points} т.</Badge>
                          </div>

                          <div className="pt-2 border-t">
                            <div className="flex justify-between">
                              <div className="text-sm text-muted-foreground mb-1">
                                Отговор на ученика:
                              </div>
                              {isCorrect !== null && (
                                <div className={isCorrect ? "text-green-600" : "text-red-600"}>
                                  {isCorrect ? (
                                    <CheckCircle className="h-4 w-4" />
                                  ) : (
                                    <XCircle className="h-4 w-4" />
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="font-medium">
                              {getAnswerDisplay(question.questionId)}
                            </div>
                          </div>
                          
                          {!isCorrect && question.correctAnswer && question.type !== "openEnded" && (
                            <div className="pt-2 border-t">
                              <div className="text-sm text-muted-foreground mb-1">
                                Верен отговор:
                              </div>
                              <div className="font-medium text-green-600">
                                {question.type === "trueFalse" ? 
                                  (question.correctAnswer === "true" ? "Вярно" : "Невярно") : 
                                  question.type === "singleChoice" ? 
                                    question.choices?.[parseInt(question.correctAnswer as string, 10)]?.text : 
                                    (question.correctAnswer as string[]).map(idx => 
                                      question.choices?.[parseInt(idx, 10)]?.text
                                    ).filter(Boolean).join(", ")
                                }
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </TabsContent>
                  
                  <TabsContent value="cheating">
                    {cheatingAttempts.length === 0 ? (
                      <div className="text-center py-10 border rounded">
                        <div className="text-muted-foreground">
                          Няма засечени опити за измама при този тест
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Време</TableHead>
                              <TableHead>Тип</TableHead>
                              <TableHead>Описание</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {cheatingAttempts.map((attempt, index) => (
                              <TableRow key={index}>
                                <TableCell>
                                  {format(attempt.timestamp.toDate(), "dd.MM.yyyy HH:mm:ss")}
                                </TableCell>
                                <TableCell>
                                  <div className={`flex items-center gap-1.5 font-medium ${attempt.severityColor}`}>
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    {attempt.typeLabel}
                                  </div>
                                </TableCell>
                                <TableCell>{attempt.description}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
          
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-lg">Информация за тест</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm border-b pb-2">
                <span className="text-muted-foreground">Брой въпроси:</span>
                <span>{quiz.questions.length}</span>
              </div>
              
              <div className="flex justify между text-sm border-b pb-2">
                <span className="text-muted-foreground">Времеви лимит:</span>
                <span>{quiz.timeLimit} минути</span>
              </div>
              
              <div className="flex justify-between text-sm border-b pb-2">
                <span className="text-muted-foreground">Максимални опити:</span>
                <span>{quiz.maxAttempts}</span>
              </div>
              
              <div className="flex justify-between text-sm border-b pb-2">
                <span className="text-muted-foreground">Ниво на сигурност:</span>
                <span className="capitalize">{quiz.securityLevel}</span>
              </div>
              
              <div className="flex justify-between text-sm border-b pb-2">
                <span className="text-muted-foreground">Разбъркани въпроси:</span>
                <span>{quiz.randomizeQuestions ? "Да" : "Не"}</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Разбъркани отговори:</span>
                <span>{quiz.randomizeChoices ? "Да" : "Не"}</span>
              </div>
            </CardContent>
            
            <CardFooter className="flex flex-col gap-2">
              <Link 
                href={`/quizzes/${quiz.quizId}`} 
                className="w-full"
              >
                <Button variant="outline" className="w-full">
                  Преглед на тест
                </Button>
              </Link>
              
              <Button className="w-full" onClick={() => router.push("/messages")}>
                Съобщение до ученика
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}