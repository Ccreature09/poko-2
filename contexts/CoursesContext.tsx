"use client";

// Контекст за управление на учебните курсове в системата
import type React from "react";
import { createContext, useContext, useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Course } from "@/lib/interfaces";
import { useUser } from "@/contexts/UserContext";

// Дефиниране на типа данни за контекста на курсовете
type CoursesContextType = {
  courses: Course[]; // Списък с всички курсове
  loading: boolean; // Индикатор за зареждане
  error: string | null; // Съобщение за грешка, ако има такава
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>; // Функция за обновяване на списъка с курсове
};

// Създаване на контекста с начални стойности
const CoursesContext = createContext<CoursesContextType>({
  courses: [],
  loading: true,
  error: null,
  setCourses: () => {},
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

  useEffect(() => {
    // Функция за извличане на курсовете от базата данни
    const fetchCourses = async () => {
      // Прекратяваме изпълнението, ако потребителят не е логнат или няма данни за училището
      if (!user || !user.schoolId) return;
      try {
        // Извличане на колекцията с курсове за текущото училище
        const coursesCollection = collection(db, "schools", user.schoolId, "courses");
        // Изпълняване на заявката към базата данни
        const coursesSnapshot = await getDocs(coursesCollection);
        // Трансформиране на документите в масив от обекти тип Course
        const coursesList = coursesSnapshot.docs.map(
          (doc) => ({ ...doc.data(), courseId: doc.id } as Course)
        );
        // Обновяване на състоянието с получените курсове
        setCourses(coursesList);
      } catch {
        // Задаване на грешка при проблем с извличането на данни
        setError("Failed to fetch courses");
      } finally {
        // Завършване на процеса по зареждане, независимо от резултата
        setLoading(false);
      }
    };

    // Изпълняваме функцията за извличане на курсовете
    fetchCourses();
  }, [user]); // Повторно изпълнение при промяна на потребителя

  return (
    <CoursesContext.Provider value={{ courses, loading, error, setCourses }}>
      {children}
    </CoursesContext.Provider>
  );
};
