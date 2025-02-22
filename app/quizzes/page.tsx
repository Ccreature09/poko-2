"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Quiz } from "@/lib/interfaces";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { useQuiz } from "@/contexts/QuizContext";
import { Button } from "@/components/ui/button";

export default function Quizzes() {
  const { user } = useUser();
  const { quizzes } = useQuiz();

  const calculateTotalPoints = (quiz: Quiz) => {
    return quiz.questions.reduce((total, question) => total + (question.points || 0), 0);
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <h1 className="text-3xl font-bold mb-8">My Quizzes</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quizzes.map((quiz) => {
            const hasTakenQuiz = quiz.tookTest.includes(user?.userId || "");
            return (
              <div key={quiz.quizId} className="relative">
                <Card className="hover:bg-muted/50 transition-colors">
                  <CardHeader>
                    <CardTitle>{quiz.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-2">{quiz.description}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        {quiz.questions.length} questions
                      </span>
                      <span className="text-sm font-medium">
                        {calculateTotalPoints(quiz)} points
                      </span>
                    </div>
                  </CardContent>
                </Card>
                {hasTakenQuiz ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
                    <span className="text-red-500 font-bold">Already took test</span>
                  </div>
                ) : (
                  <Link href={`/quizzes/${quiz.quizId}`} className="absolute inset-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}