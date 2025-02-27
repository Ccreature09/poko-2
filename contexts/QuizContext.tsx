"use client";

import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { collection, getDocs, query, doc, updateDoc, arrayUnion, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Quiz, CheatAttempt, QuizResult } from "@/lib/interfaces";
import { useUser } from "@/contexts/UserContext";
import { Timestamp } from "firebase/firestore";

type QuizContextType = {
  quizzes: Quiz[];
  loading: boolean;
  error: string | null;
  recordCheatAttempt: (quizId: string, attemptData: Omit<CheatAttempt, 'timestamp'>) => Promise<void>;
  submitQuizResult: (quizResult: Omit<QuizResult, 'timestamp'>) => Promise<void>;
  isQuizAvailable: (quiz: Quiz) => boolean;
  getRemainingAttempts: (quiz: Quiz) => number;
  getQuizAttemptsForUser: (quizId: string) => Promise<number>;
};

const QuizContext = createContext<QuizContextType>({
  quizzes: [],
  loading: false,
  error: null,
  recordCheatAttempt: async () => {},
  submitQuizResult: async () => {},
  isQuizAvailable: () => false,
  getRemainingAttempts: () => 0,
  getQuizAttemptsForUser: async () => 0,
});

export const useQuiz = () => useContext(QuizContext);

export const QuizProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useUser();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuizzes = async () => {
      setLoading(true);
      setError(null);
      if (!user || !user.schoolId) return;
      try {
        const q = query(
          collection(db, "schools", user.schoolId, "quizzes"),
        );
        const quizzesSnapshot = await getDocs(q);
        const quizzesList = quizzesSnapshot.docs.map(
          (doc) => ({ ...doc.data(), quizId: doc.id } as Quiz)
        );
        
        // Apply quiz availability filtering logic based on student role
        if (user.role === 'student') {
          // Only show quizzes that are available for the student's classes
          const availableQuizzes = quizzesList.filter(quiz => 
            quiz.classIds.includes(user.homeroomClassId || '') && 
            isQuizAvailable(quiz)
          );
          console.log("Available quizzes for student:", availableQuizzes);
          console.log("All quizzes:", quizzesList);
          console.log("User's homeroom class ID:", user.homeroomClassId);
          setQuizzes(availableQuizzes);
        } else {
          // Teachers and admins see all quizzes
          setQuizzes(quizzesList);
        }
      } catch (err) {
        console.error("Failed to fetch quizzes:", err);
        setError("Failed to fetch quizzes");
      } finally {
        setLoading(false);
      }
    };

    fetchQuizzes();
  }, [user]);

  // Check if a quiz is available based on time constraints
  const isQuizAvailable = (quiz: Quiz): boolean => {
    const now = Timestamp.now();
    
    // Check if quiz is active
    
    // Check availability window
    if (quiz.availableFrom && now.toMillis() < quiz.availableFrom.toMillis()) return false;
    if (quiz.availableTo && now.toMillis() > quiz.availableTo.toMillis()) return false;
    
    return true;
  };

  // Get remaining attempts for a student
  const getRemainingAttempts = (quiz: Quiz): number => {
    if (!user) return 0;
    
    // Check if the student has already taken the quiz
    const hasTaken = quiz.tookTest && quiz.tookTest.includes(user.userId);
    
    // If student has already taken the quiz and multiple attempts aren't allowed, return 0
    if (hasTaken && quiz.maxAttempts <= 1) return 0;
    
    // For simplicity, return the max attempts (we'll need to check attempts asynchronously later)
    // This avoids the Type error with Promise<number>
    return quiz.maxAttempts || 1;
  };

  // This is the async version that should be called separately when needed
  const getQuizAttemptsForUser = async (quizId: string): Promise<number> => {
    if (!user || !user.schoolId) return 0;

    try {
      const resultsQuery = query(
        collection(db, "schools", user.schoolId, "quizResults")
      );
      
      const resultsSnapshot = await getDocs(resultsQuery);
      const userResults = resultsSnapshot.docs
        .map(doc => doc.data() as QuizResult)
        .filter(result => 
          result.quizId === quizId && result.userId === user.userId
        );
      
      return userResults.length;
    } catch (err) {
      console.error("Error getting quiz attempts:", err);
      return 0;
    }
  };

  // Record a cheating attempt
  const recordCheatAttempt = async (quizId: string, attemptData: Omit<CheatAttempt, 'timestamp'>): Promise<void> => {
    if (!user || !user.schoolId) return;
    
    try {
      const quizRef = doc(db, "schools", user.schoolId, "quizzes", quizId);
      
      const cheatAttempt: CheatAttempt = {
        ...attemptData,
        timestamp: Timestamp.now()
      };
      
      // Add the cheat attempt to the quiz document
      await updateDoc(quizRef, {
        [`cheatingAttempts.${user.userId}`]: arrayUnion(cheatAttempt)
      });
      
    } catch (err) {
      console.error("Error recording cheat attempt:", err);
    }
  };

  // Submit quiz result
  const submitQuizResult = async (quizResult: Omit<QuizResult, 'timestamp'>): Promise<void> => {
    if (!user || !user.schoolId) return;
    
    try {
      // Add timestamp to the result
      const resultWithTimestamp: QuizResult = {
        ...quizResult,
        timestamp: Timestamp.now()
      };
      
      // Save the quiz result
      const resultDoc = doc(collection(db, "schools", user.schoolId, "quizResults"));
      await setDoc(resultDoc, resultWithTimestamp);
      
      // Update the quiz with the user's completion
      const quizRef = doc(db, "schools", user.schoolId, "quizzes", quizResult.quizId);
      await updateDoc(quizRef, {
        tookTest: arrayUnion(user.userId)
      });
      
    } catch (err) {
      console.error("Error submitting quiz result:", err);
      throw err; // Re-throw for the component to handle
    }
  };

  return (
    <QuizContext.Provider value={{ 
      quizzes, 
      loading, 
      error, 
      recordCheatAttempt, 
      submitQuizResult,
      isQuizAvailable,
      getRemainingAttempts,
      getQuizAttemptsForUser 
    }}>
      {children}
    </QuizContext.Provider>
  );
};
