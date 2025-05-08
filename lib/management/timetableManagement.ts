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

// Bulgarian to English day name mapping
const bgToEnDayMap = {
  Понеделник: "Monday",
  Вторник: "Tuesday",
  Сряда: "Wednesday",
  Четвъртък: "Thursday",
  Петък: "Friday",
  Събота: "Saturday",
  Неделя: "Sunday",
};

/**
 * Standardize day name to English for storage in Firebase
 * @param day Day name in Bulgarian or English
 * @returns Day name in English
 */
export const standardizeDayName = (day: string): string => {
  return bgToEnDayMap[day] || day;
};

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

    console.log(`Found ${querySnapshot.size} documents for class`);

    const results = querySnapshot.docs.map((doc) => {
      const data = doc.data() as ClassSession;
      console.log(`Found timetable with ID: ${doc.id}`);

      // Create a reverse mapping (English to Bulgarian)
      const enToBgDayMap: Record<string, string> = {};
      for (const [bgDay, enDay] of Object.entries(bgToEnDayMap)) {
        enToBgDayMap[enDay] = bgDay;
      }

      // Convert day names in entries from English back to Bulgarian for display
      if (data.entries && data.entries.length > 0) {
        data.entries = data.entries.map((entry) => ({
          ...entry,
          day: enToBgDayMap[entry.day] || entry.day, // Convert English day to Bulgarian or keep as is
        }));
        console.log(`Converted days in ${data.entries.length} entries`);
      }

      // Explicitly log periods to help with debugging
      if (data.periods && data.periods.length > 0) {
        console.log(`Timetable has ${data.periods.length} periods defined`);
        console.log(`First period: ${JSON.stringify(data.periods[0])}`);
      } else {
        console.log(`Timetable has NO periods defined, will use defaults`);
        // Ensure periods are always defined for consistency
        data.periods = [
          { period: 1, startTime: "07:30", endTime: "08:10" },
          { period: 2, startTime: "08:20", endTime: "09:00" },
          { period: 3, startTime: "09:10", endTime: "09:50" },
          { period: 4, startTime: "10:10", endTime: "10:50" },
          { period: 5, startTime: "11:00", endTime: "11:40" },
          { period: 6, startTime: "11:50", endTime: "12:30" },
          { period: 7, startTime: "12:40", endTime: "13:20" },
          { period: 8, startTime: "13:30", endTime: "14:10" },
        ];
      }

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

    // Standardize day names to English before saving (if entries exist)
    const standardizedTimetableData = {
      ...timetableData,
      entries:
        timetableData.entries?.map((entry) => ({
          ...entry,
          day: standardizeDayName(entry.day),
        })) || [],
    };

    // Check if this class already has a timetable
    const timetablesRef = collection(db, "schools", schoolId, "timetables");
    const q = query(
      timetablesRef,
      where("homeroomClassId", "==", standardizedTimetableData.homeroomClassId)
    );
    const existingTimetables = await getDocs(q);

    let timetableId: string;

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
        homeroomClassId: standardizedTimetableData.homeroomClassId,
        entries: standardizedTimetableData.entries || [],
        periods: standardizedTimetableData.periods || [],
      };

      await setDoc(timetableRef, completeData);
      timetableId = existingTimetableId;
    } else {
      // Otherwise create a new timetable
      const newTimetableRef = doc(
        collection(db, "schools", schoolId, "timetables")
      );

      // Ensure we're saving the complete data structure with periods
      const completeData = {
        homeroomClassId: standardizedTimetableData.homeroomClassId,
        entries: standardizedTimetableData.entries || [],
        periods: standardizedTimetableData.periods || [],
      };

      await setDoc(newTimetableRef, completeData);
      timetableId = newTimetableRef.id;
    }

    // Process teacher timetables:
    // For each entry in the class timetable, ensure the assigned teacher
    // has this class in their timetable
    await updateTeacherTimetables(schoolId, standardizedTimetableData);

    return timetableId;
  } catch (error) {
    console.error("Error creating/updating timetable:", error);
    throw error;
  }
};

/**
 * Update teacher timetables based on the class timetable
 * @param schoolId ID of the school
 * @param timetableData Class timetable data
 */
export const updateTeacherTimetables = async (
  schoolId: string,
  timetableData: ClassSession
): Promise<void> => {
  try {
    // Group entries by teacher ID
    const entriesByTeacher: { [teacherId: string]: ClassSession["entries"] } =
      {};

    // Skip entries without a teacher (like free periods)
    timetableData.entries
      .filter((entry) => entry.teacherId && !entry.isFreePeriod)
      .forEach((entry) => {
        if (!entriesByTeacher[entry.teacherId]) {
          entriesByTeacher[entry.teacherId] = [];
        }
        // Add class information to this entry
        entriesByTeacher[entry.teacherId].push({
          ...entry,
          day: standardizeDayName(entry.day), // Ensure day name is in English
          classId: entry.classId || timetableData.homeroomClassId || "", // Always provide a fallback empty string
        });
      });

    console.log(
      `Updating timetables for ${Object.keys(entriesByTeacher).length} teachers`
    );

    // Process each teacher's timetable
    for (const teacherId of Object.keys(entriesByTeacher)) {
      // Look for existing teacher timetable entries
      const teacherTimetableQuery = query(
        collection(db, "schools", schoolId, "teacherTimetables"),
        where("teacherId", "==", teacherId)
      );

      const teacherTimetablesSnapshot = await getDocs(teacherTimetableQuery);

      let teacherTimetable: ClassSession;
      let teacherTimetableId: string;

      if (!teacherTimetablesSnapshot.empty) {
        // Update existing teacher timetable
        teacherTimetableId = teacherTimetablesSnapshot.docs[0].id;
        const existingData =
          teacherTimetablesSnapshot.docs[0].data() as ClassSession;

        // Get the existing entries that don't conflict with the new ones
        const nonConflictingEntries = existingData.entries.filter(
          (existingEntry) => {
            // Standardize existing entry day to English for comparison
            const standardizedDay = standardizeDayName(existingEntry.day);

            // Keep entries that are not related to this class
            return !entriesByTeacher[teacherId].some(
              (newEntry) =>
                newEntry.day === standardizedDay &&
                newEntry.period === existingEntry.period
            );
          }
        );

        // Combine with the new entries for this teacher
        teacherTimetable = {
          teacherId,
          entries: [...nonConflictingEntries, ...entriesByTeacher[teacherId]],
          periods: timetableData.periods || [], // Use the same periods as the class timetable
        };
      } else {
        // Create a new teacher timetable
        teacherTimetable = {
          teacherId,
          entries: entriesByTeacher[teacherId],
          periods: timetableData.periods || [], // Use the same periods as the class timetable
        };

        const newTimetableRef = doc(
          collection(db, "schools", schoolId, "teacherTimetables")
        );
        teacherTimetableId = newTimetableRef.id;
      }

      // Save the teacher timetable
      await setDoc(
        doc(db, "schools", schoolId, "teacherTimetables", teacherTimetableId),
        teacherTimetable
      );

      console.log(
        `Updated timetable for teacher ${teacherId} with ${entriesByTeacher[teacherId].length} entries`
      );
    }
  } catch (error) {
    console.error("Error updating teacher timetables:", error);
  }
};

/**
 * Fetch timetable for a specific teacher
 * @param schoolId ID of the school
 * @param teacherId ID of the teacher
 * @returns Teacher timetable data
 */
export const fetchTeacherTimetable = async (
  schoolId: string,
  teacherId: string
): Promise<{ id: string; data: ClassSession }[]> => {
  try {
    console.log(
      `fetchTeacherTimetable: Fetching timetable for teacher ID: ${teacherId} in school ${schoolId}`
    );

    const teacherTimetablesRef = collection(
      db,
      "schools",
      schoolId,
      "teacherTimetables"
    );
    console.log(
      `fetchTeacherTimetable: Collection path: schools/${schoolId}/teacherTimetables`
    );

    const q = query(teacherTimetablesRef, where("teacherId", "==", teacherId));
    console.log(
      `fetchTeacherTimetable: Query created with condition teacherId == ${teacherId}`
    );

    const querySnapshot = await getDocs(q);
    console.log(
      `fetchTeacherTimetable: Query executed, got ${querySnapshot.size} documents`
    );

    const results = querySnapshot.docs.map((doc) => {
      const data = doc.data() as ClassSession;
      console.log(
        `fetchTeacherTimetable: Found teacher timetable with ID: ${doc.id}`
      );
      console.log(
        `fetchTeacherTimetable: Teacher ID in document:`,
        data.teacherId
      );
      console.log(
        `fetchTeacherTimetable: Teacher timetable entries count:`,
        data.entries?.length || 0
      );
      console.log(
        `fetchTeacherTimetable: First few entries:`,
        data.entries?.slice(0, 3)
      );
      console.log(`fetchTeacherTimetable: Periods:`, data.periods);
      return {
        id: doc.id,
        data: data,
      };
    });

    console.log(
      `fetchTeacherTimetable: Found ${results.length} timetables for teacher ID: ${teacherId}`
    );
    return results;
  } catch (error) {
    console.error(
      "fetchTeacherTimetable: Error fetching teacher timetable:",
      error
    );
    return [];
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
  // Ensure homeroomClassId is never undefined when used in the query
  const q = query(
    timetablesRef,
    where("homeroomClassId", "==", homeroomClassId || "")
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
            classMap.get(timetableData.homeroomClassId || "") ||
            "Unknown Class",
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

    // Fix potential undefined classId in getClassesTaughtByTeacher function
    const classId = timetableData.homeroomClassId || "";

    // Later in the function, ensure we handle potential undefined classId for the doc reference
    const classRef = classId ? doc(schoolRef, "classes", classId) : null;
    const classDoc = classRef ? await getDoc(classRef) : null;
    const classData = classDoc && classDoc.exists() ? classDoc.data() : null;

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

  // Standardize the day name to English for comparison
  const standardizedDayOfWeek = standardizeDayName(dayOfWeek);

  console.log(`Standardized day of week: ${standardizedDayOfWeek}`);

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

    // Also check teacher timetables if this is a class that could be taught by different teachers
    console.log(
      `Checking class timetable entries: ${timetableData.entries.length}`
    );

    // Look for an entry that matches subject, day and period
    const matchingEntry = timetableData.entries.find((entry) => {
      // Standardize the entry day name for comparison
      const standardizedEntryDay = standardizeDayName(entry.day);

      const matches =
        entry.subjectId === subjectId &&
        standardizedEntryDay === standardizedDayOfWeek &&
        entry.period === periodNumber;

      if (matches) {
        console.log(`Found match in class timetable: ${JSON.stringify(entry)}`);
      }

      return matches;
    });

    if (matchingEntry) {
      console.log(
        `Found matching class session: ${JSON.stringify(matchingEntry)}`
      );
      return true;
    }
  }

  // If not found in class timetables, also check teacher timetables
  console.log(`Checking teacher timetables for this class session`);

  const teacherTimetablesRef = collection(schoolRef, "teacherTimetables");
  const teacherTimetablesSnapshot = await getDocs(teacherTimetablesRef);

  for (const timetableDoc of teacherTimetablesSnapshot.docs) {
    const timetableData = timetableDoc.data() as ClassSession;

    if (!timetableData.entries || timetableData.entries.length === 0) {
      continue;
    }

    console.log(
      `Checking teacher timetable entries: ${timetableData.entries.length}`
    );

    // Look for an entry that matches class, subject, day and period
    const matchingEntry = timetableData.entries.find((entry) => {
      // Standardize the entry day name for comparison
      const standardizedEntryDay = standardizeDayName(entry.day);

      const matches =
        entry.classId === classId &&
        entry.subjectId === subjectId &&
        standardizedEntryDay === standardizedDayOfWeek &&
        entry.period === periodNumber;

      if (matches) {
        console.log(
          `Found match in teacher timetable: ${JSON.stringify(entry)}`
        );
      }

      return matches;
    });

    if (matchingEntry) {
      console.log(
        `Found matching teacher class session: ${JSON.stringify(matchingEntry)}`
      );
      return true;
    }
  }

  console.log(`No matching class session found in any timetable`);
  return false;
}
