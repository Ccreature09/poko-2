import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface ClassFormData {
  classId?: string;
  className: string;
  namingFormat: "graded" | "custom";
  gradeNumber: number;
  classLetter: string;
  educationLevel: "primary" | "middle" | "high";
  teacherSubjectPairs: {
    teacherId: string;
    subjectId: string;
    isHomeroom?: boolean;
  }[];
  studentIds: string[];
}

export interface HomeroomClass {
  classId: string;
  className: string;
  gradeNumber: number;
  classLetter: string;
  educationLevel: "primary" | "middle" | "high";
  teacherSubjectPairs: {
    teacherId: string;
    subjectId: string;
    isHomeroom?: boolean;
  }[];
  classTeacherId: string;
  studentIds: string[];
  createdAt: Timestamp;
  namingFormat: "graded" | "custom";
}

export interface TeacherData {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface SubjectData {
  subjectId: string;
  name: string;
  description: string;
}

export interface TeacherSubjectMappings {
  teacherToSubjects: Record<string, string[]>;
  subjectToTeachers: Record<string, string[]>;
}

/**
 * Fetches all classes for a given school, including associated students and teacher assignments.
 * @param schoolId - The ID of the school document in Firestore.
 * @returns Promise resolving to an array of HomeroomClass objects with populated fields.
 */
export const fetchClasses = async (
  schoolId: string
): Promise<HomeroomClass[]> => {
  try {
    const classesRef = collection(doc(db, "schools", schoolId), "classes");
    const snapshot = await getDocs(classesRef);

    const fetchedClasses: HomeroomClass[] = [];

    // First gather all class data
    for (const classDoc of snapshot.docs) {
      const classData = classDoc.data();

      // Creating a merged class object with proper field mappings
      const classObj: HomeroomClass = {
        ...classData,
        classId: classDoc.id,

        // Core fields from Firebase
        className: classData.className || "",
        gradeNumber: classData.gradeNumber || 0,
        classLetter: classData.classLetter || classData.section || "",
        namingFormat: classData.namingFormat || "graded",

        // Arrays with proper defaults
        studentIds: classData.studentIds || [],
        teacherSubjectPairs: classData.teacherSubjectPairs || [],

        // Generate educationLevel if not present
        educationLevel:
          classData.educationLevel ||
          (classData.gradeNumber <= 4
            ? "primary"
            : classData.gradeNumber <= 7
            ? "middle"
            : "high"),

        // Other fields
        createdAt: classData.createdAt || Timestamp.now(),
        classTeacherId: classData.classTeacherId || "",
      };

      fetchedClasses.push(classObj);
    }

    // Now query for students to associate them with classes
    const usersRef = collection(doc(db, "schools", schoolId), "users");
    const studentsQuery = query(usersRef, where("role", "==", "student"));
    const studentsSnapshot = await getDocs(studentsQuery);

    // Create a map of classId -> array of studentIds
    const classStudentsMap: Record<string, string[]> = {};

    // Initialize empty arrays for each class
    fetchedClasses.forEach((cls) => {
      classStudentsMap[cls.classId] = [];
    });

    // Populate the map with students from each class
    studentsSnapshot.forEach((studentDoc) => {
      const studentData = studentDoc.data();
      // Check different possible field names for the class association
      const classId =
        studentData.homeroomClassId ||
        studentData.classId ||
        studentData.class ||
        studentData.className;

      if (classId && classStudentsMap[classId]) {
        classStudentsMap[classId].push(studentDoc.id);
      }
    });

    // Update student arrays in fetched classes
    fetchedClasses.forEach((cls) => {
      if (classStudentsMap[cls.classId]) {
        cls.studentIds = classStudentsMap[cls.classId];
      }
    });

    return fetchedClasses;
  } catch (error) {
    console.error("Error fetching classes:", error);
    throw error;
  }
};

/**
 * Fetches all teachers for a given school.
 * @param schoolId - The ID of the school document in Firestore.
 * @returns Promise resolving to an array of TeacherData.
 */
export const fetchTeachers = async (
  schoolId: string
): Promise<TeacherData[]> => {
  try {
    const usersRef = collection(doc(db, "schools", schoolId), "users");
    const teachersQuery = query(usersRef, where("role", "==", "teacher"));
    const snapshot = await getDocs(teachersQuery);

    const fetchedTeachers: TeacherData[] = [];
    snapshot.forEach((doc) => {
      const teacherData = doc.data() as TeacherData;
      fetchedTeachers.push({
        ...teacherData,
        userId: doc.id,
      });
    });

    return fetchedTeachers;
  } catch (error) {
    console.error("Error fetching teachers:", error);
    throw error;
  }
};

/**
 * Fetches all subjects for a given school.
 * @param schoolId - The ID of the school document in Firestore.
 * @returns Promise resolving to an array of SubjectData.
 */
export const fetchSubjects = async (
  schoolId: string
): Promise<SubjectData[]> => {
  try {
    const subjectsRef = collection(doc(db, "schools", schoolId), "subjects");
    const snapshot = await getDocs(subjectsRef);

    const fetchedSubjects: SubjectData[] = [];
    snapshot.forEach((doc) => {
      const subjectData = doc.data() as SubjectData;
      fetchedSubjects.push({
        ...subjectData,
        subjectId: doc.id,
      });
    });

    return fetchedSubjects;
  } catch (error) {
    console.error("Error fetching subjects:", error);
    throw error;
  }
};

/**
 * Builds mappings between teachers and subjects based on class assignments.
 * @param classes - Array of HomeroomClass objects.
 * @param teachers - Array of TeacherData.
 * @param subjects - Array of SubjectData.
 * @returns Object containing teacherToSubjects and subjectToTeachers maps.
 */
export const buildTeacherSubjectMappings = (
  classes: HomeroomClass[],
  teachers: TeacherData[],
  subjects: SubjectData[]
): TeacherSubjectMappings => {
  const teacherToSubjects: Record<string, string[]> = {};
  const subjectToTeachers: Record<string, string[]> = {};

  teachers.forEach((teacher) => {
    teacherToSubjects[teacher.userId] = [];
  });

  subjects.forEach((subject) => {
    subjectToTeachers[subject.subjectId] = [];
  });

  classes.forEach((cls) => {
    if (cls.teacherSubjectPairs && cls.teacherSubjectPairs.length > 0) {
      cls.teacherSubjectPairs.forEach((pair) => {
        const { teacherId, subjectId } = pair;

        if (
          teacherId &&
          subjectId &&
          teacherToSubjects[teacherId] &&
          !teacherToSubjects[teacherId].includes(subjectId)
        ) {
          teacherToSubjects[teacherId].push(subjectId);
        }

        if (
          teacherId &&
          subjectId &&
          subjectToTeachers[subjectId] &&
          !subjectToTeachers[subjectId].includes(teacherId)
        ) {
          subjectToTeachers[subjectId].push(teacherId);
        }
      });
    }
  });

  return {
    teacherToSubjects,
    subjectToTeachers,
  };
};

/**
 * Determines education level string based on grade number.
 * @param gradeNumber - Numeric grade level.
 * @returns "primary", "middle", or "high".
 */
export const updateEducationLevel = (
  gradeNumber: number
): "primary" | "middle" | "high" => {
  if (gradeNumber <= 4) {
    return "primary";
  } else if (gradeNumber <= 7) {
    return "middle";
  } else {
    return "high";
  }
};

/**
 * Adds a new class document and updates related teacher records.
 * @param schoolId - The ID of the school document in Firestore.
 * @param classFormData - Data for the new class.
 * @returns Promise resolving when operation completes.
 */
export const addClass = async (
  schoolId: string,
  classFormData: ClassFormData
): Promise<void> => {
  try {
    const classesRef = collection(doc(db, "schools", schoolId), "classes");

    const nameCheckQuery = query(
      classesRef,
      where("className", "==", classFormData.className)
    );
    const nameCheck = await getDocs(nameCheckQuery);

    if (!nameCheck.empty) {
      throw new Error("A class with this name already exists");
    }

    // Get the homeroom teacher ID
    const homeroomTeacherPair = classFormData.teacherSubjectPairs.find(
      (pair) => pair.isHomeroom
    );
    const homeroomTeacherId = homeroomTeacherPair?.teacherId || "";

    const newClassData = {
      className: classFormData.className,
      gradeNumber: classFormData.gradeNumber,
      classLetter: classFormData.classLetter,
      educationLevel: classFormData.educationLevel,
      teacherSubjectPairs: classFormData.teacherSubjectPairs,
      studentIds: [],
      namingFormat: classFormData.namingFormat,
      classTeacherId: homeroomTeacherId,
      createdAt: Timestamp.now(),
    };

    // Create the class first
    const newClassRef = await addDoc(classesRef, newClassData);
    const classId = newClassRef.id;

    // Update all teacher documents with the new class information
    const batch = writeBatch(db);

    // Process all teacher-subject pairs to update teacher documents
    for (const pair of classFormData.teacherSubjectPairs) {
      if (!pair.teacherId) continue;

      const teacherRef = doc(db, "schools", schoolId, "users", pair.teacherId);
      const teacherDoc = await getDoc(teacherRef);

      if (teacherDoc.exists()) {
        const teacherData = teacherDoc.data();

        // Update teachesClasses array for all teachers in this class
        const teachesClasses = teacherData.teachesClasses || [];
        if (!teachesClasses.includes(classId)) {
          batch.update(teacherRef, {
            teachesClasses: [...teachesClasses, classId],
          });
        }

        // If this is the homeroom teacher, also update homeroomClassId
        if (pair.isHomeroom) {
          batch.update(teacherRef, {
            homeroomClassId: classId,
          });
        }
      }
    }

    await batch.commit();

    return;
  } catch (error) {
    console.error("Error adding class:", error);
    throw error;
  }
};

/**
 * Edits an existing class document and synchronizes teacher assignments.
 * @param schoolId - The ID of the school document in Firestore.
 * @param selectedClass - Current class data.
 * @param classFormData - Updated class data.
 * @returns Promise resolving when operation completes.
 */
export const editClass = async (
  schoolId: string,
  selectedClass: HomeroomClass,
  classFormData: ClassFormData
): Promise<void> => {
  try {
    const classRef = doc(
      db,
      "schools",
      schoolId,
      "classes",
      selectedClass.classId
    );

    if (classFormData.className !== selectedClass.className) {
      const classesRef = collection(doc(db, "schools", schoolId), "classes");
      const nameCheckQuery = query(
        classesRef,
        where("className", "==", classFormData.className)
      );
      const nameCheck = await getDocs(nameCheckQuery);

      if (!nameCheck.empty) {
        const conflictingClass = nameCheck.docs[0];
        if (conflictingClass.id !== selectedClass.classId) {
          throw new Error("This class name is already in use");
        }
      }
    }

    const updateData = {
      className: classFormData.className,
      gradeNumber: classFormData.gradeNumber,
      classLetter: classFormData.classLetter,
      educationLevel: classFormData.educationLevel,
      teacherSubjectPairs: classFormData.teacherSubjectPairs,
      namingFormat: classFormData.namingFormat,
    };

    // Find the homeroom teacher in the new configuration
    const homeroomTeacherPair = classFormData.teacherSubjectPairs.find(
      (pair) => pair.isHomeroom
    );

    // Update the class document
    await updateDoc(classRef, {
      ...updateData,
      // Explicitly update classTeacherId to ensure consistency
      classTeacherId: homeroomTeacherPair?.teacherId || "",
    });

    // Create a batch to update all teacher documents
    const batch = writeBatch(db);

    // Keep track of teachers that are being processed
    const processedTeacherIds = new Set<string>();

    // First, handle all new teacher assignments
    for (const pair of classFormData.teacherSubjectPairs) {
      if (!pair.teacherId) continue;

      processedTeacherIds.add(pair.teacherId);

      const teacherRef = doc(db, "schools", schoolId, "users", pair.teacherId);
      const teacherDoc = await getDoc(teacherRef);

      if (teacherDoc.exists()) {
        const teacherData = teacherDoc.data();

        // Update teachesClasses array for this teacher
        const teachesClasses = teacherData.teachesClasses || [];
        if (!teachesClasses.includes(selectedClass.classId)) {
          batch.update(teacherRef, {
            teachesClasses: [...teachesClasses, selectedClass.classId],
          });
        }

        // If this is the homeroom teacher, update homeroomClassId
        if (pair.isHomeroom) {
          batch.update(teacherRef, {
            homeroomClassId: selectedClass.classId,
          });
        } else if (teacherData.homeroomClassId === selectedClass.classId) {
          // If they were previously the homeroom teacher but not anymore
          batch.update(teacherRef, {
            homeroomClassId: "",
          });
        }
      }
    }

    // Now find teachers who were previously assigned to this class but are no longer
    const previousTeacherIds = (selectedClass.teacherSubjectPairs || [])
      .map((pair) => pair.teacherId)
      .filter((id) => id && !processedTeacherIds.has(id));

    // Remove class from these teachers' teachesClasses arrays
    for (const teacherId of previousTeacherIds) {
      const teacherRef = doc(db, "schools", schoolId, "users", teacherId);
      const teacherDoc = await getDoc(teacherRef);

      if (teacherDoc.exists()) {
        const teacherData = teacherDoc.data();

        // Remove this class from teachesClasses
        if (
          teacherData.teachesClasses &&
          teacherData.teachesClasses.includes(selectedClass.classId)
        ) {
          batch.update(teacherRef, {
            teachesClasses: teacherData.teachesClasses.filter(
              (classId: string) => classId !== selectedClass.classId
            ),
          });
        }

        // Clear homeroomClassId if it points to this class
        if (teacherData.homeroomClassId === selectedClass.classId) {
          batch.update(teacherRef, {
            homeroomClassId: "",
          });
        }
      }
    }

    await batch.commit();
  } catch (error) {
    console.error("Error updating class:", error);
    throw error;
  }
};

/**
 * Deletes a class document and cleans up associated student and teacher references.
 * @param schoolId - The ID of the school document in Firestore.
 * @param selectedClass - Class to be deleted.
 * @returns Promise resolving when operation completes.
 */
export const deleteClass = async (
  schoolId: string,
  selectedClass: HomeroomClass
): Promise<void> => {
  try {
    const batch = writeBatch(db);

    // Handle students in this class
    if (selectedClass.studentIds && selectedClass.studentIds.length > 0) {
      for (const studentId of selectedClass.studentIds) {
        const studentRef = doc(db, "schools", schoolId, "users", studentId);
        const studentDoc = await getDoc(studentRef);

        if (studentDoc.exists()) {
          const studentData = studentDoc.data();

          if (studentData.homeroomClassId === selectedClass.classId) {
            batch.update(studentRef, {
              homeroomClassId: "",
            });
          }
        }
      }
    }

    // Handle teachers associated with this class
    if (
      selectedClass.teacherSubjectPairs &&
      selectedClass.teacherSubjectPairs.length > 0
    ) {
      for (const pair of selectedClass.teacherSubjectPairs) {
        if (!pair.teacherId) continue;

        const teacherRef = doc(
          db,
          "schools",
          schoolId,
          "users",
          pair.teacherId
        );
        const teacherDoc = await getDoc(teacherRef);

        if (teacherDoc.exists()) {
          const teacherData = teacherDoc.data();

          // Remove class from teachesClasses array
          if (
            teacherData.teachesClasses &&
            teacherData.teachesClasses.includes(selectedClass.classId)
          ) {
            batch.update(teacherRef, {
              teachesClasses: teacherData.teachesClasses.filter(
                (classId: string) => classId !== selectedClass.classId
              ),
            });
          }

          // Clear homeroomClassId if it points to this class
          if (teacherData.homeroomClassId === selectedClass.classId) {
            batch.update(teacherRef, {
              homeroomClassId: "",
            });
          }
        }
      }
    }

    // If there's a homeroom teacher who might not be in teacherSubjectPairs
    if (
      selectedClass.classTeacherId &&
      !selectedClass.teacherSubjectPairs?.some(
        (pair) => pair.teacherId === selectedClass.classTeacherId
      )
    ) {
      const teacherRef = doc(
        db,
        "schools",
        schoolId,
        "users",
        selectedClass.classTeacherId
      );
      const teacherDoc = await getDoc(teacherRef);

      if (teacherDoc.exists()) {
        const teacherData = teacherDoc.data();

        // Update teachesClasses array
        if (
          teacherData.teachesClasses &&
          teacherData.teachesClasses.includes(selectedClass.classId)
        ) {
          batch.update(teacherRef, {
            teachesClasses: teacherData.teachesClasses.filter(
              (classId: string) => classId !== selectedClass.classId
            ),
          });
        }

        // Clear homeroomClassId
        if (teacherData.homeroomClassId === selectedClass.classId) {
          batch.update(teacherRef, {
            homeroomClassId: "",
          });
        }
      }
    }

    // Delete the class document
    const classRef = doc(
      db,
      "schools",
      schoolId,
      "classes",
      selectedClass.classId
    );

    batch.delete(classRef);

    // Commit all the updates in a single batch
    await batch.commit();
  } catch (error) {
    console.error("Error deleting class:", error);
    throw error;
  }
};

/**
 * Returns a set of CSS classes for styling education level badges.
 * @param level - Education level string.
 * @returns String of Tailwind CSS classes.
 */
export const getEducationLevelBadgeStyle = (level: string): string => {
  switch (level) {
    case "primary":
      return "bg-green-100 text-green-800 border-green-300";
    case "middle":
      return "bg-blue-100 text-blue-800 border-blue-300";
    case "high":
      return "bg-purple-100 text-purple-800 border-purple-300";
    default:
      return "bg-gray-100 text-gray-800 border-gray-300";
  }
};

/**
 * Retrieves a teacher's full name from a list by ID.
 * @param teacherId - The teacher's user ID.
 * @param teachers - Array of TeacherData.
 * @returns Full name or placeholder string.
 */
export const getTeacherName = (
  teacherId: string,
  teachers: TeacherData[]
): string => {
  if (!teachers || teachers.length === 0) return "Loading...";
  const teacher = teachers.find((t) => t.userId === teacherId);
  return teacher
    ? `${teacher.firstName} ${teacher.lastName}`
    : "Unknown Teacher";
};

/**
 * Filters available teachers for a class pairing based on subject assignment.
 * @param pairIndex - Index of the teacher-subject pair.
 * @param classFormData - Current form data for the class.
 * @param teachers - List of all teachers.
 * @param teacherSubjectMappings - Mappings between teachers and subjects.
 * @param isEditDialogOpen - Flag indicating editing mode.
 * @returns Array of TeacherData matching filter criteria.
 */
export const getFilteredTeachers = (
  pairIndex: number,
  classFormData: ClassFormData,
  teachers: TeacherData[],
  teacherSubjectMappings: TeacherSubjectMappings,
  isEditDialogOpen: boolean
): TeacherData[] => {
  const currentPair = classFormData.teacherSubjectPairs[pairIndex];

  // If no subject is selected, show all teachers
  if (!currentPair.subjectId) {
    return teachers;
  }

  // When editing a class, we should include the currently assigned teacher
  // even if they don't usually teach this subject
  if (isEditDialogOpen && currentPair.teacherId) {
    const teacherIds = [
      ...(teacherSubjectMappings.subjectToTeachers[currentPair.subjectId] ||
        []),
    ];
    if (!teacherIds.includes(currentPair.teacherId)) {
      teacherIds.push(currentPair.teacherId);
    }
    return teachers.filter((teacher) => teacherIds.includes(teacher.userId));
  }

  // Get teachers who teach this subject
  const teacherIds =
    teacherSubjectMappings.subjectToTeachers[currentPair.subjectId] || [];

  // If no teacher has taught this subject before, show all teachers
  if (teacherIds.length === 0) {
    return teachers;
  }

  // Return only teachers that teach this subject
  return teachers.filter((teacher) => teacherIds.includes(teacher.userId));
};

/**
 * Filters available subjects for a class pairing based on teacher assignment.
 * @param pairIndex - Index of the teacher-subject pair.
 * @param classFormData - Current form data for the class.
 * @param subjects - List of all subjects.
 * @param teacherSubjectMappings - Mappings between teachers and subjects.
 * @param isEditDialogOpen - Flag indicating editing mode.
 * @returns Array of SubjectData matching filter criteria.
 */
export const getFilteredSubjects = (
  pairIndex: number,
  classFormData: ClassFormData,
  subjects: SubjectData[],
  teacherSubjectMappings: TeacherSubjectMappings,
  isEditDialogOpen: boolean
): SubjectData[] => {
  const currentPair = classFormData.teacherSubjectPairs[pairIndex];

  // If no teacher is selected, show all subjects
  if (!currentPair.teacherId) {
    return subjects;
  }

  // When editing a class, we should include the currently assigned subject
  // even if the teacher doesn't usually teach it
  if (isEditDialogOpen && currentPair.subjectId) {
    const subjectIds = [
      ...(teacherSubjectMappings.teacherToSubjects[currentPair.teacherId] ||
        []),
    ];
    if (!subjectIds.includes(currentPair.subjectId)) {
      subjectIds.push(currentPair.subjectId);
    }
    return subjects.filter((subject) => subjectIds.includes(subject.subjectId));
  }

  // Get subjects that this teacher teaches
  const subjectIds =
    teacherSubjectMappings.teacherToSubjects[currentPair.teacherId] || [];

  // If this teacher hasn't taught any subjects before, show all subjects
  if (subjectIds.length === 0) {
    return subjects;
  }

  // Return only subjects taught by this teacher
  return subjects.filter((subject) => subjectIds.includes(subject.subjectId));
};

/**
 * Provides default form data for creating a new class.
 * @returns Initialized ClassFormData object.
 */
export const getDefaultClassFormData = (): ClassFormData => {
  return {
    className: "",
    namingFormat: "graded",
    gradeNumber: 1,
    classLetter: "A",
    educationLevel: "primary",
    teacherSubjectPairs: [{ teacherId: "", subjectId: "", isHomeroom: true }],
    studentIds: [],
  };
};
