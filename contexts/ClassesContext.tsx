"use client";

import type React from "react";
import { createContext, useContext, useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { HomeroomClass, SubjectClass } from "@/lib/interfaces";

type ClassesContextType = {
  subjectClasses: SubjectClass[];
  homeroomClasses: HomeroomClass[];
  loading: boolean;
  error: string | null;
};

const ClassesContext = createContext<ClassesContextType>({
  subjectClasses: [],
  homeroomClasses: [],
  loading: true,
  error: null,
});

export const useClassesContext = () => useContext(ClassesContext);

export const ClassesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [subjectClasses, setSubjectClasses] = useState<SubjectClass[]>([]);
  const [homeroomClasses, setHomeroomClasses] = useState<HomeroomClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const subjectClassesCollection = collection(db, "subjectClasses");
        const homeroomClassesCollection = collection(db, "homeroomClasses");

        const [subjectClassesSnapshot, homeroomClassesSnapshot] =
          await Promise.all([
            getDocs(subjectClassesCollection),
            getDocs(homeroomClassesCollection),
          ]);

        setSubjectClasses(
          subjectClassesSnapshot.docs.map(
            (doc) => ({ ...doc.data(), classId: doc.id } as SubjectClass)
          )
        );
        setHomeroomClasses(
          homeroomClassesSnapshot.docs.map(
            (doc) => ({ ...doc.data(), classId: doc.id } as HomeroomClass)
          )
        );
      } catch (error) {
        console.error("Error fetching classes:", error);
        setError("Failed to fetch classes");
      } finally {
        setLoading(false);
      }
    };

    fetchClasses();
  }, []);

  return (
    <ClassesContext.Provider
      value={{ subjectClasses, homeroomClasses, loading, error }}
    >
      {children}
    </ClassesContext.Provider>
  );
};
