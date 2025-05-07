"use client";

// Контекст за управление на оценките в системата
import type React from "react";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  getStudentGrades,
  getTeacherGrades,
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
} from "@/lib/gradeManagement";
import type { Grade, GradeType } from "@/lib/interfaces";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";

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

  // Функция за извличане на оценки според ролята на потребителя
  const fetchGrades = useCallback(async () => {
    if (!user || !user.schoolId || !user.userId) {
      setGrades([]);
      setFilteredGrades([]);
      setStatistics(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let gradesData: Grade[] = [];

      // Извличане на оценки според ролята на потребителя
      switch (user.role) {
        case "student":
          // За учениците - извличане на собствените оценки
          gradesData = await getStudentGrades(user.schoolId, user.userId);
          break;
        case "teacher":
          // За учителите - извличане на всички въведени от тях оценки и допълнителни данни
          const teacherData = await fetchTeacherData(
            user.schoolId,
            user.userId
          );
          gradesData = teacherData.grades;
          setStudents(teacherData.students);
          setSubjects(teacherData.subjects);
          setClasses(teacherData.classes);
          break;
        case "admin":
          // За администраторите - извличане на всички оценки в училището
          // Тук ще трябва да се добави специфичен метод, ако имате такъв
          const teacherDataForAdmin = await fetchTeacherData(
            user.schoolId,
            user.userId
          );
          gradesData = teacherDataForAdmin.grades;
          setStudents(teacherDataForAdmin.students);
          setSubjects(teacherDataForAdmin.subjects);
          setClasses(teacherDataForAdmin.classes);
          break;
        case "parent":
          // За родителите - извличане на оценките на децата им
          if (user.childrenIds && user.childrenIds.length > 0) {
            // Ако има избран ученик от родителя, показваме само неговите оценки
            if (selectedStudentId) {
              gradesData = await getStudentGrades(
                user.schoolId,
                selectedStudentId
              );
            } else {
              // Иначе вземаме оценките на първото дете или на всички деца
              const childId = user.childrenIds[0];
              setSelectedStudentId(childId);
              gradesData = await getStudentGrades(user.schoolId, childId);
            }
          }
          break;
      }

      setGrades(gradesData);
      // Първоначално филтрираните оценки са същите като всички оценки
      setFilteredGrades(gradesData);
      // Изчисляване на статистика за оценките
      setStatistics(calculateGradeStatistics(gradesData));
      setError(null);
    } catch (err) {
      console.error("Error fetching grades:", err);
      setError("Грешка при зареждане на оценките");
      toast({
        title: "Грешка",
        description: "Възникна проблем при зареждане на оценките",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, selectedStudentId, toast]);

  // Първоначално зареждане на данните
  useEffect(() => {
    fetchGrades();
  }, [fetchGrades]);

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

      if (newGrade) {
        setGrades((prev) => [...prev, newGrade]);
      }

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

      if (success) {
        // Обновяване на оценките, за да отразим промените
        await fetchGrades();
      }

      return success;
    },
    [user, fetchGrades]
  );

  // Функция за изтриване на оценка
  const deleteGrade = useCallback(
    async (gradeId: string) => {
      if (!user || !user.schoolId) return false;

      const success = await handleDeleteGradeWithUI(user.schoolId, gradeId);

      if (success) {
        setGrades((prev) => prev.filter((grade) => grade.id !== gradeId));
      }

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

      if (newGrades.length > 0) {
        setGrades((prev) => [...prev, ...newGrades]);
      }

      return newGrades;
    },
    [user]
  );

  // Функция за ръчно опресняване на оценките
  const refreshGrades = useCallback(async () => {
    await fetchGrades();
  }, [fetchGrades]);

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
