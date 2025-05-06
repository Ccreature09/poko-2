import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { transliterateBulgarianToLatin } from "@/lib/userManagement";
import * as CryptoJS from "crypto-js";
import { UserData, Role } from "@/lib/interfaces";

// Encryption secret key from environment variables
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { schoolId, userData } = data;

    if (!schoolId || !userData) {
      return NextResponse.json(
        { error: "Missing required data" },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!userData.firstName || !userData.lastName || !userData.role) {
      return NextResponse.json(
        { error: "Missing required user fields" },
        { status: 400 }
      );
    }

    // Initialize Firebase Admin before using it
    const app = await initAdmin();
    const adminAuth = getAuth(app);
    const adminDb = getFirestore(app);

    // Generate a password if none provided
    const password = userData.password || generateSecurePassword();

    // Generate an email if none provided, using transliteration for Cyrillic characters
    let email = userData.email;
    if (!email) {
      const firstInitial = transliterateBulgarianToLatin(
        userData.firstName.toLowerCase()
      ).charAt(0);
      const lastInitial = transliterateBulgarianToLatin(
        userData.lastName.toLowerCase()
      ).charAt(0);
      const randomNumbers = Math.floor(10000 + Math.random() * 90000);
      email = `${firstInitial}${lastInitial}${randomNumbers}@poko.com`;
    }

    try {
      // Create the user in Firebase Authentication
      const userRecord = await adminAuth.createUser({
        email: email,
        password: password,
        displayName: `${userData.firstName} ${userData.lastName}`,
        disabled: false,
      });

      // Store additional user data in Firestore
      const usersRef = adminDb
        .collection("schools")
        .doc(schoolId)
        .collection("users");

      // Encrypt the password before storing it
      const encryptedPassword = encryptPassword(password);

      // Handle homeroom class ID for better consistency across different inputs
      let standardizedHomeroomClassId = userData.homeroomClassId;

      // Add formatted class name for easy display
      if (userData.gradeNumber && userData.classLetter) {
        // For graded classes, combine grade number and class letter
        standardizedHomeroomClassId = `${userData.gradeNumber}${userData.classLetter}`;
      } else if (userData.customClassName) {
        // For custom classes, use the custom class name
        standardizedHomeroomClassId = userData.customClassName;
      } else if (
        userData.homeroomClassId &&
        typeof userData.homeroomClassId === "string" &&
        /^\d+[A-Za-zА-Яа-я]$/.test(userData.homeroomClassId)
      ) {
        // If homeroom class ID follows the format like "11A", use it directly
        standardizedHomeroomClassId = userData.homeroomClassId;
      }

      const newUserData: UserData = {
        userId: userRecord.uid,
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userRecord.email || email, // Use Firebase Auth email or our generated one
        phoneNumber: userData.phoneNumber || "",
        role: userData.role as Role,
        gender: userData.gender || "",
        schoolId: schoolId,
        inbox: { conversations: [], unreadCount: 0 },
        encryptedPassword: encryptedPassword, // Store the encrypted password
      };

      // Add role-specific fields and class-related fields
      if (userData.role === "student") {
        if (standardizedHomeroomClassId) {
          newUserData.homeroomClassId = standardizedHomeroomClassId;
        }

        // Add class-related fields if they exist
        if (userData.classLetter) {
          newUserData.classLetter = userData.classLetter;
        }

        if (userData.gradeNumber) {
          newUserData.gradeNumber = userData.gradeNumber;
        }

        if (userData.customClassName) {
          newUserData.customClassName = userData.customClassName;
        }

        if (userData.classNamingFormat) {
          newUserData.classNamingFormat = userData.classNamingFormat;
        }
      } else if (userData.role === "teacher") {
        // Initialize teachesClasses array if not present
        newUserData.teachesClasses = [];

        // Add homeroomClassId if it exists
        if (standardizedHomeroomClassId) {
          newUserData.homeroomClassId = standardizedHomeroomClassId;

          // If not already in teachesClasses, add it
          if (
            !newUserData.teachesClasses.includes(standardizedHomeroomClassId)
          ) {
            newUserData.teachesClasses.push(standardizedHomeroomClassId);
          }
        }
      }

      // Add the user to Firestore
      await adminDb
        .collection("schools")
        .doc(schoolId)
        .collection("users")
        .doc(userRecord.uid)
        .set(newUserData);

      // Update the class document if this is a teacher with a homeroom class
      if (userData.role === "teacher" && standardizedHomeroomClassId) {
        try {
          // Find the class by className
          const classesSnapshot = await adminDb
            .collection("schools")
            .doc(schoolId)
            .collection("classes")
            .where("className", "==", standardizedHomeroomClassId)
            .get();

          if (!classesSnapshot.empty) {
            // Class exists, update it
            const classDoc = classesSnapshot.docs[0];
            const classData = classDoc.data();

            // Set this teacher as the homeroom teacher
            const teacherSubjectPairs = classData.teacherSubjectPairs || [];
            const isAlreadyHomeroom = teacherSubjectPairs.some(
              (pair: any) =>
                pair.isHomeroom && pair.teacherId === userRecord.uid
            );

            if (!isAlreadyHomeroom) {
              // Add this teacher as homeroom teacher
              const batch = adminDb.batch();

              // Update classTeacherId field
              batch.update(classDoc.ref, {
                classTeacherId: userRecord.uid,
              });

              // Add or update teacher in teacherSubjectPairs
              const existingPairIndex = teacherSubjectPairs.findIndex(
                (pair: any) => pair.teacherId === userRecord.uid
              );

              if (existingPairIndex !== -1) {
                // Update existing pair
                teacherSubjectPairs[existingPairIndex].isHomeroom = true;
                batch.update(classDoc.ref, {
                  teacherSubjectPairs: teacherSubjectPairs,
                });
              } else {
                // Add new pair
                batch.update(classDoc.ref, {
                  teacherSubjectPairs: [
                    ...teacherSubjectPairs,
                    {
                      teacherId: userRecord.uid,
                      subjectId: "",
                      isHomeroom: true,
                    },
                  ],
                });
              }

              // Commit the batch
              await batch.commit();
            }
          } else {
            // Class doesn't exist, create it
            // Define the type for the class data to fix TypeScript errors
            interface ClassData {
              className: string;
              namingFormat: string;
              classTeacherId: string;
              teacherSubjectPairs: {
                teacherId: string;
                subjectId: string;
                isHomeroom: boolean;
              }[];
              studentIds: string[];
              createdAt: string;
              gradeNumber?: number;
              classLetter?: string;
              educationLevel?: string;
              customName?: string;
            }

            // Create new class with the teacher assigned
            const newClassData: ClassData = {
              className: standardizedHomeroomClassId,
              namingFormat: /^\d+[A-Za-zА-Яа-я]$/.test(
                standardizedHomeroomClassId
              )
                ? "graded"
                : "custom",
              classTeacherId: userRecord.uid,
              teacherSubjectPairs: [
                { teacherId: userRecord.uid, subjectId: "", isHomeroom: true },
              ],
              studentIds: [],
              createdAt: new Date().toISOString(),
            };

            // Add additional fields for graded classes
            if (/^\d+[A-Za-zА-Яа-я]$/.test(standardizedHomeroomClassId)) {
              const match = standardizedHomeroomClassId.match(
                /^(\d+)([A-Za-zА-Яа-я])$/
              );
              if (match) {
                const gradeNumber = parseInt(match[1]);
                const classLetter = match[2];

                newClassData.gradeNumber = gradeNumber;
                newClassData.classLetter = classLetter;
                newClassData.educationLevel =
                  gradeNumber <= 4
                    ? "primary"
                    : gradeNumber <= 7
                    ? "middle"
                    : "high";
              }
            } else if (userData.customClassName) {
              newClassData.customName = userData.customClassName;
              newClassData.educationLevel = "primary";
            }

            // Create the class
            await adminDb
              .collection("schools")
              .doc(schoolId)
              .collection("classes")
              .add(newClassData);
          }
        } catch (classUpdateError) {
          console.error("Error updating homeroom class:", classUpdateError);
          // Continue with the user creation despite class update error
        }
      }

      return NextResponse.json({
        success: true,
        userId: userRecord.uid,
        message: "User created successfully",
        accountDetails: {
          email: userRecord.email || email,
          password: password,
          role: userData.role,
        },
      });
    } catch (authError: any) {
      console.error("Firebase Auth error creating user:", authError);

      // Return specific error messages for common Firebase Auth errors
      if (authError.code === "auth/email-already-exists") {
        return NextResponse.json(
          {
            error: "Email already in use",
            details: "A user with this email address already exists.",
          },
          { status: 409 }
        );
      } else if (authError.code === "auth/invalid-email") {
        return NextResponse.json(
          {
            error: "Invalid email format",
            details: "The email address is not properly formatted.",
          },
          { status: 400 }
        );
      } else if (authError.code === "auth/invalid-password") {
        return NextResponse.json(
          {
            error: "Invalid password",
            details: "The password must be at least 6 characters long.",
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error: "Failed to create user authentication account",
          details: authError.message || "Unknown authentication error",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      {
        error: "Failed to create user",
        details: error.message || "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

// Helper function to generate a secure random password
function generateSecurePassword(length = 12) {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+";
  let password = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  return password;
}

// Helper function to encrypt a password using AES encryption
function encryptPassword(password: string): string {
  return CryptoJS.AES.encrypt(password, ENCRYPTION_SECRET).toString();
}

// Helper function to decrypt a password (useful if you need to retrieve it later)
function decryptPassword(encryptedPassword: string): string {
  const bytes = CryptoJS.AES.decrypt(encryptedPassword, ENCRYPTION_SECRET);
  return bytes.toString(CryptoJS.enc.Utf8);
}
