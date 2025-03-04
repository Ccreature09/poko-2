import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  arrayUnion,
  type Query,
  type DocumentData,
} from "firebase/firestore";
import type { Quiz, Question, QuizSubmission,} from "@/lib/interfaces";
import { createNotification } from "./notificationManagement";

// Get all quizzes for a school
export const getQuizzes = async (schoolId: string, options?: { teacherId?: string; classId?: string; status?: string }) => {
  try {
    const quizzesCollection = collection(db, "schools", schoolId, "quizzes");
    let quizzesQuery: Query<DocumentData> = quizzesCollection;
    
    // Apply filters if provided
    if (options?.teacherId) {
      quizzesQuery = query(quizzesQuery, where("teacherId", "==", options.teacherId));
    }
    
    if (options?.classId) {
      quizzesQuery = query(quizzesQuery, where("classIds", "array-contains", options.classId));
    }
    
    if (options?.status) {
      quizzesQuery = query(quizzesQuery, where("status", "==", options.status));
    }
    
    // Order by created date
    quizzesQuery = query(quizzesQuery, orderBy("createdAt", "desc"));
    
    const quizzesSnapshot = await getDocs(quizzesQuery);
    return quizzesSnapshot.docs.map((doc) => ({
      ...doc.data(),
      quizId: doc.id,
    })) as Quiz[];
  } catch (error) {
    console.error("Error fetching quizzes:", error);
    throw error;
  }
};

// Get a specific quiz by ID
export const getQuizById = async (schoolId: string, quizId: string) => {
  try {
    const quizDoc = await getDoc(doc(db, "schools", schoolId, "quizzes", quizId));
    if (!quizDoc.exists()) {
      throw new Error("Quiz not found");
    }
    return { ...quizDoc.data(), quizId: quizDoc.id } as Quiz;
  } catch (error) {
    console.error("Error fetching quiz:", error);
    throw error;
  }
};

// Create a new quiz
export const createQuiz = async (schoolId: string, quizData: Partial<Quiz>) => {
  try {
    // Create the quiz with default status if not provided
    const quizRef = collection(db, "schools", schoolId, "quizzes");
    const quizDocRef = await addDoc(quizRef, {
      ...quizData,
      status: quizData.status || "draft",
      createdAt: Timestamp.now(),
    });
    
    // Update the quiz with its ID
    await updateDoc(quizDocRef, {
      quizId: quizDocRef.id,
    });
    
    // If the quiz is published and assigned to specific classes, notify students
    if (quizData.status === "published" && quizData.classIds && quizData.classIds.length > 0) {
      await createNotification(schoolId, {
        userId: "*",
        title: "New Quiz Available",
        message: `A new quiz "${quizData.title}" has been published`,
        type: "quiz-published",
        relatedId: quizDocRef.id,
        link: `/quizzes/${quizDocRef.id}`,
        targetClasses: quizData.classIds,
      });
    }
    
    return quizDocRef.id;
  } catch (error) {
    console.error("Error creating quiz:", error);
    throw error;
  }
};

// Update an existing quiz
export const updateQuiz = async (schoolId: string, quizId: string, quizData: Partial<Quiz>) => {
  try {
    const quizRef = doc(db, "schools", schoolId, "quizzes", quizId);
    
    // Get current quiz data to check status change
    const currentQuiz = await getDoc(quizRef);
    const wasPublished = currentQuiz.exists() && currentQuiz.data().status === "published";
    const isNowPublished = quizData.status === "published";
    
    // Update the quiz
    await updateDoc(quizRef, {
      ...quizData,
      updatedAt: Timestamp.now(),
    });
    
    // If quiz was just published, send notifications
    if (!wasPublished && isNowPublished && quizData.classIds && quizData.classIds.length > 0) {
      await createNotification(schoolId, {
        userId: "*",
        title: "New Quiz Available",
        message: `A new quiz "${quizData.title}" has been published`,
        type: "quiz-published",
        relatedId: quizId,
        link: `/quizzes/${quizId}`,
        targetClasses: quizData.classIds,
      });
    } else if (wasPublished && quizData.classIds && quizData.classIds.length > 0) {
      // If already published but updated, send update notifications
      await createNotification(schoolId, {
        userId: "*",
        title: "Quiz Updated",
        message: `The quiz "${quizData.title}" has been updated`,
        type: "quiz-updated",
        relatedId: quizId,
        link: `/quizzes/${quizId}`,
        targetClasses: quizData.classIds,
      });
    }
    
    return quizId;
  } catch (error) {
    console.error("Error updating quiz:", error);
    throw error;
  }
};

// Delete a quiz
export const deleteQuiz = async (schoolId: string, quizId: string) => {
  try {
    // Get quiz data before deletion to handle cleanup
    const quizData = await getQuizById(schoolId, quizId);
    
    // Delete the quiz
    await deleteDoc(doc(db, "schools", schoolId, "quizzes", quizId));
    
    // Delete associated submissions
    // This would typically be done with a batch or transaction in a production environment
    const submissionsCollection = collection(db, "schools", schoolId, "quizSubmissions");
    const submissionsQuery = query(submissionsCollection, where("quizId", "==", quizId));
    const submissionsSnapshot = await getDocs(submissionsQuery);
    
    const deletePromises = submissionsSnapshot.docs.map(async (submissionDoc) => {
      await deleteDoc(submissionDoc.ref);
    });
    
    await Promise.all(deletePromises);
    
    // Notify affected students if the quiz was published
    if (quizData.status === "published" && quizData.classIds && quizData.classIds.length > 0) {
      // Implementation for deletion notifications can be added here
    }
    
    return quizId;
  } catch (error) {
    console.error("Error deleting quiz:", error);
    throw error;
  }
};

// Submit a quiz attempt
export const submitQuizAttempt = async (schoolId: string, submission: Partial<QuizSubmission>) => {
  try {
    const submissionsCollection = collection(db, "schools", schoolId, "quizSubmissions");
    const submissionRef = await addDoc(submissionsCollection, {
      ...submission,
      submittedAt: Timestamp.now(),
      status: "submitted",
    });
    
    await updateDoc(submissionRef, {
      submissionId: submissionRef.id,
    });
    
    // Update the quiz with the submission reference
    const quizRef = doc(db, "schools", schoolId, "quizzes", submission.quizId as string);
    await updateDoc(quizRef, {
      submissions: arrayUnion(submissionRef.id),
    });
    
    return submissionRef.id;
  } catch (error) {
    console.error("Error submitting quiz:", error);
    throw error;
  }
};

// Grade a quiz submission
export const gradeQuizSubmission = async (schoolId: string, submissionId: string, grades: { [questionId: string]: number }, feedback?: string) => {
  try {
    const submissionRef = doc(db, "schools", schoolId, "quizSubmissions", submissionId);
    const submissionDoc = await getDoc(submissionRef);
    
    if (!submissionDoc.exists()) {
      throw new Error("Quiz submission not found");
    }
    
    const submissionData = submissionDoc.data() as QuizSubmission;
    let totalScore = 0;
    let maxScore = 0;
    
    // Calculate the total score
    Object.keys(grades).forEach((questionId) => {
      const question = submissionData.questions.find(q => q.questionId === questionId);
      if (question) {
        maxScore += question.points || 1;
        totalScore += grades[questionId];
      }
    });
    
    const percentageScore = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
    
    await updateDoc(submissionRef, {
      grades,
      score: totalScore,
      maxScore,
      percentageScore,
      feedback,
      gradedAt: Timestamp.now(),
      status: "graded",
    });
    
    // Send notification to the student
    await createNotification(schoolId, {
      userId: submissionData.studentId,
      title: "Quiz Graded",
      message: `Your submission for "${submissionData.quizTitle}" has been graded. Score: ${percentageScore.toFixed(1)}%`,
      type: "assignment-graded", // Using existing notification type
      relatedId: submissionData.quizId,
      link: `/quizzes/${submissionData.quizId}`,
    });
    
    return submissionId;
  } catch (error) {
    console.error("Error grading quiz submission:", error);
    throw error;
  }
};

// Update a quiz question
export const updateQuizQuestion = async (
  schoolId: string,
  quizId: string,
  questionId: string,
  questionData: Partial<Question>
): Promise<void> => {
  try {
    // First get the quiz to access its questions array
    const quizRef = doc(db, "schools", schoolId, "quizzes", quizId);
    const quizDoc = await getDoc(quizRef);
    
    if (!quizDoc.exists()) {
      throw new Error("Quiz not found");
    }
    
    const quiz = quizDoc.data() as Quiz;
    const questions = quiz.questions || [];
    
    // Find the index of the question to update
    const questionIndex = questions.findIndex(q => q.questionId === questionId);
    
    if (questionIndex === -1) {
      throw new Error("Question not found in quiz");
    }
    
    // Update the question
    const updatedQuestions = [...questions];
    updatedQuestions[questionIndex] = {
      ...updatedQuestions[questionIndex],
      ...questionData,
    };
    
    // Update the quiz with the modified questions array
    await updateDoc(quizRef, { 
      questions: updatedQuestions,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("Error updating quiz question:", error);
    throw error;
  }
};

// Delete a quiz question
export const deleteQuizQuestion = async (
  schoolId: string,
  quizId: string,
  questionId: string
): Promise<void> => {
  try {
    // First get the quiz to access its questions array
    const quizRef = doc(db, "schools", schoolId, "quizzes", quizId);
    const quizDoc = await getDoc(quizRef);
    
    if (!quizDoc.exists()) {
      throw new Error("Quiz not found");
    }
    
    const quiz = quizDoc.data() as Quiz;
    const questions = quiz.questions || [];
    
    // Filter out the question to delete
    const updatedQuestions = questions.filter(q => q.questionId !== questionId);
    
    // Update the quiz with the filtered questions array
    await updateDoc(quizRef, { 
      questions: updatedQuestions,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("Error deleting quiz question:", error);
    throw error;
  }
};

// Delete a quiz submission
export const deleteQuizSubmission = async (
  schoolId: string,
  submissionId: string
): Promise<void> => {
  try {
    const submissionRef = doc(db, "schools", schoolId, "quiz-submissions", submissionId);
    await deleteDoc(submissionRef);
  } catch (error) {
    console.error("Error deleting quiz submission:", error);
    throw error;
  }
};