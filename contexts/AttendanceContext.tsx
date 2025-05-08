"use client";

import type React from "react";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import {
  Timestamp,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  AttendanceRecord,
  AttendanceReport,
  AttendanceStatus,
  HomeroomClass,
  Teacher,
  Subject,
} from "@/lib/interfaces";
import {
  getChildAttendance,
  generateAttendanceReport,
  getClassSessionAttendance,
  createAttendanceNotification,
  getInitialAttendanceState,
  initializeStateFromURL,
  loadAndUpdateAttendanceForm,
  refreshCurrentClass as refreshCurrentClassUtil,
  submitCurrentClassAttendance as submitCurrentClassAttendanceUtil,
  submitManualAttendance as submitManualAttendanceUtil,
  handleAttendanceChange as handleAttendanceChangeUtil,
  fetchInitialClassesData,
  type AttendancePageState,
} from "@/lib/management/attendanceManagement";

// Define the context type
type AttendanceContextType = {
  // Data states
  records: AttendanceRecord[];
  filteredRecords: AttendanceRecord[];
  report: AttendanceReport | null;
  loading: boolean;
  error: string | null;

  // Statistics
  totalRecords: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  presentRate: number;
  absentRate: number;
  lateRate: number;
  excusedRate: number;

  // Groupings
  recordsByDate: Record<string, AttendanceRecord[]>;
  recordsBySubject: Record<string, AttendanceRecord[]>;

  // Filters
  filterDays: number;
  setFilterDays: (days: number) => void;

  // Actions
  fetchRecords: (studentId?: string) => Promise<void>;
  fetchClassSessionAttendance: (
    classId: string,
    subjectId: string,
    date: Date,
    period: number
  ) => Promise<AttendanceRecord[]>;
  generateReport: (
    studentId: string,
    startDate: Date,
    endDate: Date
  ) => Promise<AttendanceReport>;
  notifyAbsence: (
    studentId: string,
    studentName: string,
    className: string,
    subjectName: string,
    status: "absent" | "late" | "excused",
    date: Date,
    periodNumber: number
  ) => Promise<void>;

  // Teacher attendance page functions
  getInitialAttendanceState: () => AttendancePageState;
  initializeStateFromURL: (
    state: AttendancePageState,
    searchParams: URLSearchParams,
    classes: HomeroomClass[],
    subjects: Subject[]
  ) => AttendancePageState;
  loadAndUpdateAttendanceForm: (
    state: AttendancePageState,
    teacher: Teacher
  ) => Promise<AttendancePageState>;
  refreshCurrentClass: (
    state: AttendancePageState,
    teacher: Teacher
  ) => Promise<AttendancePageState>;
  submitCurrentClassAttendance: (
    state: AttendancePageState,
    teacher: Teacher
  ) => Promise<AttendancePageState>;
  submitManualAttendance: (
    state: AttendancePageState,
    teacher: Teacher
  ) => Promise<AttendancePageState>;
  handleAttendanceChange: (
    state: AttendancePageState,
    studentId: string,
    status: AttendanceStatus
  ) => AttendancePageState;
  fetchInitialClassesData: (
    state: AttendancePageState,
    teacher: Teacher
  ) => Promise<AttendancePageState>;

  // Utility functions
  refreshData: () => void;
  getStatusBadge: (status: string) => React.ReactNode;
};

// Create the context with default values
const AttendanceContext = createContext<AttendanceContextType>({
  records: [],
  filteredRecords: [],
  report: null,
  loading: true,
  error: null,

  totalRecords: 0,
  presentCount: 0,
  absentCount: 0,
  lateCount: 0,
  excusedCount: 0,
  presentRate: 0,
  absentRate: 0,
  lateRate: 0,
  excusedRate: 0,

  recordsByDate: {},
  recordsBySubject: {},

  filterDays: 30,
  setFilterDays: () => {},

  fetchRecords: async () => {},
  fetchClassSessionAttendance: async () => [],
  generateReport: async () => ({
    studentId: "",
    startDate: Timestamp.now(),
    endDate: Timestamp.now(),
    totalDays: 0,
    absentDays: 0,
    lateDays: 0,
    excusedDays: 0,
    absenceRate: 0,
    tardyRate: 0,
    bySubject: {},
  }),
  notifyAbsence: async () => {},

  getInitialAttendanceState: () => getInitialAttendanceState(),
  initializeStateFromURL: (state, searchParams, classes, subjects) => state,
  loadAndUpdateAttendanceForm: async (state, teacher) => state,
  refreshCurrentClass: async (state, teacher) => state,
  submitCurrentClassAttendance: async (state, teacher) => state,
  submitManualAttendance: async (state, teacher) => state,
  handleAttendanceChange: (state, studentId, status) => state,
  fetchInitialClassesData: async (state, teacher) => state,

  refreshData: () => {},
  getStatusBadge: () => null,
});

// Hook for using the attendance context
export const useAttendance = () => useContext(AttendanceContext);

// Group attendance records by date
const groupByDate = (records: AttendanceRecord[]) => {
  const grouped: Record<string, AttendanceRecord[]> = {};

  records.forEach((record) => {
    const dateStr = record.date.toDate().toDateString();
    if (!grouped[dateStr]) {
      grouped[dateStr] = [];
    }
    grouped[dateStr].push(record);
  });

  return grouped;
};

// Group attendance records by subject
const groupBySubject = (records: AttendanceRecord[]) => {
  const grouped: Record<string, AttendanceRecord[]> = {};

  records.forEach((record) => {
    const subjectKey =
      record.subjectName || record.subjectId || "Unknown Subject";
    if (!grouped[subjectKey]) {
      grouped[subjectKey] = [];
    }
    grouped[subjectKey].push(record);
  });

  return grouped;
};

// Provider component that wraps the app and provides attendance data
export const AttendanceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useUser();
  const { toast } = useToast();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<AttendanceRecord[]>(
    []
  );
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDays, setFilterDays] = useState(30);
  const [refreshToken, setRefreshToken] = useState(0);

  // Reference to store the unsubscribe function for real-time listener
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Statistics
  const totalRecords = filteredRecords.length;
  const presentCount = filteredRecords.filter(
    (r) => r.status === "present"
  ).length;
  const absentCount = filteredRecords.filter(
    (r) => r.status === "absent"
  ).length;
  const lateCount = filteredRecords.filter((r) => r.status === "late").length;
  const excusedCount = filteredRecords.filter(
    (r) => r.status === "excused"
  ).length;

  const presentRate =
    totalRecords > 0 ? (presentCount / totalRecords) * 100 : 0;
  const absentRate = totalRecords > 0 ? (absentCount / totalRecords) * 100 : 0;
  const lateRate = totalRecords > 0 ? (lateCount / totalRecords) * 100 : 0;
  const excusedRate =
    totalRecords > 0 ? (excusedCount / totalRecords) * 100 : 0;

  // Group records
  const recordsByDate = groupByDate(filteredRecords);
  const recordsBySubject = groupBySubject(filteredRecords);

  // Function to refresh data
  const refreshData = useCallback(() => {
    setRefreshToken((prev) => prev + 1);
  }, []);

  // Helper function to determine status badge
  const getStatusBadge = useCallback((status: string) => {
    return status;
  }, []);

  // Fetch records for a student with real-time updates (if no studentId is provided, use the current user's ID)
  const fetchRecords = useCallback(
    async (studentId?: string) => {
      if (!user || !user.schoolId) {
        setError("User not authenticated");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Clean up any existing listener
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }

        // Calculate date range based on filter
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - filterDays);

        // Determine the correct studentId based on user role
        let targetStudentId = studentId;

        if (!targetStudentId) {
          if (user.role === "student" && user.userId) {
            targetStudentId = user.userId;
          } else if (user.role !== "parent") {
            setError("Invalid user role for fetching attendance records");
            setLoading(false);
            return;
          }
        }

        if (!targetStudentId) {
          setError("No student ID provided");
          setLoading(false);
          return;
        }

        // Reference to attendance collection
        const attendanceRef = collection(
          db,
          "schools",
          user.schoolId,
          "attendance"
        );

        // Create query for attendance records, filtered by student ID and date
        const attendanceQuery = query(
          attendanceRef,
          where("studentId", "==", targetStudentId),
          where("date", ">=", Timestamp.fromDate(startDate)),
          orderBy("date", "desc")
        );

        // Set up real-time listener
        const unsubscribe = onSnapshot(
          attendanceQuery,
          (snapshot) => {
            const attendanceRecords = snapshot.docs.map((doc) => ({
              ...doc.data(),
              attendanceId: doc.id,
            })) as AttendanceRecord[];

            console.debug(
              `[AttendanceContext] Real-time update: ${attendanceRecords.length} records`
            );

            setRecords(attendanceRecords);
            setFilteredRecords(attendanceRecords);
            setLoading(false);
            setError(null);
          },
          (err) => {
            console.error("Error in attendance snapshot listener:", err);
            setError(
              "Failed to load attendance records. Please try again later."
            );
            setLoading(false);

            toast({
              title: "Грешка",
              description: "Неуспешно зареждане на записи за присъствие",
              variant: "destructive",
            });
          }
        );

        // Store unsubscribe function
        unsubscribeRef.current = unsubscribe;
      } catch (error) {
        console.error("Error setting up attendance listener:", error);
        setError("Failed to load attendance records. Please try again later.");

        toast({
          title: "Грешка",
          description: "Неуспешно зареждане на записи за присъствие",
          variant: "destructive",
        });

        setLoading(false);
      }
    },
    [user, filterDays, toast]
  );

  // Fetch attendance records for a specific class session
  const fetchClassSessionAttendance = useCallback(
    async (classId: string, subjectId: string, date: Date, period: number) => {
      if (!user?.schoolId) {
        toast({
          title: "Грешка",
          description: "Потребителят не е удостоверен",
          variant: "destructive",
        });
        return [];
      }

      try {
        // Set up real-time listening for class session attendance
        const attendanceRef = collection(
          db,
          "schools",
          user.schoolId,
          "attendance"
        );
        const attendanceQuery = query(
          attendanceRef,
          where("classId", "==", classId),
          where("subjectId", "==", subjectId),
          where("periodNumber", "==", period)
        );

        // For date, we need to compare across the whole day since date is a timestamp
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        // Add date range filters to the query
        const dateFilteredQuery = query(
          attendanceQuery,
          where("date", ">=", Timestamp.fromDate(startOfDay)),
          where("date", "<=", Timestamp.fromDate(endOfDay))
        );

        // For this specific function, we'll use a one-time fetch since it's typically used
        // to display a snapshot of attendance for a specific class session
        const snapshot = await getDocs(dateFilteredQuery);
        return snapshot.docs.map((doc) => ({
          ...doc.data(),
          attendanceId: doc.id,
        })) as AttendanceRecord[];
      } catch (error) {
        console.error("Error fetching class session attendance:", error);
        toast({
          title: "Грешка",
          description: "Неуспешно извличане на присъствие за клас",
          variant: "destructive",
        });
        return [];
      }
    },
    [user, toast]
  );

  // Generate attendance report for a student
  const generateReport = useCallback(
    async (studentId: string, startDate: Date, endDate: Date) => {
      if (!user?.schoolId) {
        toast({
          title: "Грешка",
          description: "Потребителят не е удостоверен",
          variant: "destructive",
        });
        throw new Error("User not authenticated");
      }

      try {
        const report = await generateAttendanceReport(
          user.schoolId,
          studentId,
          Timestamp.fromDate(startDate),
          Timestamp.fromDate(endDate)
        );

        setReport(report);
        return report;
      } catch (error) {
        console.error("Error generating attendance report:", error);
        toast({
          title: "Грешка",
          description: "Неуспешно генериране на справка за присъствие",
          variant: "destructive",
        });
        throw error;
      }
    },
    [user, toast]
  );

  // Create attendance notification
  const notifyAbsence = useCallback(
    async (
      studentId: string,
      studentName: string,
      className: string,
      subjectName: string,
      status: "absent" | "late" | "excused",
      date: Date,
      periodNumber: number
    ) => {
      if (!user?.schoolId) {
        toast({
          title: "Грешка",
          description: "Потребителят не е удостоверен",
          variant: "destructive",
        });
        return;
      }

      try {
        await createAttendanceNotification(
          user.schoolId,
          studentId,
          studentName,
          className,
          subjectName,
          status,
          Timestamp.fromDate(date),
          periodNumber
        );

        toast({
          title: "Успешно",
          description: "Известието е изпратено успешно",
        });
      } catch (error) {
        console.error("Error creating attendance notification:", error);
        toast({
          title: "Грешка",
          description: "Неуспешно изпращане на известие",
          variant: "destructive",
        });
      }
    },
    [user, toast]
  );

  // Teacher attendance page functions
  const getInitialAttendanceStateImpl = useCallback(() => {
    return getInitialAttendanceState();
  }, []);

  const initializeStateFromURLImpl = useCallback(
    (
      state: AttendancePageState,
      searchParams: URLSearchParams,
      classes: HomeroomClass[],
      subjects: Subject[]
    ) => {
      return initializeStateFromURL(state, searchParams, classes, subjects);
    },
    []
  );

  const loadAndUpdateAttendanceFormImpl = useCallback(
    async (state: AttendancePageState, teacher: Teacher) => {
      return await loadAndUpdateAttendanceForm(state, teacher);
    },
    []
  );

  const refreshCurrentClassImpl = useCallback(
    async (state: AttendancePageState, teacher: Teacher) => {
      return await refreshCurrentClassUtil(state, teacher);
    },
    []
  );

  const submitCurrentClassAttendanceImpl = useCallback(
    async (state: AttendancePageState, teacher: Teacher) => {
      return await submitCurrentClassAttendanceUtil(state, teacher);
    },
    []
  );

  const submitManualAttendanceImpl = useCallback(
    async (state: AttendancePageState, teacher: Teacher) => {
      return await submitManualAttendanceUtil(state, teacher);
    },
    []
  );

  const handleAttendanceChangeImpl = useCallback(
    (
      state: AttendancePageState,
      studentId: string,
      status: AttendanceStatus
    ) => {
      return handleAttendanceChangeUtil(state, studentId, status);
    },
    []
  );

  const fetchInitialClassesDataImpl = useCallback(
    async (state: AttendancePageState, teacher: Teacher) => {
      return await fetchInitialClassesData(state, teacher);
    },
    []
  );

  // Auto-fetch records based on user role when component mounts or dependencies change
  useEffect(() => {
    if (!user) return;

    if (user.role === "student") {
      fetchRecords();
    } else {
      // For teachers/admins, we don't need to fetch initial records,
      // so set loading to false
      setLoading(false);
    }

    // Clean up listener when component unmounts or dependencies change
    return () => {
      if (unsubscribeRef.current) {
        console.debug("[AttendanceContext] Cleaning up real-time listener");
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user, filterDays, refreshToken, fetchRecords]);

  return (
    <AttendanceContext.Provider
      value={{
        records,
        filteredRecords,
        report,
        loading,
        error,

        totalRecords,
        presentCount,
        absentCount,
        lateCount,
        excusedCount,
        presentRate,
        absentRate,
        lateRate,
        excusedRate,

        recordsByDate,
        recordsBySubject,

        filterDays,
        setFilterDays,

        fetchRecords,
        fetchClassSessionAttendance,
        generateReport,
        notifyAbsence,

        getInitialAttendanceState: getInitialAttendanceStateImpl,
        initializeStateFromURL: initializeStateFromURLImpl,
        loadAndUpdateAttendanceForm: loadAndUpdateAttendanceFormImpl,
        refreshCurrentClass: refreshCurrentClassImpl,
        submitCurrentClassAttendance: submitCurrentClassAttendanceImpl,
        submitManualAttendance: submitManualAttendanceImpl,
        handleAttendanceChange: handleAttendanceChangeImpl,
        fetchInitialClassesData: fetchInitialClassesDataImpl,

        refreshData,
        getStatusBadge,
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
};
