"use client";

import type React from "react";
import { createContext, useContext, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Quiz } from "@/lib/interfaces";

type QuizContextType = {
  quizzes: Quiz[];
  loading: boolean;
  error: string | null;
  fetchQuizzes: (courseId: string) => Promise<void>;
};

const QuizContext = createContext<QuizContextType>({
  quizzes: [],
  loading: false,
  error: null,
  fetchQuizzes: async () => {},
});

export const useQuizContext = () => useContext(QuizContext);

export const QuizProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuizzes = async (courseId: string) => {
    setLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, "quizzes"),
        where("courseId", "==", courseId)
      );
      const quizzesSnapshot = await getDocs(q);
      const quizzesList = quizzesSnapshot.docs.map(
        (doc) => ({ ...doc.data(), quizId: doc.id } as Quiz)
      );
      setQuizzes(quizzesList);
    } catch {
      setError("Failed to fetch quizzes");
    } finally {
      setLoading(false);
    }
  };

  return (
    <QuizContext.Provider value={{ quizzes, loading, error, fetchQuizzes }}>
      {children}
    </QuizContext.Provider>
  );
};
