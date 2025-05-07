/**
 * Utilities for attendance management in the application
 *
 * This file contains functions for:
 * - Recording student attendance
 * - Retrieving attendance records
 * - Generating attendance reports
 * - Managing absence justifications
 * - Detecting current classes
 * - Managing attendance UI state
 */

import { db } from "../firebase";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import type {
  AttendanceRecord,
  AttendanceReport,
  AttendanceStatus,
  HomeroomClass,
  Student,
  Subject,
  Teacher,
} from "../interfaces";
import {
  createNotification,
  type NotificationType,
} from "./notificationManagement";
import { getStudentsInClass } from "./schoolManagement";
import {
  getClassesTaughtByTeacher,
  doesClassSessionExist,
} from "./timetableManagement";
import { toast } from "@/hooks/use-toast";

// Type for class session information
export interface ClassSession {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  day: string;
  period: number;
  startTime: string;
  endTime: string;
}

// Type for current class information
export interface CurrentClass {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  period: number;
}

// Type for attendance page state
export interface AttendancePageState {
  classes: HomeroomClass[];
  subjects: Subject[];
  classSessions: ClassSession[];
  students: Student[];
  attendanceData: Record<string, AttendanceStatus>;
  isLoading: boolean;
  isSubmitting: boolean;
  existingAttendance: AttendanceRecord[];
  hasExistingAttendance: boolean;
  isCheckingExistingAttendance: boolean;
  isCheckingTimetable: boolean;
  classSessionExists: boolean | null;
  selectedClassId: string;
  selectedSubjectId: string;
  selectedDate: Date;
  selectedPeriod: number;
  currentClass: CurrentClass | null;
  activeTab: string;
}

/**
 * Fetch initial classes data for the teacher attendance page
 * @param state The current state object
 * @param teacher The teacher object
 * @returns Updated state with loaded classes and subjects
 */
export async function fetchInitialClassesData(
  state: AttendancePageState,
  teacher: Teacher
): Promise<AttendancePageState> {
  try {
    console.log("Starting fetchInitialClassesData");
    if (!teacher.schoolId || !teacher.userId) {
      console.error("Missing schoolId or userId");
      throw new Error("Missing schoolId or userId");
    }

    // After the check, we can assert these are definitely strings
    console.log("Loading teacher class data");
    const data = await loadTeacherClassData(
      teacher.schoolId as string,
      teacher.userId as string
    );

    console.log("Teacher class data loaded successfully", {
      classesCount: data.classes.length,
      subjectsCount: data.subjects.length,
      currentClass: data.currentClass ? "available" : "not available",
    });

    return {
      ...state,
      classes: data.classes,
      subjects: data.subjects,
      classSessions: data.classSessions,
      currentClass: data.currentClass,
      isLoading: false,
    };
  } catch (error) {
    console.error("Error in fetchInitialClassesData:", error);
    return {
      ...state,
      isLoading: false,
    };
  }
}

// Default initial state for the attendance page
export function getInitialAttendanceState(): AttendancePageState {
  return {
    classes: [],
    subjects: [],
    classSessions: [],
    students: [],
    attendanceData: {},
    isLoading: false,
    isSubmitting: false,
    existingAttendance: [],
    hasExistingAttendance: false,
    isCheckingExistingAttendance: false,
    isCheckingTimetable: false,
    classSessionExists: null,
    selectedClassId: "",
    selectedSubjectId: "",
    selectedDate: new Date(),
    selectedPeriod: 1,
    currentClass: null,
    activeTab: "current-class",
  };
}

// Function to initialize state from URL parameters
export function initializeStateFromURL(
  state: AttendancePageState,
  searchParams: URLSearchParams,
  classes: HomeroomClass[],
  subjects: Subject[]
): AttendancePageState {
  const updatedState = { ...state };

  // Get parameters from URL
  const classIdParam = searchParams.get("classId");
  const subjectIdParam = searchParams.get("subjectId");
  const tabParam = searchParams.get("tab");
  const dateParam = searchParams.get("date");
  const periodParam = searchParams.get("period");

  // Set active tab if provided
  if (tabParam === "manual-entry") {
    updatedState.activeTab = "manual-entry";
  }

  // Set class if provided and valid
  if (classIdParam && classes.some((c) => c.classId === classIdParam)) {
    updatedState.selectedClassId = classIdParam;

    // Set subject if provided and valid
    if (
      subjectIdParam &&
      subjects.some((s) => s.subjectId === subjectIdParam)
    ) {
      updatedState.selectedSubjectId = subjectIdParam;
    }
  }

  // Set date if provided
  if (dateParam) {
    try {
      const parsedDate = new Date(dateParam);
      if (!isNaN(parsedDate.getTime())) {
        // We need to explicitly set the hours to 0 to avoid timezone issues
        parsedDate.setHours(0, 0, 0, 0);
        updatedState.selectedDate = parsedDate;
      }
    } catch (e) {
      console.error("Failed to parse date parameter:", e);
    }
  }

  // Set period if provided
  if (periodParam) {
    const parsedPeriod = parseInt(periodParam);
    if (!isNaN(parsedPeriod) && parsedPeriod >= 1 && parsedPeriod <= 8) {
      updatedState.selectedPeriod = parsedPeriod;
    }
  }

  return updatedState;
}

/**
 * Detect the current class for a teacher based on the current time
 * @param sessions Array of class sessions
 * @returns The current class or null if no class is in session
 */
export function detectCurrentClass(
  sessions: ClassSession[]
): CurrentClass | null {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTimeAsMinutes = currentHour * 60 + currentMinutes;

  // Map JavaScript day (0=Sunday, 1=Monday, etc.) to day names in timetable
  const daysOfWeek = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const currentDay = daysOfWeek[now.getDay()];

  // Find class session that matches current day and time
  const currentSession = sessions.find((session) => {
    if (session.day !== currentDay) return false;

    // Convert session times to minutes for comparison
    const [startHour, startMinute] = session.startTime.split(":").map(Number);
    const [endHour, endMinute] = session.endTime.split(":").map(Number);
    const startTimeAsMinutes = startHour * 60 + startMinute;
    const endTimeAsMinutes = endHour * 60 + endMinute;

    // Check if current time falls within class period
    return (
      currentTimeAsMinutes >= startTimeAsMinutes &&
      currentTimeAsMinutes <= endTimeAsMinutes
    );
  });

  if (currentSession) {
    return {
      classId: currentSession.classId,
      className: currentSession.className,
      subjectId: currentSession.subjectId,
      subjectName: currentSession.subjectName,
      period: currentSession.period,
    };
  }

  return null;
}

/**
 * Refresh the current class detection
 * @param state The current state object
 * @param teacher The teacher object
 * @returns Updated state with refreshed current class
 */
export async function refreshCurrentClass(
  state: AttendancePageState,
  teacher: Teacher
): Promise<AttendancePageState> {
  try {
    if (!teacher.schoolId || !teacher.userId) {
      throw new Error("Missing schoolId or userId");
    }

    const newState = { ...state, isLoading: true };

    // Reload teacher class data
    const data = await loadTeacherClassData(
      teacher.schoolId as string,
      teacher.userId as string
    );

    // If there's a current class, load its students
    if (data.currentClass) {
      // Load students for the current class
      const { students, initialAttendanceData } =
        await loadStudentsForAttendance(
          teacher.schoolId as string,
          data.currentClass.classId
        );

      return {
        ...newState,
        classSessions: data.classSessions,
        currentClass: data.currentClass,
        students,
        attendanceData: initialAttendanceData,
        isLoading: false,
      };
    }

    // No current class
    return {
      ...newState,
      classSessions: data.classSessions,
      currentClass: null,
      students: [],
      attendanceData: {},
      isLoading: false,
    };
  } catch (error) {
    console.error("Error refreshing current class:", error);
    return {
      ...state,
      isLoading: false,
    };
  }
}

/**
 * Loads class sessions for a teacher
 * @param schoolId The school ID
 * @param teacherId The teacher ID
 * @returns Object containing class sessions, unique classes, and unique subjects
 */
export async function loadTeacherClassData(
  schoolId: string,
  teacherId: string
): Promise<{
  classSessions: ClassSession[];
  classes: HomeroomClass[];
  subjects: Subject[];
  currentClass: CurrentClass | null;
}> {
  const teacherClassSessions = await getClassesTaughtByTeacher(
    schoolId,
    teacherId
  );

  // Process the class sessions to get unique classes and subjects
  const uniqueClasses = new Map();
  const uniqueSubjects = new Map();

  // Add each class and subject to the maps to remove duplicates
  teacherClassSessions.forEach((session) => {
    uniqueClasses.set(session.classId, {
      classId: session.classId,
      className: session.className,
    });

    uniqueSubjects.set(session.subjectId, {
      subjectId: session.subjectId,
      name: session.subjectName,
    });
  });

  // Convert maps to arrays
  const classesArray = Array.from(uniqueClasses.values());
  const subjectsArray = Array.from(uniqueSubjects.values());

  // Detect current class
  const currentClass = detectCurrentClass(teacherClassSessions);

  return {
    classSessions: teacherClassSessions,
    classes: classesArray,
    subjects: subjectsArray,
    currentClass,
  };
}

/**
 * Load students for a class and initialize attendance data
 * @param schoolId The school ID
 * @param classId The class ID
 * @returns Students array and initial attendance data
 */
export async function loadStudentsForAttendance(
  schoolId: string,
  classId: string
): Promise<{
  students: Student[];
  initialAttendanceData: Record<string, AttendanceStatus>;
}> {
  const classStudents = await getStudentsInClass(schoolId, classId);

  // Initialize attendance data for all students as 'present'
  const initialAttendanceData: Record<string, AttendanceStatus> = {};
  classStudents.forEach((student: Student) => {
    if (student.userId) {
      initialAttendanceData[student.userId] = "present";
    }
  });

  return {
    students: classStudents,
    initialAttendanceData,
  };
}

/**
 * Load and merge student attendance data properly
 * @param schoolId The school ID
 * @param classId The class ID
 * @param subjectId The subject ID (optional)
 * @param date The date (optional)
 * @param periodNumber The period number (optional)
 * @returns Complete data needed for attendance
 */
export async function loadStudentsWithAttendance(
  schoolId: string,
  classId: string,
  subjectId?: string,
  date?: Timestamp,
  periodNumber?: number
): Promise<{
  students: Student[];
  attendanceData: Record<string, AttendanceStatus>;
  hasExistingRecords: boolean;
  existingRecords: AttendanceRecord[];
}> {
  // First load all students for this class
  const students = await getStudentsInClass(schoolId, classId);

  // Initialize attendance data for all students as 'present'
  const initialAttendanceData: Record<string, AttendanceStatus> = {};
  students.forEach((student) => {
    if (student.userId) {
      initialAttendanceData[student.userId] = "present";
    }
  });

  // If we have subject, date and period, check for existing attendance records
  if (subjectId && date && periodNumber) {
    try {
      // Fetch existing attendance records
      const existingRecords = await getClassSessionAttendance(
        schoolId,
        classId,
        subjectId,
        date,
        periodNumber
      );

      if (existingRecords.length > 0) {
        console.log("Found existing attendance records:", existingRecords);

        // Merge existing records with the initial data
        const mergedAttendanceData = { ...initialAttendanceData };

        // Override with actual recorded values
        existingRecords.forEach((record) => {
          mergedAttendanceData[record.studentId] = record.status;
        });

        console.log("Merged attendance data:", mergedAttendanceData);

        return {
          students,
          attendanceData: mergedAttendanceData,
          hasExistingRecords: true,
          existingRecords,
        };
      }
    } catch (error) {
      console.error("Error loading existing attendance:", error);
    }
  }

  // If no existing records or any error occurred, return initial data
  return {
    students,
    attendanceData: initialAttendanceData,
    hasExistingRecords: false,
    existingRecords: [],
  };
}

/**
 * Get attendance records for a specific class session
 * @param schoolId The school ID
 * @param classId The class ID
 * @param subjectId The subject ID
 * @param date The date of the class
 * @param periodNumber The period number
 */
export async function getClassSessionAttendance(
  schoolId: string,
  classId: string,
  subjectId: string,
  date: Timestamp,
  periodNumber: number
): Promise<AttendanceRecord[]> {
  const schoolRef = doc(db, "schools", schoolId);
  const attendanceCollectionRef = collection(schoolRef, "attendance");

  // Convert date to start and end of day
  const startOfDay = new Date(date.toDate());
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date.toDate());
  endOfDay.setHours(23, 59, 59, 999);

  const attendanceQuery = query(
    attendanceCollectionRef,
    where("classId", "==", classId),
    where("subjectId", "==", subjectId),
    where("periodNumber", "==", periodNumber),
    where("date", ">=", Timestamp.fromDate(startOfDay)),
    where("date", "<=", Timestamp.fromDate(endOfDay))
  );

  const attendanceSnapshot = await getDocs(attendanceQuery);
  const attendanceRecords: AttendanceRecord[] = [];

  attendanceSnapshot.forEach((doc) => {
    const data = doc.data();
    attendanceRecords.push({
      attendanceId: doc.id,
      studentId: data.studentId,
      studentName: data.studentName,
      teacherId: data.teacherId,
      teacherName: data.teacherName,
      classId: data.classId,
      className: data.className,
      subjectId: data.subjectId,
      subjectName: data.subjectName,
      date: data.date,
      periodNumber: data.periodNumber,
      status: data.status,
      justified: data.justified,
      createdAt: data.createdAt,
      notifiedParent: data.notifiedParent || false,
      updatedAt: data.updatedAt || data.createdAt,
    });
  });

  return attendanceRecords;
}

/**
 * Get attendance records for a student
 * @param schoolId The school ID
 * @param parentId The parent ID (for authorization check)
 * @param studentId The student ID
 * @param startDate Optional start date for filtering
 * @param endDate Optional end date for filtering
 */
export async function getChildAttendance(
  schoolId: string,
  parentId: string,
  studentId: string,
  startDate?: Timestamp,
  endDate?: Timestamp
): Promise<AttendanceRecord[]> {
  console.log(
    `Fetching attendance records for student ${studentId} in school ${schoolId}`
  );

  const schoolRef = doc(db, "schools", schoolId);
  const attendanceCollectionRef = collection(schoolRef, "attendance");

  // Build query with filters
  let attendanceQuery = query(
    attendanceCollectionRef,
    where("studentId", "==", studentId),
    orderBy("date", "desc")
  );

  if (startDate) {
    console.log(`Adding startDate filter: ${startDate.toDate()}`);
    attendanceQuery = query(attendanceQuery, where("date", ">=", startDate));
  }

  if (endDate) {
    console.log(`Adding endDate filter: ${endDate.toDate()}`);
    attendanceQuery = query(attendanceQuery, where("date", "<=", endDate));
  }

  console.log("Executing attendance query...");
  const attendanceSnapshot = await getDocs(attendanceQuery);
  console.log(`Attendance query returned ${attendanceSnapshot.size} documents`);

  const attendanceRecords: AttendanceRecord[] = [];

  attendanceSnapshot.forEach((doc) => {
    console.log(`Processing attendance record ${doc.id}`);
    const data = doc.data();
    attendanceRecords.push({
      attendanceId: doc.id,
      studentId: data.studentId,
      studentName: data.studentName,
      teacherId: data.teacherId,
      teacherName: data.teacherName,
      classId: data.classId,
      className: data.className,
      subjectId: data.subjectId,
      subjectName: data.subjectName,
      date: data.date,
      periodNumber: data.periodNumber,
      status: data.status,
      justified: data.justified,
      createdAt: data.createdAt,
      notifiedParent: data.notifiedParent || false,
      updatedAt: data.updatedAt || data.createdAt,
    });
  });

  console.log(`Returning ${attendanceRecords.length} attendance records`);
  return attendanceRecords;
}

/**
 * Generate attendance report for a student
 * @param schoolId The school ID
 * @param studentId The student ID
 * @param startDate Start date for the report period
 * @param endDate End date for the report period
 */
export async function generateAttendanceReport(
  schoolId: string,
  studentId: string,
  startDate: Timestamp,
  endDate: Timestamp
): Promise<AttendanceReport> {
  const schoolRef = doc(db, "schools", schoolId);
  const attendanceCollectionRef = collection(schoolRef, "attendance");

  const attendanceQuery = query(
    attendanceCollectionRef,
    where("studentId", "==", studentId),
    where("date", ">=", startDate),
    where("date", "<=", endDate)
  );

  const attendanceSnapshot = await getDocs(attendanceQuery);

  // Track days by status using Sets to count unique days
  const totalDays = new Set<string>();
  const absentDays = new Set<string>();
  const lateDays = new Set<string>();
  const excusedDays = new Set<string>();
  const bySubject: Record<
    string,
    {
      absentPeriods: number;
      latePeriods: number;
      excusedPeriods: number;
      totalPeriods: number;
      absenceRate?: number;
    }
  > = {};

  attendanceSnapshot.forEach((doc) => {
    const data = doc.data();
    const dateStr = data.date.toDate().toDateString();
    totalDays.add(dateStr);

    // Initialize subject stats if not exists
    if (!bySubject[data.subjectId]) {
      bySubject[data.subjectId] = {
        absentPeriods: 0,
        latePeriods: 0,
        excusedPeriods: 0,
        totalPeriods: 0,
      };
    }

    // Count by status
    switch (data.status) {
      case "absent":
        absentDays.add(dateStr);
        bySubject[data.subjectId].absentPeriods++;
        break;
      case "late":
        lateDays.add(dateStr);
        bySubject[data.subjectId].latePeriods++;
        break;
      case "excused":
        excusedDays.add(dateStr);
        bySubject[data.subjectId].excusedPeriods++;
        break;
      // Present case is implicit
    }

    bySubject[data.subjectId].totalPeriods++;
  });

  // Add absence rate to each subject
  for (const subjectId in bySubject) {
    const subjectStats = bySubject[subjectId];
    subjectStats.absenceRate =
      subjectStats.totalPeriods > 0
        ? (subjectStats.absentPeriods / subjectStats.totalPeriods) * 100
        : 0;
  }

  const absenceRate =
    totalDays.size > 0 ? (absentDays.size / totalDays.size) * 100 : 0;
  const tardyRate =
    totalDays.size > 0 ? (lateDays.size / totalDays.size) * 100 : 0;

  return {
    studentId,
    startDate,
    endDate,
    totalDays: totalDays.size,
    absentDays: absentDays.size,
    lateDays: lateDays.size,
    excusedDays: excusedDays.size,
    absenceRate,
    tardyRate,
    bySubject,
  };
}

/**
 * Create attendance notification for a student and their parents
 * @param schoolId The school ID
 * @param studentId The student ID
 * @param studentName The student's name
 * @param className The class name
 * @param subjectName The subject name
 * @param status The attendance status (absent, late, excused)
 * @param date The date of the class
 * @param periodNumber The period number
 */
export async function createAttendanceNotification(
  schoolId: string,
  studentId: string,
  studentName: string,
  className: string,
  subjectName: string,
  status: "absent" | "late" | "excused",
  date: Timestamp,
  periodNumber: number
): Promise<void> {
  try {
    const formattedDate = date.toDate().toLocaleDateString();
    let notificationType: NotificationType;
    let title: string;
    let studentMessage: string;
    let parentMessage: string;

    // Set notification content based on status
    switch (status) {
      case "absent":
        notificationType = "attendance-absent";
        title = "Отсъствие";
        studentMessage = `Имате отсъствие по ${subjectName} на ${formattedDate}, ${periodNumber}-и час`;
        parentMessage = `Детето ви ${studentName} отсъства от час по ${subjectName} на ${formattedDate}, ${periodNumber}-и час`;
        break;
      case "late":
        notificationType = "attendance-late";
        title = "Закъснение";
        studentMessage = `Имате закъснение по ${subjectName} на ${formattedDate}, ${periodNumber}-и час`;
        parentMessage = `Детето ви ${studentName} закъсня за час по ${subjectName} на ${formattedDate}, ${periodNumber}-и час`;
        break;
      case "excused":
        notificationType = "attendance-excused";
        title = "Извинено отсъствие";
        studentMessage = `Имате извинено отсъствие по ${subjectName} на ${formattedDate}, ${periodNumber}-и час`;
        parentMessage = `Детето ви ${studentName} има извинено отсъствие по ${subjectName} на ${formattedDate}, ${periodNumber}-и час`;
        break;
    }

    // Create notification for the student
    await createNotification(schoolId, {
      userId: studentId,
      title,
      message: studentMessage,
      type: notificationType,
      link: `/student/attendance`, // Explicitly set the correct link
    });

    // Find parents of this student and notify them
    const parentsQuery = query(
      collection(db, "schools", schoolId, "users"),
      where("role", "==", "parent"),
      where("childrenIds", "array-contains", studentId)
    );
    const parentsSnapshot = await getDocs(parentsQuery);

    // Send notification to each parent
    for (const parentDoc of parentsSnapshot.docs) {
      const parentId = parentDoc.id;
      await createNotification(schoolId, {
        userId: parentId,
        title,
        message: parentMessage,
        type: notificationType,
        link: `/parent/attendance`, // Explicitly set the correct link
      });
    }
  } catch (error) {
    console.error("Error creating attendance notification:", error);
    // Don't throw the error to prevent disrupting the main attendance flow
    // Just log it instead
  }
}

/**
 * Load all required data for attendance form
 * @param state The current state object
 * @param teacher The teacher
 * @returns Updated state with loaded data
 */
export async function loadAndUpdateAttendanceForm(
  state: AttendancePageState,
  teacher: Teacher
): Promise<AttendancePageState> {
  if (!teacher || !state.selectedClassId || !teacher.schoolId) {
    return state;
  }

  // Create a new state object to return
  const newState = { ...state };
  newState.isLoading = true;
  newState.isCheckingExistingAttendance = true;

  try {
    // Create a timestamp for the selected date if we have all required fields
    let dateTimestamp: Timestamp | undefined = undefined;
    if (state.selectedDate) {
      dateTimestamp = Timestamp.fromDate(state.selectedDate);
    }

    // Load students and attendance data in a single call to ensure consistency
    const result = await loadStudentsWithAttendance(
      teacher.schoolId,
      state.selectedClassId,
      state.selectedSubjectId,
      dateTimestamp,
      state.selectedSubjectId && dateTimestamp
        ? state.selectedPeriod
        : undefined
    );

    newState.students = result.students;
    newState.attendanceData = result.attendanceData;
    newState.existingAttendance = result.existingRecords;
    newState.hasExistingAttendance = result.hasExistingRecords;

    if (result.hasExistingRecords) {
      console.log("Found existing attendance records:", result.existingRecords);
      toast({
        title: "Existing Records Found",
        description:
          "This class session already has attendance records. You can review or update them.",
        variant: "default",
      });
    }

    // Check if this class session exists in the timetable
    // (only if we have all required fields)
    if (state.selectedSubjectId && state.selectedDate && state.selectedPeriod) {
      newState.isCheckingTimetable = true;
      const daysOfWeek = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      const exists = await doesClassSessionExist(
        teacher.schoolId,
        state.selectedClassId,
        state.selectedSubjectId,
        daysOfWeek[new Date(state.selectedDate).getDay()], // Convert day number to day name
        state.selectedPeriod
      );

      newState.classSessionExists = exists;

      if (!exists) {
        toast({
          title: "No Scheduled Class",
          description:
            "This class session is not in the regular timetable. You can still record attendance.",
          variant: "destructive",
        });
      }

      newState.isCheckingTimetable = false;
    }

    newState.isCheckingExistingAttendance = false;
    newState.isLoading = false;
    return newState;
  } catch (error) {
    console.error("Error loading attendance form data:", error);
    newState.isLoading = false;
    newState.isCheckingExistingAttendance = false;
    return newState;
  }
}

/**
 * Handles updating attendance status for a student
 * @param state The current state object
 * @param studentId The student ID
 * @param status The new attendance status
 * @returns Updated state with the new attendance status
 */
export function handleAttendanceChange(
  state: AttendancePageState,
  studentId: string,
  status: AttendanceStatus
): AttendancePageState {
  return {
    ...state,
    attendanceData: {
      ...state.attendanceData,
      [studentId]: status,
    },
  };
}

/**
 * Get attendance statistics for the entire school
 * @param schoolId The school ID
 * @param startDate Start date for the period to analyze
 * @param endDate End date for the period to analyze
 * @returns School-wide attendance statistics
 */
export async function getSchoolAttendanceStats(
  schoolId: string,
  startDate: Timestamp,
  endDate: Timestamp
): Promise<{
  totalStudents: number;
  totalRecords: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  presentCount: number;
  absenceRate: number;
  tardyRate: number;
  byClass: Record<
    string,
    {
      totalStudents: number;
      absentCount: number;
      lateCount: number;
      absenceRate: number;
    }
  >;
}> {
  try {
    // Get all attendance records for the given period
    const schoolRef = doc(db, "schools", schoolId);
    const attendanceCollectionRef = collection(schoolRef, "attendance");

    // Query attendance within date range
    const attendanceQuery = query(
      attendanceCollectionRef,
      where("date", ">=", startDate),
      where("date", "<=", endDate)
    );

    const attendanceSnapshot = await getDocs(attendanceQuery);

    // Get all students in the school to calculate total number
    const studentsRef = collection(schoolRef, "users");
    const studentsQuery = query(studentsRef, where("role", "==", "student"));
    const studentsSnapshot = await getDocs(studentsQuery);
    const totalStudents = studentsSnapshot.size;

    // Counters for totals
    const totalRecords = attendanceSnapshot.size;
    let absentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;
    let presentCount = 0;

    // Map to track classes and their statistics
    const classesByID: Record<
      string,
      {
        name: string;
        totalStudents: number;
        attendanceRecords: number;
        absentCount: number;
        lateCount: number;
        presentCount: number;
        excusedCount: number;
      }
    > = {};

    // First pass: gather all class IDs and initialize
    for (const doc of attendanceSnapshot.docs) {
      const data = doc.data();

      // Initialize class if not exists
      if (!classesByID[data.classId]) {
        classesByID[data.classId] = {
          name: data.className || "Unknown Class",
          totalStudents: 0, // Will be counted in a separate query
          attendanceRecords: 0,
          absentCount: 0,
          lateCount: 0,
          presentCount: 0,
          excusedCount: 0,
        };
      }
    }

    // Get student counts for each class
    const classesRef = collection(schoolRef, "classes");
    const classesSnapshot = await getDocs(classesRef);

    for (const classDoc of classesSnapshot.docs) {
      const classId = classDoc.id;
      const classData = classDoc.data();

      if (classesByID[classId]) {
        // If we have records for this class, update student count
        classesByID[classId].totalStudents = classData.studentIds
          ? classData.studentIds.length
          : 0;
      }
    }

    // Second pass: count statuses
    for (const doc of attendanceSnapshot.docs) {
      const data = doc.data();
      const classId = data.classId;
      const status = data.status;

      // Update class-specific counters
      classesByID[classId].attendanceRecords++;

      // Count by status
      switch (status) {
        case "absent":
          absentCount++;
          classesByID[classId].absentCount++;
          break;
        case "late":
          lateCount++;
          classesByID[classId].lateCount++;
          break;
        case "excused":
          excusedCount++;
          classesByID[classId].excusedCount++;
          break;
        case "present":
          presentCount++;
          classesByID[classId].presentCount++;
          break;
      }
    }

    // Calculate rates
    const absenceRate =
      totalRecords > 0 ? (absentCount / totalRecords) * 100 : 0;
    const tardyRate = totalRecords > 0 ? (lateCount / totalRecords) * 100 : 0;

    // Build the final byClass object with calculated rates
    const byClass: Record<
      string,
      {
        totalStudents: number;
        absentCount: number;
        lateCount: number;
        absenceRate: number;
      }
    > = {};

    // Use entry destructuring with object - we only need the stats object
    for (const [, stats] of Object.entries(classesByID)) {
      byClass[stats.name] = {
        totalStudents: stats.totalStudents,
        absentCount: stats.absentCount,
        lateCount: stats.lateCount,
        absenceRate:
          stats.attendanceRecords > 0
            ? (stats.absentCount / stats.attendanceRecords) * 100
            : 0,
      };
    }

    return {
      totalStudents,
      totalRecords,
      absentCount,
      lateCount,
      excusedCount,
      presentCount,
      absenceRate,
      tardyRate,
      byClass,
    };
  } catch (error) {
    console.error("Error generating school attendance stats:", error);
    throw error;
  }
}

/**
 * Submit attendance for the current class
 * @param state Current state object
 * @param teacher Teacher object
 * @returns Updated state
 */
export async function submitCurrentClassAttendance(
  state: AttendancePageState,
  teacher: Teacher
): Promise<AttendancePageState> {
  try {
    if (
      !state.currentClass ||
      !teacher ||
      !teacher.schoolId ||
      !teacher.userId ||
      Object.keys(state.attendanceData).length === 0
    ) {
      return state;
    }

    const newState = { ...state, isSubmitting: true };

    // Import Firestore functions
    const { addDoc, collection, Timestamp, updateDoc, doc } = await import(
      "firebase/firestore"
    );

    // For each student, create or update an attendance record
    for (const studentId in state.attendanceData) {
      const student = state.students.find((s) => s.userId === studentId);
      if (!student) continue;

      const status = state.attendanceData[studentId];

      // Create new attendance record
      const attendanceData = {
        studentId,
        studentName: `${student.firstName} ${student.lastName}`,
        teacherId: teacher.userId,
        teacherName: `${teacher.firstName} ${teacher.lastName}`,
        classId: state.currentClass.classId,
        className: state.currentClass.className,
        subjectId: state.currentClass.subjectId,
        subjectName: state.currentClass.subjectName,
        date: Timestamp.now(),
        periodNumber: state.currentClass.period,
        status,
        justified: status === "excused", // Automatically justified if excused
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        notifiedParent: false,
      };

      // Check for existing record first
      const existingRecord = state.existingAttendance.find(
        (record) => record.studentId === studentId
      );

      if (existingRecord) {
        // Update existing record
        await updateDoc(
          doc(
            db,
            "schools",
            teacher.schoolId,
            "attendance",
            existingRecord.attendanceId
          ),
          {
            status,
            justified: status === "excused",
            updatedAt: Timestamp.now(),
          }
        );
      } else {
        // Create new record
        await addDoc(
          collection(db, "schools", teacher.schoolId, "attendance"),
          attendanceData
        );

        // Create notification if status is not 'present'
        if (status !== "present") {
          await createAttendanceNotification(
            teacher.schoolId,
            studentId,
            `${student.firstName} ${student.lastName}`,
            state.currentClass.className,
            state.currentClass.subjectName,
            status as "absent" | "late" | "excused",
            Timestamp.now(),
            state.currentClass.period
          );
        }
      }
    }

    // Show success message
    toast({
      title: "Success",
      description: "Attendance records have been saved successfully.",
      variant: "default",
    });

    return {
      ...newState,
      isSubmitting: false,
      hasExistingAttendance: true,
    };
  } catch (error) {
    console.error("Error submitting attendance:", error);

    // Show error message
    toast({
      title: "Error",
      description: "Failed to save attendance records. Please try again.",
      variant: "destructive",
    });

    return {
      ...state,
      isSubmitting: false,
    };
  }
}

/**
 * Submit attendance records for the manual entry form
 * @param state Current state object
 * @param teacher Teacher object
 * @returns Updated state
 */
export async function submitManualAttendance(
  state: AttendancePageState,
  teacher: Teacher
): Promise<AttendancePageState> {
  try {
    if (
      !state.selectedClassId ||
      !state.selectedSubjectId ||
      !state.selectedDate ||
      !teacher ||
      !teacher.schoolId ||
      !teacher.userId ||
      Object.keys(state.attendanceData).length === 0 ||
      state.classSessionExists === false
    ) {
      return state;
    }

    const newState = { ...state, isSubmitting: true };

    // Import Firestore functions
    const { addDoc, collection, Timestamp, updateDoc, doc } = await import(
      "firebase/firestore"
    );

    // Get class and subject names from the state
    const selectedClass = state.classes.find(
      (c) => c.classId === state.selectedClassId
    );
    const selectedSubject = state.subjects.find(
      (s) => s.subjectId === state.selectedSubjectId
    );

    if (!selectedClass || !selectedSubject) {
      toast({
        title: "Error",
        description: "Class or subject information is missing.",
        variant: "destructive",
      });
      return { ...state, isSubmitting: false };
    }

    // Create a timestamp for the selected date
    const dateTimestamp = Timestamp.fromDate(state.selectedDate);

    // For each student, create or update an attendance record
    for (const studentId in state.attendanceData) {
      const student = state.students.find((s) => s.userId === studentId);
      if (!student) continue;

      const status = state.attendanceData[studentId];

      // Create attendance record data
      const attendanceData = {
        studentId,
        studentName: `${student.firstName} ${student.lastName}`,
        teacherId: teacher.userId,
        teacherName: `${teacher.firstName} ${teacher.lastName}`,
        classId: state.selectedClassId,
        className: selectedClass.className,
        subjectId: state.selectedSubjectId,
        subjectName: selectedSubject.name,
        date: dateTimestamp,
        periodNumber: state.selectedPeriod,
        status,
        justified: status === "excused", // Automatically justified if excused
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        notifiedParent: false,
      };

      // Check for existing record first
      const existingRecord = state.existingAttendance.find(
        (record) => record.studentId === studentId
      );

      if (existingRecord) {
        // Update existing record
        await updateDoc(
          doc(
            db,
            "schools",
            teacher.schoolId,
            "attendance",
            existingRecord.attendanceId
          ),
          {
            status,
            justified: status === "excused",
            updatedAt: Timestamp.now(),
          }
        );
      } else {
        // Create new record
        await addDoc(
          collection(db, "schools", teacher.schoolId, "attendance"),
          attendanceData
        );

        // Create notification if status is not "present"
        if (status !== "present") {
          await createAttendanceNotification(
            teacher.schoolId,
            studentId,
            `${student.firstName} ${student.lastName}`,
            selectedClass.className,
            selectedSubject.name,
            status as "absent" | "late" | "excused",
            dateTimestamp,
            state.selectedPeriod
          );
        }
      }
    }

    // Show success message
    toast({
      title: "Success",
      description: state.hasExistingAttendance
        ? "Attendance records have been updated successfully."
        : "Attendance records have been saved successfully.",
      variant: "default",
    });

    return {
      ...newState,
      isSubmitting: false,
      hasExistingAttendance: true,
    };
  } catch (error) {
    console.error("Error submitting manual attendance:", error);

    // Show error message
    toast({
      title: "Error",
      description: "Failed to save attendance records. Please try again.",
      variant: "destructive",
    });

    return {
      ...state,
      isSubmitting: false,
    };
  }
}
