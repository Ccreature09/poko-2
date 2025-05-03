import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  getDoc,
  query,
  where,
} from "firebase/firestore";
import type { HomeroomClass, ClassSession, Subject } from "@/lib/interfaces";

export const getClasses = async (
  schoolId: string
): Promise<HomeroomClass[]> => {
  const classesRef = collection(db, "schools", schoolId, "classes");
  const snapshot = await getDocs(classesRef);
  return snapshot.docs.map(
    (doc) =>
      ({
        classId: doc.id,
        ...doc.data(),
      } as HomeroomClass)
  );
};

export const saveTimetable = async (
  schoolId: string,
  timetable: ClassSession
): Promise<void> => {
  try {
    const timetableRef = doc(collection(db, "schools", schoolId, "timetables"));
    const { ...timetableData } = timetable;
    await setDoc(timetableRef, { ...timetableData }, { merge: true });
  } catch (error) {
    console.error("Error saving timetable:", error);
  }
};

export const getTimetable = async (
  schoolId: string,
  classId: string
): Promise<ClassSession> => {
  const timetableRef = doc(db, "schools", schoolId, "timetables", classId);
  const snapshot = await getDoc(timetableRef);
  return snapshot.exists()
    ? (snapshot.data() as ClassSession)
    : { entries: [], homeroomClassId: "" };
};

export const fetchTimetablesByHomeroomClassId = async (
  schoolId: string,
  homeroomClassId: string
): Promise<{ id: string; data: ClassSession }[]> => {
  const timetablesRef = collection(db, "schools", schoolId, "timetables");
  const q = query(
    timetablesRef,
    where("homeroomClassId", "==", homeroomClassId)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    data: doc.data() as ClassSession,
  }));
};

/**
 * Get all classes and subjects for a teacher
 * @param schoolId ID of the school
 * @param teacherId ID of the teacher
 * @returns Object containing classes and subjects arrays
 */
export async function getTeacherClasses(
  schoolId: string,
  teacherId: string
): Promise<{ classes: HomeroomClass[]; subjects: Subject[] }> {
  console.log(
    `Fetching classes for teacher ${teacherId} in school ${schoolId}`
  );
  const schoolRef = doc(db, "schools", schoolId);
  const classesRef = collection(schoolRef, "classes");

  // First, get ALL classes to check if they exist
  const allClassesSnapshot = await getDocs(classesRef);
  console.log(`Total classes in school: ${allClassesSnapshot.size}`);

  // Now get classes where the teacher is assigned
  const classesQuery = query(
    classesRef,
    where("teacherIds", "array-contains", teacherId)
  );

  // Also check classes where the teacher is the homeroom teacher
  const homeroomQuery = query(
    classesRef,
    where("classTeacherId", "==", teacherId)
  );

  const subjectsRef = collection(schoolRef, "subjects");

  // Get subjects where the teacher teaches
  const subjectsQuery = query(
    subjectsRef,
    where("teacherIds", "array-contains", teacherId)
  );

  const [classesSnapshot, homeroomSnapshot, subjectsSnapshot] =
    await Promise.all([
      getDocs(classesQuery),
      getDocs(homeroomQuery),
      getDocs(subjectsQuery),
    ]);

  console.log(
    `Classes where teacher is in teacherIds: ${classesSnapshot.size}`
  );
  console.log(
    `Classes where teacher is homeroom teacher: ${homeroomSnapshot.size}`
  );

  const classes: HomeroomClass[] = [];

  // Add classes where teacher is in teacherIds
  classesSnapshot.forEach((doc) => {
    const data = doc.data();
    classes.push({
      classId: doc.id,
      className: data.className,
      classTeacherId: data.classTeacherId,
      studentIds: data.studentIds || [],
      teacherIds: data.teacherIds || [],
      namingFormat: data.namingFormat || "graded", // Adding the required property with a default value
    });
  });

  // Add homeroom classes if not already added
  homeroomSnapshot.forEach((doc) => {
    // Check if this class was already added
    if (!classes.some((c) => c.classId === doc.id)) {
      const data = doc.data();
      classes.push({
        classId: doc.id,
        className: data.className,
        classTeacherId: data.classTeacherId,
        studentIds: data.studentIds || [],
        teacherIds: data.teacherIds || [],
        namingFormat: data.namingFormat || "graded", // Adding the required property with a default value
      });
    }
  });

  // For debugging: If no classes found, log some sample class data to see structure
  if (classes.length === 0 && allClassesSnapshot.size > 0) {
    console.log("Sample class data structure:");
    allClassesSnapshot.docs[0].data();
  }

  const subjects: Subject[] = [];
  subjectsSnapshot.forEach((doc) => {
    const data = doc.data();
    subjects.push({
      subjectId: doc.id,
      name: data.name,
      description: data.description || "",
      teacherIds: data.teacherIds || [],
      studentIds: data.studentIds || [],
    });
  });

  console.log(
    `Found ${classes.length} classes and ${subjects.length} subjects for teacher`
  );
  return { classes, subjects };
}

/**
 * Get classes taught by a teacher based on timetable entries
 * @param schoolId ID of the school
 * @param teacherId ID of the teacher
 * @returns Array of class objects with class details and subject information
 */
export async function getClassesTaughtByTeacher(
  schoolId: string,
  teacherId: string
): Promise<
  Array<{
    classId: string;
    className: string;
    subjectId: string;
    subjectName: string;
    day: string;
    period: number;
    startTime: string;
    endTime: string;
  }>
> {
  console.log(
    `Fetching timetable entries for teacher ${teacherId} in school ${schoolId}`
  );
  const schoolRef = doc(db, "schools", schoolId);
  const timetablesRef = collection(schoolRef, "timetables");

  // Get all timetables
  const timetablesSnapshot = await getDocs(timetablesRef);

  // Array to store the classes taught by the teacher
  const classesTaught: Array<{
    classId: string;
    className: string;
    subjectId: string;
    subjectName: string;
    day: string;
    period: number;
    startTime: string;
    endTime: string;
  }> = [];

  // Process each timetable to find entries for the specified teacher
  const processPromises = timetablesSnapshot.docs.map(async (timetableDoc) => {
    const timetableData = timetableDoc.data() as ClassSession;

    // Skip if no entries
    if (!timetableData.entries || timetableData.entries.length === 0) {
      return;
    }

    // Filter entries for the specified teacher
    const teacherEntries = timetableData.entries.filter(
      (entry) => entry.teacherId === teacherId
    );

    if (teacherEntries.length === 0) {
      return;
    }

    // Get class details
    const classId = timetableData.homeroomClassId;
    const classRef = doc(schoolRef, "classes", classId);
    const classDoc = await getDoc(classRef);
    const classData = classDoc.data();

    if (!classData) {
      console.log(`Class data not found for class ID: ${classId}`);
      return;
    }

    // Process each entry where this teacher teaches
    for (const entry of teacherEntries) {
      // Get subject details
      const subjectRef = doc(schoolRef, "subjects", entry.subjectId);
      const subjectDoc = await getDoc(subjectRef);
      const subjectData = subjectDoc.data();

      if (!subjectData) {
        console.log(
          `Subject data not found for subject ID: ${entry.subjectId}`
        );
        continue;
      }

      // Add to the result array
      classesTaught.push({
        classId,
        className: classData.className,
        subjectId: entry.subjectId,
        subjectName: subjectData.name,
        day: entry.day,
        period: entry.period,
        startTime: entry.startTime,
        endTime: entry.endTime,
      });
    }
  });

  // Wait for all processing to complete
  await Promise.all(processPromises);

  console.log(
    `Found ${classesTaught.length} class sessions taught by teacher ${teacherId}`
  );

  return classesTaught;
}

/**
 * Check if a class session exists in the timetable
 * @param schoolId ID of the school
 * @param classId ID of the class
 * @param subjectId ID of the subject
 * @param dayOfWeek Day of the week (Monday, Tuesday, etc.)
 * @param periodNumber Period number
 * @returns True if the class session exists, false otherwise
 */
export async function doesClassSessionExist(
  schoolId: string,
  classId: string,
  subjectId: string,
  dayOfWeek: string,
  periodNumber: number
): Promise<boolean> {
  console.log(
    `Checking if class session exists: class=${classId}, subject=${subjectId}, day=${dayOfWeek}, period=${periodNumber}`
  );

  const schoolRef = doc(db, "schools", schoolId);
  const timetablesRef = collection(schoolRef, "timetables");

  // Get the timetable for the specified class
  const q = query(timetablesRef, where("homeroomClassId", "==", classId));
  const timetablesSnapshot = await getDocs(q);

  if (timetablesSnapshot.empty) {
    console.log(`No timetable found for class ID: ${classId}`);
    return false;
  }

  // Check each timetable document for matching entries
  for (const timetableDoc of timetablesSnapshot.docs) {
    const timetableData = timetableDoc.data() as ClassSession;

    if (!timetableData.entries || timetableData.entries.length === 0) {
      continue;
    }

    // Look for an entry that matches subject, day and period
    const matchingEntry = timetableData.entries.find(
      (entry) =>
        entry.subjectId === subjectId &&
        entry.day === dayOfWeek &&
        entry.period === periodNumber
    );

    if (matchingEntry) {
      console.log(
        `Found matching class session: ${JSON.stringify(matchingEntry)}`
      );
      return true;
    }
  }

  console.log(`No matching class session found`);
  return false;
}
