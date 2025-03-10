"use client";

import { useUser } from "@/contexts/UserContext";
import type { Quiz } from "@/lib/interfaces";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import Sidebar from "@/components/functional/Sidebar";
import Link from "next/link";
import { useQuiz } from "@/contexts/QuizContext";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Eye, Lock, Shield, AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { isPast, isFuture, format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { deleteQuiz } from "@/lib/quizManagement";

export default function Quizzes() {
  const { user } = useUser();
  const { quizzes, isQuizAvailable, getRemainingAttempts } = useQuiz();
  const [quizzesWithMetadata, setQuizzesWithMetadata] = useState<(Quiz & { remainingAttempts: number, isAvailable: boolean })[]>([]);
  const [deletingQuizId, setDeletingQuizId] = useState<string | null>(null);

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

  const formatAvailabilityTime = (quiz: Quiz) => {
    if (quiz.availableFrom && isFuture(quiz.availableFrom.toDate())) {
      return `Започва: ${format(quiz.availableFrom.toDate(), "dd.MM.yyyy HH:mm")}`;
    }
    if (quiz.availableTo) {
      return `Краен срок: ${format(quiz.availableTo.toDate(), "dd.MM.yyyy HH:mm")}`;
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

  const getSecurityBadge = (level: string) => {
    switch (level) {
      case 'extreme':
        return <Badge variant="destructive"><Lock className="h-3 w-3 mr-1" /> Екстремна</Badge>;
      case 'high':
        return <Badge variant="default"><Shield className="h-3 w-3 mr-1" /> Висока</Badge>;
      case 'medium':
        return <Badge variant="secondary"><AlertTriangle className="h-3 w-3 mr-1" /> Средна</Badge>;
      default:
        return <Badge variant="outline"><Shield className="h-3 w-3 mr-1" /> Ниска</Badge>;
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (!user?.schoolId) return;
    
    try {
      setDeletingQuizId(quizId);
      await deleteQuiz(user.schoolId, quizId);
      setQuizzesWithMetadata(prev => prev.filter(q => q.quizId !== quizId));
      toast({
        title: "Success",
        description: "Quiz deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting quiz:", error);
      toast({
        title: "Error",
        description: "Failed to delete quiz",
        variant: "destructive",
      });
    } finally {
      setDeletingQuizId(null);
    }
  };

  if (!user) return null;

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
            <p className="text-muted-foreground">Няма налични тестове в момента</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quizzesWithMetadata.map((quiz) => {
              const availabilityStatus = getQuizAvailabilityStatus(quiz);
              const hasTakenQuiz = quiz.tookTest && quiz.tookTest.includes(user?.userId || "");
              
              // Simplify logic: A quiz is available if it's in the available time window AND user hasn't taken it yet
              const canTakeQuiz = quiz.isAvailable;
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
                      <div className="flex gap-2 w-full">
                        {isTeacher ? (
                          <>
                            <Button variant="outline" className="flex-1" asChild>
                              <Link href={`/quiz-reviews`}>Резултати</Link>
                            </Button>
                            {canMonitor && (
                              <Button className="flex-1" asChild>
                                <Link href={`/quiz-reviews/${quiz.quizId}/monitor`}>
                                  <Eye className="h-4 w-4 mr-1 text-white" />
                                  <p className="text-white">Наблюдение</p>
                                </Link>
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="w-10 px-0" asChild>
                              <Link href={`/quizzes/${quiz.quizId}/edit`}>
                                <Pencil className="h-4 w-4" />
                              </Link>
                            </Button>

                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="w-10 px-0 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Изтриване на тест</DialogTitle>
                                  <DialogDescription>
                                    Сигурни ли сте, че искате да изтриете този тест? Това действие не може да бъде отменено.
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setDeletingQuizId(null)}>Отказ</Button>
                                  <Button 
                                    variant="destructive" 
                                    onClick={() => handleDeleteQuiz(quiz.quizId)}
                                    disabled={deletingQuizId === quiz.quizId}
                                  >
                                    {deletingQuizId === quiz.quizId ? "Изтриване..." : "Изтрий"}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </>
                        ) : hasTakenQuiz ? (
                          <div className="w-full">
                            <Badge variant="outline" className="w-full justify-center py-1">
                              Завършен тест
                            </Badge>
                          </div>
                        ) : (
                          <>
                            {availabilityStatus === "available" ? (
                              <Button variant={"outline"} className="w-full" asChild>
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
