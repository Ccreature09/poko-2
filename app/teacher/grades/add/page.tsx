"use client";

import React, { useState, useMemo } from "react";
import { useUser } from "@/contexts/UserContext";
import { useGrades } from "@/contexts/GradesContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
  Users,
  FileText,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

// Import all the grade management functions
import {
  filterGrades,
  getGradeColor,
  gradeOptions,
  gradeTypes,
  type GradeFilters,
} from "@/lib/management/gradeManagement";

// Custom Progress component that uses Progress component directly
const StyledProgress = React.forwardRef<
  React.ElementRef<typeof Progress>,
  React.ComponentPropsWithoutRef<typeof Progress>
>(({ className, ...props }, ref) => (
  <Progress ref={ref} className={className} {...props} />
));
StyledProgress.displayName = "StyledProgress";

export default function AddGrades() {
  const { user } = useUser();
  const {
    grades,
    students,
    subjects,
    classes,
    loading,
    addGrade,
    updateGrade,
    deleteGrade,
    addBatchGrades,
    refreshGrades,
  } = useGrades();

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

  // Apply local filters to grades
  const filteredGrades = useMemo(() => {
    return filterGrades(grades, students, subjects, filters);
  }, [grades, students, subjects, filters]);

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

    const newGrade = await addGrade(selectedStudent, selectedSubject, {
      value: parsedValue,
      title: gradeTitle,
      description: gradeDescription,
      type: gradeType,
      date: new Date(gradeDate),
    });

    if (newGrade) {
      resetForm();
      toast({
        title: "Успешно добавена",
        description: "Оценката беше успешно добавена",
      });
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

    const newGrades = await addBatchGrades(batchStudents, selectedSubject, {
      value: parsedValue,
      title: gradeTitle,
      description: gradeDescription,
      type: gradeType,
      date: new Date(gradeDate),
    });

    if (newGrades.length > 0) {
      resetForm();
      setBatchStudents([]);
      toast({
        title: "Успешно добавени",
        description: `${newGrades.length} оценки бяха успешно добавени`,
      });
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

    const success = await updateGrade(editingGrade.id, {
      value: parsedValue,
      title: gradeTitle,
      description: gradeDescription,
      type: gradeType,
      date: new Date(gradeDate),
    });

    if (success) {
      setEditDialogOpen(false);
      resetForm();
      toast({
        title: "Успешно обновена",
        description: "Оценката беше успешно обновена",
      });
    }
  };

  // Handler for deleting a grade
  const handleDeleteGrade = async (gradeId: string) => {
    if (!user || !user.schoolId) return;

    const success = await deleteGrade(gradeId);

    if (success) {
      toast({
        title: "Успешно изтрита",
        description: "Оценката беше успешно изтрита",
      });
    }
  };

  if (!user || user.role !== "teacher") return null;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="flex flex-1">
        <Sidebar />
        <div className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold">Добавяне на оценки</h1>
              <p className="text-gray-500">
                Добавете нови оценки на ученици или управлявайте съществуващи
              </p>
            </div>
            <Button
              variant="outline"
              onClick={refreshGrades}
              className="flex items-center gap-2"
            >
              <BarChart2 className="h-4 w-4" /> Обнови данните
            </Button>
          </div>

          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <Tabs
              defaultValue="add-grade"
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-3 mb-8">
                <TabsTrigger
                  value="add-grade"
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" /> Добави оценка
                </TabsTrigger>
                <TabsTrigger
                  value="batch-grades"
                  className="flex items-center gap-2"
                >
                  <Users className="h-4 w-4" /> Групово оценяване
                </TabsTrigger>
                <TabsTrigger
                  value="manage-grades"
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" /> Управление на оценки
                </TabsTrigger>
              </TabsList>

              <TabsContent value="add-grade">
                <Card>
                  <CardHeader>
                    <CardTitle>Добавяне на оценка</CardTitle>
                    <CardDescription>
                      Добавете оценка на ученик за конкретен предмет
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleAddGrade} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="class-select">Клас</Label>
                          <Select
                            value={selectedClassForStudent}
                            onValueChange={setSelectedClassForStudent}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Изберете клас" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all_classes">
                                Всички класове
                              </SelectItem>
                              {classes.map((cls) => (
                                <SelectItem key={cls.id} value={cls.id}>
                                  {cls.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="student-select">Ученик</Label>
                          <Select
                            value={selectedStudent}
                            onValueChange={setSelectedStudent}
                            required
                          >
                            <SelectTrigger>
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
                          <Label htmlFor="subject-select">Предмет</Label>
                          <Select
                            value={selectedSubject}
                            onValueChange={setSelectedSubject}
                            required
                          >
                            <SelectTrigger>
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
                          <Label htmlFor="grade-type">Тип оценка</Label>
                          <Select
                            value={gradeType}
                            onValueChange={(value) =>
                              setGradeType(value as GradeType)
                            }
                            required
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Изберете тип оценка" />
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
                            <Label htmlFor="grade-value">Оценка</Label>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="use-decimal"
                                checked={useDecimalGrade}
                                onCheckedChange={(checked) =>
                                  setUseDecimalGrade(!!checked)
                                }
                              />
                              <Label
                                htmlFor="use-decimal"
                                className="text-sm cursor-pointer"
                              >
                                Точна оценка
                              </Label>
                            </div>
                          </div>

                          {useDecimalGrade ? (
                            <Input
                              id="decimal-grade"
                              type="number"
                              min="2"
                              max="6"
                              step="0.01"
                              value={decimalGradeValue}
                              onChange={(e) =>
                                setDecimalGradeValue(e.target.value)
                              }
                              required
                              placeholder="Напр. 5.50"
                            />
                          ) : (
                            <Select
                              value={gradeValue}
                              onValueChange={setGradeValue}
                              required
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Изберете оценка" />
                              </SelectTrigger>
                              <SelectContent>
                                {gradeOptions.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value.toString()}
                                  >
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="grade-date">Дата</Label>
                          <Input
                            id="grade-date"
                            type="date"
                            value={gradeDate}
                            onChange={(e) => setGradeDate(e.target.value)}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="grade-title">Заглавие</Label>
                          <Input
                            id="grade-title"
                            value={gradeTitle}
                            onChange={(e) => setGradeTitle(e.target.value)}
                            required
                            placeholder="Напр. Класна работа, Тест, Домашно"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="grade-description">Описание</Label>
                          <Textarea
                            id="grade-description"
                            value={gradeDescription}
                            onChange={(e) =>
                              setGradeDescription(e.target.value)
                            }
                            placeholder="Допълнителна информация за оценката (незадължително)"
                          />
                        </div>
                      </div>

                      <Button type="submit" className="w-full">
                        Добави оценка
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="batch-grades">
                <Card>
                  <CardHeader>
                    <CardTitle>Групово оценяване</CardTitle>
                    <CardDescription>
                      Добавете една и съща оценка на множество ученици
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleAddBatchGrades} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="class-select-batch">Клас</Label>
                          <Select
                            value={selectedClass}
                            onValueChange={(value) => {
                              setSelectedClass(value);
                              setBatchStudents([]);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Изберете клас" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all_students_batch">
                                Всички класове
                              </SelectItem>
                              {classes.map((cls) => (
                                <SelectItem key={cls.id} value={cls.id}>
                                  {cls.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="subject-select-batch">Предмет</Label>
                          <Select
                            value={selectedSubject}
                            onValueChange={setSelectedSubject}
                            required
                          >
                            <SelectTrigger>
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
                          <Label htmlFor="grade-type-batch">Тип оценка</Label>
                          <Select
                            value={gradeType}
                            onValueChange={(value) =>
                              setGradeType(value as GradeType)
                            }
                            required
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Изберете тип оценка" />
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
                            <Label htmlFor="grade-value-batch">Оценка</Label>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="use-decimal-batch"
                                checked={useDecimalGrade}
                                onCheckedChange={(checked) =>
                                  setUseDecimalGrade(!!checked)
                                }
                              />
                              <Label
                                htmlFor="use-decimal-batch"
                                className="text-sm cursor-pointer"
                              >
                                Точна оценка
                              </Label>
                            </div>
                          </div>

                          {useDecimalGrade ? (
                            <Input
                              id="decimal-grade-batch"
                              type="number"
                              min="2"
                              max="6"
                              step="0.01"
                              value={decimalGradeValue}
                              onChange={(e) =>
                                setDecimalGradeValue(e.target.value)
                              }
                              required
                              placeholder="Напр. 5.50"
                            />
                          ) : (
                            <Select
                              value={gradeValue}
                              onValueChange={setGradeValue}
                              required
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Изберете оценка" />
                              </SelectTrigger>
                              <SelectContent>
                                {gradeOptions.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value.toString()}
                                  >
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="grade-date-batch">Дата</Label>
                          <Input
                            id="grade-date-batch"
                            type="date"
                            value={gradeDate}
                            onChange={(e) => setGradeDate(e.target.value)}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="grade-title-batch">Заглавие</Label>
                          <Input
                            id="grade-title-batch"
                            value={gradeTitle}
                            onChange={(e) => setGradeTitle(e.target.value)}
                            required
                            placeholder="Напр. Класна работа, Тест, Домашно"
                          />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="grade-description-batch">
                            Описание
                          </Label>
                          <Textarea
                            id="grade-description-batch"
                            value={gradeDescription}
                            onChange={(e) =>
                              setGradeDescription(e.target.value)
                            }
                            placeholder="Допълнителна информация за оценката (незадължително)"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="font-medium text-lg">
                            Избрани ученици ({batchStudents.length})
                          </h3>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={selectAllStudents}
                            >
                              Избери всички
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={deselectAllStudents}
                            >
                              Изчисти
                            </Button>
                          </div>
                        </div>

                        <div className="border rounded-md">
                          <ScrollArea className="h-64">
                            <div className="p-4 space-y-2">
                              {getClassStudents.length === 0 ? (
                                <p className="text-center text-gray-500 py-4">
                                  Няма ученици в този клас
                                </p>
                              ) : (
                                getClassStudents.map((student) => (
                                  <div
                                    key={student.id}
                                    className="flex items-center space-x-2"
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
                                      className="cursor-pointer"
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

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={
                          batchStudents.length === 0 || !selectedSubject
                        }
                      >
                        Добави оценки ({batchStudents.length} ученици)
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="manage-grades">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex justify-between">
                      <span>Управление на оценки</span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowFilters(!showFilters)}
                          className="flex items-center gap-1"
                        >
                          <Filter className="h-4 w-4" />{" "}
                          {showFilters ? "Скрий филтрите" : "Филтри"}
                        </Button>
                      </div>
                    </CardTitle>
                    <CardDescription>
                      Преглед, редактиране и изтриване на въведени оценки
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <div className="relative">
                        <Search className="absolute left-2 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Търсене по име на ученик, предмет, заглавие..."
                          className="pl-8"
                          value={filters.searchTerm}
                          onChange={(e) =>
                            setFilters({
                              ...filters,
                              searchTerm: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>

                    {showFilters && (
                      <div className="space-y-4 mb-6 p-4 border rounded-lg bg-gray-50">
                        <h3 className="font-medium mb-2">
                          Допълнителни филтри
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="filter-student">Ученик</Label>
                            <Select
                              value={filters.student}
                              onValueChange={(value) =>
                                setFilters({ ...filters, student: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Всички ученици" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all_students">
                                  Всички ученици
                                </SelectItem>
                                {students.map((student) => (
                                  <SelectItem
                                    key={student.id}
                                    value={student.id}
                                  >
                                    {student.firstName} {student.lastName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="filter-subject">Предмет</Label>
                            <Select
                              value={filters.subject}
                              onValueChange={(value) =>
                                setFilters({ ...filters, subject: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Всички предмети" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all_subjects">
                                  Всички предмети
                                </SelectItem>
                                {subjects.map((subject) => (
                                  <SelectItem
                                    key={subject.id}
                                    value={subject.id}
                                  >
                                    {subject.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="filter-type">Тип оценка</Label>
                            <Select
                              value={filters.gradeType}
                              onValueChange={(value) =>
                                setFilters({
                                  ...filters,
                                  gradeType: value as
                                    | ""
                                    | GradeType
                                    | "all_grade_types",
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Всички типове" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all_grade_types">
                                  Всички типове
                                </SelectItem>
                                {gradeTypes.map((type) => (
                                  <SelectItem
                                    key={type.value}
                                    value={type.value as GradeType}
                                  >
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <Button
                            variant="secondary"
                            onClick={resetFilters}
                            size="sm"
                          >
                            Изчисти филтрите
                          </Button>
                        </div>
                      </div>
                    )}

                    {filteredGrades.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">
                          Няма намерени оценки за тези критерии
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Дата</TableHead>
                              <TableHead>Ученик</TableHead>
                              <TableHead>Предмет</TableHead>
                              <TableHead>Заглавие</TableHead>
                              <TableHead>Тип</TableHead>
                              <TableHead>Оценка</TableHead>
                              <TableHead className="text-right">
                                Действия
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredGrades.map((grade) => {
                              const student = students.find(
                                (s) => s.id === grade.studentId
                              );
                              const subject = subjects.find(
                                (s) => s.id === grade.subjectId
                              );
                              const gradeType = gradeTypes.find(
                                (t) => t.value === grade.type
                              );
                              const gradeColor = getGradeColor(grade.value);
                              const gradeDate = new Date(
                                grade.date.seconds * 1000
                              ).toLocaleDateString();

                              return (
                                <TableRow key={grade.id}>
                                  <TableCell className="font-medium">
                                    {gradeDate}
                                  </TableCell>
                                  <TableCell>
                                    {student
                                      ? `${student.firstName} ${student.lastName}`
                                      : "Неизвестен"}
                                  </TableCell>
                                  <TableCell>
                                    {subject ? subject.name : "Неизвестен"}
                                  </TableCell>
                                  <TableCell>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="truncate max-w-[100px] inline-block">
                                            {grade.title}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{grade.title}</p>
                                          {grade.description && (
                                            <p className="text-xs text-gray-500">
                                              {grade.description}
                                            </p>
                                          )}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </TableCell>
                                  <TableCell>
                                    {gradeType ? gradeType.label : grade.type}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      className={`${gradeColor} font-bold`}
                                    >
                                      {grade.value.toFixed(2)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right space-x-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleEdit(grade)}
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        handleDeleteGrade(grade.id as string)
                                      }
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}

          {/* Edit Grade Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="sm:max-w-[725px]">
              <DialogHeader>
                <DialogTitle>Редактиране на оценка</DialogTitle>
                <DialogDescription>
                  Актуализирайте информацията за тази оценка
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-grade-type">Тип оценка</Label>
                  <Select
                    value={gradeType}
                    onValueChange={(value) => setGradeType(value as GradeType)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Изберете тип оценка" />
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
                    <Label htmlFor="edit-grade-value">Оценка</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="edit-use-decimal"
                        checked={useDecimalGrade}
                        onCheckedChange={(checked) =>
                          setUseDecimalGrade(!!checked)
                        }
                      />
                      <Label
                        htmlFor="edit-use-decimal"
                        className="text-sm cursor-pointer"
                      >
                        Точна оценка
                      </Label>
                    </div>
                  </div>

                  {useDecimalGrade ? (
                    <Input
                      id="edit-decimal-grade"
                      type="number"
                      min="2"
                      max="6"
                      step="0.01"
                      value={decimalGradeValue}
                      onChange={(e) => setDecimalGradeValue(e.target.value)}
                      required
                      placeholder="Напр. 5.50"
                    />
                  ) : (
                    <Select
                      value={gradeValue}
                      onValueChange={setGradeValue}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Изберете оценка" />
                      </SelectTrigger>
                      <SelectContent>
                        {gradeOptions.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value.toString()}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-grade-date">Дата</Label>
                  <Input
                    id="edit-grade-date"
                    type="date"
                    value={gradeDate}
                    onChange={(e) => setGradeDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-grade-title">Заглавие</Label>
                  <Input
                    id="edit-grade-title"
                    value={gradeTitle}
                    onChange={(e) => setGradeTitle(e.target.value)}
                    required
                    placeholder="Напр. Класна работа, Тест, Домашно"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="edit-grade-description">Описание</Label>
                  <Textarea
                    id="edit-grade-description"
                    value={gradeDescription}
                    onChange={(e) => setGradeDescription(e.target.value)}
                    placeholder="Допълнителна информация за оценката (незадължително)"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                >
                  Откажи
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
