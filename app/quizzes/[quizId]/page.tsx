"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { Quiz, CheatAttemptType } from "@/lib/interfaces";
import Sidebar from "@/components/functional/Sidebar";
import { Button } from "@/components/ui/button";
import { useQuiz } from "@/contexts/QuizContext";
import {
  doc,
  collection,
  setDoc,
  updateDoc,
  Timestamp,
  arrayUnion,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "@/hooks/use-toast";
import { 
  Card, 
  CardContent, 
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription 
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { 
  AlertCircle, 
  Timer,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function QuizPage() {
  const router = useRouter();
  const { user } = useUser();
  const { quizzes, recordCheatAttempt, submitQuizResult } = useQuiz();
  const { quizId } = useParams();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [questionTimeSpent, setQuestionTimeSpent] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [quizStartTime, setQuizStartTime] = useState<Date | null>(null);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [cheatingDetected, setCheatingDetected] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [showTimeAlert, setShowTimeAlert] = useState(false);
  
  // References for tracking focus/blur events
  const visibilityRef = useRef({
    lastFocused: new Date(),
    blurCount: 0,
    focusHistory: [] as {timestamp: Date, action: 'focus' | 'blur'}[],
  });
  
  // Timer refs
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const questionTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Load quiz data
  useEffect(() => {
    if (quizId && quizzes.length > 0) {
      // Find the quiz with the matching quizId
      const foundQuiz = quizzes.find((q) => q.quizId === quizId);
      if (foundQuiz) {
        setQuiz(foundQuiz);
        // Reset state when quiz changes
        setAnswers({});
        setCurrentQuestionIndex(0);
        setQuestionTimeSpent({});
        
        // Set up the timer if the quiz has a time limit
        if (foundQuiz.timeLimit) {
          setTimeRemaining(foundQuiz.timeLimit * 60); // Convert minutes to seconds
          setQuizStartTime(new Date());
        }
      } else {
        // Quiz not found, redirect to quizzes page
        toast({
          title: "Error",
          description: "Този тест не е намерен",
          variant: "destructive",
        });
        router.push('/quizzes');
      }
    }
  }, [quizId, quizzes, router]);

  // Timer logic for quiz time limit
  useEffect(() => {
    // Start timer if time remaining is set and greater than 0
    if (timeRemaining !== null && timeRemaining > 0 && quiz) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev === null || prev <= 1) {
            // Time's up, submit the quiz
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [timeRemaining, quiz]);
  
  // Show warning when 5 minutes remain
  useEffect(() => {
    if (timeRemaining === 5 * 60) { // 5 minutes in seconds
      setShowTimeAlert(true);
      setTimeout(() => setShowTimeAlert(false), 10000); // Hide after 10 seconds
    }
  }, [timeRemaining]);

  // Record time spent on questions
  useEffect(() => {
    if (!quiz || !quiz.questions[currentQuestionIndex]) return;
    
    const questionId = quiz.questions[currentQuestionIndex].questionId;
    
    // Start timer for this question
    let startTime = Date.now();
    questionTimerRef.current = setInterval(() => {
      setQuestionTimeSpent((prev) => ({
        ...prev,
        [questionId]: ((prev[questionId] || 0) + 1),
      }));
    }, 1000);
    
    return () => {
      if (questionTimerRef.current) {
        clearInterval(questionTimerRef.current);
      }
    };
  }, [currentQuestionIndex, quiz]);
  
  // Set up anti-cheating monitoring
  useEffect(() => {
    if (!quiz || !quiz.securityLevel || quiz.securityLevel === 'low') return;
    
    // Handle tab/window visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleTabSwitch();
      }
    };
    
    // Handle browser window blur (user switched to another application)
    const handleBlur = () => {
      visibilityRef.current.blurCount++;
      visibilityRef.current.focusHistory.push({
        timestamp: new Date(),
        action: 'blur'
      });
      
      if (quiz.securityLevel === 'extreme') {
        handleCheatingDetected('window_blur', 'User switched to another window');
      } else if (quiz.securityLevel === 'high' || quiz.securityLevel === 'medium') {
        handleTabSwitch();
      }
    };
    
    // Handle browser window focus (user returned to the quiz)
    const handleFocus = () => {
      const now = new Date();
      const timeSinceLastFocus = (now.getTime() - visibilityRef.current.lastFocused.getTime()) / 1000;
      
      visibilityRef.current.focusHistory.push({
        timestamp: new Date(),
        action: 'focus'
      });
      
      visibilityRef.current.lastFocused = now;
      
      // If user was away for more than 10 seconds, record it as suspicious
      if (timeSinceLastFocus > 10 && quiz.securityLevel !== 'low') {
        recordCheatAttempt(quizId as string, {
          type: 'window_blur',
          description: `User was away from the quiz for ${Math.round(timeSinceLastFocus)} seconds`
        });
      }
    };
    
    // Prevent copying content
    const handleCopy = (e: ClipboardEvent) => {
      if (quiz.securityLevel !== 'low') {
        e.preventDefault();
        toast({
          title: "Warning",
          description: "Copying content during a quiz is not allowed",
          variant: "destructive",
        });
        
        recordCheatAttempt(quizId as string, {
          type: 'copy_detected',
          description: 'User attempted to copy content'
        });
      }
    };
    
    // Prevent right-clicking
    const handleContextMenu = (e: MouseEvent) => {
      if (quiz.securityLevel !== 'low') {
        e.preventDefault();
      }
    };
    
    // Handle before unload (user tries to close/refresh the page)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (quiz.securityLevel !== 'low') {
        recordCheatAttempt(quizId as string, {
          type: 'browser_close',
          description: 'User attempted to close or refresh the browser'
        });
        
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    
    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handleCopy);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      // Remove event listeners on cleanup
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handleCopy);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [quiz, quizId, recordCheatAttempt]);
  
  // Handle tab switching - record and warn
  const handleTabSwitch = () => {
    if (!quiz) return;
    
    setWarningCount((prev) => {
      const newCount = prev + 1;
      setShowWarningDialog(true);
      
      // For high and extreme security, auto-flag for cheating after multiple warnings
      if ((quiz.securityLevel === 'high' && newCount >= 3) || 
          (quiz.securityLevel === 'extreme' && newCount >= 2)) {
        handleCheatingDetected('tab_switch', `User switched tabs/windows ${newCount} times`);
      }
      
      return newCount;
    });
    
    // Record the incident
    recordCheatAttempt(quizId as string, {
      type: 'tab_switch',
      description: `User switched to another tab or window (warning #${warningCount + 1})`
    });
  };
  
  // Handle cheating detection
  const handleCheatingDetected = (type: CheatAttemptType, description: string) => {
    setCheatingDetected(true);
    
    // Record the cheating attempt
    recordCheatAttempt(quizId as string, { type, description });
    
    // For extreme security, auto-submit the quiz
    if (quiz?.securityLevel === 'extreme') {
      toast({
        title: "Test Submitted",
        description: "Multiple security violations detected. Test has been submitted.",
        variant: "destructive",
      });
      
      handleSubmit();
    }
  };
  
  // Handle time up - auto submit quiz
  const handleTimeUp = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    toast({
      title: "Time's Up!",
      description: "Your quiz time has expired and will be submitted automatically.",
      variant: "destructive",
    });
    
    await handleSubmit();
  };

  // Function to handle changes to the user's answers
  const handleAnswerChange = (id: string, answer: string | string[]) => {
    setAnswers((prev) => ({
      ...prev,
      [id]: answer,
    }));
  };

  // Function to calculate the user's score
  const calculateScore = () => {
    if (!quiz) return 0;

    return quiz.questions.reduce((score, question) => {
      const userAnswer = answers[question.questionId];
      if (!userAnswer || !question.correctAnswer) return score;

      let questionPoints = 0;

      if (question.type === "openEnded") {
        questionPoints = question.points;
      } else {
        const correctAnswers = Array.isArray(question.correctAnswer)
          ? question.correctAnswer
          : [question.correctAnswer];

        const userAnswers = Array.isArray(userAnswer)
          ? userAnswer
          : [userAnswer];

        const isCorrect = correctAnswers.every((ans) =>
          userAnswers.includes(ans)
        );
        questionPoints = isCorrect ? question.points : 0;
      }

      return score + questionPoints;
    }, 0);
  };

  // Function to get the total possible points for the quiz
  const getTotalPossiblePoints = () => {
    return quiz?.questions.reduce((total, q) => total + q.points, 0) || 0;
  };

  // Submit the quiz
  const handleSubmit = async () => {
    if (!user || !quiz) return;

    setIsSubmitting(true);
    try {
      // Calculate the user's score
      const score = calculateScore();
      const totalPoints = getTotalPossiblePoints();

      // Create quiz result with time data
      const result = {
        quizId: quiz.quizId,
        userId: user.userId,
        answers,
        score,
        totalPoints,
        questionsTimeSpent: questionTimeSpent,
        totalTimeSpent: quizStartTime 
          ? Math.floor((new Date().getTime() - quizStartTime.getTime()) / 1000)
          : null,
        securityViolations: visibilityRef.current.blurCount,
        cheatingDetected: cheatingDetected
      };

      // Submit using context function
      await submitQuizResult(result);

      toast({
        title: "Quiz Submitted!",
        description: `Your score: ${score}/${totalPoints} points`,
      });
      
      // Show the review if allowed
      if (quiz.allowReview) {
        // Implement review logic here or redirect to review page
        router.push(`/dashboard/${user?.schoolId}`);
      } else {
        router.push(`/dashboard/${user?.schoolId}`);
      }
    } catch (error) {
      console.error("Error submitting quiz:", error);
      toast({
        title: "Error",
        description: "Failed to submit quiz. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format remaining time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Get completion percentage for progress bar
  const getCompletionPercentage = (): number => {
    if (!quiz) return 0;
    const answeredCount = Object.keys(answers).length;
    return Math.round((answeredCount / quiz.questions.length) * 100);
  };

  // Get current question data
  const getCurrentQuestion = () => {
    if (!quiz) return null;
    return quiz.questions[currentQuestionIndex] || null;
  };

  // Check if the user has already taken the quiz
  const hasTakenQuiz = quiz?.tookTest?.includes(user?.userId || "");
  
  // Loading state
  if (!quiz) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 p-8 flex justify-center items-center">
          <p>Зареждане на теста...</p>
        </div>
      </div>
    );
  }

  // Prevent access if the quiz has already been taken
  if (hasTakenQuiz) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 p-8 flex flex-col justify-center items-center">
          <AlertCircle className="h-16 w-16 text-amber-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Вече сте направили този тест</h1>
          <p className="text-muted-foreground mb-6">Не можете да започнете теста отново</p>
          <Button onClick={() => router.push('/quizzes')}>
            Назад към всички тестове
          </Button>
        </div>
      </div>
    );
  }

  const currentQuestion = getCurrentQuestion();
  if (!currentQuestion) return null;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        {/* Quiz Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">{quiz.title}</h1>
            <p className="text-muted-foreground mt-1">{quiz.description}</p>
          </div>
          
          {/* Security badge and timer */}
          <div className="flex flex-col items-end gap-2">
            {quiz.securityLevel && (
              <Badge variant={quiz.securityLevel === 'extreme' ? 'destructive' : 
                            quiz.securityLevel === 'high' ? 'default' : 
                            quiz.securityLevel === 'medium' ? 'secondary' : 
                            'outline'}>
                Security Level: {quiz.securityLevel.charAt(0).toUpperCase() + quiz.securityLevel.slice(1)}
              </Badge>
            )}
            
            {timeRemaining !== null && (
              <div className={`flex items-center gap-2 font-mono text-lg
                ${timeRemaining < 60 ? 'text-red-500 animate-pulse' : 
                  timeRemaining < 5 * 60 ? 'text-amber-500' : 
                  'text-muted-foreground'}`}>
                <Timer className="h-5 w-5" />
                {formatTime(timeRemaining)}
              </div>
            )}
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm mb-2">
            <span>Progress</span>
            <span>{getCompletionPercentage()}%</span>
          </div>
          <Progress value={getCompletionPercentage()} className="h-2" />
        </div>

        {/* Current Question */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">
                Въпрос {currentQuestionIndex + 1} от {quiz.questions.length}
              </CardTitle>
              <Badge variant="outline">{currentQuestion.points} точки</Badge>
            </div>
            <CardDescription className="text-base font-medium mt-2">
              {currentQuestion.text}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* Question content based on type */}
            <div className="space-y-4">
              {currentQuestion.image && (
                <div className="mb-4 rounded-md overflow-hidden">
                  <img 
                    src={currentQuestion.image} 
                    alt={`Image for question ${currentQuestionIndex + 1}`}
                    className="mx-auto max-h-[300px] object-contain"
                  />
                </div>
              )}

              {currentQuestion.type === "openEnded" ? (
                <textarea
                  value={(answers[currentQuestion.questionId] as string) || ""}
                  onChange={(e) => handleAnswerChange(currentQuestion.questionId, e.target.value)}
                  className="w-full p-3 border rounded-md min-h-[150px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Въведете отговора си тук..."
                />
              ) : currentQuestion.type === "trueFalse" ? (
                <RadioGroup
                  value={answers[currentQuestion.questionId] as string || ""}
                  onValueChange={(value) => handleAnswerChange(currentQuestion.questionId, value)}
                  className="space-y-3"
                >
                  <div className="flex items-center space-x-2 p-3 border rounded-md">
                    <RadioGroupItem id="true" value="true" />
                    <Label htmlFor="true">Вярно</Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-md">
                    <RadioGroupItem id="false" value="false" />
                    <Label htmlFor="false">Невярно</Label>
                  </div>
                </RadioGroup>
              ) : currentQuestion.type === "singleChoice" ? (
                <RadioGroup
                  value={answers[currentQuestion.questionId] as string || ""}
                  onValueChange={(value) => handleAnswerChange(currentQuestion.questionId, value)}
                  className="space-y-3"
                >
                  {currentQuestion.choices?.map((choice) => (
                    <div key={choice.choiceId} className="flex items-center space-x-2 p-3 border rounded-md">
                      <RadioGroupItem id={choice.choiceId} value={choice.choiceId} />
                      <Label htmlFor={choice.choiceId}>{choice.text}</Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <div className="space-y-3">
                  {currentQuestion.choices?.map((choice) => {
                    const isChecked = Array.isArray(answers[currentQuestion.questionId])
                      ? (answers[currentQuestion.questionId] as string[]).includes(choice.choiceId)
                      : false;
                    
                    return (
                      <div key={choice.choiceId} className="flex items-center space-x-2 p-3 border rounded-md">
                        <Checkbox
                          id={choice.choiceId}
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            const currentAnswers = (answers[currentQuestion.questionId] as string[]) || [];
                            if (checked) {
                              handleAnswerChange(currentQuestion.questionId, [...currentAnswers, choice.choiceId]);
                            } else {
                              handleAnswerChange(
                                currentQuestion.questionId,
                                currentAnswers.filter((id) => id !== choice.choiceId)
                              );
                            }
                          }}
                        />
                        <Label htmlFor={choice.choiceId}>{choice.text}</Label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex justify-between pt-6">
            <Button
              variant="outline"
              onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentQuestionIndex === 0}
            >
              Предишен
            </Button>

            {currentQuestionIndex < quiz.questions.length - 1 ? (
              <Button
                onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                disabled={!answers[currentQuestion.questionId]}
              >
                Следващ
              </Button>
            ) : (
              <Button
                onClick={() => setShowConfirmSubmit(true)}
                disabled={!answers[currentQuestion.questionId] || isSubmitting}
              >
                {isSubmitting ? "Изпращане..." : "Завърши теста"}
              </Button>
            )}
          </CardFooter>
        </Card>
        
        {/* Question navigation */}
        <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-2 mt-6">
          {quiz.questions.map((q, idx) => {
            const hasAnswer = !!answers[q.questionId];
            
            return (
              <Button
                key={q.questionId}
                variant={idx === currentQuestionIndex ? "default" : hasAnswer ? "outline" : "ghost"}
                className={`h-10 w-10 p-0 ${hasAnswer ? 'border-green-500' : ''}`}
                onClick={() => setCurrentQuestionIndex(idx)}
              >
                {idx + 1}
                {hasAnswer && <CheckCircle2 className="h-3 w-3 absolute bottom-1 right-1 text-green-500" />}
              </Button>
            );
          })}
        </div>
      </div>
      
      {/* Warning Dialog */}
      <Dialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center text-amber-500">
              <AlertTriangle className="h-5 w-5 mr-2" /> Warning
            </DialogTitle>
            <DialogDescription>
              Switching tabs or leaving the quiz page is not allowed and may be reported as cheating.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              This activity has been recorded. Multiple violations may result in automatic test submission or disqualification.
            </p>
            <p className="text-sm font-semibold mt-2">
              Warning {warningCount} of {quiz.securityLevel === 'extreme' ? '2' : quiz.securityLevel === 'high' ? '3' : '∞'}
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowWarningDialog(false)}>
              I understand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Submit Confirmation Dialog */}
      <Dialog open={showConfirmSubmit} onOpenChange={setShowConfirmSubmit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Quiz</DialogTitle>
            <DialogDescription>
              Are you sure you want to submit your quiz? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm font-medium">Quiz Completion Summary:</p>
            <p className="text-sm text-muted-foreground mt-1">
              Questions Answered: {Object.keys(answers).length} of {quiz.questions.length}
            </p>
            {Object.keys(answers).length < quiz.questions.length && (
              <p className="text-sm text-amber-500 mt-1">
                Warning: You have {quiz.questions.length - Object.keys(answers).length} unanswered questions.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmSubmit(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Quiz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Time Alert */}
      <Dialog open={showTimeAlert} onOpenChange={setShowTimeAlert}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center text-amber-500">
              <Timer className="h-5 w-5 mr-2" /> Time Warning
            </DialogTitle>
            <DialogDescription>
              You have 5 minutes remaining to complete this quiz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowTimeAlert(false)}>
              I understand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
