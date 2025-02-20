"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Sidebar from "@/components/Sidebar";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
}

interface Subject {
  id: string;
  name: string;
}

interface Grade {
  id: string;
  studentId: string;
  subjectId: string;
  value: number;
}

export default function AddGrades() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [gradeValue, setGradeValue] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !user.schoolId) return;

      const studentsRef = collection(db, "schools", user.schoolId, "users");
      const studentsQuery = query(studentsRef, where("role", "==", "student"));
      const studentsSnapshot = await getDocs(studentsQuery);
      setStudents(
        studentsSnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Student)
        )
      );

      const subjectsRef = collection(db, "schools", user.schoolId, "subjects");
      const subjectsSnapshot = await getDocs(subjectsRef);
      setSubjects(
        subjectsSnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Subject)
        )
      );

      const gradesRef = collection(db, "schools", user.schoolId, "grades");
      const gradesSnapshot = await getDocs(gradesRef);
      setGrades(
        gradesSnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Grade)
        )
      );
    };

    fetchData();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.schoolId) return;

    const gradeData = {
      studentId: selectedStudent,
      subjectId: selectedSubject,
      value: Number.parseFloat(gradeValue),
      teacherId: user.userId,
      timestamp: new Date(),
    };

    try {
      const gradesRef = collection(db, "schools", user.schoolId, "grades");
      const newGradeRef = await addDoc(gradesRef, gradeData);
      setGrades([...grades, { id: newGradeRef.id, ...gradeData }]);
      setSelectedStudent("");
      setSelectedSubject("");
      setGradeValue("");
    } catch (error) {
      console.error("Error adding grade:", error);
    }
  };

  const handleUpdateGrade = async (gradeId: string, newValue: number) => {
    if (!user || !user.schoolId) return;

    try {
      const gradeRef = doc(db, "schools", user.schoolId, "grades", gradeId);
      await updateDoc(gradeRef, { value: newValue });
      setGrades(
        grades.map((grade) =>
          grade.id === gradeId ? { ...grade, value: newValue } : grade
        )
      );
    } catch (error) {
      console.error("Error updating grade:", error);
    }
  };

  if (!user || user.role !== "teacher") return null;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <h1 className="text-3xl font-bold mb-8">Add Grades</h1>
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Add New Grade</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="student">Student</Label>
                <Select
                  onValueChange={setSelectedStudent}
                  value={selectedStudent}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.firstName} {student.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Select
                  onValueChange={setSelectedSubject}
                  value={selectedSubject}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="grade">Grade</Label>
                <Input
                  id="grade"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={gradeValue}
                  onChange={(e) => setGradeValue(e.target.value)}
                  required
                />
              </div>
              <Button type="submit">Add Grade</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Existing Grades</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grades.map((grade) => (
                  <TableRow key={grade.id}>
                    <TableCell>
                      {
                        students.find((s) => s.id === grade.studentId)
                          ?.firstName
                      }{" "}
                      {students.find((s) => s.id === grade.studentId)?.lastName}
                    </TableCell>
                    <TableCell>
                      {subjects.find((s) => s.id === grade.subjectId)?.name}
                    </TableCell>
                    <TableCell>{grade.value}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        defaultValue={grade.value}
                        onChange={(e) =>
                          handleUpdateGrade(
                            grade.id,
                            Number.parseFloat(e.target.value)
                          )
                        }
                        className="w-20"
                      />
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
