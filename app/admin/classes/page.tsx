// ClassManagement Component - Handles administration of school classes
// Allows creating, editing, and deleting classes, assigning teachers and subjects
"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/contexts/UserContext";
import { useRouter } from "next/navigation";

// UI Components
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
import Sidebar from "@/components/functional/layout/Sidebar";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search, X, Loader2 } from "lucide-react";

// Data management utilities
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
} from "@/lib/management/classManagement";

export default function ClassManagement() {
  const { user } = useUser();
  const router = useRouter();

  // Main state for classes and filtering
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

  // Dialog control states
  const [isAddClassDialogOpen, setIsAddClassDialogOpen] = useState(false);
  const [isEditClassDialogOpen, setIsEditClassDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Form data and selected class
  const [classFormData, setClassFormData] = useState<ClassFormData>(
    getDefaultClassFormData()
  );
  const [selectedClass, setSelectedClass] = useState<HomeroomClass | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Redirect non-admin users to login, or load data for admins
    if (user?.role !== "admin") {
      router.push("/login");
    } else {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router]);

  /**
   * Loads initial data for classes, teachers, and subjects from the server
   */
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
        title: "Грешка",
        description: "Неуспешно зареждане на данните",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Build mappings between teachers and subjects when data is available
    if (classes.length > 0 && teachers.length > 0 && subjects.length > 0) {
      const mappings = buildTeacherSubjectMappings(classes, teachers, subjects);
      setTeacherSubjectMappings(mappings);
    }
  }, [classes, teachers, subjects]);

  useEffect(() => {
    // Filter and sort classes based on search query and education level
    let result = [...classes];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((cls) =>
        (cls.className || "").toLowerCase().includes(query)
      );
    }

    if (educationLevelFilter !== "all") {
      result = result.filter((cls) => {
        if (cls.namingFormat === "custom" && !cls.gradeNumber) {
          return cls.educationLevel === educationLevelFilter;
        }

        const derivedLevel =
          cls.gradeNumber <= 4
            ? "primary"
            : cls.gradeNumber <= 7
            ? "middle"
            : "high";

        return derivedLevel === educationLevelFilter;
      });
    }

    // Sort classes by grade number first, then by class name
    result.sort((a, b) => {
      if (a.gradeNumber !== b.gradeNumber) {
        return a.gradeNumber - b.gradeNumber;
      }
      const nameA = a.className || "";
      const nameB = b.className || "";
      return nameA.localeCompare(nameB);
    });

    setFilteredClasses(result);
    // Reset to first page when filters change
    setCurrentPage(1);
  }, [classes, searchQuery, educationLevelFilter]);

  /**
   * Gets the current page of classes for pagination
   * @returns Array of classes for the current page
   */
  const getCurrentPageClasses = useCallback(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return filteredClasses.slice(startIndex, endIndex);
  }, [filteredClasses, currentPage, rowsPerPage]);

  /**
   * Handles changing the current page
   * @param page - The page number to change to
   */
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  /**
   * Updates the class name automatically when using "graded" naming format
   */
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
    // Auto-generate class name when grade or letter changes in graded format
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
    // Update education level based on grade number
    const educationLevel = updateEducationLevel(classFormData.gradeNumber);
    setClassFormData((prev) => ({
      ...prev,
      educationLevel,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classFormData.gradeNumber]);

  /**
   * Adds a new empty teacher-subject pair to the form
   */
  const handleAddTeacherSubjectPair = () => {
    setClassFormData((prev) => ({
      ...prev,
      teacherSubjectPairs: [
        ...prev.teacherSubjectPairs,
        { teacherId: "", subjectId: "", isHomeroom: false },
      ],
    }));
  };

  /**
   * Removes a teacher-subject pair from the form
   * Ensures at least one pair remains and that one pair is marked as homeroom
   * @param index - The index of the pair to remove
   */
  const handleRemoveTeacherSubjectPair = (index: number) => {
    if (classFormData.teacherSubjectPairs.length <= 1) return;

    const newPairs = [...classFormData.teacherSubjectPairs];
    newPairs.splice(index, 1);

    // Ensure one teacher is designated as homeroom
    const hasHomeroom = newPairs.some((pair) => pair.isHomeroom);
    if (!hasHomeroom && newPairs.length > 0) {
      newPairs[0].isHomeroom = true;
    }

    setClassFormData((prev) => ({
      ...prev,
      teacherSubjectPairs: newPairs,
    }));
  };

  /**
   * Handles changes to a teacher-subject pair in the form
   * Ensures only one teacher can be the homeroom teacher
   * @param index - The index of the pair to update
   * @param field - The field to update (teacherId, subjectId, isHomeroom)
   * @param value - The new value for the field
   */
  const handleTeacherSubjectPairChange = (
    index: number,
    field: string,
    value: string | boolean
  ) => {
    const newPairs = [...classFormData.teacherSubjectPairs];

    // If marking as homeroom, unmark all other teachers
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

  /**
   * Filters the list of teachers for a specific teacher-subject pair
   * Prevents selection of teachers that would cause conflicts
   * @param pairIndex - The index of the current pair
   * @returns Filtered list of available teachers
   */
  const getFilteredTeachersForPair = (pairIndex: number): TeacherData[] => {
    return getFilteredTeachers(
      pairIndex,
      classFormData,
      teachers,
      teacherSubjectMappings,
      isEditClassDialogOpen
    );
  };

  /**
   * Filters the list of subjects for a specific teacher-subject pair
   * Prevents selection of subjects that would cause conflicts
   * @param pairIndex - The index of the current pair
   * @returns Filtered list of available subjects
   */
  const getFilteredSubjectsForPair = (pairIndex: number): SubjectData[] => {
    return getFilteredSubjects(
      pairIndex,
      classFormData,
      subjects,
      teacherSubjectMappings,
      isEditClassDialogOpen
    );
  };

  /**
   * Handles the submission of the class creation form
   * Validates form data and creates a new class
   * @param e - Form submission event
   */
  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId) return;

    // Validate teacher-subject pairs
    if (
      classFormData.teacherSubjectPairs.some(
        (pair) => !pair.teacherId || !pair.subjectId
      )
    ) {
      toast({
        title: "Грешка",
        description:
          "Всички двойки учител-предмет трябва да имат избран учител и предмет",
        variant: "destructive",
      });
      return;
    }

    // Validate homeroom teacher selection
    const homeroomTeachers = classFormData.teacherSubjectPairs.filter(
      (pair) => pair.isHomeroom
    );
    if (homeroomTeachers.length !== 1) {
      toast({
        title: "Грешка",
        description: "Трябва да има точно един класен ръководител за класа",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await addClass(user.schoolId, classFormData);

      toast({
        title: "Успешно",
        description: "Класът е създаден успешно",
      });

      setClassFormData(getDefaultClassFormData());
      setIsAddClassDialogOpen(false);
      loadData();
    } catch (error) {
      console.error("Error adding class:", error);
      toast({
        title: "Грешка",
        description:
          error instanceof Error
            ? error.message
            : "Неуспешно създаване на клас",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handles the submission of the class edit form
   * Validates form data and updates existing class
   * @param e - Form submission event
   */
  const handleEditClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId || !selectedClass?.classId) return;

    // Validate teacher-subject pairs
    if (
      classFormData.teacherSubjectPairs.some(
        (pair) => !pair.teacherId || !pair.subjectId
      )
    ) {
      toast({
        title: "Грешка",
        description:
          "Всички двойки учител-предмет трябва да имат избран учител и предмет",
        variant: "destructive",
      });
      return;
    }

    // Validate homeroom teacher selection
    const homeroomTeachers = classFormData.teacherSubjectPairs.filter(
      (pair) => pair.isHomeroom
    );
    if (homeroomTeachers.length !== 1) {
      toast({
        title: "Грешка",
        description: "Трябва да има точно един класен ръководител за класа",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await editClass(user.schoolId, selectedClass, classFormData);

      toast({
        title: "Успешно",
        description: "Класът е актуализиран успешно",
      });

      setIsEditClassDialogOpen(false);
      loadData();
    } catch (error) {
      console.error("Error updating class:", error);
      toast({
        title: "Грешка",
        description:
          error instanceof Error
            ? error.message
            : "Неуспешно актуализиране на клас",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Prepares the form for editing an existing class
   * @param classData - The class to edit
   */
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

  /**
   * Prepares for class deletion
   * @param classData - The class to delete
   */
  const handleDeleteClick = (classData: HomeroomClass) => {
    setSelectedClass(classData);
    setIsDeleteDialogOpen(true);
  };

  /**
   * Handles the deletion of a class
   */
  const handleDeleteClass = async () => {
    if (!user?.schoolId || !selectedClass?.classId) return;

    setIsSubmitting(true);
    try {
      await deleteClass(user.schoolId, selectedClass);

      toast({
        title: "Успешно",
        description: "Класът е изтрит успешно",
      });

      setIsDeleteDialogOpen(false);
      loadData();
    } catch (error) {
      console.error("Error deleting class:", error);
      toast({
        title: "Грешка",
        description: "Неуспешно изтриване на клас",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Gets teacher's full name by ID
   * @param teacherId - The ID of the teacher
   * @returns The teacher's full name or placeholder if not found
   */
  const getTeacherNameById = (teacherId: string): string => {
    return getTeacherName(teacherId, teachers);
  };

  // Protect route - return null if user is not an admin
  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="flex-1 p-4 md:p-8 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
                Управление на класове
              </h1>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">
                Създаване и управление на учебни класове и присъединяване на
                учители
              </p>
            </div>

            <div className="flex gap-2 sm:gap-3">
              <Dialog
                open={isAddClassDialogOpen}
                onOpenChange={setIsAddClassDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button className="flex text-white items-center gap-2 text-xs sm:text-sm h-9 sm:h-10">
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span>Създай клас</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
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
                        className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="graded" id="naming-standard" />
                          <Label htmlFor="naming-standard" className="text-sm">
                            Стандартно (1А, 2Б, и т.н.)
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="custom" id="naming-custom" />
                          <Label htmlFor="naming-custom" className="text-sm">
                            По избор
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {classFormData.namingFormat === "graded" ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="gradeNumber" className="text-sm">
                            Клас (цифра)
                          </Label>
                          <Select
                            value={classFormData.gradeNumber.toString()}
                            onValueChange={(value) =>
                              setClassFormData({
                                ...classFormData,
                                gradeNumber: parseInt(value),
                              })
                            }
                          >
                            <SelectTrigger
                              id="gradeNumber"
                              className="text-xs sm:text-sm h-9 sm:h-10"
                            >
                              <SelectValue placeholder="Изберете клас" />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(
                                (grade) => (
                                  <SelectItem
                                    key={grade}
                                    value={grade.toString()}
                                    className="text-xs sm:text-sm"
                                  >
                                    {grade}
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="classLetter" className="text-sm">
                            Паралелка (буква)
                          </Label>
                          <Select
                            value={classFormData.classLetter}
                            onValueChange={(value) =>
                              setClassFormData({
                                ...classFormData,
                                classLetter: value,
                              })
                            }
                          >
                            <SelectTrigger
                              id="classLetter"
                              className="text-xs sm:text-sm h-9 sm:h-10"
                            >
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
                                <SelectItem
                                  key={letter}
                                  value={letter}
                                  className="text-xs sm:text-sm"
                                >
                                  {letter}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="custom-name" className="text-sm">
                          Име на класа
                        </Label>
                        <Input
                          id="custom-name"
                          value={classFormData.className}
                          onChange={(e) =>
                            setClassFormData({
                              ...classFormData,
                              className: e.target.value,
                            })
                          }
                          className="text-xs sm:text-sm h-9 sm:h-10"
                          required
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="education-level" className="text-sm">
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
                        <SelectTrigger
                          id="education-level"
                          className="text-xs sm:text-sm h-9 sm:h-10"
                        >
                          <SelectValue placeholder="Изберете образователно ниво" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            value="primary"
                            className="text-xs sm:text-sm"
                          >
                            Начален (1-4 клас)
                          </SelectItem>
                          <SelectItem
                            value="middle"
                            className="text-xs sm:text-sm"
                          >
                            Прогимназиален (5-7 клас)
                          </SelectItem>
                          <SelectItem
                            value="high"
                            className="text-xs sm:text-sm"
                          >
                            Гимназиален (8-12 клас)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Учители и предмети</Label>

                      <div className="space-y-3">
                        {classFormData.teacherSubjectPairs.map(
                          (pair, index) => (
                            <div
                              key={index}
                              className="border p-2 sm:p-3 rounded-lg bg-gray-50"
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-2">
                                <div className="space-y-1">
                                  <Label
                                    htmlFor={`teacher-${index}`}
                                    className="text-xs sm:text-sm"
                                  >
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
                                    <SelectTrigger
                                      id={`teacher-${index}`}
                                      className="text-xs sm:text-sm h-8 sm:h-9"
                                    >
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
                                          className="text-xs sm:text-sm"
                                        >
                                          {teacher.firstName} {teacher.lastName}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-1">
                                  <Label
                                    htmlFor={`subject-${index}`}
                                    className="text-xs sm:text-sm"
                                  >
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
                                    <SelectTrigger
                                      id={`subject-${index}`}
                                      className="text-xs sm:text-sm h-8 sm:h-9"
                                    >
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
                                          className="text-xs sm:text-sm"
                                        >
                                          {subject.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
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
                                    className="h-3 w-3 sm:h-4 sm:w-4"
                                  />
                                  <Label
                                    htmlFor={`homeroom-${index}`}
                                    className="cursor-pointer text-xs sm:text-sm"
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
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs h-7 sm:h-8"
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
                          className="w-full text-xs sm:text-sm h-8 sm:h-9"
                        >
                          + Добави учител и предмет
                        </Button>
                      </div>
                    </div>

                    <DialogFooter className="flex-col space-y-2 sm:space-y-0 sm:flex-row">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddClassDialogOpen(false)}
                        className="w-full sm:w-auto text-xs sm:text-sm"
                        size="sm"
                      >
                        Отказ
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full text-white sm:w-auto text-xs sm:text-sm"
                        size="sm"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
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
            <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
              <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 mb-4 sm:mb-6">
                <div className="relative w-full sm:flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Търсене по име на клас..."
                    className="pl-9 text-sm"
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

                <div className="flex-none">
                  <Select
                    value={educationLevelFilter}
                    onValueChange={setEducationLevelFilter}
                  >
                    <SelectTrigger className="w-full sm:w-[180px] text-xs sm:text-sm h-9 sm:h-10">
                      <SelectValue placeholder="Филтър по ниво" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs sm:text-sm">
                        Всички нива
                      </SelectItem>
                      <SelectItem
                        value="primary"
                        className="text-xs sm:text-sm"
                      >
                        Начален етап
                      </SelectItem>
                      <SelectItem value="middle" className="text-xs sm:text-sm">
                        Прогимназиален етап
                      </SelectItem>
                      <SelectItem value="high" className="text-xs sm:text-sm">
                        Гимназиален етап
                      </SelectItem>
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
                  <div className="overflow-x-auto -mx-3 sm:mx-0">
                    <div className="inline-block min-w-full align-middle">
                      <div className="rounded-md border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[50px]">#</TableHead>
                              <TableHead>Клас</TableHead>
                              <TableHead className="hidden xs:table-cell">
                                Образователно ниво
                              </TableHead>
                              <TableHead className="hidden sm:table-cell">
                                Класен ръководител
                              </TableHead>
                              <TableHead className="hidden md:table-cell">
                                Брой ученици
                              </TableHead>
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
                                  className="text-center py-8 sm:py-10 text-gray-500 text-sm"
                                >
                                  Няма намерени класове
                                </TableCell>
                              </TableRow>
                            ) : (
                              getCurrentPageClasses().map(
                                (classData, index) => (
                                  <TableRow key={classData.classId}>
                                    <TableCell className="font-medium text-xs sm:text-sm">
                                      {(currentPage - 1) * rowsPerPage +
                                        index +
                                        1}
                                    </TableCell>
                                    <TableCell className="font-medium text-xs sm:text-sm">
                                      <div>{classData.className || ""}</div>
                                      <div className="text-xs text-gray-500 xs:hidden">
                                        {classData.namingFormat === "custom" &&
                                        !classData.gradeNumber
                                          ? "N/A"
                                          : classData.gradeNumber <= 4
                                          ? "Начален"
                                          : classData.gradeNumber <= 7
                                          ? "Прогимназиален"
                                          : "Гимназиален"}
                                      </div>
                                      <div className="text-xs text-gray-500 sm:hidden xs:block">
                                        {classData.teacherSubjectPairs?.find(
                                          (pair) => pair.isHomeroom
                                        )?.teacherId
                                          ? getTeacherNameById(
                                              classData.teacherSubjectPairs.find(
                                                (pair) => pair.isHomeroom
                                              )!.teacherId
                                            )
                                          : "Няма класен"}
                                      </div>
                                    </TableCell>
                                    <TableCell className="hidden xs:table-cell">
                                      <Badge
                                        variant="outline"
                                        className={`${getEducationLevelBadgeStyle(
                                          classData.namingFormat === "custom" &&
                                            !classData.gradeNumber
                                            ? "custom" // Use "custom" if naming format is custom and no grade number
                                            : classData.gradeNumber <= 4
                                            ? "primary" // Primary level for grades 1-4
                                            : classData.gradeNumber <= 7
                                            ? "middle" // Middle school for grades 5-7
                                            : "high" // High school for grades 8-12
                                        )} text-xs`}
                                      >
                                        {/* Display education level text */}
                                        {classData.namingFormat === "custom" &&
                                        !classData.gradeNumber
                                          ? "N/A" // Display N/A for custom classes without grade
                                          : classData.gradeNumber <= 4
                                          ? "Начален" // Primary level text
                                          : classData.gradeNumber <= 7
                                          ? "Прогимназиален" // Middle school text
                                          : "Гимназиален"}{" "}
                                        {/* High school text */}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell text-xs sm:text-sm">
                                      {/* Display homeroom teacher's name or a placeholder */}
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
                                          Не е зададен{" "}
                                          {/* Placeholder if no homeroom teacher */}
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell text-xs sm:text-sm">
                                      {/* Display the number of students in the class */}
                                      {classData.studentIds?.length || 0}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {/* Action buttons for editing and deleting a class */}
                                      <div className="flex justify-end gap-1 sm:gap-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() =>
                                            handleEditClick(classData)
                                          }
                                          className="h-8 w-8 p-0"
                                        >
                                          <Pencil className="h-3 w-3 sm:h-4 sm:w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                          onClick={() =>
                                            handleDeleteClick(classData)
                                          }
                                        >
                                          <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )
                              )
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>

                  {/* Pagination UI */}
                  {filteredClasses.length > 0 && (
                    <div className="flex justify-center mt-4 sm:mt-6">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="h-8 w-8 p-0"
                        >
                          <span>&lt;</span>
                        </Button>

                        {/* Page numbers */}
                        {Array.from(
                          {
                            length: Math.ceil(
                              filteredClasses.length / rowsPerPage
                            ),
                          },
                          (_, i) => (
                            <Button
                              key={i}
                              variant={
                                currentPage === i + 1 ? "default" : "outline"
                              }
                              size="sm"
                              onClick={() => handlePageChange(i + 1)}
                              className={`h-8 w-8 p-0 ${
                                currentPage === i + 1 ? "text-white" : ""
                              }`}
                            >
                              {i + 1}
                            </Button>
                          )
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={
                            currentPage ===
                            Math.ceil(filteredClasses.length / rowsPerPage)
                          }
                          className="h-8 w-8 p-0"
                        >
                          <span>&gt;</span>
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="mt-4 text-xs sm:text-sm text-gray-500">
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
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редактиране на клас</DialogTitle>
            <DialogDescription>
              Променете данните за избрания клас
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditClass} className="space-y-4 my-4">
            <div className="space-y-2">
              <Label className="text-sm">Тип на именуване</Label>
              <RadioGroup
                value={classFormData.namingFormat}
                onValueChange={(value) =>
                  setClassFormData({
                    ...classFormData,
                    namingFormat: value as "graded" | "custom",
                  })
                }
                className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="graded" id="edit-naming-standard" />
                  <Label htmlFor="edit-naming-standard" className="text-sm">
                    Стандартно (1А, 2Б, и т.н.)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custom" id="edit-naming-custom" />
                  <Label htmlFor="edit-naming-custom" className="text-sm">
                    По избор
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {classFormData.namingFormat === "graded" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-gradeNumber" className="text-sm">
                    Клас (цифра)
                  </Label>
                  <Select
                    value={classFormData.gradeNumber.toString()}
                    onValueChange={(value) =>
                      setClassFormData({
                        ...classFormData,
                        gradeNumber: parseInt(value),
                      })
                    }
                  >
                    <SelectTrigger
                      id="edit-gradeNumber"
                      className="text-xs sm:text-sm h-9 sm:h-10"
                    >
                      <SelectValue placeholder="Изберете клас" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((grade) => (
                        <SelectItem
                          key={grade}
                          value={grade.toString()}
                          className="text-xs sm:text-sm"
                        >
                          {grade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-classLetter" className="text-sm">
                    Паралелка (буква)
                  </Label>
                  <Select
                    value={classFormData.classLetter}
                    onValueChange={(value) =>
                      setClassFormData({ ...classFormData, classLetter: value })
                    }
                  >
                    <SelectTrigger
                      id="edit-classLetter"
                      className="text-xs sm:text-sm h-9 sm:h-10"
                    >
                      <SelectValue placeholder="Изберете паралелка" />
                    </SelectTrigger>
                    <SelectContent>
                      {["А", "Б", "В", "Г", "Д", "Е", "Ж", "З", "И"].map(
                        (letter) => (
                          <SelectItem
                            key={letter}
                            value={letter}
                            className="text-xs sm:text-sm"
                          >
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
                <Label htmlFor="edit-custom-name" className="text-sm">
                  Име на класа
                </Label>
                <Input
                  id="edit-custom-name"
                  value={classFormData.className}
                  onChange={(e) =>
                    setClassFormData({
                      ...classFormData,
                      className: e.target.value,
                    })
                  }
                  className="text-xs sm:text-sm h-9 sm:h-10"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-education-level" className="text-sm">
                Образователно ниво
              </Label>
              <Select
                value={classFormData.educationLevel}
                onValueChange={(value) =>
                  setClassFormData({
                    ...classFormData,
                    educationLevel: value as "primary" | "middle" | "high",
                  })
                }
              >
                <SelectTrigger
                  id="edit-education-level"
                  className="text-xs sm:text-sm h-9 sm:h-10"
                >
                  <SelectValue placeholder="Изберете образователно ниво" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary" className="text-xs sm:text-sm">
                    Начален (1-4 клас)
                  </SelectItem>
                  <SelectItem value="middle" className="text-xs sm:text-sm">
                    Прогимназиален (5-7 клас)
                  </SelectItem>
                  <SelectItem value="high" className="text-xs sm:text-sm">
                    Гимназиален (8-12 клас)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Учители и предмети</Label>

              <div className="space-y-3">
                {classFormData.teacherSubjectPairs.map((pair, index) => (
                  <div
                    key={index}
                    className="border p-2 sm:p-3 rounded-lg bg-gray-50"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-2">
                      <div className="space-y-1">
                        <Label
                          htmlFor={`edit-teacher-${index}`}
                          className="text-xs sm:text-sm"
                        >
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
                          {/* Select trigger for teacher selection */}
                          <SelectTrigger
                            id={`edit-teacher-${index}`}
                            className="text-xs sm:text-sm h-8 sm:h-9"
                          >
                            <SelectValue placeholder="Изберете учител" />
                          </SelectTrigger>
                          {/* Select content with filtered or all teachers */}
                          <SelectContent>
                            {(pair.subjectId
                              ? getFilteredTeachersForPair(index) // Filter teachers if a subject is selected
                              : teachers
                            ) // Otherwise, show all teachers
                              .map((teacher) => (
                                <SelectItem
                                  key={teacher.userId}
                                  value={teacher.userId}
                                  className="text-xs sm:text-sm"
                                >
                                  {teacher.firstName} {teacher.lastName}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        {/* Label for subject selection */}
                        <Label
                          htmlFor={`edit-subject-${index}`}
                          className="text-xs sm:text-sm"
                        >
                          Предмет
                        </Label>
                        {/* Select component for subject selection */}
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
                          {/* Select trigger for subject selection */}
                          <SelectTrigger
                            id={`edit-subject-${index}`}
                            className="text-xs sm:text-sm h-8 sm:h-9"
                          >
                            <SelectValue placeholder="Изберете предмет" />
                          </SelectTrigger>
                          {/* Select content with filtered or all subjects */}
                          <SelectContent>
                            {(pair.teacherId
                              ? getFilteredSubjectsForPair(index) // Filter subjects if a teacher is selected
                              : subjects
                            ) // Otherwise, show all subjects
                              .map((subject) => (
                                <SelectItem
                                  key={subject.subjectId}
                                  value={subject.subjectId}
                                  className="text-xs sm:text-sm"
                                >
                                  {subject.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
                      {/* Checkbox for marking a teacher as homeroom teacher */}
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
                          className="h-3 w-3 sm:h-4 sm:w-4"
                        />
                        <Label
                          htmlFor={`edit-homeroom-${index}`}
                          className="cursor-pointer text-xs sm:text-sm"
                        >
                          Класен ръководител
                        </Label>
                      </div>

                      {/* Button to remove a teacher-subject pair (visible if not the first pair) */}
                      {index > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveTeacherSubjectPair(index)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs h-7 sm:h-8"
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
                  className="w-full text-xs sm:text-sm h-8 sm:h-9"
                >
                  + Добави учител и предмет
                </Button>
              </div>
            </div>

            <DialogFooter className="flex-col space-y-2 sm:space-y-0 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditClassDialogOpen(false)}
                className="w-full sm:w-auto text-xs sm:text-sm"
                size="sm"
              >
                Отказ
              </Button>
              <Button
                type="submit"
                className="w-full sm:w-auto text-white text-xs sm:text-sm"
                size="sm"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  // Show loader and "Saving..." text when submitting
                  <>
                    <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                    Запазване...
                  </>
                ) : (
                  // Show "Save" text otherwise
                  "Запази"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Изтриване на клас</DialogTitle>
            <DialogDescription>
              Сигурни ли сте, че искате да изтриете този клас? Това действие не
              може да бъде отменено.
            </DialogDescription>
          </DialogHeader>

          {selectedClass && (
            <div className="py-3 sm:py-4">
              <p className="font-medium text-sm sm:text-base">
                Клас: {selectedClass.className}
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                {selectedClass.educationLevel === "primary"
                  ? "Начален етап"
                  : selectedClass.educationLevel === "middle"
                  ? "Прогимназиален етап"
                  : "Гимназиален етап"}
              </p>

              <div className="mt-3 sm:mt-4 text-xs sm:text-sm">
                <p>
                  {/* Display number of students in the selected class */}
                  <span className="font-medium">Ученици:</span>{" "}
                  {selectedClass.studentIds?.length || 0}
                </p>
              </div>

              {selectedClass.studentIds?.length > 0 && (
                <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-yellow-50 border border-yellow-300 rounded-md text-yellow-700 text-xs sm:text-sm">
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

          <DialogFooter className="flex-col space-y-2 sm:space-y-0 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              className="w-full sm:w-auto text-xs sm:text-sm"
              size="sm"
            >
              Отказ
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteClass}
              disabled={isSubmitting}
              className="w-full sm:w-auto text-xs sm:text-sm"
              size="sm"
            >
              {isSubmitting ? (
                // Show loader and "Deleting..." text when submitting
                <>
                  <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                  Изтриване...
                </>
              ) : (
                // Show "Delete" text otherwise
                "Изтрий"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
