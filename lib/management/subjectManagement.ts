/**
 * @module subjectManagement
 * @description Handles CRUD operations for subjects within a school, including
 * retrieval, creation, updating, and deletion of subject records.
 */

import { db } from "@/lib/firebase";
import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  addDoc,
  getDoc,
  writeBatch,
} from "firebase/firestore";
import type {
  Subject,
  TeacherSubjectAssignment,
  ClassSubjectsMapping,
  HomeroomClass,
} from "@/lib/interfaces";

/**
 * Retrieves all subjects for a given school.
 * @param schoolId ID of the school.
 * @returns Promise resolving to array of Subject objects.
 */
export const getSubjects = async (schoolId: string): Promise<Subject[]> => {
  const subjectsCollection = collection(db, "schools", schoolId, "subjects");
  const subjectsSnapshot = await getDocs(subjectsCollection);
  return subjectsSnapshot.docs.map(
    (doc) =>
      ({
        subjectId: doc.id,
        ...doc.data(),
      } as Subject)
  );
};

/**
 * Creates a new subject in a school.
 * @param schoolId ID of the school.
 * @param subject Data for the new subject.
 * @returns Promise<void>.
 */
export const addSubject = async (
  schoolId: string,
  subject: Subject
): Promise<void> => {
  const subjectsCollection = collection(db, "schools", schoolId, "subjects");
  const subjectRef = doc(subjectsCollection);
  await setDoc(subjectRef, { ...subject, subjectId: subjectRef.id });
};

/**
 * Deletes a subject and cleans up related data.
 * @param schoolId ID of the school.
 * @param subjectId ID of the subject to delete.
 * @returns Promise<void>.
 */
export const deleteSubject = async (
  schoolId: string,
  subjectId: string
): Promise<void> => {
  const subjectRef = doc(db, "schools", schoolId, "subjects", subjectId);
  await deleteDoc(subjectRef);
};

/**
 * Get all homeroom classes in the school.
 * @param schoolId ID of the school.
 * @returns Promise resolving to array of HomeroomClass objects.
 */
export const getClasses = async (
  schoolId: string
): Promise<HomeroomClass[]> => {
  const classesCollection = collection(db, "schools", schoolId, "classes");
  const classesSnapshot = await getDocs(classesCollection);
  return classesSnapshot.docs.map(
    (doc) =>
      ({
        classId: doc.id,
        ...doc.data(),
      } as HomeroomClass)
  );
};

/**
 * Get classes for a specific grade level.
 * @param schoolId ID of the school.
 * @param yearGroup Grade level to filter classes by.
 * @returns Promise resolving to array of HomeroomClass objects.
 */
export const getClassesByGradeLevel = async (
  schoolId: string,
  yearGroup: number
): Promise<HomeroomClass[]> => {
  const classesCollection = collection(db, "schools", schoolId, "classes");
  const q = query(classesCollection, where("yearGroup", "==", yearGroup));
  const classesSnapshot = await getDocs(q);
  return classesSnapshot.docs.map(
    (doc) =>
      ({
        classId: doc.id,
        ...doc.data(),
      } as HomeroomClass)
  );
};

/**
 * Create a new assignment for a teacher to teach a subject to specific classes.
 * @param schoolId ID of the school.
 * @param assignment Assignment data excluding assignmentId.
 * @returns Promise resolving to the created assignment ID.
 */
export const createTeacherSubjectAssignment = async (
  schoolId: string,
  assignment: Omit<TeacherSubjectAssignment, "assignmentId">
): Promise<string> => {
  const assignmentsCollection = collection(
    db,
    "schools",
    schoolId,
    "teacherSubjectAssignments"
  );
  const docRef = await addDoc(assignmentsCollection, assignment);
  await updateDoc(docRef, { assignmentId: docRef.id });
  return docRef.id;
};

/**
 * Update an existing teacher-subject-class assignment.
 * @param schoolId ID of the school.
 * @param assignmentId ID of the assignment to update.
 * @param updatedData Partial data to update the assignment with.
 * @returns Promise<void>.
 */
export const updateTeacherSubjectAssignment = async (
  schoolId: string,
  assignmentId: string,
  updatedData: Partial<TeacherSubjectAssignment>
): Promise<void> => {
  const assignmentRef = doc(
    db,
    "schools",
    schoolId,
    "teacherSubjectAssignments",
    assignmentId
  );
  await updateDoc(assignmentRef, updatedData);
};

/**
 * Delete a teacher-subject-class assignment.
 * @param schoolId ID of the school.
 * @param assignmentId ID of the assignment to delete.
 * @returns Promise<void>.
 */
export const deleteTeacherSubjectAssignment = async (
  schoolId: string,
  assignmentId: string
): Promise<void> => {
  const assignmentRef = doc(
    db,
    "schools",
    schoolId,
    "teacherSubjectAssignments",
    assignmentId
  );
  await deleteDoc(assignmentRef);
};

/**
 * Get all teacher-subject assignments for a school.
 * @param schoolId ID of the school.
 * @returns Promise resolving to array of TeacherSubjectAssignment objects.
 */
export const getTeacherSubjectAssignments = async (
  schoolId: string
): Promise<TeacherSubjectAssignment[]> => {
  const assignmentsCollection = collection(
    db,
    "schools",
    schoolId,
    "teacherSubjectAssignments"
  );
  const snapshot = await getDocs(assignmentsCollection);
  return snapshot.docs.map(
    (doc) => ({ ...doc.data() } as TeacherSubjectAssignment)
  );
};

/**
 * Get assignments for a specific teacher.
 * @param schoolId ID of the school.
 * @param teacherId ID of the teacher.
 * @returns Promise resolving to array of TeacherSubjectAssignment objects.
 */
export const getTeacherAssignments = async (
  schoolId: string,
  teacherId: string
): Promise<TeacherSubjectAssignment[]> => {
  const assignmentsCollection = collection(
    db,
    "schools",
    schoolId,
    "teacherSubjectAssignments"
  );
  const q = query(assignmentsCollection, where("teacherId", "==", teacherId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (doc) => ({ ...doc.data() } as TeacherSubjectAssignment)
  );
};

/**
 * Get assignments for a specific subject.
 * @param schoolId ID of the school.
 * @param subjectId ID of the subject.
 * @returns Promise resolving to array of TeacherSubjectAssignment objects.
 */
export const getSubjectAssignments = async (
  schoolId: string,
  subjectId: string
): Promise<TeacherSubjectAssignment[]> => {
  const assignmentsCollection = collection(
    db,
    "schools",
    schoolId,
    "teacherSubjectAssignments"
  );
  const q = query(assignmentsCollection, where("subjectId", "==", subjectId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (doc) => ({ ...doc.data() } as TeacherSubjectAssignment)
  );
};

/**
 * Get assignments for a specific class.
 * @param schoolId ID of the school.
 * @param classId ID of the class.
 * @returns Promise resolving to array of TeacherSubjectAssignment objects.
 */
export const getClassAssignments = async (
  schoolId: string,
  classId: string
): Promise<TeacherSubjectAssignment[]> => {
  const assignmentsCollection = collection(
    db,
    "schools",
    schoolId,
    "teacherSubjectAssignments"
  );
  const q = query(
    assignmentsCollection,
    where("classIds", "array-contains", classId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (doc) => ({ ...doc.data() } as TeacherSubjectAssignment)
  );
};

/**
 * Get subject info with teacher assignments.
 * @param schoolId ID of the school.
 * @param subjectId ID of the subject.
 * @returns Promise resolving to an object containing the subject and its assignments.
 */
export const getSubjectWithTeacherAssignments = async (
  schoolId: string,
  subjectId: string
): Promise<{ subject: Subject; assignments: TeacherSubjectAssignment[] }> => {
  const subjectRef = doc(db, "schools", schoolId, "subjects", subjectId);
  const subjectSnap = await getDoc(subjectRef);

  if (!subjectSnap.exists()) {
    throw new Error("Subject not found");
  }

  const subject = {
    subjectId: subjectSnap.id,
    ...subjectSnap.data(),
  } as Subject;

  const assignments = await getSubjectAssignments(schoolId, subjectId);

  return { subject, assignments };
};

/**
 * Create or update subject assignments for a class.
 * @param schoolId ID of the school.
 * @param classSubjects Mapping of class ID to subjects and their teachers.
 * @returns Promise<void>.
 */
export const updateClassSubjects = async (
  schoolId: string,
  classSubjects: ClassSubjectsMapping
): Promise<void> => {
  const { classId, subjects } = classSubjects;
  const batch = writeBatch(db);

  // Update class document with the list of subject teacher assignments
  const classRef = doc(db, "schools", schoolId, "classes", classId);

  // Get existing class data
  const classDoc = await getDoc(classRef);
  if (!classDoc.exists()) {
    throw new Error("Class not found");
  }

  // Update teacher IDs in the class document
  const teacherIds = [...new Set(subjects.map((s) => s.teacherId))];
  batch.update(classRef, {
    teacherIds: teacherIds,
  });

  // Create or update assignments for each subject-teacher pair
  for (const { subjectId, teacherId } of subjects) {
    // Check if an assignment already exists
    const assignmentsCollection = collection(
      db,
      "schools",
      schoolId,
      "teacherSubjectAssignments"
    );
    const q = query(
      assignmentsCollection,
      where("subjectId", "==", subjectId),
      where("teacherId", "==", teacherId)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // Create new assignment
      const newAssignment = {
        teacherId,
        subjectId,
        classIds: [classId],
        schoolYear: getCurrentSchoolYear(),
      };
      const assignmentRef = doc(assignmentsCollection);
      batch.set(assignmentRef, {
        ...newAssignment,
        assignmentId: assignmentRef.id,
      });
    } else {
      // Update existing assignment
      const existingAssignment = snapshot.docs[0];
      const existingData =
        existingAssignment.data() as TeacherSubjectAssignment;

      // Only add the class if it's not already in the classIds array
      if (!existingData.classIds.includes(classId)) {
        batch.update(existingAssignment.ref, {
          classIds: [...existingData.classIds, classId],
        });
      }
    }
  }

  await batch.commit();
};

/**
 * Helper function to get current school year (e.g., "2024-2025").
 * @returns Current school year as a string.
 */
export const getCurrentSchoolYear = (): string => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-based (0 = January)

  // If we're in the second half of the academic year (January-August)
  if (currentMonth < 8) {
    // Before September
    return `${currentYear - 1}-${currentYear}`;
  } else {
    return `${currentYear}-${currentYear + 1}`;
  }
};
