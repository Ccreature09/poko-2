"use client";

// Контекст за управление на отзиви и обратна връзка
import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useRef,
  useEffect,
} from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { useUser } from "@/contexts/UserContext";
import { toast } from "@/hooks/use-toast";
import { StudentReview, ReviewType } from "@/lib/interfaces";
import { createNotification } from "@/lib/management/notificationManagement";

// Дефиниция на типа данни за контекста на отзивите
type FeedbackContextType = {
  reviews: StudentReview[]; // Всички отзиви за текущия потребител или избран ученик
  loading: boolean; // Флаг за индикиране на зареждане
  error: string | null; // Съобщение за грешка, ако има такава

  // Функции за управление на отзиви
  getReviewsForStudent: (
    schoolId: string,
    studentId: string
  ) => Promise<StudentReview[]>;
  createReview: (
    schoolId: string,
    teacherId: string,
    teacherName: string,
    reviewData: {
      studentId: string;
      title: string;
      content: string;
      type: ReviewType;
      subjectId?: string;
      subjectName?: string;
    }
  ) => Promise<string | null>;
  updateReview: (
    schoolId: string,
    reviewId: string,
    updates: Partial<StudentReview>
  ) => Promise<boolean>;
  deleteReview: (schoolId: string, reviewId: string) => Promise<boolean>;

  // Функция за нулиране на състоянието (при промяна на избран ученик)
  resetFeedbackState: () => void;
};

// Създаване на контекста с начални стойности
const FeedbackContext = createContext<FeedbackContextType>({
  reviews: [],
  loading: false,
  error: null,
  getReviewsForStudent: async () => [],
  createReview: async () => null,
  updateReview: async () => false,
  deleteReview: async () => false,
  resetFeedbackState: () => {},
});

// Hook за лесен достъп до контекста на отзивите от компонентите
export const useFeedback = () => useContext(FeedbackContext);

// Тип за props на FeedbackProvider
interface FeedbackProviderProps {
  children: ReactNode;
}

// Провайдър компонент, който обвива приложението и предоставя функционалност за отзиви
export const FeedbackProvider = ({ children }: FeedbackProviderProps) => {
  const { user } = useUser();
  const [reviews, setReviews] = useState<StudentReview[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Reference to store the unsubscribe function for real-time listener
  const unsubscribeRef = useRef<(() => void) | null>(null);
  // State to track the current student ID being monitored
  const currentStudentIdRef = useRef<string | null>(null);
  // Функция за извличане на отзиви за ученик с real-time обновления
  const getReviewsForStudent = useCallback(
    async (schoolId: string, studentId: string): Promise<StudentReview[]> => {
      setLoading(true);
      setError(null);

      try {
        // If we're already listening to this student's reviews, clean up first
        if (unsubscribeRef.current && currentStudentIdRef.current !== studentId) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }

        // Update the current student being monitored
        currentStudentIdRef.current = studentId;

        // Заявка към базата данни за извличане на отзиви за конкретен ученик
        const reviewsRef = collection(
          db,
          "schools",
          schoolId,
          "studentReviews"
        );
        const reviewsQuery = query(
          reviewsRef,
          where("studentId", "==", studentId),
          orderBy("date", "desc") // Sort by date descending (newest first)
        );

        // Set up real-time listener
        const unsubscribe = onSnapshot(
          reviewsQuery,
          (snapshot) => {
            // Преобразуване на документите в масив от отзиви
            const fetchedReviews = snapshot.docs.map((doc) => ({
              reviewId: doc.id,
              ...doc.data(),
            })) as StudentReview[];

            console.debug(`[FeedbackContext] Real-time update: ${fetchedReviews.length} reviews for student ${studentId}`);
            
            setReviews(fetchedReviews);
            setLoading(false);
            setError(null);
          },
          (err) => {
            console.error("Error in reviews snapshot listener:", err);
            setError("Възникна грешка при извличане на отзивите.");
            setLoading(false);
            toast({
              title: "Грешка",
              description: "Неуспешно извличане на отзивите",
              variant: "destructive",
            });
          }
        );

        // Store unsubscribe function
        unsubscribeRef.current = unsubscribe;

        // Return current reviews for immediate display
        // Future updates will come through the listener
        return reviews;
      } catch (error) {
        console.error("Error setting up reviews listener:", error);
        setError("Възникна грешка при извличане на отзивите.");
        setLoading(false);
        return [];
      }
    },
    [reviews]
  );

  // Функция за създаване на нов отзив
  const createReview = useCallback(
    async (
      schoolId: string,
      teacherId: string,
      teacherName: string,
      reviewData: {
        studentId: string;
        title: string;
        content: string;
        type: ReviewType;
        subjectId?: string;
        subjectName?: string;
      }
    ): Promise<string | null> => {
      setLoading(true);
      setError(null);

      try {
        // Създаване на документ за отзив
        const reviewsRef = collection(
          db,
          "schools",
          schoolId,
          "studentReviews"
        );

        // Конструиране на данните за отзива
        const newReview = {
          studentId: reviewData.studentId,
          teacherId: teacherId,
          teacherName: teacherName,
          title: reviewData.title,
          content: reviewData.content,
          type: reviewData.type,
          date: serverTimestamp(),
          createdAt: serverTimestamp(),
        } as Partial<StudentReview>;

        // Добавяне на информация за предмет, ако е предоставена
        if (reviewData.subjectId && reviewData.subjectName) {
          newReview.subjectId = reviewData.subjectId;
          newReview.subjectName = reviewData.subjectName;
        }

        // Добавяне на отзива в базата данни
        const docRef = await addDoc(reviewsRef, newReview);
        const reviewId = docRef.id;

        // Обновяване на документа с ID-то му
        await updateDoc(docRef, { reviewId });

        // Създаване на известие за ученика
        await createNotification(schoolId, {
          userId: reviewData.studentId,
          title:
            reviewData.type === "positive"
              ? "Нова положителна забележка"
              : "Нова отрицателна забележка",
          message: `Имате нова ${
            reviewData.type === "positive" ? "положителна" : "отрицателна"
          } забележка: ${reviewData.title}`,
          type: "student-review",
          relatedId: reviewId,
          link: `/student/feedback`,
          metadata: {
            type: reviewData.type,
            isForStudent: true,
            title: reviewData.title,
          },
        });

        // Зареждане на данни за ученика за известия към родители
        const studentDoc = await getDoc(
          doc(db, "schools", schoolId, "users", reviewData.studentId)
        );

        if (studentDoc.exists()) {
          const studentData = studentDoc.data();
          const studentName = `${studentData.firstName} ${studentData.lastName}`;

          // Намиране на родители на ученика и изпращане на известия към тях
          const parentsQuery = query(
            collection(db, "schools", schoolId, "users"),
            where("role", "==", "parent"),
            where("childrenIds", "array-contains", reviewData.studentId)
          );

          const parentsSnapshot = await getDocs(parentsQuery);

          parentsSnapshot.forEach(async (parentDoc) => {
            await createNotification(schoolId, {
              userId: parentDoc.id,
              title:
                reviewData.type === "positive"
                  ? "Нова положителна забележка"
                  : "Нова отрицателна забележка",
              message: `Детето ви ${studentName} има нова ${
                reviewData.type === "positive" ? "положителна" : "отрицателна"
              } забележка: ${reviewData.title}`,
              type: "student-review",
              relatedId: reviewId,
              link: `/parent/feedback`,
              metadata: {
                type: reviewData.type,
                isForStudent: false,
                studentName,
                title: reviewData.title,
              },
            });
          });
        }

        // Обновяване на локалното състояние с новия отзив
        const newReviewWithId = {
          reviewId,
          ...newReview,
          date: Timestamp.now(),
          createdAt: Timestamp.now(),
        } as StudentReview;

        setReviews((prevReviews) => [newReviewWithId, ...prevReviews]);
        setLoading(false);
        return reviewId;
      } catch (error) {
        console.error("Error creating review:", error);
        setError("Възникна грешка при създаване на отзива.");
        setLoading(false);
        return null;
      }
    },
    []
  );

  // Функция за обновяване на съществуващ отзив
  const updateReview = useCallback(
    async (
      schoolId: string,
      reviewId: string,
      updates: Partial<StudentReview>
    ): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        // Референция към документа на отзива
        const reviewRef = doc(
          db,
          "schools",
          schoolId,
          "studentReviews",
          reviewId
        );

        // Премахване на полета, които не трябва да бъдат актуализирани
        const updateData = { ...updates };
        delete updateData.reviewId;
        delete updateData.createdAt;

        // Обновяване на документа
        await updateDoc(reviewRef, updateData);

        // Обновяване на локалното състояние
        setReviews((prevReviews) =>
          prevReviews.map((review) =>
            review.reviewId === reviewId ? { ...review, ...updates } : review
          )
        );

        setLoading(false);
        return true;
      } catch (error) {
        console.error("Error updating review:", error);
        setError("Възникна грешка при обновяване на отзива.");
        setLoading(false);
        return false;
      }
    },
    []
  );

  // Функция за изтриване на отзив
  const deleteReview = useCallback(
    async (schoolId: string, reviewId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        // Референция към документа на отзива
        const reviewRef = doc(
          db,
          "schools",
          schoolId,
          "studentReviews",
          reviewId
        );

        // Изтриване на документа
        await deleteDoc(reviewRef);

        // Обновяване на локалното състояние
        setReviews((prevReviews) =>
          prevReviews.filter((review) => review.reviewId !== reviewId)
        );

        setLoading(false);
        return true;
      } catch (error) {
        console.error("Error deleting review:", error);
        setError("Възникна грешка при изтриване на отзива.");
        setLoading(false);
        return false;
      }
    },
    []
  );
  // Функция за нулиране на състоянието
  const resetFeedbackState = useCallback(() => {
    // Clean up any existing listener
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
      currentStudentIdRef.current = null;
    }
    setReviews([]);
    setError(null);
  }, []);
  // Clean up listeners when component unmounts
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        console.debug("[FeedbackContext] Cleaning up real-time listener");
        unsubscribeRef.current();
        unsubscribeRef.current = null;
        currentStudentIdRef.current = null;
      }
    };
  }, []);

  return (
    <FeedbackContext.Provider
      value={{
        reviews,
        loading,
        error,
        getReviewsForStudent,
        createReview,
        updateReview,
        deleteReview,
        resetFeedbackState,
      }}
    >
      {children}
    </FeedbackContext.Provider>
  );
};

// Export the FeedbackContext
export { FeedbackContext };
