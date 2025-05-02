import { auth, db } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  doc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  getDoc,
  deleteDoc,
} from "firebase/firestore";
import { arrayUnion } from "firebase/firestore"; // Added increment
import type { UserBase, Teacher, Student, Parent } from "@/lib/interfaces"; // Added Parent
import { getAuth, deleteUser as firebaseDeleteUser } from "firebase/auth";
import { HomeroomClass } from "@/lib/interfaces";

async function createOrGetHomeroomClass(schoolId: string, homeroomClassId: string) {
  const classRef = doc(db, "schools", schoolId, "classes", homeroomClassId);
  const classDoc = await getDoc(classRef);
  if (!classDoc.exists()) {
    await setDoc(classRef, {
      className: homeroomClassId,
      students: [],
      teacherId: "",
    });
  }
  return classRef;
}

export const createSchool = async (schoolName: string, adminEmail: string, password: string) => {
  const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, password);
  const user = userCredential.user;
  await sendEmailVerification(user);

  const schoolRef = doc(collection(db, "schools"));
  const schoolId = schoolRef.id;

  return { user, schoolId };
};

export const storeSchoolData = async (schoolId: string, schoolName: string, adminId: string, firstName: string, lastName: string) => {
  await setDoc(doc(db, "schools", schoolId), {
    name: schoolName,
    adminIds: [adminId],
    createdAt: new Date(),
  });

  await setDoc(doc(db, "schools", schoolId, "users", adminId), {
    userId: adminId,
    email: auth.currentUser!.email,
    role: "admin",
    firstName: firstName,
    lastName: lastName,
    phoneNumber: "",
    schoolId: schoolId,
  });
};

export const getSchools = async () => {
  const schoolsSnapshot = await getDocs(collection(db, "schools"));
  return schoolsSnapshot.docs.map((doc) => ({
    id: doc.id,
    name: doc.data().name,
  }));
};

export const validateUser = async (email: string, schoolId: string) => {
  if (!email || !schoolId) {
    console.error("Email or schoolId is undefined");
    return false;
  }
  const userQuery = query(collection(db, "schools", schoolId, "users"), where("email", "==", email));
  const userSnapshot = await getDocs(userQuery);
  return !userSnapshot.empty;
};

export interface BulkUserData {
  firstName: string;
  lastName: string;
  gender: "male" | "female";
  role: "student" | "teacher" | "admin";
  phoneNumber: string;
  homeroomClassId?: string;
}

export const bulkCreateUsers = async (users: BulkUserData[], schoolId: string, schoolName: string) => {
  const batch = writeBatch(db);
  const createdUsers: { email: string; password: string; role: string }[] = [];

  for (const user of users) {
    const email = generateEmail(user.firstName, user.lastName, schoolName);
    const password = generatePassword();

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const userId = userCredential.user.uid;

      const userRef = doc(collection(db, "schools", schoolId, "users"), userId);
      const userData: UserBase = {
        userId,
        email,
        password,
        schoolId: schoolId,
        inbox: { conversations: [], unreadCount: 0 },
        homeroomClassId: user.homeroomClassId ?? "",
        gender: user.gender,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phoneNumber: user.phoneNumber,
      };

      if (user.homeroomClassId) {
        await createOrGetHomeroomClass(schoolId, user.homeroomClassId);
      }

      if (user.role === "student" && user.homeroomClassId) {
        const homeroomClassRef = await createOrGetHomeroomClass(schoolId, user.homeroomClassId);
        batch.update(homeroomClassRef, {
          students: arrayUnion(userId),
        });
        (userData as Student).homeroomClassId = user.homeroomClassId;
        (userData as Student).enrolledSubjects = [];
      } else if (user.role === "teacher") {
        (userData as Teacher).teachesClasses = [];
      }

      batch.set(userRef, userData);
      createdUsers.push({ email, password, role: user.role });
    } catch (error) {
      console.error(`Failed to create user ${email}:`, error);
    }
  }

  await batch.commit();

  const adminEmail = auth.currentUser?.email;
  const adminPassword = prompt("Please enter your password to re-authenticate:");
  if (adminEmail && adminPassword) {
    await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
  }

  return createdUsers;
};

/**
 * Create a single parent user account (admin action).
 */
export const createParentUser = async (
  schoolId: string,
  parentData: Omit<Parent, 'userId' | 'role' | 'childrenIds' | 'inbox' | 'password'>, // Exclude fields set automatically or managed elsewhere
  initialPassword?: string // Optional initial password
): Promise<{ userId: string; email: string; passwordGenerated: string }> => {
  const schoolDataDoc = await getDoc(doc(db, "schools", schoolId));
  if (!schoolDataDoc.exists()) {
    throw new Error(`School with ID ${schoolId} not found.`);
  }
  const schoolName = schoolDataDoc.data()?.name || "school"; // Use school name for email generation

  const email = generateEmail(parentData.firstName, parentData.lastName, schoolName);
  const password = initialPassword || generatePassword(); // Use provided or generate new

  try {
    // 1. Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const userId = userCredential.user.uid;
    // Consider sending email verification if needed: await sendEmailVerification(userCredential.user);

    // 2. Create Firestore user document
    const userRef = doc(db, "schools", schoolId, "users", userId);
    const newParentData: Parent = {
      ...parentData,
      userId,
      email,
      password, // Store generated/provided password (consider security implications/hashing if needed elsewhere)
      schoolId,
      role: "parent",
      childrenIds: [], // Initialize with empty array, linking happens separately
      inbox: { conversations: [], unreadCount: 0 }, // Initialize inbox
    };

    await setDoc(userRef, newParentData);

    console.log(`Parent user created: ${email} (ID: ${userId})`);
    return { userId, email, passwordGenerated: password };

  } catch (error: unknown) {
    console.error(`Failed to create parent user ${email}:`, error);
    if (error instanceof Error && 'code' in error && error.code === 'auth/email-already-in-use') {
      throw new Error(`Email ${email} is already in use.`);
    }
    throw new Error(`Failed to create parent user: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const generateEmail = (firstName: string, lastName: string, schoolName: string) => {
  const firstInitial = firstName.charAt(0).toLowerCase();
  const lastInitial = lastName.charAt(0).toLowerCase();
  const randomNumbers = Math.floor(10000 + Math.random() * 90000).toString();
  return `${firstInitial}${lastInitial}${randomNumbers}@${schoolName.toLowerCase()}.com`;
};

const generatePassword = () => {
  const length = 12;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

export const exportLoginCredentials = (users: { email: string; password: string; role: string }[]): string => {
  return users.map((user) => `Email: ${user.email}, Password: ${user.password}, Role: ${user.role}`).join("\n");
};

export const sendInvitationEmails = async (emails: string[], schoolId: string) => {
  console.log(`Sending invitation emails to ${emails.join(", ")} for school ${schoolId}`);
};

export const getAllUsers = async (schoolId: string) => {
  const usersSnapshot = await getDocs(collection(db, "schools", schoolId, "users"));
  return usersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const getClassById = async (schoolId: string, classId: string) => {
  const classDoc = await getDoc(doc(db, "schools", schoolId, "classes", classId));
  if (classDoc.exists()) {
    return { id: classDoc.id, ...classDoc.data() };
  }
  return null;
};

export const getSubjectById = async (schoolId: string, subjectId: string) => {
  const subjectDoc = await getDoc(doc(db, "schools", schoolId, "subjects", subjectId));
  if (subjectDoc.exists()) {
    return { id: subjectDoc.id, ...subjectDoc.data() };
  }
  return null;
};

export const getUserById = async (schoolId: string, userId: string) => {
  const userDoc = await getDoc(doc(db, "schools", schoolId, "users", userId));
  if (userDoc.exists()) {
    return { id: userDoc.id, ...userDoc.data() };
  }
  return null;
};

export const loginUser = async (email: string, password: string, selectedSchool: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    // Instead of redirecting, fetch and return the user data
    const userDoc = await getDoc(doc(db, "schools", selectedSchool, "users", userCredential.user.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return {
        success: true,
        user: userCredential.user,
        userData: userData,
        redirectPath: `/${userData.role}/dashboard/${selectedSchool}`
      };
    } else {
      return {
        success: true,
        user: userCredential.user,
        redirectPath: `/dashboard/${selectedSchool}`
      };
    }
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
};

export const deleteUser = async (schoolId: string, userId: string): Promise<void> => {
  const userRef = doc(db, "schools", schoolId, "users", userId);
  const inboxRef = collection(userRef, "inbox");
  const userInboxDocs = await getDocs(inboxRef);

  // Delete all inbox documents
  for (const inboxDoc of userInboxDocs.docs) {
    await deleteDoc(inboxDoc.ref);
  }

  // Delete the user document
  await deleteDoc(userRef);
};

export const deleteUserAccount = async (userId: string) => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (user && user.uid === userId) {
    await firebaseDeleteUser(user);
  } else {
    throw new Error("User not authenticated or user ID does not match");
  }
};

export const getAllClasses = async (schoolId: string): Promise<HomeroomClass[]> => {
  const classesSnapshot = await getDocs(collection(db, "schools", schoolId, "classes"));
  return classesSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      classId: doc.id,
      className: data.className,
      namingFormat: data.namingFormat || "graded", // Default to "graded" if not specified
      yearGroup: data.yearGroup,
      gradeNumber: data.gradeNumber,
      classLetter: data.classLetter,
      customName: data.customName,
      classTeacherId: data.classTeacherId,
      studentIds: data.studentIds || data.students || [],
      teacherIds: data.teacherIds || []
    } as HomeroomClass;
  });
};


/**
 * Get all students in a specific class
 * @param schoolId The school ID
 * @param classId The class ID
 * @returns Array of student objects
 */
export async function getStudentsInClass(
  schoolId: string,
  classId: string
): Promise<Student[]> {
  const schoolRef = doc(db, 'schools', schoolId);
  const classRef = doc(schoolRef, 'classes', classId);
  const classDoc = await getDoc(classRef);
  
  if (!classDoc.exists()) {
    throw new Error('Class not found');
  }
  
  const classData = classDoc.data();
  
  // Field name might be "students" OR "studentIds" depending on schema
  // Check both fields to ensure we get the data
  const studentIds = classData.students || classData.studentIds || [];
  
  console.log(`ClassId: ${classId}, Class data:`, classData);
  console.log(`Found ${studentIds.length} student IDs in class document`);
  
  if (studentIds.length === 0) {
    console.warn(`No students found in class document for classId: ${classId}`);
    return [];
  }
  
  const usersRef = collection(schoolRef, 'users');
  const students: Student[] = [];
  
  // Process studentIds in batches because Firestore has a limit of 10 items for 'in' queries
  const batchSize = 10;
  const queryPromises: Promise<any>[] = [];
  
  for (let i = 0; i < studentIds.length; i += batchSize) {
    const batch = studentIds.slice(i, i + batchSize);
    const batchQuery = query(
      usersRef,
      where('role', '==', 'student'),
      where('userId', 'in', batch)
    );
    queryPromises.push(getDocs(batchQuery));
  }
  
  // Execute all batch queries
  const batchResults = await Promise.all(queryPromises);
  
  // Process results
  batchResults.forEach(snapshot => {
    snapshot.forEach(doc => {
      const data = doc.data() as Student;
      students.push({
        ...data,
        userId: doc.id
      });
    });
  });
  
  // If no students found through userId, try a secondary approach with document IDs
  if (students.length === 0) {
    console.log(`Trying secondary approach by document IDs for class ${classId}`);
    
    const idPromises: Promise<any>[] = [];
    for (let i = 0; i < studentIds.length; i += batchSize) {
      const idQuery = query(
        usersRef,
        where('role', '==', 'student')
      );
      idPromises.push(getDocs(idQuery));
    }
    
    const idResults = await Promise.all(idPromises);
    
    idResults.forEach(snapshot => {
      snapshot.forEach(doc => {
        // Only include users whose ID is in the studentIds array
        if (studentIds.includes(doc.id)) {
          const data = doc.data() as Student;
          students.push({
            ...data,
            userId: doc.id
          });
        }
      });
    });
  }
  
  console.log(`Found ${students.length} students for class ${classId}`);
  return students;
}
