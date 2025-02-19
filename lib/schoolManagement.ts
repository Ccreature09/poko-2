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
} from "firebase/firestore";
import type { UserBase, Teacher, Student } from "@/lib/interfaces";

export const createSchool = async (
  schoolName: string,
  adminEmail: string,
  password: string
) => {
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    adminEmail,
    password
  );
  const user = userCredential.user;
  await sendEmailVerification(user);

  const schoolRef = doc(collection(db, "schools"));
  const schoolId = schoolRef.id;

  return { user, schoolId };
};

export const storeSchoolData = async (
  schoolId: string,
  schoolName: string,
  adminId: string
) => {
  await setDoc(doc(db, "schools", schoolId), {
    name: schoolName,
    adminIds: [adminId],
    createdAt: new Date(),
  });

  await setDoc(doc(db, "schools", schoolId, "users", adminId), {
    userId: adminId,
    email: auth.currentUser!.email,
    role: "admin",
    firstName: "",
    lastName: "",
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
  const userQuery = query(
    collection(db, "schools", schoolId, "users"),
    where("email", "==", email)
  );
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

export const bulkCreateUsers = async (
  users: BulkUserData[],
  schoolId: string,
  schoolName: string
) => {
  const batch = writeBatch(db);
  const createdUsers: { email: string; password: string; role: string }[] = [];
  console.log(schoolName);
  for (const user of users) {
    const email = generateEmail(user.firstName, user.lastName, schoolName);
    const password = generatePassword();

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const userId = userCredential.user.uid;

      const userRef = doc(collection(db, "schools", schoolId, "users"), userId);
      const userData: UserBase = {
        userId,
        email,
        password,
        schoolId: schoolId,
        inbox: { conversations: [] },
        homeroomClassId: user.homeroomClassId ?? "",
        gender: user.gender,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phoneNumber: user.phoneNumber,
      };

      if (user.role === "student") {
        (userData as Student).homeroomClassId = user.homeroomClassId ?? "";
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
  return createdUsers;
};

const generateEmail = (
  firstName: string,
  lastName: string,
  schoolName: string
) => {
  const firstInitial = firstName.charAt(0).toLowerCase();
  const lastInitial = lastName.charAt(0).toLowerCase();
  const randomNumbers = Math.floor(10000 + Math.random() * 90000).toString();
  return `${firstInitial}${lastInitial}${randomNumbers}@${schoolName.toLowerCase()}.com`;
};

const generatePassword = () => {
  const length = 12;
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

export const exportLoginCredentials = (
  users: { email: string; password: string; role: string }[]
): string => {
  return users
    .map(
      (user) =>
        `Email: ${user.email}, Password: ${user.password}, Role: ${user.role}`
    )
    .join("\n");
};

export const sendInvitationEmails = async (
  emails: string[],
  schoolId: string
) => {
  // In a real-world scenario, you would integrate with an email service here
  // For this example, we'll just log the emails
  console.log(
    `Sending invitation emails to ${emails.join(", ")} for school ${schoolId}`
  );
};

export const getAllUsers = async (schoolId: string) => {
  const usersSnapshot = await getDocs(
    collection(db, "schools", schoolId, "users")
  );
  return usersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const getClassById = async (schoolId: string, classId: string) => {
  const classDoc = await getDoc(
    doc(db, "schools", schoolId, "classes", classId)
  );
  if (classDoc.exists()) {
    return { id: classDoc.id, ...classDoc.data() };
  }
  return null;
};

export const getSubjectById = async (schoolId: string, subjectId: string) => {
  const subjectDoc = await getDoc(
    doc(db, "schools", schoolId, "subjects", subjectId)
  );
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

export const loginUser = async (
  email: string,
  password: string,
  schoolId: string
) => {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    // Fetch the user document to confirm the school ID
    const userDoc = await getDoc(
      doc(db, "schools", schoolId, "users", user.uid)
    );
    if (!userDoc.exists()) {
      throw new Error("User not found in the selected school");
    }

    const userData = userDoc.data();
    return { ...userData, id: user.uid };
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
};
