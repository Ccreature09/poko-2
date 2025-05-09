/**
 * @module userManagement
 * @description Functions for creating, editing, deleting users, importing/exporting user data,
 * and utility transformations for user management.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  writeBatch,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import {
  ClassNamingFormat,
  UserData,
  UserFormData,
  Role,
} from "@/lib/interfaces";

// Type alias for backward compatibility
type UserRole = Role;

// Define an interface for teacherSubjectPair
interface TeacherSubjectPair {
  teacherId: string;
  subjectId: string;
  isHomeroom?: boolean;
}

// Define a type for user account details returned from API
export interface UserAccountDetails {
  email: string;
  password: string;
  userId: string;
  role: string;
}

// Define a type for class data structure
export interface SchoolClassData {
  classId: string;
  className: string;
  namingFormat: string;
  educationLevel?: string;
}

// Define a type for actual class objects
export interface SchoolClass {
  classId: string;
  className: string;
  name?: string;
  [key: string]: unknown;
}

type FirestoreUpdateData = {
  [key: string]:
    | string
    | number
    | boolean
    | null
    | undefined
    | string[]
    | { [key: string]: unknown }
    | Array<{ [key: string]: unknown }>
    | Timestamp
    | FirestoreUpdateData;
};

/**
 * Transliterates Bulgarian Cyrillic to Latin characters for email generation.
 * @param text Text to transliterate.
 * @returns Transliterated Latin text.
 */
export const transliterateBulgarianToLatin = (text: string): string => {
  if (!text) return "";

  const bulgarianToLatin: Record<string, string> = {
    // Lowercase Cyrillic letters
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sht",
    ъ: "a",
    ь: "",
    ю: "yu",
    я: "ya",

    // Uppercase Cyrillic letters
    А: "A",
    Б: "B",
    В: "V",
    Г: "G",
    Д: "D",
    Е: "E",
    Ж: "Zh",
    З: "Z",
    И: "I",
    Й: "Y",
    К: "K",
    Л: "L",
    М: "M",
    Н: "N",
    О: "O",
    П: "P",
    Р: "R",
    С: "S",
    Т: "T",
    У: "U",
    Ф: "F",
    Х: "H",
    Ц: "Ts",
    Ч: "Ch",
    Ш: "Sh",
    Щ: "Sht",
    Ъ: "A",
    Ь: "",
    Ю: "Yu",
    Я: "Ya",
  };

  return text
    .split("")
    .map((char) => bulgarianToLatin[char] || char)
    .join("");
};

/**
 * Adds a new user to the school's database via Admin API and updates class associations.
 * @param schoolId ID of the school.
 * @param userFormData Data object for the new user.
 * @returns Result object containing success, userId, accountDetails, or error message.
 */
export const handleAddUser = async (
  schoolId: string,
  userFormData: UserFormData
) => {
  if (!schoolId) {
    throw new Error("School ID is required");
  }

  try {
    const usersRef = collection(doc(db, "schools", schoolId), "users");

    // Check if a user with this email already exists
    const emailCheckQuery = query(
      usersRef,
      where("email", "==", userFormData.email)
    );
    const emailCheck = await getDocs(emailCheckQuery);

    if (!emailCheck.empty) {
      toast({
        title: "Грешка",
        description: "Потребител с този имейл вече съществува",
        variant: "destructive",
      });
      return null;
    }

    // Call the server API to create the user with Firebase Admin SDK
    const response = await fetch("/api/users/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schoolId,
        userData: userFormData,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to add user");
    }

    const result = await response.json();
    const userId = result.userId;

    // Handle class associations after user creation
    if (userId) {
      const batch = writeBatch(db);

      // For students, add them to the class's studentIds array
      if (userFormData.role === "student" && userFormData.homeroomClassId) {
        const classRef = doc(
          db,
          "schools",
          schoolId,
          "classes",
          userFormData.homeroomClassId
        );
        const classDoc = await getDoc(classRef);

        if (classDoc.exists()) {
          const classData = classDoc.data();
          const studentIds = classData.studentIds || [];

          if (!studentIds.includes(userId)) {
            batch.update(classRef, {
              studentIds: [...studentIds, userId],
            });
          }
        }
      }
      // For teachers, handle homeroom class assignment
      else if (
        userFormData.role === "teacher" &&
        userFormData.homeroomClassId
      ) {
        const classRef = doc(
          db,
          "schools",
          schoolId,
          "classes",
          userFormData.homeroomClassId
        );
        const classDoc = await getDoc(classRef);

        if (classDoc.exists()) {
          const classData = classDoc.data();

          // Make sure the teacher is set as the homeroom teacher for this class
          batch.update(classRef, {
            classTeacherId: userId,
          });

          // Update teacherSubjectPairs to include this teacher
          let teacherPairExists = false;
          const updatedPairs = (classData.teacherSubjectPairs || []).map(
            (pair: TeacherSubjectPair) => {
              if (pair.teacherId === userId) {
                teacherPairExists = true;
                return { ...pair, isHomeroom: true };
              }
              // Make sure no other teacher is homeroom for this class
              if (pair.isHomeroom) {
                return { ...pair, isHomeroom: false };
              }
              return pair;
            }
          );

          // If the teacher doesn't exist in the pairs, add them
          if (!teacherPairExists) {
            updatedPairs.push({
              teacherId: userId,
              subjectId: "", // No subject assigned yet
              isHomeroom: true,
            });
          }

          batch.update(classRef, {
            teacherSubjectPairs: updatedPairs,
          });

          // Make sure the teacher has an initialized teachesClasses array that includes this class
          const userRef = doc(db, "schools", schoolId, "users", userId);
          batch.update(userRef, {
            teachesClasses: [userFormData.homeroomClassId],
          });
        }
      }

      // Commit all the updates in a single batch
      if (userFormData.role === "student" || userFormData.role === "teacher") {
        await batch.commit();
      }
    }

    // Return full account details for proper feedback
    return {
      success: true,
      userId: userId,
      accountDetails: result.accountDetails || {
        email: userFormData.email,
        role: userFormData.role,
      },
    };
  } catch (error) {
    console.error("Error adding user:", error);
    toast({
      title: "Грешка",
      description: "Неуспешно добавяне на потребител",
      variant: "destructive",
    });
    return {
      success: false,
      error: (error as Error).message,
    };
  }
};

/**
 * Updates an existing user's profile and related class or teacher assignments.
 * @param schoolId ID of the school.
 * @param userId ID of the user to update.
 * @param userFormData Updated user form data.
 * @param currentEmail Current email address for conflict checking.
 * @returns Promise resolving to boolean indicating success.
 */
export const handleEditUser = async (
  schoolId: string,
  userId: string,
  userFormData: UserFormData,
  currentEmail: string
): Promise<boolean> => {
  if (!schoolId || !userId) {
    toast({
      title: "Грешка",
      description: "Липсващо ID на училище или потребител",
      variant: "destructive",
    });
    return false;
  }

  try {
    const userRef = doc(db, "schools", schoolId, "users", userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      toast({
        title: "Грешка",
        description: "Потребителят не е намерен",
        variant: "destructive",
      });
      return false;
    }

    const userData = userDoc.data();

    // Check for email conflicts if email was changed
    if (userFormData.email !== currentEmail) {
      const usersRef = collection(doc(db, "schools", schoolId), "users");
      const emailCheckQuery = query(
        usersRef,
        where("email", "==", userFormData.email)
      );
      const emailCheck = await getDocs(emailCheckQuery);

      if (!emailCheck.empty) {
        const conflictingUser = emailCheck.docs[0];
        if (conflictingUser.id !== userId) {
          toast({
            title: "Грешка",
            description: "Този имейл вече се използва от друг потребител",
            variant: "destructive",
          });
          return false;
        }
      }
    }

    const batch = writeBatch(db);

    const updateData: FirestoreUpdateData = {
      firstName: userFormData.firstName,
      lastName: userFormData.lastName,
      email: userFormData.email,
      phoneNumber: userFormData.phoneNumber,
      gender: userFormData.gender,
    };

    // Handle student specific updates
    if (userFormData.role === "student") {
      // If class has changed, update both the student and classes
      if (userFormData.homeroomClassId !== userData.homeroomClassId) {
        updateData.homeroomClassId = userFormData.homeroomClassId || "";

        // If the student was previously in a class, remove them from that class
        if (userData.homeroomClassId) {
          const oldClassRef = doc(
            db,
            "schools",
            schoolId,
            "classes",
            userData.homeroomClassId
          );
          const oldClassDoc = await getDoc(oldClassRef);

          if (oldClassDoc.exists()) {
            const oldClassData = oldClassDoc.data();
            const studentIds = oldClassData.studentIds || [];

            if (studentIds.includes(userId)) {
              batch.update(oldClassRef, {
                studentIds: studentIds.filter((id: string) => id !== userId),
              });
            }
          }
        }

        // If the student is being assigned to a new class, add them to that class
        if (userFormData.homeroomClassId) {
          const newClassRef = doc(
            db,
            "schools",
            schoolId,
            "classes",
            userFormData.homeroomClassId
          );
          const newClassDoc = await getDoc(newClassRef);

          if (newClassDoc.exists()) {
            const newClassData = newClassDoc.data();
            const studentIds = newClassData.studentIds || [];

            if (!studentIds.includes(userId)) {
              batch.update(newClassRef, {
                studentIds: [...studentIds, userId],
              });
            }
          }
        }
      }
    }
    // Handle teacher specific updates
    else if (userFormData.role === "teacher") {
      // Track if the homeroom class has changed
      const homeroomClassChanged =
        userFormData.homeroomClassId !== userData.homeroomClassId;

      // Update homeroomClassId field
      updateData.homeroomClassId = userFormData.homeroomClassId || "";

      // Handle old homeroom class association
      if (homeroomClassChanged && userData.homeroomClassId) {
        const oldClassRef = doc(
          db,
          "schools",
          schoolId,
          "classes",
          userData.homeroomClassId
        );
        const oldClassDoc = await getDoc(oldClassRef);

        if (oldClassDoc.exists()) {
          const oldClassData = oldClassDoc.data();

          // If this teacher was the homeroom teacher, update the class
          if (oldClassData.classTeacherId === userId) {
            batch.update(oldClassRef, {
              classTeacherId: "",
            });
          }

          // Update teacherSubjectPairs to remove the homeroom flag
          if (
            oldClassData.teacherSubjectPairs &&
            oldClassData.teacherSubjectPairs.length > 0
          ) {
            const updatedPairs = oldClassData.teacherSubjectPairs.map(
              (pair: TeacherSubjectPair) => {
                if (pair.teacherId === userId && pair.isHomeroom) {
                  return { ...pair, isHomeroom: false };
                }
                return pair;
              }
            );

            batch.update(oldClassRef, {
              teacherSubjectPairs: updatedPairs,
            });
          }
        }
      }

      // Handle new homeroom class association
      if (homeroomClassChanged && userFormData.homeroomClassId) {
        const newClassRef = doc(
          db,
          "schools",
          schoolId,
          "classes",
          userFormData.homeroomClassId
        );
        const newClassDoc = await getDoc(newClassRef);

        if (newClassDoc.exists()) {
          const newClassData = newClassDoc.data();

          // Set this teacher as the homeroom teacher
          batch.update(newClassRef, {
            classTeacherId: userId,
          });

          // Update teacherSubjectPairs to set the homeroom flag
          let teacherPairExists = false;
          const updatedPairs = (newClassData.teacherSubjectPairs || []).map(
            (pair: TeacherSubjectPair) => {
              if (pair.teacherId === userId) {
                teacherPairExists = true;
                return { ...pair, isHomeroom: true };
              }
              // Make sure no other teacher is homeroom for this class
              if (pair.isHomeroom) {
                return { ...pair, isHomeroom: false };
              }
              return pair;
            }
          );

          // If the teacher doesn't exist in the pairs, add them
          if (!teacherPairExists) {
            updatedPairs.push({
              teacherId: userId,
              subjectId: "", // No subject assigned yet
              isHomeroom: true,
            });
          }

          batch.update(newClassRef, {
            teacherSubjectPairs: updatedPairs,
          });

          // Also make sure this teacher has this class in their teachesClasses array
          const teachesClasses = userData.teachesClasses || [];
          if (!teachesClasses.includes(userFormData.homeroomClassId)) {
            updateData.teachesClasses = [
              ...teachesClasses,
              userFormData.homeroomClassId,
            ];
          }
        }
      }
      // If just updating non-class fields, keep any existing teachesClasses
      else if (userData.teachesClasses) {
        updateData.teachesClasses = userData.teachesClasses;
      }
    }

    // Update the user document with all our changes
    batch.update(userRef, updateData);

    // Commit all the changes in a single batch
    await batch.commit();

    toast({
      title: "Успешно",
      description: "Потребителят е актуализиран успешно",
    });

    return true;
  } catch (error) {
    console.error("Error updating user:", error);
    toast({
      title: "Грешка",
      description: "Неуспешно актуализиране на потребител",
      variant: "destructive",
    });
    return false;
  }
};

/**
 * Deletes a user and cleans up associations in classes, assignments, quizzes, etc.
 * @param schoolId ID of the school.
 * @param user UserData object representing the user to delete.
 * @returns Promise resolving to boolean indicating success.
 */
export const handleDeleteUser = async (
  schoolId: string,
  user: UserData
): Promise<boolean> => {
  if (!schoolId || !user?.userId) return false;

  try {
    try {
      const authResponse = await fetch(
        `/api/users/delete?userId=${user.userId}`,
        {
          method: "DELETE",
        }
      );

      if (!authResponse.ok) {
        const errorData = await authResponse.json();
        console.error(
          "Failed to delete Firebase Authentication account:",
          errorData
        );
      }
    } catch (authError) {
      console.error(
        "Error deleting Firebase Authentication account:",
        authError
      );
    }

    if (user.role === "teacher") {
      const teacherId = user.userId;
      const batch = writeBatch(db);

      if (user.teachesClasses && user.teachesClasses.length > 0) {
        for (const classId of user.teachesClasses) {
          const classRef = doc(db, "schools", schoolId, "classes", classId);
          const classDoc = await getDoc(classRef);

          if (classDoc.exists()) {
            const classData = classDoc.data();

            if (
              classData.teacherSubjectPairs &&
              classData.teacherSubjectPairs.length > 0
            ) {
              const updatedPairs = classData.teacherSubjectPairs.filter(
                (pair: TeacherSubjectPair) => pair.teacherId !== teacherId
              );

              batch.update(classRef, {
                teacherSubjectPairs: updatedPairs,
              });

              if (classData.classTeacherId === teacherId) {
                batch.update(classRef, {
                  classTeacherId: "",
                });
              }
            }
          }
        }
      }

      const classesRef = collection(doc(db, "schools", schoolId), "classes");
      const classesSnapshot = await getDocs(classesRef);

      if (!classesSnapshot.empty) {
        classesSnapshot.forEach((classDoc) => {
          const classData = classDoc.data();
          let needsUpdate = false;
          const updates: FirestoreUpdateData = {};

          if (classData.classTeacherId === teacherId) {
            updates.classTeacherId = "";
            needsUpdate = true;
          }

          if (classData.teacher === teacherId) {
            updates.teacher = "";
            needsUpdate = true;
          }

          if (classData.teacherId === teacherId) {
            updates.teacherId = "";
            needsUpdate = true;
          }

          if (
            classData.teacherSubjectPairs &&
            classData.teacherSubjectPairs.length > 0
          ) {
            const updatedPairs = classData.teacherSubjectPairs.filter(
              (pair: TeacherSubjectPair) => pair.teacherId !== teacherId
            );

            if (updatedPairs.length !== classData.teacherSubjectPairs.length) {
              updates.teacherSubjectPairs = updatedPairs;
              needsUpdate = true;
            }
          }

          if (
            classData.teachersArray &&
            classData.teachersArray.includes(teacherId)
          ) {
            updates.teachersArray = classData.teachersArray.filter(
              (id: string) => id !== teacherId
            );
            needsUpdate = true;
          }

          if (needsUpdate) {
            batch.update(classDoc.ref, updates);
          }
        });
      }

      const assignmentsRef = collection(
        doc(db, "schools", schoolId),
        "assignments"
      );
      const assignmentsQuery = query(
        assignmentsRef,
        where("teacherId", "==", teacherId)
      );
      const assignmentsSnapshot = await getDocs(assignmentsQuery);

      if (!assignmentsSnapshot.empty) {
        assignmentsSnapshot.forEach((doc) => {
          batch.update(doc.ref, {
            teacherId: "",
            teacherName: "Former Teacher",
          });
        });
      }

      const quizzesRef = collection(doc(db, "schools", schoolId), "quizzes");
      const quizzesQuery = query(
        quizzesRef,
        where("teacherId", "==", teacherId)
      );
      const quizzesSnapshot = await getDocs(quizzesQuery);

      if (!quizzesSnapshot.empty) {
        quizzesSnapshot.forEach((doc) => {
          batch.update(doc.ref, {
            teacherId: "",
            teacherName: "Former Teacher",
          });
        });
      }

      const gradesRef = collection(doc(db, "schools", schoolId), "grades");
      const gradesSnapshot = await getDocs(gradesRef);

      if (!gradesSnapshot.empty) {
        gradesSnapshot.forEach((gradeDoc) => {
          const gradeData = gradeDoc.data();
          let needsUpdate = false;

          if (gradeData.grades) {
            for (const subjectId in gradeData.grades) {
              if (
                gradeData.subjectTeachers &&
                gradeData.subjectTeachers[subjectId] === teacherId
              ) {
                if (gradeData.subjectTeachers) {
                  delete gradeData.subjectTeachers[subjectId];
                  needsUpdate = true;
                }
              }

              for (const studentId in gradeData.grades[subjectId]) {
                const studentGrades = gradeData.grades[subjectId][studentId];
                if (Array.isArray(studentGrades)) {
                  for (let i = 0; i < studentGrades.length; i++) {
                    if (
                      studentGrades[i] &&
                      studentGrades[i].teacherId === teacherId
                    ) {
                      studentGrades[i].teacherId = "";
                      studentGrades[i].teacherName = "Former Teacher";
                      needsUpdate = true;
                    }
                  }
                }
              }
            }
          }

          if (needsUpdate) {
            batch.update(gradeDoc.ref, {
              grades: gradeData.grades,
              subjectTeachers: gradeData.subjectTeachers || {},
            });
          }
        });
      }

      const attendanceRef = collection(
        doc(db, "schools", schoolId),
        "attendance"
      );
      const teacherAttendanceQuery = query(
        attendanceRef,
        where("teacherId", "==", teacherId)
      );
      const teacherAttendanceSnapshot = await getDocs(teacherAttendanceQuery);

      if (!teacherAttendanceSnapshot.empty) {
        teacherAttendanceSnapshot.forEach((doc) => {
          batch.update(doc.ref, {
            teacherId: "",
            teacherName: "Former Teacher",
          });
        });
      }

      const subjectsRef = collection(doc(db, "schools", schoolId), "subjects");
      const subjectsSnapshot = await getDocs(subjectsRef);

      if (!subjectsSnapshot.empty) {
        subjectsSnapshot.forEach((subjectDoc) => {
          const subjectData = subjectDoc.data();
          let needsUpdate = false;

          if (
            subjectData.teachers &&
            subjectData.teachers.includes(teacherId)
          ) {
            batch.update(subjectDoc.ref, {
              teachers: subjectData.teachers.filter(
                (id: string) => id !== teacherId
              ),
            });
            needsUpdate = true;
          }

          if (
            subjectData.teacherSubjectPairs &&
            Array.isArray(subjectData.teacherSubjectPairs)
          ) {
            const updatedPairs = subjectData.teacherSubjectPairs.filter(
              (pair: TeacherSubjectPair) => pair.teacherId !== teacherId
            );

            if (
              updatedPairs.length !== subjectData.teacherSubjectPairs.length
            ) {
              batch.update(subjectDoc.ref, {
                teacherSubjectPairs: updatedPairs,
              });
              needsUpdate = true;
            }
          }

          if (
            subjectData.teacherIds &&
            Array.isArray(subjectData.teacherIds) &&
            subjectData.teacherIds.includes(teacherId)
          ) {
            batch.update(subjectDoc.ref, {
              teacherIds: subjectData.teacherIds.filter(
                (id: string) => id !== teacherId
              ),
            });
            needsUpdate = true;
          }

          if (needsUpdate) {
            console.log(
              `Removed teacher ${teacherId} from subject ${subjectDoc.id}`
            );
          }
        });
      }

      const timetableRef = collection(
        doc(db, "schools", schoolId),
        "timetable"
      );
      const timetableQuery = query(
        timetableRef,
        where("teacherId", "==", teacherId)
      );
      const timetableSnapshot = await getDocs(timetableQuery);

      if (!timetableSnapshot.empty) {
        timetableSnapshot.forEach((doc) => {
          batch.update(doc.ref, {
            teacherId: "",
            teacherName: "Former Teacher",
          });
        });
      }

      const notificationsRef = collection(
        doc(db, "schools", schoolId),
        "notifications"
      );

      const sentNotificationsQuery = query(
        notificationsRef,
        where("senderId", "==", teacherId)
      );
      const sentNotificationsSnapshot = await getDocs(sentNotificationsQuery);

      if (!sentNotificationsSnapshot.empty) {
        sentNotificationsSnapshot.forEach((doc) => {
          batch.update(doc.ref, {
            senderId: "",
            senderName: "Former Teacher",
          });
        });
      }

      const recipientNotificationsQuery = query(
        notificationsRef,
        where("recipientId", "==", teacherId)
      );
      const recipientNotificationsSnapshot = await getDocs(
        recipientNotificationsQuery
      );

      if (!recipientNotificationsSnapshot.empty) {
        recipientNotificationsSnapshot.forEach((doc) => {
          batch.delete(doc.ref);
        });
      }

      const usersRef = collection(doc(db, "schools", schoolId), "users");
      const usersSnapshot = await getDocs(usersRef);

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        if (userData.inbox && userData.inbox.conversations) {
          let updatedConversations = false;

          const conversations = userData.inbox.conversations;
          for (let i = 0; i < conversations.length; i++) {
            if (
              conversations[i].participants &&
              conversations[i].participants.includes(teacherId)
            ) {
              conversations[i].participants = conversations[
                i
              ].participants.filter((id: string) => id !== teacherId);
              updatedConversations = true;

              if (conversations[i].participants.length === 1) {
                conversations[i].otherUserLeft = true;
              }
            }

            if (conversations[i].messages) {
              for (let j = 0; j < conversations[i].messages.length; j++) {
                if (conversations[i].messages[j].senderId === teacherId) {
                  conversations[i].messages[j].senderId = "";
                  conversations[i].messages[j].senderName = "Former Teacher";
                  updatedConversations = true;
                }
              }
            }
          }

          if (updatedConversations) {
            batch.update(userDoc.ref, {
              "inbox.conversations": conversations,
            });
          }
        }
      }

      await batch.commit();
    }

    if (user.role === "student") {
      const studentId = user.userId;
      const batch = writeBatch(db);

      if (user.homeroomClassId) {
        const classRef = doc(
          db,
          "schools",
          schoolId,
          "classes",
          user.homeroomClassId
        );
        const classDoc = await getDoc(classRef);

        if (classDoc.exists()) {
          const classData = classDoc.data();

          if (
            classData.studentIds &&
            classData.studentIds.includes(studentId)
          ) {
            batch.update(classRef, {
              studentIds: classData.studentIds.filter(
                (id: string) => id !== studentId
              ),
            });
          }
        }
      }

      const assignmentsRef = collection(
        doc(db, "schools", schoolId),
        "assignments"
      );
      const assignmentsSnapshot = await getDocs(assignmentsRef);

      if (!assignmentsSnapshot.empty) {
        assignmentsSnapshot.forEach((assignmentDoc) => {
          const assignmentData = assignmentDoc.data();

          if (assignmentData.submissions) {
            const updatedSubmissions = assignmentData.submissions.filter(
              (submission: { studentId: string }) =>
                submission.studentId !== studentId
            );

            if (
              assignmentData.submissions.length !== updatedSubmissions.length
            ) {
              batch.update(assignmentDoc.ref, {
                submissions: updatedSubmissions,
              });
            }
          }
        });
      }

      const quizzesRef = collection(doc(db, "schools", schoolId), "quizzes");
      const quizzesSnapshot = await getDocs(quizzesRef);

      if (!quizzesSnapshot.empty) {
        quizzesSnapshot.forEach((quizDoc) => {
          const quizData = quizDoc.data();

          if (quizData.attempts) {
            const updatedAttempts = quizData.attempts.filter(
              (attempt: { studentId: string }) =>
                attempt.studentId !== studentId
            );

            if (quizData.attempts.length !== updatedAttempts.length) {
              batch.update(quizDoc.ref, {
                attempts: updatedAttempts,
              });
            }
          }
        });
      }

      const attendanceRef = collection(
        doc(db, "schools", schoolId),
        "attendance"
      );
      const attendanceQuery = query(
        attendanceRef,
        where("studentIds", "array-contains", studentId)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);

      if (!attendanceSnapshot.empty) {
        attendanceSnapshot.forEach((doc) => {
          const attendanceData = doc.data();
          let needsUpdate = false;

          if (
            attendanceData.studentIds &&
            attendanceData.studentIds.includes(studentId)
          ) {
            attendanceData.studentIds = attendanceData.studentIds.filter(
              (id: string) => id !== studentId
            );
            needsUpdate = true;
          }

          if (attendanceData.records) {
            for (const date in attendanceData.records) {
              if (attendanceData.records[date][studentId]) {
                delete attendanceData.records[date][studentId];
                needsUpdate = true;
              }
            }
          }

          if (needsUpdate) {
            batch.update(doc.ref, {
              studentIds: attendanceData.studentIds,
              records: attendanceData.records,
            });
          }
        });
      }

      const gradesRef = collection(doc(db, "schools", schoolId), "grades");
      const gradesQuery = query(
        gradesRef,
        where("studentIds", "array-contains", studentId)
      );
      const gradesSnapshot = await getDocs(gradesQuery);

      if (!gradesSnapshot.empty) {
        gradesSnapshot.forEach((doc) => {
          const gradeData = doc.data();
          let needsUpdate = false;

          if (
            gradeData.studentIds &&
            gradeData.studentIds.includes(studentId)
          ) {
            gradeData.studentIds = gradeData.studentIds.filter(
              (id: string) => id !== studentId
            );
            needsUpdate = true;
          }

          if (gradeData.grades) {
            for (const subjectId in gradeData.grades) {
              if (gradeData.grades[subjectId][studentId]) {
                delete gradeData.grades[subjectId][studentId];
                needsUpdate = true;
              }
            }
          }

          if (needsUpdate) {
            batch.update(doc.ref, {
              studentIds: gradeData.studentIds,
              grades: gradeData.grades,
            });
          }
        });
      }

      const usersRef = collection(doc(db, "schools", schoolId), "users");
      const parentsQuery = query(
        usersRef,
        where("role", "==", "parent"),
        where("childrenIds", "array-contains", studentId)
      );
      const parentsSnapshot = await getDocs(parentsQuery);

      if (!parentsSnapshot.empty) {
        parentsSnapshot.forEach((parentDoc) => {
          const parentData = parentDoc.data();

          batch.update(parentDoc.ref, {
            childrenIds: parentData.childrenIds.filter(
              (id: string) => id !== studentId
            ),
          });
        });
      }

      const usersSnapshot = await getDocs(usersRef);

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        if (userData.inbox && userData.inbox.conversations) {
          let updatedConversations = false;

          const conversations = userData.inbox.conversations;
          for (let i = 0; i < conversations.length; i++) {
            if (
              conversations[i].participants &&
              conversations[i].participants.includes(studentId)
            ) {
              conversations[i].participants = conversations[
                i
              ].participants.filter((id: string) => id !== studentId);
              updatedConversations = true;

              if (conversations[i].participants.length === 1) {
                conversations[i].otherUserLeft = true;
              }
            }
          }

          if (updatedConversations) {
            batch.update(userDoc.ref, {
              "inbox.conversations": conversations,
            });
          }
        }
      }

      await batch.commit();
    }

    if (user.role === "parent") {
      const parentId = user.userId;
      const batch = writeBatch(db);

      if (user.childrenIds && user.childrenIds.length > 0) {
        const usersRef = collection(doc(db, "schools", schoolId), "users");

        for (const childId of user.childrenIds) {
          const childRef = doc(usersRef, childId);
          const childDoc = await getDoc(childRef);

          if (childDoc.exists()) {
            const childData = childDoc.data();

            if (childData.parentIds && childData.parentIds.includes(parentId)) {
              batch.update(childRef, {
                parentIds: childData.parentIds.filter(
                  (id: string) => id !== parentId
                ),
              });
            }
          }
        }
      }

      const linkRequestsRef = collection(
        doc(db, "schools", schoolId),
        "parentLinkRequests"
      );
      const linkRequestsQuery = query(
        linkRequestsRef,
        where("parentId", "==", parentId)
      );
      const linkRequestsSnapshot = await getDocs(linkRequestsQuery);

      if (!linkRequestsSnapshot.empty) {
        linkRequestsSnapshot.forEach((doc) => {
          batch.delete(doc.ref);
        });
      }

      const usersRef = collection(doc(db, "schools", schoolId), "users");
      const usersSnapshot = await getDocs(usersRef);

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        if (userData.inbox && userData.inbox.conversations) {
          let updatedConversations = false;

          const conversations = userData.inbox.conversations;
          for (let i = 0; i < conversations.length; i++) {
            if (
              conversations[i].participants &&
              conversations[i].participants.includes(parentId)
            ) {
              conversations[i].participants = conversations[
                i
              ].participants.filter((id: string) => id !== parentId);
              updatedConversations = true;

              if (conversations[i].participants.length === 1) {
                conversations[i].otherUserLeft = true;
              }
            }
          }

          if (updatedConversations) {
            batch.update(userDoc.ref, {
              "inbox.conversations": conversations,
            });
          }
        }
      }

      const notificationsRef = collection(
        doc(db, "schools", schoolId),
        "notifications"
      );
      const notificationsQuery = query(
        notificationsRef,
        where("recipientId", "==", parentId)
      );
      const notificationsSnapshot = await getDocs(notificationsQuery);

      if (!notificationsSnapshot.empty) {
        notificationsSnapshot.forEach((doc) => {
          batch.delete(doc.ref);
        });
      }

      await batch.commit();
    }

    await deleteDoc(doc(db, "schools", schoolId, "users", user.userId));

    toast({
      title: "Успешно",
      description: "Потребителят е изтрит успешно",
    });

    return true;
  } catch (error) {
    console.error("Error deleting user:", error);
    toast({
      title: "Грешка",
      description: "Неуспешно изтриване на потребител",
      variant: "destructive",
    });
    return false;
  }
};

/**
 * Downloads an Excel template for bulk user import.
 */
export const downloadImportTemplate = () => {
  const ws = XLSX.utils.aoa_to_sheet([
    [
      "firstName",
      "lastName",
      "phoneNumber",
      "role",
      "gender",
      "classNamingFormat",
      "gradeNumber",
      "classLetter",
      "customClassName",
      "homeroomClassId",
    ],
    [
      "John",
      "Doe",
      "555-123-4567",
      "student",
      "male",
      "graded",
      "9",
      "A",
      "",
      "",
    ],
    [
      "Jane",
      "Smith",
      "555-987-6543",
      "student",
      "female",
      "custom",
      "",
      "",
      "English Advanced",
      "",
    ],
    [
      "Emily",
      "Johnson",
      "555-456-7890",
      "teacher",
      "female",
      "graded",
      "10",
      "B",
      "",
      "",
    ],
    [
      "Sarah",
      "Williams",
      "555-234-5678",
      "admin",
      "female",
      "",
      "",
      "",
      "",
      "",
    ],
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "User Import Template");

  XLSX.writeFile(wb, "user_import_template.xlsx");
};

/**
 * Processes a bulk import Excel file, validating required fields and building user data.
 * @param file Excel File to process.
 * @returns Promise resolving to processed UserData array and error messages.
 */
export const processImportFile = (
  file: File
): Promise<{
  processedData: UserData[];
  errors: string[];
}> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        if (!data) {
          resolve({ processedData: [], errors: ["Could not read file data"] });
          return;
        }

        const workbook = XLSX.read(data as string, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData: Record<string, string | number>[] =
          XLSX.utils.sheet_to_json(sheet);

        const errors: string[] = [];
        const processedData: UserData[] = [];

        for (let i = 0; i < jsonData.length; i++) {
          const row: Record<string, string | number> = jsonData[i];
          const rowIndex = i + 2;

          const requiredFields = ["firstName", "lastName", "role", "gender"];
          const missingFields = requiredFields.filter((field) => !row[field]);

          if (row.role === "student") {
            if (!row.classNamingFormat) {
              missingFields.push("classNamingFormat");
            } else if (
              row.classNamingFormat === "graded" &&
              (!row.gradeNumber || !row.classLetter)
            ) {
              if (!row.gradeNumber) missingFields.push("gradeNumber");
              if (!row.classLetter) missingFields.push("classLetter");
            } else if (
              row.classNamingFormat === "custom" &&
              !row.customClassName
            ) {
              missingFields.push("customClassName");
            }
          } else if (row.role === "teacher") {
            const isHomeroomTeacher = !!row.homeroomClassId;

            if (isHomeroomTeacher) {
              if (
                typeof row.homeroomClassId === "string" &&
                /^\d+[A-Za-zА-Яа-я]$/.test(row.homeroomClassId)
              ) {
                // Valid format
              } else if (!row.classNamingFormat) {
                missingFields.push("classNamingFormat");
              } else if (
                row.classNamingFormat === "graded" &&
                (!row.gradeNumber || !row.classLetter)
              ) {
                if (!row.gradeNumber) missingFields.push("gradeNumber");
                if (!row.classLetter) missingFields.push("classLetter");
              } else if (
                row.classNamingFormat === "custom" &&
                !row.customClassName
              ) {
                missingFields.push("customClassName");
              }
            }
          }

          if (missingFields.length > 0) {
            errors.push(
              `Row ${rowIndex}: Missing required fields: ${missingFields.join(
                ", "
              )}`
            );
            continue;
          }

          if (!["admin", "teacher", "student"].includes(String(row.role))) {
            errors.push(
              `Row ${rowIndex}: Invalid role. Must be 'admin', 'teacher', or 'student'`
            );
            continue;
          }

          if (!["male", "female", "other"].includes(String(row.gender))) {
            errors.push(
              `Row ${rowIndex}: Invalid gender. Must be 'male', 'female', or 'other'`
            );
            continue;
          }

          if (
            row.classNamingFormat &&
            !["graded", "custom"].includes(String(row.classNamingFormat))
          ) {
            errors.push(
              `Row ${rowIndex}: Invalid classNamingFormat. Must be 'graded' or 'custom'`
            );
            continue;
          }

          const processedRow: UserData = {
            firstName: row.firstName as string,
            lastName: row.lastName as string,
            phoneNumber: (row.phoneNumber as string) || "",
            role: row.role as UserRole,
            gender: row.gender as string,
            email: `${transliterateBulgarianToLatin(
              (row.firstName as string).toLowerCase()
            ).charAt(0)}${transliterateBulgarianToLatin(
              (row.lastName as string).toLowerCase()
            ).charAt(0)}${Math.floor(10000 + Math.random() * 90000)}@poko.com`,
          };

          if (
            row.role === "student" ||
            (row.role === "teacher" &&
              (row.classNamingFormat || row.homeroomClassId))
          ) {
            if (row.classNamingFormat) {
              processedRow.classNamingFormat =
                row.classNamingFormat as ClassNamingFormat;

              if (row.classNamingFormat === "graded") {
                processedRow.gradeNumber = Number(row.gradeNumber); // Explicitly convert to a number
                processedRow.classLetter = row.classLetter as string;
              } else if (row.classNamingFormat === "custom") {
                processedRow.customClassName = row.customClassName as string;
              }
            }

            if (row.homeroomClassId) {
              processedRow.homeroomClassId = row.homeroomClassId as string;
            }
          }

          processedData.push(processedRow);
        }

        resolve({ processedData, errors });
      } catch (error) {
        console.error("Error parsing file:", error);
        reject(error);
      }
    };

    reader.onerror = (error) => {
      reject(error);
    };

    reader.readAsBinaryString(file);
  });
};

/**
 * Finds or creates a class based on naming format, and associates homeroom teacher if provided.
 * @param schoolId ID of the school.
 * @param userData UserData containing class naming information.
 * @param teacherId Optional teacher ID to set as homeroom.
 * @returns Promise resolving to the classId.
 */
export const getOrCreateClass = async (
  schoolId: string,
  userData: UserData,
  teacherId: string = ""
): Promise<string> => {
  if (!schoolId) return "";

  let className = "";

  if (userData.role === "teacher" && userData.homeroomClassId) {
    className = userData.homeroomClassId;
  } else if (
    userData.classNamingFormat === "graded" &&
    userData.gradeNumber &&
    userData.classLetter
  ) {
    className = `${userData.gradeNumber}${userData.classLetter}`;
  } else if (
    userData.classNamingFormat === "custom" &&
    userData.customClassName
  ) {
    className = userData.customClassName;
  } else if (userData.homeroomClassId) {
    className = userData.homeroomClassId;
  } else {
    return "";
  }

  const classesRef = collection(db, "schools", schoolId, "classes");
  const q = query(classesRef, where("className", "==", className));
  const snapshot = await getDocs(q);
  let classDocId = "";

  if (!snapshot.empty) {
    classDocId = snapshot.docs[0].id;

    if (teacherId && userData.role === "teacher" && userData.homeroomClassId) {
      const classData = snapshot.docs[0].data();
      const teacherSubjectPairs = classData.teacherSubjectPairs || [];

      await updateDoc(doc(classesRef, classDocId), {
        teacherSubjectPairs:
          teacherSubjectPairs.length > 0
            ? teacherSubjectPairs.map((p: TeacherSubjectPair) =>
                p.isHomeroom ? { ...p, teacherId } : p
              )
            : [{ teacherId, subjectId: "", isHomeroom: true }],
        classTeacherId: teacherId,
      });
    }

    return classDocId;
  } else {
    const newClassRef = doc(classesRef);
    classDocId = newClassRef.id;

    const nameParts = className.match(/^(\d+)([A-Za-zА-Яа-я])$/);
    const isGraded = !!nameParts;

    const classData: Record<string, unknown> = {
      classId: classDocId,
      className,
      namingFormat: isGraded ? "graded" : "custom",
      studentIds: [],
      teacherSubjectPairs: [],
      createdAt: Timestamp.now(),
    };

    if (teacherId && userData.role === "teacher" && userData.homeroomClassId) {
      classData.classTeacherId = teacherId;
      classData.teacherSubjectPairs = [
        {
          teacherId,
          subjectId: "",
          isHomeroom: true,
        },
      ];
    }

    if (isGraded) {
      classData.gradeNumber = parseInt(nameParts![1]);
      classData.classLetter = nameParts![2];
      classData.educationLevel =
        parseInt(nameParts![1]) <= 4
          ? "primary"
          : parseInt(nameParts![1]) <= 7
          ? "middle"
          : "high";
    } else if (userData.customClassName) {
      classData.customName = userData.customClassName;
      classData.educationLevel = "primary";
    }

    await setDoc(newClassRef, classData);
    return classDocId;
  }
};

/**
 * Imports multiple users using server API and returns summary of results.
 * Uses chunked processing to prevent timeouts with large imports.
 * @param schoolId ID of the school.
 * @param importData Array of UserData to import.
 * @returns Promise resolving to import summary with success and failure details.
 */
export const importUsers = async (
  schoolId: string,
  importData: UserData[]
): Promise<{
  success: boolean;
  successAccounts?: {
    email: string;
    password: string;
    userId: string;
    role: string;
  }[];
  failedAccounts?: { email: string; error: string }[];
}> => {
  if (!schoolId || importData.length === 0) {
    return { success: false };
  }

  try {
    const MAX_USERS_PER_CHUNK = 40;
    const chunks: UserData[][] = [];

    // Split the importData into chunks to prevent timeouts
    for (let i = 0; i < importData.length; i += MAX_USERS_PER_CHUNK) {
      chunks.push(importData.slice(i, i + MAX_USERS_PER_CHUNK));
    }

    const totalChunks = chunks.length;
    let currentChunkIndex = 0;
    let results = {
      success: [] as { email: string; password: string; userId: string }[],
      failed: [] as { email: string; error: string }[],
      total: importData.length,
      chunksTotal: totalChunks,
      chunksProcessed: 0,
      classesProcessed: 0,
    };

    // Show initial progress toast
    toast({
      title: "Импортиране започна",
      description: `Обработка на ${importData.length} потребители в ${totalChunks} стъпки...`,
    });

    // Process each chunk sequentially
    for (const chunk of chunks) {
      const isLastChunk = currentChunkIndex === chunks.length - 1;

      // Show progress toast for larger imports
      if (chunks.length > 1) {
        toast({
          title: "Прогрес на импортирането",
          description: `Обработка на стъпка ${
            currentChunkIndex + 1
          } от ${totalChunks}...`,
        });
      }

      const response = await fetch("/api/users/bulk-import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId,
          importData: chunk,
          chunkIndex: currentChunkIndex,
          finalChunk: isLastChunk,
          previousResults: results,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to import users");
      }

      const result = await response.json();
      results = result.results;
      currentChunkIndex++;

      // If it's not the final chunk yet, continue to the next one
      if (!result.completed) {
        continue;
      }
    }

    // Show final result toast
    toast({
      title: "Успешно",
      description: `Успешно импортирани ${results.success.length} от общо ${results.total} потребители.`,
    });

    if (results.failed.length > 0) {
      console.warn("Some users failed to import:", results.failed);
      toast({
        title: "Предупреждение",
        description: `${results.failed.length} потребители не можаха да бъдат импортирани.`,
        variant: "destructive",
      });
    }

    return {
      success: results.success.length > 0,
      successAccounts: results.success.map((account: UserAccountDetails) => ({
        email: account.email,
        password: account.password,
        userId: account.userId,
        role:
          importData.find((user) => user.email === account.email)?.role ||
          "unknown",
      })),
      failedAccounts: results.failed,
    };
  } catch (error) {
    console.error("Error importing users:", error);
    toast({
      title: "Грешка",
      description: `Неуспешен импорт на потребители: ${
        (error as Error).message
      }`,
      variant: "destructive",
    });
    return {
      success: false,
      failedAccounts: [
        {
          email: "import process",
          error: (error as Error).message,
        },
      ],
    };
  }
};

/**
 * Exports user data to an Excel file and triggers file download.
 * @param schoolId ID of the school.
 * @param users Optional array of UserData to export.
 * @param classes Optional array of SchoolClass for mapping class IDs to names.
 */
export const exportUsersData = async (
  schoolId: string,
  users?: UserData[],
  classes?: SchoolClass[]
) => {
  if (!users || users.length === 0) {
    try {
      const usersRef = collection(doc(db, "schools", schoolId), "users");
      const snapshot = await getDocs(usersRef);
      users = [];
      snapshot.forEach((doc) => {
        const userData = doc.data() as UserData;
        users!.push({
          ...userData,
          userId: doc.id,
        });
      });
    } catch (error) {
      console.error("Error fetching users for export:", error);
      toast({
        title: "Грешка",
        description: "Неуспешно извличане на потребители за експорт",
        variant: "destructive",
      });
      return;
    }
  }

  if (!classes) {
    try {
      const classesRef = collection(db, "schools", schoolId, "classes");
      const snapshot = await getDocs(classesRef);
      classes = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        classes!.push({
          ...data,
          classId: doc.id,
          className: data.className || data.name || `Class ${doc.id}`,
        });
      });
    } catch (error) {
      console.error("Error fetching classes for export:", error);
    }
  }

  if (!schoolId || !users || users.length === 0) {
    toast({
      title: "Грешка",
      description: "Няма налични данни за потребители за експорт",
      variant: "destructive",
    });
    return;
  }

  try {
    const passwordsResponse = await fetch(
      `/api/users/get-decrypted-passwords?schoolId=${encodeURIComponent(
        schoolId
      )}`
    );

    if (!passwordsResponse.ok) {
      throw new Error("Failed to fetch passwords securely");
    }

    const passwordsMap = await passwordsResponse.json();

    const headers = [
      "First Name",
      "Last Name",
      "Email",
      "Password",
      "Role",
      "Homeroom Class",
      "Phone Number",
      "Gender",
    ];

    const rows = users.map((user) => {
      const className =
        user.homeroomClassId && classes
          ? classes.find((cls) => cls.classId === user.homeroomClassId)
              ?.className || "N/A"
          : "N/A";

      const password =
        user.userId && passwordsMap[user.userId]
          ? passwordsMap[user.userId]
          : "N/A";

      return [
        user.firstName,
        user.lastName,
        user.email,
        password,
        user.role,
        className,
        user.phoneNumber || "",
        user.gender || "",
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    const columnWidths = [
      { wch: 15 },
      { wch: 15 },
      { wch: 30 },
      { wch: 15 },
      { wch: 10 },
      { wch: 15 },
      { wch: 15 },
      { wch: 10 },
    ];
    ws["!cols"] = columnWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");

    const currentDate = new Date().toISOString().split("T")[0];
    const fileName = `users_export_${currentDate}.xlsx`;

    XLSX.writeFile(wb, fileName);

    toast({
      title: "Успешно",
      description: `Експортирани ${users.length} потребители към ${fileName}`,
    });
  } catch (error) {
    console.error("Error exporting users:", error);
    toast({
      title: "Грешка",
      description: "Неуспешно експортиране на данни за потребители",
      variant: "destructive",
    });
  }
};
