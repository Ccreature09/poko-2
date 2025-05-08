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
    // ...existing code...
  );
}
