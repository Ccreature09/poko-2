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

import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  Timestamp,
  DocumentData,
  runTransaction,
  updateDoc
} from 'firebase/firestore';
import type { AttendanceRecord, AttendanceReport, AttendanceStatus, HomeroomClass, Student, Subject, Teacher } from './interfaces';
import { createNotification, type NotificationType } from './notificationManagement';
import { getStudentsInClass } from './schoolManagement';
import { getClassesTaughtByTeacher, doesClassSessionExist } from './timetableManagement';
import { toast } from '@/hooks/use-toast';

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
    selectedClassId: '',
    selectedSubjectId: '',
    selectedDate: new Date(),
    selectedPeriod: 1,
    currentClass: null,
    activeTab: 'current-class'
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
  const classIdParam = searchParams.get('classId');
  const subjectIdParam = searchParams.get('subjectId');
  const tabParam = searchParams.get('tab');
  const dateParam = searchParams.get('date');
  const periodParam = searchParams.get('period');
  
  // Set active tab if provided
  if (tabParam === 'manual-entry') {
    updatedState.activeTab = 'manual-entry';
  }
  
  // Set class if provided and valid
  if (classIdParam && classes.some(c => c.classId === classIdParam)) {
    updatedState.selectedClassId = classIdParam;
    
    // Set subject if provided and valid
    if (subjectIdParam && subjects.some(s => s.subjectId === subjectIdParam)) {
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
export function detectCurrentClass(sessions: ClassSession[]): CurrentClass | null {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTimeAsMinutes = currentHour * 60 + currentMinutes;
  
  // Map JavaScript day (0=Sunday, 1=Monday, etc.) to day names in timetable
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDay = daysOfWeek[now.getDay()];
  
  // Find class session that matches current day and time
  const currentSession = sessions.find(session => {
    if (session.day !== currentDay) return false;
    
    // Convert session times to minutes for comparison
    const [startHour, startMinute] = session.startTime.split(':').map(Number);
    const [endHour, endMinute] = session.endTime.split(':').map(Number);
    const startTimeAsMinutes = startHour * 60 + startMinute;
    const endTimeAsMinutes = endHour * 60 + endMinute;
    
    // Check if current time falls within class period
    return currentTimeAsMinutes >= startTimeAsMinutes && currentTimeAsMinutes <= endTimeAsMinutes;
  });
  
  if (currentSession) {
    return {
      classId: currentSession.classId,
      className: currentSession.className,
      subjectId: currentSession.subjectId,
      subjectName: currentSession.subjectName,
      period: currentSession.period
    };
  }
  
  return null;
}

/**
 * Loads class sessions for a teacher
 * @param schoolId The school ID
 * @param teacherId The teacher ID
 * @returns Object containing class sessions, unique classes, and unique subjects
 */
export async function loadTeacherClassData(schoolId: string, teacherId: string): Promise<{
  classSessions: ClassSession[];
  classes: HomeroomClass[];
  subjects: Subject[];
  currentClass: CurrentClass | null;
}> {
  const teacherClassSessions = await getClassesTaughtByTeacher(schoolId, teacherId);
  
  // Process the class sessions to get unique classes and subjects
  const uniqueClasses = new Map();
  const uniqueSubjects = new Map();
  
  // Add each class and subject to the maps to remove duplicates
  teacherClassSessions.forEach((session) => {
    uniqueClasses.set(session.classId, {
      classId: session.classId,
      className: session.className
    });
    
    uniqueSubjects.set(session.subjectId, {
      subjectId: session.subjectId,
      name: session.subjectName
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
    currentClass
  };
}

/**
 * Load students for a class and initialize attendance data
 * @param schoolId The school ID
 * @param classId The class ID
 * @returns Students array and initial attendance data
 */
export async function loadStudentsForAttendance(schoolId: string, classId: string): Promise<{
  students: Student[];
  initialAttendanceData: Record<string, AttendanceStatus>;
}> {
  const classStudents = await getStudentsInClass(schoolId, classId);
  
  // Initialize attendance data for all students as 'present'
  const initialAttendanceData: Record<string, AttendanceStatus> = {};
  classStudents.forEach((student: Student) => {
    initialAttendanceData[student.userId] = 'present';
  });
  
  return {
    students: classStudents,
    initialAttendanceData
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
  students.forEach(student => {
    initialAttendanceData[student.userId] = 'present';
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
        console.log('Found existing attendance records:', existingRecords);
        
        // Merge existing records with the initial data
        const mergedAttendanceData = { ...initialAttendanceData };
        
        // Override with actual recorded values
        existingRecords.forEach(record => {
          mergedAttendanceData[record.studentId] = record.status;
        });
        
        console.log('Merged attendance data:', mergedAttendanceData);
        
        return {
          students,
          attendanceData: mergedAttendanceData,
          hasExistingRecords: true,
          existingRecords
        };
      }
    } catch (error) {
      console.error('Error loading existing attendance:', error);
    }
  }
  
  // If no existing records or any error occurred, return initial data
  return {
    students,
    attendanceData: initialAttendanceData,
    hasExistingRecords: false,
    existingRecords: []
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
  const schoolRef = doc(db, 'schools', schoolId);
  const attendanceCollectionRef = collection(schoolRef, 'attendance');
  
  // Convert date to start and end of day
  const startOfDay = new Date(date.toDate());
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date.toDate());
  endOfDay.setHours(23, 59, 59, 999);
  
  const attendanceQuery = query(
    attendanceCollectionRef,
    where('classId', '==', classId),
    where('subjectId', '==', subjectId),
    where('periodNumber', '==', periodNumber),
    where('date', '>=', Timestamp.fromDate(startOfDay)),
    where('date', '<=', Timestamp.fromDate(endOfDay))
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
  const schoolRef = doc(db, 'schools', schoolId);
  const attendanceCollectionRef = collection(schoolRef, 'attendance');
  
  // Verify parent-child relationship (future enhancement)
  
  // Build query with filters
  let attendanceQuery = query(
    attendanceCollectionRef, 
    where('studentId', '==', studentId),
    orderBy('date', 'desc')
  );
  
  if (startDate) {
    attendanceQuery = query(attendanceQuery, where('date', '>=', startDate));
  }
  
  if (endDate) {
    attendanceQuery = query(attendanceQuery, where('date', '<=', endDate));
  }
  
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
  const schoolRef = doc(db, 'schools', schoolId);
  const attendanceCollectionRef = collection(schoolRef, 'attendance');
  
  const attendanceQuery = query(
    attendanceCollectionRef,
    where('studentId', '==', studentId),
    where('date', '>=', startDate),
    where('date', '<=', endDate)
  );
  
  const attendanceSnapshot = await getDocs(attendanceQuery);
  
  let absentCount = 0;
  let lateCount = 0;
  let excusedCount = 0;
  let presentCount = 0;
  let totalDays = new Set<string>();
  let absentDays = new Set<string>();
  let lateDays = new Set<string>();
  let excusedDays = new Set<string>();
  const bySubject: Record<string, { 
    absentPeriods: number; 
    latePeriods: number; 
    excusedPeriods: number;
    totalPeriods: number;
    absenceRate?: number;
  }> = {};
  
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
        totalPeriods: 0
      };
    }
    
    // Count by status
    switch (data.status) {
      case 'absent':
        absentCount++;
        absentDays.add(dateStr);
        bySubject[data.subjectId].absentPeriods++;
        break;
      case 'late':
        lateCount++;
        lateDays.add(dateStr);
        bySubject[data.subjectId].latePeriods++;
        break;
      case 'excused':
        excusedCount++;
        excusedDays.add(dateStr);
        bySubject[data.subjectId].excusedPeriods++;
        break;
      case 'present':
        presentCount++;
        break;
    }
    
    bySubject[data.subjectId].totalPeriods++;
  });
  
  // Add absence rate to each subject
  for (const subjectId in bySubject) {
    const subjectStats = bySubject[subjectId];
    subjectStats.absenceRate = subjectStats.totalPeriods > 0 
      ? (subjectStats.absentPeriods / subjectStats.totalPeriods) * 100 
      : 0;
  }
  
  const absenceRate = totalDays.size > 0 ? (absentDays.size / totalDays.size) * 100 : 0;
  const tardyRate = totalDays.size > 0 ? (lateDays.size / totalDays.size) * 100 : 0;
  
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
    bySubject
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
  status: 'absent' | 'late' | 'excused',    
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
      case 'absent':
        notificationType = 'attendance-absent';
        title = 'Отсъствие';
        studentMessage = `Имате отсъствие по ${subjectName} на ${formattedDate}, ${periodNumber}-и час`;
        parentMessage = `Детето ви ${studentName} отсъства от час по ${subjectName} на ${formattedDate}, ${periodNumber}-и час`;
        break;
      case 'late':
        notificationType = 'attendance-late';
        title = 'Закъснение';
        studentMessage = `Имате закъснение по ${subjectName} на ${formattedDate}, ${periodNumber}-и час`;
        parentMessage = `Детето ви ${studentName} закъсня за час по ${subjectName} на ${formattedDate}, ${periodNumber}-и час`;
        break;
      case 'excused':
        notificationType = 'attendance-excused';
        title = 'Извинено отсъствие';
        studentMessage = `Имате извинено отсъствие по ${subjectName} на ${formattedDate}, ${periodNumber}-и час`;
        parentMessage = `Детето ви ${studentName} има извинено отсъствие по ${subjectName} на ${formattedDate}, ${periodNumber}-и час`;
        break;
    }

    // Create notification for the student
    await createNotification(schoolId, {
      userId: studentId,
      title,
      message: studentMessage,
      type: notificationType
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
        type: notificationType
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
  if (!teacher || !state.selectedClassId) {
    return state;
  }
  
  // Create a new state object to return
  const newState = { ...state };
  newState.isLoading = true;
  newState.isCheckingExistingAttendance = true;
  
  try {
    // Create a timestamp for the selected date if we have all required fields
    let dateTimestamp = undefined;
    if (state.selectedDate) {
      dateTimestamp = Timestamp.fromDate(state.selectedDate);
    }
    
    // Load students and attendance data in a single call to ensure consistency
    const result = await loadStudentsWithAttendance(
      teacher.schoolId,
      state.selectedClassId,
      state.selectedSubjectId,
      dateTimestamp,
      state.selectedSubjectId && dateTimestamp ? state.selectedPeriod : undefined
    );
    
    newState.students = result.students;
    newState.attendanceData = result.attendanceData;
    newState.existingAttendance = result.existingRecords;
    newState.hasExistingAttendance = result.hasExistingRecords;
    
    if (result.hasExistingRecords) {
      console.log('Found existing attendance records:', result.existingRecords);
      toast({
        title: "Existing Records Found",
        description: "This class session already has attendance records. You can review or update them.",
        variant: "default",
      });
    }
    
    // Check if this class session exists in the timetable 
    // (only if we have all required fields)
    if (state.selectedSubjectId && state.selectedDate && state.selectedPeriod) {
      newState.isCheckingTimetable = true;
      const exists = await checkClassSessionExists(
        teacher.schoolId,
        state.selectedClassId,
        state.selectedSubjectId,
        state.selectedDate,
        state.selectedPeriod
      );
      
      newState.classSessionExists = exists;
      
      if (!exists) {
        // Get class name and subject name for error message
        const className = state.classes.find(c => c.classId === state.selectedClassId)?.className || "selected class";
        const subjectName = state.subjects.find(s => s.subjectId === state.selectedSubjectId)?.name || "selected subject";
        const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][state.selectedDate.getDay()];
        
        toast({
          title: "No Scheduled Class",
          description: `There is no ${subjectName} class scheduled for ${className} on ${dayOfWeek}, period ${state.selectedPeriod}.`,
          variant: "destructive",
        });
      }
    }
  } catch (error) {
    console.error("Error loading attendance data:", error);
    toast({
      title: "Error",
      description: "Failed to load attendance data. Please try again.",
      variant: "destructive",
    });
  } finally {
    newState.isLoading = false;
    newState.isCheckingExistingAttendance = false;
    newState.isCheckingTimetable = false;
  }
  
  return newState;
}

/**
 * Load student data for a specific class
 * @param state The current state object
 * @param schoolId The school ID
 * @param classId The class ID
 * @returns Updated state with loaded student data
 */
export async function loadStudentData(
  state: AttendancePageState,
  schoolId: string, 
  classId: string
): Promise<AttendancePageState> {
  if (!schoolId || !classId) {
    return state;
  }
  
  const newState = { ...state };
  newState.isLoading = true;
  
  try {
    console.log(`Fetching students for class ID: ${classId}, school ID: ${schoolId}`);
    
    const { students, initialAttendanceData } = await loadStudentsForAttendance(schoolId, classId);
    console.log('Students returned from database:', students);
    
    if (!students || students.length === 0) {
      console.warn(`No students found for class ID: ${classId}`);
    }
    
    newState.students = students;
    
    // Only set initial attendance data if we don't already have existing records
    // This prevents overwriting existing attendance data when students are loaded
    if (!newState.hasExistingAttendance) {
      newState.attendanceData = initialAttendanceData;
    }
  } catch (error) {
    console.error("Error fetching students:", error);
    toast({
      title: "Error",
      description: "Could not load students. Please try again.",
      variant: "destructive",
    });
  } finally {
    newState.isLoading = false;
  }
  
  return newState;
}

/**
 * Refresh current class detection
 * @param state The current state object
 * @param teacher The teacher
 * @returns Updated state with refreshed current class data
 */
export async function refreshCurrentClass(
  state: AttendancePageState,
  teacher: Teacher
): Promise<AttendancePageState> {
  if (!teacher) {
    return state;
  }
  
  const newState = { ...state };
  newState.isLoading = true;
  
  try {
    const { currentClass } = await loadTeacherClassData(teacher.schoolId, teacher.userId);
    
    newState.currentClass = currentClass;
    
    if (currentClass) {
      // Load students for this class
      return await loadStudentData(newState, teacher.schoolId, currentClass.classId);
    }
  } catch (error) {
    console.error("Error refreshing current class:", error);
    toast({
      title: "Error",
      description: "Could not refresh current class. Please try again.",
      variant: "destructive",
    });
  } finally {
    newState.isLoading = false;
  }
  
  return newState;
}

/**
 * Submit attendance records for current class
 * @param state The current state object
 * @param teacher The teacher
 * @returns Updated state after submission
 */
export async function submitCurrentClassAttendance(
  state: AttendancePageState,
  teacher: Teacher
): Promise<AttendancePageState> {
  if (!teacher || !state.currentClass) {
    toast({
      title: "No current class",
      description: "No active class was detected at this time.",
      variant: "destructive",
    });
    return state;
  }
  
  const newState = { ...state };
  newState.isSubmitting = true;
  
  try {
    // Format the attendance data for submission
    const attendanceRecords = Object.entries(state.attendanceData).map(([studentId, status]) => ({
      studentId,
      status
    }));
    
    // Record attendance for the current class
    await recordClassAttendance(
      teacher.schoolId,
      teacher.userId,
      state.currentClass.classId,
      state.currentClass.subjectId,
      Timestamp.fromDate(new Date()),  // Use current date and time
      state.currentClass.period,
      attendanceRecords
    );
    
    toast({
      title: "Success!",
      description: "Attendance for current class has been recorded successfully.",
      variant: "default",
    });
    
    // Reset form (but keep current class)
    newState.students = [];
    newState.attendanceData = {};
    
  } catch (error) {
    console.error("Error recording attendance:", error);
    toast({
      title: "Error",
      description: "Failed to record attendance. Please try again.",
      variant: "destructive",
    });
  } finally {
    newState.isSubmitting = false;
  }
  
  return newState;
}

/**
 * Submit attendance records for manual entry
 * @param state The current state object
 * @param teacher The teacher
 * @returns Updated state after submission
 */
export async function submitManualAttendance(
  state: AttendancePageState,
  teacher: Teacher
): Promise<AttendancePageState> {
  if (!teacher || !state.selectedClassId || !state.selectedSubjectId) {
    toast({
      title: "Missing information",
      description: "Please select a class and subject before submitting.",
      variant: "destructive",
    });
    return state;
  }
  
  if (state.classSessionExists === false) {
    toast({
      title: "No Scheduled Class",
      description: "Cannot mark attendance for a class that is not scheduled at this time.",
      variant: "destructive",
    });
    return state;
  }
  
  const newState = { ...state };
  newState.isSubmitting = true;
  
  try {
    // Format the attendance data for submission
    const attendanceRecords = Object.entries(state.attendanceData).map(([studentId, status]) => ({
      studentId,
      status
    }));
    
    // Record attendance for the class
    await recordClassAttendance(
      teacher.schoolId,
      teacher.userId,
      state.selectedClassId,
      state.selectedSubjectId,
      Timestamp.fromDate(state.selectedDate),
      state.selectedPeriod,
      attendanceRecords
    );
    
    toast({
      title: "Success!",
      description: "Attendance has been recorded successfully.",
      variant: "default",
    });
    
    // Reset form
    newState.selectedClassId = '';
    newState.selectedSubjectId = '';
    newState.selectedPeriod = 1;
    newState.students = [];
    newState.attendanceData = {};
    newState.classSessionExists = null;
    
  } catch (error) {
    console.error("Error recording attendance:", error);
    toast({
      title: "Error",
      description: "Failed to record attendance. Please try again.",
      variant: "destructive",
    });
  } finally {
    newState.isSubmitting = false;
  }
  
  return newState;
}

/**
 * Update attendance status for a student
 * @param state The current state object
 * @param studentId The student ID
 * @param status The new attendance status
 * @returns Updated state with new attendance data
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
      [studentId]: status
    }
  };
}

/**
 * Initial load of classes and other data for the attendance page
 * @param state The current state object
 * @param teacher The teacher
 * @returns Updated state with loaded classes data
 */
export async function fetchInitialClassesData(
  state: AttendancePageState,
  teacher: Teacher
): Promise<AttendancePageState> {
  if (!teacher) {
    return state;
  }
  
  const newState = { ...state };
  newState.isLoading = true;
  
  try {
    const { classSessions, classes, subjects, currentClass } = await loadTeacherClassData(
      teacher.schoolId, 
      teacher.userId
    );
    
    console.log('Loaded class sessions:', classSessions);
    
    // Save the data to state
    newState.classSessions = classSessions;
    newState.classes = classes;
    newState.subjects = subjects;
    newState.currentClass = currentClass;
    
    // If current class was found, load students for it
    if (currentClass) {
      return await loadStudentData(newState, teacher.schoolId, currentClass.classId);
    }
  } catch (error) {
    console.error("Error fetching teacher classes:", error);
    toast({
      title: "Error",
      description: "Could not load classes. Please try again.",
      variant: "destructive",
    });
  } finally {
    newState.isLoading = false;
  }
  
  return newState;
}

/**
 * Check if a class session exists in the timetable for a specific date and period
 * @param schoolId The school ID
 * @param classId The class ID
 * @param subjectId The subject ID
 * @param selectedDate The selected date
 * @param periodNumber The period number
 * @returns Boolean indicating if the class session exists
 */
export async function checkClassSessionExists(
  schoolId: string,
  classId: string,
  subjectId: string,
  selectedDate: Date,
  periodNumber: number
): Promise<boolean> {
  // Convert selected date to day of week name
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = daysOfWeek[selectedDate.getDay()];
  
  // Check if this class session exists in the timetable
  return await doesClassSessionExist(
    schoolId,
    classId,
    subjectId,
    dayOfWeek,
    periodNumber
  );
}

/**
 * Record attendance for a class
 * @param schoolId The school ID
 * @param teacherId The teacher who recorded the attendance
 * @param classId The class ID
 * @param subjectId The subject ID
 * @param date The date of the class
 * @param periodNumber The period number
 * @param attendanceRecords Array of student attendance records
 */
export async function recordClassAttendance(
  schoolId: string,
  teacherId: string,
  classId: string,
  subjectId: string,
  date: Timestamp,
  periodNumber: number,
  attendanceRecords: Array<{
    studentId: string;
    status: AttendanceStatus;
  }>
): Promise<void> {
  const schoolRef = doc(db, 'schools', schoolId);
  const attendanceCollectionRef = collection(schoolRef, 'attendance');
  
  // Get teacher and subject details
  const teacherRef = doc(schoolRef, 'users', teacherId);
  const teacherDoc = await getDoc(teacherRef);
  const teacherData = teacherDoc.data();
  
  const subjectRef = doc(schoolRef, 'subjects', subjectId);
  const subjectDoc = await getDoc(subjectRef);
  const subjectData = subjectDoc.data();
  
  // Get class details
  const classRef = doc(schoolRef, 'classes', classId);
  const classDoc = await getDoc(classRef);
  const classData = classDoc.data();
  
  // First, get existing attendance records for this class session
  const existingRecords = await getClassSessionAttendance(
    schoolId,
    classId,
    subjectId,
    date,
    periodNumber
  );
  
  // Create a map of existing records by student ID for quick lookup
  const existingRecordsByStudent = new Map<string, AttendanceRecord>();
  existingRecords.forEach(record => {
    existingRecordsByStudent.set(record.studentId, record);
  });
  
  console.log(`Found ${existingRecords.length} existing attendance records for this class session`);
  
  // Process each student's attendance
  const attendancePromises = attendanceRecords.map(async (record: {studentId: string; status: AttendanceStatus}) => {
    // Get student details
    const studentRef = doc(schoolRef, 'users', record.studentId);
    const studentDoc = await getDoc(studentRef);
    const studentData = studentDoc.data();
    
    // Check if the student already has an attendance record for this class session
    const existingRecord = existingRecordsByStudent.get(record.studentId);
    
    // Common attendance data
    const attendanceData = {
      studentId: record.studentId,
      studentName: `${studentData?.firstName} ${studentData?.lastName}`,
      teacherId,
      teacherName: `${teacherData?.firstName} ${teacherData?.lastName}`,
      classId,
      className: classData?.className,
      subjectId,
      subjectName: subjectData?.name,
      date,
      periodNumber,
      status: record.status,
      justified: record.status === 'excused',
      updatedAt: Timestamp.now(), 
    };
    
    let attendanceRef;
    
    if (existingRecord) {
      // Update existing record
      console.log(`Updating existing attendance record for student ${record.studentId}:`, existingRecord.attendanceId);
      attendanceRef = doc(attendanceCollectionRef, existingRecord.attendanceId);
      await updateDoc(attendanceRef, attendanceData);
    } else {
      // Create new record
      console.log(`Creating new attendance record for student ${record.studentId}`);
      attendanceRef = await addDoc(attendanceCollectionRef, {
        ...attendanceData,
        createdAt: Timestamp.now(),
        notifiedParent: false,
      });
    }
    
    // Send notifications for absent, late, or excused students
    // Only send notifications for new statuses or when the status has changed
    if ((record.status === 'absent' || record.status === 'late' || record.status === 'excused') && 
        (!existingRecord || existingRecord.status !== record.status)) {
      try {
        // Create and send notifications to student and parents
        await createAttendanceNotification(
          schoolId,
          record.studentId,
          `${studentData?.firstName} ${studentData?.lastName}`,
          classData?.className,
          subjectData?.name,
          record.status as 'absent' | 'late' | 'excused',
          date,
          periodNumber
        );
        
        // Mark attendance record as notified
        if (attendanceRef) {
          if (existingRecord) {
            await updateDoc(attendanceRef, { notifiedParent: true });
          } else if ('id' in attendanceRef) {
            await updateDoc(doc(attendanceCollectionRef, attendanceRef.id), { notifiedParent: true });
          }
        }
      } catch (error) {
        console.error(`Failed to send attendance notification for student ${record.studentId}:`, error);
        // Don't stop the flow if notification fails
      }
    }
    
    return attendanceRef;
  });
  
  await Promise.all(attendancePromises);
}

/**
 * Get school-wide attendance statistics for a date range
 * @param schoolId The school ID
 * @param startDate The start date of the range
 * @param endDate The end date of the range
 * @returns School attendance statistics
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
  byClass: Record<string, {
    totalStudents: number;
    absentCount: number;
    lateCount: number;
    absenceRate: number;
  }>
}> {
  const schoolRef = doc(db, 'schools', schoolId);
  const attendanceCollectionRef = collection(schoolRef, 'attendance');
  const usersCollectionRef = collection(schoolRef, 'users');
  const classesCollectionRef = collection(schoolRef, 'classes');
  
  // Get all attendance records for the time period
  const attendanceQuery = query(
    attendanceCollectionRef,
    where('date', '>=', startDate),
    where('date', '<=', endDate)
  );
  
  // Get all students in the school
  const studentsQuery = query(
    usersCollectionRef,
    where('role', '==', 'student')
  );
  
  // Get all classes in the school
  const classesQuery = query(classesCollectionRef);
  
  // Execute queries in parallel for better performance
  const [attendanceSnapshot, studentsSnapshot, classesSnapshot] = await Promise.all([
    getDocs(attendanceQuery),
    getDocs(studentsQuery),
    getDocs(classesQuery)
  ]);
  
  // Process attendance data
  let totalRecords = 0;
  let absentCount = 0;
  let lateCount = 0;
  let excusedCount = 0;
  let presentCount = 0;
  
  // Track attendance by class
  const classByIdMap = new Map<string, string>();
  const classByStudent = new Map<string, string>();
  const attendanceByClass: Record<string, {
    totalStudents: number;
    absentCount: number;
    lateCount: number;
    excusedCount: number;
    presentCount: number;
    absenceRate: number;
  }> = {};
  
  // Initialize class map with class names
  classesSnapshot.forEach(doc => {
    const classData = doc.data();
    classByIdMap.set(doc.id, classData.className);
    attendanceByClass[classData.className] = {
      totalStudents: 0,
      absentCount: 0,
      lateCount: 0,
      excusedCount: 0,
      presentCount: 0,
      absenceRate: 0
    };
  });
  
  // Map students to their classes
  const studentClassQuery = query(collection(schoolRef, 'class_enrollments'));
  const studentClassSnapshot = await getDocs(studentClassQuery);
  studentClassSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.studentId && data.classId) {
      const className = classByIdMap.get(data.classId) || data.classId;
      classByStudent.set(data.studentId, className);
    }
  });
  
  // Count students per class
  studentsSnapshot.forEach(doc => {
    const studentId = doc.id;
    const className = classByStudent.get(studentId);
    if (className && attendanceByClass[className]) {
      attendanceByClass[className].totalStudents++;
    }
  });
  
  // Process attendance records
  attendanceSnapshot.forEach(doc => {
    const data = doc.data();
    totalRecords++;
    
    // Get class name for this student
    const className = data.className || classByStudent.get(data.studentId) || 'Unknown';
    
    // Initialize class if not exists
    if (!attendanceByClass[className]) {
      attendanceByClass[className] = {
        totalStudents: 0,
        absentCount: 0,
        lateCount: 0,
        excusedCount: 0,
        presentCount: 0,
        absenceRate: 0
      };
    }
    
    // Count by status
    switch (data.status) {
      case 'absent':
        absentCount++;
        attendanceByClass[className].absentCount++;
        break;
      case 'late':
        lateCount++;
        attendanceByClass[className].lateCount++;
        break;
      case 'excused':
        excusedCount++;
        attendanceByClass[className].excusedCount++;
        break;
      case 'present':
        presentCount++;
        attendanceByClass[className].presentCount++;
        break;
    }
  });
  
  const totalStudents = studentsSnapshot.size;
  
  // Calculate rates
  const absenceRate = totalRecords > 0 ? (absentCount / totalRecords) * 100 : 0;
  const tardyRate = totalRecords > 0 ? (lateCount / totalRecords) * 100 : 0;
  
  // Calculate absence rate for each class
  for (const className in attendanceByClass) {
    const classStats = attendanceByClass[className];
    const totalClassRecords = classStats.absentCount + classStats.lateCount + 
                              classStats.excusedCount + classStats.presentCount;
    classStats.absenceRate = totalClassRecords > 0 
      ? (classStats.absentCount / totalClassRecords) * 100 
      : 0;
  }
  
  // Format the result for the client
  const byClass: Record<string, {
    totalStudents: number;
    absentCount: number;
    lateCount: number;
    absenceRate: number;
  }> = {};
  
  // Convert to the expected output format
  for (const className in attendanceByClass) {
    byClass[className] = {
      totalStudents: attendanceByClass[className].totalStudents,
      absentCount: attendanceByClass[className].absentCount,
      lateCount: attendanceByClass[className].lateCount,
      absenceRate: attendanceByClass[className].absenceRate
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
    byClass
  };
}