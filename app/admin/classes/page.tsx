"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import Sidebar from "@/components/functional/Sidebar";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search, X, Loader2 } from "lucide-react";

import {
  ClassFormData,
  HomeroomClass,
  TeacherData,
  SubjectData,
  TeacherSubjectMappings,
  fetchClasses,
  fetchTeachers,
  fetchSubjects,
  buildTeacherSubjectMappings,
  updateEducationLevel,
  addClass,
  editClass,
  deleteClass,
  getEducationLevelBadgeStyle,
  getTeacherName,
  getFilteredTeachers,
  getFilteredSubjects,
  getDefaultClassFormData,
} from "@/lib/classManagement";

export default function ClassManagement() {
  const { user } = useUser();
  const router = useRouter();

  const [classes, setClasses] = useState<HomeroomClass[]>([]);
  const [filteredClasses, setFilteredClasses] = useState<HomeroomClass[]>([]);
  const [teachers, setTeachers] = useState<TeacherData[]>([]);
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [teacherSubjectMappings, setTeacherSubjectMappings] =
    useState<TeacherSubjectMappings>({
      teacherToSubjects: {},
      subjectToTeachers: {},
    });
  const [searchQuery, setSearchQuery] = useState("");
  const [educationLevelFilter, setEducationLevelFilter] =
    useState<string>("all");

  const [isAddClassDialogOpen, setIsAddClassDialogOpen] = useState(false);
  const [isEditClassDialogOpen, setIsEditClassDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [classFormData, setClassFormData] = useState<ClassFormData>(
    getDefaultClassFormData()
  );

  const [selectedClass, setSelectedClass] = useState<HomeroomClass | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user?.role !== "admin") {
      router.push("/login");
    } else {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router]);

  const loadData = async () => {
    if (!user?.schoolId) return;
    setIsLoading(true);
    try {
      const [classesData, teachersData, subjectsData] = await Promise.all([
        fetchClasses(user.schoolId),
        fetchTeachers(user.schoolId),
        fetchSubjects(user.schoolId),
      ]);

      setClasses(classesData);
      setTeachers(teachersData);
      setSubjects(subjectsData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (classes.length > 0 && teachers.length > 0 && subjects.length > 0) {
      const mappings = buildTeacherSubjectMappings(classes, teachers, subjects);
      setTeacherSubjectMappings(mappings);
    }
  }, [classes, teachers, subjects]);

  useEffect(() => {
    let result = [...classes];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((cls) =>
        (cls.className || "").toLowerCase().includes(query)
      );
    }

    if (educationLevelFilter !== "all") {
      // Determine education level based on gradeNumber for consistency with display
      result = result.filter((cls) => {
        // For custom named classes without grade number, use the stored educationLevel if available
        if (cls.namingFormat === "custom" && !cls.gradeNumber) {
          return cls.educationLevel === educationLevelFilter;
        }

        // Otherwise derive from gradeNumber
        const derivedLevel =
          cls.gradeNumber <= 4
            ? "primary"
            : cls.gradeNumber <= 7
            ? "middle"
            : "high";

        return derivedLevel === educationLevelFilter;
      });
    }

    result.sort((a, b) => {
      if (a.gradeNumber !== b.gradeNumber) {
        return a.gradeNumber - b.gradeNumber;
      }
      const nameA = a.className || "";
      const nameB = b.className || "";
      return nameA.localeCompare(nameB);
    });

    setFilteredClasses(result);
  }, [classes, searchQuery, educationLevelFilter]);

  const updateClassName = () => {
    if (classFormData.namingFormat === "graded") {
      const gradeName = classFormData.gradeNumber.toString();
      const letterName = classFormData.classLetter;
      setClassFormData((prev) => ({
        ...prev,
        className: gradeName + letterName,
      }));
    }
  };

  useEffect(() => {
    if (classFormData.namingFormat === "graded") {
      updateClassName();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    classFormData.gradeNumber,
    classFormData.classLetter,
    classFormData.namingFormat,
  ]);

  useEffect(() => {
    // Auto-update education level when grade number changes
    const educationLevel = updateEducationLevel(classFormData.gradeNumber);
    setClassFormData((prev) => ({
      ...prev,
      educationLevel,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classFormData.gradeNumber]);

  const handleAddTeacherSubjectPair = () => {
    setClassFormData((prev) => ({
      ...prev,
      teacherSubjectPairs: [
        ...prev.teacherSubjectPairs,
        { teacherId: "", subjectId: "", isHomeroom: false },
      ],
    }));
  };

  const handleRemoveTeacherSubjectPair = (index: number) => {
    if (classFormData.teacherSubjectPairs.length <= 1) return;

    const newPairs = [...classFormData.teacherSubjectPairs];
    newPairs.splice(index, 1);

    const hasHomeroom = newPairs.some((pair) => pair.isHomeroom);
    if (!hasHomeroom && newPairs.length > 0) {
      newPairs[0].isHomeroom = true;
    }

    setClassFormData((prev) => ({
      ...prev,
      teacherSubjectPairs: newPairs,
    }));
  };

  const handleTeacherSubjectPairChange = (
    index: number,
    field: string,
    value: string | boolean
  ) => {
    const newPairs = [...classFormData.teacherSubjectPairs];

    if (field === "isHomeroom" && value === true) {
      newPairs.forEach((pair, i) => {
        if (i !== index) {
          pair.isHomeroom = false;
        }
      });
    }

    newPairs[index] = {
      ...newPairs[index],
      [field]: value,
    };

    setClassFormData((prev) => ({
      ...prev,
      teacherSubjectPairs: newPairs,
    }));
  };

  const getFilteredTeachersForPair = (pairIndex: number): TeacherData[] => {
    return getFilteredTeachers(
      pairIndex,
      classFormData,
      teachers,
      teacherSubjectMappings,
      isEditClassDialogOpen
    );
  };

  const getFilteredSubjectsForPair = (pairIndex: number): SubjectData[] => {
    return getFilteredSubjects(
      pairIndex,
      classFormData,
      subjects,
      teacherSubjectMappings,
      isEditClassDialogOpen
    );
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId) return;

    if (
      classFormData.teacherSubjectPairs.some(
        (pair) => !pair.teacherId || !pair.subjectId
      )
    ) {
      toast({
        title: "Error",
        description:
          "All teacher-subject pairs must have both teacher and subject selected",
        variant: "destructive",
      });
      return;
    }

    const homeroomTeachers = classFormData.teacherSubjectPairs.filter(
      (pair) => pair.isHomeroom
    );
    if (homeroomTeachers.length !== 1) {
      toast({
        title: "Error",
        description: "There must be exactly one homeroom teacher for the class",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await addClass(user.schoolId, classFormData);

      toast({
        title: "Success",
        description: "Class created successfully",
      });

      setClassFormData(getDefaultClassFormData());
      setIsAddClassDialogOpen(false);
      loadData();
    } catch (error) {
      console.error("Error adding class:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create class",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId || !selectedClass?.classId) return;

    if (
      classFormData.teacherSubjectPairs.some(
        (pair) => !pair.teacherId || !pair.subjectId
      )
    ) {
      toast({
        title: "Error",
        description:
          "All teacher-subject pairs must have both teacher and subject selected",
        variant: "destructive",
      });
      return;
    }

    const homeroomTeachers = classFormData.teacherSubjectPairs.filter(
      (pair) => pair.isHomeroom
    );
    if (homeroomTeachers.length !== 1) {
      toast({
        title: "Error",
        description: "There must be exactly one homeroom teacher for the class",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await editClass(user.schoolId, selectedClass, classFormData);

      toast({
        title: "Success",
        description: "Class updated successfully",
      });

      setIsEditClassDialogOpen(false);
      loadData();
    } catch (error) {
      console.error("Error updating class:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update class",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (classData: HomeroomClass) => {
    setSelectedClass(classData);

    const safeTeacherSubjectPairs = classData.teacherSubjectPairs || [];

    setClassFormData({
      classId: classData.classId,
      className: classData.className || "",
      namingFormat: classData.namingFormat || "graded",
      gradeNumber: classData.gradeNumber || 1,
      classLetter: classData.classLetter || "А",
      educationLevel: classData.educationLevel || "primary",
      teacherSubjectPairs: safeTeacherSubjectPairs,
      studentIds: classData.studentIds || [],
    });
    setIsEditClassDialogOpen(true);
  };

  const handleDeleteClick = (classData: HomeroomClass) => {
    setSelectedClass(classData);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteClass = async () => {
    if (!user?.schoolId || !selectedClass?.classId) return;

    setIsSubmitting(true);
    try {
      await deleteClass(user.schoolId, selectedClass);

      toast({
        title: "Success",
        description: "Class deleted successfully",
      });

      setIsDeleteDialogOpen(false);
      loadData();
    } catch (error) {
      console.error("Error deleting class:", error);
      toast({
        title: "Error",
        description: "Failed to delete class",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTeacherNameById = (teacherId: string): string => {
    return getTeacherName(teacherId, teachers);
  };

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="flex-1 p-8 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                Управление на класове
              </h1>
              <p className="text-gray-600 mt-1">
                Създаване и управление на учебни класове и присъединяване на
                учители
              </p>
            </div>

            <div className="flex gap-3">
              <Dialog
                open={isAddClassDialogOpen}
                onOpenChange={setIsAddClassDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button className="flex text-white items-center gap-2">
                    <Plus className="h-4 w-4" />
                    <span>Създай клас</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Създаване на нов клас</DialogTitle>
                    <DialogDescription>
                      Попълнете необходимата информация за създаване на нов
                      учебен клас
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleAddClass} className="space-y-4 my-4">
                    <div className="space-y-2">
                      <Label>Тип на именуване</Label>
                      <RadioGroup
                        value={classFormData.namingFormat}
                        onValueChange={(value) =>
                          setClassFormData({
                            ...classFormData,
                            namingFormat: value as "graded" | "custom",
                          })
                        }
                        className="flex items-center space-x-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="graded" id="naming-standard" />
                          <Label htmlFor="naming-standard">
                            Стандартно (1А, 2Б, и т.н.)
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="custom" id="naming-custom" />
                          <Label htmlFor="naming-custom">По избор</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {classFormData.namingFormat === "graded" ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="gradeNumber">Клас (цифра)</Label>
                          <Select
                            value={classFormData.gradeNumber.toString()}
                            onValueChange={(value) =>
                              setClassFormData({
                                ...classFormData,
                                gradeNumber: parseInt(value),
                              })
                            }
                          >
                            <SelectTrigger id="gradeNumber">
                              <SelectValue placeholder="Изберете клас" />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(
                                (grade) => (
                                  <SelectItem
                                    key={grade}
                                    value={grade.toString()}
                                  >
                                    {grade}
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="classLetter">Паралелка (буква)</Label>
                          <Select
                            value={classFormData.classLetter}
                            onValueChange={(value) =>
                              setClassFormData({
                                ...classFormData,
                                classLetter: value,
                              })
                            }
                          >
                            <SelectTrigger id="classLetter">
                              <SelectValue placeholder="Изберете паралелка" />
                            </SelectTrigger>
                            <SelectContent>
                              {[
                                "А",
                                "Б",
                                "В",
                                "Г",
                                "Д",
                                "Е",
                                "Ж",
                                "З",
                                "И",
                              ].map((letter) => (
                                <SelectItem key={letter} value={letter}>
                                  {letter}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="custom-name">Име на класа</Label>
                        <Input
                          id="custom-name"
                          value={classFormData.className}
                          onChange={(e) =>
                            setClassFormData({
                              ...classFormData,
                              className: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="education-level">
                        Образователно ниво
                      </Label>
                      <Select
                        value={classFormData.educationLevel}
                        onValueChange={(value) =>
                          setClassFormData({
                            ...classFormData,
                            educationLevel: value as
                              | "primary"
                              | "middle"
                              | "high",
                          })
                        }
                      >
                        <SelectTrigger id="education-level">
                          <SelectValue placeholder="Изберете образователно ниво" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="primary">
                            Начален (1-4 клас)
                          </SelectItem>
                          <SelectItem value="middle">
                            Прогимназиален (5-7 клас)
                          </SelectItem>
                          <SelectItem value="high">
                            Гимназиален (8-12 клас)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Учители и предмети</Label>

                      <div className="space-y-3">
                        {classFormData.teacherSubjectPairs.map(
                          (pair, index) => (
                            <div
                              key={index}
                              className="border p-3 rounded-lg bg-gray-50"
                            >
                              <div className="grid grid-cols-2 gap-3 mb-2">
                                <div className="space-y-1">
                                  <Label htmlFor={`teacher-${index}`}>
                                    Учител
                                  </Label>
                                  <Select
                                    value={pair.teacherId}
                                    onValueChange={(value) =>
                                      handleTeacherSubjectPairChange(
                                        index,
                                        "teacherId",
                                        value
                                      )
                                    }
                                  >
                                    <SelectTrigger id={`teacher-${index}`}>
                                      <SelectValue placeholder="Изберете учител" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(pair.subjectId
                                        ? getFilteredTeachersForPair(index)
                                        : teachers
                                      ).map((teacher) => (
                                        <SelectItem
                                          key={teacher.userId}
                                          value={teacher.userId}
                                        >
                                          {teacher.firstName} {teacher.lastName}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-1">
                                  <Label htmlFor={`subject-${index}`}>
                                    Предмет
                                  </Label>
                                  <Select
                                    value={pair.subjectId}
                                    onValueChange={(value) =>
                                      handleTeacherSubjectPairChange(
                                        index,
                                        "subjectId",
                                        value
                                      )
                                    }
                                  >
                                    <SelectTrigger id={`subject-${index}`}>
                                      <SelectValue placeholder="Изберете предмет" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(pair.teacherId
                                        ? getFilteredSubjectsForPair(index)
                                        : subjects
                                      ).map((subject) => (
                                        <SelectItem
                                          key={subject.subjectId}
                                          value={subject.subjectId}
                                        >
                                          {subject.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`homeroom-${index}`}
                                    checked={pair.isHomeroom}
                                    onCheckedChange={(checked) =>
                                      handleTeacherSubjectPairChange(
                                        index,
                                        "isHomeroom",
                                        checked === true
                                      )
                                    }
                                  />
                                  <Label
                                    htmlFor={`homeroom-${index}`}
                                    className="cursor-pointer"
                                  >
                                    Класен ръководител
                                  </Label>
                                </div>

                                {index > 0 && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleRemoveTeacherSubjectPair(index)
                                    }
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  >
                                    Премахни
                                  </Button>
                                )}
                              </div>
                            </div>
                          )
                        )}

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddTeacherSubjectPair}
                          className="w-full"
                        >
                          + Добави учител и предмет
                        </Button>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddClassDialogOpen(false)}
                      >
                        Отказ
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Създаване...
                          </>
                        ) : (
                          "Създай клас"
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Търсене по име на клас..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600"
                      onClick={() => setSearchQuery("")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="md:w-56">
                  <Select
                    value={educationLevelFilter}
                    onValueChange={setEducationLevelFilter}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Филтър по ниво" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Всички нива</SelectItem>
                      <SelectItem value="primary">Начален етап</SelectItem>
                      <SelectItem value="middle">
                        Прогимназиален етап
                      </SelectItem>
                      <SelectItem value="high">Гимназиален етап</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isLoading ? (
                <div className="text-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                  <p className="mt-2 text-gray-500">Зареждане на класове...</p>
                </div>
              ) : (
                <>
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">#</TableHead>
                          <TableHead>Клас</TableHead>
                          <TableHead>Образователно ниво</TableHead>
                          <TableHead>Класен ръководител</TableHead>
                          <TableHead>Брой ученици</TableHead>
                          <TableHead className="w-[100px] text-right">
                            Действия
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredClasses.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="text-center py-10 text-gray-500"
                            >
                              Няма намерени класове
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredClasses.map((classData, index) => (
                            <TableRow key={classData.classId}>
                              <TableCell className="font-medium">
                                {index + 1}
                              </TableCell>
                              <TableCell className="font-medium">
                                {classData.className || ""}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={getEducationLevelBadgeStyle(
                                    classData.namingFormat === "custom" &&
                                      !classData.gradeNumber
                                      ? "custom"
                                      : classData.gradeNumber <= 4
                                      ? "primary"
                                      : classData.gradeNumber <= 7
                                      ? "middle"
                                      : "high"
                                  )}
                                >
                                  {classData.namingFormat === "custom" &&
                                  !classData.gradeNumber
                                    ? "N/A"
                                    : classData.gradeNumber <= 4
                                    ? "Начален"
                                    : classData.gradeNumber <= 7
                                    ? "Прогимназиален"
                                    : "Гимназиален"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {classData.teacherSubjectPairs?.find(
                                  (pair) => pair.isHomeroom
                                )?.teacherId ? (
                                  getTeacherNameById(
                                    classData.teacherSubjectPairs.find(
                                      (pair) => pair.isHomeroom
                                    )!.teacherId
                                  )
                                ) : (
                                  <span className="text-gray-400">
                                    Не е зададен
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                {classData.studentIds?.length || 0}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditClick(classData)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleDeleteClick(classData)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="mt-4 text-sm text-gray-500">
                    Показани {filteredClasses.length} от {classes.length}{" "}
                    класове
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={isEditClassDialogOpen}
        onOpenChange={setIsEditClassDialogOpen}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редактиране на клас</DialogTitle>
            <DialogDescription>
              Променете данните за избрания клас
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditClass} className="space-y-4 my-4">
            <div className="space-y-2">
              <Label>Тип на именуване</Label>
              <RadioGroup
                value={classFormData.namingFormat}
                onValueChange={(value) =>
                  setClassFormData({
                    ...classFormData,
                    namingFormat: value as "graded" | "custom",
                  })
                }
                className="flex items-center space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="graded" id="edit-naming-standard" />
                  <Label htmlFor="edit-naming-standard">
                    Стандартно (1А, 2Б, и т.н.)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custom" id="edit-naming-custom" />
                  <Label htmlFor="edit-naming-custom">По избор</Label>
                </div>
              </RadioGroup>
            </div>

            {classFormData.namingFormat === "graded" ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-gradeNumber">Клас (цифра)</Label>
                  <Select
                    value={classFormData.gradeNumber.toString()}
                    onValueChange={(value) =>
                      setClassFormData({
                        ...classFormData,
                        gradeNumber: parseInt(value),
                      })
                    }
                  >
                    <SelectTrigger id="edit-gradeNumber">
                      <SelectValue placeholder="Изберете клас" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((grade) => (
                        <SelectItem key={grade} value={grade.toString()}>
                          {grade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-classLetter">Паралелка (буква)</Label>
                  <Select
                    value={classFormData.classLetter}
                    onValueChange={(value) =>
                      setClassFormData({ ...classFormData, classLetter: value })
                    }
                  >
                    <SelectTrigger id="edit-classLetter">
                      <SelectValue placeholder="Изберете паралелка" />
                    </SelectTrigger>
                    <SelectContent>
                      {["А", "Б", "В", "Г", "Д", "Е", "Ж", "З", "И"].map(
                        (letter) => (
                          <SelectItem key={letter} value={letter}>
                            {letter}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="edit-custom-name">Име на класа</Label>
                <Input
                  id="edit-custom-name"
                  value={classFormData.className}
                  onChange={(e) =>
                    setClassFormData({
                      ...classFormData,
                      className: e.target.value,
                    })
                  }
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-education-level">Образователно ниво</Label>
              <Select
                value={classFormData.educationLevel}
                onValueChange={(value) =>
                  setClassFormData({
                    ...classFormData,
                    educationLevel: value as "primary" | "middle" | "high",
                  })
                }
              >
                <SelectTrigger id="edit-education-level">
                  <SelectValue placeholder="Изберете образователно ниво" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Начален (1-4 клас)</SelectItem>
                  <SelectItem value="middle">
                    Прогимназиален (5-7 клас)
                  </SelectItem>
                  <SelectItem value="high">Гимназиален (8-12 клас)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Учители и предмети</Label>

              <div className="space-y-3">
                {classFormData.teacherSubjectPairs.map((pair, index) => (
                  <div key={index} className="border p-3 rounded-lg bg-gray-50">
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <div className="space-y-1">
                        <Label htmlFor={`edit-teacher-${index}`}>Учител</Label>
                        <Select
                          value={pair.teacherId}
                          onValueChange={(value) =>
                            handleTeacherSubjectPairChange(
                              index,
                              "teacherId",
                              value
                            )
                          }
                        >
                          <SelectTrigger id={`edit-teacher-${index}`}>
                            <SelectValue placeholder="Изберете учител" />
                          </SelectTrigger>
                          <SelectContent>
                            {(pair.subjectId
                              ? getFilteredTeachersForPair(index)
                              : teachers
                            ).map((teacher) => (
                              <SelectItem
                                key={teacher.userId}
                                value={teacher.userId}
                              >
                                {teacher.firstName} {teacher.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor={`edit-subject-${index}`}>Предмет</Label>
                        <Select
                          value={pair.subjectId}
                          onValueChange={(value) =>
                            handleTeacherSubjectPairChange(
                              index,
                              "subjectId",
                              value
                            )
                          }
                        >
                          <SelectTrigger id={`edit-subject-${index}`}>
                            <SelectValue placeholder="Изберете предмет" />
                          </SelectTrigger>
                          <SelectContent>
                            {(pair.teacherId
                              ? getFilteredSubjectsForPair(index)
                              : subjects
                            ).map((subject) => (
                              <SelectItem
                                key={subject.subjectId}
                                value={subject.subjectId}
                              >
                                {subject.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-homeroom-${index}`}
                          checked={pair.isHomeroom}
                          onCheckedChange={(checked) =>
                            handleTeacherSubjectPairChange(
                              index,
                              "isHomeroom",
                              checked === true
                            )
                          }
                        />
                        <Label
                          htmlFor={`edit-homeroom-${index}`}
                          className="cursor-pointer"
                        >
                          Класен ръководител
                        </Label>
                      </div>

                      {index > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveTeacherSubjectPair(index)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          Премахни
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddTeacherSubjectPair}
                  className="w-full"
                >
                  + Добави учител и предмет
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditClassDialogOpen(false)}
              >
                Отказ
              </Button>
              <Button
                type="submit"
                className="text-white"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Запазване...
                  </>
                ) : (
                  "Запази"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Изтриване на клас</DialogTitle>
            <DialogDescription>
              Сигурни ли сте, че искате да изтриете този клас? Това действие не
              може да бъде отменено.
            </DialogDescription>
          </DialogHeader>

          {selectedClass && (
            <div className="py-4">
              <p className="font-medium">Клас: {selectedClass.className}</p>
              <p className="text-sm text-gray-500 mt-1">
                {selectedClass.educationLevel === "primary"
                  ? "Начален етап"
                  : selectedClass.educationLevel === "middle"
                  ? "Прогимназиален етап"
                  : "Гимназиален етап"}
              </p>

              <div className="mt-4 text-sm">
                <p className="mt-1">
                  <span className="font-medium">Ученици:</span>{" "}
                  {selectedClass.studentIds?.length || 0}
                </p>
              </div>

              {selectedClass.studentIds?.length > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded-md text-yellow-700 text-sm">
                  <p className="font-medium">Внимание:</p>
                  <p>
                    Този клас съдържа {selectedClass.studentIds.length} ученици.
                    При изтриване на класа, учениците ще останат в системата, но
                    няма да бъдат асоциирани с никой клас.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Отказ
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteClass}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Изтриване...
                </>
              ) : (
                "Изтрий"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
