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
import Sidebar from "@/components/functional/Sidebar";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, X, Loader2 } from "lucide-react";

interface SubjectFormData {
  subjectId?: string;
  name: string;
  description?: string;
  teacherIds: string[];
  classIds: string[]; // Changed from gradeLevel to classIds for specific class assignment
}

interface SubjectData {
  subjectId: string;
  name: string;
  description?: string;
  teacherIds: string[];
  classIds: string[]; // Changed from gradeLevel to classIds
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
  name: string;
  gradeLevel: number;
  section: string;
}

export default function SubjectManagement() {
  const { user } = useUser();
  const router = useRouter();

  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [filteredSubjects, setFilteredSubjects] = useState<SubjectData[]>([]);
  const [teachers, setTeachers] = useState<TeacherData[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [isAddSubjectDialogOpen, setIsAddSubjectDialogOpen] = useState(false);
  const [isEditSubjectDialogOpen, setIsEditSubjectDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [subjectFormData, setSubjectFormData] = useState<SubjectFormData>({
    name: "",
    description: "",
    teacherIds: [],
    classIds: [],
  });

  const [selectedSubject, setSelectedSubject] = useState<SubjectData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        title: "Error",
        description: "Failed to load subjects",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user]);

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
          name: classData.name || "",
          gradeLevel: classData.gradeLevel || 1,
          section: classData.section || "A",
        });
      });

      // Sort classes by grade level and then by name
      fetchedClasses.sort((a, b) => {
        if (a.gradeLevel !== b.gradeLevel) {
          return a.gradeLevel - b.gradeLevel;
        }
        return a.name.localeCompare(b.name);
      });

      setClasses(fetchedClasses);
    } catch (error) {
      console.error("Error fetching classes:", error);
    }
  }, [user]);

  useEffect(() => {
    if (user?.role !== "admin") {
      router.push("/login");
    } else {
      fetchSubjects();
      fetchTeachers();
      fetchClasses(); // Added classes fetch
    }
  }, [user, router, fetchSubjects, fetchTeachers, fetchClasses]);

  useEffect(() => {
    // Apply filters to subjects
    let result = [...subjects];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (subj) =>
          subj.name.toLowerCase().includes(query) ||
          subj.description?.toLowerCase().includes(query)
      );
    }

    // Remove education level filter since we no longer have this property

    // Sort alphabetically by name
    result.sort((a, b) => {
      const nameA = a.name || "";
      const nameB = b.name || "";
      return nameA.localeCompare(nameB);
    });

    setFilteredSubjects(result);
  }, [subjects, searchQuery]);

  const handleTeacherSelectionChange = (
    teacherId: string,
    isSelected: boolean
  ) => {
    setSubjectFormData((prev) => {
      if (isSelected) {
        return { ...prev, teacherIds: [...prev.teacherIds, teacherId] };
      } else {
        return {
          ...prev,
          teacherIds: prev.teacherIds.filter((id) => id !== teacherId),
        };
      }
    });
  };

  const handleClassSelectionChange = (classId: string, isSelected: boolean) => {
    setSubjectFormData((prev) => {
      if (isSelected) {
        return { ...prev, classIds: [...prev.classIds, classId] };
      } else {
        return {
          ...prev,
          classIds: prev.classIds.filter((id) => id !== classId),
        };
      }
    });
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId) return;

    // Validate form data
    if (!subjectFormData.name.trim()) {
      toast({
        title: "Error",
        description: "Subject name is required",
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
          title: "Error",
          description: "A subject with this name already exists",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const newSubjectData = {
        name: subjectFormData.name,
        description: subjectFormData.description,
        teacherIds: subjectFormData.teacherIds,
        classIds: subjectFormData.classIds,
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
        title: "Success",
        description: "Subject created successfully",
      });

      setSubjectFormData({
        name: "",
        description: "",
        teacherIds: [],
        classIds: [],
      });

      setIsAddSubjectDialogOpen(false);
      fetchSubjects();
    } catch (error) {
      console.error("Error adding subject:", error);
      toast({
        title: "Error",
        description: "Failed to create subject",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId || !selectedSubject?.subjectId) return;

    // Validate form data
    if (!subjectFormData.name.trim()) {
      toast({
        title: "Error",
        description: "Subject name is required",
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
              title: "Error",
              description: "This subject name is already in use",
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
        classIds: subjectFormData.classIds,
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
        title: "Success",
        description: "Subject updated successfully",
      });

      setIsEditSubjectDialogOpen(false);
      fetchSubjects();
    } catch (error) {
      console.error("Error updating subject:", error);
      toast({
        title: "Error",
        description: "Failed to update subject",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
          title: "Error",
          description:
            "Cannot delete subject because it is used in one or more classes",
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
        title: "Success",
        description: "Subject deleted successfully",
      });

      setIsDeleteDialogOpen(false);
      fetchSubjects();
    } catch (error) {
      console.error("Error deleting subject:", error);
      toast({
        title: "Error",
        description: "Failed to delete subject",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (subjectData: SubjectData) => {
    setSelectedSubject(subjectData);

    // Ensure teacherIds is always an array
    const safeTeacherIds = subjectData.teacherIds || [];

    setSubjectFormData({
      subjectId: subjectData.subjectId,
      name: subjectData.name || "",
      description: subjectData.description || "",
      teacherIds: safeTeacherIds,
      classIds: subjectData.classIds || [],
    });

    setIsEditSubjectDialogOpen(true);
  };

  const handleDeleteClick = (subjectData: SubjectData) => {
    setSelectedSubject(subjectData);
    setIsDeleteDialogOpen(true);
  };

  const getClassesText = (classIds: string[]) => {
    if (!classIds || classIds.length === 0) {
      return "Не са избрани класове";
    }

    // Get class names instead of just showing number of classes
    return classIds
      .map((classId) => {
        const classItem = classes.find((c) => c.classId === classId);
        return classItem ? classItem.name : "";
      })
      .filter(Boolean)
      .join(", ");
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
                Управление на предмети
              </h1>
              <p className="text-gray-600 mt-1">
                Създаване и управление на учебни предмети и присъединяване на
                учители
              </p>
            </div>

            <div className="flex gap-3">
              <Dialog
                open={isAddSubjectDialogOpen}
                onOpenChange={setIsAddSubjectDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    <span>Създай предмет</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Създаване на нов предмет</DialogTitle>
                    <DialogDescription>
                      Попълнете необходимата информация за създаване на нов
                      учебен предмет
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleAddSubject} className="space-y-4 my-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Име на предмета *</Label>
                      <Input
                        id="name"
                        value={subjectFormData.name}
                        onChange={(e) =>
                          setSubjectFormData({
                            ...subjectFormData,
                            name: e.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Описание (по желание)</Label>
                      <Textarea
                        id="description"
                        value={subjectFormData.description}
                        onChange={(e) =>
                          setSubjectFormData({
                            ...subjectFormData,
                            description: e.target.value,
                          })
                        }
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>
                        Учители, които преподават този предмет (по желание)
                      </Label>
                      <Card>
                        <CardContent className="pt-4">
                          {teachers.length === 0 ? (
                            <div className="text-center text-gray-500 py-4">
                              Няма налични учители
                            </div>
                          ) : (
                            <ScrollArea className="h-48">
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
                                    />
                                    <Label
                                      htmlFor={`teacher-${teacher.userId}`}
                                      className="cursor-pointer"
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

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddSubjectDialogOpen(false)}
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
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Търсене по име или описание на предмет..."
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
              </div>

              {isLoading ? (
                <div className="text-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                  <p className="mt-2 text-gray-500">Зареждане на предмети...</p>
                </div>
              ) : (
                <>
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">#</TableHead>
                          <TableHead>Предмет</TableHead>
                          <TableHead>Описание</TableHead>
                          <TableHead>Класове</TableHead>
                          <TableHead>Брой учители</TableHead>
                          <TableHead className="w-[100px] text-right">
                            Действия
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSubjects.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="text-center py-10 text-gray-500"
                            >
                              Няма намерени предмети
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredSubjects.map((subjectData, index) => (
                            <TableRow key={subjectData.subjectId}>
                              <TableCell className="font-medium">
                                {index + 1}
                              </TableCell>
                              <TableCell className="font-medium">
                                {subjectData.name || "Без име"}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {subjectData.description || "-"}
                              </TableCell>
                              <TableCell>
                                {getClassesText(subjectData.classIds || [])}
                              </TableCell>
                              <TableCell>
                                {subjectData.teacherIds?.length || 0}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditClick(subjectData)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                    onClick={() =>
                                      handleDeleteClick(subjectData)
                                    }
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
                    Показани {filteredSubjects.length} от {subjects.length}{" "}
                    предмети
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редактиране на предмет</DialogTitle>
            <DialogDescription>
              Променете данните за избрания предмет
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubject} className="space-y-4 my-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Име на предмета *</Label>
              <Input
                id="edit-name"
                value={subjectFormData.name}
                onChange={(e) =>
                  setSubjectFormData({
                    ...subjectFormData,
                    name: e.target.value,
                  })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Описание (по желание)</Label>
              <Textarea
                id="edit-description"
                value={subjectFormData.description}
                onChange={(e) =>
                  setSubjectFormData({
                    ...subjectFormData,
                    description: e.target.value,
                  })
                }
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Учители, които преподават този предмет (по желание)</Label>
              <Card>
                <CardContent className="pt-4">
                  {teachers.length === 0 ? (
                    <div className="text-center text-gray-500 py-4">
                      Няма налични учители
                    </div>
                  ) : (
                    <ScrollArea className="h-48">
                      <div className="space-y-2">
                        {teachers.map((teacher) => (
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
                            />
                            <Label
                              htmlFor={`edit-teacher-${teacher.userId}`}
                              className="cursor-pointer"
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditSubjectDialogOpen(false)}
              >
                Отказ
              </Button>
              <Button type="submit" disabled={isSubmitting}>
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

      {/* Delete Subject Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Изтриване на предмет</DialogTitle>
            <DialogDescription>
              Сигурни ли сте, че искате да изтриете този предмет? Това действие
              не може да бъде отменено.
            </DialogDescription>
          </DialogHeader>

          {selectedSubject && (
            <div className="py-4">
              <p className="font-medium">Предмет: {selectedSubject.name}</p>
              {selectedSubject.description && (
                <p className="text-sm text-gray-500 mt-1">
                  {selectedSubject.description}
                </p>
              )}

              <div className="mt-4 text-sm">
                <p className="mt-1">
                  <span className="font-medium">Учители:</span>{" "}
                  {selectedSubject.teacherIds?.length || 0}
                </p>
              </div>
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
              onClick={handleDeleteSubject}
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
