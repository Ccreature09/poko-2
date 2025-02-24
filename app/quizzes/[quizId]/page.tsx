"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { Quiz } from "@/lib/interfaces";
import Sidebar from "@/components/functional/Sidebar";
import { Button } from "@/components/ui/button";
import { useQuiz } from "@/contexts/QuizContext";
import { db } from "@/lib/firebase";
import {
  doc,
  collection,
  setDoc,
  updateDoc,
  Timestamp,
  arrayUnion,
} from "firebase/firestore";
import { toast } from "@/hooks/use-toast";

export default function QuizPage() {
  const router = useRouter();
  const { user } = useUser();
  const { quizzes } = useQuiz();
  const { quizId } = useParams();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (quizId && quizzes.length > 0) {
      // Find the quiz with the matching quizId
      const foundQuiz = quizzes.find((q) => q.quizId === quizId);
      setQuiz(foundQuiz || null);
      // Reset state when quiz changes
      setAnswers({});
      setCurrentQuestionIndex(0);
    }
  }, [quizId, quizzes]);

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
    return quiz?.points || 0;
  };

  // Add points and tookTest fields to the quiz object
  const handleSubmit = async () => {
    if (!user || !quiz) return;

    setIsSubmitting(true);
    try {
      // Calculate the user's score
      const score = calculateScore();
      const totalPoints = getTotalPossiblePoints();

      // Submit quiz result
      const result = {
        quizId: quiz.quizId,
        userId: user.userId,
        answers,
        score,
        totalPoints,
        timestamp: Timestamp.now(),
      };

      const resultDoc = doc(
        collection(db, "schools", user.schoolId, "quizResults")
      );
      await setDoc(resultDoc, result);

      // Update quiz with user participation
      const quizRef = doc(db, "schools", user.schoolId, "quizzes", quiz.quizId);
      await updateDoc(quizRef, {
        points: score,
        tookTest: arrayUnion(user.userId),
      });

      toast({
        title: "Quiz Submitted!",
        description: `Your score: ${score}/${totalPoints} points`,
      });
    } catch (error) {
      console.error("Error submitting quiz:", error);
      toast({
        title: "Error",
        description: "Failed to submit quiz. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      router.push(`/dashboard/${user?.schoolId}`);
    }
  };

  // Check if the user has already taken the quiz
  const hasTakenQuiz = quiz?.tookTest.includes(user?.userId || "");
  console.log(hasTakenQuiz);
  if (!quiz) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 p-8 overflow-auto">Зареждане на теста...</div>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  if (!currentQuestion) return null;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <h1 className="text-3xl font-bold mb-8">{quiz.title}</h1>
        <p className="text-muted-foreground mb-4">{quiz.description}</p>

        <div key={currentQuestion.questionId} className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <span>
              Въпрос {currentQuestionIndex + 1} от {quiz.questions.length}
              <span className="ml-2 text-sm text-muted-foreground">
                ({currentQuestion.points} points)
              </span>
            </span>
            <span>
              Резултат: {calculateScore()}/{getTotalPossiblePoints()} точки
            </span>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">{currentQuestion.text}</h3>

            {currentQuestion.type === "openEnded" ? (
              <textarea
                key={currentQuestion.questionId}
                value={(answers[currentQuestion.questionId] as string) || ""}
                onChange={(e) =>
                  handleAnswerChange(currentQuestion.questionId, e.target.value)
                }
                className="w-full p-2 border rounded"
                placeholder="Въведете отговора си тук..."
              />
            ) : (
              currentQuestion.choices?.map((choice) => (
                <div
                  key={choice.choiceId}
                  className="flex items-center space-x-2"
                >
                  <input
                    key={`${currentQuestion.questionId}-${choice.choiceId}`}
                    type={
                      currentQuestion.type === "singleChoice"
                        ? "radio"
                        : "checkbox"
                    }
                    id={choice.choiceId}
                    name={currentQuestion.questionId}
                    value={choice.choiceId}
                    checked={
                      Array.isArray(answers[currentQuestion.questionId])
                        ? (
                            answers[currentQuestion.questionId] as string[]
                          ).includes(choice.choiceId)
                        : answers[currentQuestion.questionId] ===
                          choice.choiceId
                    }
                    onChange={(e) => {
                      const value = e.target.value;
                      if (currentQuestion.type === "singleChoice") {
                        handleAnswerChange(currentQuestion.questionId, value);
                      } else {
                        const prevAnswers =
                          (answers[currentQuestion.questionId] as string[]) ||
                          [];
                        const newAnswers = e.target.checked
                          ? [...prevAnswers, value]
                          : prevAnswers.filter((id) => id !== value);
                        handleAnswerChange(
                          currentQuestion.questionId,
                          newAnswers
                        );
                      }
                    }}
                  />
                  <label htmlFor={choice.choiceId}>{choice.text}</label>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-between mt-8">
            <Button
              onClick={() =>
                setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))
              }
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
                onClick={handleSubmit}
                disabled={
                  isSubmitting ||
                  !answers[currentQuestion.questionId] ||
                  hasTakenQuiz
                }
              >
                {isSubmitting
                  ? "Изпращане..."
                  : hasTakenQuiz
                  ? "Вече сте направили теста"
                  : "Изпрати теста"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
