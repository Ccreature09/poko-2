import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  writeBatch,
  setDoc,
  arrayUnion,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
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

/**
 * Transliterates Bulgarian Cyrillic characters to Latin.
 * Used for email address generation from Cyrillic names.
 * @param text The text to transliterate
 * @returns Transliterated Latin text
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
 * Adds a new user to the school's database using the Firebase Admin SDK
 * @param schoolId The ID of the school to add the user to
 * @param userFormData The user data to add
 * @returns The ID of the newly created user
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
        title: "Error",
        description: "A user with this email already exists",
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

    // Return full account details for proper feedback
    return {
      success: true,
      userId: result.userId,
      accountDetails: result.accountDetails || {
        email: userFormData.email,
        role: userFormData.role,
      },
    };
  } catch (error) {
    console.error("Error adding user:", error);
    toast({
      title: "Error",
      description: "Failed to add user",
      variant: "destructive",
    });
    return {
      success: false,
      error: (error as Error).message,
    };
  }
};

/**
 * Updates an existing user in the school's database
 * @param schoolId The ID of the school the user belongs to
 * @param userId The ID of the user to update
 * @param userFormData The updated user data
 * @param currentEmail The user's current email to check for conflicts
 * @returns Boolean indicating whether the update was successful
 */
export const handleEditUser = async (
  schoolId: string,
  userId: string,
  userFormData: UserFormData,
  currentEmail: string
): Promise<boolean> => {
  if (!schoolId || !userId) {
    toast({
      title: "Error",
      description: "Missing school ID or user ID",
      variant: "destructive",
    });
    return false;
  }

  try {
    const userRef = doc(db, "schools", schoolId, "users", userId);

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
            title: "Error",
            description: "This email is already in use by another user",
            variant: "destructive",
          });
          return false;
        }
      }
    }

    const updateData: {
      firstName: string;
      lastName: string;
      email: string;
      phoneNumber: string;
      gender: string;
      homeroomClassId?: string;
      teachesClasses?: string[];
    } = {
      firstName: userFormData.firstName,
      lastName: userFormData.lastName,
      email: userFormData.email,
      phoneNumber: userFormData.phoneNumber,
      gender: userFormData.gender,
    };

    if (userFormData.role === "student" && userFormData.homeroomClassId) {
      updateData.homeroomClassId = userFormData.homeroomClassId;
    } else if (userFormData.role === "teacher") {
      updateData.teachesClasses = userFormData.teachesClasses || [];
    }

    await updateDoc(userRef, updateData);

    toast({
      title: "Success",
      description: "User updated successfully",
    });

    return true;
  } catch (error) {
    console.error("Error updating user:", error);
    toast({
      title: "Error",
      description: "Failed to update user",
      variant: "destructive",
    });
    return false;
  }
};

/**
 * Deletes a user and cleans up all associations
 * @param schoolId The ID of the school the user belongs to
 * @param user The user to delete
 * @returns Boolean indicating whether the deletion was successful
 */
export const handleDeleteUser = async (
  schoolId: string,
  user: UserData
): Promise<boolean> => {
  if (!schoolId || !user?.userId) return false;

  try {
    // First, attempt to delete the Firebase Authentication account
    try {
      // Call a server-side API endpoint to delete the user's Firebase Authentication account
      const authResponse = await fetch(
        `/api/users/delete-auth?userId=${user.userId}`,
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
        // Continue with Firestore deletion even if auth deletion fails
      }
    } catch (authError) {
      console.error(
        "Error deleting Firebase Authentication account:",
        authError
      );
      // Continue with Firestore deletion even if auth deletion fails
    }

    // If the user is a teacher, we need to clean up all references
    if (user.role === "teacher") {
      const teacherId = user.userId;
      const batch = writeBatch(db);

      // 1a. Remove teacher from classes they teach
      if (user.teachesClasses && user.teachesClasses.length > 0) {
        for (const classId of user.teachesClasses) {
          const classRef = doc(db, "schools", schoolId, "classes", classId);
          const classDoc = await getDoc(classRef);

          if (classDoc.exists()) {
            const classData = classDoc.data();

            // Remove references to teacherIds array and just focus on teacherSubjectPairs
            if (
              classData.teacherSubjectPairs &&
              classData.teacherSubjectPairs.length > 0
            ) {
              const updatedPairs = classData.teacherSubjectPairs.filter(
                (pair: any) => pair.teacherId !== teacherId
              );

              batch.update(classRef, {
                teacherSubjectPairs: updatedPairs,
              });

              // If this teacher was a homeroom teacher, reset the classTeacherId
              if (classData.classTeacherId === teacherId) {
                batch.update(classRef, {
                  classTeacherId: "",
                });
              }
            }
          }
        }
      }

      // 1b. Find and clean up ANY classes where this teacher might be referenced
      // (including homeroom teacher assignments not in the teachesClasses array)
      const classesRef = collection(doc(db, "schools", schoolId), "classes");
      const classesSnapshot = await getDocs(classesRef);

      if (!classesSnapshot.empty) {
        classesSnapshot.forEach((classDoc) => {
          const classData = classDoc.data();
          let needsUpdate = false;
          let updates: any = {};

          // Check if this teacher is referenced as class teacher (homeroom)
          if (classData.classTeacherId === teacherId) {
            updates.classTeacherId = "";
            needsUpdate = true;
          }

          // Check teacher references in teacher field (legacy field in some documents)
          if (classData.teacher === teacherId) {
            updates.teacher = "";
            needsUpdate = true;
          }

          // Check teacher references in teacherId field (legacy field in some documents)
          if (classData.teacherId === teacherId) {
            updates.teacherId = "";
            needsUpdate = true;
          }

          // Check teacher references in any teacherSubjectPairs
          if (
            classData.teacherSubjectPairs &&
            classData.teacherSubjectPairs.length > 0
          ) {
            const updatedPairs = classData.teacherSubjectPairs.filter(
              (pair: any) => pair.teacherId !== teacherId
            );

            if (updatedPairs.length !== classData.teacherSubjectPairs.length) {
              updates.teacherSubjectPairs = updatedPairs;
              needsUpdate = true;
            }
          }

          // Check if this teacher is in any teachersArray (another possible field)
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

      // 2. Check for any assignments, quizzes, or grades created by this teacher
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
          // You could either delete the assignments or reassign them to another teacher
          // For now, we'll just remove the teacher reference
          batch.update(doc.ref, {
            teacherId: "",
            teacherName: "Former Teacher",
          });
        });
      }

      // 3. Check for any quizzes created by this teacher
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

      // 4. Clean up teacher's entries in grade records
      const gradesRef = collection(doc(db, "schools", schoolId), "grades");
      const gradesSnapshot = await getDocs(gradesRef);

      if (!gradesSnapshot.empty) {
        gradesSnapshot.forEach((gradeDoc) => {
          const gradeData = gradeDoc.data();
          let needsUpdate = false;

          // Check if there are grade entries created by this teacher
          if (gradeData.grades) {
            for (const subjectId in gradeData.grades) {
              // Check if this subject has teacher metadata
              if (
                gradeData.subjectTeachers &&
                gradeData.subjectTeachers[subjectId] === teacherId
              ) {
                // Remove or update the teacher reference for this subject
                if (gradeData.subjectTeachers) {
                  delete gradeData.subjectTeachers[subjectId];
                  needsUpdate = true;
                }
              }

              // Look for individual grades with teacher attribution
              for (const studentId in gradeData.grades[subjectId]) {
                const studentGrades = gradeData.grades[subjectId][studentId];
                if (Array.isArray(studentGrades)) {
                  // For grade arrays, check each grade item
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

      // 5. Clean up teacher's attendance records
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
          // Mark attendance records with former teacher label
          batch.update(doc.ref, {
            teacherId: "",
            teacherName: "Former Teacher",
          });
        });
      }

      // 6. Clean up subject-teacher associations
      const subjectsRef = collection(doc(db, "schools", schoolId), "subjects");
      const subjectsSnapshot = await getDocs(subjectsRef);

      if (!subjectsSnapshot.empty) {
        subjectsSnapshot.forEach((subjectDoc) => {
          const subjectData = subjectDoc.data();
          let needsUpdate = false;

          // Check if the teacher is assigned to this subject in teachers array (legacy support)
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

          // Check if the teacher is assigned to this subject in teacherSubjectPairs array
          if (
            subjectData.teacherSubjectPairs &&
            Array.isArray(subjectData.teacherSubjectPairs)
          ) {
            const updatedPairs = subjectData.teacherSubjectPairs.filter(
              (pair: any) => pair.teacherId !== teacherId
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

          // Check if the teacher is in teacherIds array
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

      // 7. Clean up timetable entries that include this teacher
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

      // 8. Clean up notifications sent by or mentioning the teacher
      const notificationsRef = collection(
        doc(db, "schools", schoolId),
        "notifications"
      );

      // First, clean up notifications where teacher is sender
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

      // Next, clean up notifications where teacher is recipient
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

      // 9. Check if teacher has any conversations in the messaging system
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
              // Mark the teacher participant as removed
              conversations[i].participants = conversations[
                i
              ].participants.filter((id: string) => id !== teacherId);
              updatedConversations = true;

              // If it was a 1-on-1 conversation, mark it accordingly
              if (conversations[i].participants.length === 1) {
                conversations[i].otherUserLeft = true;
              }
            }

            // Also check for any messages in the conversation from this teacher
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

      // Commit all the batch operations
      await batch.commit();
    }

    // If the user is a student, we need to clean up all references
    if (user.role === "student") {
      const studentId = user.userId;
      const batch = writeBatch(db);

      // 1. Remove student from their homeroom class
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

          // Update studentIds array
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

      // 2. Clean up student assignments and submissions
      const assignmentsRef = collection(
        doc(db, "schools", schoolId),
        "assignments"
      );
      const assignmentsSnapshot = await getDocs(assignmentsRef);

      if (!assignmentsSnapshot.empty) {
        assignmentsSnapshot.forEach((assignmentDoc) => {
          const assignmentData = assignmentDoc.data();

          // Check if the assignment has submissions from this student
          if (assignmentData.submissions) {
            const updatedSubmissions = assignmentData.submissions.filter(
              (submission: any) => submission.studentId !== studentId
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

      // 3. Clean up student quiz attempts
      const quizzesRef = collection(doc(db, "schools", schoolId), "quizzes");
      const quizzesSnapshot = await getDocs(quizzesRef);

      if (!quizzesSnapshot.empty) {
        quizzesSnapshot.forEach((quizDoc) => {
          const quizData = quizDoc.data();

          if (quizData.attempts) {
            const updatedAttempts = quizData.attempts.filter(
              (attempt: any) => attempt.studentId !== studentId
            );

            if (quizData.attempts.length !== updatedAttempts.length) {
              batch.update(quizDoc.ref, {
                attempts: updatedAttempts,
              });
            }
          }
        });
      }

      // 4. Clean up student attendance records
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

          // Remove student from studentIds array
          if (
            attendanceData.studentIds &&
            attendanceData.studentIds.includes(studentId)
          ) {
            attendanceData.studentIds = attendanceData.studentIds.filter(
              (id: string) => id !== studentId
            );
            needsUpdate = true;
          }

          // Remove student from attendance records
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

      // 5. Clean up grades
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

          // Remove student from studentIds array
          if (
            gradeData.studentIds &&
            gradeData.studentIds.includes(studentId)
          ) {
            gradeData.studentIds = gradeData.studentIds.filter(
              (id: string) => id !== studentId
            );
            needsUpdate = true;
          }

          // Remove student from grade records
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

      // 6. Check if student has any parent links and clean them up
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

      // 7. Check if student has any conversations in the messaging system
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
              // Mark the student participant as removed
              conversations[i].participants = conversations[
                i
              ].participants.filter((id: string) => id !== studentId);
              updatedConversations = true;

              // If it was a 1-on-1 conversation, mark it accordingly
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

      // Commit all the batch operations
      await batch.commit();
    }

    // If the user is a parent, we need to clean up all references
    if (user.role === "parent") {
      const parentId = user.userId;
      const batch = writeBatch(db);

      // 1. Clean up parent-child links in student documents
      if (user.childrenIds && user.childrenIds.length > 0) {
        const usersRef = collection(doc(db, "schools", schoolId), "users");

        for (const childId of user.childrenIds) {
          const childRef = doc(usersRef, childId);
          const childDoc = await getDoc(childRef);

          if (childDoc.exists()) {
            const childData = childDoc.data();

            // Remove parent from the child's parentIds array if it exists
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

      // 2. Clean up parent link requests
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

      // 3. Check if parent has any conversations in the messaging system
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
              // Mark the parent participant as removed
              conversations[i].participants = conversations[
                i
              ].participants.filter((id: string) => id !== parentId);
              updatedConversations = true;

              // If it was a 1-on-1 conversation, mark it accordingly
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

      // 4. Clean up notifications where the parent is the recipient
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

      // Commit all the batch operations
      await batch.commit();
    }

    // Finally delete the user document itself
    await deleteDoc(doc(db, "schools", schoolId, "users", user.userId));

    toast({
      title: "Success",
      description: "User deleted successfully",
    });

    return true;
  } catch (error) {
    console.error("Error deleting user:", error);
    toast({
      title: "Error",
      description: "Failed to delete user",
      variant: "destructive",
    });
    return false;
  }
};

/**
 * Downloads an Excel template for bulk user import
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
 * Helper function to process bulk import file
 * @param file The Excel file to process
 * @returns Object containing processed data and any errors
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
 * Creates or finds a class based on user data
 * @param schoolId The ID of the school
 * @param userData The user data containing class information
 * @param teacherId Optional teacher ID to associate with the class
 * @returns The ID of the created or found class
 */
export const getOrCreateClass = async (
  schoolId: string,
  userData: UserData,
  teacherId: string = ""
): Promise<string> => {
  if (!schoolId) return "";

  let className = "";

  // Determine the class name based on user data
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

  // Look for an existing class with this name
  const classesRef = collection(db, "schools", schoolId, "classes");
  const q = query(classesRef, where("className", "==", className));
  const snapshot = await getDocs(q);
  let classDocId = "";

  if (!snapshot.empty) {
    // Class exists, get its ID
    classDocId = snapshot.docs[0].id;

    // If a teacher ID is provided, update the class with this teacher as homeroom teacher
    if (teacherId && userData.role === "teacher" && userData.homeroomClassId) {
      const classData = snapshot.docs[0].data();
      const teacherSubjectPairs = classData.teacherSubjectPairs || [];

      await updateDoc(doc(classesRef, classDocId), {
        teacherSubjectPairs:
          teacherSubjectPairs.length > 0
            ? teacherSubjectPairs.map((p: any) =>
                p.isHomeroom ? { ...p, teacherId } : p
              )
            : [{ teacherId, subjectId: "", isHomeroom: true }],
        classTeacherId: teacherId,
      });
    }

    return classDocId;
  } else {
    // Class doesn't exist, create it
    const newClassRef = doc(classesRef);
    classDocId = newClassRef.id;

    const nameParts = className.match(/^(\d+)([A-Za-zА-Яа-я])$/);
    const isGraded = !!nameParts;

    const classData: any = {
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
 * Imports multiple users from processed data using the Firebase Admin SDK
 * @param schoolId The ID of the school to add users to
 * @param importData The processed user data to import
 * @returns Object containing success status and detailed account information
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
    // Call the server API to bulk import users with Firebase Admin SDK
    const response = await fetch("/api/users/bulk-import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schoolId,
        importData,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to import users");
    }

    const result = await response.json();

    // Standard toast notification for quick feedback
    toast({
      title: "Success",
      description: `Successfully imported ${result.results.success.length} out of ${result.results.total} users.`,
    });

    if (result.results.failed.length > 0) {
      console.warn("Some users failed to import:", result.results.failed);
      toast({
        title: "Warning",
        description: `${result.results.failed.length} users could not be imported.`,
        variant: "destructive",
      });
    }

    // Return detailed account information for the UserAccountFeedback component
    return {
      success: result.results.success.length > 0,
      successAccounts: result.results.success.map((account: any) => ({
        email: account.email,
        password: account.password,
        userId: account.userId,
        role:
          importData.find((user) => user.email === account.email)?.role ||
          "unknown",
      })),
      failedAccounts: result.results.failed,
    };
  } catch (error) {
    console.error("Error importing users:", error);
    toast({
      title: "Error",
      description: `Failed to import users: ${(error as Error).message}`,
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
 * Exports all users data to an Excel file
 * @param schoolId The ID of the school
 * @param users Optional array of user data to export
 * @param classes Optional array of classes for mapping class IDs to names
 * @returns void - triggers a file download
 */
export const exportUsersData = async (
  schoolId: string,
  users?: UserData[],
  classes?: any[]
) => {
  // First, fetch users and classes if they weren't provided
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
        title: "Error",
        description: "Failed to fetch users for export",
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
      title: "Error",
      description: "No users data available to export",
      variant: "destructive",
    });
    return;
  }

  try {
    // Get the CryptoJS library for decryption
    const CryptoJS = await import("crypto-js");
    const ENCRYPTION_SECRET = process.env.NEXT_PUBLIC_ENCRYPTION_SECRET || "";

    // Helper function to decrypt passwords
    const decryptPassword = (encryptedPassword: string): string => {
      try {
        if (!encryptedPassword) return "N/A";
        const bytes = CryptoJS.AES.decrypt(
          encryptedPassword,
          ENCRYPTION_SECRET
        );
        return bytes.toString(CryptoJS.enc.Utf8);
      } catch (error) {
        console.error("Error decrypting password:", error);
        return "Unable to decrypt";
      }
    };

    // Fetch passwords directly from each user document
    const passwordsMap: Record<string, string> = {};
    const usersRef = collection(doc(db, "schools", schoolId), "users");

    // Get all users' passwords
    const usersSnapshot = await getDocs(usersRef);
    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      // Check for both password and encryptedPassword fields
      if (userData.encryptedPassword) {
        try {
          passwordsMap[doc.id] = decryptPassword(userData.encryptedPassword);
        } catch (err) {
          console.error(`Error decrypting password for user ${doc.id}:`, err);
          passwordsMap[doc.id] = "Error: Unable to decrypt";
        }
      } else if (userData.password) {
        try {
          passwordsMap[doc.id] = decryptPassword(userData.password);
        } catch (err) {
          console.error(`Error decrypting password for user ${doc.id}:`, err);
          passwordsMap[doc.id] = "Error: Unable to decrypt";
        }
      }
    });

    // Create a header row for the Excel sheet
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

    // Transform user data into rows for Excel
    const rows = users.map((user) => {
      // Find class name if user has a homeroom class
      const className =
        user.homeroomClassId && classes
          ? classes.find((cls) => cls.classId === user.homeroomClassId)
              ?.className || "N/A"
          : "N/A";

      // Safely access the password using the user ID
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

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Set column widths for better readability
    const columnWidths = [
      { wch: 15 }, // First Name
      { wch: 15 }, // Last Name
      { wch: 30 }, // Email
      { wch: 15 }, // Password
      { wch: 10 }, // Role
      { wch: 15 }, // Homeroom Class
      { wch: 15 }, // Phone Number
      { wch: 10 }, // Gender
    ];
    ws["!cols"] = columnWidths;

    // Create workbook and append the worksheet
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");

    // Generate filename with current date
    const currentDate = new Date().toISOString().split("T")[0];
    const fileName = `users_export_${currentDate}.xlsx`;

    // Write the file and trigger download
    XLSX.writeFile(wb, fileName);

    toast({
      title: "Success",
      description: `Exported ${users.length} users to ${fileName}`,
    });
  } catch (error) {
    console.error("Error exporting users:", error);
    toast({
      title: "Error",
      description: "Failed to export users data",
      variant: "destructive",
    });
  }
};
