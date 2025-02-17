import { auth, db } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
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
import { BulkUserData } from "./interfaces";
import * as XLSX from "xlsx";

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
    adminId: adminId,
    createdAt: new Date(),
  });

  await setDoc(doc(db, "schools", schoolId, "users", adminId), {
    email: auth.currentUser!.email,
    role: "admin",
    displayName: auth.currentUser!.displayName || "",
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

const generatePassword = () => {
  const length = 6;
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

const generateEmail = (
  firstName: string,
  lastName: string,
  schoolName: string
) => {
  const initials = `${firstName[0]}${lastName[0]}`.toLowerCase();
  const randomNumbers = Math.floor(10000 + Math.random() * 90000).toString();
  return `${initials}${randomNumbers}@${schoolName}.com`;
};

export const bulkCreateUsers = async (
  users: BulkUserData[],
  schoolId: string,
  schoolName: string
) => {
  const batch = writeBatch(db);
  const createdUsers: { email: string; password: string; role: string }[] = [];

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
      const userData: BulkUserData & {
        userId: string;
        email: string;
        schoolName: string;
      } = {
        ...user,
        userId,
        email,
        schoolName, // Add this line
      };

      batch.set(userRef, userData);
      createdUsers.push({ email, password, role: user.role });

      // Save email and password under the school document
      const schoolRef = doc(db, "schools", schoolId);
      await setDoc(
        schoolRef,
        {
          createdUsers: createdUsers,
        },
        { merge: true }
      );
    } catch (error) {
      console.error(`Failed to create user ${email}:`, error);
    }
  }

  await batch.commit();
  return createdUsers;
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

export const exportAllUserCredentials = async (schoolId: string) => {
  const schoolRef = doc(db, "schools", schoolId);
  const schoolDoc = await getDoc(schoolRef);

  if (!schoolDoc.exists()) {
    throw new Error("School not found");
  }

  const schoolData = schoolDoc.data();
  const createdUsers = schoolData?.createdUsers || [];

  const worksheet = XLSX.utils.json_to_sheet(createdUsers);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "User Credentials");

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "user_credentials.xlsx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
