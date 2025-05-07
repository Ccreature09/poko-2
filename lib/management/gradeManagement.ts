/**
 * Grade management utilities
 *
 * This file contains functions for:
 * - Adding, updating, and deleting grades
 * - Creating notifications for students and their parents
 * - Helper functions for teacher grade management
 */

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Grade, GradeType, Subject } from "@/lib/interfaces";
import {
  createNotification,
  createNotificationBulk,
  NotificationType,
  generateNotificationLink,
} from "@/lib/management/notificationManagement";
import { toast } from "@/hooks/use-toast";

// Grade-related interfaces
export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  classId?: string;
  homeroomClassId?: string; // Add homeroomClassId as an alternative field
  class?: string;
}

export interface SubjectData {
  id: string;
  name: string;
}

export interface ClassData {
  id: string;
  name: string;
  grade: string;
  studentIds: string[]; // Add the studentIds array property
}

// Filter options for grades
export interface GradeFilters {
  searchTerm: string;
  student: string;
  subject: string;
  gradeType: GradeType | "" | "all_grade_types";
  dateFrom: string;
  dateTo: string;
  valueFrom: string;
  valueTo: string;
}

// Grade type definitions
export const gradeTypes: { value: GradeType; label: string }[] = [
  { value: "exam", label: "Изпит" },
  { value: "test", label: "Тест" },
  { value: "homework", label: "Домашна работа" },
  { value: "participation", label: "Участие" },
  { value: "project", label: "Проект" },
  { value: "other", label: "Друго" },
];

export const gradeOptions = [
  { value: "2", label: "Слаб (2)" },
  { value: "3", label: "Среден (3)" },
  { value: "4", label: "Добър (4)" },
  { value: "5", label: "Много добър (5)" },
  { value: "6", label: "Отличен (6)" },
];

// Helper functions for grade management UI
export const getGradeColor = (grade: number) => {
  if (grade >= 5.5) return "text-emerald-600 font-semibold";
  if (grade >= 4.5) return "text-blue-600 font-semibold";
  if (grade >= 3.5) return "text-yellow-600";
  if (grade >= 3) return "text-orange-600";
  return "text-red-600";
};

// Stats calculation type
export interface GradeStatistics {
  total: number;
  average: number;
  byType: Array<{
    value: GradeType;
    label: string;
    count: number;
  }>;
  distribution: {
    excellent: number;
    veryGood: number;
    good: number;
    average: number;
    poor: number;
  };
  distributionPercentages: {
    excellent: number;
    veryGood: number;
    good: number;
    average: number;
    poor: number;
  };
}

// Grade functionality for teacher UI
export const fetchTeacherData = async (
  schoolId: string,
  userId: string
): Promise<{
  students: Student[];
  subjects: SubjectData[];
  classes: ClassData[];
  grades: Grade[];
}> => {
  try {
    // Fetch students data
    const studentsRef = collection(db, "schools", schoolId, "users");
    const studentsQuery = query(studentsRef, where("role", "==", "student"));
    const studentsSnapshot = await getDocs(studentsQuery);
    const students = studentsSnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as Student)
    );

    // Fetch subjects data
    const subjectsRef = collection(db, "schools", schoolId, "subjects");
    const subjectsSnapshot = await getDocs(subjectsRef);
    const subjects = subjectsSnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as SubjectData)
    );

    // Fetch classes data
    const classesRef = collection(db, "schools", schoolId, "classes");
    const classesSnapshot = await getDocs(classesRef);
    const classes = classesSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.className || "Unknown Class", // Map className to name
        grade: data.gradeNumber
          ? `${data.gradeNumber}${data.classLetter || ""}`
          : "Unknown Grade",
        studentIds: data.studentIds || [], // Include studentIds
      } as ClassData;
    });

    // Fetch grades data
    const gradesRef = collection(db, "schools", schoolId, "grades");
    const gradesQuery = query(gradesRef, where("teacherId", "==", userId));
    const gradesSnapshot = await getDocs(gradesQuery);
    const grades = gradesSnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as Grade)
    );

    return { students, subjects, classes, grades };
  } catch (error) {
    console.error("Error fetching teacher data:", error);
    throw error;
  }
};

// Filter grades based on criteria
export const filterGrades = (
  grades: Grade[],
  students: Student[],
  subjects: SubjectData[],
  filters: GradeFilters
): Grade[] => {
  let result = [...grades];

  // Apply search term filter
  if (filters.searchTerm) {
    const searchLower = filters.searchTerm.toLowerCase();
    result = result.filter((grade) => {
      const student = students.find((s) => s.id === grade.studentId);
      const subject = subjects.find((s) => s.id === grade.subjectId);
      return (
        student?.firstName?.toLowerCase().includes(searchLower) ||
        student?.lastName?.toLowerCase().includes(searchLower) ||
        subject?.name?.toLowerCase().includes(searchLower) ||
        grade.title.toLowerCase().includes(searchLower) ||
        (grade.description &&
          grade.description.toLowerCase().includes(searchLower))
      );
    });
  }

  // Apply student filter (now using all_students placeholder instead of empty string)
  if (filters.student && filters.student !== "all_students") {
    result = result.filter((grade) => grade.studentId === filters.student);
  }

  // Apply subject filter (now using all_subjects placeholder instead of empty string)
  if (filters.subject && filters.subject !== "all_subjects") {
    result = result.filter((grade) => grade.subjectId === filters.subject);
  }

  // Apply grade type filter (now using all_grade_types placeholder instead of empty string)
  if (filters.gradeType && filters.gradeType !== "all_grade_types") {
    result = result.filter((grade) => grade.type === filters.gradeType);
  }

  // Apply date range filters
  if (filters.dateFrom) {
    const fromDate = new Date(filters.dateFrom).getTime();
    result = result.filter((grade) => grade.date.seconds * 1000 >= fromDate);
  }

  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo).getTime() + 24 * 60 * 60 * 1000; // End of day
    result = result.filter((grade) => grade.date.seconds * 1000 <= toDate);
  }

  // Apply grade value range filters (now using no_min and no_max placeholders)
  if (filters.valueFrom && filters.valueFrom !== "no_min") {
    const minValue = parseFloat(filters.valueFrom);
    result = result.filter((grade) => grade.value >= minValue);
  }

  if (filters.valueTo && filters.valueTo !== "no_max") {
    const maxValue = parseFloat(filters.valueTo);
    result = result.filter((grade) => grade.value <= maxValue);
  }

  // Sort by date (newest first) and then by student name
  return result.sort((a, b) => {
    const dateCompare = b.date.seconds - a.date.seconds;
    if (dateCompare !== 0) return dateCompare;

    const studentA = students.find((s) => s.id === a.studentId);
    const studentB = students.find((s) => s.id === b.studentId);
    return (studentA?.lastName ?? "").localeCompare(studentB?.lastName ?? "");
  });
};

// Calculate statistics for grades
export const calculateGradeStatistics = (
  grades: Grade[]
): GradeStatistics | null => {
  if (grades.length === 0) return null;

  // Calculate average grade
  const sum = grades.reduce((acc, grade) => acc + grade.value, 0);
  const average = sum / grades.length;

  // Count grades by type
  const byType = gradeTypes.map((type) => ({
    ...type,
    count: grades.filter((g) => g.type === type.value).length,
  }));

  // Count grades by value range
  const distribution = {
    excellent: grades.filter((g) => g.value >= 5.5).length,
    veryGood: grades.filter((g) => g.value >= 4.5 && g.value < 5.5).length,
    good: grades.filter((g) => g.value >= 3.5 && g.value < 4.5).length,
    average: grades.filter((g) => g.value >= 3 && g.value < 3.5).length,
    poor: grades.filter((g) => g.value < 3).length,
  };

  // Calculate percentages for grade distribution
  const total = grades.length;
  const distributionPercentages = {
    excellent: (distribution.excellent / total) * 100,
    veryGood: (distribution.veryGood / total) * 100,
    good: (distribution.good / total) * 100,
    average: (distribution.average / total) * 100,
    poor: (distribution.poor / total) * 100,
  };

  return {
    total,
    average,
    byType,
    distribution,
    distributionPercentages,
  };
};

// Enhanced grade handling functions with better error handling and UI integration
export const handleAddGradeWithUI = async (
  schoolId: string,
  studentId: string,
  subjectId: string,
  teacherId: string,
  data: {
    value: number;
    title: string;
    description?: string;
    type: GradeType;
    date: Date;
  }
): Promise<Grade | null> => {
  try {
    if (data.value < 2 || data.value > 6) {
      toast({
        title: "Невалидна оценка",
        description:
          "Оценката трябва да бъде между 2 и 6 според българската система за оценяване.",
        variant: "destructive",
      });
      return null;
    }

    const newGrade = await addGrade(
      schoolId,
      studentId,
      subjectId,
      teacherId,
      data
    );

    toast({
      title: "Оценката е добавена успешно",
      description: `Оценка ${data.value.toFixed(2)} е добавена за ученика.`,
    });

    return newGrade;
  } catch (error) {
    console.error("Error adding grade:", error);
    toast({
      title: "Грешка при добавяне на оценка",
      description: "Моля, опитайте отново.",
      variant: "destructive",
    });
    return null;
  }
};

// Batch add grades
export const handleBatchAddGradesWithUI = async (
  schoolId: string,
  studentIds: string[],
  subjectId: string,
  teacherId: string,
  data: {
    value: number;
    title: string;
    description?: string;
    type: GradeType;
    date: Date;
  }
): Promise<Grade[]> => {
  const newGrades: Grade[] = [];

  try {
    if (data.value < 2 || data.value > 6) {
      toast({
        title: "Невалидна оценка",
        description:
          "Оценката трябва да бъде между 2 и 6 според българската система за оценяване.",
        variant: "destructive",
      });
      return [];
    }

    for (const studentId of studentIds) {
      const newGrade = await addGrade(
        schoolId,
        studentId,
        subjectId,
        teacherId,
        data
      );

      if (newGrade) {
        newGrades.push(newGrade);
      }
    }

    if (newGrades.length > 0) {
      toast({
        title: "Оценките са добавени успешно",
        description: `${newGrades.length} оценки са добавени за избраните ученици.`,
      });
    }

    return newGrades;
  } catch (error) {
    console.error("Error adding batch grades:", error);
    toast({
      title: "Грешка при добавяне на оценки",
      description: "Моля, опитайте отново.",
      variant: "destructive",
    });
    return newGrades; // Return any successfully added grades
  }
};

// Update grade with UI integration
export const handleUpdateGradeWithUI = async (
  schoolId: string,
  gradeId: string,
  updates: Partial<{
    value: number;
    title: string;
    description: string;
    type: GradeType;
    date: Date;
  }>
): Promise<boolean> => {
  try {
    if (
      updates.value !== undefined &&
      (updates.value < 2 || updates.value > 6)
    ) {
      toast({
        title: "Невалидна оценка",
        description:
          "Оценката трябва да бъде между 2 и 6 според българската система за оценяване.",
        variant: "destructive",
      });
      return false;
    }

    await updateGrade(schoolId, gradeId, updates);

    toast({
      title: "Оценката е обновена успешно",
      description: "Всички промени са запазени.",
    });

    return true;
  } catch (error) {
    console.error("Error updating grade:", error);
    toast({
      title: "Грешка при обновяване на оценката",
      description: "Моля, опитайте отново.",
      variant: "destructive",
    });
    return false;
  }
};

// Delete grade with UI integration
export const handleDeleteGradeWithUI = async (
  schoolId: string,
  gradeId: string
): Promise<boolean> => {
  try {
    await deleteGrade(schoolId, gradeId);

    toast({
      title: "Оценката е изтрита успешно",
      description: "Оценката беше премахната от системата.",
    });

    return true;
  } catch (error) {
    console.error("Error deleting grade:", error);
    toast({
      title: "Грешка при изтриване на оценката",
      description: "Моля, опитайте отново.",
      variant: "destructive",
    });
    return false;
  }
};

/**
 * Add a new grade for a student
 */
export const addGrade = async (
  schoolId: string,
  studentId: string,
  subjectId: string,
  teacherId: string,
  data: {
    value: number;
    title: string;
    description?: string;
    type: GradeType;
    date: Date;
  }
): Promise<Grade> => {
  try {
    // Validate grade value (Bulgarian grading system: 2-6)
    if (data.value < 2 || data.value > 6) {
      throw new Error("Grade value must be between 2 and 6");
    }

    // Create grade object
    const gradeData: Omit<Grade, "id"> = {
      studentId,
      subjectId,
      teacherId,
      value: data.value,
      title: data.title,
      description: data.description,
      type: data.type,
      date: Timestamp.fromDate(data.date),
      createdAt: Timestamp.now(),
    };

    // Add grade to database
    const gradesCollection = collection(db, "schools", schoolId, "grades");
    const docRef = await addDoc(gradesCollection, gradeData);
    const gradeId = docRef.id;

    // Update the document with its ID
    await updateDoc(docRef, { id: gradeId });

    // Get subject name for notification
    const subjectDoc = await getDoc(
      doc(db, "schools", schoolId, "subjects", subjectId)
    );
    const subjectName = subjectDoc.exists()
      ? (subjectDoc.data() as Subject).name
      : "Unknown subject";

    // Create notification for student
    await createNotification(schoolId, {
      userId: studentId,
      title: "Нова оценка",
      message: `Имате нова оценка ${data.value} по ${subjectName}: ${data.title}`,
      type: "new-grade",
      relatedId: gradeId,
      link: await generateNotificationLink("new-grade", gradeId),
    });

    // Create notification for student's parents
    await notifyParents(schoolId, studentId, {
      title: "Нова оценка",
      message: `Вашето дете получи нова оценка ${data.value} по ${subjectName}: ${data.title}`,
      type: "new-grade",
      relatedId: gradeId,
      link: await generateNotificationLink("new-grade", gradeId),
    });

    return {
      ...gradeData,
      id: gradeId,
    } as Grade;
  } catch (error) {
    console.error("Error adding grade:", error);
    throw error;
  }
};

/**
 * Update an existing grade
 */
export const updateGrade = async (
  schoolId: string,
  gradeId: string,
  updates: Partial<{
    value: number;
    title: string;
    description: string;
    type: GradeType;
    date: Date;
  }>
): Promise<void> => {
  try {
    const gradeRef = doc(db, "schools", schoolId, "grades", gradeId);
    const gradeDoc = await getDoc(gradeRef);

    if (!gradeDoc.exists()) {
      throw new Error("Grade not found");
    }

    const gradeData = gradeDoc.data() as Grade;

    // Prepare updates object
    const updatesObj: Record<string, number | string | Timestamp> = {};
    if (updates.value !== undefined) {
      // Validate grade value
      if (updates.value < 2 || updates.value > 6) {
        throw new Error("Grade value must be between 2 and 6");
      }
      updatesObj.value = updates.value;
    }
    if (updates.title !== undefined) updatesObj.title = updates.title;
    if (updates.description !== undefined)
      updatesObj.description = updates.description;
    if (updates.type !== undefined) updatesObj.type = updates.type;
    if (updates.date !== undefined)
      updatesObj.date = Timestamp.fromDate(updates.date);

    // Update the grade
    await updateDoc(gradeRef, updatesObj);

    // Get subject name for notification
    const subjectDoc = await getDoc(
      doc(db, "schools", schoolId, "subjects", gradeData.subjectId)
    );
    const subjectName = subjectDoc.exists()
      ? (subjectDoc.data() as Subject).name
      : "Unknown subject";

    // Create notification for student
    await createNotification(schoolId, {
      userId: gradeData.studentId,
      title: "Променена оценка",
      message: `Вашата оценка по ${subjectName}: ${gradeData.title} беше променена`,
      type: "edited-grade",
      relatedId: gradeId,
      link: await generateNotificationLink("edited-grade", gradeId),
    });

    // Create notification for student's parents
    await notifyParents(schoolId, gradeData.studentId, {
      title: "Променена оценка",
      message: `Оценката на вашето дете по ${subjectName}: ${gradeData.title} беше променена`,
      type: "edited-grade",
      relatedId: gradeId,
      link: await generateNotificationLink("edited-grade", gradeId),
    });
  } catch (error) {
    console.error("Error updating grade:", error);
    throw error;
  }
};

/**
 * Delete a grade
 */
export const deleteGrade = async (
  schoolId: string,
  gradeId: string
): Promise<void> => {
  try {
    const gradeRef = doc(db, "schools", schoolId, "grades", gradeId);
    const gradeDoc = await getDoc(gradeRef);

    if (!gradeDoc.exists()) {
      throw new Error("Grade not found");
    }

    const gradeData = gradeDoc.data() as Grade;

    // Get subject name for notification
    const subjectDoc = await getDoc(
      doc(db, "schools", schoolId, "subjects", gradeData.subjectId)
    );
    const subjectName = subjectDoc.exists()
      ? (subjectDoc.data() as Subject).name
      : "Unknown subject";

    // Create notification for student before deleting the grade
    await createNotification(schoolId, {
      userId: gradeData.studentId,
      title: "Изтрита оценка",
      message: `Вашата оценка ${gradeData.value} по ${subjectName}: ${gradeData.title} беше изтрита`,
      type: "deleted-grade",
      relatedId: gradeId,
      link: await generateNotificationLink("deleted-grade", gradeId),
    });

    // Create notification for student's parents
    await notifyParents(schoolId, gradeData.studentId, {
      title: "Изтрита оценка",
      message: `Оценката ${gradeData.value} на вашето дете по ${subjectName}: ${gradeData.title} беше изтрита`,
      type: "deleted-grade",
      relatedId: gradeId,
      link: await generateNotificationLink("deleted-grade", gradeId),
    });

    // Delete the grade
    await deleteDoc(gradeRef);
  } catch (error) {
    console.error("Error deleting grade:", error);
    throw error;
  }
};

/**
 * Get grades for a student
 */
export const getStudentGrades = async (
  schoolId: string,
  studentId: string
): Promise<Grade[]> => {
  try {
    const gradesCollection = collection(db, "schools", schoolId, "grades");
    const gradesQuery = query(
      gradesCollection,
      where("studentId", "==", studentId)
    );
    const gradesSnapshot = await getDocs(gradesQuery);

    return gradesSnapshot.docs.map((doc) => ({
      ...(doc.data() as Grade),
      id: doc.id,
    }));
  } catch (error) {
    console.error("Error getting student grades:", error);
    throw error;
  }
};

/**
 * Get all grades for a subject
 */
export const getSubjectGrades = async (
  schoolId: string,
  subjectId: string
): Promise<Grade[]> => {
  try {
    const gradesCollection = collection(db, "schools", schoolId, "grades");
    const gradesQuery = query(
      gradesCollection,
      where("subjectId", "==", subjectId)
    );
    const gradesSnapshot = await getDocs(gradesQuery);

    return gradesSnapshot.docs.map((doc) => ({
      ...(doc.data() as Grade),
      id: doc.id,
    }));
  } catch (error) {
    console.error("Error getting subject grades:", error);
    throw error;
  }
};

/**
 * Get all grades entered by a teacher
 */
export const getTeacherGrades = async (
  schoolId: string,
  teacherId: string
): Promise<Grade[]> => {
  try {
    const gradesCollection = collection(db, "schools", schoolId, "grades");
    const gradesQuery = query(
      gradesCollection,
      where("teacherId", "==", teacherId)
    );
    const gradesSnapshot = await getDocs(gradesQuery);

    return gradesSnapshot.docs.map((doc) => ({
      ...(doc.data() as Grade),
      id: doc.id,
    }));
  } catch (error) {
    console.error("Error getting teacher grades:", error);
    throw error;
  }
};

/**
 * Helper function to notify a student's parents
 */
const notifyParents = async (
  schoolId: string,
  studentId: string,
  notification: {
    title: string;
    message: string;
    type: NotificationType;
    relatedId?: string;
    link?: string;
  }
): Promise<void> => {
  try {
    // Find parents of the student
    const usersCollection = collection(db, "schools", schoolId, "users");
    const parentsQuery = query(usersCollection, where("role", "==", "parent"));
    const parentsSnapshot = await getDocs(parentsQuery);

    // Filter parents who have this student as a child
    const parentIds: string[] = [];
    for (const parentDoc of parentsSnapshot.docs) {
      const parentData = parentDoc.data();
      if (
        parentData.childrenIds &&
        parentData.childrenIds.includes(studentId)
      ) {
        parentIds.push(parentDoc.id);
      }
    }

    // For parent notifications, we'll modify the link to include the child's ID
    const parentNotification = {
      ...notification,
      // For grade-related notifications, add the studentId parameter to the link
      link: notification.type.includes("grade")
        ? `/grades?childId=${studentId}`
        : notification.link,
    };

    // If there are parents, create notifications for them
    if (parentIds.length > 0) {
      await createNotificationBulk(schoolId, parentIds, parentNotification);
    }
  } catch (error) {
    console.error("Error notifying parents:", error);
    throw error;
  }
};
