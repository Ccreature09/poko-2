"use client";

import type React from "react";
import { createContext, useContext, useEffect, useState, useRef } from "react";
import {
  collection,
  getDocs,
  query,
  doc,
  updateDoc,
  arrayUnion,
  setDoc,
  where,
  onSnapshot,
  getDoc,
  serverTimestamp,
  deleteField,
  deleteDoc,
  runTransaction,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  Quiz,
  CheatAttempt,
  QuizResult,
  LiveQuizSession,
  LiveStudentSession,
} from "@/lib/interfaces";
import { useUser } from "@/contexts/UserContext";
import { Timestamp } from "firebase/firestore";
import { translateCheatDescription } from "@/lib/cheatTranslations";

type QuizContextType = {
  quizzes: Quiz[];
  loading: boolean;
  error: string | null;
  // Core quiz functions
  recordCheatAttempt: (
    quizId: string,
    attemptData: Omit<CheatAttempt, "timestamp" | "studentId">
  ) => Promise<void>;
  submitQuizResult: (
    quizResult: Omit<QuizResult, "timestamp" | "completed">
  ) => Promise<void>;
  startQuiz: (quizId: string) => Promise<void>;
  saveQuizProgress: (
    quizId: string,
    answers: Record<string, string | string[]>,
    currentQuestion: number
  ) => Promise<void>;
  isQuizAvailable: (quiz: Quiz) => boolean;
  getRemainingAttempts: (quiz: Quiz) => Promise<number>;
  // Live monitoring functions
  liveQuizzes: Record<string, LiveQuizSession>;
  monitorQuiz: (quizId: string) => Promise<void>;
  stopMonitoring: (quizId: string) => void;
  liveQuizResults: Record<string, QuizResult[]>;
};

const QuizContext = createContext<QuizContextType>({
  quizzes: [],
  loading: false,
  error: null,
  recordCheatAttempt: async () => {},
  submitQuizResult: async () => {},
  startQuiz: async () => {},
  saveQuizProgress: async () => {},
  isQuizAvailable: () => false,
  getRemainingAttempts: async () => 0,
  liveQuizzes: {},
  monitorQuiz: async () => {},
  stopMonitoring: () => {},
  liveQuizResults: {},
});

export const useQuiz = () => useContext(QuizContext);

export const QuizProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useUser();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveQuizzes, setLiveQuizzes] = useState<
    Record<string, LiveQuizSession>
  >({});
  const [liveQuizResults, setLiveQuizResults] = useState<
    Record<string, QuizResult[]>
  >({});

  // Store active monitoring unsubscribe functions
  const [monitoringUnsubscribe, setMonitoringUnsubscribe] = useState<
    Record<string, () => void>
  >({});

  // Create refs for tracking in-progress operations
  const quizStartsInProgressRef = useRef<Record<string, boolean>>({});
  const [saveInProgress, setSaveInProgress] = useState<Record<string, boolean>>(
    {}
  );
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Create a session key to prevent duplicate loads
  const sessionKeysRef = useRef<Record<string, string>>({});

  // Fetch quizzes when the user context changes
  useEffect(() => {
    const fetchQuizzes = async () => {
      console.debug("[QuizContext] 🔄 Starting fetchQuizzes");
      console.debug("[QuizContext] Current user state:", { user });

      setLoading(true);
      setError(null);

      if (!user || !user.schoolId) {
        console.debug("[QuizContext] No user or schoolId, skipping quiz fetch");
        setLoading(false);
        return;
      }

      try {
        console.debug(
          "[QuizContext] 🔍 Fetching quizzes for school:",
          user.schoolId
        );
        let q;

        // If user is a teacher, only fetch their quizzes
        if (user.role === "teacher") {
          console.debug(
            `[QuizContext] Fetching quizzes created by teacher: ${user.userId}`
          );
          q = query(
            collection(db, "schools", user.schoolId, "quizzes"),
            where("teacherId", "==", user.userId)
          );
        } else {
          // For admins or other roles, fetch all quizzes
          q = query(collection(db, "schools", user.schoolId, "quizzes"));
        }

        const quizzesSnapshot = await getDocs(q);
        const quizzesList = quizzesSnapshot.docs.map(
          (doc) => ({ ...(doc.data() as object), quizId: doc.id } as Quiz)
        );
        console.debug(
          `[QuizContext] 📦 Raw quizzes fetched:`,
          quizzesList.length
        );

        // Apply quiz availability filtering logic based on student role
        if (user.role === "student") {
          // Only show quizzes that are available for the student's classes
          const studentAvailableQuizzes = quizzesList.filter((quiz) => {
            const isAvailableForClass = quiz.classIds?.includes(
              user.homeroomClassId || ""
            );
            const isTimeAvailable = isQuizAvailable(quiz);
            console.debug(`[QuizContext] Quiz ${quiz.quizId} availability:`, {
              isAvailableForClass,
              isTimeAvailable,
              classIds: quiz.classIds,
              studentClass: user.homeroomClassId,
            });
            return isAvailableForClass && isTimeAvailable;
          });
          setQuizzes(studentAvailableQuizzes);
          console.debug(
            `[QuizContext] 📊 Filtered to ${studentAvailableQuizzes.length} quizzes for student`
          );
        } else {
          // Teachers see only their quizzes, admins see all quizzes
          setQuizzes(quizzesList);
          console.debug(
            `[QuizContext] 📊 ${quizzesList.length} quizzes loaded for ${user.role}`
          );
        }
      } catch (err) {
        console.error("[QuizContext] ❌ Failed to fetch quizzes:", err);
        setError("Failed to fetch quizzes");
      } finally {
        setLoading(false);
        console.debug("[QuizContext] ✅ fetchQuizzes completed");
      }
    };

    fetchQuizzes();
  }, [user]);

  // Updated to check only if user has already taken the quiz
  const isQuizAvailable = (quiz: Quiz): boolean => {
    const now = Timestamp.now();

    // Check availability window
    if (quiz.availableFrom && now.toMillis() < quiz.availableFrom.toMillis())
      return false;
    if (quiz.availableTo && now.toMillis() > quiz.availableTo.toMillis())
      return false;

    // For availability check, we only care about time window, not whether user took it
    return true;
  };

  // Simplified to return 0 if taken, 1 if not taken - only one attempt allowed
  const getRemainingAttempts = async (quiz: Quiz): Promise<number> => {
    if (!user) {
      console.debug(
        "[QuizContext] getRemainingAttempts: No user found, returning 0"
      );
      return 0;
    }

    try {
      console.debug(
        `[QuizContext] getRemainingAttempts: Checking if quiz ${quiz.quizId} has been taken`
      );

      // First check if user already took this quiz (via tookTest array)
      const hasTakenQuiz =
        quiz.tookTest && user.userId && quiz.tookTest.includes(user.userId);
      console.debug(
        `[QuizContext] getRemainingAttempts: User has taken quiz (tookTest): ${hasTakenQuiz}`
      );

      if (hasTakenQuiz) {
        return 0; // No attempts remaining
      }

      // If not recorded in tookTest, check for completed quiz results
      const completedResultsQuery = query(
        collection(db, "schools", user.schoolId, "quizResults"),
        where("quizId", "==", quiz.quizId),
        where("userId", "==", user.userId),
        where("completed", "==", true)
      );

      const completedSnapshot = await getDocs(completedResultsQuery);
      if (completedSnapshot.size > 0) {
        console.debug(
          `[QuizContext] getRemainingAttempts: User has completed quiz results: ${completedSnapshot.size}`
        );
        return 0; // No attempts remaining
      }

      // Also check for abandoned incomplete attempts
      const abandonedQuery = query(
        collection(db, "schools", user.schoolId, "quizResults"),
        where("quizId", "==", quiz.quizId),
        where("userId", "==", user.userId),
        where("abandoned", "==", true)
      );

      const abandonedSnapshot = await getDocs(abandonedQuery);
      if (abandonedSnapshot.size > 0) {
        console.debug(
          `[QuizContext] getRemainingAttempts: User has abandoned quiz: ${abandonedSnapshot.size}`
        );
        return 0; // No attempts remaining if quiz was abandoned
      }

      // Finally, check if there's an ongoing attempt that isn't abandoned
      const ongoingQuery = query(
        collection(db, "schools", user.schoolId, "quizResults"),
        where("quizId", "==", quiz.quizId),
        where("userId", "==", user.userId),
        where("completed", "==", false),
        where("abandoned", "!=", true)
      );

      const ongoingSnapshot = await getDocs(ongoingQuery);
      if (ongoingSnapshot.size > 0) {
        console.debug(
          `[QuizContext] getRemainingAttempts: User has ongoing quiz: ${ongoingSnapshot.size}`
        );
        return 1; // There is an ongoing attempt, allow access
      }

      // Return 1 if user hasn't taken the quiz, 0 if they have
      return 1; // No completed, abandoned, or ongoing attempts found
    } catch (err) {
      console.error("[QuizContext] getRemainingAttempts error:", err);
      return 0;
    }
  };

  // Start a new quiz attempt or resume an existing one
  const startQuiz = async (quizId: string): Promise<void> => {
    if (!user || !user.schoolId) {
      console.debug("[QuizContext] Cannot start quiz - no user or schoolId");
      return;
    }

    // If this quiz is already being started, prevent duplicate execution
    if (quizStartsInProgressRef.current[quizId]) {
      console.debug(
        "[QuizContext] Quiz start already in progress, skipping..."
      );
      return;
    }

    // Set flag to prevent concurrent operations
    quizStartsInProgressRef.current[quizId] = true;

    try {
      const userId = user.userId;
      const schoolId = user.schoolId;

      // Generate a unique session key
      const sessionKey = Math.random().toString(36).substring(7);
      sessionKeysRef.current[quizId] = sessionKey;

      console.debug(
        `[QuizContext] Starting quiz ${quizId} with session key ${sessionKey}`
      );

      // Use a transaction to ensure we don't create duplicate documents
      await runTransaction(db, async (transaction) => {
        // Check for existing attempts first
        const ongoingQuery = query(
          collection(db, "schools", schoolId, "quizResults"),
          where("quizId", "==", quizId),
          where("userId", "==", userId),
          where("completed", "==", false),
          // Add a limit to ensure we only get one result
          limit(1)
        );

        const ongoingSnapshot = await getDocs(ongoingQuery);

        // If there's an ongoing attempt, just update the quiz's active status
        if (!ongoingSnapshot.empty) {
          console.debug(
            `[QuizContext] Found ongoing attempt for quiz ${quizId}, updating active status`
          );
          const quizRef = doc(db, "schools", schoolId, "quizzes", quizId);
          transaction.update(quizRef, {
            activeUsers: arrayUnion(userId),
            inProgress: true,
            lastActiveTimestamp: serverTimestamp(), // Update the timestamp
          });
          return;
        }

        // No ongoing attempt found, check quiz data and remaining attempts
        const quizDoc = await transaction.get(
          doc(db, "schools", schoolId, "quizzes", quizId)
        );

        if (!quizDoc.exists()) {
          console.error(`[QuizContext] Quiz ${quizId} not found`);
          throw new Error("Quiz not found");
        }

        const quizData = { ...quizDoc.data(), quizId } as Quiz;

        // Check remaining attempts using both the tookTest array and completed attempts
        const tookTestCount = (quizData.tookTest || []).filter(
          (id) => id === userId
        ).length;
        console.debug(
          `[QuizContext] Quiz ${quizId} check: ${tookTestCount} attempts in tookTest array`
        );

        // Get completed attempts from results collection
        const completedSnapshot = await getDocs(
          query(
            collection(db, "schools", schoolId, "quizResults"),
            where("quizId", "==", quizId),
            where("userId", "==", userId),
            where("completed", "==", true)
          )
        );

        const completedCount = completedSnapshot.size;
        console.debug(
          `[QuizContext] Quiz ${quizId} check: ${completedCount} completed attempts in quizResults`
        );

        // Use the maximum count between the two sources
        const attemptCount = Math.max(tookTestCount, completedCount);
        console.debug(
          `[QuizContext] Quiz ${quizId} check: using maximum of ${attemptCount} attempts`
        );

        // Check if the user still has attempts left
        if (attemptCount >= (quizData.maxAttempts || 1)) {
          console.debug(
            `[QuizContext] No attempts remaining for quiz ${quizId}`
          );
          throw new Error("No attempts remaining for this quiz");
        }

        // Create a new quiz result document
        const quizResultRef = doc(
          collection(db, "schools", schoolId, "quizResults")
        );
        const studentName = user.firstName + " " + user.lastName;

        // Ensure userId is not undefined
        if (!userId) {
          throw new Error("User ID is required to start a quiz");
        }

        const initialQuizResult: Omit<QuizResult, "timestamp"> = {
          quizId,
          userId,
          answers: {},
          score: 0,
          totalPoints: 0,
          completed: false,
          startedAt: Timestamp.now(),
          studentName,
        };

        console.debug(`[QuizContext] Creating new quiz result for ${quizId}`);

        // Set the new document and update the quiz in the same transaction
        transaction.set(quizResultRef, {
          ...initialQuizResult,
          timestamp: serverTimestamp(),
        });

        transaction.update(quizDoc.ref, {
          activeUsers: arrayUnion(userId),
          inProgress: true,
          lastActiveTimestamp: serverTimestamp(), // Add this line to update the timestamp for new attempts
        });

        console.debug(`[QuizContext] Quiz ${quizId} successfully started`);
      });
    } catch (err) {
      console.error("[QuizContext] Error starting quiz:", err);
      // Clean up session key on error
      delete sessionKeysRef.current[quizId];
      throw err;
    } finally {
      // Add a slight delay before clearing the in-progress flag to prevent race conditions
      setTimeout(() => {
        delete quizStartsInProgressRef.current[quizId];
        console.debug(
          `[QuizContext] Quiz start in-progress flag cleared for ${quizId}`
        );
      }, 1000);
    }
  };

  // Save quiz progress periodically (without submitting)
  const saveQuizProgress = async (
    quizId: string,
    answers: Record<string, string | string[]>,
    currentQuestion: number
  ): Promise<void> => {
    if (!user || !user.schoolId) return;

    // If a save is already in progress for this quiz, cancel it and wait
    if (saveInProgress[quizId]) {
      if (saveTimeoutRef.current[quizId]) {
        clearTimeout(saveTimeoutRef.current[quizId]);
      }

      // Set a timeout to try again in 1 second
      saveTimeoutRef.current[quizId] = setTimeout(() => {
        saveQuizProgress(quizId, answers, currentQuestion);
      }, 1000);

      return;
    }

    try {
      setSaveInProgress((prev) => ({ ...prev, [quizId]: true }));

      // Find the ongoing quiz attempt
      const ongoingQuery = query(
        collection(db, "schools", user.schoolId, "quizResults"),
        where("quizId", "==", quizId),
        where("userId", "==", user.userId),
        where("completed", "==", false)
      );

      const ongoingSnapshot = await getDocs(ongoingQuery);

      // If there are multiple incomplete attempts, merge them first
      if (ongoingSnapshot.size > 1) {
        console.log(
          `Found ${ongoingSnapshot.size} incomplete attempts, merging before save...`
        );

        // Use the first document as our target
        const targetDoc = ongoingSnapshot.docs[0].ref;

        // Merge all data
        const mergedData = ongoingSnapshot.docs.reduce((merged, current) => {
          const data = current.data() as QuizResult;
          return {
            ...merged,
            answers: { ...(merged.answers || {}), ...(data.answers || {}) },
            questionTimeSpent: {
              ...(merged.questionTimeSpent || {}),
              ...(data.questionTimeSpent || {}),
            },
          };
        }, {} as Partial<QuizResult>);

        // Delete extra documents
        const deletePromises = ongoingSnapshot.docs
          .slice(1)
          .map((doc) => deleteDoc(doc.ref));

        await Promise.all(deletePromises);

        // Update the target document with merged data and new changes
        await updateDoc(targetDoc, {
          answers: { ...mergedData.answers, ...answers },
          questionTimeSpent: { ...mergedData.questionTimeSpent },
          timestamp: serverTimestamp(),
          questionProgress: currentQuestion,
        });

        // Update the quiz's lastActiveTimestamp
        const quizRef = doc(db, "schools", user.schoolId, "quizzes", quizId);
        await updateDoc(quizRef, {
          lastActiveTimestamp: serverTimestamp(),
        });
      } else if (ongoingSnapshot.size === 1) {
        // Normal case - just update the single document
        const resultDoc = ongoingSnapshot.docs[0].ref;
        await updateDoc(resultDoc, {
          answers,
          timestamp: serverTimestamp(),
          questionProgress: currentQuestion,
        });

        // Update the quiz's lastActiveTimestamp
        const quizRef = doc(db, "schools", user.schoolId, "quizzes", quizId);
        await updateDoc(quizRef, {
          lastActiveTimestamp: serverTimestamp(),
        });
      } else {
        console.error("No ongoing quiz attempt found to save progress");
      }
    } catch (err) {
      console.error("Error saving quiz progress:", err);
    } finally {
      setSaveInProgress((prev) => {
        const updated = { ...prev };
        delete updated[quizId];
        return updated;
      });
    }
  };

  // Record a cheating attempt
  const recordCheatAttempt = async (
    quizId: string,
    attemptData: Omit<CheatAttempt, "timestamp" | "studentId">
  ): Promise<void> => {
    if (!user || !user.schoolId) {
      console.debug(
        "[QuizContext] Cannot record cheat attempt - no user or schoolId"
      );
      return;
    }

    try {
      console.debug(
        `[QuizContext] Recording cheat attempt for quiz ${quizId}, type: ${attemptData.type}`
      );

      // Translate the description from English to Bulgarian
      const translatedDescription = translateCheatDescription(
        attemptData.description
      );

      const cheatAttempt: CheatAttempt = {
        ...attemptData,
        // Replace with translated description
        description: translatedDescription,
        timestamp: Timestamp.now(),
        quizId,
        studentId: user.userId,
      };

      // Create a new document in the quizCheatingAttempts collection
      const cheatingAttemptsRef = collection(
        db,
        "schools",
        user.schoolId,
        "quizCheatingAttempts"
      );
      await setDoc(doc(cheatingAttemptsRef), cheatAttempt);

      // Update cheating attempts in the quiz document
      const quizRef = doc(db, "schools", user.schoolId, "quizzes", quizId);
      await runTransaction(db, async (transaction) => {
        const quizDoc = await transaction.get(quizRef);
        if (!quizDoc.exists()) {
          console.error(
            `[QuizContext] Quiz ${quizId} not found when updating cheating attempts`
          );
          return;
        }

        const quizData = quizDoc.data() as Quiz;
        const currentCheatingAttempts = quizData.cheatingAttempts || {};

        // Update or initialize the cheating attempts for this student
        const studentId = user.userId || "";
        const updatedCheatingAttempts = {
          ...currentCheatingAttempts,
          [studentId]: [
            ...(currentCheatingAttempts[studentId] || []),
            cheatAttempt,
          ],
        };

        transaction.update(quizRef, {
          cheatingAttempts: updatedCheatingAttempts,
        });

        console.debug(
          `[QuizContext] Updated cheatingAttempts in quiz document for ${quizId}`
        );
      });

      console.debug("[QuizContext] Cheat attempt recorded successfully");
    } catch (err) {
      console.error("[QuizContext] Error recording cheat attempt:", err);
    }
  };

  // Submit quiz result
  const submitQuizResult = async (
    quizResult: Omit<QuizResult, "timestamp" | "completed">
  ): Promise<void> => {
    if (!user || !user.schoolId) {
      console.debug("[QuizContext] Cannot submit quiz - no user or schoolId");
      return;
    }

    try {
      console.debug(
        `[QuizContext] Submitting quiz result for quiz ${quizResult.quizId}`
      );

      // First, check for any existing completed attempts for this quiz
      const existingCompletedQuery = query(
        collection(db, "schools", user.schoolId, "quizResults"),
        where("quizId", "==", quizResult.quizId),
        where("userId", "==", user.userId),
        where("completed", "==", true)
      );

      const existingCompleted = await getDocs(existingCompletedQuery);
      if (existingCompleted.size > 0) {
        console.debug(
          "[QuizContext] Found existing completed result, skipping submission"
        );
        return;
      }

      // Then, find any incomplete attempts
      const incompleteQuery = query(
        collection(db, "schools", user.schoolId, "quizResults"),
        where("quizId", "==", quizResult.quizId),
        where("userId", "==", user.userId),
        where("completed", "==", false)
      );

      const incompleteSnapshot = await getDocs(incompleteQuery);

      let resultDoc;

      if (incompleteSnapshot.docs.length > 0) {
        // Use the first incomplete attempt as our target document
        resultDoc = incompleteSnapshot.docs[0].ref;

        // If there are multiple incomplete attempts, merge them and delete extras
        if (incompleteSnapshot.docs.length > 1) {
          console.log(
            `Found ${incompleteSnapshot.docs.length} incomplete attempts, merging...`
          );

          // Merge all incomplete attempts
          const mergedResult = incompleteSnapshot.docs.reduce(
            (merged, current) => {
              const data = current.data() as QuizResult;
              // Create temporary variables with explicit empty objects for undefined properties
              const mergedAnswers = merged.answers || {};
              const dataAnswers = data.answers || {};
              const mergedTimeSpent = merged.questionTimeSpent || {};
              const dataTimeSpent = data.questionTimeSpent || {};

              return {
                ...merged,
                answers: { ...mergedAnswers, ...dataAnswers },
                questionTimeSpent: { ...mergedTimeSpent, ...dataTimeSpent },
                totalTimeSpent: Math.max(
                  merged.totalTimeSpent || 0,
                  data.totalTimeSpent || 0
                ),
                securityViolations: Math.max(
                  merged.securityViolations || 0,
                  data.securityViolations || 0
                ),
              };
            },
            {} as Partial<QuizResult>
          );

          // Delete extra incomplete attempts
          const deletePromises = incompleteSnapshot.docs
            .slice(1)
            .map((doc) => deleteDoc(doc.ref));

          await Promise.all(deletePromises);

          // Update the final result with merged data
          quizResult = {
            ...quizResult,
            answers: {
              ...(mergedResult.answers || {}),
              ...(quizResult.answers || {}),
            },
            questionTimeSpent: {
              ...(mergedResult.questionTimeSpent || {}),
              ...(quizResult.questionTimeSpent || {}),
            },
            totalTimeSpent: Math.max(
              mergedResult.totalTimeSpent || 0,
              quizResult.totalTimeSpent || 0
            ),
            securityViolations: Math.max(
              mergedResult.securityViolations || 0,
              quizResult.securityViolations || 0
            ),
          };
        }
      } else {
        // No incomplete attempts found, check one more time for completed results
        // This is a final safety check in case a race condition occurred
        const finalCheckCompleted = await getDocs(existingCompletedQuery);
        if (finalCheckCompleted.size > 0) {
          console.debug(
            "[QuizContext] Found completed result in final check, skipping submission"
          );
          return;
        }

        // Create a new document only if we're sure there are no existing results
        resultDoc = doc(
          collection(db, "schools", user.schoolId, "quizResults")
        );
      }

      // Save the final quiz result
      await setDoc(
        resultDoc,
        {
          ...quizResult,
          completed: true,
          timestamp: serverTimestamp(),
        },
        { merge: true }
      );

      // Update the quiz with the user's completion
      const quizRef = doc(
        db,
        "schools",
        user.schoolId,
        "quizzes",
        quizResult.quizId
      );
      await updateDoc(quizRef, {
        tookTest: arrayUnion(user.userId),
      });

      // Clean up active status
      const quizDoc = await getDoc(quizRef);
      if (quizDoc.exists()) {
        const quizData = quizDoc.data() as Quiz;
        const updatedActiveUsers = (quizData.activeUsers || []).filter(
          (id: string) => id !== user.userId
        );

        // Update with filtered array or remove field if empty
        if (updatedActiveUsers.length > 0) {
          await updateDoc(quizRef, {
            activeUsers: updatedActiveUsers,
          });
        } else {
          await updateDoc(quizRef, {
            activeUsers: deleteField(),
            inProgress: false,
          });
        }
      }

      console.debug("[QuizContext] Quiz submitted successfully");
    } catch (err) {
      console.error("[QuizContext] Error submitting quiz result:", err);
      throw err; // Re-throw for the component to handle
    }
  };

  // Monitor a quiz in progress (for teachers)
  const monitorQuiz = async (quizId: string): Promise<void> => {
    if (!user || !user.schoolId || user.role !== "teacher") return;

    try {
      // If already monitoring this quiz, stop first
      if (monitoringUnsubscribe[quizId]) {
        stopMonitoring(quizId);
      }

      // Fetch initial quiz data first
      const quizRef = doc(db, "schools", user.schoolId, "quizzes", quizId);
      const quizDoc = await getDoc(quizRef);

      if (!quizDoc.exists()) {
        throw new Error("Quiz not found");
      }

      const quizData = quizDoc.data() as Quiz;

      // Create an entry for the live quiz session
      const liveSession: LiveQuizSession = {
        quizId,
        activeStudents: [],
        startedAt: quizData.createdAt || Timestamp.now(),
      };

      setLiveQuizzes((prev) => ({
        ...prev,
        [quizId]: liveSession,
      }));

      // Set up listeners for quiz results - both completed and in-progress
      const resultsQuery = query(
        collection(db, "schools", user.schoolId, "quizResults"),
        where("quizId", "==", quizId)
      );

      // Set up a listener for cheating attempts
      const cheatingQuery = query(
        collection(db, "schools", user.schoolId, "quizCheatingAttempts"),
        where("quizId", "==", quizId)
      );

      // Set up a real-time listener for quiz results
      const resultsUnsubscribe = onSnapshot(resultsQuery, (snapshot) => {
        const results = snapshot.docs.map((doc) => ({
          ...(doc.data() as QuizResult),
          id: doc.id,
        }));

        // Update live quiz results
        setLiveQuizResults((prev) => ({
          ...prev,
          [quizId]: results,
        }));

        // Only track students who haven't completed the quiz yet
        const activeStudents: LiveStudentSession[] = results
          .filter((result) => result.completed === false)
          .map((result) => ({
            studentId: result.userId,
            studentName: result.studentName || "Unknown Student",
            startedAt: result.startedAt || Timestamp.now(),
            lastActive: result.timestamp || Timestamp.now(),
            questionProgress: result.questionProgress || 0,
            questionsAnswered: Object.keys(result.answers || {}).length,
            cheatingAttempts: [], // We'll update this from the cheatingAttempts collection
            status: "active",
          }));

        // Update the live quiz session with active students
        setLiveQuizzes((prev) => ({
          ...prev,
          [quizId]: {
            ...prev[quizId],
            activeStudents,
          },
        }));
      });

      // Set up a real-time listener for cheating attempts
      const cheatingUnsubscribe = onSnapshot(cheatingQuery, (snapshot) => {
        // Group cheating attempts by student ID
        const cheatingAttemptsByStudent: Record<string, CheatAttempt[]> = {};

        snapshot.docs.forEach((doc) => {
          const attempt = doc.data() as CheatAttempt;
          if (attempt.studentId) {
            if (!cheatingAttemptsByStudent[attempt.studentId]) {
              cheatingAttemptsByStudent[attempt.studentId] = [];
            }
            cheatingAttemptsByStudent[attempt.studentId].push(attempt);
          }
        });

        // Update the live quiz session with cheating attempts
        setLiveQuizzes((prev) => {
          if (!prev[quizId]) return prev; // Guard against undefined session

          const updatedActiveStudents = [
            ...(prev[quizId]?.activeStudents || []),
          ];

          // Update each student with their cheating attempts
          Object.entries(cheatingAttemptsByStudent).forEach(
            ([studentId, attempts]) => {
              const studentIndex = updatedActiveStudents.findIndex(
                (s) => s.studentId === studentId
              );

              if (studentIndex >= 0) {
                // Update existing student record
                updatedActiveStudents[studentIndex] = {
                  ...updatedActiveStudents[studentIndex],
                  cheatingAttempts: attempts,
                  status: attempts.length > 2 ? "suspected_cheating" : "active",
                };
              } else if (attempts.length > 0) {
                // Look up student in quiz results
                const studentResult = liveQuizResults[quizId]?.find(
                  (r) => r.userId === studentId
                );

                if (studentResult && !studentResult.completed) {
                  // Add the student if not in the active list but has a result
                  updatedActiveStudents.push({
                    studentId,
                    studentName: studentResult.studentName || "Unknown Student",
                    startedAt: studentResult.startedAt || attempts[0].timestamp,
                    lastActive:
                      studentResult.timestamp ||
                      attempts[attempts.length - 1].timestamp,
                    questionProgress: Object.keys(studentResult.answers || {})
                      .length,
                    questionsAnswered: Object.keys(studentResult.answers || {})
                      .length,
                    cheatingAttempts: attempts,
                    status: "suspected_cheating",
                  });
                }
              }
            }
          );

          return {
            ...prev,
            [quizId]: {
              ...prev[quizId],
              activeStudents: updatedActiveStudents,
            },
          };
        });
      });

      // Combine all unsubscribe functions
      const combinedUnsubscribe = () => {
        resultsUnsubscribe();
        cheatingUnsubscribe();
      };

      // Store the unsubscribe function
      setMonitoringUnsubscribe((prev) => ({
        ...prev,
        [quizId]: combinedUnsubscribe,
      }));

      console.log(`Now monitoring quiz: ${quizId}`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      console.error("Error setting up quiz monitoring:", err);
      setError(`Failed to monitor quiz: ${errorMessage}`);
      throw err; // Re-throw to allow handling in the component
    }
  };

  // Stop monitoring a quiz
  const stopMonitoring = (quizId: string): void => {
    if (monitoringUnsubscribe[quizId]) {
      monitoringUnsubscribe[quizId]();
      console.log(`Stopped monitoring quiz: ${quizId}`);

      // Remove the unsubscribe function
      setMonitoringUnsubscribe((prev) => {
        const updated = { ...prev };
        delete updated[quizId];
        return updated;
      });

      // Remove from live quizzes
      setLiveQuizzes((prev) => {
        const updated = { ...prev };
        delete updated[quizId];
        return updated;
      });

      // Remove from live quiz results
      setLiveQuizResults((prev) => {
        const updated = { ...prev };
        delete updated[quizId];
        return updated;
      });
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Clean up all monitoring subscriptions
      Object.values(monitoringUnsubscribe).forEach((unsubscribe) => {
        unsubscribe();
      });
    };
  }, []);

  return (
    <QuizContext.Provider
      value={{
        quizzes,
        loading,
        error,
        recordCheatAttempt,
        submitQuizResult,
        startQuiz,
        saveQuizProgress,
        isQuizAvailable,
        getRemainingAttempts,
        liveQuizzes,
        monitorQuiz,
        stopMonitoring,
        liveQuizResults,
      }}
    >
      {children}
    </QuizContext.Provider>
  );
};
