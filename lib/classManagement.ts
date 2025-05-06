import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  Timestamp,
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

    const newClassData = {
      className: classFormData.className,
      gradeNumber: classFormData.gradeNumber,
      classLetter: classFormData.classLetter,
      educationLevel: classFormData.educationLevel,
      teacherSubjectPairs: classFormData.teacherSubjectPairs,
      studentIds: [],
      namingFormat: classFormData.namingFormat,
    };

    await addDoc(classesRef, newClassData);
  } catch (error) {
    console.error("Error adding class:", error);
    throw error;
  }
};

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

    // Find the previous homeroom teacher
    const previousHomeroomTeacherPair = selectedClass.teacherSubjectPairs?.find(
      (pair) => pair.isHomeroom
    );

    // Update the class document
    await updateDoc(classRef, {
      ...updateData,
      // Explicitly update classTeacherId to ensure consistency
      classTeacherId: homeroomTeacherPair?.teacherId || "",
    });

    // If the homeroom teacher has changed, update the teacher documents
    if (
      homeroomTeacherPair?.teacherId !== previousHomeroomTeacherPair?.teacherId
    ) {
      // If there is a new homeroom teacher, update their document
      if (homeroomTeacherPair?.teacherId) {
        const newTeacherRef = doc(
          db,
          "schools",
          schoolId,
          "users",
          homeroomTeacherPair.teacherId
        );
        const newTeacherDoc = await getDoc(newTeacherRef);

        if (newTeacherDoc.exists()) {
          await updateDoc(newTeacherRef, {
            homeroomClassId: classFormData.className,
          });

          // Also add the class ID to teachesClasses array if it doesn't exist
          const teacherData = newTeacherDoc.data();
          const teachesClasses = teacherData.teachesClasses || [];

          if (!teachesClasses.includes(classFormData.className)) {
            await updateDoc(newTeacherRef, {
              teachesClasses: [...teachesClasses, classFormData.className],
            });
          }
        }
      }

      // If there was a previous homeroom teacher, update their document as well
      if (
        previousHomeroomTeacherPair?.teacherId &&
        previousHomeroomTeacherPair.teacherId !== homeroomTeacherPair?.teacherId
      ) {
        const prevTeacherRef = doc(
          db,
          "schools",
          schoolId,
          "users",
          previousHomeroomTeacherPair.teacherId
        );
        const prevTeacherDoc = await getDoc(prevTeacherRef);

        if (prevTeacherDoc.exists()) {
          const prevTeacherData = prevTeacherDoc.data();

          // Only update if their current homeroomClassId matches the class we're editing
          if (prevTeacherData.homeroomClassId === selectedClass.className) {
            await updateDoc(prevTeacherRef, {
              homeroomClassId: "",
            });
          }
        }
      }
    }
  } catch (error) {
    console.error("Error updating class:", error);
    throw error;
  }
};

export const deleteClass = async (
  schoolId: string,
  selectedClass: HomeroomClass
): Promise<void> => {
  try {
    // Handle students in this class
    if (selectedClass.studentIds && selectedClass.studentIds.length > 0) {
      for (const studentId of selectedClass.studentIds) {
        const studentRef = doc(db, "schools", schoolId, "users", studentId);
        const studentDoc = await getDoc(studentRef);

        if (studentDoc.exists()) {
          const studentData = studentDoc.data();

          if (studentData.homeroomClassId === selectedClass.classId) {
            await updateDoc(studentRef, {
              homeroomClassId: "",
            });
          }
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

    await deleteDoc(classRef);
  } catch (error) {
    console.error("Error deleting class:", error);
    throw error;
  }
};

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
