import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  getDoc,
  query,
  where,
  deleteDoc,
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
  try {
    console.log(
      `Fetching timetables for homeroom class ID: ${homeroomClassId}`
    );

    const timetablesRef = collection(db, "schools", schoolId, "timetables");
    const q = query(
      timetablesRef,
      where("homeroomClassId", "==", homeroomClassId)
    );
    const querySnapshot = await getDocs(q);

    const results = querySnapshot.docs.map((doc) => {
      const data = doc.data() as ClassSession;
      console.log(`Found timetable with ID: ${doc.id}`);
      console.log("Timetable periods:", data.periods);
      return {
        id: doc.id,
        data: data,
      };
    });

    console.log(
      `Found ${results.length} timetables for class ID: ${homeroomClassId}`
    );
    return results;
  } catch (error) {
    console.error("Error fetching timetables:", error);
    return [];
  }
};

/**
 * Get all timetables for a school
 * @param schoolId ID of the school
 * @returns Array of timetables with their IDs
 */
export const getAllTimetables = async (
  schoolId: string
): Promise<{ id: string; data: ClassSession }[]> => {
  const timetablesRef = collection(db, "schools", schoolId, "timetables");
  const snapshot = await getDocs(timetablesRef);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    data: doc.data() as ClassSession,
  }));
};

/**
 * Get all subjects for a school
 * @param schoolId ID of the school
 * @returns Array of subjects with their IDs
 */
export const getAllSubjects = async (schoolId: string): Promise<Subject[]> => {
  const subjectsRef = collection(db, "schools", schoolId, "subjects");
  const snapshot = await getDocs(subjectsRef);
  return snapshot.docs.map(
    (doc) =>
      ({
        subjectId: doc.id,
        ...doc.data(),
      } as Subject)
  );
};

/**
 * Get all teachers for a school
 * @param schoolId ID of the school
 * @returns Array of teachers with their IDs
 */
export const getAllTeachers = async (
  schoolId: string
): Promise<
  { userId: string; firstName: string; lastName: string; email: string }[]
> => {
  const usersRef = collection(db, "schools", schoolId, "users");
  const teachersQuery = query(usersRef, where("role", "==", "teacher"));
  const snapshot = await getDocs(teachersQuery);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      userId: doc.id,
      firstName: data.firstName || "",
      lastName: data.lastName || "",
      email: data.email || "",
    };
  });
};

/**
 * Create or update a timetable for a class
 * @param schoolId ID of the school
 * @param timetableData Timetable data with class ID and entries
 * @returns ID of the created/updated timetable
 */
export const createOrUpdateTimetable = async (
  schoolId: string,
  timetableData: ClassSession
): Promise<string> => {
  try {
    console.log("Saving timetable with periods:", timetableData.periods);

    // Check if this class already has a timetable
    const timetablesRef = collection(db, "schools", schoolId, "timetables");
    const q = query(
      timetablesRef,
      where("homeroomClassId", "==", timetableData.homeroomClassId)
    );
    const existingTimetables = await getDocs(q);

    // If timetable exists, update it
    if (!existingTimetables.empty) {
      const existingTimetableId = existingTimetables.docs[0].id;
      const timetableRef = doc(
        db,
        "schools",
        schoolId,
        "timetables",
        existingTimetableId
      );

      // Ensure we're saving the complete data structure with periods
      const completeData = {
        homeroomClassId: timetableData.homeroomClassId,
        entries: timetableData.entries || [],
        periods: timetableData.periods || [],
      };

      await setDoc(timetableRef, completeData);
      return existingTimetableId;
    }

    // Otherwise create a new timetable
    const newTimetableRef = doc(
      collection(db, "schools", schoolId, "timetables")
    );

    // Ensure we're saving the complete data structure with periods
    const completeData = {
      homeroomClassId: timetableData.homeroomClassId,
      entries: timetableData.entries || [],
      periods: timetableData.periods || [],
    };

    await setDoc(newTimetableRef, completeData);
    return newTimetableRef.id;
  } catch (error) {
    console.error("Error creating/updating timetable:", error);
    throw error;
  }
};

/**
 * Delete a timetable
 * @param schoolId ID of the school
 * @param timetableId ID of the timetable to delete
 */
export const deleteTimetable = async (
  schoolId: string,
  timetableId: string
): Promise<void> => {
  try {
    const timetableRef = doc(
      db,
      "schools",
      schoolId,
      "timetables",
      timetableId
    );
    await deleteDoc(timetableRef);
  } catch (error) {
    console.error("Error deleting timetable:", error);
    throw error;
  }
};

/**
 * Get teachers who teach a specific subject
 * @param schoolId ID of the school
 * @param subjectId ID of the subject
 * @returns Array of teachers who teach the subject
 */
export const getTeachersBySubject = async (
  schoolId: string,
  subjectId: string
): Promise<{ userId: string; firstName: string; lastName: string }[]> => {
  const subjectRef = doc(db, "schools", schoolId, "subjects", subjectId);
  const subjectDoc = await getDoc(subjectRef);

  if (!subjectDoc.exists()) {
    return [];
  }

  const subjectData = subjectDoc.data();
  const teacherSubjectPairs = subjectData.teacherSubjectPairs || [];
  const teacherIds = teacherSubjectPairs.map((pair) => pair.teacherId);

  const teachers: { userId: string; firstName: string; lastName: string }[] =
    [];

  for (const teacherId of teacherIds) {
    const teacherRef = doc(db, "schools", schoolId, "users", teacherId);
    const teacherDoc = await getDoc(teacherRef);

    if (teacherDoc.exists()) {
      const teacherData = teacherDoc.data();
      teachers.push({
        userId: teacherId,
        firstName: teacherData.firstName || "",
        lastName: teacherData.lastName || "",
      });
    }
  }

  return teachers;
};

/**
 * Check for timetable conflicts (same class, same day, same period)
 * @param schoolId ID of the school
 * @param homeroomClassId ID of the homeroom class
 * @param entries Timetable entries to check
 * @param excludeTimetableId Optional ID of timetable to exclude from conflict check (for updates)
 * @returns Array of conflicts found
 */
export const checkTimetableConflicts = async (
  schoolId: string,
  homeroomClassId: string,
  entries: ClassSession["entries"],
  excludeTimetableId?: string
): Promise<
  {
    day: string;
    period: number;
    existingSubject: string;
    newSubject: string;
  }[]
> => {
  const conflicts: {
    day: string;
    period: number;
    existingSubject: string;
    newSubject: string;
  }[] = [];

  // Get existing timetable for this class
  const timetablesRef = collection(db, "schools", schoolId, "timetables");
  const q = query(
    timetablesRef,
    where("homeroomClassId", "==", homeroomClassId)
  );
  const existingTimetables = await getDocs(q);

  if (existingTimetables.empty) {
    return []; // No existing timetable, no conflicts
  }

  // Skip the timetable we're currently updating
  const relevantTimetables = existingTimetables.docs.filter(
    (doc) => !excludeTimetableId || doc.id !== excludeTimetableId
  );

  if (relevantTimetables.length === 0) {
    return []; // Only the timetable we're updating exists
  }

  // Get all subjects for subject name lookup
  const subjects = await getAllSubjects(schoolId);
  const subjectMap = new Map(subjects.map((s) => [s.subjectId, s.name]));

  // Check each entry against existing entries for conflicts
  for (const newEntry of entries) {
    for (const timetableDoc of relevantTimetables) {
      const timetableData = timetableDoc.data() as ClassSession;

      if (!timetableData.entries) continue;

      // Find any entry with the same day and period
      const conflictingEntry = timetableData.entries.find(
        (entry) =>
          entry.day === newEntry.day && entry.period === newEntry.period
      );

      if (conflictingEntry) {
        conflicts.push({
          day: newEntry.day,
          period: newEntry.period,
          existingSubject:
            subjectMap.get(conflictingEntry.subjectId) || "Unknown Subject",
          newSubject: subjectMap.get(newEntry.subjectId) || "Unknown Subject",
        });
      }
    }
  }

  return conflicts;
};

/**
 * Check for teacher availability conflicts
 * @param schoolId ID of the school
 * @param entries Timetable entries to check
 * @param excludeTimetableId Optional ID of timetable to exclude from conflict check (for updates)
 * @returns Array of teacher conflicts found
 */
export const checkTeacherConflicts = async (
  schoolId: string,
  entries: ClassSession["entries"],
  excludeTimetableId?: string
): Promise<
  {
    teacherId: string;
    teacherName: string;
    day: string;
    period: number;
    className: string;
  }[]
> => {
  const conflicts: {
    teacherId: string;
    teacherName: string;
    day: string;
    period: number;
    className: string;
  }[] = [];

  // Get all timetables
  const timetablesRef = collection(db, "schools", schoolId, "timetables");
  const timetablesSnapshot = await getDocs(timetablesRef);

  // Skip the timetable we're currently updating
  const relevantTimetables = timetablesSnapshot.docs.filter(
    (doc) => !excludeTimetableId || doc.id !== excludeTimetableId
  );

  // Get all classes for class name lookup
  const classes = await getClasses(schoolId);
  const classMap = new Map(classes.map((c) => [c.classId, c.className]));

  // Get all teachers for teacher name lookup
  const teachers = await getAllTeachers(schoolId);
  const teacherMap = new Map(
    teachers.map((t) => [t.userId, `${t.firstName} ${t.lastName}`])
  );

  // Check each entry against existing entries for teacher conflicts
  for (const newEntry of entries) {
    // Skip entries without a teacher
    if (!newEntry.teacherId) continue;

    for (const timetableDoc of relevantTimetables) {
      const timetableData = timetableDoc.data() as ClassSession;

      if (!timetableData.entries) continue;

      // Find any entry with the same teacher, day and period
      const conflictingEntry = timetableData.entries.find(
        (entry) =>
          entry.teacherId === newEntry.teacherId &&
          entry.day === newEntry.day &&
          entry.period === newEntry.period
      );

      if (conflictingEntry) {
        conflicts.push({
          teacherId: newEntry.teacherId,
          teacherName: teacherMap.get(newEntry.teacherId) || "Unknown Teacher",
          day: newEntry.day,
          period: newEntry.period,
          className:
            classMap.get(timetableData.homeroomClassId) || "Unknown Class",
        });
      }
    }
  }

  return conflicts;
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

  // Now get classes where the teacher is assigned through teacherSubjectPairs
  const classesQuery = query(
    classesRef,
    where("teacherSubjectPairs", "array-contains", {
      teacherId,
      subjectId: teacherId,
      isHomeroom: false,
    })
  );

  // Also check classes where the teacher is the homeroom teacher
  const homeroomQuery = query(
    classesRef,
    where("classTeacherId", "==", teacherId)
  );

  const subjectsRef = collection(schoolRef, "subjects");

  // Get subjects where the teacher teaches through teacherSubjectPairs
  const subjectsQuery = query(
    subjectsRef,
    where("teacherSubjectPairs", "array-contains", { teacherId, subjectId: "" })
  );

  const [classesSnapshot, homeroomSnapshot, subjectsSnapshot] =
    await Promise.all([
      getDocs(classesQuery),
      getDocs(homeroomQuery),
      getDocs(subjectsQuery),
    ]);

  console.log(
    `Classes where teacher is in teacherSubjectPairs: ${classesSnapshot.size}`
  );
  console.log(
    `Classes where teacher is homeroom teacher: ${homeroomSnapshot.size}`
  );

  const classes: HomeroomClass[] = [];

  // Add classes where teacher is in teacherSubjectPairs
  classesSnapshot.forEach((doc) => {
    const data = doc.data();
    classes.push({
      classId: doc.id,
      className: data.className,
      classTeacherId: data.classTeacherId,
      studentIds: data.studentIds || [],
      namingFormat: data.namingFormat || "graded", // Adding the required property with a default value
      teacherSubjectPairs: data.teacherSubjectPairs || [],
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
        namingFormat: data.namingFormat || "graded", // Adding the required property with a default value
        teacherSubjectPairs: data.teacherSubjectPairs || [],
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
      teacherSubjectPairs: data.teacherSubjectPairs || [],
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
