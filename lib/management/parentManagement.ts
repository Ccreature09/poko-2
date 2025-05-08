/**
 * @fileoverview Manages parent-specific functionalities within the Poko application.
 *
 * This module provides functions for:
 * - Retrieving a parent's linked children.
 * - Linking and unlinking parents to children (admin functionality).
 * - Fetching a child's academic data (grades, assignments, quiz results, reviews) for parental view.
 * - Creating student reviews (typically by teachers, but notifications are sent to parents).
 * - Retrieving student submissions for assignments, with a focus on direct querying of submission collections for reliability.
 */

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  addDoc,
  Timestamp,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  Parent,
  Student,
  Grade,
  Assignment,
  AssignmentSubmission,
  QuizResult,
  Quiz,
  CheatAttempt,
  StudentReview,
  ReviewType,
} from "@/lib/interfaces";
import { createNotification } from "@/lib/management/notificationManagement";

/**
 * Retrieves a list of children linked to a specific parent account.
 * Fetches the parent document to get `childrenIds`, then fetches each child's details.
 * @param schoolId - The ID of the school.
 * @param parentId - The ID of the parent user.
 * @returns A promise that resolves to an array of `Student` objects representing the parent's children.
 * @throws Will throw an error if the parent is not found or if database operations fail.
 */
export const getParentChildren = async (
  schoolId: string,
  parentId: string
): Promise<Student[]> => {
  try {
    // First get the parent to get their childrenIds
    const parentDoc = await getDoc(
      doc(db, "schools", schoolId, "users", parentId)
    );
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
      const childDoc = await getDoc(
        doc(db, "schools", schoolId, "users", childId)
      );
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
 * Links a parent account to a child account. This action is typically performed by an administrator.
 * Verifies that the child exists and has the 'student' role before updating the parent's `childrenIds`.
 * @param schoolId - The ID of the school.
 * @param parentId - The ID of the parent user.
 * @param childId - The ID of the child (student) user to link.
 * @returns A promise that resolves when the link is successfully created.
 * @throws Will throw an error if the child is not found, is not a student, or if database operations fail.
 */
export const linkParentToChild = async (
  schoolId: string,
  parentId: string,
  childId: string
): Promise<void> => {
  try {
    // Verify that the child exists and is a student
    const childDoc = await getDoc(
      doc(db, "schools", schoolId, "users", childId)
    );
    if (!childDoc.exists() || childDoc.data().role !== "student") {
      throw new Error("Child not found or not a student");
    }

    // Update the parent's childrenIds array
    await updateDoc(doc(db, "schools", schoolId, "users", parentId), {
      childrenIds: arrayUnion(childId),
    });
  } catch (error) {
    console.error("Error linking parent to child:", error);
    throw error;
  }
};

/**
 * Removes the link between a parent account and a child account.
 * This action is typically performed by an administrator.
 * @param schoolId - The ID of the school.
 * @param parentId - The ID of the parent user.
 * @param childId - The ID of the child (student) user to unlink.
 * @returns A promise that resolves when the link is successfully removed.
 * @throws Will throw an error if database operations fail.
 */
export const unlinkParentFromChild = async (
  schoolId: string,
  parentId: string,
  childId: string
): Promise<void> => {
  try {
    await updateDoc(doc(db, "schools", schoolId, "users", parentId), {
      childrenIds: arrayRemove(childId),
    });
  } catch (error) {
    console.error("Error unlinking parent from child:", error);
    throw error;
  }
};

/**
 * Retrieves all grades for a specific student, intended for viewing by a parent.
 * @param schoolId - The ID of the school.
 * @param studentId - The ID of the student whose grades are to be fetched.
 * @returns A promise that resolves to an array of `Grade` objects for the student.
 * @throws Will throw an error if database operations fail.
 */
export const getChildGrades = async (
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
      id: doc.id,
      ...(doc.data() as Grade),
    }));
  } catch (error) {
    console.error("Error getting child grades:", error);
    throw error;
  }
};

/**
 * Retrieves assignments and corresponding submissions for a specific student, intended for parental view.
 * Fetches assignments targeted at the student's class and directly to the student.
 * Then, it fetches all submissions made by the student across all assignments in the school to ensure completeness.
 * @param schoolId - The ID of the school.
 * @param studentId - The ID of the student.
 * @returns A promise that resolves to an object containing an array of `Assignment` objects
 *          and a record of `AssignmentSubmission` objects, keyed by assignment ID.
 * @throws Will throw an error if the student is not found or if database operations fail.
 */
export const getChildAssignments = async (
  schoolId: string,
  studentId: string
): Promise<{
  assignments: Assignment[];
  submissions: Record<string, AssignmentSubmission>;
}> => {
  try {
    // Get the student to get their class
    const studentDoc = await getDoc(
      doc(db, "schools", schoolId, "users", studentId)
    );
    if (!studentDoc.exists()) {
      throw new Error("Student not found");
    }

    const studentData = studentDoc.data() as Student;
    const homeroomClassId = studentData.homeroomClassId;

    // Initialize assignments array
    let assignments: Assignment[] = [];

    // First, try to get assignments for the student's class
    if (homeroomClassId) {
      const classAssignmentsCollection = collection(
        db,
        "schools",
        schoolId,
        "assignments"
      );
      const classAssignmentsQuery = query(
        classAssignmentsCollection,
        where("classIds", "array-contains", homeroomClassId)
      );
      const classAssignmentsSnapshot = await getDocs(classAssignmentsQuery);

      assignments = classAssignmentsSnapshot.docs.map((doc) => ({
        ...(doc.data() as Assignment),
        assignmentId: doc.id,
      }));
    }

    // Also get assignments assigned directly to the student
    const studentAssignmentsCollection = collection(
      db,
      "schools",
      schoolId,
      "assignments"
    );
    const studentAssignmentsQuery = query(
      studentAssignmentsCollection,
      where("studentIds", "array-contains", studentId)
    );
    const studentAssignmentsSnapshot = await getDocs(studentAssignmentsQuery);

    // Get student-specific assignments and merge with class assignments
    // avoiding duplicates by checking assignmentId
    const studentAssignments = studentAssignmentsSnapshot.docs.map((doc) => ({
      ...(doc.data() as Assignment),
      assignmentId: doc.id,
    }));

    // Merge assignments without duplicates
    const assignmentMap = new Map();
    [...assignments, ...studentAssignments].forEach((assignment) => {
      assignmentMap.set(assignment.assignmentId, assignment);
    });

    assignments = Array.from(assignmentMap.values());

    // Get ALL submissions for this student regardless of assignments
    const submissions: Record<string, AssignmentSubmission> = {};

    // Collect all assignment collections with submissions
    const assignmentsCollection = collection(
      db,
      "schools",
      schoolId,
      "assignments"
    );
    const allAssignmentsSnapshot = await getDocs(assignmentsCollection);

    // For each assignment in the school, check for submissions from this student
    const submissionPromises = allAssignmentsSnapshot.docs.map(
      async (assignmentDoc) => {
        const assignmentId = assignmentDoc.id;
        const submissionsCollection = collection(
          db,
          "schools",
          schoolId,
          "assignments",
          assignmentId,
          "submissions"
        );

        const submissionsQuery = query(
          submissionsCollection,
          where("studentId", "==", studentId)
        );

        const submissionsSnapshot = await getDocs(submissionsQuery);

        if (!submissionsSnapshot.empty) {
          const submission =
            submissionsSnapshot.docs[0].data() as AssignmentSubmission;
          submissions[assignmentId] = {
            ...submission,
            submissionId: submissionsSnapshot.docs[0].id,
          };

          // If this assignment isn't already in our assignments list, add it
          if (!assignmentMap.has(assignmentId)) {
            const assignmentData = assignmentDoc.data() as Assignment;
            const assignment = {
              ...assignmentData,
              assignmentId: assignmentId,
            };
            assignmentMap.set(assignmentId, assignment);
          }
        }
      }
    );

    await Promise.all(submissionPromises);

    // Update assignments to include any that we found submissions for
    assignments = Array.from(assignmentMap.values());

    console.log(
      `Found ${assignments.length} assignments and ${
        Object.keys(submissions).length
      } submissions for student ${studentId}`
    );

    return {
      assignments,
      submissions,
    };
  } catch (error) {
    console.error("Error getting child assignments:", error);
    throw error;
  }
};

/**
 * Retrieves assignments that a specific student has submitted, along with their submissions.
 * This function prioritizes finding submissions first and then associating them with assignment data.
 * It iterates through all assignments in the school and checks for submissions by the student.
 * @param schoolId - The ID of the school.
 * @param studentId - The ID of the student.
 * @returns A promise that resolves to an object containing an array of objects, where each object
 *          has an `assignment` (Assignment) and its corresponding `submission` (AssignmentSubmission).
 *          The results are sorted by submission date (newest first).
 * @throws Will throw an error if database operations fail.
 */
export const getChildSubmittedAssignments = async (
  schoolId: string,
  studentId: string
): Promise<{
  submittedAssignments: Array<{
    assignment: Assignment;
    submission: AssignmentSubmission;
  }>;
}> => {
  try {
    console.log(
      `Fetching submissions for student ${studentId} in school ${schoolId}`
    );

    const submittedAssignments: Array<{
      assignment: Assignment;
      submission: AssignmentSubmission;
    }> = [];

    // Get all assignments from the school
    const assignmentsCollection = collection(
      db,
      "schools",
      schoolId,
      "assignments"
    );

    // Log the path we're querying
    console.log(`Querying path: ${assignmentsCollection.path}`);

    const assignmentsSnapshot = await getDocs(assignmentsCollection);
    console.log(
      `Found ${assignmentsSnapshot.docs.length} assignments in total`
    );

    // Process each assignment to find submissions
    for (const assignmentDoc of assignmentsSnapshot.docs) {
      const assignmentId = assignmentDoc.id;
      const assignmentData = {
        ...(assignmentDoc.data() as Assignment),
        assignmentId,
      };

      // Look for submissions by this student
      const submissionsCollection = collection(
        db,
        "schools",
        schoolId,
        "assignments",
        assignmentId,
        "submissions"
      );

      // Log the submissions path we're querying
      console.log(`Checking submissions in: ${submissionsCollection.path}`);

      const submissionsQuery = query(
        submissionsCollection,
        where("studentId", "==", studentId)
      );

      const submissionsSnapshot = await getDocs(submissionsQuery);
      console.log(
        `Assignment ${assignmentId}: found ${submissionsSnapshot.docs.length} submissions`
      );

      // If the student has submitted this assignment, add it to our results
      if (!submissionsSnapshot.empty) {
        const submissionDoc = submissionsSnapshot.docs[0];
        console.log(`Found submission: ${submissionDoc.id}`);

        try {
          const submissionData = submissionDoc.data() as AssignmentSubmission;
          console.log(`Submission data:`, submissionData);

          submittedAssignments.push({
            assignment: assignmentData,
            submission: {
              ...submissionData,
              submissionId: submissionDoc.id,
            },
          });
        } catch (submissionError) {
          console.error(`Error processing submission data:`, submissionError);
        }
      }
    }

    // Sort by submission date, newest first
    submittedAssignments.sort(
      (a, b) =>
        (b.submission.submittedAt?.toMillis() || 0) -
        (a.submission.submittedAt?.toMillis() || 0)
    );

    console.log(
      `Found ${submittedAssignments.length} submitted assignments for student ${studentId}`
    );

    return { submittedAssignments };
  } catch (error) {
    console.error("Error getting student submitted assignments:", error);
    throw error;
  }
};

/**
 * Retrieves quiz results for a specific student, intended for parental view.
 * Fetches quizzes assigned to the student's class and all quiz results submitted by the student.
 * @param schoolId - The ID of the school.
 * @param studentId - The ID of the student.
 * @returns A promise that resolves to an object containing an array of `Quiz` objects relevant to the student
 *          and an array of `QuizResult` objects submitted by the student.
 * @throws Will throw an error if the student is not found or if database operations fail.
 */
export const getChildQuizResults = async (
  schoolId: string,
  studentId: string
): Promise<{
  quizzes: Quiz[];
  results: QuizResult[];
}> => {
  try {
    // Get student to get their class
    const studentDoc = await getDoc(
      doc(db, "schools", schoolId, "users", studentId)
    );
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

    const quizzes = quizzesSnapshot.docs.map((doc) => ({
      ...(doc.data() as Quiz), // Spread first
      quizId: doc.id, // Then set ID
    }));

    // Get student's quiz results
    const quizResultsCollection = collection(
      db,
      "schools",
      schoolId,
      "quizResults"
    );
    const resultsQuery = query(
      quizResultsCollection,
      where("userId", "==", studentId)
    );
    const resultsSnapshot = await getDocs(resultsQuery);

    const results = resultsSnapshot.docs.map((doc) => ({
      ...(doc.data() as QuizResult),
    }));

    return { quizzes, results };
  } catch (error) {
    console.error("Error getting child quiz results:", error);
    throw error;
  }
};

/**
 * Retrieves recorded cheating attempts for a specific student on a particular quiz.
 * Intended for parental view to understand quiz integrity issues.
 * @param schoolId - The ID of the school.
 * @param quizId - The ID of the quiz.
 * @param studentId - The ID of the student.
 * @returns A promise that resolves to an array of `CheatAttempt` objects for the student on that quiz,
 *          or an empty array if none are found.
 * @throws Will throw an error if the quiz is not found or if database operations fail.
 */
export const getChildCheatingAttempts = async (
  schoolId: string,
  quizId: string,
  studentId: string
): Promise<CheatAttempt[]> => {
  try {
    const quizDoc = await getDoc(
      doc(db, "schools", schoolId, "quizzes", quizId)
    );
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
 * Creates a new review (positive or negative feedback) for a student, typically by a teacher.
 * Verifies the student's existence and role. Sends notifications to the student and their linked parents.
 * @param schoolId - The ID of the school.
 * @param teacherId - The ID of the teacher creating the review.
 * @param teacherName - The name of the teacher creating the review.
 * @param review - An object containing review details: `studentId`, `title`, `content`, `type` (positive/negative),
 *                 `subjectId` (optional), and `subjectName` (optional).
 * @returns A promise that resolves to the ID of the newly created `StudentReview`.
 * @throws Will throw an error if the student is not found or if database/notification operations fail.
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
    const studentDoc = await getDoc(
      doc(db, "schools", schoolId, "users", review.studentId)
    );
    if (!studentDoc.exists() || studentDoc.data().role !== "student") {
      throw new Error("Student not found");
    }

    const reviewData: Omit<StudentReview, "reviewId"> = {
      ...review,
      teacherId,
      teacherName,
      date: Timestamp.now(),
      createdAt: Timestamp.now(),
    };

    const reviewsCollection = collection(
      db,
      "schools",
      schoolId,
      "studentReviews"
    );
    const docRef = await addDoc(reviewsCollection, reviewData);
    const reviewId = docRef.id;

    // Update the document with its ID
    await updateDoc(docRef, { reviewId });

    // Get student data for notification
    const student = studentDoc.data() as Student;

    // Create a notification for the student
    await createNotification(schoolId, {
      userId: review.studentId,
      title:
        review.type === "positive"
          ? "Нова положителна забележка"
          : "Нова отрицателна забележка",
      message: `Имате нова ${
        review.type === "positive" ? "положителна" : "отрицателна"
      } забележка: ${review.title}`,
      type: "student-review", // Changed from "new-grade" to a more specific type
      relatedId: reviewId,
      link: `/student/feedback`, // Direct link to student feedback page
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
        title:
          review.type === "positive"
            ? "Нова положителна забележка"
            : "Нова отрицателна забележка",
        message: `Детето ви ${student.firstName} ${student.lastName} получи ${
          review.type === "positive" ? "положителна" : "отрицателна"
        } забележка: ${review.title}`,
        type: "student-review", // Changed to specific type
        relatedId: reviewId,
        link: `/parent/feedback`, // Updated link to parent feedback page
      });
    }

    return reviewId;
  } catch (error) {
    console.error("Error creating student review:", error);
    throw error;
  }
};

/**
 * Retrieves all reviews (positive and negative feedback) for a specific student.
 * Results are ordered by date in descending order (newest first).
 * @param schoolId - The ID of the school.
 * @param studentId - The ID of the student whose reviews are to be fetched.
 * @returns A promise that resolves to an array of `StudentReview` objects.
 * @throws Will throw an error if database operations fail.
 */
export const getChildReviews = async (
  schoolId: string,
  studentId: string
): Promise<StudentReview[]> => {
  try {
    const reviewsCollection = collection(
      db,
      "schools",
      schoolId,
      "studentReviews"
    );
    const reviewsQuery = query(
      reviewsCollection,
      where("studentId", "==", studentId),
      orderBy("date", "desc")
    );
    const reviewsSnapshot = await getDocs(reviewsQuery);

    return reviewsSnapshot.docs.map((doc) => ({
      ...(doc.data() as StudentReview),
      reviewId: doc.id,
    }));
  } catch (error) {
    console.error("Error getting student reviews:", error);
    throw error;
  }
};

/**
 * Retrieves all assignment submissions made by a student by directly querying the global 'submissions' collection.
 * This method is more reliable for finding all submissions by a student, as it doesn't depend on pre-fetched
 * assignment lists or class associations. It also fetches details for assignments linked to these submissions.
 * @param schoolId - The ID of the school.
 * @param studentId - The ID of the student whose submissions are to be fetched.
 * @returns A promise that resolves to an object containing:
 *          - `submissions`: A record of `AssignmentSubmission` objects, keyed by assignment ID.
 *          - `assignmentDetails`: A record of `Assignment` objects, keyed by assignment ID, for context.
 * @throws Will throw an error if database operations fail.
 */
export const getSubmissionsByStudent = async (
  schoolId: string,
  studentId: string
): Promise<{
  submissions: Record<string, AssignmentSubmission>;
  assignmentDetails: Record<string, Assignment>;
}> => {
  try {
    const submissions: Record<string, AssignmentSubmission> = {};
    const assignmentDetails: Record<string, Assignment> = {};

    // Get all assignments from the school
    const assignmentsCollection = collection(
      db,
      "schools",
      schoolId,
      "assignments"
    );
    const assignmentsSnapshot = await getDocs(assignmentsCollection);

    // Store all assignments for reference
    assignmentsSnapshot.docs.forEach((doc) => {
      const assignmentId = doc.id;
      const assignmentData = doc.data() as Assignment;
      assignmentDetails[assignmentId] = {
        ...assignmentData,
        assignmentId,
      };
    });

    // Query the submissions collection directly instead of checking subcollections
    const submissionsCollection = collection(
      db,
      "schools",
      schoolId,
      "submissions"
    );

    const submissionsQuery = query(
      submissionsCollection,
      where("studentId", "==", studentId)
    );

    const submissionsSnapshot = await getDocs(submissionsQuery);
    console.log(
      `Found ${submissionsSnapshot.docs.length} submissions for student ${studentId}`
    );

    // Process each submission
    submissionsSnapshot.docs.forEach((submissionDoc) => {
      const submissionData = submissionDoc.data() as AssignmentSubmission;
      const assignmentId = submissionData.assignmentId || "";

      if (assignmentId) {
        submissions[assignmentId] = {
          ...submissionData,
          submissionId: submissionDoc.id,
        };
      }
    });

    // If we found a submission for an assignment that wasn't in our assignmentDetails,
    // we should try to fetch that assignment specifically
    const missingAssignmentIds = Object.keys(submissions).filter(
      (assignmentId) => !assignmentDetails[assignmentId]
    );

    if (missingAssignmentIds.length > 0) {
      console.log(
        `Found ${missingAssignmentIds.length} submissions with missing assignments. Fetching those assignments...`
      );

      for (const assignmentId of missingAssignmentIds) {
        try {
          const assignmentDoc = await getDoc(
            doc(db, "schools", schoolId, "assignments", assignmentId)
          );

          if (assignmentDoc.exists()) {
            const assignmentData = assignmentDoc.data() as Assignment;
            assignmentDetails[assignmentId] = {
              ...assignmentData,
              assignmentId,
            };
          }
        } catch (assignmentError) {
          console.error(
            `Error fetching assignment ${assignmentId}:`,
            assignmentError
          );
        }
      }
    }

    console.log(
      `Direct search found ${
        Object.keys(submissions).length
      } submissions for student ${studentId}`
    );

    return {
      submissions,
      assignmentDetails,
    };
  } catch (error) {
    console.error("Error getting student submissions:", error);
    throw error;
  }
};

/**
 * Retrieves all assignment submissions made by a student, ensuring each submission includes its `assignmentId`.
 * This function directly queries the 'submissions' collection for the specified student.
 * It's designed to be a definitive way to get all submissions for a student.
 * @param schoolId - The ID of the school.
 * @param studentId - The ID of the student whose submissions are to be fetched.
 * @returns A promise that resolves to an array of `AssignmentSubmission` objects, each augmented with its `assignmentId`.
 * @throws Will throw an error if database operations fail.
 */
export const getAllStudentSubmissions = async (
  schoolId: string,
  studentId: string
): Promise<Array<AssignmentSubmission & { assignmentId: string }>> => {
  try {
    console.log(
      `Getting all submissions for student ${studentId} in school ${schoolId}`
    );

    // Query the submissions collection directly
    const submissionsCollection = collection(
      db,
      "schools",
      schoolId,
      "submissions"
    );

    // Query for submissions by this student
    const submissionsQuery = query(
      submissionsCollection,
      where("studentId", "==", studentId)
    );

    const submissionsSnapshot = await getDocs(submissionsQuery);
    console.log(`Found ${submissionsSnapshot.docs.length} submissions total`);

    // Array to store all submissions
    const allSubmissions: Array<
      AssignmentSubmission & { assignmentId: string }
    > = [];

    // Process each submission
    for (const submissionDoc of submissionsSnapshot.docs) {
      const submissionData = submissionDoc.data() as AssignmentSubmission;
      const assignmentId = submissionData.assignmentId || ""; // Make sure assignmentId exists

      // Add it to our results
      allSubmissions.push({
        ...submissionData,
        submissionId: submissionDoc.id,
        assignmentId, // Include the assignment ID
      });
    }

    console.log(
      `Successfully processed ${allSubmissions.length} total submissions`
    );
    return allSubmissions;
  } catch (error) {
    console.error("Error getting student submissions:", error);
    throw error;
  }
};
