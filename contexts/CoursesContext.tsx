"use client";

// Контекст за управление на учебните курсове в системата
import type React from "react";
import { createContext, useContext, useState, useEffect, useRef } from "react";
import { collection, getDocs, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Course } from "@/lib/interfaces";
import { useUser } from "@/contexts/UserContext";

// Дефиниране на типа данни за контекста на курсовете
type CoursesContextType = {
  courses: Course[]; // Списък с всички курсове
  loading: boolean; // Индикатор за зареждане
  error: string | null; // Съобщение за грешка, ако има такава
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>; // Функция за обновяване на списъка с курсове
  refreshCourses: () => void; // Функция за ръчно опресняване на курсовете
};

// Създаване на контекста с начални стойности
const CoursesContext = createContext<CoursesContextType>({
  courses: [],
  loading: true,
  error: null,
  setCourses: () => {},
  refreshCourses: () => {},
});

// Hook за лесен достъп до контекста от компонентите
export const useCourses = () => useContext(CoursesContext);

// Провайдър компонент, който обвива приложението и предоставя данни за курсовете
export const CoursesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Достъп до данните за текущия потребител
  const { user } = useUser();

  // Състояние за съхранение на списъка с курсове
  const [courses, setCourses] = useState<Course[]>([]);
  // Индикатор дали данните се зареждат в момента
  const [loading, setLoading] = useState(true);
  // Състояние за съхранение на евентуални грешки
  const [error, setError] = useState<string | null>(null);
  // State for forcing refresh
  const [refreshToken, setRefreshToken] = useState(0);

  // Reference to store the unsubscribe function from onSnapshot
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Function to manually refresh courses
  const refreshCourses = () => {
    setRefreshToken((prev) => prev + 1);
  };

  useEffect(() => {
    // Функция за извличане на курсовете от базата данни
    const fetchCourses = async () => {
      // Прекратяваме изпълнението, ако потребителят не е логнат или няма данни за училището
      if (!user || !user.schoolId) {
        setLoading(false);
        return;
      }

      // Cleanup any existing listener
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }

      try {
        setLoading(true);
        setError(null);

        // Set up a real-time listener for the courses collection
        const coursesCollection = collection(
          db,
          "schools",
          user.schoolId,
          "courses"
        );

        // Create a query for the courses collection
        const coursesQuery = query(coursesCollection);

        console.log(
          "CoursesContext: Setting up real-time listener for courses"
        );

        const unsubscribe = onSnapshot(
          coursesQuery,
          (snapshot) => {
            // Transform the documents into Course objects
            const coursesList = snapshot.docs.map(
              (doc) => ({ ...doc.data(), courseId: doc.id } as Course)
            );

            console.log(
              "CoursesContext: Real-time update received with",
              coursesList.length,
              "courses"
            );

            // Update the state with the received courses
            setCourses(coursesList);
            setError(null);
            setLoading(false);
          },
          (err) => {
            console.error("CoursesContext: Error in courses listener:", err);
            setError("Failed to fetch courses");
            setLoading(false);
          }
        );

        // Store the unsubscribe function
        unsubscribeRef.current = unsubscribe;
      } catch (err) {
        // Задаване на грешка при проблем с извличането на данни
        console.error(
          "CoursesContext: Failed to set up courses listener:",
          err
        );
        setError("Failed to fetch courses");
        setLoading(false);
      }
    };

    // Изпълняваме функцията за извличане на курсовете
    fetchCourses();

    // Cleanup function
    return () => {
      if (unsubscribeRef.current) {
        console.log("CoursesContext: Cleaning up courses listener");
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user, refreshToken]); // Повторно изпълнение при промяна на потребителя или при ръчно опресняване

  return (
    <CoursesContext.Provider
      value={{ courses, loading, error, setCourses, refreshCourses }}
    >
      {children}
    </CoursesContext.Provider>
  );
};
