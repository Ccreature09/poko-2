"use client";

import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Quiz } from "@/lib/interfaces";
import { useUser } from "@/contexts/UserContext";

type QuizContextType = {
  quizzes: Quiz[];
  loading: boolean;
  error: string | null;
};

const QuizContext = createContext<QuizContextType>({
  quizzes: [],
  loading: false,
  error: null,
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
        collection(db, "schools",user?.schoolId,"quizzes"),
      );
      const quizzesSnapshot = await getDocs(q);
      const quizzesList = quizzesSnapshot.docs.map(
        (doc) => ({ ...doc.data(), quizId: doc.id } as Quiz)
      );
      console.log("quizoveteee: "+ quizzesList);
      setQuizzes(quizzesList);
    } catch {
      setError("Failed to fetch quizzes");
    } finally {
      setLoading(false);
    }
  };

  fetchQuizzes();
}, [user]);

  return (
    <QuizContext.Provider value={{ quizzes, loading, error}}>
      {children}
    </QuizContext.Provider>
  );
};
