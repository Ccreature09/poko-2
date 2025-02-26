import { db } from "@/lib/firebase";
import {
  doc,
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  deleteDoc,
} from "firebase/firestore";
import type { 
  Assignment, 
  AssignmentSubmission,
  AssignmentFeedback
} from "@/lib/interfaces";

// Create a new assignment
export const createAssignment = async (
  schoolId: string,
  assignment: Omit<Assignment, "assignmentId" | "createdAt" | "status">
): Promise<string> => {
  try {
    const assignmentsCollection = collection(db, "schools", schoolId, "assignments");
    const assignmentData = {
      ...assignment,
      createdAt: Timestamp.now(),
      status: "active",
    };
    
    const docRef = await addDoc(assignmentsCollection, assignmentData);
    await updateDoc(docRef, { assignmentId: docRef.id });
    
    return docRef.id;
  } catch (error) {
    console.error("Error creating assignment:", error);
    throw error;
  }
};

// Get all assignments for a school
export const getAssignments = async (
  schoolId: string,
  filters?: {
    teacherId?: string;
    subjectId?: string;
    classId?: string;
    status?: string;
  }
): Promise<Assignment[]> => {
  try {
    const assignmentsCollection = collection(db, "schools", schoolId, "assignments");
    let q = query(assignmentsCollection, orderBy("dueDate", "desc"));
    
    if (filters) {
      if (filters.teacherId) {
        q = query(q, where("teacherId", "==", filters.teacherId));
      }
      if (filters.subjectId) {
        q = query(q, where("subjectId", "==", filters.subjectId));
      }
      if (filters.classId) {
        q = query(q, where("classIds", "array-contains", filters.classId));
      }
      if (filters.status) {
        q = query(q, where("status", "==", filters.status));
      }
    }
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(
      (doc) => ({ ...doc.data() } as Assignment)
    );
  } catch (error) {
    console.error("Error fetching assignments:", error);
    throw error;
  }
};

// Get assignments for a specific student
export const getStudentAssignments = async (
  schoolId: string,
  studentId: string
): Promise<Assignment[]> => {
  try {
    const assignmentsCollection = collection(db, "schools", schoolId, "assignments");
    const q = query(
      assignmentsCollection,
      where("status", "==", "active"),
      where("studentIds", "array-contains", studentId)
    );
    
    // First get assignments directly assigned to the student
    const directAssignmentSnapshot = await getDocs(q);
    const directAssignments = directAssignmentSnapshot.docs.map(
      (doc) => ({ ...doc.data() } as Assignment)
    );
    
    // Then get student's homeroom class ID
    const userDoc = await getDoc(doc(db, "schools", schoolId, "users", studentId));
    const userData = userDoc.data();
    if (!userData || !userData.homeroomClassId) {
      return directAssignments;
    }
    
    // Get assignments assigned to student's class
    const classAssignmentsQuery = query(
      assignmentsCollection,
      where("status", "==", "active"),
      where("classIds", "array-contains", userData.homeroomClassId)
    );
    
    const classAssignmentsSnapshot = await getDocs(classAssignmentsQuery);
    const classAssignments = classAssignmentsSnapshot.docs.map(
      (doc) => ({ ...doc.data() } as Assignment)
    );
    
    // Combine and deduplicate assignments
    const allAssignments = [...directAssignments];
    classAssignments.forEach((classAssignment) => {
      if (!allAssignments.some((a) => a.assignmentId === classAssignment.assignmentId)) {
        allAssignments.push(classAssignment);
      }
    });
    
    return allAssignments;
  } catch (error) {
    console.error("Error fetching student assignments:", error);
    throw error;
  }
};

// Get a single assignment by ID
export const getAssignment = async (
  schoolId: string,
  assignmentId: string
): Promise<Assignment | null> => {
  try {
    const assignmentDoc = await getDoc(
      doc(db, "schools", schoolId, "assignments", assignmentId)
    );
    
    if (assignmentDoc.exists()) {
      return { ...assignmentDoc.data() } as Assignment;
    }
    return null;
  } catch (error) {
    console.error("Error fetching assignment:", error);
    throw error;
  }
};

// Update an assignment
export const updateAssignment = async (
  schoolId: string,
  assignmentId: string,
  updates: Partial<Assignment>
): Promise<void> => {
  try {
    await updateDoc(
      doc(db, "schools", schoolId, "assignments", assignmentId),
      updates
    );
  } catch (error) {
    console.error("Error updating assignment:", error);
    throw error;
  }
};

// Delete an assignment
export const deleteAssignment = async (
  schoolId: string,
  assignmentId: string
): Promise<void> => {
  try {
    // Delete the assignment document
    await deleteDoc(doc(db, "schools", schoolId, "assignments", assignmentId));
    
    // Delete all submissions for this assignment
    const submissionsCollection = collection(db, "schools", schoolId, "submissions");
    const q = query(submissionsCollection, where("assignmentId", "==", assignmentId));
    const submissionsSnapshot = await getDocs(q);
    
    const deletePromises = submissionsSnapshot.docs.map((doc) =>
      deleteDoc(doc.ref)
    );
    
    await Promise.all(deletePromises);
  } catch (error) {
    console.error("Error deleting assignment:", error);
    throw error;
  }
};

// Submit an assignment
export const submitAssignment = async (
  schoolId: string,
  submission: Omit<AssignmentSubmission, "submissionId" | "submittedAt" | "status">
): Promise<string> => {
  try {
    const submissionsCollection = collection(db, "schools", schoolId, "submissions");
    const assignmentDoc = await getDoc(
      doc(db, "schools", schoolId, "assignments", submission.assignmentId)
    );
    
    if (!assignmentDoc.exists()) {
      throw new Error("Assignment not found");
    }
    
    const assignment = assignmentDoc.data() as Assignment;
    const now = Timestamp.now();
    let status: "submitted" | "late" = "submitted";
    
    // Check if submission is late
    if (now.seconds > assignment.dueDate.seconds && !assignment.allowLateSubmission) {
      throw new Error("Late submissions are not allowed for this assignment");
    } else if (now.seconds > assignment.dueDate.seconds) {
      status = "late";
    }
    
    // Check if student has already submitted
    const existingSubmissionQuery = query(
      submissionsCollection,
      where("assignmentId", "==", submission.assignmentId),
      where("studentId", "==", submission.studentId)
    );
    
    const existingSubmissionSnapshot = await getDocs(existingSubmissionQuery);
    
    if (!existingSubmissionSnapshot.empty) {
      // Student has already submitted - check if resubmission is allowed
      if (!assignment.allowResubmission) {
        throw new Error("Resubmissions are not allowed for this assignment");
      }
      
      const existingSubmission = existingSubmissionSnapshot.docs[0];
      const existingData = existingSubmission.data();
      
      // Update existing submission
      await updateDoc(existingSubmission.ref, {
        content: submission.content,
        lastEditedAt: now,
        status: "resubmitted",
      });
      
      return existingSubmission.id;
    }
    
    // Create new submission
    const submissionData = {
      ...submission,
      submittedAt: now,
      status
    };
    
    const docRef = await addDoc(submissionsCollection, submissionData);
    await updateDoc(docRef, { submissionId: docRef.id });
    
    return docRef.id;
  } catch (error) {
    console.error("Error submitting assignment:", error);
    throw error;
  }
};

// Get submissions for an assignment
export const getSubmissions = async (
  schoolId: string,
  assignmentId: string
): Promise<AssignmentSubmission[]> => {
  try {
    const submissionsCollection = collection(db, "schools", schoolId, "submissions");
    const q = query(
      submissionsCollection,
      where("assignmentId", "==", assignmentId)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(
      (doc) => ({ ...doc.data() } as AssignmentSubmission)
    );
  } catch (error) {
    console.error("Error fetching submissions:", error);
    throw error;
  }
};

// Get a specific student's submission for an assignment
export const getStudentSubmission = async (
  schoolId: string,
  assignmentId: string,
  studentId: string
): Promise<AssignmentSubmission | null> => {
  try {
    const submissionsCollection = collection(db, "schools", schoolId, "submissions");
    const q = query(
      submissionsCollection,
      where("assignmentId", "==", assignmentId),
      where("studentId", "==", studentId)
    );
    
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;
    
    return { ...querySnapshot.docs[0].data() } as AssignmentSubmission;
  } catch (error) {
    console.error("Error fetching student submission:", error);
    throw error;
  }
};

// Grade a submission
export const gradeSubmission = async (
  schoolId: string,
  submissionId: string,
  feedback: AssignmentFeedback
): Promise<void> => {
  try {
    await updateDoc(
      doc(db, "schools", schoolId, "submissions", submissionId),
      {
        feedback,
        status: "graded"
      }
    );
  } catch (error) {
    console.error("Error grading submission:", error);
    throw error;
  }
};