"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import Sidebar from "@/components/functional/Sidebar";

interface CoursePerformance {
  courseName: string;
  grade: number;
}

interface QuizScore {
  quizName: string;
  score: number;
}

export default function Statistics() {
  const { user } = useUser();
  const [coursePerformance, setCoursePerformance] = useState<
    CoursePerformance[]
  >([]);
  const [quizScores, setQuizScores] = useState<QuizScore[]>([]);

  useEffect(() => {
    const fetchStatistics = async () => {
      if (!user || !user.schoolId) return;

      // Fetch course performance
      const gradesRef = collection(db, "schools", user.schoolId, "grades");
      const gradesQuery = query(
        gradesRef,
        where("studentId", "==", user.userId)
      );
      const gradesSnapshot = await getDocs(gradesQuery);
      const grades = gradesSnapshot.docs.map((doc) => ({
        courseName: doc.data().subjectName,
        grade: doc.data().grade,
      }));
      setCoursePerformance(grades);

      // Fetch quiz scores
      const quizzesRef = collection(
        db,
        "schools",
        user.schoolId,
        "quizResults"
      );
      const quizzesQuery = query(
        quizzesRef,
        where("studentId", "==", user.userId)
      );
      const quizzesSnapshot = await getDocs(quizzesQuery);
      const quizzes = quizzesSnapshot.docs.map((doc) => ({
        quizName: doc.data().quizName,
        score: doc.data().score,
      }));
      setQuizScores(quizzes);
    };

    fetchStatistics();
  }, [user]);

  if (!user) return null;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <h1 className="text-3xl font-bold mb-8">Статистика</h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Представяне по курсове</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={coursePerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="courseName" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="grade" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Резултати от тестове</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={quizScores}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="quizName" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="score" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
