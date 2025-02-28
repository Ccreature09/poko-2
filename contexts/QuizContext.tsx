"use client";

import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
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
  deleteDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { 
  Quiz, 
  CheatAttempt, 
  QuizResult, 
  LiveQuizSession, 
  LiveStudentSession 
} from "@/lib/interfaces";
import { useUser } from "@/contexts/UserContext";
import { Timestamp } from "firebase/firestore";

type QuizContextType = {
  quizzes: Quiz[];
  loading: boolean;
  error: string | null;
  // Core quiz functions
  recordCheatAttempt: (quizId: string, attemptData: Omit<CheatAttempt, 'timestamp' | 'studentId'>) => Promise<void>;
  submitQuizResult: (quizResult: Omit<QuizResult, 'timestamp' | 'completed'>) => Promise<void>;
  startQuiz: (quizId: string) => Promise<void>;
  saveQuizProgress: (quizId: string, answers: Record<string, string | string[]>, currentQuestion: number) => Promise<void>;
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
  liveQuizResults: {}
});

export const useQuiz = () => useContext(QuizContext);

export const QuizProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useUser();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveQuizzes, setLiveQuizzes] = useState<Record<string, LiveQuizSession>>({});
  const [liveQuizResults, setLiveQuizResults] = useState<Record<string, QuizResult[]>>({});

  // Store active monitoring unsubscribe functions
  const [monitoringUnsubscribe, setMonitoringUnsubscribe] = useState<Record<string, () => void>>({});

  // Fetch quizzes when the user context changes
  useEffect(() => {
    const fetchQuizzes = async () => {
      setLoading(true);
      setError(null);
      if (!user || !user.schoolId) return;

      try {
        const q = query(
          collection(db, "schools", user.schoolId, "quizzes"),
        );
        const quizzesSnapshot = await getDocs(q);
        const quizzesList = quizzesSnapshot.docs.map(
          (doc) => ({ ...doc.data(), quizId: doc.id } as Quiz)
        );

        // Apply quiz availability filtering logic based on student role
        if (user.role === 'student') {
          // Only show quizzes that are available for the student's classes
          const availableQuizzes = quizzesList.filter(quiz => 
            quiz.classIds.includes(user.homeroomClassId || '') && 
            isQuizAvailable(quiz)
          );
          setQuizzes(availableQuizzes);
        } else {
          // Teachers and admins see all quizzes
          setQuizzes(quizzesList);
        }
      } catch (err) {
        console.error("Failed to fetch quizzes:", err);
        setError("Failed to fetch quizzes");
      } finally {
        setLoading(false);
      }
    };

    fetchQuizzes();
  }, [user]);

  // Check if a quiz is available based on time constraints
  const isQuizAvailable = (quiz: Quiz): boolean => {
    const now = Timestamp.now();

    // Check availability window
    if (quiz.availableFrom && now.toMillis() < quiz.availableFrom.toMillis()) return false;
    if (quiz.availableTo && now.toMillis() > quiz.availableTo.toMillis()) return false;

    return true;
  };

  // Get remaining attempts for a student
  const getRemainingAttempts = async (quiz: Quiz): Promise<number> => {
    if (!user) return 0;

    // Get number of attempts used
    try {
      const attemptCount = await getQuizAttemptsForUser(quiz.quizId);
      return Math.max(0, (quiz.maxAttempts || 1) - attemptCount);
    } catch (err) {
      console.error("Error getting remaining attempts:", err);
      return 0;
    }
  };

  // Get the number of times a user has attempted a quiz
  const getQuizAttemptsForUser = async (quizId: string): Promise<number> => {
    if (!user || !user.schoolId) return 0;

    try {
      const resultsQuery = query(
        collection(db, "schools", user.schoolId, "quizResults"),
        where("quizId", "==", quizId),
        where("userId", "==", user.userId),
        where("completed", "==", true)
      );

      const resultsSnapshot = await getDocs(resultsQuery);
      return resultsSnapshot.docs.length;
    } catch (err) {
      console.error("Error getting quiz attempts:", err);
      return 0;
    }
  };

  // Start a new quiz attempt or resume an existing one
  const startQuiz = async (quizId: string): Promise<void> => {
    if (!user || !user.schoolId) return;

    try {
      // First check if there's an ongoing attempt
      const ongoingQuery = query(
        collection(db, "schools", user.schoolId, "quizResults"),
        where("quizId", "==", quizId),
        where("userId", "==", user.userId),
        where("completed", "==", false)
      );

      const ongoingSnapshot = await getDocs(ongoingQuery);

      // If there's an ongoing attempt, return (we'll continue that session)
      if (!ongoingSnapshot.empty) {
        console.log("Resuming existing quiz attempt");

        // Ensure the quiz is marked as in progress even when resuming
        const quizRef = doc(db, "schools", user.schoolId, "quizzes", quizId);
        await updateDoc(quizRef, {
          activeUsers: arrayUnion(user.userId),
          inProgress: true
        });

        return;
      }

      // Before creating a new attempt, check if the user still has attempts left
      const remainingAttempts = await getRemainingAttempts({ quizId } as Quiz);
      if (remainingAttempts <= 0) {
        throw new Error("No attempts remaining for this quiz");
      }

      // Create a new quiz result document with empty answers
      const quizResultRef = doc(collection(db, "schools", user.schoolId, "quizResults"));

      // Get student name for easier reference in monitoring
      let studentName = user.firstName + " " + user.lastName;

      const initialQuizResult: Omit<QuizResult, "timestamp"> = {
        quizId,
        userId: user.userId,
        answers: {},
        score: 0,
        totalPoints: 0,
        completed: false,
        startedAt: Timestamp.now(),
        studentName
      };

      await setDoc(quizResultRef, {
        ...initialQuizResult,
        timestamp: serverTimestamp()
      });

      // Update the quiz document to add this user to activeUsers and set inProgress
      const quizRef = doc(db, "schools", user.schoolId, "quizzes", quizId);
      await updateDoc(quizRef, {
        activeUsers: arrayUnion(user.userId),
        inProgress: true
      });

      // Reload the quizzes list to reflect the change in inProgress status
      const q = query(collection(db, "schools", user.schoolId, "quizzes"));
      const quizzesSnapshot = await getDocs(q);
      const quizzesList = quizzesSnapshot.docs.map(
        (doc) => ({ ...doc.data(), quizId: doc.id } as Quiz)
      );

      // Apply quiz availability filtering logic based on student role
      if (user.role === 'student') {
        // Only show quizzes that are available for the student's classes
        const availableQuizzes = quizzesList.filter(quiz => 
          quiz.classIds.includes(user.homeroomClassId || '') && 
          isQuizAvailable(quiz)
        );
        setQuizzes(availableQuizzes);
      } else {
        // Teachers and admins see all quizzes
        setQuizzes(quizzesList);
      }

    } catch (err) {
      console.error("Error starting quiz:", err);
      throw err;
    }
  };

  // Save quiz progress periodically (without submitting)
  const saveQuizProgress = async (
    quizId: string, 
    answers: Record<string, string | string[]>,
    currentQuestion: number
  ): Promise<void> => {
    if (!user || !user.schoolId) return;

    try {
      // Find the ongoing quiz attempt
      const ongoingQuery = query(
        collection(db, "schools", user.schoolId, "quizResults"),
        where("quizId", "==", quizId),
        where("userId", "==", user.userId),
        where("completed", "==", false)
      );

      const ongoingSnapshot = await getDocs(ongoingQuery);

      if (ongoingSnapshot.empty) {
        console.error("No ongoing quiz attempt found to save progress");
        return;
      }

      // Update the quiz result document
      const resultDoc = ongoingSnapshot.docs[0].ref;
      await updateDoc(resultDoc, {
        answers,
        timestamp: serverTimestamp(),
        // Track the current question for progress monitoring
        questionProgress: currentQuestion
      });

    } catch (err) {
      console.error("Error saving quiz progress:", err);
    }
  };

  // Record a cheating attempt
  const recordCheatAttempt = async (
    quizId: string, 
    attemptData: Omit<CheatAttempt, 'timestamp' | 'studentId'>
  ): Promise<void> => {
    if (!user || !user.schoolId) return;

    try {
      const quizRef = doc(db, "schools", user.schoolId, "quizzes", quizId);

      const cheatAttempt: CheatAttempt = {
        ...attemptData,
        timestamp: Timestamp.now(),
        quizId,
        studentId: user.userId
      };

      // Add the cheat attempt to the quiz document
      await updateDoc(quizRef, {
        [`cheatingAttempts.${user.userId}`]: arrayUnion(cheatAttempt)
      });

    } catch (err) {
      console.error("Error recording cheat attempt:", err);
    }
  };

  // Submit quiz result
  const submitQuizResult = async (quizResult: Omit<QuizResult, 'timestamp' | 'completed'>): Promise<void> => {
    if (!user || !user.schoolId) return;

    try {
      // Check for any existing results for this quiz/user combination
      const existingQuery = query(
        collection(db, "schools", user.schoolId, "quizResults"),
        where("quizId", "==", quizResult.quizId),
        where("userId", "==", user.userId)
      );

      const existingSnapshot = await getDocs(existingQuery);

      if (existingSnapshot.docs.length > 0) {
        // Find the document with the highest score
        const existingResults = existingSnapshot.docs.map(doc => ({
          ...doc.data() as QuizResult,
          id: doc.id
        }));

        const highestScoringResult = existingResults.reduce((highest, current) => 
          ((current.score || 0) > (highest.score || 0)) ? current : highest, existingResults[0]);

        // Use the highest scoring result's document as our target
        const targetDoc = doc(db, "schools", user.schoolId, "quizResults", highestScoringResult.id);

        // Merge fields from all documents to ensure we keep all important data
        const mergedResult = existingResults.reduce((merged, current) => ({
          ...merged,
          // Preserve highest score
          score: Math.max(merged.score || 0, current.score || 0),
          // Keep most complete answer set
          answers: {
            ...(merged.answers || {}),
            ...(current.answers || {})
          },
          // Merge time spent data
          questionTimeSpent: {
            ...(merged.questionTimeSpent || {}),
            ...(current.questionTimeSpent || {})
          },
          // Take maximum for these values
          totalTimeSpent: Math.max(merged.totalTimeSpent || 0, current.totalTimeSpent || 0),
          securityViolations: Math.max(merged.securityViolations || 0, current.securityViolations || 0)
        }), {} as Partial<QuizResult>);

        // Add the new submission data, prioritizing higher scores
        const finalResult: Omit<QuizResult, 'timestamp'> = {
          ...quizResult,
          score: Math.max(mergedResult.score || 0, quizResult.score || 0),
          answers: { ...mergedResult.answers || {}, ...quizResult.answers },
          questionTimeSpent: { ...mergedResult.questionTimeSpent || {}, ...quizResult.questionTimeSpent },
          securityViolations: Math.max(mergedResult.securityViolations || 0, quizResult.securityViolations || 0),
          totalTimeSpent: quizResult.totalTimeSpent || mergedResult.totalTimeSpent || 0,
          completed: true
        };

        // Update the target document with merged data
        await setDoc(targetDoc, {
          ...finalResult,
          timestamp: serverTimestamp()
        }, { merge: true });

        console.log("Updated existing quiz result with merged data");

        // Delete all other documents
        if (existingResults.length > 1) {
          console.log(`Deleting ${existingResults.length - 1} duplicate results`);
          const deletePromises = existingResults
            .filter(result => result.id !== highestScoringResult.id)
            .map(result => {
              const duplicateDoc = doc(db, "schools", user.schoolId, "quizResults", result.id);
              return deleteDoc(duplicateDoc);
            });

          await Promise.all(deletePromises);
        }
      } else {
        // No existing documents, create a new one
        const resultDoc = doc(collection(db, "schools", user.schoolId, "quizResults"));
        console.log("Creating new quiz result document");

        // Complete the quiz result
        const resultWithTimestamp: Omit<QuizResult, 'timestamp'> = {
          ...quizResult,
          completed: true
        };

        // Save the quiz result
        await setDoc(resultDoc, {
          ...resultWithTimestamp,
          timestamp: serverTimestamp()
        });
      }

      // Update the quiz with the user's completion
      const quizRef = doc(db, "schools", user.schoolId, "quizzes", quizResult.quizId);
      await updateDoc(quizRef, {
        tookTest: arrayUnion(user.userId),
      });

      // Clean up active status
      const quizDoc = await getDoc(quizRef);
      if (quizDoc.exists()) {
        const quizData = quizDoc.data() as Quiz;
        const updatedActiveUsers = (quizData.activeUsers || []).filter(id => id !== user.userId);

        // Update with filtered array or remove field if empty
        if (updatedActiveUsers.length > 0) {
          await updateDoc(quizRef, {
            activeUsers: updatedActiveUsers
          });
        } else {
          await updateDoc(quizRef, {
            activeUsers: deleteField(),
            inProgress: false
          });
        }
      }

    } catch (err) {
      console.error("Error submitting quiz result:", err);
      throw err; // Re-throw for the component to handle
    }
  };

  // Monitor a quiz in progress (for teachers)
  const monitorQuiz = async (quizId: string): Promise<void> => {
    if (!user || !user.schoolId || user.role !== 'teacher') return;

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
        startedAt: quizData.createdAt || Timestamp.now()
      };

      setLiveQuizzes(prev => ({
        ...prev,
        [quizId]: liveSession
      }));

      // Set up listeners for quiz results - both completed and in-progress
      const resultsQuery = query(
        collection(db, "schools", user.schoolId, "quizResults"),
        where("quizId", "==", quizId)
      );

      // Set up a real-time listener for quiz results
      const unsubscribe = onSnapshot(resultsQuery, (snapshot) => {
        const results = snapshot.docs.map(doc => ({
          ...(doc.data() as QuizResult),
          id: doc.id
        }));

        // Update live quiz results
        setLiveQuizResults(prev => ({
          ...prev,
          [quizId]: results
        }));

        // Only track students who haven't completed the quiz yet
        const activeStudents: LiveStudentSession[] = results
          .filter(result => result.completed === false)
          .map(result => ({
            studentId: result.userId,
            studentName: result.studentName || 'Unknown Student',
            startedAt: result.startedAt || Timestamp.now(),
            lastActive: result.timestamp || Timestamp.now(),
            questionProgress: Object.keys(result.answers || {}).length,
            questionsAnswered: Object.keys(result.answers || {}).length,
            cheatingAttempts: [], // We'll update this from the quiz document
            status: "active"
          }));

        // Handle cheating attempts from the quiz document
        if (quizDoc.exists()) {
          const quizData = quizDoc.data() as Quiz;
          const cheatingAttempts = quizData.cheatingAttempts || {};

          // Update cheating attempts for each student in the active session
          activeStudents.forEach((student, index) => {
            const studentAttempts = cheatingAttempts[student.studentId] || [];
            if (studentAttempts.length > 0) {
              activeStudents[index] = {
                ...student,
                cheatingAttempts: studentAttempts,
                status: studentAttempts.length > 2 ? "suspected_cheating" : "active"
              };
            }
          });
        }

        // Update the live quiz session
        setLiveQuizzes(prev => ({
          ...prev,
          [quizId]: {
            ...prev[quizId],
            activeStudents
          }
        }));
      });

      // Also listen for cheating attempts directly from the quiz document
      const quizUnsubscribe = onSnapshot(quizRef, (snapshot) => {
        if (!snapshot.exists()) return;

        const quizData = snapshot.data() as Quiz;
        const cheatingAttempts = quizData.cheatingAttempts || {};

        // Update the live quiz results with cheating attempts
        setLiveQuizzes(prev => {
          if (!prev[quizId]) return prev; // Guard against undefined session

          const updatedActiveStudents = [...(prev[quizId]?.activeStudents || [])];

          // Update each student with their cheating attempts
          Object.entries(cheatingAttempts).forEach(([studentId, attempts]) => {
            const studentIndex = updatedActiveStudents.findIndex(s => s.studentId === studentId);

            if (studentIndex >= 0) {
              // Update existing student record
              updatedActiveStudents[studentIndex] = {
                ...updatedActiveStudents[studentIndex],
                cheatingAttempts: attempts,
                status: attempts.length > 2 ? "suspected_cheating" : "active"
              };
            } else if (attempts.length > 0) {
              // Look up student in quiz results
              const studentResult = liveQuizResults[quizId]?.find(r => r.userId === studentId);

              if (studentResult && !studentResult.completed) {
                // Add the student if not in the active list but has a result
                updatedActiveStudents.push({
                  studentId,
                  studentName: studentResult.studentName || 'Unknown Student',
                  startedAt: studentResult.startedAt || attempts[0].timestamp,
                  lastActive: studentResult.timestamp || attempts[attempts.length - 1].timestamp,
                  questionProgress: Object.keys(studentResult.answers || {}).length,
                  questionsAnswered: Object.keys(studentResult.answers || {}).length,
                  cheatingAttempts: attempts,
                  status: "suspected_cheating"
                });
              }
            }
          });

          return {
            ...prev,
            [quizId]: {
              ...prev[quizId],
              activeStudents: updatedActiveStudents
            }
          };
        });
      });

      // Combine both unsubscribe functions
      const combinedUnsubscribe = () => {
        unsubscribe();
        quizUnsubscribe();
      };

      // Store the unsubscribe function
      setMonitoringUnsubscribe(prev => ({
        ...prev,
        [quizId]: combinedUnsubscribe
      }));

      console.log(`Now monitoring quiz: ${quizId}`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
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
      setMonitoringUnsubscribe(prev => {
        const updated = { ...prev };
        delete updated[quizId];
        return updated;
      });

      // Remove from live quizzes
      setLiveQuizzes(prev => {
        const updated = { ...prev };
        delete updated[quizId];
        return updated;
      });

      // Remove from live quiz results
      setLiveQuizResults(prev => {
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
      Object.values(monitoringUnsubscribe).forEach(unsubscribe => {
        unsubscribe();
      });
    };
  }, []);

  return (
    <QuizContext.Provider value={{ 
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
      liveQuizResults
    }}>
      {children}
    </QuizContext.Provider>
  );
};
