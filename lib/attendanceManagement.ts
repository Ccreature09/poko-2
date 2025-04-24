/**
 * Utilities for attendance management in the application
 * 
 * This file contains functions for:
 * - Recording student attendance
 * - Retrieving attendance records
 * - Generating attendance reports
 * - Managing absence justifications
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
import type { AttendanceRecord, AttendanceReport, AttendanceStatus } from './interfaces';
import { createNotification, type NotificationType } from './notificationManagement';

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
  
  // Record attendance for each student
  const attendancePromises = attendanceRecords.map(async (record) => {
    // Get student details
    const studentRef = doc(schoolRef, 'users', record.studentId);
    const studentDoc = await getDoc(studentRef);
    const studentData = studentDoc.data();
    
    // Create attendance record
    const attendanceRef = await addDoc(attendanceCollectionRef, {
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
      createdAt: Timestamp.now(),
      notifiedParent: false,
      updatedAt: Timestamp.now(),
    });
    
    // Send notifications for absent, late, or excused students
    if (record.status === 'absent' || record.status === 'late' || record.status === 'excused') {
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
        await updateDoc(attendanceRef, { notifiedParent: true });
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
 * Get attendance records for a class
 * @param schoolId The school ID
 * @param classId The class ID
 * @param date The date for filtering
 */
export async function getClassAttendance(
  schoolId: string,
  classId: string,
  date: Timestamp
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
 * Get attendance statistics for a school
 * @param schoolId The school ID
 * @param startDate Start date for the report period
 * @param endDate End date for the report period
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
  
  // Get total students count
  const studentsQuery = query(usersCollectionRef, where('role', '==', 'student'));
  const studentsSnapshot = await getDocs(studentsQuery);
  const totalStudents = studentsSnapshot.size;
  
  // Get attendance data for the period
  const attendanceQuery = query(
    attendanceCollectionRef,
    where('date', '>=', startDate),
    where('date', '<=', endDate)
  );
  
  const attendanceSnapshot = await getDocs(attendanceQuery);
  
  let absentCount = 0;
  let lateCount = 0;
  let excusedCount = 0;
  let presentCount = 0;
  const byClass: Record<string, {
    totalStudents: number;
    absentCount: number;
    lateCount: number;
    absenceRate: number;
  }> = {};
  
  const studentsByClass: Record<string, Set<string>> = {};
  
  // First pass to collect students per class
  attendanceSnapshot.forEach((doc) => {
    const data = doc.data();
    
    if (!studentsByClass[data.classId]) {
      studentsByClass[data.classId] = new Set();
    }
    
    studentsByClass[data.classId].add(data.studentId);
  });
  
  // Initialize class stats
  for (const classId in studentsByClass) {
    byClass[classId] = {
      totalStudents: studentsByClass[classId].size,
      absentCount: 0,
      lateCount: 0,
      absenceRate: 0
    };
  }
  
  // Second pass to count statuses
  attendanceSnapshot.forEach((doc) => {
    const data = doc.data();
    
    // Count by status
    switch (data.status) {
      case 'absent':
        absentCount++;
        byClass[data.classId].absentCount++;
        break;
      case 'late':
        lateCount++;
        byClass[data.classId].lateCount++;
        break;
      case 'excused':
        excusedCount++;
        break;
      case 'present':
        presentCount++;
        break;
    }
  });
  
  const totalRecords = absentCount + lateCount + excusedCount + presentCount;
  const absenceRate = totalRecords > 0 ? (absentCount / totalRecords) * 100 : 0;
  const tardyRate = totalRecords > 0 ? (lateCount / totalRecords) * 100 : 0;
  
  // Calculate absence rate for each class
  for (const classId in byClass) {
    const classStats = byClass[classId];
    const classRecords = classStats.absentCount + classStats.lateCount;
    const classTotal = totalRecords * (classStats.totalStudents / totalStudents);
    classStats.absenceRate = classTotal > 0 ? (classStats.absentCount / classTotal) * 100 : 0;
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

/**
 * Create attendance notification for a student and their parents
 * @param schoolId The school ID
 * @param studentId The student ID
 * @param studentName The student's name
 * @param classId The class ID
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