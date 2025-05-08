/**
 * @module courseManagement
 * @description Manages courses: creation, retrieval, updating, and deletion.
 */
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  setDoc,
  type CollectionReference,
} from "firebase/firestore";
import type { Course } from "@/lib/interfaces";
import { v4 as uuidv4 } from "uuid";

/**
 * Retrieves all courses for a school.
 * @param schoolId ID of the school.
 * @param options Optional filters, e.g., teacherId.
 * @returns Promise resolving to array of Course objects.
 */
export const getCourses = async (
  schoolId: string,
  options?: { teacherId?: string }
) => {
  try {
    const coursesCollection = collection(
      db,
      "schools",
      schoolId,
      "courses"
    ) as CollectionReference;
    const coursesQuery = options?.teacherId
      ? query(coursesCollection, where("teacherId", "==", options.teacherId))
      : coursesCollection;

    const coursesSnapshot = await getDocs(coursesQuery);
    return coursesSnapshot.docs.map((doc) => ({
      ...doc.data(),
      courseId: doc.id,
    })) as Course[];
  } catch (error) {
    console.error("Error fetching courses:", error);
    throw error;
  }
};

/**
 * Fetches a single course by its ID.
 * @param schoolId ID of the school.
 * @param courseId ID of the course.
 * @returns Promise resolving to the Course object.
 */
export const getCourseById = async (schoolId: string, courseId: string) => {
  try {
    const courseDoc = await getDoc(
      doc(db, "schools", schoolId, "courses", courseId)
    );
    if (!courseDoc.exists()) {
      throw new Error("Course not found");
    }
    return { ...courseDoc.data(), courseId: courseDoc.id } as Course;
  } catch (error) {
    console.error("Error fetching course:", error);
    throw error;
  }
};

/**
 * Creates a new course in the school.
 * @param schoolId ID of the school.
 * @param courseData Course details excluding auto-generated ID.
 * @returns Promise resolving to the created course ID.
 */
export const createCourse = async (
  schoolId: string,
  courseData: Partial<Course>
) => {
  try {
    const courseId = uuidv4();
    const courseRef = doc(db, "schools", schoolId, "courses", courseId);

    const courseWithId = {
      ...courseData,
      courseId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await setDoc(courseRef, courseWithId);

    return courseId;
  } catch (error) {
    console.error("Error creating course:", error);
    throw error;
  }
};

/**
 * Updates an existing course's information.
 * @param schoolId ID of the school.
 * @param courseId ID of the course to update.
 * @param courseData Partial Course fields to update.
 * @returns Promise<void>.
 */
export const updateCourse = async (
  schoolId: string,
  courseId: string,
  courseData: Partial<Course>
) => {
  try {
    const courseRef = doc(db, "schools", schoolId, "courses", courseId);

    const courseToUpdate = {
      ...courseData,
      updatedAt: Timestamp.now(),
    };

    await updateDoc(courseRef, courseToUpdate);
  } catch (error) {
    console.error("Error updating course:", error);
    throw error;
  }
};

/**
 * Deletes a course and removes associations.
 * @param schoolId ID of the school.
 * @param courseId ID of the course to delete.
 * @returns Promise<void>.
 */
export const deleteCourse = async (schoolId: string, courseId: string) => {
  try {
    // Delete the course document
    const courseRef = doc(db, "schools", schoolId, "courses", courseId);
    await deleteDoc(courseRef);

    // Note: You may also want to delete or update related documents
    // For example, removing course references from students' enrollments
  } catch (error) {
    console.error("Error deleting course:", error);
    throw error;
  }
};
