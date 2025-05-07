"use client";

import { useState, useEffect, useMemo } from "react";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Sidebar from "@/components/functional/Sidebar";
import { getTeacherGrades, getGradeColor } from "@/lib/gradeManagement";
import {
  Users,
  BookOpen,
  FileText,
  PieChart,
  FileBarChart,
  Search,
} from "lucide-react";
import { Timestamp } from "firebase/firestore";
import type { GradeType } from "@/lib/interfaces";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";

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
  homeroomClassId?: string;
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

interface TeacherSubjectPair {
  teacherId: string;
  subjectId: string;
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
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.schoolId || !user?.userId) return;

      try {
        setLoading(true);
        // Fetch classes taught by the teacher
        const classesRef = collection(db, "schools", user.schoolId, "classes");
        const classesSnapshot = await getDocs(classesRef);
        const allClasses: ClassData[] = [];

        classesSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          // Check both teacherIds array and teacherSubjectPairs for the current teacher
          const teacherIds = data.teacherIds || [];
          const teacherSubjectPairs = data.teacherSubjectPairs || [];
          const isTeacherInPairs = teacherSubjectPairs.some(
            (pair: TeacherSubjectPair) => pair.teacherId === user.userId
          );

          if (teacherIds.includes(user.userId) || isTeacherInPairs) {
            allClasses.push({
              classId: doc.id,
              name: data.className || data.name || "Unnamed Class",
              yearGroup: data.gradeNumber || data.yearGroup || 0,
              studentIds: data.studentIds || [],
            });
          }
        });

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
          classId:
            doc.data().classId ||
            doc.data().homeroomClassId ||
            doc.data().class ||
            "",
          yearGroup: doc.data().yearGroup || doc.data().gradeNumber || 0,
        }));

        setStudents(allStudents);

        // Update the studentIds arrays in the classes based on actual student data
        const updatedClasses = allClasses.map((classItem) => {
          // Find all students that belong to this class
          const classStudents = allStudents.filter(
            (student) => student.classId === classItem.classId
          );

          // Create a new array combining existing studentIds and newly found students
          const studentIds = Array.from(
            new Set([
              ...(classItem.studentIds || []),
              ...classStudents.map((student) => student.userId),
            ])
          );

          return {
            ...classItem,
            studentIds,
          };
        });

        setClasses(updatedClasses);

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

        // Fetch all grades entered by the teacher
        const teacherGrades = await getTeacherGrades(
          user.schoolId,
          user.userId
        );

        // Enrich grades with student and subject details - using Promise.all for better performance
        const gradesWithDetails = await Promise.all(
          teacherGrades.map(async (grade) => {
            const student = allStudents.find(
              (s) => s.userId === grade.studentId
            );

            // Get subject name
            let subjectName = "Unknown Subject";
            const subjectDoc = subjects.find((s) => s.id === grade.subjectId);

            if (subjectDoc) {
              subjectName = subjectDoc.name;
            } else {
              // Only fetch from Firestore if not found in local data
              const subjectDocRef = await getDoc(
                doc(db, "schools", user.schoolId, "subjects", grade.subjectId)
              );
              subjectName = subjectDocRef.exists()
                ? subjectDocRef.data().name
                : "Unknown Subject";
            }

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
        if (updatedClasses.length > 0) {
          setSelectedClass(updatedClasses[0].classId);
        }

        if (teacherSubjects.length > 0) {
          setSelectedSubject(teacherSubjects[0].id);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          title: "Грешка при зареждане на данни",
          description:
            "Възникна проблем при зареждане на информацията за оценки.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, subjects]);

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

  // Memoized function to calculate class average - improves performance
  const calculateClassAverage = useMemo(() => {
    return (classId: string, subjectId?: string) => {
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
  }, [classes, grades]);

  // Memoized function to calculate student average - improves performance
  const calculateStudentAverage = useMemo(() => {
    return (studentId: string, subjectId?: string) => {
      const filteredGrades = grades.filter(
        (grade) =>
          grade.studentId === studentId &&
          (subjectId ? grade.subjectId === subjectId : true)
      );

      if (filteredGrades.length === 0) return 0;

      const sum = filteredGrades.reduce((acc, grade) => acc + grade.value, 0);
      return parseFloat((sum / filteredGrades.length).toFixed(2));
    };
  }, [grades]);

  // Filtered students based on search term
  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return students;
    const search = searchTerm.toLowerCase();
    return students.filter(
      (student) =>
        student.firstName?.toLowerCase().includes(search) ||
        student.lastName?.toLowerCase().includes(search)
    );
  }, [students, searchTerm]);

  // Filter classes based on search
  const filteredClasses = useMemo(() => {
    if (!searchTerm.trim()) return classes;
    const search = searchTerm.toLowerCase();
    return classes.filter((cls) => cls.name.toLowerCase().includes(search));
  }, [classes, searchTerm]);

  // Memoized function to get class grades - improves performance
  const getClassGrades = useMemo(() => {
    return (classId: string) => {
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
  }, [classes, grades]);

  // Memoized function to get subject grades - improves performance
  const getSubjectGrades = useMemo(() => {
    return (subjectId: string) => {
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
  }, [grades, students]);

  // Calculate statistics for grades
  const calculateStatistics = useMemo(() => {
    if (grades.length === 0) return null;

    // Overall average
    const totalSum = grades.reduce((acc, grade) => acc + grade.value, 0);
    const totalAverage = totalSum / grades.length;

    // Distribution
    const distribution = {
      excellent: grades.filter((g) => g.value >= 5.5).length,
      veryGood: grades.filter((g) => g.value >= 4.5 && g.value < 5.5).length,
      good: grades.filter((g) => g.value >= 3.5 && g.value < 4.5).length,
      average: grades.filter((g) => g.value >= 3 && g.value < 3.5).length,
      poor: grades.filter((g) => g.value < 3).length,
    };

    // Percentages
    const totalGrades = grades.length;
    const distributionPercentages = {
      excellent: (distribution.excellent / totalGrades) * 100,
      veryGood: (distribution.veryGood / totalGrades) * 100,
      good: (distribution.good / totalGrades) * 100,
      average: (distribution.average / totalGrades) * 100,
      poor: (distribution.poor / totalGrades) * 100,
    };

    // Grade types
    const byType: Record<string, number> = {};
    grades.forEach((grade) => {
      const type = grade.type;
      byType[type] = (byType[type] || 0) + 1;
    });

    // Calculate average by subject
    const bySubject: Record<
      string,
      { count: number; sum: number; average: number }
    > = {};
    grades.forEach((grade) => {
      if (!bySubject[grade.subjectId]) {
        bySubject[grade.subjectId] = { count: 0, sum: 0, average: 0 };
      }
      bySubject[grade.subjectId].count++;
      bySubject[grade.subjectId].sum += grade.value;
    });

    // Calculate final averages
    Object.keys(bySubject).forEach((id) => {
      const data = bySubject[id];
      data.average = data.sum / data.count;
    });

    // Calculate average by class
    const byClass: Record<
      string,
      { count: number; sum: number; average: number }
    > = {};
    grades.forEach((grade) => {
      const student = students.find((s) => s.userId === grade.studentId);
      if (!student || !student.classId) return;

      if (!byClass[student.classId]) {
        byClass[student.classId] = { count: 0, sum: 0, average: 0 };
      }
      byClass[student.classId].count++;
      byClass[student.classId].sum += grade.value;
    });

    // Calculate final class averages
    Object.keys(byClass).forEach((id) => {
      const data = byClass[id];
      data.average = data.sum / data.count;
    });

    return {
      totalGrades,
      totalAverage,
      distribution,
      distributionPercentages,
      byType,
      bySubject,
      byClass,
    };
  }, [grades, students]);

  const renderClassBasedView = () => {
    if (!selectedClass) return <p>Моля, изберете клас.</p>;

    const classGradesBySubject = getClassGrades(selectedClass);
    const className =
      classes.find((c) => c.classId === selectedClass)?.name || "Unknown";

    return (
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm border">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" />
              Успех на клас: {className}
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              Общ брой оценки:{" "}
              {Object.values(classGradesBySubject).flat().length}
            </p>
          </div>
          <Badge className="px-3 py-1.5 text-base bg-blue-100 text-blue-800 hover:bg-blue-100">
            Среден успех:{" "}
            <span className="font-bold ml-1">
              {calculateClassAverage(selectedClass)}
            </span>
          </Badge>
        </div>

        {Object.keys(classGradesBySubject).length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 italic">Няма оценки за този клас.</p>
          </div>
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
                <Card key={subjectId} className="shadow-sm overflow-hidden">
                  <CardHeader className="bg-gray-50 border-b">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg flex items-center">
                        <BookOpen className="h-5 w-5 mr-2 text-blue-600" />
                        {subjectName}
                      </CardTitle>
                      <Badge
                        className={`${getGradeColor(
                          subjectAverage
                        )} bg-blue-100 px-3 py-1`}
                      >
                        Среден успех:{" "}
                        <span className="font-bold ml-1">{subjectAverage}</span>
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="text-gray-700 w-[30%]">
                              Ученик
                            </TableHead>
                            <TableHead className="text-gray-700 w-[50%]">
                              Оценки
                            </TableHead>
                            <TableHead className="text-gray-700 text-right w-[20%]">
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
                              studentGrades[0]?.studentName ||
                              "Unknown Student";
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
                                        )} text-sm flex items-center min-w-[2.5rem] justify-center`}
                                        title={`${grade.title} - ${getGradeType(
                                          grade.type
                                        )} - ${new Date(
                                          grade.date.seconds * 1000
                                        ).toLocaleDateString("bg-BG")}`}
                                      >
                                        {grade.value.toFixed(
                                          Number.isInteger(grade.value) ? 0 : 2
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell
                                  className={`text-right font-bold ${getGradeColor(
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
                    </div>
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

    // Calculate subject average across all classes
    const allSubjectGrades = grades.filter(
      (g) => g.subjectId === selectedSubject
    );
    const subjectAverage =
      allSubjectGrades.length > 0
        ? (
            allSubjectGrades.reduce((acc, g) => acc + g.value, 0) /
            allSubjectGrades.length
          ).toFixed(2)
        : "0.00";

    return (
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm border">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              Успех по предмет: {subjectName}
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              Общ брой оценки: {allSubjectGrades.length}
            </p>
          </div>
          <Badge
            className={`px-3 py-1.5 text-base ${getGradeColor(
              Number(subjectAverage)
            )} bg-opacity-20 bg-blue-100`}
          >
            Среден успех:{" "}
            <span className="font-bold ml-1">
              {Number(subjectAverage) % 1 === 0
                ? parseInt(subjectAverage)
                : subjectAverage}
            </span>
          </Badge>
        </div>

        {Object.keys(subjectGradesByClass).length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 italic">Няма оценки за този предмет.</p>
          </div>
        ) : (
          Object.entries(subjectGradesByClass).map(([classId, classGrades]) => {
            const classObj = classes.find((c) => c.classId === classId);
            const className = classObj?.name || "Неизвестен клас";
            const classAverage = calculateClassAverage(
              classId,
              selectedSubject
            );

            return (
              <Card key={classId} className="shadow-sm overflow-hidden">
                <CardHeader className="bg-gray-50 border-b">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg flex items-center">
                      <Users className="h-5 w-5 mr-2 text-indigo-600" />
                      {className}
                    </CardTitle>
                    <Badge
                      className={`${getGradeColor(
                        classAverage
                      )} px-3 py-1 bg-blue-100`}
                    >
                      Среден успех:{" "}
                      <span className="font-bold ml-1">{classAverage}</span>
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-gray-700 w-[30%]">
                            Ученик
                          </TableHead>
                          <TableHead className="text-gray-700 w-[50%]">
                            Оценки
                          </TableHead>
                          <TableHead className="text-gray-700 text-right w-[20%]">
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
                                      )} text-sm flex items-center min-w-[2.5rem] justify-center`}
                                      title={`${grade.title} - ${getGradeType(
                                        grade.type
                                      )} - ${new Date(
                                        grade.date.seconds * 1000
                                      ).toLocaleDateString("bg-BG")}`}
                                    >
                                      {grade.value.toFixed(
                                        Number.isInteger(grade.value) ? 0 : 2
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell
                                className={`text-right font-bold ${getGradeColor(
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
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    );
  };

  const renderStatisticsView = () => {
    const stats = calculateStatistics;

    if (!stats) {
      return (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200">
          <FileBarChart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 italic">Няма данни за статистика.</p>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500 font-normal">
                Общ брой оценки
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalGrades}</div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500 font-normal">
                Среден успех всички оценки
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`text-3xl font-bold ${getGradeColor(
                  stats.totalAverage
                )}`}
              >
                {stats.totalAverage.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500 font-normal">
                Отлични оценки
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600">
                {stats.distribution.excellent}{" "}
                <span className="text-sm font-normal text-gray-500">
                  ({stats.distributionPercentages.excellent.toFixed(1)}%)
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Разпределение по оценки</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-600 font-medium">
                      Отлични (5.50-6.00)
                    </span>
                    <span>
                      {stats.distribution.excellent} бр. (
                      {stats.distributionPercentages.excellent.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress
                    value={stats.distributionPercentages.excellent}
                    className="h-2 bg-gray-100"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-600 font-medium">
                      Мн. добри (4.50-5.49)
                    </span>
                    <span>
                      {stats.distribution.veryGood} бр. (
                      {stats.distributionPercentages.veryGood.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress
                    value={stats.distributionPercentages.veryGood}
                    className="h-2 bg-gray-100"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-yellow-600 font-medium">
                      Добри (3.50-4.49)
                    </span>
                    <span>
                      {stats.distribution.good} бр. (
                      {stats.distributionPercentages.good.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress
                    value={stats.distributionPercentages.good}
                    className="h-2 bg-gray-100"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-orange-600 font-medium">
                      Средни (3.00-3.49)
                    </span>
                    <span>
                      {stats.distribution.average} бр. (
                      {stats.distributionPercentages.average.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress
                    value={stats.distributionPercentages.average}
                    className="h-2 bg-gray-100"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-red-600 font-medium">
                      Слаби (2.00-2.99)
                    </span>
                    <span>
                      {stats.distribution.poor} бр. (
                      {stats.distributionPercentages.poor.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress
                    value={stats.distributionPercentages.poor}
                    className="h-2 bg-gray-100"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Среден успех по предмети</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[250px] pr-4">
                <div className="space-y-4">
                  {Object.entries(stats.bySubject)
                    .sort((a, b) => b[1].average - a[1].average)
                    .map(([subjectId, data]) => {
                      const subject = subjects.find((s) => s.id === subjectId);
                      return (
                        <div key={subjectId} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">
                              {subject?.name || "Неизвестен предмет"}
                            </span>
                            <span className={getGradeColor(data.average)}>
                              {data.average.toFixed(2)}{" "}
                              <span className="text-gray-500">
                                ({data.count} оценки)
                              </span>
                            </span>
                          </div>
                          <Progress
                            value={(data.average / 6) * 100}
                            className="h-2 bg-gray-100"
                          />
                        </div>
                      );
                    })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Среден успех по класове</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(stats.byClass)
                  .sort((a, b) => b[1].average - a[1].average)
                  .map(([classId, data]) => {
                    const classObj = classes.find((c) => c.classId === classId);
                    return (
                      <div key={classId} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">
                            {classObj?.name || "Неизвестен клас"}
                          </span>
                          <span className={getGradeColor(data.average)}>
                            {data.average.toFixed(2)}{" "}
                            <span className="text-gray-500">
                              ({data.count} оценки)
                            </span>
                          </span>
                        </div>
                        <Progress
                          value={(data.average / 6) * 100}
                          className="h-2 bg-gray-100"
                        />
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Разпределение по тип оценки</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(stats.byType)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => {
                    const percentage = (count / stats.totalGrades) * 100;
                    const typeLabel = getGradeType(type as GradeType);
                    return (
                      <div key={type} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{typeLabel}</span>
                          <span>
                            {count} бр. ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <Progress
                          value={percentage}
                          className="h-2 bg-gray-100"
                        />
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  if (!user || user.role !== "teacher") return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar className="hidden lg:block" />
      <div className="flex-1 pt-16 lg:pt-4 px-4 lg:px-8">
        <div className="max-w-6xl mx-auto pb-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mt-4 text-gray-800">
                Преглед на оценки
              </h1>
              <p className="text-gray-500 mt-1">
                Анализ на успеха на учениците по класове и предмети
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-3 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Търсене..."
                  className="pl-8 bg-white border-gray-200 h-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Link href="/teacher/grades/add" className="shrink-0">
                <Button variant="default" size="sm" className="h-10 text-white">
                  Добави оценки
                </Button>
              </Link>
            </div>
          </div>

          <Tabs
            defaultValue="overview"
            value={activeTab}
            onValueChange={setActiveTab}
            className="mb-6"
          >
            <TabsList className="grid grid-cols-1 md:grid-cols-3 h-auto p-0 bg-transparent gap-2">
              <TabsTrigger
                value="overview"
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-md py-2.5 flex items-center justify-center gap-2"
              >
                <FileText className="h-4 w-4" />
                <span>Преглед по класове/предмети</span>
              </TabsTrigger>
              <TabsTrigger
                value="statistics"
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-md py-2.5 flex items-center justify-center gap-2"
              >
                <PieChart className="h-4 w-4" />
                <span>Статистика</span>
              </TabsTrigger>
              <TabsTrigger
                value="students"
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-md py-2.5 flex items-center justify-center gap-2"
              >
                <Users className="h-4 w-4" />
                <span>Ученици</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6">
              {loading ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-center mb-6">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-10 w-64" />
                  </div>
                  <Skeleton className="h-12 w-full mb-4" />
                  <div className="space-y-4">
                    <Skeleton className="h-80 w-full" />
                    <Skeleton className="h-80 w-full" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-6 flex flex-col md:flex-row md:items-center gap-4 rounded-lg bg-white p-4 shadow-sm border">
                    <Tabs
                      defaultValue="class"
                      onValueChange={(value) =>
                        setViewMode(value as "class" | "subject")
                      }
                      className="w-full md:w-auto"
                    >
                      <TabsList>
                        <TabsTrigger
                          value="class"
                          className="flex items-center"
                        >
                          <Users className="h-4 w-4 mr-2" />
                          По класове
                        </TabsTrigger>
                        <TabsTrigger
                          value="subject"
                          className="flex items-center"
                        >
                          <BookOpen className="h-4 w-4 mr-2" />
                          По предмети
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>

                    <div className="w-full md:w-64 shrink-0">
                      {viewMode === "class" ? (
                        <Select
                          value={selectedClass}
                          onValueChange={setSelectedClass}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Изберете клас" />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredClasses.map((cls) => (
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

                  {viewMode === "class"
                    ? renderClassBasedView()
                    : renderSubjectBasedView()}
                </>
              )}
            </TabsContent>

            <TabsContent value="statistics" className="mt-6">
              {loading ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Skeleton className="h-80 w-full" />
                    <Skeleton className="h-80 w-full" />
                  </div>
                </div>
              ) : (
                renderStatisticsView()
              )}
            </TabsContent>

            <TabsContent value="students" className="mt-6">
              {loading ? (
                <Skeleton className="h-96 w-full" />
              ) : (
                <Card className="shadow-sm overflow-hidden">
                  <CardHeader className="bg-gray-50 border-b">
                    <CardTitle className="text-lg flex items-center">
                      <Users className="h-5 w-5 mr-2 text-indigo-600" />
                      Студенти и техният успех
                    </CardTitle>
                    <CardDescription>
                      Списък с всички ученици и техния среден успех
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="text-gray-700">
                              Ученик
                            </TableHead>
                            <TableHead className="text-gray-700">
                              Клас
                            </TableHead>
                            <TableHead className="text-gray-700 text-center">
                              Брой оценки
                            </TableHead>
                            <TableHead className="text-gray-700 text-right">
                              Среден успех
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredStudents.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={4}
                                className="text-center py-8 text-gray-500"
                              >
                                Няма намерени ученици.
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredStudents.map((student) => {
                              const studentGrades = grades.filter(
                                (g) => g.studentId === student.userId
                              );
                              const average =
                                studentGrades.length > 0
                                  ? studentGrades.reduce(
                                      (sum, g) => sum + g.value,
                                      0
                                    ) / studentGrades.length
                                  : 0;
                              const className =
                                classes.find(
                                  (c) => c.classId === student.classId
                                )?.name || "N/A";

                              return (
                                <TableRow
                                  key={student.userId}
                                  className="hover:bg-gray-50"
                                >
                                  <TableCell className="font-medium">
                                    {student.firstName} {student.lastName}
                                  </TableCell>
                                  <TableCell>{className}</TableCell>
                                  <TableCell className="text-center">
                                    {studentGrades.length}
                                  </TableCell>
                                  <TableCell
                                    className={`text-right font-bold ${getGradeColor(
                                      average
                                    )}`}
                                  >
                                    {studentGrades.length > 0
                                      ? average.toFixed(2)
                                      : "—"}
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
