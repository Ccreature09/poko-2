"use client";

// Контекст за управление на оценките в системата
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
  handleAddGradeWithUI,
  handleUpdateGradeWithUI,
  handleDeleteGradeWithUI,
  handleBatchAddGradesWithUI,
  filterGrades,
  calculateGradeStatistics,
  fetchTeacherData,
  type GradeFilters,
  type GradeStatistics,
  type Student,
  type SubjectData,
  type ClassData,
} from "@/lib/management/gradeManagement";
import type { Grade, GradeType } from "@/lib/interfaces";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Дефиниция на типа данни за контекста на оценките
type GradesContextType = {
  grades: Grade[]; // Всички налични оценки
  filteredGrades: Grade[]; // Филтрирани оценки според критериите
  statistics: GradeStatistics | null; // Статистика за оценките
  students: Student[]; // Списък с ученици (за учители и администратори)
  subjects: SubjectData[]; // Списък с предмети
  classes: ClassData[]; // Списък с класове
  filters: GradeFilters; // Текущо зададени филтри
  loading: boolean; // Флаг за зареждане
  error: string | null; // Съобщение за грешка
  selectedStudentId: string | null; // Избран ученик (за родители с няколко деца)

  // Действия
  setFilters: (filters: Partial<GradeFilters>) => void; // Задаване на филтри
  addGrade: (
    studentId: string,
    subjectId: string,
    data: {
      value: number;
      title: string;
      description?: string;
      type: GradeType;
      date: Date;
    }
  ) => Promise<Grade | null>; // Добавяне на оценка
  updateGrade: (
    gradeId: string,
    updates: Partial<{
      value: number;
      title: string;
      description: string;
      type: GradeType;
      date: Date;
    }>
  ) => Promise<boolean>; // Обновяване на оценка
  deleteGrade: (gradeId: string) => Promise<boolean>; // Изтриване на оценка
  addBatchGrades: (
    studentIds: string[],
    subjectId: string,
    data: {
      value: number;
      title: string;
      description?: string;
      type: GradeType;
      date: Date;
    }
  ) => Promise<Grade[]>; // Добавяне на оценки към множество ученици
  refreshGrades: () => Promise<void>; // Опресняване на данните
  setSelectedStudentId: (studentId: string | null) => void; // Задаване на избран ученик
};

// Създаване на контекста с начални стойности
const GradesContext = createContext<GradesContextType>({
  grades: [],
  filteredGrades: [],
  statistics: null,
  students: [],
  subjects: [],
  classes: [],
  filters: {
    searchTerm: "",
    student: "",
    subject: "",
    gradeType: "",
    dateFrom: "",
    dateTo: "",
    valueFrom: "",
    valueTo: "",
  },
  loading: true,
  error: null,
  selectedStudentId: null,

  setFilters: () => {},
  addGrade: async () => null,
  updateGrade: async () => false,
  deleteGrade: async () => false,
  addBatchGrades: async () => [],
  refreshGrades: async () => {},
  setSelectedStudentId: () => {},
});

// Export hook за лесен достъп до контекста от компонентите
export const useGrades = () => useContext(GradesContext);

// Провайдър компонент, който обвива приложението и предоставя данни за оценките
export const GradesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useUser();
  const { toast } = useToast();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [filteredGrades, setFilteredGrades] = useState<Grade[]>([]);
  const [statistics, setStatistics] = useState<GradeStatistics | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null
  );
  const [filters, setFiltersState] = useState<GradeFilters>({
    searchTerm: "",
    student: "",
    subject: "",
    gradeType: "",
    dateFrom: "",
    dateTo: "",
    valueFrom: "",
    valueTo: "",
  });

  // Reference to keep track of active listeners
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Function to fetch metadata (students, subjects, classes) separately
  const fetchMetadata = useCallback(async () => {
    if (!user || !user.schoolId || !user.userId) return;

    try {
      if (user.role === "teacher" || user.role === "admin") {
        const metadata = await fetchTeacherData(user.schoolId, user.userId);
        setStudents(metadata.students);
        setSubjects(metadata.subjects);
        setClasses(metadata.classes);
      }
    } catch (err) {
      console.error("Error fetching metadata:", err);
    }
  }, [user]);

  // Set up real-time listeners for grades based on user role
  useEffect(() => {
    if (!user || !user.schoolId || !user.userId) {
      setGrades([]);
      setFilteredGrades([]);
      setStatistics(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Clean up any existing listener
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    // Fetch metadata first (students, subjects, classes)
    fetchMetadata();

    let gradesQuery;

    switch (user.role) {
      case "student":
        gradesQuery = query(
          collection(db, "schools", user.schoolId, "grades"),
          where("studentId", "==", user.userId)
        );
        break;
      case "teacher":
        gradesQuery = query(
          collection(db, "schools", user.schoolId, "grades"),
          where("teacherId", "==", user.userId)
        );
        break;
      case "admin":
        gradesQuery = collection(db, "schools", user.schoolId, "grades");
        break;
      case "parent":
        const childId =
          selectedStudentId ||
          (user.childrenIds && user.childrenIds.length > 0
            ? user.childrenIds[0]
            : null);

        if (childId) {
          if (!selectedStudentId && childId) {
            setSelectedStudentId(childId);
          }

          gradesQuery = query(
            collection(db, "schools", user.schoolId, "grades"),
            where("studentId", "==", childId)
          );
        }
        break;
      default:
        setLoading(false);
        return;
    }

    if (!gradesQuery) {
      setLoading(false);
      return;
    }

    // Set up the real-time listener
    const unsubscribe = onSnapshot(
      gradesQuery,
      (snapshot) => {
        const gradesData = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as Grade[];

        setGrades(gradesData);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error("Error in grades snapshot listener:", err);
        setError("Грешка при зареждане на оценките");
        toast({
          title: "Грешка",
          description: "Възникна проблем при зареждане на оценките",
          variant: "destructive",
        });
        setLoading(false);
      }
    );

    // Store the unsubscribe function
    unsubscribeRef.current = unsubscribe;

    // Clean up the listener when the component unmounts or dependencies change
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user, selectedStudentId, toast, fetchMetadata]);

  // Обновяване на филтрираните оценки при промяна на филтрите или оценките
  useEffect(() => {
    if (!grades.length) {
      setFilteredGrades([]);
      setStatistics(null);
      return;
    }

    // Филтриране на оценките според зададените критерии
    const filtered = filterGrades(grades, students, subjects, filters);

    setFilteredGrades(filtered);
    setStatistics(calculateGradeStatistics(filtered));
  }, [filters, grades, students, subjects]);

  // Функция за задаване на филтри
  const setFilters = useCallback((newFilters: Partial<GradeFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
  }, []);

  // Функция за добавяне на оценка
  const addGrade = useCallback(
    async (
      studentId: string,
      subjectId: string,
      data: {
        value: number;
        title: string;
        description?: string;
        type: GradeType;
        date: Date;
      }
    ) => {
      if (!user || !user.schoolId || !user.userId) return null;

      const newGrade = await handleAddGradeWithUI(
        user.schoolId,
        studentId,
        subjectId,
        user.userId,
        data
      );

      return newGrade;
    },
    [user]
  );

  // Функция за обновяване на оценка
  const updateGrade = useCallback(
    async (
      gradeId: string,
      updates: Partial<{
        value: number;
        title: string;
        description: string;
        type: GradeType;
        date: Date;
      }>
    ) => {
      if (!user || !user.schoolId) return false;

      const success = await handleUpdateGradeWithUI(
        user.schoolId,
        gradeId,
        updates
      );

      return success;
    },
    [user]
  );

  // Функция за изтриване на оценка
  const deleteGrade = useCallback(
    async (gradeId: string) => {
      if (!user || !user.schoolId) return false;

      const success = await handleDeleteGradeWithUI(user.schoolId, gradeId);

      return success;
    },
    [user]
  );

  // Функция за добавяне на оценки към множество ученици
  const addBatchGrades = useCallback(
    async (
      studentIds: string[],
      subjectId: string,
      data: {
        value: number;
        title: string;
        description?: string;
        type: GradeType;
        date: Date;
      }
    ) => {
      if (!user || !user.schoolId || !user.userId) return [];

      const newGrades = await handleBatchAddGradesWithUI(
        user.schoolId,
        studentIds,
        subjectId,
        user.userId,
        data
      );

      return newGrades;
    },
    [user]
  );

  // Функция за ръчно опресняване на оценките
  const refreshGrades = useCallback(async () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    setLoading(true);
  }, []);

  return (
    <GradesContext.Provider
      value={{
        grades,
        filteredGrades,
        statistics,
        students,
        subjects,
        classes,
        filters,
        loading,
        error,
        selectedStudentId,
        setFilters,
        addGrade,
        updateGrade,
        deleteGrade,
        addBatchGrades,
        refreshGrades,
        setSelectedStudentId,
      }}
    >
      {children}
    </GradesContext.Provider>
  );
};
