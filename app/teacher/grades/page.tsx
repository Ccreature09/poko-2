"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import {
  collection,
  query,
  where,
  getDocs,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Sidebar from "@/components/functional/Sidebar";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { GradeType, Grade as LibGrade } from "@/lib/interfaces";
import { addGrade, updateGrade, deleteGrade } from "@/lib/gradeManagement";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
}

interface Subject {
  id: string;
  name: string;
}

// Extend the LibGrade type to ensure id is required in our component
interface Grade extends Omit<LibGrade, 'id'> {
  id: string; // Make id required
}

export default function AddGrades() {
  const { user } = useUser();
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [gradeValue, setGradeValue] = useState("");
  const [gradeTitle, setGradeTitle] = useState("");
  const [gradeDescription, setGradeDescription] = useState("");
  const [gradeType, setGradeType] = useState<GradeType>("test");
  const [gradeDate, setGradeDate] = useState(
    new Date().toISOString().split("T")[0]
  );

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

  const gradeTypes: { value: GradeType; label: string }[] = [
    { value: "exam", label: "Изпит" },
    { value: "test", label: "Тест" },
    { value: "homework", label: "Домашна работа" },
    { value: "participation", label: "Участие" },
    { value: "project", label: "Проект" },
    { value: "other", label: "Друго" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.schoolId) return;

    const parsedValue = Number.parseFloat(gradeValue);
    if (parsedValue < 2 || parsedValue > 6) {
      alert(
        "Оценката трябва да бъде между 2 и 6 според българската система за оценяване."
      );
      return;
    }

    try {
      const newGrade = await addGrade(
        user.schoolId,
        selectedStudent,
        selectedSubject,
        user.userId,
        {
          value: parsedValue,
          title: gradeTitle,
          description: gradeDescription,
          type: gradeType,
          date: new Date(gradeDate)
        }
      );
      
      setGrades([...grades, { ...newGrade, id: newGrade.id ?? "" }]);

      setSelectedStudent("");
      setSelectedSubject("");
      setGradeValue("");
      setGradeTitle("");
      setGradeDescription("");
      setGradeType("test");
      setGradeDate(new Date().toISOString().split("T")[0]);
      
      toast({
        title: "Оценката е добавена успешно",
        description: `Оценка ${parsedValue} е добавена за ученика.`
      });
    } catch (error) {
      console.error("Error adding grade:", error);
      toast({
        title: "Грешка при добавяне на оценка",
        description: "Моля, опитайте отново.",
        variant: "destructive"
      });
    }
  };

  const handleUpdateGrade = async (
    gradeId: string,
    field: keyof Grade,
    value: number
  ) => {
    if (!user || !user.schoolId) return;

    if (field === "value") {
      const numValue = Number(value);
      if (numValue < 2 || numValue > 6) {
        alert(
          "Оценката трябва да бъде между 2 и 6 според българската система за оценяване."
        );
        return;
      }
    }

    try {
      await updateGrade(user.schoolId, gradeId, {
        [field]: value,
      });
      
      // Update the grade in the local state
      setGrades(
        grades.map((grade) =>
          grade.id === gradeId ? { ...grade, [field]: value } : grade
        )
      );
      
      toast({
        title: "Оценката е обновена успешно",
        description: `Оценката е променена на ${value}.`
      });
    } catch (error) {
      console.error("Error updating grade:", error);
      toast({
        title: "Грешка при обновяване на оценката",
        description: "Моля, опитайте отново.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteGrade = async (gradeId: string) => {
    if (!user || !user.schoolId) return;

    try {
      await deleteGrade(user.schoolId, gradeId);
      setGrades(grades.filter((grade) => grade.id !== gradeId));
      toast({ title: "Оценката е изтрита успешно." });
    } catch (error) {
      console.error("Error deleting grade:", error);
    }
  };

  const getGradeColor = (grade: number) => {
    if (grade >= 5.5) return "text-emerald-600 font-semibold";
    if (grade >= 4.5) return "text-blue-600 font-semibold";
    if (grade >= 3.5) return "text-yellow-600";
    if (grade >= 3) return "text-orange-600";
    return "text-red-600";
  };

  const gradeOptions = [
    { value: "2", label: "Слаб (2)" },
    { value: "3", label: "Среден (3)" },
    { value: "4", label: "Добър (4)" },
    { value: "5", label: "Много добър (5)" },
    { value: "6", label: "Отличен (6)" },
  ];

  if (!user || user.role !== "teacher") return null;

  const sortedGrades = [...grades].sort((a, b) => {
    const dateCompare = b.date.seconds - a.date.seconds;
    if (dateCompare !== 0) return dateCompare;

    const studentA = students.find((s) => s.id === a.studentId);
    const studentB = students.find((s) => s.id === b.studentId);
    return (studentA?.lastName ?? "").localeCompare(studentB?.lastName ?? "");
  });

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar className="hidden lg:block" />
      <div className="flex-1 pt-16 lg:pt-4 px-4 lg:px-8">
        <div className="max-w-5xl mx-auto pb-12">
          <h1 className="text-2xl md:text-3xl font-bold mb-6 mt-4 text-gray-800">
            Добавяне на оценки
          </h1>
          <Card className="mb-8 shadow-md">
            <CardHeader className="border-b bg-white">
              <CardTitle className="text-xl text-gray-800">
                Добавяне на нова оценка
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="student" className="text-gray-700">
                      Ученик
                    </Label>
                    <Select
                      onValueChange={setSelectedStudent}
                      value={selectedStudent}
                    >
                      <SelectTrigger className="bg-white border-gray-200">
                        <SelectValue placeholder="Изберете ученик" />
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

                  <div className="space-y-2">
                    <Label htmlFor="subject" className="text-gray-700">
                      Предмет
                    </Label>
                    <Select
                      onValueChange={setSelectedSubject}
                      value={selectedSubject}
                    >
                      <SelectTrigger className="bg-white border-gray-200">
                        <SelectValue placeholder="Изберете предмет" />
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

                  <div className="space-y-2">
                    <Label htmlFor="gradeTitle" className="text-gray-700">
                      Заглавие
                    </Label>
                    <Input
                      id="gradeTitle"
                      value={gradeTitle}
                      onChange={(e) => setGradeTitle(e.target.value)}
                      placeholder="Напр. Контролно работа 1"
                      className="border-gray-200"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gradeType" className="text-gray-700">
                      Вид оценка
                    </Label>
                    <Select
                      onValueChange={(value) =>
                        setGradeType(value as GradeType)
                      }
                      value={gradeType}
                    >
                      <SelectTrigger className="bg-white border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {gradeTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="grade" className="text-gray-700">
                      Оценка
                    </Label>
                    <Select onValueChange={setGradeValue} value={gradeValue}>
                      <SelectTrigger className="bg-white border-gray-200">
                        <SelectValue placeholder="Изберете оценка" />
                      </SelectTrigger>
                      <SelectContent>
                        {gradeOptions.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                            className={getGradeColor(Number(option.value))}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gradeDate" className="text-gray-700">
                      Дата
                    </Label>
                    <Input
                      type="date"
                      id="gradeDate"
                      value={gradeDate}
                      onChange={(e) => setGradeDate(e.target.value)}
                      className="border-gray-200"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gradeDescription" className="text-gray-700">
                    Описание
                  </Label>
                  <Textarea
                    id="gradeDescription"
                    value={gradeDescription}
                    onChange={(e) => setGradeDescription(e.target.value)}
                    placeholder="Добавете допълнителна информация за оценката"
                    className="min-h-[100px] border-gray-200"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-colors py-6"
                  disabled={
                    !selectedStudent ||
                    !selectedSubject ||
                    !gradeValue ||
                    !gradeTitle
                  }
                >
                  Добавяне на оценка
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader className="border-b bg-white">
              <CardTitle className="text-xl text-gray-800">
                Съществуващи оценки
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-gray-700">Дата</TableHead>
                      <TableHead className="text-gray-700">Ученик</TableHead>
                      <TableHead className="text-gray-700">Предмет</TableHead>
                      <TableHead className="text-gray-700">Вид</TableHead>
                      <TableHead className="text-gray-700">Заглавие</TableHead>
                      <TableHead className="text-gray-700 text-center">
                        Оценка
                      </TableHead>
                      <TableHead className="text-gray-700">Промяна</TableHead>
                      <TableHead className="text-gray-700">Изтриване</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedGrades.map((grade) => (
                      <TableRow
                        key={grade.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <TableCell className="whitespace-nowrap">
                          {new Date(
                            grade.date.seconds * 1000
                          ).toLocaleDateString("bg-BG")}
                        </TableCell>
                        <TableCell className="font-medium">
                          {
                            students.find((s) => s.id === grade.studentId)
                              ?.firstName
                          }{" "}
                          {
                            students.find((s) => s.id === grade.studentId)
                              ?.lastName
                          }
                        </TableCell>
                        <TableCell>
                          {subjects.find((s) => s.id === grade.subjectId)?.name}
                        </TableCell>
                        <TableCell>
                          {
                            gradeTypes.find((t) => t.value === grade.type)
                              ?.label
                          }
                        </TableCell>
                        <TableCell
                          className="max-w-[200px] truncate"
                          title={grade.title}
                        >
                          {grade.title}
                        </TableCell>
                        <TableCell
                          className={`text-center ${getGradeColor(
                            grade.value
                          )}`}
                        >
                          {grade.value}
                        </TableCell>
                        <TableCell>
                          <Select
                            onValueChange={(value) =>
                              handleUpdateGrade(
                                grade.id,
                                "value",
                                Number(value)
                              )
                            }
                            defaultValue={grade.value.toString()}
                          >
                            <SelectTrigger className="w-[100px] bg-white border-gray-200">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {gradeOptions.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                  className={getGradeColor(
                                    Number(option.value)
                                  )}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="w-5 h-5" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Изтриване на оценка</DialogTitle>
                                <DialogDescription>
                                  Сигурни ли сте, че искате да изтриете тази
                                  оценка? Това действие не може да бъде
                                  отменено.
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <Button
                                  variant="outline"
                                  onClick={() => handleDeleteGrade(grade.id)}
                                >
                                  Изтриване
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}