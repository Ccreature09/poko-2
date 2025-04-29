/**
 * Utilities for parent management in the application
 * 
 * This file contains functions for:
 * - Getting a parent's children
 * - Viewing a child's grades, assignments, and quiz results
 * - Managing parent-child relationships
 * - Managing student reviews
 */

import { collection, query, where, getDocs, getDoc, doc, updateDoc, arrayUnion, arrayRemove, addDoc, Timestamp, orderBy } from "firebase/firestore";
import { db } from "./firebase";
import type { Parent, Student, Grade, Assignment, AssignmentSubmission, QuizResult, Quiz, CheatAttempt, StudentReview, ReviewType } from "./interfaces";
import { createNotification } from "./notificationManagement";

/**
 * Get a list of a parent's children
 */
export const getParentChildren = async (schoolId: string, parentId: string): Promise<Student[]> => {
  try {
    // First get the parent to get their childrenIds
    const parentDoc = await getDoc(doc(db, "schools", schoolId, "users", parentId));
    if (!parentDoc.exists()) {
      throw new Error("Parent not found");
    }
    
    const parentData = parentDoc.data() as Parent;
    const childrenIds = parentData.childrenIds || [];
    
    if (childrenIds.length === 0) {
      return [];
    }
    
    // Fetch all children data
    const children: Student[] = [];
    for (const childId of childrenIds) {
      const childDoc = await getDoc(doc(db, "schools", schoolId, "users", childId));
      if (childDoc.exists() && childDoc.data().role === "student") {
        children.push({ ...(childDoc.data() as Student), userId: childId });
      }
    }
    
    return children;
  } catch (error) {
    console.error("Error getting parent's children:", error);
    throw error;
  }
};

/**
 * Link a parent to a child (used by admins)
 */
export const linkParentToChild = async (schoolId: string, parentId: string, childId: string): Promise<void> => {
  try {
    // Verify that the child exists and is a student
    const childDoc = await getDoc(doc(db, "schools", schoolId, "users", childId));
    if (!childDoc.exists() || childDoc.data().role !== "student") {
      throw new Error("Child not found or not a student");
    }
    
    // Update the parent's childrenIds array
    await updateDoc(doc(db, "schools", schoolId, "users", parentId), {
      childrenIds: arrayUnion(childId)
    });
    
  } catch (error) {
    console.error("Error linking parent to child:", error);
    throw error;
  }
};

/**
 * Remove link between a parent and a child (used by admins)
 */
export const unlinkParentFromChild = async (schoolId: string, parentId: string, childId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, "schools", schoolId, "users", parentId), {
      childrenIds: arrayRemove(childId)
    });
  } catch (error) {
    console.error("Error unlinking parent from child:", error);
    throw error;
  }
};

/**
 * Get all grades for a student (parent view)
 */
export const getChildGrades = async (schoolId: string, studentId: string): Promise<Grade[]> => {
  try {
    const gradesCollection = collection(db, "schools", schoolId, "grades");
    const gradesQuery = query(gradesCollection, where("studentId", "==", studentId));
    const gradesSnapshot = await getDocs(gradesQuery);
    
    return gradesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Grade)
    }));
  } catch (error) {
    console.error("Error getting child grades:", error);
    throw error;
  }
};

/**
 * Get assignments for a student (parent view)
 */
export const getChildAssignments = async (schoolId: string, studentId: string): Promise<{ 
  assignments: Assignment[],
  submissions: Record<string, AssignmentSubmission>
}> => {
  try {
    // Get the student to get their class
    const studentDoc = await getDoc(doc(db, "schools", schoolId, "users", studentId));
    if (!studentDoc.exists()) {
      throw new Error("Student not found");
    }
    
    const studentData = studentDoc.data() as Student;
    const homeroomClassId = studentData.homeroomClassId;
    
    // Get assignments for the student's class
    const assignmentsCollection = collection(db, "schools", schoolId, "assignments");
    const assignmentsQuery = query(
      assignmentsCollection, 
      where("classIds", "array-contains", homeroomClassId)
    );
    const assignmentsSnapshot = await getDocs(assignmentsQuery);
    
    const assignments = assignmentsSnapshot.docs.map(doc => ({
      ...(doc.data() as Assignment), // Spread first
      assignmentId: doc.id          // Then set ID
    }));
    
    // Get the student's submissions
    const submissions: Record<string, AssignmentSubmission> = {};
    for (const assignment of assignments) {
      const submissionsCollection = collection(
        db, 
        "schools", 
        schoolId, 
        "assignments", 
        assignment.assignmentId, 
        "submissions"
      );
      const submissionsQuery = query(submissionsCollection, where("studentId", "==", studentId));
      const submissionsSnapshot = await getDocs(submissionsQuery);
      
      if (!submissionsSnapshot.empty) {
        submissions[assignment.assignmentId] = {
          ...(submissionsSnapshot.docs[0].data() as AssignmentSubmission), // Spread first
          submissionId: submissionsSnapshot.docs[0].id                      // Then set ID
        };
      }
    }
    
    return { assignments, submissions };
  } catch (error) {
    console.error("Error getting child assignments:", error);
    throw error;
  }
};

/**
 * Get quiz results for a student (parent view)
 */
export const getChildQuizResults = async (schoolId: string, studentId: string): Promise<{
  quizzes: Quiz[],
  results: QuizResult[],
}> => {
  try {
    // Get student to get their class
    const studentDoc = await getDoc(doc(db, "schools", schoolId, "users", studentId));
    if (!studentDoc.exists()) {
      throw new Error("Student not found");
    }
    
    const studentData = studentDoc.data() as Student;
    const homeroomClassId = studentData.homeroomClassId;
    
    // Get quizzes for the student's class
    const quizzesCollection = collection(db, "schools", schoolId, "quizzes");
    const quizzesQuery = query(
      quizzesCollection, 
      where("classIds", "array-contains", homeroomClassId)
    );
    const quizzesSnapshot = await getDocs(quizzesQuery);
    
    const quizzes = quizzesSnapshot.docs.map(doc => ({
      ...(doc.data() as Quiz), // Spread first
      quizId: doc.id          // Then set ID
    }));
    
    // Get student's quiz results
    const quizResultsCollection = collection(db, "schools", schoolId, "quizResults");
    const resultsQuery = query(quizResultsCollection, where("userId", "==", studentId));
    const resultsSnapshot = await getDocs(resultsQuery);
    
    const results = resultsSnapshot.docs.map(doc => ({
      ...(doc.data() as QuizResult)
    }));
    
    return { quizzes, results };
  } catch (error) {
    console.error("Error getting child quiz results:", error);
    throw error;
  }
};

/**
 * Get cheating attempts for a quiz (parent view)
 */
export const getChildCheatingAttempts = async (
  schoolId: string, 
  quizId: string,
  studentId: string
): Promise<CheatAttempt[]> => {
  try {
    const quizDoc = await getDoc(doc(db, "schools", schoolId, "quizzes", quizId));
    if (!quizDoc.exists()) {
      throw new Error("Quiz not found");
    }
    
    const quizData = quizDoc.data() as Quiz;
    const cheatingAttempts = quizData.cheatingAttempts || {};
    
    return cheatingAttempts[studentId] || [];
  } catch (error) {
    console.error("Error getting cheating attempts:", error);
    throw error;
  }
};

/**
 * Create a new review for a student
 */
export const createStudentReview = async (
  schoolId: string,
  teacherId: string,
  teacherName: string,
  review: {
    studentId: string;
    title: string;
    content: string;
    type: ReviewType;
    subjectId?: string;
    subjectName?: string;
  }
): Promise<string> => {
  try {
    // Verify that student exists
    const studentDoc = await getDoc(doc(db, "schools", schoolId, "users", review.studentId));
    if (!studentDoc.exists() || studentDoc.data().role !== "student") {
      throw new Error("Student not found");
    }
    
    const reviewData: Omit<StudentReview, 'reviewId'> = {
      ...review,
      teacherId,
      teacherName,
      date: Timestamp.now(),
      createdAt: Timestamp.now()
    };
    
    const reviewsCollection = collection(db, "schools", schoolId, "studentReviews");
    const docRef = await addDoc(reviewsCollection, reviewData);
    const reviewId = docRef.id;
    
    // Update the document with its ID
    await updateDoc(docRef, { reviewId });
    
    // Get student data for notification
    const student = studentDoc.data() as Student;
    
    // Create a notification for the student
    await createNotification(schoolId, {
      userId: review.studentId,
      title: review.type === 'positive' ? "Нова положителна забележка" : "Нова отрицателна забележка",
      message: `Имате нова ${review.type === 'positive' ? 'положителна' : 'отрицателна'} забележка: ${review.title}`,
      type: "student-review", // Changed from "new-grade" to a more specific type
      relatedId: reviewId,
      link: `/student/feedback` // Direct link to student feedback page
    });
    
    // Find parents of this student and notify them
    const parentsQuery = query(
      collection(db, "schools", schoolId, "users"),
      where("role", "==", "parent"),
      where("childrenIds", "array-contains", review.studentId)
    );
    const parentsSnapshot = await getDocs(parentsQuery);
    
    // Send notification to each parent
    for (const parentDoc of parentsSnapshot.docs) {
      const parentId = parentDoc.id;
      await createNotification(schoolId, {
        userId: parentId,
        title: review.type === 'positive' ? "Нова положителна забележка" : "Нова отрицателна забележка",
        message: `Детето ви ${student.firstName} ${student.lastName} получи ${review.type === 'positive' ? 'положителна' : 'отрицателна'} забележка: ${review.title}`,
        type: "student-review", // Changed to specific type
        relatedId: reviewId,
        link: `/parent/feedback` // Updated link to parent feedback page
      });
    }
    
    return reviewId;
  } catch (error) {
    console.error("Error creating student review:", error);
    throw error;
  }
};

/**
 * Get all reviews for a student
 */
export const getChildReviews = async (schoolId: string, studentId: string): Promise<StudentReview[]> => {
  try {
    const reviewsCollection = collection(db, "schools", schoolId, "studentReviews");
    const reviewsQuery = query(
      reviewsCollection, 
      where("studentId", "==", studentId),
      orderBy("date", "desc")
    );
    const reviewsSnapshot = await getDocs(reviewsQuery);
    
    return reviewsSnapshot.docs.map(doc => ({
      ...(doc.data() as StudentReview),
      reviewId: doc.id
    }));
  } catch (error) {
    console.error("Error getting student reviews:", error);
    throw error;
  }
};