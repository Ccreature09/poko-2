"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Sidebar from "@/components/Sidebar";

interface Grade {
  id: string;
  subjectId: string;
  subjectName: string;
  grade: number;
  semester: string;
}

export default function ReportCard() {
  const { user } = useAuth();
  const [grades, setGrades] = useState<Grade[]>([]);

  useEffect(() => {
    const fetchGrades = async () => {
      if (!user || !user.schoolId) return;

      const gradesRef = collection(db, "schools", user.schoolId, "grades");
      const q = query(gradesRef, where("studentId", "==", user.userId));
      const querySnapshot = await getDocs(q);
      const fetchedGrades = querySnapshot.docs.map(
        (doc) => ({ ...doc.data(), id: doc.id } as Grade)
      );
      setGrades(fetchedGrades);
    };

    fetchGrades();
  }, [user]);

  const calculateGPA = () => {
    if (grades.length === 0) return 0;
    const totalPoints = grades.reduce((sum, grade) => sum + grade.grade, 0);
    return (totalPoints / grades.length).toFixed(2);
  };

  if (!user) return null;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <h1 className="text-3xl font-bold mb-8">Report Card</h1>
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Overall GPA</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{calculateGPA()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Grades by Subject</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Semester</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grades.map((grade) => (
                  <TableRow key={grade.id}>
                    <TableCell>{grade.subjectName}</TableCell>
                    <TableCell>{grade.grade}</TableCell>
                    <TableCell>{grade.semester}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
