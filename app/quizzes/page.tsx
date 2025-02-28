"use client";

import { useUser } from "@/contexts/UserContext";
import type { Quiz } from "@/lib/interfaces";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import Sidebar from "@/components/functional/Sidebar";
import Link from "next/link";
import { useQuiz } from "@/contexts/QuizContext";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Eye, Lock, Shield, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow, isPast, isFuture } from 'date-fns';

export default function Quizzes() {
  const { user } = useUser();
  const { quizzes, isQuizAvailable, getRemainingAttempts } = useQuiz();
  const [quizzesWithMetadata, setQuizzesWithMetadata] = useState<(Quiz & { remainingAttempts: number, isAvailable: boolean })[]>([]);

  useEffect(() => {
    const loadQuizMetadata = async () => {
      const withMetadata = await Promise.all(quizzes.map(async quiz => {
        const remainingAttempts = await getRemainingAttempts(quiz);
        return {
          ...quiz,
          remainingAttempts,
          isAvailable: isQuizAvailable(quiz)
        };
      }));
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

  const getQuizAvailabilityStatus = (quiz: Quiz) => {
    
    const now = new Date();
    if (quiz.availableFrom && isFuture(quiz.availableFrom.toDate()))
      return "upcoming";
    if (quiz.availableTo && isPast(quiz.availableTo.toDate()))
      return "expired";
    
    return "available";
  };

  const getSecurityBadge = (securityLevel: string) => {
    switch(securityLevel) {
      case "low":
        return <Badge variant="outline" className="ml-2">Basic Security</Badge>;
      case "medium":
        return <Badge variant="secondary" className="ml-2"><Shield className="h-3 w-3 mr-1" />Medium Security</Badge>;
      case "high":
        return <Badge variant="default" className="ml-2"><Lock className="h-3 w-3 mr-1" />High Security</Badge>;
      case "extreme":
        return <Badge variant="destructive" className="ml-2"><AlertTriangle className="h-3 w-3 mr-1" />Maximum Security</Badge>;
      default:
        return null;
    }
  };

  const formatAvailabilityTime = (quiz: Quiz) => {
    if (quiz.availableFrom && isFuture(quiz.availableFrom.toDate())) {
      return `Available in ${formatDistanceToNow(quiz.availableFrom.toDate())}`;
    }
    
    if (quiz.availableTo) {
      if (isPast(quiz.availableTo.toDate())) {
        return "Expired";
      } else {
        return `Expires in ${formatDistanceToNow(quiz.availableTo.toDate())}`;
      }
    }
    
    return "Always available";
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <h1 className="text-3xl font-bold mb-2">Моите тестове</h1>
        <p className="text-muted-foreground mb-8">
          Преглед на всички достъпни тестове и техния статус
        </p>
        
        {quizzesWithMetadata.length === 0 ? (
          <div className="text-center p-12 border rounded-lg bg-muted/20">
            <p className="text-muted-foreground">Няма налични тестове в момента</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quizzesWithMetadata.map((quiz) => {
              const availabilityStatus = getQuizAvailabilityStatus(quiz);
              const hasTakenQuiz = quiz.tookTest && quiz.tookTest.includes(user?.userId || "");
              const canTakeQuiz = quiz.isAvailable && (!hasTakenQuiz || quiz.remainingAttempts > 0);
              const isTeacher = user?.role === "teacher";
              const canMonitor = isTeacher && Boolean(quiz.inProgress);
              
              return (
                <div key={quiz.quizId} className="relative">
                  <Card className={`transition-colors h-full ${(canTakeQuiz || isTeacher) ? "hover:bg-muted/50" : ""}`}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle>{quiz.title}</CardTitle>
                        {quiz.securityLevel && getSecurityBadge(quiz.securityLevel)}
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
                      {isTeacher ? (
                        <div className="w-full flex gap-2">
                          <Button variant="outline" className="w-full" asChild>
                            <Link href={`/quiz-reviews`}>Резултати</Link>
                          </Button>
                          {canMonitor && (
                            <Button className="w-full" asChild>
                              <Link href={`/quiz-reviews/${quiz.quizId}/monitor`}>
                                <Eye className="h-4 w-4 mr-1" />
                                Наблюдение
                              </Link>
                            </Button>
                          )}
                        </div>
                      ) : hasTakenQuiz ? (
                        <div className="w-full">
                          <Badge variant="outline" className="w-full justify-center py-1">
                            {quiz.remainingAttempts > 0 ? `${quiz.remainingAttempts} опита остават` : "Завършен тест"}
                          </Badge>
                        </div>
                      ) : (
                        <>
                          {availabilityStatus === "available" ? (
                            <Button className="w-full" asChild>
                              <Link href={`/quizzes/${quiz.quizId}`}>Започни теста</Link>
                            </Button>
                          ) : (
                            <Button disabled className="w-full">
                              {availabilityStatus === "upcoming" ? "Предстои" : 
                               availabilityStatus === "expired" ? "Изтекъл" : "Неактивен"}
                            </Button>
                          )}
                        </>
                      )}
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
