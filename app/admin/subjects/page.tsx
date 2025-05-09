// SubjectManagement Component - Handles creation and management of school subjects
// Allows creating, editing, and deleting subjects, and assigning teachers to subjects
"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/contexts/UserContext";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

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

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import Sidebar from "@/components/functional/layout/Sidebar";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, X, Loader2 } from "lucide-react";

// Data types for subject management
interface SubjectFormData {
  subjectId?: string;
  name: string;
  description?: string;
  teacherIds: string[];
}

interface SubjectData {
  subjectId: string;
  name: string;
  description?: string;
  teacherIds: string[];
  createdAt: Timestamp;
}

interface TeacherData {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface ClassData {
  classId: string;
  className: string;
  gradeNumber: number;
  classLetter: string;
}

export default function SubjectManagement() {
  const { user } = useUser();
  const router = useRouter();

  // State for subjects, filters, and UI controls
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [filteredSubjects, setFilteredSubjects] = useState<SubjectData[]>([]);
  const [teachers, setTeachers] = useState<TeacherData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  /**
   * Get current page of subjects
   */
  const getCurrentPageSubjects = useCallback(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return filteredSubjects.slice(startIndex, endIndex);
  }, [filteredSubjects, currentPage, rowsPerPage]);

  /**
   * Handles page change
   */
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Dialog control states
  const [isAddSubjectDialogOpen, setIsAddSubjectDialogOpen] = useState(false);
  const [isEditSubjectDialogOpen, setIsEditSubjectDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Form data and selected subject
  const [subjectFormData, setSubjectFormData] = useState<SubjectFormData>({
    name: "",
    description: "",
    teacherIds: [],
  });

  const [selectedSubject, setSelectedSubject] = useState<SubjectData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tracks which teachers are assigned to the subject in classes
  const [teacherAssignments, setTeacherAssignments] = useState<
    Record<string, boolean>
  >({});

  /**
   * Fetches all subjects for the current school
   */
  const fetchSubjects = useCallback(async () => {
    if (!user?.schoolId) return;

    setIsLoading(true);
    try {
      const subjectsRef = collection(
        doc(db, "schools", user.schoolId),
        "subjects"
      );
      const snapshot = await getDocs(subjectsRef);

      const fetchedSubjects: SubjectData[] = [];
      snapshot.forEach((doc) => {
        const subjectData = doc.data() as SubjectData;
        fetchedSubjects.push({
          ...subjectData,
          subjectId: doc.id,
        });
      });

      setSubjects(fetchedSubjects);
    } catch (error) {
      console.error("Error fetching subjects:", error);
      toast({
        title: "Грешка",
        description: "Неуспешно зареждане на предметите",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  /**
   * Fetches all teachers for the current school
   */
  const fetchTeachers = useCallback(async () => {
    if (!user?.schoolId) return;

    try {
      const usersRef = collection(doc(db, "schools", user.schoolId), "users");
      const teachersQuery = query(usersRef, where("role", "==", "teacher"));
      const snapshot = await getDocs(teachersQuery);

      const fetchedTeachers: TeacherData[] = [];
      snapshot.forEach((doc) => {
        const teacherData = doc.data() as TeacherData;
        fetchedTeachers.push({
          ...teacherData,
          userId: doc.id,
        });
      });

      setTeachers(fetchedTeachers);
    } catch (error) {
      console.error("Error fetching teachers:", error);
    }
  }, [user]);

  /**
   * Fetches all classes for the current school
   * Used to help with subject-teacher relationship management
   */
  const fetchClasses = useCallback(async () => {
    if (!user?.schoolId) return;

    try {
      const classesRef = collection(
        doc(db, "schools", user.schoolId),
        "classes"
      );
      const snapshot = await getDocs(classesRef);

      const fetchedClasses: ClassData[] = [];
      snapshot.forEach((doc) => {
        const classData = doc.data();
        fetchedClasses.push({
          classId: doc.id,
          className: classData.className || "",
          gradeNumber: classData.gradeNumber || 1,
          classLetter: classData.section || "A",
        });
      });

      // Sort classes by grade level and then by name
      fetchedClasses.sort((a, b) => {
        if (a.gradeNumber !== b.gradeNumber) {
          return a.gradeNumber - b.gradeNumber;
        }
        return a.className.localeCompare(b.className);
      });

      // Removing the setClasses call since the classes state variable was removed
    } catch (error) {
      console.error("Error fetching classes:", error);
    }
  }, [user]);

  /**
   * Checks which teachers are assigned to a specific subject in classes
   * @param subjectId - The ID of the subject to check
   */
  const checkTeacherSubjectAssignments = useCallback(
    async (subjectId: string) => {
      if (!user?.schoolId || !subjectId) return;

      try {
        // Get all classes to check for teacher-subject assignments
        const classesRef = collection(
          doc(db, "schools", user.schoolId),
          "classes"
        );
        const classesSnapshot = await getDocs(classesRef);

        const teacherAssignmentMap: Record<string, boolean> = {};

        // Go through each class to find teacher-subject pairs
        classesSnapshot.forEach((classDoc) => {
          const classData = classDoc.data();

          if (
            classData.teacherSubjectPairs &&
            Array.isArray(classData.teacherSubjectPairs)
          ) {
            classData.teacherSubjectPairs.forEach(
              (pair: { subjectId: string; teacherId?: string }) => {
                // If this pair links a teacher to our subject
                if (pair.subjectId === subjectId && pair.teacherId) {
                  teacherAssignmentMap[pair.teacherId] = true;
                }
              }
            );
          }
        });

        setTeacherAssignments(teacherAssignmentMap);
      } catch (error) {
        console.error("Error checking teacher-subject assignments:", error);
      }
    },
    [user]
  );

  useEffect(() => {
    // Authentication check and initial data loading
    if (user?.role !== "admin") {
      router.push("/login");
    } else {
      fetchSubjects();
      fetchTeachers();
      fetchClasses();
    }
  }, [user, router, fetchSubjects, fetchTeachers, fetchClasses]);
  useEffect(() => {
    // Filter and sort subjects based on search query
    let result = [...subjects];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (subj) =>
          subj.name.toLowerCase().includes(query) ||
          subj.description?.toLowerCase().includes(query)
      );
    }

    // Sort alphabetically by name
    result.sort((a, b) => {
      const nameA = a.name || "";
      const nameB = b.name || "";
      return nameA.localeCompare(nameB);
    });

    setFilteredSubjects(result);
    setCurrentPage(1); // Reset to first page when filters change
  }, [subjects, searchQuery]);

  /**
   * Handles teacher selection/deselection in the form
   * @param teacherId - The ID of the teacher being selected/deselected
   * @param isSelected - Whether the teacher is being selected or deselected
   */
  const handleTeacherSelectionChange = (
    teacherId: string,
    isSelected: boolean
  ) => {
    setSubjectFormData((prev) => {
      if (isSelected) {
        return {
          ...prev,
          teacherIds: [...prev.teacherIds, teacherId],
        };
      } else {
        return {
          ...prev,
          teacherIds: prev.teacherIds.filter((id) => id !== teacherId),
        };
      }
    });
  };

  /**
   * Handles the submission of the subject creation form
   * Validates form data and creates a new subject
   * @param e - Form submission event
   */
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId) return;

    // Validate form data
    if (!subjectFormData.name.trim()) {
      toast({
        title: "Грешка",
        description: "Името на предмета е задължително",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const subjectsRef = collection(
        doc(db, "schools", user.schoolId),
        "subjects"
      );

      // Check if subject with the same name already exists
      const nameCheckQuery = query(
        subjectsRef,
        where("name", "==", subjectFormData.name)
      );
      const nameCheck = await getDocs(nameCheckQuery);

      if (!nameCheck.empty) {
        toast({
          title: "Грешка",
          description: "Предмет с това име вече съществува",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const newSubjectData = {
        name: subjectFormData.name,
        description: subjectFormData.description,
        teacherIds: subjectFormData.teacherIds,
        createdAt: Timestamp.now(),
      };

      const docRef = await addDoc(subjectsRef, newSubjectData);

      // Update teacher documents to add this subject
      for (const teacherId of subjectFormData.teacherIds) {
        const teacherRef = doc(
          db,
          "schools",
          user.schoolId,
          "users",
          teacherId
        );
        const teacherDoc = await getDoc(teacherRef);

        if (teacherDoc.exists()) {
          const teacherData = teacherDoc.data();
          const teachesSubjects = teacherData.teachesSubjects || [];

          if (!teachesSubjects.includes(docRef.id)) {
            await updateDoc(teacherRef, {
              teachesSubjects: [...teachesSubjects, docRef.id],
            });
          }
        }
      }

      toast({
        title: "Успешно",
        description: "Предметът е добавен успешно",
      });

      setSubjectFormData({
        name: "",
        description: "",
        teacherIds: [],
      });

      setIsAddSubjectDialogOpen(false);
      fetchSubjects();
    } catch (error) {
      console.error("Error adding subject:", error);
      toast({
        title: "Грешка",
        description: "Неуспешно добавяне на предмет",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handles the submission of the subject edit form
   * Validates form data and updates the existing subject
   * @param e - Form submission event
   */
  const handleEditSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId || !selectedSubject?.subjectId) return;

    // Validate form data
    if (!subjectFormData.name.trim()) {
      toast({
        title: "Грешка",
        description: "Името на предмета е задължително",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const subjectRef = doc(
        db,
        "schools",
        user.schoolId,
        "subjects",
        selectedSubject.subjectId
      );

      // Check if subject name changed and already exists
      if (subjectFormData.name !== selectedSubject.name) {
        const subjectsRef = collection(
          doc(db, "schools", user.schoolId),
          "subjects"
        );
        const nameCheckQuery = query(
          subjectsRef,
          where("name", "==", subjectFormData.name)
        );
        const nameCheck = await getDocs(nameCheckQuery);

        if (!nameCheck.empty) {
          // Check if the name belongs to another subject
          const conflictingSubject = nameCheck.docs[0];
          if (conflictingSubject.id !== selectedSubject.subjectId) {
            toast({
              title: "Грешка",
              description: "Това име на предмет вече се използва",
              variant: "destructive",
            });
            setIsSubmitting(false);
            return;
          }
        }
      }

      const updateData = {
        name: subjectFormData.name,
        description: subjectFormData.description,
        teacherIds: subjectFormData.teacherIds,
      };

      await updateDoc(subjectRef, updateData);

      // Update teacher documents
      // First, get the list of teachers who used to teach this subject
      const previousTeacherIds = selectedSubject.teacherIds || [];

      // Then, get the list of current teachers
      const currentTeacherIds = subjectFormData.teacherIds;

      // Find teachers to remove (in previous but not in current)
      const teachersToRemove = previousTeacherIds.filter(
        (id) => !currentTeacherIds.includes(id)
      );

      // Find teachers to add (in current but not in previous)
      const teachersToAdd = currentTeacherIds.filter(
        (id) => !previousTeacherIds.includes(id)
      );

      // Update teachers to remove
      for (const teacherId of teachersToRemove) {
        const teacherRef = doc(
          db,
          "schools",
          user.schoolId,
          "users",
          teacherId
        );
        const teacherDoc = await getDoc(teacherRef);

        if (teacherDoc.exists()) {
          const teacherData = teacherDoc.data();
          const teachesSubjects = teacherData.teachesSubjects || [];

          await updateDoc(teacherRef, {
            teachesSubjects: teachesSubjects.filter(
              (subjectId: string) => subjectId !== selectedSubject.subjectId
            ),
          });
        }
      }

      // Update teachers to add
      for (const teacherId of teachersToAdd) {
        const teacherRef = doc(
          db,
          "schools",
          user.schoolId,
          "users",
          teacherId
        );
        const teacherDoc = await getDoc(teacherRef);

        if (teacherDoc.exists()) {
          const teacherData = teacherDoc.data();
          const teachesSubjects = teacherData.teachesSubjects || [];

          if (!teachesSubjects.includes(selectedSubject.subjectId)) {
            await updateDoc(teacherRef, {
              teachesSubjects: [...teachesSubjects, selectedSubject.subjectId],
            });
          }
        }
      }

      toast({
        title: "Успешно",
        description: "Предметът е актуализиран успешно",
      });

      setIsEditSubjectDialogOpen(false);
      fetchSubjects();
    } catch (error) {
      console.error("Error updating subject:", error);
      toast({
        title: "Грешка",
        description: "Неуспешно актуализиране на предмет",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handles the deletion of a subject
   * Checks if subject is in use by any classes before deletion
   */
  const handleDeleteSubject = async () => {
    if (!user?.schoolId || !selectedSubject?.subjectId) return;

    setIsSubmitting(true);
    try {
      // First, update teacher documents to remove this subject
      if (selectedSubject.teacherIds && selectedSubject.teacherIds.length > 0) {
        for (const teacherId of selectedSubject.teacherIds) {
          const teacherRef = doc(
            db,
            "schools",
            user.schoolId,
            "users",
            teacherId
          );
          const teacherDoc = await getDoc(teacherRef);

          if (teacherDoc.exists()) {
            const teacherData = teacherDoc.data();
            const teachesSubjects = teacherData.teachesSubjects || [];

            await updateDoc(teacherRef, {
              teachesSubjects: teachesSubjects.filter(
                (subjectId: string) => subjectId !== selectedSubject.subjectId
              ),
            });
          }
        }
      }

      // Check if the subject is used in any classes
      const classesRef = collection(
        doc(db, "schools", user.schoolId),
        "classes"
      );
      const classesSnapshot = await getDocs(classesRef);
      let isUsedInClass = false;

      classesSnapshot.forEach((docSnapshot) => {
        const classData = docSnapshot.data();
        if (classData.teacherSubjectPairs) {
          const isUsed = classData.teacherSubjectPairs.some(
            (pair: { subjectId: string }) =>
              pair.subjectId === selectedSubject.subjectId
          );
          if (isUsed) {
            isUsedInClass = true;
          }
        }
      });

      if (isUsedInClass) {
        toast({
          title: "Грешка",
          description:
            "Не може да изтриете предмета, защото се използва в един или повече класове",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Finally, delete the subject document
      await deleteDoc(
        doc(db, "schools", user.schoolId, "subjects", selectedSubject.subjectId)
      );

      toast({
        title: "Успешно",
        description: "Предметът е изтрит успешно",
      });

      setIsDeleteDialogOpen(false);
      fetchSubjects();
    } catch (error) {
      console.error("Error deleting subject:", error);
      toast({
        title: "Грешка",
        description: "Неуспешно изтриване на предмет",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Prepares the form for editing an existing subject
   * @param subjectData - The subject to edit
   */
  const handleEditClick = (subjectData: SubjectData) => {
    setSelectedSubject(subjectData);

    setSubjectFormData({
      subjectId: subjectData.subjectId,
      name: subjectData.name || "",
      description: subjectData.description || "",
      teacherIds: subjectData.teacherIds || [],
    });

    // Check which teachers are already teaching this subject in classes
    checkTeacherSubjectAssignments(subjectData.subjectId);

    setIsEditSubjectDialogOpen(true);
  };

  /**
   * Prepares for subject deletion
   * @param subjectData - The subject to delete
   */
  const handleDeleteClick = (subjectData: SubjectData) => {
    setSelectedSubject(subjectData);
    setIsDeleteDialogOpen(true);
  };

  // Protect route - return null if user is not an admin
  if (!user || user.role !== "admin") {
    return null;
  }

  // Main component rendering
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
                Управление на предмети
              </h1>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">
                Създаване и управление на учебни предмети и присъединяване на
                учители
              </p>
            </div>

            <div className="flex gap-2 sm:gap-3">
              <Dialog
                open={isAddSubjectDialogOpen}
                onOpenChange={setIsAddSubjectDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button className="flex text-white items-center gap-2 text-xs sm:text-sm h-9 sm:h-10">
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span>Създай предмет</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Създаване на нов предмет</DialogTitle>
                    <DialogDescription>
                      Попълнете необходимата информация за създаване на нов
                      учебен предмет
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleAddSubject} className="space-y-4 my-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm">
                        Име на предмета *
                      </Label>
                      <Input
                        id="name"
                        value={subjectFormData.name}
                        onChange={(e) =>
                          setSubjectFormData({
                            ...subjectFormData,
                            name: e.target.value,
                          })
                        }
                        className="text-xs sm:text-sm h-9 sm:h-10"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description" className="text-sm">
                        Описание (по желание)
                      </Label>
                      <Textarea
                        id="description"
                        value={subjectFormData.description}
                        onChange={(e) =>
                          setSubjectFormData({
                            ...subjectFormData,
                            description: e.target.value,
                          })
                        }
                        className="text-xs sm:text-sm"
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">
                        Учители, които преподават този предмет (по желание)
                      </Label>
                      <Card>
                        <CardContent className="pt-4">
                          {teachers.length === 0 ? (
                            <div className="text-center text-gray-500 py-4 text-xs sm:text-sm">
                              Няма налични учители
                            </div>
                          ) : (
                            <ScrollArea className="h-36 sm:h-48">
                              <div className="space-y-2">
                                {teachers.map((teacher) => (
                                  <div
                                    key={teacher.userId}
                                    className="flex items-center space-x-2"
                                  >
                                    <Checkbox
                                      id={`teacher-${teacher.userId}`}
                                      checked={subjectFormData.teacherIds.includes(
                                        teacher.userId
                                      )}
                                      onCheckedChange={(checked) =>
                                        handleTeacherSelectionChange(
                                          teacher.userId,
                                          checked === true
                                        )
                                      }
                                      className="h-3 w-3 sm:h-4 sm:w-4"
                                    />
                                    <Label
                                      htmlFor={`teacher-${teacher.userId}`}
                                      className="cursor-pointer text-xs sm:text-sm"
                                    >
                                      {teacher.firstName} {teacher.lastName}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <DialogFooter className="flex-col space-y-2 sm:space-y-0 sm:flex-row">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddSubjectDialogOpen(false)}
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
                          <>
                            <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                            Създаване...
                          </>
                        ) : (
                          "Създай предмет"
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
                    placeholder="Търсене по име или описание на предмет..."
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
              </div>

              {isLoading ? (
                <div className="text-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                  <p className="mt-2 text-gray-500">Зареждане на предмети...</p>
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
                              <TableHead>Предмет</TableHead>
                              <TableHead className="hidden md:table-cell">
                                Описание
                              </TableHead>
                              <TableHead className="hidden sm:table-cell">
                                Брой учители
                              </TableHead>
                              <TableHead className="w-[80px] sm:w-[100px] text-right">
                                Действия
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {getCurrentPageSubjects().length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={5}
                                  className="text-center py-8 sm:py-10 text-gray-500 text-sm"
                                >
                                  Няма намерени предмети
                                </TableCell>
                              </TableRow>
                            ) : (
                              getCurrentPageSubjects().map(
                                (subjectData, index) => (
                                  <TableRow key={subjectData.subjectId}>
                                    <TableCell className="font-medium text-xs sm:text-sm">
                                      {index +
                                        1 +
                                        (currentPage - 1) * rowsPerPage}
                                    </TableCell>
                                    <TableCell className="font-medium text-xs sm:text-sm">
                                      <div>{subjectData.name || "Без име"}</div>
                                      <div className="text-xs text-gray-500 sm:hidden truncate">
                                        {subjectData.description || "-"}
                                      </div>
                                      <div className="text-xs text-gray-500 sm:hidden">
                                        Учители:{" "}
                                        {subjectData.teacherIds?.length || 0}
                                      </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell max-w-[200px] truncate text-xs sm:text-sm">
                                      {subjectData.description || "-"}
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell text-xs sm:text-sm">
                                      {subjectData.teacherIds?.length || 0}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex justify-end gap-1 sm:gap-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() =>
                                            handleEditClick(subjectData)
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
                                            handleDeleteClick(subjectData)
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

                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-xs sm:text-sm text-gray-500">
                      Показани {getCurrentPageSubjects().length} от{" "}
                      {filteredSubjects.length} предмети
                    </div>
                    {filteredSubjects.length > rowsPerPage && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="h-8 w-8 p-0"
                        >
                          &lt;
                        </Button>
                        {Array.from({
                          length: Math.ceil(
                            filteredSubjects.length / rowsPerPage
                          ),
                        })
                          .map((_, i) => (
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
                          ))
                          .slice(
                            Math.max(0, currentPage - 3),
                            Math.min(
                              Math.ceil(filteredSubjects.length / rowsPerPage),
                              currentPage + 2
                            )
                          )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={
                            currentPage ===
                            Math.ceil(filteredSubjects.length / rowsPerPage)
                          }
                          className="h-8 w-8 p-0"
                        >
                          &gt;
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Subject Dialog */}
      <Dialog
        open={isEditSubjectDialogOpen}
        onOpenChange={setIsEditSubjectDialogOpen}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редактиране на предмет</DialogTitle>
            <DialogDescription>
              Променете данните за избрания предмет
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubject} className="space-y-4 my-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-sm">
                Име на предмета *
              </Label>
              <Input
                id="edit-name"
                value={subjectFormData.name}
                onChange={(e) =>
                  setSubjectFormData({
                    ...subjectFormData,
                    name: e.target.value,
                  })
                }
                className="text-xs sm:text-sm h-9 sm:h-10"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description" className="text-sm">
                Описание (по желание)
              </Label>
              <Textarea
                id="edit-description"
                value={subjectFormData.description}
                onChange={(e) =>
                  setSubjectFormData({
                    ...subjectFormData,
                    description: e.target.value,
                  })
                }
                className="text-xs sm:text-sm"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">
                Учители, които преподават този предмет (по желание)
              </Label>
              <Card>
                <CardContent className="pt-4">
                  {teachers.length === 0 ? (
                    <div className="text-center text-gray-500 py-4 text-xs sm:text-sm">
                      Няма налични учители
                    </div>
                  ) : (
                    <ScrollArea className="h-36 sm:h-48">
                      <div className="space-y-2">
                        {teachers.map((teacher) => {
                          const isAssignedInClass =
                            teacherAssignments[teacher.userId];

                          return (
                            <div
                              key={teacher.userId}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={`edit-teacher-${teacher.userId}`}
                                checked={subjectFormData.teacherIds.includes(
                                  teacher.userId
                                )}
                                onCheckedChange={(checked) =>
                                  handleTeacherSelectionChange(
                                    teacher.userId,
                                    checked === true
                                  )
                                }
                                className="h-3 w-3 sm:h-4 sm:w-4"
                              />
                              <Label
                                htmlFor={`edit-teacher-${teacher.userId}`}
                                className="cursor-pointer text-xs sm:text-sm flex items-center"
                              >
                                <span>
                                  {teacher.firstName} {teacher.lastName}
                                </span>
                                {isAssignedInClass && (
                                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                    Преподава
                                  </span>
                                )}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>

            <DialogFooter className="flex-col space-y-2 sm:space-y-0 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditSubjectDialogOpen(false)}
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
                  <>
                    <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
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

      {/* Delete Subject Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Изтриване на предмет</DialogTitle>
            <DialogDescription>
              Сигурни ли сте, че искате да изтриете този предмет? Това действие
              не може да бъде отменено.
            </DialogDescription>
          </DialogHeader>

          {selectedSubject && (
            <div className="py-3 sm:py-4">
              <p className="font-medium text-sm sm:text-base">
                Предмет: {selectedSubject.name}
              </p>
              {selectedSubject.description && (
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  {selectedSubject.description}
                </p>
              )}

              <div className="mt-3 sm:mt-4 text-xs sm:text-sm">
                <p>
                  <span className="font-medium">Учители:</span>{" "}
                  {selectedSubject.teacherIds?.length || 0}
                </p>
              </div>
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
              onClick={handleDeleteSubject}
              disabled={isSubmitting}
              className="w-full sm:w-auto text-xs sm:text-sm"
              size="sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
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
