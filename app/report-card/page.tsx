"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
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
import Sidebar from "@/components/functional/Sidebar";
import { Grade, Subject, User } from "@/lib/interfaces";
import { Timestamp } from "firebase/firestore";
import type { GradeType } from "@/lib/interfaces";

interface GradeWithId extends Grade {
  id: string;
  title: string;
  description?: string;
  type: GradeType;
  date: Timestamp;
  createdAt: Timestamp;
}

interface GradeWithDetails extends GradeWithId {
  subjectName: string;
  teacherName: string;
}

export default function ReportCard() {
  const { user } = useUser();
  const [grades, setGrades] = useState<GradeWithDetails[]>([]);

  useEffect(() => {
    const fetchGrades = async () => {
      if (!user || !user.schoolId) return;

      const gradesRef = collection(db, "schools", user.schoolId, "grades");
      const q = query(gradesRef, where("studentId", "==", user.userId));
      const querySnapshot = await getDocs(q);

      const fetchedGrades = await Promise.all(
        querySnapshot.docs.map(async (gradeDoc) => {
          const gradeData = gradeDoc.data() as GradeWithId;
          const subjectDocRef = doc(
            db,
            "schools",
            user.schoolId,
            "subjects",
            gradeData.subjectId
          );
          console.log(gradeData.teacherId);
          const teacherDocRef = doc(
            db,
            "schools",
            user.schoolId,
            "users",
            gradeData.teacherId
          );
          const subjectDoc = await getDoc(subjectDocRef);
          const teacherDoc = await getDoc(teacherDocRef);
          console.log(teacherDoc.data());
          return {
            ...gradeData,
            id: gradeDoc.id,
            subjectName: subjectDoc.exists()
              ? (subjectDoc.data() as Subject).name
              : "Unknown",
            teacherName: teacherDoc.exists()
              ? (teacherDoc.data() as User).firstName +
                " " +
                (teacherDoc.data() as User).lastName
              : "Unknown",
          };
        })
      );

      setGrades(fetchedGrades);
    };

    fetchGrades();
  }, [user]);

  const getGradeColor = (grade: number) => {
    if (grade >= 5.5) return "text-emerald-600 font-semibold";
    if (grade >= 4.5) return "text-blue-600 font-semibold";
    if (grade >= 3.5) return "text-yellow-600";
    if (grade >= 3) return "text-orange-600";
    return "text-red-600";
  };

  const gradeTypes: { value: GradeType; label: string }[] = [
    { value: 'exam', label: 'Изпит' },
    { value: 'test', label: 'Тест' },
    { value: 'homework', label: 'Домашна работа' },
    { value: 'participation', label: 'Участие' },
    { value: 'project', label: 'Проект' },
    { value: 'other', label: 'Друго' }
  ];

  // Group grades by subject and term (semester)
  const groupedGrades = grades.reduce((grouped, grade) => {
    if (!grouped[grade.subjectName]) {
      grouped[grade.subjectName] = [];
    }
    grouped[grade.subjectName].push(grade);
    return grouped;
  }, {} as Record<string, GradeWithDetails[]>);

  // Calculate subject averages
  const subjectAverages = Object.entries(groupedGrades).reduce((averages, [subject, grades]) => {
    const total = grades.reduce((sum, grade) => sum + grade.value, 0);
    averages[subject] = Number((total / grades.length).toFixed(2));
    return averages;
  }, {} as Record<string, number>);

  const calculateGPA = () => {
    if (grades.length === 0) return 0;
    const totalPoints = grades.reduce((sum, grade) => sum + grade.value, 0);
    return (totalPoints / grades.length).toFixed(2);
  };

  if (!user) return null;

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 p-4 md:p-8 overflow-auto">
        <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-8 text-gray-800">Успех</h1>
        
        <div className="grid gap-6 mb-6">
          <Card className="shadow-md">
            <CardHeader className="border-b bg-white">
              <CardTitle>Общ успех</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <p className={`text-4xl font-bold ${getGradeColor(Number(calculateGPA()))}`}>
                {calculateGPA()}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6">
          {Object.entries(groupedGrades).map(([subject, subjectGrades]) => (
            <Card key={subject} className="shadow-md">
              <CardHeader className="border-b bg-white">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-xl text-gray-800">{subject}</CardTitle>
                  <span className={`text-lg ${getGradeColor(subjectAverages[subject])}`}>
                    Среден успех: {subjectAverages[subject]}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-gray-700">Дата</TableHead>
                      <TableHead className="text-gray-700">Вид</TableHead>
                      <TableHead className="text-gray-700">Заглавие</TableHead>
                      <TableHead className="text-gray-700">Учител</TableHead>
                      <TableHead className="text-gray-700 text-center">Оценка</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subjectGrades
                      .sort((a, b) => b.date.seconds - a.date.seconds)
                      .map((grade) => (
                        <TableRow 
                          key={grade.id} 
                          className="hover:bg-gray-50 transition-colors"
                          title={grade.description || undefined}
                        >
                          <TableCell className="whitespace-nowrap">
                            {new Date(grade.date.seconds * 1000).toLocaleDateString('bg-BG')}
                          </TableCell>
                          <TableCell>
                            {gradeTypes.find(t => t.value === grade.type)?.label}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {grade.title}
                          </TableCell>
                          <TableCell>{grade.teacherName}</TableCell>
                          <TableCell className={`text-center ${getGradeColor(grade.value)}`}>
                            {grade.value}
                          </TableCell>
                        </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
