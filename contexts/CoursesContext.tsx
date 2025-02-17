"use client";

import type React from "react";
import { createContext, useContext, useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Course } from "@/lib/interfaces";

type CoursesContextType = {
  courses: Course[];
  loading: boolean;
  error: string | null;
};

const CoursesContext = createContext<CoursesContextType>({
  courses: [],
  loading: true,
  error: null,
});

export const useCoursesContext = () => useContext(CoursesContext);

export const CoursesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const coursesCollection = collection(db, "courses");
        const coursesSnapshot = await getDocs(coursesCollection);
        const coursesList = coursesSnapshot.docs.map(
          (doc) => ({ ...doc.data(), courseId: doc.id } as Course)
        );
        setCourses(coursesList);
      } catch {
        setError("Failed to fetch courses");
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  return (
    <CoursesContext.Provider value={{ courses, loading, error }}>
      {children}
    </CoursesContext.Provider>
  );
};
