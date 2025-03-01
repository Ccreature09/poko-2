"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { Quiz, CheatAttemptType } from "@/lib/interfaces";
import Sidebar from "@/components/functional/Sidebar";
import { Button } from "@/components/ui/button";
import { useQuiz } from "@/contexts/QuizContext";
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
import { Timestamp, getDoc, deleteField } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";

// Move visibilityRef outside component to persist across re-renders
const visibilityRef = {
  lastFocused: new Date(),
  blurCount: 0,
  focusHistory: [] as {timestamp: Date, action: 'focus' | 'blur'}[],
};

export default function QuizPage() {
  const router = useRouter();
  const { user } = useUser();
  const { 
    quizzes, 
    recordCheatAttempt, 
    submitQuizResult,
    startQuiz,
    saveQuizProgress,
    getRemainingAttempts
  } = useQuiz();
  const { quizId } = useParams();

  // Store quiz in ref to prevent re-fetching
  const quizRef = useRef<Quiz | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [questionTimeSpent, setQuestionTimeSpent] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [quizStartTime, setQuizStartTime] = useState<Date | null>(null);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [showTimeAlert, setShowTimeAlert] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number>(0);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Use refs for timers to persist across re-renders
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const questionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
  const saveProgressTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handler functions defined before they are used
  const handleTimeUp = async () => {
    console.debug('[QuizPage] Time up - auto submitting quiz');
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    toast({
      title: "Времето изтече!",
      description: "Времето за теста изтече и той ще бъде предаден автоматично.",
      variant: "destructive",
    });
    
    await handleSubmit();
  };

  const handleCheatingDetected = async (type: CheatAttemptType, description: string) => {
    console.debug(`[QuizPage] Cheating detected - Type: ${type}, Description: ${description}`);
    await recordCheatAttempt(quizId as string, {
      type,
      description
    });
  };

  const handleTabSwitch = () => {
    console.debug('[QuizPage] Tab switch detected');
    setWarningCount(prev => {
      setShowWarningDialog(true);
      const newCount = prev + 1;
      
      // Auto-submit on too many violations for high/extreme security
      if (quiz?.securityLevel === 'extreme' && newCount >= 3) {
        console.debug('[QuizPage] Excessive tab switches detected, auto-submitting');
        handleCheatingDetected('tab_switch', 'Excessive tab switching resulted in automatic submission');
        handleSubmit();
      } else if (quiz?.securityLevel === 'high' && newCount >= 4) {
        console.debug('[QuizPage] Excessive tab switches detected, auto-submitting');
        handleCheatingDetected('tab_switch', 'Excessive tab switching resulted in automatic submission');
        handleSubmit();
      }
      
      return newCount;
    });
  };

  // Save progress with debouncing
  const saveProgress = async () => {
    if (!quiz || isInitializing || isSubmitting) return;

    // Clear any existing timeout
    if (saveProgressTimeoutRef.current) {
      clearTimeout(saveProgressTimeoutRef.current);
    }

    // Set a new timeout to save after 500ms
    saveProgressTimeoutRef.current = setTimeout(async () => {
      console.debug('[QuizPage] Saving quiz progress');
      try {
        await saveQuizProgress(
          quizId as string, 
          answers, 
          currentQuestionIndex
        );
      } catch (err) {
        console.error("Error saving progress:", err);
      }
    }, 500);
  };

  // Memoize the loadQuiz function
  const loadQuiz = useCallback(async (mounted: boolean) => {
    console.debug('[QuizPage] 🏁 Starting loadQuiz function');
    
    if (!user || !quizId || !mounted) {
      console.debug('[QuizPage] Cannot load quiz - missing data:', { user, quizId, mounted });
      return;
    }

    try {
      setIsInitializing(true);
      
      // If quiz is already loaded in ref, use that instead of fetching again
      if (quizRef.current) {
        console.debug('[QuizPage] Using cached quiz:', quizRef.current.title);
        setQuiz(quizRef.current);
        setIsInitializing(false);
        return;
      }
   
      console.debug('[QuizPage] Loading quiz from context:', quizId);
      const foundQuiz = quizzes.find((q) => q.quizId === quizId);
      
      if (!foundQuiz) {
        console.debug('[QuizPage] ❌ Quiz not found in context');
        router.push("/quizzes");
        return;
      }

      // Store quiz in ref for future use
      quizRef.current = foundQuiz;
      
      // Get remaining attempts
      const remaining = await getRemainingAttempts(foundQuiz);
      console.debug(`[QuizPage] Remaining attempts: ${remaining}`);
      
      if (!mounted) {
        console.debug('[QuizPage] Component unmounted during load, abandoning');
        return;
      }

      setRemainingAttempts(remaining);
      setQuiz(foundQuiz);

      // Set time remaining if quiz has a time limit and not already set
      if (foundQuiz.timeLimit && timeRemaining === null) {
        console.debug(`[QuizPage] Setting initial time limit: ${foundQuiz.timeLimit} minutes`);
        setTimeRemaining(foundQuiz.timeLimit * 60);
        setQuizStartTime(new Date());
      }

      // Start the quiz only if we're still mounted and not already started
      if (mounted && !quizStartTime) {
        console.debug('[QuizPage] Starting quiz...');
        await startQuiz(quizId as string);
        console.debug('[QuizPage] Quiz started successfully');
      }
    } catch (error) {
      console.error('[QuizPage] ❌ Error loading quiz:', error);
      if (mounted) {
        toast({
          title: "Грешка",
          description: "Грешка при зареждане на теста. Моля, опитайте отново.",
          variant: "destructive",
        });
        router.push("/quizzes");
      }
    } finally {
      if (mounted) {
        setIsInitializing(false);
      }
    }
  }, [quizId, user, quizzes, router, startQuiz, getRemainingAttempts, timeRemaining, quizStartTime]);

  // Load quiz data only once
  useEffect(() => {
    let mounted = true;

    if (!quizzes || quizzes.length === 0 || quizRef.current) {
      console.debug('[QuizPage] No need to load quiz:', { 
        hasQuizzes: !!quizzes?.length,
        hasCachedQuiz: !!quizRef.current
      });
      return;
    }

    console.debug('[QuizPage] Initial mount, loading quiz');
    loadQuiz(mounted);
    return () => { mounted = false; };
  }, [loadQuiz, quizzes]);

  // Timer logic for quiz time limit - Updated to handle null check
  useEffect(() => {
    if (timeRemaining === null || !quiz || isInitializing) return;

    if (timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev === null || prev <= 1) {
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
  }, [timeRemaining, quiz, isInitializing]);

  // Auto-save progress every 30 seconds
  useEffect(() => {
    if (!isInitializing && quiz && !isSubmitting) {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
      }

      autoSaveRef.current = setInterval(() => {
        if (Object.keys(answers).length > 0) {
          saveProgress();
        }
      }, 30000);
    }
    
    return () => {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
      }
      if (saveProgressTimeoutRef.current) {
        clearTimeout(saveProgressTimeoutRef.current);
      }
    };
  }, [quiz, isInitializing, answers, isSubmitting, saveProgress]);
  
  // Show warning when 5 minutes remain
  useEffect(() => {
    if (timeRemaining === 5 * 60) { // 5 minutes in seconds
      setShowTimeAlert(true);
      setTimeout(() => setShowTimeAlert(false), 10000); // Hide after 10 seconds
    }
  }, [timeRemaining]);

  // Record time spent on questions
  useEffect(() => {
    if (!quiz || !quiz.questions[currentQuestionIndex] || isInitializing) return;
    
    const questionId = quiz.questions[currentQuestionIndex].questionId;
    
    // Start timer for this question
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
  }, [currentQuestionIndex, quiz, isInitializing]);
  
  // Mark a quiz as abandoned
  const markQuizAsAbandoned = async () => {
    if (!user || !user.schoolId || !quizId) return;
    
    try {
      console.debug('[QuizPage] Marking quiz as abandoned');
      
      // Find the student's current quiz session
      const resultsQuery = query(
        collection(db, "schools", user.schoolId, "quizResults"),
        where("quizId", "==", quizId),
        where("userId", "==", user.userId),
        where("completed", "==", false)
      );
      
      const resultsSnapshot = await getDocs(resultsQuery);
      
      // If there's an ongoing session, mark it as abandoned
      if (!resultsSnapshot.empty) {
        const resultDoc = resultsSnapshot.docs[0].ref;
        
        // Update the result with abandoned status
        await updateDoc(resultDoc, {
          abandoned: true,
          abandonedAt: Timestamp.now(),
          timestamp: Timestamp.now()
        });
        
        console.debug('[QuizPage] Quiz marked as abandoned');
      }
      
      // Update the quiz document to reflect student status
      const quizRef = doc(db, "schools", user.schoolId, "quizzes", quizId as string);
      
      // Remove the user from activeUsers array
      const quizDoc = await getDoc(quizRef);
      if (quizDoc.exists()) {
        const quizData = quizDoc.data() as Quiz;
        const updatedActiveUsers = (quizData.activeUsers || []).filter(id => id !== user.userId);
        
        // Update with filtered array or remove field if empty
        if (updatedActiveUsers.length > 0) {
          await updateDoc(quizRef, {
            activeUsers: updatedActiveUsers
          });
        } else {
          await updateDoc(quizRef, {
            activeUsers: deleteField(),
            inProgress: false
          });
        }
      }
      
      // Record in the cheatingAttempts with a special type
      await recordCheatAttempt(quizId as string, {
        type: 'quiz_abandoned',
        description: 'Student abandoned the quiz by closing the browser or navigating away'
      });
      
      console.debug('[QuizPage] Quiz abandonment recorded successfully');
    } catch (error) {
      console.error('[QuizPage] Error marking quiz as abandoned:', error);
    }
  };
  
  // Set up anti-cheating monitoring
  useEffect(() => {
    if (!quiz || !quiz.securityLevel || quiz.securityLevel === 'low' || isInitializing) return;
    
    // Handle tab/window visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleTabSwitch();
      }
    };
    
    // Handle browser window blur (user switched to another application)
    const handleBlur = () => {
      visibilityRef.blurCount++;
      visibilityRef.focusHistory.push({
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
      const timeSinceLastFocus = (now.getTime() - visibilityRef.lastFocused.getTime()) / 1000;
      
      visibilityRef.focusHistory.push({
        timestamp: now,
        action: 'focus'
      });
      
      visibilityRef.lastFocused = now;
      
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
          title: "Внимание",
          description: "Копирането на съдържание по време на тест не е позволено",
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
        // Record cheating attempt and mark as abandoned
        recordCheatAttempt(quizId as string, {
          type: 'browser_close',
          description: 'User closed or refreshed the browser'
        });
        
        // Mark quiz as abandoned
        markQuizAsAbandoned();
        
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
  }, [quiz, quizId, recordCheatAttempt, isInitializing, handleTabSwitch, handleCheatingDetected, markQuizAsAbandoned]);
  
  // Function to handle changes to the user's answers
  const handleAnswerChange = (id: string, answer: string | string[]) => {
    console.debug(`[QuizPage] Answer changed for question ${id}:`, answer);
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
        questionPoints = 0; // Open-ended questions require manual grading
      } else {
        const correctAnswers = Array.isArray(question.correctAnswer)
          ? question.correctAnswer
          : [question.correctAnswer];

        const userAnswers = Array.isArray(userAnswer)
          ? userAnswer
          : [userAnswer];

        const isCorrect = 
          question.type === "multipleChoice" 
            ? correctAnswers.every(ans => userAnswers.includes(ans)) &&
              userAnswers.every(ans => correctAnswers.includes(ans))
            : correctAnswers.some(ans => userAnswers.includes(ans));
            
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

    console.debug('[QuizPage] Submitting quiz');
    setIsSubmitting(true);
    try {
      // Calculate the user's score
      const score = calculateScore();
      const totalPoints = getTotalPossiblePoints();
      
      // Save student name for easier reference
      const studentName = user.firstName + ' ' + user.lastName;

      // Create quiz result with all data
      const result = {
        quizId: quiz.quizId,
        userId: user.userId,
        answers,
        score,
        totalPoints,
        questionTimeSpent,
        totalTimeSpent: quizStartTime 
          ? Math.floor((new Date().getTime() - quizStartTime.getTime()) / 1000)
          : 0,
        startedAt: quizStartTime ? Timestamp.fromDate(quizStartTime) : Timestamp.now(),
        securityViolations: warningCount || 0,
        studentName
      };

      // Submit using context function
      await submitQuizResult(result);
      console.debug('[QuizPage] Quiz submitted successfully');

      toast({
        title: "Тестът е предаден успешно!",
        description: `Вашият резултат: ${score}/${totalPoints} точки`,
      });
      
      // Use window.location.href to force a full page reload/refresh
      // This ensures all data is refreshed when returning to the quizzes page
      window.location.href = `/dashboard/${user?.schoolId}`;
    } catch (error) {
      console.error('[QuizPage] Error submitting quiz:', error);
      toast({
        title: "Грешка",
        description: "Грешка при предаване на теста. Моля, опитайте отново.",
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

  // Loading state
  if (isInitializing && !quiz) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 p-8 flex justify-center items-center">
          <p>Зареждане на теста...</p>
        </div>
      </div>
    );
  }
  if (!quiz) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 p-8 flex justify-center items-center">
          <p>Тестът не е намерен</p>
        </div>
      </div>
    );
  }
  // Prevent access if the user has no attempts remaining
  if (remainingAttempts <= 0 && quiz.maxAttempts > 0) {
    console.debug(`[QuizPage] Access denied - No remaining attempts: ${remainingAttempts} (max: ${quiz.maxAttempts})`);
    console.debug(`[QuizPage] TookTest array for this user:`, quiz.tookTest?.filter(id => id === user?.userId));
    
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 p-8 flex flex-col justify-center items-center">
          <AlertCircle className="h-16 w-16 text-amber-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Вече сте изпълнили този тест</h1>
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
                Ниво на сигурност: {quiz.securityLevel === 'extreme' ? 'Екстремно' :
                                   quiz.securityLevel === 'high' ? 'Високо' :
                                   quiz.securityLevel === 'medium' ? 'Средно' :
                                   'Ниско'}
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
            <span>Напредък</span>
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
                  {currentQuestion.choices?.map((choice, idx) => (
                    <div key={choice.choiceId} className="flex items-center space-x-2 p-3 border rounded-md">
                      <RadioGroupItem id={choice.choiceId} value={idx.toString()} />
                      <Label htmlFor={choice.choiceId}>{choice.text}</Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <div className="space-y-3">
                  {currentQuestion.choices?.map((choice, idx) => {
                    const isChecked = Array.isArray(answers[currentQuestion.questionId])
                      ? (answers[currentQuestion.questionId] as string[]).includes(idx.toString())
                      : false;
                    
                    return (
                      <div key={choice.choiceId} className="flex items-center space-x-2 p-3 border rounded-md">
                        <Checkbox
                          id={choice.choiceId}
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            const currentAnswers = (answers[currentQuestion.questionId] as string[]) || [];
                            if (checked) {
                              handleAnswerChange(currentQuestion.questionId, [...currentAnswers, idx.toString()]);
                            } else {
                              handleAnswerChange(
                                currentQuestion.questionId,
                                currentAnswers.filter((id) => id !== idx.toString())
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
              onClick={() => {
                setCurrentQuestionIndex((prev) => Math.max(0, prev - 1));
                saveProgress();
              }}
              disabled={currentQuestionIndex === 0}
            >
              Предишен
            </Button>

            {currentQuestionIndex < quiz.questions.length - 1 ? (
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  setCurrentQuestionIndex((prev) => prev + 1);
                  saveProgress();
                }}
              >
                Следващ
              </Button>
            ) : (
              <Button
              onClick={(e) => {
                e.preventDefault(); // Prevent any default form submission
                setShowConfirmSubmit(true);
              }}
                disabled={isSubmitting}
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
                onClick={(e) => {
                  e.preventDefault();
                  setCurrentQuestionIndex(idx);
                  saveProgress();
                }}
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
              <AlertTriangle className="h-5 w-5 mr-2" /> Предупреждение
            </DialogTitle>
            <DialogDescription>
              Превключването между табове или напускането на страницата с теста не е позволено и може да бъде отчетено като опит за измама.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Това действие е записано. Множество нарушения може да доведат до автоматично предаване на теста или дисквалификация.
            </p>
            <p className="text-sm font-semibold mt-2">
              Предупреждение {warningCount} от {quiz.securityLevel === 'extreme' ? '2' : quiz.securityLevel === 'high' ? '3' : '∞'}
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowWarningDialog(false)}>
              Разбирам
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Submit Confirmation Dialog */}
      <Dialog open={showConfirmSubmit} onOpenChange={setShowConfirmSubmit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Предаване на теста</DialogTitle>
            <DialogDescription>
              Сигурни ли сте, че искате да предадете теста? Това действие не може да бъде отменено.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm font-medium">Обобщение на теста:</p>
            <p className="text-sm text-muted-foreground mt-1">
              Отговорени въпроси: {Object.keys(answers).length} от {quiz.questions.length}
            </p>
            {Object.keys(answers).length < quiz.questions.length && (
              <p className="text-sm text-amber-500 mt-1">
                Внимание: Имате {quiz.questions.length - Object.keys(answers).length} неотговорени въпроса.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmSubmit(false)}>
              Отказ
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Предаване..." : "Предай теста"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Time Alert */}
      <Dialog open={showTimeAlert} onOpenChange={setShowTimeAlert}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center text-amber-500">
              <Timer className="h-5 w-5 mr-2" /> Предупреждение за време
            </DialogTitle>
            <DialogDescription>
              Остават ви 5 минути да завършите теста.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowTimeAlert(false)}>
              Разбирам
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
