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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import Sidebar from "@/components/functional/Sidebar";
import { getTeacherGrades } from "@/lib/gradeManagement";
import { Users, BookOpen } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import type { GradeType } from "@/lib/interfaces";

interface Grade {
  id: string;
  studentId: string;
  subjectId: string;
  teacherId: string;
  value: number;
  title: string;
  description?: string;
  type: GradeType;
  date: Timestamp;
  createdAt: Timestamp;
}

interface GradeWithDetails extends Grade {
  studentName: string;
  subjectName: string;
}

interface Student {
  userId: string;
  firstName: string;
  lastName: string;
  classId?: string;
  yearGroup?: number;
}

interface ClassData {
  classId: string;
  name: string;
  yearGroup: number;
  studentIds: string[];
}

interface Subject {
  id: string;
  name: string;
  teacherIds: string[];
}

export default function ClassGradesView() {
  const { user } = useUser();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<GradeWithDetails[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [viewMode, setViewMode] = useState<"class" | "subject">("class");

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.schoolId || !user?.userId) return;

      try {
        // Fetch classes taught by the teacher
        const classesRef = collection(db, "schools", user.schoolId, "classes");
        const classesSnapshot = await getDocs(classesRef);
        const allClasses: ClassData[] = [];

        classesSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.teacherIds && data.teacherIds.includes(user.userId)) {
            allClasses.push({
              classId: doc.id,
              name: data.name,
              yearGroup: data.yearGroup,
              studentIds: data.studentIds || [],
            });
          }
        });

        setClasses(allClasses);

        // Fetch subjects taught by the teacher
        const subjectsRef = collection(
          db,
          "schools",
          user.schoolId,
          "subjects"
        );
        const subjectsQuery = query(
          subjectsRef,
          where("teacherIds", "array-contains", user.userId)
        );
        const subjectsSnapshot = await getDocs(subjectsQuery);

        const teacherSubjects = subjectsSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name,
          teacherIds: doc.data().teacherIds || [],
        }));

        setSubjects(teacherSubjects);

        // Fetch all students
        const studentsRef = collection(db, "schools", user.schoolId, "users");
        const studentsQuery = query(
          studentsRef,
          where("role", "==", "student")
        );
        const studentsSnapshot = await getDocs(studentsQuery);

        const allStudents = studentsSnapshot.docs.map((doc) => ({
          userId: doc.id,
          firstName: doc.data().firstName,
          lastName: doc.data().lastName,
          classId: doc.data().classId,
          yearGroup: doc.data().yearGroup,
        }));

        setStudents(allStudents);

        // Fetch all grades entered by the teacher
        const teacherGrades = await getTeacherGrades(
          user.schoolId,
          user.userId
        );

        // Enrich grades with student and subject details
        const gradesWithDetails = await Promise.all(
          teacherGrades.map(async (grade) => {
            const student = allStudents.find(
              (s) => s.userId === grade.studentId
            );

            // Get subject name
            const subjectDoc = await getDoc(
              doc(db, "schools", user.schoolId, "subjects", grade.subjectId)
            );
            const subjectName = subjectDoc.exists()
              ? subjectDoc.data().name
              : "Unknown Subject";

            return {
              ...grade,
              id:
                grade.id ||
                `${grade.studentId}-${grade.subjectId}-${Date.now()}`, // Ensure id is never undefined
              studentName: student
                ? `${student.firstName} ${student.lastName}`
                : "Unknown Student",
              subjectName,
            };
          })
        );

        setGrades(gradesWithDetails as GradeWithDetails[]);

        // Set default selections if available
        if (allClasses.length > 0) {
          setSelectedClass(allClasses[0].classId);
        }

        if (teacherSubjects.length > 0) {
          setSelectedSubject(teacherSubjects[0].id);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, [user]);

  const getGradeColor = (grade: number) => {
    if (grade >= 5.5) return "text-emerald-600 font-semibold";
    if (grade >= 4.5) return "text-blue-600 font-semibold";
    if (grade >= 3.5) return "text-yellow-600";
    if (grade >= 3) return "text-orange-600";
    return "text-red-600";
  };

  const getGradeType = (type: GradeType): string => {
    const types: Record<GradeType, string> = {
      exam: "Изпит",
      test: "Тест",
      homework: "Домашна работа",
      participation: "Участие",
      project: "Проект",
      other: "Друго",
    };

    return types[type] || type;
  };

  const calculateClassAverage = (classId: string, subjectId?: string) => {
    const classStudentIds =
      classes.find((c) => c.classId === classId)?.studentIds || [];
    const filteredGrades = grades.filter(
      (grade) =>
        classStudentIds.includes(grade.studentId) &&
        (subjectId ? grade.subjectId === subjectId : true)
    );

    if (filteredGrades.length === 0) return 0;

    const sum = filteredGrades.reduce((acc, grade) => acc + grade.value, 0);
    return parseFloat((sum / filteredGrades.length).toFixed(2));
  };

  const calculateStudentAverage = (studentId: string, subjectId?: string) => {
    const filteredGrades = grades.filter(
      (grade) =>
        grade.studentId === studentId &&
        (subjectId ? grade.subjectId === subjectId : true)
    );

    if (filteredGrades.length === 0) return 0;

    const sum = filteredGrades.reduce((acc, grade) => acc + grade.value, 0);
    return parseFloat((sum / filteredGrades.length).toFixed(2));
  };

  const getClassGrades = (classId: string) => {
    const classStudentIds =
      classes.find((c) => c.classId === classId)?.studentIds || [];

    const classGradesBySubject: Record<string, GradeWithDetails[]> = {};

    grades
      .filter((grade) => classStudentIds.includes(grade.studentId))
      .forEach((grade) => {
        if (!classGradesBySubject[grade.subjectId]) {
          classGradesBySubject[grade.subjectId] = [];
        }
        classGradesBySubject[grade.subjectId].push(grade);
      });

    return classGradesBySubject;
  };

  const getSubjectGrades = (subjectId: string) => {
    const subjectGradesByClass: Record<string, GradeWithDetails[]> = {};

    grades
      .filter((grade) => grade.subjectId === subjectId)
      .forEach((grade) => {
        const student = students.find((s) => s.userId === grade.studentId);
        const classId = student?.classId || "unknown";

        if (!subjectGradesByClass[classId]) {
          subjectGradesByClass[classId] = [];
        }
        subjectGradesByClass[classId].push(grade);
      });

    return subjectGradesByClass;
  };

  const renderClassBasedView = () => {
    if (!selectedClass) return <p>Моля, изберете клас.</p>;

    const classGradesBySubject = getClassGrades(selectedClass);
    const className =
      classes.find((c) => c.classId === selectedClass)?.name || "Unknown";

    return (
      <div className="space-y-8">
        <h2 className="text-xl font-semibold">
          Успех на клас: {className}
          <Badge className="ml-2 bg-blue-100 text-blue-800 hover:bg-blue-100">
            Среден успех: {calculateClassAverage(selectedClass)}
          </Badge>
        </h2>

        {Object.keys(classGradesBySubject).length === 0 ? (
          <p className="text-gray-500 italic">Няма оценки за този клас.</p>
        ) : (
          Object.entries(classGradesBySubject).map(
            ([subjectId, subjectGrades]) => {
              const subjectName =
                subjectGrades[0]?.subjectName ||
                subjects.find((s) => s.id === subjectId)?.name ||
                "Unknown Subject";
              const subjectAverage = calculateClassAverage(
                selectedClass,
                subjectId
              );

              return (
                <Card key={subjectId} className="shadow-sm">
                  <CardHeader className="bg-gray-50 border-b">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg flex items-center">
                        <BookOpen className="h-5 w-5 mr-2 text-blue-600" />
                        {subjectName}
                      </CardTitle>
                      <Badge className={`${getGradeColor(subjectAverage)}`}>
                        Среден успех: {subjectAverage}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-gray-700">
                            Ученик
                          </TableHead>
                          <TableHead className="text-gray-700">
                            Оценки
                          </TableHead>
                          <TableHead className="text-gray-700 text-right">
                            Среден успех
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Group grades by student */}
                        {Array.from(
                          new Set(subjectGrades.map((g) => g.studentId))
                        ).map((studentId) => {
                          const studentGrades = subjectGrades.filter(
                            (g) => g.studentId === studentId
                          );
                          const studentName =
                            studentGrades[0]?.studentName || "Unknown Student";
                          const average = calculateStudentAverage(
                            studentId,
                            subjectId
                          );

                          return (
                            <TableRow
                              key={studentId}
                              className="hover:bg-gray-50"
                            >
                              <TableCell className="font-medium">
                                {studentName}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-2">
                                  {studentGrades.map((grade) => (
                                    <div
                                      key={grade.id}
                                      className={`px-3 py-1 border rounded-full ${getGradeColor(
                                        grade.value
                                      )} text-sm`}
                                      title={`${grade.title} - ${getGradeType(
                                        grade.type
                                      )} - ${new Date(
                                        grade.date.seconds * 1000
                                      ).toLocaleDateString("bg-BG")}`}
                                    >
                                      {grade.value}
                                    </div>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell
                                className={`text-right ${getGradeColor(
                                  average
                                )}`}
                              >
                                {average}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            }
          )
        )}
      </div>
    );
  };

  const renderSubjectBasedView = () => {
    if (!selectedSubject) return <p>Моля, изберете предмет.</p>;

    const subjectGradesByClass = getSubjectGrades(selectedSubject);
    const subjectName =
      subjects.find((s) => s.id === selectedSubject)?.name || "Unknown";

    return (
      <div className="space-y-8">
        <h2 className="text-xl font-semibold">
          Успех по предмет: {subjectName}
        </h2>

        {Object.keys(subjectGradesByClass).length === 0 ? (
          <p className="text-gray-500 italic">Няма оценки за този предмет.</p>
        ) : (
          Object.entries(subjectGradesByClass).map(([classId, classGrades]) => {
            const classObj = classes.find((c) => c.classId === classId);
            const className = classObj?.name || "Неизвестен клас";
            const classAverage = calculateClassAverage(
              classId,
              selectedSubject
            );

            return (
              <Card key={classId} className="shadow-sm">
                <CardHeader className="bg-gray-50 border-b">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg flex items-center">
                      <Users className="h-5 w-5 mr-2 text-indigo-600" />
                      {className}
                    </CardTitle>
                    <Badge className={`${getGradeColor(classAverage)}`}>
                      Среден успех: {classAverage}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="text-gray-700">Ученик</TableHead>
                        <TableHead className="text-gray-700">Оценки</TableHead>
                        <TableHead className="text-gray-700 text-right">
                          Среден успех
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Group grades by student */}
                      {Array.from(
                        new Set(classGrades.map((g) => g.studentId))
                      ).map((studentId) => {
                        const studentGrades = classGrades.filter(
                          (g) => g.studentId === studentId
                        );
                        const studentName =
                          studentGrades[0]?.studentName || "Unknown Student";
                        const average = calculateStudentAverage(
                          studentId,
                          selectedSubject
                        );

                        return (
                          <TableRow
                            key={studentId}
                            className="hover:bg-gray-50"
                          >
                            <TableCell className="font-medium">
                              {studentName}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-2">
                                {studentGrades.map((grade) => (
                                  <div
                                    key={grade.id}
                                    className={`px-3 py-1 border rounded-full ${getGradeColor(
                                      grade.value
                                    )} text-sm`}
                                    title={`${grade.title} - ${getGradeType(
                                      grade.type
                                    )} - ${new Date(
                                      grade.date.seconds * 1000
                                    ).toLocaleDateString("bg-BG")}`}
                                  >
                                    {grade.value}
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell
                              className={`text-right ${getGradeColor(average)}`}
                            >
                              {average}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    );
  };

  if (!user || user.role !== "teacher") return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar className="hidden lg:block" />
      <div className="flex-1 pt-16 lg:pt-4 px-4 lg:px-8">
        <div className="max-w-6xl mx-auto pb-12">
          <h1 className="text-2xl md:text-3xl font-bold mb-6 mt-4 text-gray-800">
            Преглед на оценки по класове
          </h1>

          <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <Tabs
              defaultValue="class"
              onValueChange={(value) =>
                setViewMode(value as "class" | "subject")
              }
              className="w-full md:w-auto"
            >
              <TabsList>
                <TabsTrigger value="class" className="flex items-center">
                  <Users className="h-4 w-4 mr-2" />
                  По класове
                </TabsTrigger>
                <TabsTrigger value="subject" className="flex items-center">
                  <BookOpen className="h-4 w-4 mr-2" />
                  По предмети
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="w-full md:w-64 shrink-0">
              {viewMode === "class" ? (
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Изберете клас" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.classId} value={cls.classId}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  value={selectedSubject}
                  onValueChange={setSelectedSubject}
                >
                  <SelectTrigger className="bg-white">
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
              )}
            </div>
          </div>

          <Separator className="my-6" />

          {viewMode === "class"
            ? renderClassBasedView()
            : renderSubjectBasedView()}
        </div>
      </div>
    </div>
  );
}
