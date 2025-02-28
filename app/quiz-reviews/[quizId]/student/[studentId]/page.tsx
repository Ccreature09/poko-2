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
      router.push("/");
      return;
    }

    async function fetchData() {
      setLoading(true);
      try {
        // Fetch quiz details
        const quizRef = doc(db, "schools", user?.schoolId || "", "quizzes", quizId);
        const quizSnapshot = await getDoc(quizRef);
        
        if (!quizSnapshot.exists()) {
          console.error("Quiz not found");
          router.push("/quiz-reviews");
          return;
        }
        
        const quizData = { ...quizSnapshot.data(), quizId: quizSnapshot.id } as Quiz;
        setQuiz(quizData);
        
        // Create a map of questions for easy access
        const questionMap: Record<string, Question> = {};
        quizData.questions.forEach(question => {
          questionMap[question.questionId] = question;
        });
        setQuestionsMap(questionMap);

        // Fetch student details
        const studentRef = doc(db, "schools", user!.schoolId!, "users", studentId);
        const studentSnapshot = await getDoc(studentRef);
        
        if (!studentSnapshot.exists()) {
          console.error("Student not found");
          setStudent({ firstName: "Unknown", lastName: "Student" });
        } else {
          const studentData = studentSnapshot.data();
          setStudent({
            firstName: studentData.firstName || "Unknown",
            lastName: studentData.lastName || "Student"
          });
        }

        // Fetch quiz results - we need to modify this to get the completed result
        const resultsRef = collection(db, "schools", user?.schoolId || "", "quizResults");
        const resultsQuery = query(
          resultsRef,
          where("quizId", "==", quizId),
          where("userId", "==", studentId),
          where("completed", "==", true) // Filter to only get completed quiz results
        );
        
        const resultsSnapshot = await getDocs(resultsQuery);
        
        if (resultsSnapshot.empty) {
          console.error("Completed quiz result not found");
          router.push("/quiz-reviews");
          return;
        }
        
        // Get the latest result (by timestamp) if there are multiple completed results
        let resultData: QuizResult;
        if (resultsSnapshot.docs.length > 1) {
          // Sort by timestamp in descending order to get the most recent one
          const sortedResults = resultsSnapshot.docs
            .map(doc => ({
              ...doc.data() as QuizResult,
              id: doc.id
            }))
            .sort((a, b) => {
              // Compare timestamps - most recent first
              return b.timestamp.toMillis() - a.timestamp.toMillis();
            });
          
          resultData = sortedResults[0];
          console.log(`Found ${sortedResults.length} quiz results, using the most recent one.`);
        } else {
          resultData = resultsSnapshot.docs[0].data() as QuizResult;
        }
        
        setQuizResult(resultData);
        
        // Make sure to properly store the answers from the quiz result
        if (resultData.answers) {
          setAnswers(resultData.answers);
        } else {
          console.warn("No answers found in quiz result");
          setAnswers({});
        }

        // Get and format cheating attempts
        const cheatingData = quizData.cheatingAttempts?.[studentId] || [];
        const formattedCheatingAttempts: CheatAttemptDetails[] = cheatingData.map(attempt => {
          let typeLabel = "Unknown Issue";
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
              typeLabel = "Достъп от множество устройства";
              severityColor = "text-red-600";
              break;
            case "time_anomaly":
              typeLabel = "Аномалия във времето";
              severityColor = "text-red-600";
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
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user, router, quizId, studentId]);

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
    if (!question || !question.correctAnswer) return null;
    
    const answer = answers[questionId];
    if (!answer) return false;
    
    switch (question.type) {
      case "trueFalse":
      case "singleChoice":
        return answer === question.correctAnswer;
        
      case "multipleChoice": {
        // Check if arrays contain the same elements
        const studentAnswers = answer as string[];
        const correctAnswers = question.correctAnswer as string[];
        
        if (studentAnswers.length !== correctAnswers.length) return false;
        
        return studentAnswers.every(ans => correctAnswers.includes(ans)) &&
               correctAnswers.every(ans => studentAnswers.includes(ans));
      }
      
      case "openEnded":
        // For open-ended, we'll just show a dash as manual grading is typically required
        return null;
        
      default:
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
              
              <div className="flex justify-between text-sm border-b pb-2">
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