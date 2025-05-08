/**
 * @fileoverview Manages quizzes within the Poko application.
 *
 * This module provides functionalities for:
 * - Fetching quizzes with various filtering options (by teacher, class, status).
 * - Retrieving a specific quiz by its ID.
 * - Creating, updating, and deleting quizzes, including handling notifications for published/updated quizzes.
 * - Managing quiz questions (updating, deleting).
 * - Handling student quiz submissions: submitting attempts, grading submissions, and notifying students of grades.
 * - Deleting quiz submissions.
 */

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
import type { Quiz, Question, QuizSubmission } from "@/lib/interfaces";
import { createNotification } from "@/lib/management/notificationManagement";

/**
 * Fetches quizzes for a given school, with optional filtering.
 * Allows filtering by teacher ID, class ID, and quiz status.
 * Quizzes are ordered by creation date in descending order (newest first).
 * @param schoolId - The ID of the school.
 * @param options - Optional filtering criteria: `teacherId`, `classId`, `status`.
 * @returns A promise that resolves to an array of `Quiz` objects matching the criteria.
 * @throws Will throw an error if database operations fail.
 */
export const getQuizzes = async (
  schoolId: string,
  options?: { teacherId?: string; classId?: string; status?: string }
) => {
  try {
    const quizzesCollection = collection(db, "schools", schoolId, "quizzes");
    let quizzesQuery: Query<DocumentData> = quizzesCollection;

    // Прилагане на филтри, ако са предоставени
    if (options?.teacherId) {
      quizzesQuery = query(
        quizzesQuery,
        where("teacherId", "==", options.teacherId)
      );
    }

    if (options?.classId) {
      quizzesQuery = query(
        quizzesQuery,
        where("classIds", "array-contains", options.classId)
      );
    }

    if (options?.status) {
      quizzesQuery = query(quizzesQuery, where("status", "==", options.status));
    }

    // Подреждане по дата на създаване
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

/**
 * Retrieves a specific quiz by its ID from the database.
 * @param schoolId - The ID of the school.
 * @param quizId - The ID of the quiz to fetch.
 * @returns A promise that resolves to the `Quiz` object if found.
 * @throws Will throw an error if the quiz is not found or if database operations fail.
 */
export const getQuizById = async (schoolId: string, quizId: string) => {
  try {
    const quizDoc = await getDoc(
      doc(db, "schools", schoolId, "quizzes", quizId)
    );
    if (!quizDoc.exists()) {
      throw new Error("Quiz not found");
    }
    return { ...quizDoc.data(), quizId: quizDoc.id } as Quiz;
  } catch (error) {
    console.error("Error fetching quiz:", error);
    throw error;
  }
};

/**
 * Creates a new quiz in the database.
 * Sets a default status of "draft" if not provided. Automatically sets `createdAt` timestamp.
 * Updates the quiz document with its own ID after creation.
 * If the quiz is created with "published" status and has associated `classIds`,
 * it sends notifications to students in those classes.
 * @param schoolId - The ID of the school.
 * @param quizData - Partial data for the new quiz. Must include at least `title` and `teacherId`.
 *                   `classIds` should be provided if publishing directly.
 * @returns A promise that resolves to the ID of the newly created quiz.
 * @throws Will throw an error if database or notification operations fail.
 */
export const createQuiz = async (schoolId: string, quizData: Partial<Quiz>) => {
  try {
    // Създаване на теста със статус "чернова" по подразбиране, ако не е предоставен
    const quizRef = collection(db, "schools", schoolId, "quizzes");
    const quizDocRef = await addDoc(quizRef, {
      ...quizData,
      status: quizData.status || "draft",
      createdAt: Timestamp.now(),
    });

    // Обновяване на теста с неговото ID
    await updateDoc(quizDocRef, {
      quizId: quizDocRef.id,
    });

    // Ако тестът е публикуван и е асоцииран с конкретни класове, уведомяваме учениците
    if (
      quizData.status === "published" &&
      quizData.classIds &&
      quizData.classIds.length > 0
    ) {
      await createNotification(schoolId, {
        userId: "*",
        title: "Нов тест е наличен",
        message: `Нов тест "${quizData.title}" е публикуван`,
        type: "quiz-published",
        relatedId: quizDocRef.id,
        link: `/quizzes/${quizDocRef.id}`,
        params: {
          classIds: quizData.classIds,
        },
      });
    }

    return quizDocRef.id;
  } catch (error) {
    console.error("Error creating quiz:", error);
    throw error;
  }
};

/**
 * Updates an existing quiz in the database.
 * Automatically sets `updatedAt` timestamp.
 * Handles notifications if the quiz status changes to "published" or if an already published quiz is updated.
 * @param schoolId - The ID of the school.
 * @param quizId - The ID of the quiz to update.
 * @param quizData - Partial data containing the fields to update.
 * @returns A promise that resolves to the ID of the updated quiz.
 * @throws Will throw an error if the quiz is not found or if database/notification operations fail.
 */
export const updateQuiz = async (
  schoolId: string,
  quizId: string,
  quizData: Partial<Quiz>
) => {
  try {
    const quizRef = doc(db, "schools", schoolId, "quizzes", quizId);

    // Извличане на текущите данни на теста, за да проверим промяна в статуса
    const currentQuiz = await getDoc(quizRef);
    const wasPublished =
      currentQuiz.exists() && currentQuiz.data().status === "published";
    const isNowPublished = quizData.status === "published";

    // Обновяване на теста
    await updateDoc(quizRef, {
      ...quizData,
      updatedAt: Timestamp.now(),
    });

    // Ако тестът току-що е публикуван, изпращаме известия
    if (
      !wasPublished &&
      isNowPublished &&
      quizData.classIds &&
      quizData.classIds.length > 0
    ) {
      await createNotification(schoolId, {
        userId: "*",
        title: "Нов тест е наличен",
        message: `Нов тест "${quizData.title}" е публикуван`,
        type: "quiz-published",
        relatedId: quizId,
        link: `/quizzes/${quizId}`,
        params: {
          classIds: quizData.classIds,
        },
      });
    } else if (
      wasPublished &&
      quizData.classIds &&
      quizData.classIds.length > 0
    ) {
      // Ако вече е публикуван, но е обновен, изпращаме известия за обновяване
      await createNotification(schoolId, {
        userId: "*",
        title: "Тестът е актуализиран",
        message: `Тестът "${quizData.title}" беше актуализиран`,
        type: "quiz-updated",
        relatedId: quizId,
        link: `/quizzes/${quizId}`,
        params: {
          classIds: quizData.classIds,
        },
      });
    }

    return quizId;
  } catch (error) {
    console.error("Error updating quiz:", error);
    throw error;
  }
};

/**
 * Deletes a quiz from the database.
 * Also deletes all associated quiz submissions.
 * Optionally, notifications could be sent to affected students if the quiz was published (currently placeholder).
 * @param schoolId - The ID of the school.
 * @param quizId - The ID of the quiz to delete.
 * @returns A promise that resolves to the ID of the deleted quiz.
 * @throws Will throw an error if the quiz is not found or if database operations fail.
 */
export const deleteQuiz = async (schoolId: string, quizId: string) => {
  try {
    // Извличане на данните за теста преди изтриване, за да обработим почистването
    const quizData = await getQuizById(schoolId, quizId);

    // Изтриване на теста
    await deleteDoc(doc(db, "schools", schoolId, "quizzes", quizId));

    // Изтриване на свързаните предавания
    // В продукционна среда това обикновено би се извършвало с batch или transaction
    const submissionsCollection = collection(
      db,
      "schools",
      schoolId,
      "quizSubmissions"
    );
    const submissionsQuery = query(
      submissionsCollection,
      where("quizId", "==", quizId)
    );
    const submissionsSnapshot = await getDocs(submissionsQuery);

    const deletePromises = submissionsSnapshot.docs.map(
      async (submissionDoc) => {
        await deleteDoc(submissionDoc.ref);
      }
    );

    await Promise.all(deletePromises);

    // Уведомяване на засегнатите ученици, ако тестът е бил публикуван
    if (
      quizData.status === "published" &&
      quizData.classIds &&
      quizData.classIds.length > 0
    ) {
      // Тук може да се добави имплементация за известия при изтриване
    }

    return quizId;
  } catch (error) {
    console.error("Error deleting quiz:", error);
    throw error;
  }
};

/**
 * Submits a student's attempt for a quiz.
 * Creates a new quiz submission document with `submittedAt` timestamp and "submitted" status.
 * Updates the submission with its own ID and adds a reference to this submission in the quiz document.
 * @param schoolId - The ID of the school.
 * @param submission - Partial data for the `QuizSubmission`. Must include `quizId`, `studentId`, and `answers`.
 * @returns A promise that resolves to the ID of the newly created quiz submission.
 * @throws Will throw an error if database operations fail.
 */
export const submitQuizAttempt = async (
  schoolId: string,
  submission: Partial<QuizSubmission>
) => {
  try {
    const submissionsCollection = collection(
      db,
      "schools",
      schoolId,
      "quizSubmissions"
    );
    const submissionRef = await addDoc(submissionsCollection, {
      ...submission,
      submittedAt: Timestamp.now(),
      status: "submitted",
    });

    await updateDoc(submissionRef, {
      submissionId: submissionRef.id,
    });

    // Обновяване на теста с референция към предаването
    const quizRef = doc(
      db,
      "schools",
      schoolId,
      "quizzes",
      submission.quizId as string
    );
    await updateDoc(quizRef, {
      submissions: arrayUnion(submissionRef.id),
    });

    return submissionRef.id;
  } catch (error) {
    console.error("Error submitting quiz:", error);
    throw error;
  }
};

/**
 * Grades a student's quiz submission.
 * Calculates the total score and percentage score based on the provided grades for each question.
 * Updates the submission document with grades, scores, feedback (optional), `gradedAt` timestamp, and "graded" status.
 * Sends a notification to the student about their graded quiz.
 * @param schoolId - The ID of the school.
 * @param submissionId - The ID of the quiz submission to grade.
 * @param grades - An object mapping question IDs to the points awarded for that question.
 * @param feedback - Optional overall feedback for the quiz submission.
 * @returns A promise that resolves to the ID of the graded submission.
 * @throws Will throw an error if the submission is not found or if database/notification operations fail.
 */
export const gradeQuizSubmission = async (
  schoolId: string,
  submissionId: string,
  grades: { [questionId: string]: number },
  feedback?: string
) => {
  try {
    const submissionRef = doc(
      db,
      "schools",
      schoolId,
      "quizSubmissions",
      submissionId
    );
    const submissionDoc = await getDoc(submissionRef);

    if (!submissionDoc.exists()) {
      throw new Error("Quiz submission not found");
    }

    const submissionData = submissionDoc.data() as QuizSubmission;
    let totalScore = 0;
    let maxScore = 0;

    // Изчисляване на общия резултат
    Object.keys(grades).forEach((questionId) => {
      const question = submissionData.questions.find(
        (q) => q.questionId === questionId
      );
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

    // Изпращане на известие до ученика
    await createNotification(schoolId, {
      userId: submissionData.studentId,
      title: "Тестът е оценен",
      message: `Вашият тест "${
        submissionData.quizTitle
      }" е оценен. Резултат: ${percentageScore.toFixed(1)}%`,
      type: "assignment-graded",
      relatedId: submissionData.quizId,
      link: `/quizzes/${submissionData.quizId}`,
    });

    return submissionId;
  } catch (error) {
    console.error("Error grading quiz submission:", error);
    throw error;
  }
};

/**
 * Updates a specific question within a quiz.
 * Fetches the quiz, finds the question by ID, updates its data, and saves the modified questions array back to the quiz.
 * Sets the `updatedAt` timestamp for the quiz.
 * @param schoolId - The ID of the school.
 * @param quizId - The ID of the quiz containing the question.
 * @param questionId - The ID of the question to update.
 * @param questionData - Partial data for the `Question` to update.
 * @returns A promise that resolves when the question is successfully updated.
 * @throws Will throw an error if the quiz or question is not found, or if database operations fail.
 */
export const updateQuizQuestion = async (
  schoolId: string,
  quizId: string,
  questionId: string,
  questionData: Partial<Question>
): Promise<void> => {
  try {
    // Първо извличаме теста за достъп до масива от въпроси
    const quizRef = doc(db, "schools", schoolId, "quizzes", quizId);
    const quizDoc = await getDoc(quizRef);

    if (!quizDoc.exists()) {
      throw new Error("Quiz not found");
    }

    const quiz = quizDoc.data() as Quiz;
    const questions = quiz.questions || [];

    // Намиране на индекса на въпроса, който трябва да се обнови
    const questionIndex = questions.findIndex(
      (q) => q.questionId === questionId
    );

    if (questionIndex === -1) {
      throw new Error("Question not found in quiz");
    }

    // Обновяване на въпроса
    const updatedQuestions = [...questions];
    updatedQuestions[questionIndex] = {
      ...updatedQuestions[questionIndex],
      ...questionData,
    };

    // Обновяване на теста с модифицирания масив от въпроси
    await updateDoc(quizRef, {
      questions: updatedQuestions,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("Error updating quiz question:", error);
    throw error;
  }
};

/**
 * Deletes a specific question from a quiz.
 * Fetches the quiz, filters out the question by ID, and saves the modified questions array back to the quiz.
 * Sets the `updatedAt` timestamp for the quiz.
 * @param schoolId - The ID of the school.
 * @param quizId - The ID of the quiz containing the question.
 * @param questionId - The ID of the question to delete.
 * @returns A promise that resolves when the question is successfully deleted.
 * @throws Will throw an error if the quiz is not found, or if database operations fail.
 */
export const deleteQuizQuestion = async (
  schoolId: string,
  quizId: string,
  questionId: string
): Promise<void> => {
  try {
    // Първо извличаме теста за достъп до масива от въпроси
    const quizRef = doc(db, "schools", schoolId, "quizzes", quizId);
    const quizDoc = await getDoc(quizRef);

    if (!quizDoc.exists()) {
      throw new Error("Quiz not found");
    }

    const quiz = quizDoc.data() as Quiz;
    const questions = quiz.questions || [];

    // Филтриране на въпроса, който трябва да се изтрие
    const updatedQuestions = questions.filter(
      (q) => q.questionId !== questionId
    );

    // Обновяване на теста с филтрирания масив от въпроси
    await updateDoc(quizRef, {
      questions: updatedQuestions,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("Error deleting quiz question:", error);
    throw error;
  }
};

/**
 * Deletes a student's quiz submission.
 * @param schoolId - The ID of the school.
 * @param submissionId - The ID of the quiz submission to delete.
 * @returns A promise that resolves when the submission is successfully deleted.
 * @throws Will throw an error if database operations fail or the submission is not found (though Firestore `deleteDoc` doesn't error on non-existent docs).
 */
export const deleteQuizSubmission = async (
  schoolId: string,
  submissionId: string
): Promise<void> => {
  try {
    const submissionRef = doc(
      db,
      "schools",
      schoolId,
      "quiz-submissions",
      submissionId
    );
    await deleteDoc(submissionRef);
  } catch (error) {
    console.error("Error deleting quiz submission:", error);
    throw error;
  }
};
