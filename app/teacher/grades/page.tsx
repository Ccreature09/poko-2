"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import Sidebar from "@/components/functional/Sidebar";
import { toast } from "@/hooks/use-toast";
import type { Grade, GradeType } from "@/lib/interfaces";
import {
  Search,
  Filter,
  Trash2,
  Edit2,
  Plus,
  BarChart2,
  CheckCircle,
  Users,
  FileText,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

// Import all the grade management functions
import {
  fetchTeacherData,
  filterGrades,
  calculateGradeStatistics,
  handleAddGradeWithUI,
  handleBatchAddGradesWithUI,
  handleUpdateGradeWithUI,
  handleDeleteGradeWithUI,
  getGradeColor,
  gradeOptions,
  gradeTypes,
  type Student,
  type SubjectData,
  type ClassData,
  type GradeFilters,
  type GradeStatistics,
} from "@/lib/gradeManagement";

// Custom Progress component that accepts indicator className
interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof Progress> {
  indicatorClassName?: string;
}

const StyledProgress = React.forwardRef<
  React.ElementRef<typeof Progress>,
  ProgressProps
>(({ className, indicatorClassName, ...props }, ref) => (
  <Progress ref={ref} className={className} {...props} />
));
StyledProgress.displayName = "StyledProgress";

export default function AddGrades() {
  const { user } = useUser();
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("add-grade");

  // Form state
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedClassForStudent, setSelectedClassForStudent] = useState("");
  const [gradeValue, setGradeValue] = useState("");
  const [gradeTitle, setGradeTitle] = useState("");
  const [gradeDescription, setGradeDescription] = useState("");
  const [gradeType, setGradeType] = useState<GradeType>("test");
  const [gradeDate, setGradeDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Decimal grade support
  const [useDecimalGrade, setUseDecimalGrade] = useState(false);
  const [decimalGradeValue, setDecimalGradeValue] = useState<string>("2.00");

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<GradeFilters>({
    searchTerm: "",
    student: "all_students",
    subject: "all_subjects",
    gradeType: "all_grade_types",
    dateFrom: "",
    dateTo: "",
    valueFrom: "no_min",
    valueTo: "no_max",
  });

  // Batch grading state
  const [batchStudents, setBatchStudents] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");

  // Edit grade state
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      if (!user || !user.schoolId || !user.userId) return;

      setLoading(true);
      try {
        const data = await fetchTeacherData(user.schoolId, user.userId);
        setStudents(data.students);
        setSubjects(data.subjects);
        setClasses(data.classes);
        setGrades(data.grades);
      } catch (error) {
        console.error("Error loading data:", error);
        toast({
          title: "Грешка при зареждане на данни",
          description: "Моля, опитайте отново по-късно.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  // Filter grades based on selected filters
  const filteredGrades = useMemo(() => {
    return filterGrades(grades, students, subjects, filters);
  }, [grades, students, subjects, filters]);

  // Calculate statistics about grades
  const gradeStatistics = useMemo(() => {
    return calculateGradeStatistics(grades);
  }, [grades]);

  // Helper functions for the UI
  const resetForm = () => {
    setSelectedStudent("");
    setSelectedSubject("");
    setGradeValue("");
    setGradeTitle("");
    setGradeDescription("");
    setGradeType("test");
    setGradeDate(new Date().toISOString().split("T")[0]);
    setUseDecimalGrade(false);
    setDecimalGradeValue("2.00");
  };

  // Reset filters function
  const resetFilters = () => {
    setFilters({
      searchTerm: "",
      student: "all_students",
      subject: "all_subjects",
      gradeType: "all_grade_types",
      dateFrom: "",
      dateTo: "",
      valueFrom: "no_min",
      valueTo: "no_max",
    });
  };

  // Helper to get class students
  const getClassStudents = useMemo(() => {
    if (!selectedClass || selectedClass === "all_students_batch")
      return students;
    return students.filter(
      (student) =>
        student.classId === selectedClass ||
        student.homeroomClassId === selectedClass
    );
  }, [students, selectedClass]);

  // Helper to get students filtered by selected class
  const getStudentsByClass = useMemo(() => {
    if (!selectedClassForStudent || selectedClassForStudent === "all_classes")
      return students;
    return students.filter(
      (student) =>
        student.classId === selectedClassForStudent ||
        student.homeroomClassId === selectedClassForStudent
    );
  }, [students, selectedClassForStudent]);

  // Handler for student selection in batch mode
  const toggleStudent = (studentId: string) => {
    if (batchStudents.includes(studentId)) {
      setBatchStudents(batchStudents.filter((id) => id !== studentId));
    } else {
      setBatchStudents([...batchStudents, studentId]);
    }
  };

  // Select all students in current class
  const selectAllStudents = () => {
    setBatchStudents(getClassStudents.map((student) => student.id));
  };

  // Deselect all students
  const deselectAllStudents = () => {
    setBatchStudents([]);
  };

  // Handler for adding a grade
  const handleAddGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.schoolId || !user.userId) return;

    let parsedValue: number;

    if (useDecimalGrade) {
      parsedValue = parseFloat(decimalGradeValue);
    } else {
      parsedValue = parseFloat(gradeValue);
    }

    const newGrade = await handleAddGradeWithUI(
      user.schoolId,
      selectedStudent,
      selectedSubject,
      user.userId,
      {
        value: parsedValue,
        title: gradeTitle,
        description: gradeDescription,
        type: gradeType,
        date: new Date(gradeDate),
      }
    );

    if (newGrade) {
      setGrades([...grades, newGrade]);
      resetForm();
    }
  };

  // Handler for batch adding grades
  const handleAddBatchGrades = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.schoolId || !user.userId || batchStudents.length === 0)
      return;

    let parsedValue: number;

    if (useDecimalGrade) {
      parsedValue = parseFloat(decimalGradeValue);
    } else {
      parsedValue = parseFloat(gradeValue);
    }

    const newGrades = await handleBatchAddGradesWithUI(
      user.schoolId,
      batchStudents,
      selectedSubject,
      user.userId,
      {
        value: parsedValue,
        title: gradeTitle,
        description: gradeDescription,
        type: gradeType,
        date: new Date(gradeDate),
      }
    );

    if (newGrades.length > 0) {
      setGrades([...grades, ...newGrades]);
      resetForm();
      setBatchStudents([]);
    }
  };

  // Handler for editing a grade
  const handleEdit = (grade: Grade) => {
    setEditingGrade(grade);
    setEditDialogOpen(true);

    // Set form values for editing
    setGradeTitle(grade.title);
    setGradeDescription(grade.description || "");
    setGradeType(grade.type);

    if (Math.floor(grade.value) === grade.value) {
      setUseDecimalGrade(false);
      setGradeValue(grade.value.toString());
    } else {
      setUseDecimalGrade(true);
      setDecimalGradeValue(grade.value.toFixed(2));
    }

    const date = new Date(grade.date.seconds * 1000);
    setGradeDate(date.toISOString().split("T")[0]);
  };

  // Handler for saving edited grade
  const handleSaveEdit = async () => {
    if (!user || !user.schoolId || !editingGrade || !editingGrade.id) return;

    let parsedValue: number;

    if (useDecimalGrade) {
      parsedValue = parseFloat(decimalGradeValue);
    } else {
      parsedValue = parseFloat(gradeValue);
    }

    const success = await handleUpdateGradeWithUI(
      user.schoolId,
      editingGrade.id,
      {
        value: parsedValue,
        title: gradeTitle,
        description: gradeDescription,
        type: gradeType,
        date: new Date(gradeDate),
      }
    );

    if (success) {
      // Import Timestamp from firebase/firestore
      import("firebase/firestore").then(({ Timestamp }) => {
        // Update local state with proper Timestamp object
        setGrades(
          grades.map((grade) =>
            grade.id === editingGrade.id
              ? {
                  ...grade,
                  value: parsedValue,
                  title: gradeTitle,
                  description: gradeDescription,
                  type: gradeType,
                  date: Timestamp.fromDate(new Date(gradeDate)),
                }
              : grade
          )
        );
      });

      setEditDialogOpen(false);
      resetForm();
    }
  };

  // Handler for deleting a grade
  const handleDeleteGrade = async (gradeId: string) => {
    if (!user || !user.schoolId) return;

    const success = await handleDeleteGradeWithUI(user.schoolId, gradeId);

    if (success) {
      // Update local state
      setGrades(grades.filter((grade) => grade.id !== gradeId));
    }
  };

  if (!user || user.role !== "teacher") return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar className="hidden lg:block" />
      <div className="flex-1 pt-16 lg:pt-4 px-4 lg:px-8">
        <div className="max-w-6xl mx-auto pb-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <h1 className="text-2xl md:text-3xl font-bold mt-4 text-gray-800">
              Управление на оценки
            </h1>

            {grades.length > 0 && (
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowFilters(!showFilters)}
                        className="border-gray-200 text-gray-700"
                      >
                        <Filter className="w-4 h-4 mr-2" />
                        Филтри
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Филтриране на оценки</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </div>

          {/* Filter panel */}
          {showFilters && (
            <Card className="mb-6 shadow-sm border-blue-100">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="searchTerm" className="text-sm font-medium">
                      Търсене
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                      <Input
                        id="searchTerm"
                        placeholder="Търсене по име, предмет, заглавие..."
                        className="pl-8 bg-white border-gray-200"
                        value={filters.searchTerm}
                        onChange={(e) =>
                          setFilters({ ...filters, searchTerm: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="studentFilter"
                      className="text-sm font-medium"
                    >
                      Ученик
                    </Label>
                    <Select
                      value={filters.student}
                      onValueChange={(value) =>
                        setFilters({ ...filters, student: value })
                      }
                    >
                      <SelectTrigger className="bg-white border-gray-200">
                        <SelectValue placeholder="Всички ученици" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_students">
                          Всички ученици
                        </SelectItem>
                        {students.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.firstName} {student.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="subjectFilter"
                      className="text-sm font-medium"
                    >
                      Предмет
                    </Label>
                    <Select
                      value={filters.subject}
                      onValueChange={(value) =>
                        setFilters({ ...filters, subject: value })
                      }
                    >
                      <SelectTrigger className="bg-white border-gray-200">
                        <SelectValue placeholder="Всички предмети" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_subjects">
                          Всички предмети
                        </SelectItem>
                        {subjects.map((subject) => (
                          <SelectItem key={subject.id} value={subject.id}>
                            {subject.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="gradeTypeFilter"
                      className="text-sm font-medium"
                    >
                      Тип оценка
                    </Label>
                    <Select
                      value={filters.gradeType}
                      onValueChange={(value) =>
                        setFilters({
                          ...filters,
                          gradeType: value as GradeType | "",
                        })
                      }
                    >
                      <SelectTrigger className="bg-white border-gray-200">
                        <SelectValue placeholder="Всички типове" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_grade_types">
                          Всички типове
                        </SelectItem>
                        {gradeTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dateRange" className="text-sm font-medium">
                      Период от-до
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        id="dateFrom"
                        className="bg-white border-gray-200"
                        value={filters.dateFrom}
                        onChange={(e) =>
                          setFilters({ ...filters, dateFrom: e.target.value })
                        }
                      />
                      <Input
                        type="date"
                        id="dateTo"
                        className="bg-white border-gray-200"
                        value={filters.dateTo}
                        onChange={(e) =>
                          setFilters({ ...filters, dateTo: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gradeRange" className="text-sm font-medium">
                      Оценка от-до
                    </Label>
                    <div className="flex gap-2">
                      <Select
                        value={filters.valueFrom}
                        onValueChange={(value) =>
                          setFilters({ ...filters, valueFrom: value })
                        }
                      >
                        <SelectTrigger className="bg-white border-gray-200">
                          <SelectValue placeholder="От" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no_min">От</SelectItem>
                          {["2", "3", "4", "5"].map((value) => (
                            <SelectItem key={value} value={value}>
                              {value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={filters.valueTo}
                        onValueChange={(value) =>
                          setFilters({ ...filters, valueTo: value })
                        }
                      >
                        <SelectTrigger className="bg-white border-gray-200">
                          <SelectValue placeholder="До" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no_max">До</SelectItem>
                          {["3", "4", "5", "6"].map((value) => (
                            <SelectItem key={value} value={value}>
                              {value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetFilters}
                    className="text-gray-600"
                  >
                    Изчистване
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {loading ? (
            // Loading state
            <Card className="shadow-md mb-6">
              <CardHeader className="border-b bg-white">
                <div className="space-y-2">
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-6">
                  <Skeleton className="h-24 w-full" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            // Main content
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="space-y-6"
            >
              <TabsList className="grid grid-cols-1 md:grid-cols-4 h-auto p-0 bg-transparent gap-2">
                <TabsTrigger
                  value="add-grade"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white py-3 rounded-md flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Добавяне на оценка</span>
                </TabsTrigger>
                <TabsTrigger
                  value="batch-grades"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white py-3 rounded-md flex items-center justify-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  <span>Групово добавяне</span>
                </TabsTrigger>
                <TabsTrigger
                  value="grades-list"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white py-3 rounded-md flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  <span>Списък с оценки</span>
                </TabsTrigger>
                <TabsTrigger
                  value="statistics"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white py-3 rounded-md flex items-center justify-center gap-2"
                >
                  <BarChart2 className="w-4 h-4" />
                  <span>Статистика</span>
                </TabsTrigger>
              </TabsList>

              {/* Add Grade Tab */}
              <TabsContent value="add-grade" className="mt-6">
                <Card className="shadow-md border-t-4 border-t-blue-600">
                  <CardHeader className="border-b bg-white">
                    <CardTitle className="text-xl text-gray-800 flex items-center gap-2">
                      <Plus className="w-5 h-5 text-blue-600" />
                      Добавяне на нова оценка
                    </CardTitle>
                    <CardDescription>
                      Добавете нова оценка за конкретен ученик
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <form onSubmit={handleAddGrade} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label
                            htmlFor="classForStudent"
                            className="text-gray-700"
                          >
                            Клас
                          </Label>
                          <Select
                            onValueChange={(value) => {
                              setSelectedClassForStudent(value);
                              setSelectedStudent(""); // Reset selected student when class changes
                            }}
                            value={selectedClassForStudent}
                          >
                            <SelectTrigger className="bg-white border-gray-200">
                              <SelectValue placeholder="Изберете клас" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all_classes">
                                Всички класове
                              </SelectItem>
                              {classes.map((classItem) => (
                                <SelectItem
                                  key={classItem.id}
                                  value={classItem.id}
                                >
                                  {classItem.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

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
                              {getStudentsByClass.map((student) => (
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
                          <div className="flex justify-between">
                            <Label htmlFor="grade" className="text-gray-700">
                              Оценка
                            </Label>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id="useDecimal"
                                checked={useDecimalGrade}
                                onCheckedChange={(checked) =>
                                  setUseDecimalGrade(checked === true)
                                }
                              />
                              <Label
                                htmlFor="useDecimal"
                                className="text-xs text-gray-600 cursor-pointer"
                              >
                                Десетична оценка
                              </Label>
                            </div>
                          </div>

                          {useDecimalGrade ? (
                            <Input
                              id="decimalGrade"
                              type="number"
                              min="2"
                              max="6"
                              step="0.01"
                              value={decimalGradeValue}
                              onChange={(e) =>
                                setDecimalGradeValue(e.target.value)
                              }
                              className="border-gray-200"
                              required
                            />
                          ) : (
                            <Select
                              onValueChange={setGradeValue}
                              value={gradeValue}
                            >
                              <SelectTrigger className="bg-white border-gray-200">
                                <SelectValue placeholder="Изберете оценка" />
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
                          )}
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
                        <Label
                          htmlFor="gradeDescription"
                          className="text-gray-700"
                        >
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
                          (!gradeValue && !useDecimalGrade) ||
                          (useDecimalGrade && !decimalGradeValue) ||
                          !gradeTitle
                        }
                      >
                        <CheckCircle className="w-5 h-5 mr-2" />
                        Добавяне на оценка
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Batch Grades Tab */}
              <TabsContent value="batch-grades" className="mt-6">
                <Card className="shadow-md border-t-4 border-t-green-600">
                  <CardHeader className="border-b bg-white">
                    <CardTitle className="text-xl text-gray-800 flex items-center gap-2">
                      <Users className="w-5 h-5 text-green-600" />
                      Групово добавяне на оценки
                    </CardTitle>
                    <CardDescription>
                      Добавете една и съща оценка за няколко ученика наведнъж
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <form onSubmit={handleAddBatchGrades} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 md:col-span-1">
                          <Label htmlFor="class" className="text-gray-700">
                            Клас
                          </Label>
                          <Select
                            onValueChange={setSelectedClass}
                            value={selectedClass}
                          >
                            <SelectTrigger className="bg-white border-gray-200">
                              <SelectValue placeholder="Изберете клас" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all_students_batch">
                                Всички ученици
                              </SelectItem>
                              {classes.map((classItem) => (
                                <SelectItem
                                  key={classItem.id}
                                  value={classItem.id}
                                >
                                  {classItem.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2 md:col-span-1">
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

                        <div className="space-y-2 md:col-span-2">
                          <div className="flex justify-between items-center">
                            <Label className="text-gray-700 font-medium">
                              Избрани ученици ({batchStudents.length})
                            </Label>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={selectAllStudents}
                                className="h-8 text-xs"
                              >
                                Избери всички
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={deselectAllStudents}
                                className="h-8 text-xs"
                                disabled={batchStudents.length === 0}
                              >
                                Изчисти
                              </Button>
                            </div>
                          </div>

                          <div className="border rounded-md max-h-48 overflow-y-auto p-2 bg-white">
                            <ScrollArea className="h-full w-full pr-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {getClassStudents.length === 0 ? (
                                  <div className="col-span-full p-4 text-center text-gray-500">
                                    Няма намерени ученици
                                  </div>
                                ) : (
                                  getClassStudents.map((student) => (
                                    <div
                                      key={student.id}
                                      className="flex items-center space-x-2 p-2 rounded border border-gray-100"
                                    >
                                      <Checkbox
                                        id={`student-${student.id}`}
                                        checked={batchStudents.includes(
                                          student.id
                                        )}
                                        onCheckedChange={() =>
                                          toggleStudent(student.id)
                                        }
                                      />
                                      <Label
                                        htmlFor={`student-${student.id}`}
                                        className="text-sm cursor-pointer"
                                      >
                                        {student.firstName} {student.lastName}
                                      </Label>
                                    </div>
                                  ))
                                )}
                              </div>
                            </ScrollArea>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="gradeTitle" className="text-gray-700">
                            Заглавие оценка
                          </Label>
                          <Input
                            id="batchGradeTitle"
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
                          <div className="flex justify-between">
                            <Label htmlFor="grade" className="text-gray-700">
                              Оценка
                            </Label>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id="batchUseDecimal"
                                checked={useDecimalGrade}
                                onCheckedChange={(checked) =>
                                  setUseDecimalGrade(checked === true)
                                }
                              />
                              <Label
                                htmlFor="batchUseDecimal"
                                className="text-xs text-gray-600 cursor-pointer"
                              >
                                Десетична оценка
                              </Label>
                            </div>
                          </div>

                          {useDecimalGrade ? (
                            <Input
                              id="batchDecimalGrade"
                              type="number"
                              min="2"
                              max="6"
                              step="0.01"
                              value={decimalGradeValue}
                              onChange={(e) =>
                                setDecimalGradeValue(e.target.value)
                              }
                              className="border-gray-200"
                              required
                            />
                          ) : (
                            <Select
                              onValueChange={setGradeValue}
                              value={gradeValue}
                            >
                              <SelectTrigger className="bg-white border-gray-200">
                                <SelectValue placeholder="Изберете оценка" />
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
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label
                            htmlFor="batchGradeDate"
                            className="text-gray-700"
                          >
                            Дата
                          </Label>
                          <Input
                            type="date"
                            id="batchGradeDate"
                            value={gradeDate}
                            onChange={(e) => setGradeDate(e.target.value)}
                            className="border-gray-200"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="batchGradeDescription"
                          className="text-gray-700"
                        >
                          Описание
                        </Label>
                        <Textarea
                          id="batchGradeDescription"
                          value={gradeDescription}
                          onChange={(e) => setGradeDescription(e.target.value)}
                          placeholder="Добавете допълнителна информация за оценката"
                          className="min-h-[100px] border-gray-200"
                        />
                      </div>

                      <Button
                        type="submit"
                        className="w-full bg-green-600 hover:bg-green-700 text-white transition-colors py-6"
                        disabled={
                          batchStudents.length === 0 ||
                          !selectedSubject ||
                          (!gradeValue && !useDecimalGrade) ||
                          (useDecimalGrade && !decimalGradeValue) ||
                          !gradeTitle
                        }
                      >
                        <CheckCircle className="w-5 h-5 mr-2" />
                        Добави оценки за {batchStudents.length} ученика
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Grades List Tab */}
              <TabsContent value="grades-list" className="mt-6">
                <Card className="shadow-md border-t-4 border-t-indigo-600">
                  <CardHeader className="border-b bg-white">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                      <div>
                        <CardTitle className="text-xl text-gray-800 flex items-center gap-2">
                          <FileText className="w-5 h-5 text-indigo-600" />
                          Списък с въведени оценки
                        </CardTitle>
                        <CardDescription>
                          {filteredGrades.length} оценки
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {filteredGrades.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <FileText className="w-12 h-12 text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium text-gray-700">
                          Няма оценки
                        </h3>
                        <p className="text-gray-500 text-center mt-1 max-w-md">
                          {grades.length > 0
                            ? "Няма оценки, които да отговарят на зададените филтри."
                            : 'Все още не сте добавили оценки. Използвайте таб "Добавяне на оценка" или "Групово добавяне".'}
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead className="text-gray-700">
                                Дата
                              </TableHead>
                              <TableHead className="text-gray-700">
                                Ученик
                              </TableHead>
                              <TableHead className="text-gray-700">
                                Предмет
                              </TableHead>
                              <TableHead className="text-gray-700">
                                Вид
                              </TableHead>
                              <TableHead className="text-gray-700">
                                Заглавие
                              </TableHead>
                              <TableHead className="text-gray-700 text-center">
                                Оценка
                              </TableHead>
                              <TableHead className="text-gray-700 text-right">
                                Действия
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredGrades.map((grade) => (
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
                                    students.find(
                                      (s) => s.id === grade.studentId
                                    )?.firstName
                                  }{" "}
                                  {
                                    students.find(
                                      (s) => s.id === grade.studentId
                                    )?.lastName
                                  }
                                </TableCell>
                                <TableCell>
                                  {
                                    subjects.find(
                                      (s) => s.id === grade.subjectId
                                    )?.name
                                  }
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className="capitalize"
                                  >
                                    {
                                      gradeTypes.find(
                                        (t) => t.value === grade.type
                                      )?.label
                                    }
                                  </Badge>
                                </TableCell>
                                <TableCell
                                  className="max-w-[200px] truncate"
                                  title={grade.title}
                                >
                                  {grade.title}
                                </TableCell>
                                <TableCell
                                  className={`text-center font-bold ${getGradeColor(
                                    grade.value
                                  )}`}
                                >
                                  {grade.value.toFixed(
                                    Number.isInteger(grade.value) ? 0 : 2
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex justify-end gap-2">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-blue-600"
                                            onClick={() => handleEdit(grade)}
                                          >
                                            <Edit2 className="h-4 w-4" />
                                            <span className="sr-only">
                                              Edit
                                            </span>
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Редактиране</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>

                                    <Dialog>
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <DialogTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-red-600"
                                              >
                                                <Trash2 className="h-4 w-4" />
                                                <span className="sr-only">
                                                  Delete
                                                </span>
                                              </Button>
                                            </DialogTrigger>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Изтриване</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                      <DialogContent>
                                        <DialogHeader>
                                          <DialogTitle>
                                            Изтриване на оценка
                                          </DialogTitle>
                                          <DialogDescription>
                                            Сигурни ли сте, че искате да
                                            изтриете тази оценка? Това действие
                                            не може да бъде отменено.
                                          </DialogDescription>
                                        </DialogHeader>
                                        <DialogFooter>
                                          <Button
                                            variant="ghost"
                                            onClick={() => {}}
                                          >
                                            Отказ
                                          </Button>
                                          <Button
                                            variant="destructive"
                                            onClick={() =>
                                              grade.id &&
                                              handleDeleteGrade(grade.id)
                                            }
                                          >
                                            Изтриване
                                          </Button>
                                        </DialogFooter>
                                      </DialogContent>
                                    </Dialog>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Statistics Tab */}
              <TabsContent value="statistics" className="mt-6">
                <Card className="shadow-md border-t-4 border-t-purple-600">
                  <CardHeader className="border-b bg-white">
                    <CardTitle className="text-xl text-gray-800 flex items-center gap-2">
                      <BarChart2 className="w-5 h-5 text-purple-600" />
                      Статистика на оценки
                    </CardTitle>
                    <CardDescription>
                      Обобщена информация за въведените оценки
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {!gradeStatistics ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <BarChart2 className="w-12 h-12 text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium text-gray-700">
                          Няма данни
                        </h3>
                        <p className="text-gray-500 text-center mt-1">
                          Все още няма достатъчно оценки за статистика.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <Card className="shadow-sm">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm text-gray-500 font-normal">
                                Общ брой оценки
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="text-3xl font-bold">
                                {gradeStatistics.total}
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="shadow-sm">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm text-gray-500 font-normal">
                                Среден успех
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div
                                className={`text-3xl font-bold ${getGradeColor(
                                  gradeStatistics.average
                                )}`}
                              >
                                {gradeStatistics.average.toFixed(2)}
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="shadow-sm">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm text-gray-500 font-normal">
                                Най-чест тип оценка
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="text-2xl font-bold capitalize">
                                {
                                  gradeStatistics.byType.sort(
                                    (a, b) => b.count - a.count
                                  )[0]?.label
                                }
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <Card className="shadow-sm">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-lg font-semibold">
                                Разпределение по оценки
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                <div className="space-y-1">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-emerald-600 font-medium">
                                      Отлични (5.50-6.00)
                                    </span>
                                    <span>
                                      {gradeStatistics.distribution.excellent}{" "}
                                      бр. (
                                      {gradeStatistics.distributionPercentages.excellent.toFixed(
                                        1
                                      )}
                                      %)
                                    </span>
                                  </div>
                                  <Progress
                                    value={
                                      gradeStatistics.distributionPercentages
                                        .excellent
                                    }
                                    className="h-2 bg-gray-100"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-blue-600 font-medium">
                                      Мн. добри (4.50-5.49)
                                    </span>
                                    <span>
                                      {gradeStatistics.distribution.veryGood}{" "}
                                      бр. (
                                      {gradeStatistics.distributionPercentages.veryGood.toFixed(
                                        1
                                      )}
                                      %)
                                    </span>
                                  </div>
                                  <Progress
                                    value={
                                      gradeStatistics.distributionPercentages
                                        .veryGood
                                    }
                                    className="h-2 bg-gray-100"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-yellow-600 font-medium">
                                      Добри (3.50-4.49)
                                    </span>
                                    <span>
                                      {gradeStatistics.distribution.good} бр. (
                                      {gradeStatistics.distributionPercentages.good.toFixed(
                                        1
                                      )}
                                      %)
                                    </span>
                                  </div>
                                  <Progress
                                    value={
                                      gradeStatistics.distributionPercentages
                                        .good
                                    }
                                    className="h-2 bg-gray-100"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-orange-600 font-medium">
                                      Средни (3.00-3.49)
                                    </span>
                                    <span>
                                      {gradeStatistics.distribution.average} бр.
                                      (
                                      {gradeStatistics.distributionPercentages.average.toFixed(
                                        1
                                      )}
                                      %)
                                    </span>
                                  </div>
                                  <Progress
                                    value={
                                      gradeStatistics.distributionPercentages
                                        .average
                                    }
                                    className="h-2 bg-gray-100"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-red-600 font-medium">
                                      Слаби (2.00-2.99)
                                    </span>
                                    <span>
                                      {gradeStatistics.distribution.poor} бр. (
                                      {gradeStatistics.distributionPercentages.poor.toFixed(
                                        1
                                      )}
                                      %)
                                    </span>
                                  </div>
                                  <Progress
                                    value={
                                      gradeStatistics.distributionPercentages
                                        .poor
                                    }
                                    className="h-2 bg-gray-100"
                                  />
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="shadow-sm">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-lg font-semibold">
                                По тип оценки
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                {gradeStatistics.byType
                                  .sort((a, b) => b.count - a.count)
                                  .map((type, index) => (
                                    <div key={type.value} className="space-y-1">
                                      <div className="flex justify-between text-sm">
                                        <span className="font-medium">
                                          {type.label}
                                        </span>
                                        <span>
                                          {type.count} бр. (
                                          {(
                                            (type.count /
                                              gradeStatistics.total) *
                                            100
                                          ).toFixed(1)}
                                          %)
                                        </span>
                                      </div>
                                      <Progress
                                        value={
                                          (type.count / gradeStatistics.total) *
                                          100
                                        }
                                        className="h-2 bg-gray-100"
                                      />
                                    </div>
                                  ))}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}

          {/* Edit Grade Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Редактиране на оценка</DialogTitle>
                <DialogDescription>
                  Промяна на детайлите за тази оценка
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="editGradeTitle" className="text-gray-700">
                    Заглавие
                  </Label>
                  <Input
                    id="editGradeTitle"
                    value={gradeTitle}
                    onChange={(e) => setGradeTitle(e.target.value)}
                    className="border-gray-200"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editGradeType" className="text-gray-700">
                    Вид оценка
                  </Label>
                  <Select
                    onValueChange={(value) => setGradeType(value as GradeType)}
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
                  <div className="flex justify-between">
                    <Label htmlFor="editGrade" className="text-gray-700">
                      Оценка
                    </Label>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="editUseDecimal"
                        checked={useDecimalGrade}
                        onCheckedChange={(checked) =>
                          setUseDecimalGrade(checked === true)
                        }
                      />
                      <Label
                        htmlFor="editUseDecimal"
                        className="text-xs text-gray-600 cursor-pointer"
                      >
                        Десетична оценка
                      </Label>
                    </div>
                  </div>

                  {useDecimalGrade ? (
                    <Input
                      id="editDecimalGrade"
                      type="number"
                      min="2"
                      max="6"
                      step="0.01"
                      value={decimalGradeValue}
                      onChange={(e) => setDecimalGradeValue(e.target.value)}
                      className="border-gray-200"
                      required
                    />
                  ) : (
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
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editGradeDate" className="text-gray-700">
                    Дата
                  </Label>
                  <Input
                    type="date"
                    id="editGradeDate"
                    value={gradeDate}
                    onChange={(e) => setGradeDate(e.target.value)}
                    className="border-gray-200"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="editGradeDescription"
                    className="text-gray-700"
                  >
                    Описание
                  </Label>
                  <Textarea
                    id="editGradeDescription"
                    value={gradeDescription}
                    onChange={(e) => setGradeDescription(e.target.value)}
                    className="min-h-[100px] border-gray-200"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                >
                  Отказ
                </Button>
                <Button onClick={handleSaveEdit}>Запази промените</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
