"use client";

import type React from "react";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  getSubmissions,
  getStudentSubmission,
  submitAssignment,
  updateAssignment,
  gradeSubmission,
  deleteAssignment,
  createAssignment,
  getAssignment,
} from "@/lib/management/assignmentManagement";
import type {
  Assignment,
  AssignmentSubmission,
  AssignmentFeedback,
} from "@/lib/interfaces";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import {
  Timestamp,
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  onSnapshot,
  or,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// Define the AssignmentContextType with all available operations
type AssignmentContextType = {
  // Assignments state
  assignments: Assignment[];
  activeAssignments: Assignment[];
  pastAssignments: Assignment[];
  loading: boolean;
  submissionsLoading: boolean;
  error: string | null;

  // Selected assignment state
  selectedAssignment: Assignment | null;
  selectedSubmission: AssignmentSubmission | null;
  submissions: AssignmentSubmission[];

  // Filter and classification
  classesMap: { [key: string]: string };

  // State setters and actions
  setSelectedAssignment: (assignment: Assignment | null) => void;
  setSelectedSubmission: (submission: AssignmentSubmission | null) => void;

  // CRUD operations
  fetchAssignments: () => Promise<void>;
  fetchAssignmentById: (assignmentId: string) => Promise<Assignment | null>;
  fetchSubmissions: (assignmentId: string) => Promise<AssignmentSubmission[]>;
  fetchStudentSubmission: (
    assignmentId: string,
    studentId: string
  ) => Promise<AssignmentSubmission | null>;
  createNewAssignment: (
    assignmentData: Omit<Assignment, "assignmentId" | "createdAt" | "status">
  ) => Promise<string>;
  updateExistingAssignment: (
    assignmentId: string,
    updates: Partial<Assignment>
  ) => Promise<void>;
  deleteExistingAssignment: (assignmentId: string) => Promise<void>;
  submitStudentAssignment: (
    assignmentId: string,
    content: string,
    isResubmission?: boolean
  ) => Promise<AssignmentSubmission | null>;
  gradeStudentSubmission: (
    submissionId: string,
    feedback: string,
    grade: number
  ) => Promise<void>;

  // Helper functions
  getAssignmentDeadlineStatus: (
    assignment: Assignment
  ) => "upcoming" | "due-soon" | "overdue" | "submitted" | "graded";
  checkAllStudentsSubmitted: (assignment: Assignment) => Promise<boolean>;
  canSubmit: (assignment: Assignment) => boolean;
  canResubmit: (
    assignment: Assignment,
    submission?: AssignmentSubmission
  ) => boolean;
  refreshAssignments: () => Promise<void>;
};

// Create the context with default values
const AssignmentContext = createContext<AssignmentContextType>({
  // Default states
  assignments: [],
  activeAssignments: [],
  pastAssignments: [],
  loading: false,
  submissionsLoading: false,
  error: null,

  selectedAssignment: null,
  selectedSubmission: null,
  submissions: [],

  classesMap: {},

  // Default setters (no-op functions)
  setSelectedAssignment: () => {},
  setSelectedSubmission: () => {},

  // Default async operations (returning promises that resolve to default values)
  fetchAssignments: async () => {},
  fetchAssignmentById: async () => null,
  fetchSubmissions: async () => [],
  fetchStudentSubmission: async () => null,
  createNewAssignment: async () => "",
  updateExistingAssignment: async () => {},
  deleteExistingAssignment: async () => {},
  submitStudentAssignment: async () => null,
  gradeStudentSubmission: async () => {},

  // Default helper functions
  getAssignmentDeadlineStatus: () => "upcoming",
  checkAllStudentsSubmitted: async () => false,
  canSubmit: () => false,
  canResubmit: () => false,
  refreshAssignments: async () => {},
});

// Export the hook for easy usage
export const useAssignments = () => useContext(AssignmentContext);

// Create the provider component
export const AssignmentProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useUser();
  const { toast } = useToast();

  // State for assignments and loading status
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [activeAssignments, setActiveAssignments] = useState<Assignment[]>([]);
  const [pastAssignments, setPastAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected assignment state
  const [selectedAssignment, setSelectedAssignment] =
    useState<Assignment | null>(null);
  const [selectedSubmission, setSelectedSubmission] =
    useState<AssignmentSubmission | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);

  // Map of classIds to class names
  const [classesMap, setClassesMap] = useState<{ [key: string]: string }>({});

  // Reference to keep track of active listeners
  const assignmentsUnsubscribeRef = useRef<(() => void) | null>(null);
  const submissionsUnsubscribeRef = useRef<(() => void) | null>(null);

  // Load classes data (for resolving class names from ids)
  useEffect(() => {
    const fetchClasses = async () => {
      if (!user?.schoolId) return;

      try {
        const classesCollection = collection(
          db,
          "schools",
          user.schoolId,
          "classes"
        );
        const classesSnapshot = await getDocs(classesCollection);
        const classesMapData: { [key: string]: string } = {};

        classesSnapshot.docs.forEach((doc) => {
          classesMapData[doc.id] = doc.data().className;
        });

        setClassesMap(classesMapData);
      } catch (err) {
        console.error("Error fetching classes:", err);
      }
    };

    fetchClasses();
  }, [user]);

  // Categorize assignments into active and past
  const categorizeAssignments = useCallback(
    (fetchedAssignments: Assignment[]) => {
      const now = new Date();
      const active: Assignment[] = [];
      const past: Assignment[] = [];

      // Categorize assignments
      for (const assignment of fetchedAssignments) {
        const dueDate = new Date(assignment.dueDate.seconds * 1000);

        if (dueDate < now) {
          past.push(assignment);
        } else {
          active.push(assignment);
        }
      }

      // Sort by due date (most recent first for past, closest deadline first for active)
      active.sort((a, b) => a.dueDate.seconds - b.dueDate.seconds);
      past.sort((a, b) => b.dueDate.seconds - a.dueDate.seconds);

      setActiveAssignments(active);
      setPastAssignments(past);
    },
    []
  );

  // Set up real-time listener for assignments
  useEffect(() => {
    if (!user?.schoolId) {
      setLoading(false);
      return;
    }

    // Clean up any existing listener
    if (assignmentsUnsubscribeRef.current) {
      assignmentsUnsubscribeRef.current();
      assignmentsUnsubscribeRef.current = null;
    }

    setLoading(true);
    setError(null);

    let assignmentsQuery;

    // Different query creation based on user role
    if (user.role === "teacher" && user.userId) {
      assignmentsQuery = query(
        collection(db, "schools", user.schoolId, "assignments"),
        where("teacherId", "==", user.userId)
      );
    } else if (user.role === "student" && user.userId) {
      // For students, we need to find assignments either directly assigned to them
      // or assigned to their class
      if (user.homeroomClassId) {
        assignmentsQuery = query(
          collection(db, "schools", user.schoolId, "assignments"),
          or(
            where("studentIds", "array-contains", user.userId),
            where("classIds", "array-contains", user.homeroomClassId)
          )
        );
      } else {
        // Fallback if no homeroom class is set
        assignmentsQuery = query(
          collection(db, "schools", user.schoolId, "assignments"),
          where("studentIds", "array-contains", user.userId)
        );
      }
    } else if (user.role === "admin") {
      // For admins, get all assignments
      assignmentsQuery = collection(
        db,
        "schools",
        user.schoolId,
        "assignments"
      );
    } else if (
      user.role === "parent" &&
      user.childrenIds &&
      user.childrenIds.length > 0
    ) {
      // For parents, get assignments for their children
      // Note: This is simplified and might need adjustment based on your data model
      const childId = user.childrenIds[0]; // Just using the first child for simplicity
      if (childId) {
        const childDoc = doc(db, "schools", user.schoolId, "users", childId);
        getDoc(childDoc)
          .then((snapshot) => {
            if (snapshot.exists()) {
              const childData = snapshot.data();
              const homeroomClassId = childData.homeroomClassId;

              if (homeroomClassId) {
                const q = query(
                  collection(db, "schools", user.schoolId, "assignments"),
                  or(
                    where("studentIds", "array-contains", childId),
                    where("classIds", "array-contains", homeroomClassId)
                  )
                );

                setupAssignmentsListener(q);
              } else {
                const q = query(
                  collection(db, "schools", user.schoolId, "assignments"),
                  where("studentIds", "array-contains", childId)
                );

                setupAssignmentsListener(q);
              }
            }
          })
          .catch((err) => {
            console.error("Error fetching child data:", err);
            setLoading(false);
          });

        return; // Exit early since we're setting up the listener asynchronously
      }
    }

    if (assignmentsQuery) {
      setupAssignmentsListener(assignmentsQuery);
    } else {
      setLoading(false);
    }

    function setupAssignmentsListener(query) {
      // Set up the real-time listener
      const unsubscribe = onSnapshot(
        query,
        (snapshot) => {
          const assignmentsData = snapshot.docs.map((doc) => ({
            ...doc.data(),
            assignmentId: doc.id,
          })) as Assignment[];

          setAssignments(assignmentsData);
          categorizeAssignments(assignmentsData);
          setError(null);
          setLoading(false);
        },
        (err) => {
          console.error("Error in assignments snapshot listener:", err);
          setError("Failed to load assignments. Please try again.");
          toast({
            title: "Грешка",
            description:
              "Неуспешно зареждане на задания. Моля, опитайте отново.",
            variant: "destructive",
          });
          setLoading(false);
        }
      );

      // Store the unsubscribe function
      assignmentsUnsubscribeRef.current = unsubscribe;
    }

    // Clean up the listener when the component unmounts or dependencies change
    return () => {
      if (assignmentsUnsubscribeRef.current) {
        assignmentsUnsubscribeRef.current();
        assignmentsUnsubscribeRef.current = null;
      }
    };
  }, [user, toast, categorizeAssignments]);

  // Fetch a single assignment by ID
  const fetchAssignmentById = useCallback(
    async (assignmentId: string): Promise<Assignment | null> => {
      if (!user?.schoolId) return null;

      try {
        const assignment = await getAssignment(user.schoolId, assignmentId);
        return assignment;
      } catch (err) {
        console.error("Error fetching assignment details:", err);
        toast({
          title: "Грешка",
          description: "Неуспешно зареждане на детайли за заданието",
          variant: "destructive",
        });
        return null;
      }
    },
    [user, toast]
  );

  // Fetch submissions for an assignment with real-time updates
  const fetchSubmissions = useCallback(
    async (assignmentId: string): Promise<AssignmentSubmission[]> => {
      if (!user?.schoolId) return [];

      try {
        setSubmissionsLoading(true);
        console.log("Fetching submissions for assignment:", assignmentId);

        // Always clean up any existing submissions listener
        if (submissionsUnsubscribeRef.current) {
          submissionsUnsubscribeRef.current();
          submissionsUnsubscribeRef.current = null;
        }

        // Create a query for all submissions for this assignment
        const submissionsQuery = query(
          collection(db, "schools", user.schoolId, "submissions"),
          where("assignmentId", "==", assignmentId)
        );

        // Set up real-time listener for submissions
        const unsubscribe = onSnapshot(
          submissionsQuery,
          (snapshot) => {
            const submissionsData = snapshot.docs.map((doc) => ({
              ...doc.data(),
              submissionId: doc.id,
            })) as AssignmentSubmission[];

            console.log(
              `Received ${submissionsData.length} submissions for assignment:`,
              assignmentId
            );
            setSubmissions(submissionsData);
            setSubmissionsLoading(false);

            // If we're a student, find our submission
            if (user.role === "student" && user.userId) {
              const studentSubmission = submissionsData.find(
                (sub) => sub.studentId === user.userId
              );
              if (studentSubmission) {
                setSelectedSubmission(studentSubmission);
              }
            }
          },
          (err) => {
            console.error("Error in submissions snapshot listener:", err);
            toast({
              title: "Грешка",
              description: "Неуспешно зареждане на предадени задания",
              variant: "destructive",
            });
            setSubmissionsLoading(false);
          }
        );

        // Store the unsubscribe function
        submissionsUnsubscribeRef.current = unsubscribe;

        // Initially return an empty array since the real data will come from the listener
        return [];
      } catch (err) {
        console.error("Error setting up submissions listener:", err);
        toast({
          title: "Грешка",
          description: "Неуспешно зареждане на предадени задания",
          variant: "destructive",
        });
        setSubmissionsLoading(false);
        return [];
      }
    },
    [user, toast]
  );

  // Fetch a specific student's submission - uses real-time listener if possible
  const fetchStudentSubmission = useCallback(
    async (
      assignmentId: string,
      studentId: string
    ): Promise<AssignmentSubmission | null> => {
      if (!user?.schoolId) return null;

      // Check if we already have the submissions loaded
      if (submissions.length > 0) {
        const existing = submissions.find(
          (sub) =>
            sub.assignmentId === assignmentId && sub.studentId === studentId
        );
        if (existing) return existing;
      }

      try {
        const submission = await getStudentSubmission(
          user.schoolId,
          assignmentId,
          studentId
        );

        // If this is the current user, update selectedSubmission
        if (user.role === "student" && user.userId === studentId) {
          setSelectedSubmission(submission);
        }

        return submission;
      } catch (err) {
        console.error("Error fetching student submission:", err);
        return null;
      }
    },
    [user, submissions]
  );

  // Create a new assignment
  const createNewAssignment = useCallback(
    async (
      assignmentData: Omit<Assignment, "assignmentId" | "createdAt" | "status">
    ): Promise<string> => {
      if (!user?.schoolId) {
        toast({
          title: "Грешка",
          description: "Изисква се удостоверяване",
          variant: "destructive",
        });
        return "";
      }

      try {
        const assignmentId = await createAssignment(
          user.schoolId,
          assignmentData
        );

        // No need to refresh assignments list - real-time listener will handle it

        toast({
          title: "Успешно",
          description: "Заданието е създадено успешно",
        });

        return assignmentId;
      } catch (err) {
        console.error("Error creating assignment:", err);
        toast({
          title: "Грешка",
          description: "Неуспешно създаване на задание",
          variant: "destructive",
        });
        return "";
      }
    },
    [user, toast]
  );

  // Update an existing assignment
  const updateExistingAssignment = useCallback(
    async (
      assignmentId: string,
      updates: Partial<Assignment>
    ): Promise<void> => {
      if (!user?.schoolId) return;

      try {
        await updateAssignment(user.schoolId, assignmentId, updates);

        // The real-time listener will handle updating the assignments list

        // Still update the selected assignment if it's the one being edited for immediate UI update
        if (selectedAssignment?.assignmentId === assignmentId) {
          setSelectedAssignment((prev) =>
            prev ? { ...prev, ...updates } : null
          );
        }

        toast({
          title: "Успешно",
          description: "Заданието е актуализирано успешно",
        });
      } catch (err) {
        console.error("Error updating assignment:", err);
        toast({
          title: "Грешка",
          description: "Неуспешно актуализиране на задание",
          variant: "destructive",
        });
      }
    },
    [user, toast, selectedAssignment]
  );

  // Delete an assignment
  const deleteExistingAssignment = useCallback(
    async (assignmentId: string): Promise<void> => {
      if (!user?.schoolId) return;

      try {
        await deleteAssignment(user.schoolId, assignmentId);

        // The real-time listener will handle updating the assignments list

        // Still clear selected assignment if it's the one being deleted for immediate UI update
        if (selectedAssignment?.assignmentId === assignmentId) {
          setSelectedAssignment(null);
        }

        toast({
          title: "Успешно",
          description: "Заданието е изтрито успешно",
        });
      } catch (err) {
        console.error("Error deleting assignment:", err);
        toast({
          title: "Грешка",
          description: "Неуспешно изтриване на задание",
          variant: "destructive",
        });
      }
    },
    [user, toast, selectedAssignment]
  );

  // Submit a student assignment
  const submitStudentAssignment = useCallback(
    async (
      assignmentId: string,
      content: string,
      isResubmission = false
    ): Promise<AssignmentSubmission | null> => {
      if (!user?.schoolId || !user?.userId) {
        toast({
          title: "Грешка",
          description: "Изисква се удостоверяване",
          variant: "destructive",
        });
        return null;
      }

      try {
        // Ensure all required fields are defined before passing to submitAssignment
        const submissionData = {
          assignmentId: assignmentId,
          studentId: user.userId,
          studentName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
          content: content,
          submittedAt: Timestamp.now(),
          status: isResubmission
            ? ("resubmitted" as const)
            : ("submitted" as const),
        };

        await submitAssignment(user.schoolId, submissionData);

        // The real-time listener will update the submissions

        toast({
          title: "Успешно",
          description: "Заданието е предадено успешно",
        });

        // Return null since the real-time listener will update the state
        return null;
      } catch (err) {
        console.error("Error submitting assignment:", err);
        toast({
          title: "Грешка",
          description: "Неуспешно предаване на задание",
          variant: "destructive",
        });
        return null;
      }
    },
    [user, toast]
  );

  // Grade a student submission
  const gradeStudentSubmission = useCallback(
    async (
      submissionId: string,
      feedback: string,
      grade: number
    ): Promise<void> => {
      if (!user?.schoolId || !user?.userId) return;

      try {
        if (isNaN(grade) || grade < 2 || grade > 6) {
          toast({
            title: "Грешка",
            description: "Моля, въведете валидна оценка между 2 и 6",
            variant: "destructive",
          });
          return;
        }

        const feedbackData: AssignmentFeedback = {
          teacherId: user.userId,
          comment: feedback,
          grade,
          gradedAt: Timestamp.now(),
        };

        await gradeSubmission(user.schoolId, submissionId, feedbackData);

        // The real-time listener will update submissions automatically

        toast({
          title: "Успешно",
          description: "Заданието е оценено успешно",
        });
      } catch (err) {
        console.error("Error grading submission:", err);
        toast({
          title: "Грешка",
          description: "Неуспешно оценяване на заданието",
          variant: "destructive",
        });
      }
    },
    [user, toast]
  );

  // Check if all students have submitted an assignment
  const checkAllStudentsSubmitted = useCallback(
    async (assignment: Assignment): Promise<boolean> => {
      if (!user?.schoolId) return false;

      try {
        const submissions = await getSubmissions(
          user.schoolId,
          assignment.assignmentId
        );

        // Create a set of student IDs who need to submit
        const targetStudentIds = new Set<string>();

        // Add student IDs from direct assignments
        if (assignment.studentIds && assignment.studentIds.length > 0) {
          assignment.studentIds.forEach((id) => targetStudentIds.add(id));
        }
        // Add student IDs from assigned classes
        else if (assignment.classIds && assignment.classIds.length > 0) {
          for (const classId of assignment.classIds) {
            const classDoc = await getDoc(
              doc(db, "schools", user.schoolId, "classes", classId)
            );
            if (classDoc.exists() && classDoc.data().studentIds) {
              classDoc
                .data()
                .studentIds.forEach((id: string) => targetStudentIds.add(id));
            }
          }
        }

        // If no target students, return true
        if (targetStudentIds.size === 0) return true;

        // Get the set of students who have submitted
        const submittedStudentIds = new Set(
          submissions.map((sub) => sub.studentId)
        );

        // Check if all target students have submitted
        for (const studentId of targetStudentIds) {
          if (!submittedStudentIds.has(studentId)) {
            return false;
          }
        }

        return true;
      } catch (err) {
        console.error("Error checking submissions:", err);
        return false;
      }
    },
    [user]
  );

  // Determine assignment status
  const getAssignmentDeadlineStatus = useCallback(
    (
      assignment: Assignment
    ): "upcoming" | "due-soon" | "overdue" | "submitted" | "graded" => {
      if (!assignment) return "upcoming";

      const now = new Date();
      const dueDate = new Date(assignment.dueDate.seconds * 1000);

      // Check if this is for the current user (as student) and they've submitted
      if (user?.role === "student" && selectedSubmission) {
        return selectedSubmission.status === "graded" ? "graded" : "submitted";
      }

      // Past due date
      if (dueDate < now) {
        return "overdue";
      }

      // Due soon (within 24 hours)
      if (dueDate.getTime() - now.getTime() < 24 * 60 * 60 * 1000) {
        return "due-soon";
      }

      // Default: upcoming
      return "upcoming";
    },
    [user, selectedSubmission]
  );

  // Check if a student can submit an assignment
  const canSubmit = useCallback((assignment: Assignment): boolean => {
    if (!assignment) return false;

    const now = new Date();
    const dueDate = new Date(assignment.dueDate.seconds * 1000);

    // If not past due date, can always submit
    if (now <= dueDate) return true;

    // If past due date, check if late submissions allowed
    return assignment.allowLateSubmission;
  }, []);

  // Check if a student can resubmit an assignment
  const canResubmit = useCallback(
    (assignment: Assignment, submission?: AssignmentSubmission): boolean => {
      if (!assignment || !submission) return false;

      // If resubmission not allowed or already graded, cannot resubmit
      if (!assignment.allowResubmission || submission.status === "graded") {
        return false;
      }

      const now = new Date();
      const dueDate = new Date(assignment.dueDate.seconds * 1000);

      // If not past due date, can always resubmit
      if (now <= dueDate) return true;

      // If past due date, check if late submissions allowed
      return assignment.allowLateSubmission;
    },
    []
  );

  // Legacy fetchAssignments function for backwards compatibility
  const fetchAssignments = useCallback(async () => {
    // Now this only triggers a refresh of the real-time listener
    if (assignmentsUnsubscribeRef.current) {
      assignmentsUnsubscribeRef.current();
      assignmentsUnsubscribeRef.current = null;
    }
    setLoading(true);
    // The useEffect will re-establish the connection
  }, []);

  // Refresh assignments with the latest data (now just an alias for fetchAssignments)
  const refreshAssignments = useCallback(async () => {
    await fetchAssignments();
  }, [fetchAssignments]);

  // Clean up listeners when component is unmounted
  useEffect(() => {
    return () => {
      if (assignmentsUnsubscribeRef.current) {
        assignmentsUnsubscribeRef.current();
      }
      if (submissionsUnsubscribeRef.current) {
        submissionsUnsubscribeRef.current();
      }
    };
  }, []);

  // Combine all values and functions into context value
  const contextValue: AssignmentContextType = {
    assignments,
    activeAssignments,
    pastAssignments,
    loading,
    submissionsLoading,
    error,
    selectedAssignment,
    selectedSubmission,
    submissions,
    classesMap,

    setSelectedAssignment,
    setSelectedSubmission,
    fetchAssignments,
    fetchAssignmentById,
    fetchSubmissions,
    fetchStudentSubmission,
    createNewAssignment,
    updateExistingAssignment,
    deleteExistingAssignment,
    submitStudentAssignment,
    gradeStudentSubmission,
    getAssignmentDeadlineStatus,
    checkAllStudentsSubmitted,
    canSubmit,
    canResubmit,
    refreshAssignments,
  };

  return (
    <AssignmentContext.Provider value={contextValue}>
      {children}
    </AssignmentContext.Provider>
  );
};
