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
import { 
  Assignment, 
  AssignmentSubmission,
  AssignmentFeedback
} from "@/lib/interfaces";
import { createNotification, createNotificationBulk, getNotificationLink } from "./notificationManagement";

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
    
    console.log("Creating assignment with studentIds:", assignment.studentIds);
    
    const docRef = await addDoc(assignmentsCollection, assignmentData);
    await updateDoc(docRef, { assignmentId: docRef.id });
    
    // Generate notifications for students
    const affectedStudentIds: string[] = [];
    
    // If assigned to specific students
    if (assignment.studentIds && assignment.studentIds.length > 0) {
      affectedStudentIds.push(...assignment.studentIds);
    } 
    // Otherwise, get all students from assigned classes
    else if (assignment.classIds && assignment.classIds.length > 0) {
      for (const classId of assignment.classIds) {
        const classDoc = await getDoc(doc(db, "schools", schoolId, "classes", classId));
        if (classDoc.exists() && classDoc.data().studentIds) {
          affectedStudentIds.push(...classDoc.data().studentIds);
        }
      }
    }
    
    // Remove duplicates
    const uniqueStudentIds = [...new Set(affectedStudentIds)];
    
    // Create notifications for all affected students
    if (uniqueStudentIds.length > 0) {
      await createNotificationBulk(schoolId, uniqueStudentIds, {
        title: "Нова задача",
        message: `Имате нова задача: "${assignment.title}"`,
        type: "new-assignment",
        relatedId: docRef.id,
        link: getNotificationLink("new-assignment", docRef.id)
      });
    }
    
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
    
    // Get the student's class info
    const userDoc = await getDoc(doc(db, "schools", schoolId, "users", studentId));
    const userData = userDoc.data();
    const homeroomClassId = userData?.homeroomClassId;
    
    // Get all active assignments
    const allAssignmentsQuery = query(
      assignmentsCollection,
      where("status", "==", "active")
    );
    
    const assignmentsSnapshot = await getDocs(allAssignmentsQuery);
    const assignments: Assignment[] = [];

    // Filter assignments that are either assigned to the student's class or directly to the student
    for (const doc of assignmentsSnapshot.docs) {
      const assignment = { ...doc.data() } as Assignment;
      
      // Check if assignment is assigned to student's class
      if (homeroomClassId && assignment.classIds?.includes(homeroomClassId)) {
        assignments.push(assignment);
        continue;
      }
      
      // Check if assignment is assigned directly to student
      if (assignment.studentIds?.includes(studentId)) {
        assignments.push(assignment);
      }
    }
    
    return assignments;
    
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
    let status: "submitted" | "late" | "resubmitted" = "submitted";
    
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
      
      // Update existing submission
      await updateDoc(existingSubmission.ref, {
        content: submission.content,
        lastEditedAt: now,
        status: "resubmitted",
      });
      
      // Notify teacher of resubmission
      await createNotification(schoolId, {
        userId: assignment.teacherId,
        title: "Задачата е предадена отново",
        message: `${submission.studentName} е предал отново работата си за "${assignment.title}"`,
        type: "new-assignment",
        relatedId: submission.assignmentId,
        link: `/assignments/${submission.assignmentId}`
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
    
    // Notify teacher of new submission
    await createNotification(schoolId, {
      userId: assignment.teacherId,
      title: status === "late" ? "Късно предаване на задача" : "Ново предаване на задача",
      message: `${submission.studentName} е предал работата си за "${assignment.title}"${status === "late" ? " (късно)" : ""}`,
      type: status === "late" ? "late-submission" : "new-assignment",
      relatedId: submission.assignmentId,
      link: `/assignments/${submission.assignmentId}`
    });
    
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
    // Get the submission to find student and assignment info
    const submissionRef = doc(db, "schools", schoolId, "submissions", submissionId);
    const submissionDoc = await getDoc(submissionRef);
    
    if (!submissionDoc.exists()) {
      throw new Error("Submission not found");
    }
    
    const submission = submissionDoc.data() as AssignmentSubmission;
    
    // Update submission with feedback
    await updateDoc(submissionRef, {
      feedback,
      status: "graded"
    });
    
    // Get assignment details for notification
    const assignmentDoc = await getDoc(
      doc(db, "schools", schoolId, "assignments", submission.assignmentId)
    );
    
    if (!assignmentDoc.exists()) {
      throw new Error("Assignment not found");
    }
    
    const assignment = assignmentDoc.data() as Assignment;
    
    // Create notification for student
    await createNotification(schoolId, {
      userId: submission.studentId,
      title: "Задачата е оценена",
      message: `Вашето предаване за "${assignment.title}" е оценено.${feedback.grade ? ` Оценка: ${feedback.grade}` : ''}`,
      type: "assignment-graded",
      relatedId: submission.assignmentId,
      link: `/assignments/${submission.assignmentId}`
    });
    
  } catch (error) {
    console.error("Error grading submission:", error);
    throw error;
  }
};

// Get all pending submissions (not graded yet) for a teacher
export const getPendingSubmissions = async (
  schoolId: string,
  teacherId: string
): Promise<{ submission: AssignmentSubmission; assignment: Assignment }[]> => {
  try {
    // First, get all assignments created by the teacher
    const assignmentsCollection = collection(db, "schools", schoolId, "assignments");
    const assignmentsQuery = query(assignmentsCollection, where("teacherId", "==", teacherId));
    const assignmentsSnapshot = await getDocs(assignmentsQuery);
    
    const assignmentIds = assignmentsSnapshot.docs.map(doc => doc.id);
    const assignmentsMap = new Map(
      assignmentsSnapshot.docs.map(doc => [doc.id, { ...doc.data() } as Assignment])
    );
    
    // No assignments found
    if (assignmentIds.length === 0) {
      return [];
    }
    
    // Now, get all submissions for these assignments that are not graded
    const submissionsCollection = collection(db, "schools", schoolId, "submissions");
    
    // Firebase doesn't support 'in' and 'not equals' together, so we need to do multiple queries
    const submissionStatuses = ["submitted", "late", "resubmitted"];
    const submissionsPromises = submissionStatuses.map(status => {
      const q = query(
        submissionsCollection,
        where("assignmentId", "in", assignmentIds),
        where("status", "==", status)
      );
      return getDocs(q);
    });
    
    const submissionsSnapshots = await Promise.all(submissionsPromises);
    
    // Combine results from all queries
    const pendingSubmissions: { submission: AssignmentSubmission; assignment: Assignment }[] = [];
    
    submissionsSnapshots.forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        const submission = { ...doc.data() } as AssignmentSubmission;
        const assignment = assignmentsMap.get(submission.assignmentId);
        
        if (assignment) {
          pendingSubmissions.push({ submission, assignment });
        }
      });
    });
    
    return pendingSubmissions;
  } catch (error) {
    console.error("Error fetching pending submissions:", error);
    throw error;
  }
};

// Get assignment stats for teacher or admin
export const getAssignmentStats = async (
  schoolId: string,
  teacherId?: string  // Optional for admins who want to see all stats
): Promise<{
  totalAssignments: number;
  pendingGrading: number;
  submissionRate: number;
  lateSubmissions: number;
}> => {
  try {
    const assignmentsCollection = collection(db, "schools", schoolId, "assignments");
    const submissionsCollection = collection(db, "schools", schoolId, "submissions");
    
    // Query assignments
    let assignmentsQuery = query(assignmentsCollection);
    if (teacherId) {
      assignmentsQuery = query(assignmentsCollection, where("teacherId", "==", teacherId));
    }
    
    const assignmentsSnapshot = await getDocs(assignmentsQuery);
    const assignments = assignmentsSnapshot.docs.map(doc => ({ ...doc.data() } as Assignment));
    
    if (assignments.length === 0) {
      return {
        totalAssignments: 0,
        pendingGrading: 0,
        submissionRate: 0,
        lateSubmissions: 0
      };
    }
    
    // Get all assignmentIds
    const assignmentIds = assignments.map(a => a.assignmentId);
    
    // Get all submissions for these assignments
    const submissionsQuery = query(
      submissionsCollection,
      where("assignmentId", "in", assignmentIds)
    );
    
    const submissionsSnapshot = await getDocs(submissionsQuery);
    const submissions = submissionsSnapshot.docs.map(doc => ({ ...doc.data() } as AssignmentSubmission));
    
    // Calculate stats
    const pendingGrading = submissions.filter(sub => sub.status !== "graded").length;
    const lateSubmissions = submissions.filter(sub => sub.status === "late").length;
    
    // Calculate expected submissions (across all assignments)
    let totalExpectedSubmissions = 0;
    
    for (const assignment of assignments) {
      const studentIds = new Set<string>();
      
      // Students directly assigned
      if (assignment.studentIds && assignment.studentIds.length > 0) {
        assignment.studentIds.forEach(id => studentIds.add(id));
      }
      
      // Students from classes
      if (assignment.classIds && assignment.classIds.length > 0) {
        for (const classId of assignment.classIds) {
          const classDoc = await getDoc(doc(db, "schools", schoolId, "classes", classId));
          if (classDoc.exists() && classDoc.data().studentIds) {
            classDoc.data().studentIds.forEach((id: string) => studentIds.add(id));
          }
        }
      }
      
      totalExpectedSubmissions += studentIds.size;
    }
    
    const submissionRate = totalExpectedSubmissions > 0 
      ? (submissions.length / totalExpectedSubmissions) * 100 
      : 0;
    
    return {
      totalAssignments: assignments.length,
      pendingGrading,
      submissionRate,
      lateSubmissions
    };
    
  } catch (error) {
    console.error("Error getting assignment stats:", error);
    throw error;
  }
};