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

interface GradeWithId extends Grade {
  id: string; // Add the document ID to the grade
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

  const calculateGPA = () => {
    if (grades.length === 0) return 0;
    const totalPoints = grades.reduce((sum, grade) => sum + grade.value, 0);
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
                  <TableHead>Teacher</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grades.map((grade) => (
                  <TableRow key={grade.id}>
                    <TableCell>{grade.subjectName}</TableCell>
                    <TableCell>{grade.teacherName}</TableCell>
                    <TableCell>{grade.value}</TableCell>
                    <TableCell>
                      {(grade.timestamp as Timestamp).toDate().toLocaleString()}
                    </TableCell>
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
