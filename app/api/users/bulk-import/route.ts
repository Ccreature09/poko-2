import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp, WriteBatch } from "firebase-admin/firestore";
import { transliterateBulgarianToLatin } from "@/lib/userManagement";
import CryptoJS from "crypto-js";
import { UserData, Role } from "@/lib/interfaces";

// Encryption secret key from environment variables
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET!;

export async function POST(request: NextRequest) {
  try {
    // Added more detailed logging
    console.log("Starting bulk import processing");

    // Initialize Firebase Admin before using it
    const app = await initAdmin();
    const adminAuth = getAuth(app);
    const adminDb = getFirestore(app);

    // Validate adminAuth and adminDb are properly initialized
    if (!adminAuth || !adminDb) {
      console.error("Firebase Admin SDK not properly initialized");
      return NextResponse.json(
        {
          error: "Server configuration error",
          details: "Firebase Admin SDK not properly initialized",
        },
        { status: 500 }
      );
    }

    const data = await request.json();
    const { schoolId, importData } = data;

    console.log(
      `Received import request for school: ${schoolId} with ${
        importData?.length || 0
      } users`
    );

    if (
      !schoolId ||
      !importData ||
      !Array.isArray(importData) ||
      importData.length === 0
    ) {
      return NextResponse.json(
        { error: "Missing or invalid import data" },
        { status: 400 }
      );
    }

    // Validate encryption secret is available
    if (!ENCRYPTION_SECRET) {
      console.error("Missing ENCRYPTION_SECRET environment variable");
      return NextResponse.json(
        {
          error: "Server configuration error",
          details: "Missing encryption configuration",
        },
        { status: 500 }
      );
    }

    const results = {
      success: [] as { email: string; password: string; userId: string }[],
      failed: [] as { email: string; error: string }[],
      total: importData.length,
    };

    // Break up the batch into smaller chunks to avoid Firestore limits
    // Firestore has a limit of 500 operations per batch
    const MAX_BATCH_SIZE = 400; // Keep it safely under the limit
    const batches: WriteBatch[] = [];
    let currentBatch = adminDb.batch();
    let operationCount = 0;

    const createdUserIds: Record<string, string> = {};
    const userClassMap: Record<string, string> = {};

    // Track classes and their data to create or update them after processing users
    const classesMap: Record<
      string,
      {
        className: string;
        studentIds: string[];
        teacherId?: string;
        isTeacherHomeroom?: boolean;
        educationLevel?: string;
        gradeNumber?: number;
        classLetter?: string;
        namingFormat?: string;
      }
    > = {};

    // Process each user in the import data
    for (const userData of importData) {
      try {
        // Generate password
        const password = generateSecurePassword();

        // Make sure we have valid required string values
        const firstName = userData.firstName || "";
        const lastName = userData.lastName || "";
        const role = userData.role || "student";
        const gender = userData.gender || "";
        const phoneNumber = userData.phoneNumber || "";

        // Skip users with missing required fields
        if (!firstName || !lastName) {
          results.failed.push({
            email: userData.email || "unknown",
            error: "Missing required fields (first name or last name)",
          });
          continue;
        }

        // Create an email if one doesn't exist
        const userEmail = userData.email || generateEmail(firstName, lastName);

        try {
          console.log(`Creating user: ${userEmail}`);

          // Create Firebase Auth user
          const userRecord = await adminAuth.createUser({
            email: userEmail,
            password: password,
            displayName: `${firstName} ${lastName}`,
            disabled: false,
          });

          const userId = userRecord.uid;
          console.log(`Successfully created auth user with ID: ${userId}`);

          // Encrypt the password before storing it
          const encryptedPassword = encryptPassword(password);

          // Prepare user data for Firestore - ensure all fields are defined
          const newUserData: UserData = {
            userId,
            firstName,
            lastName,
            // Use the email from userRecord which is guaranteed to be a string
            email: userRecord.email || userEmail, // Double protection
            phoneNumber,
            role: role as Role,
            gender,
            schoolId: schoolId,
            inbox: { conversations: [], unreadCount: 0 },
            encryptedPassword: encryptedPassword, // Store the encrypted password
          };

          // Determine the class ID for this user
          let classId = "";

          // Handle class association and role-specific fields
          if (role === "student") {
            // Add class-related fields based on naming format
            if (userData.classNamingFormat) {
              // Store the class naming format
              newUserData.classNamingFormat = userData.classNamingFormat;

              if (userData.classNamingFormat === "graded") {
                // For graded classes, add gradeNumber and classLetter
                if (userData.gradeNumber) {
                  newUserData.gradeNumber = userData.gradeNumber;
                }
                if (userData.classLetter) {
                  newUserData.classLetter = userData.classLetter;
                }

                // Create a formatted class name (e.g., "11A") from gradeNumber and classLetter
                if (userData.gradeNumber && userData.classLetter) {
                  classId = `${userData.gradeNumber}${userData.classLetter}`;
                  newUserData.homeroomClassId = classId;
                }
              } else if (userData.classNamingFormat === "custom") {
                // For custom classes, add customClassName
                if (userData.customClassName) {
                  newUserData.customClassName = userData.customClassName;
                  // For custom classes, the formatted name is the custom class name
                  classId = userData.customClassName;
                  newUserData.homeroomClassId = classId;
                }
              }
            }

            // Always add homeroom class if provided directly
            if (userData.homeroomClassId) {
              classId = userData.homeroomClassId;
              newUserData.homeroomClassId = classId;

              // If a direct homeroomClassId is provided and no formatted name yet,
              // use it as the formatted name too
              if (
                !newUserData.homeroomClassId &&
                typeof userData.homeroomClassId === "string" &&
                /^\d+[A-Za-zА-Яа-я]$/.test(userData.homeroomClassId)
              ) {
                newUserData.homeroomClassId = userData.homeroomClassId;
              }
            }

            // If we have a valid class ID, track this student for that class
            if (classId) {
              userClassMap[userId] = classId;

              // Initialize the class if it doesn't exist in our tracking map
              if (!classesMap[classId]) {
                classesMap[classId] = {
                  className: classId,
                  studentIds: [],
                  namingFormat: userData.classNamingFormat || "graded",
                };

                // Add grade info if available
                if (userData.gradeNumber) {
                  classesMap[classId].gradeNumber = userData.gradeNumber;

                  // Determine education level based on grade number
                  if (userData.gradeNumber <= 4) {
                    classesMap[classId].educationLevel = "primary";
                  } else if (userData.gradeNumber <= 7) {
                    classesMap[classId].educationLevel = "middle";
                  } else {
                    classesMap[classId].educationLevel = "high";
                  }
                }

                if (userData.classLetter) {
                  classesMap[classId].classLetter = userData.classLetter;
                }
              }

              // Add this student to the class's student list
              classesMap[classId].studentIds.push(userId);
            }
          } else if (role === "teacher") {
            // Add homeroomClassId if it exists
            if (userData.homeroomClassId) {
              classId = userData.homeroomClassId;
              newUserData.homeroomClassId = classId;

              // Track this teacher for class creation/update
              if (!classesMap[classId]) {
                classesMap[classId] = {
                  className: classId,
                  studentIds: [],
                  teacherId: userId,
                  isTeacherHomeroom: true,
                  namingFormat: "graded",
                };

                // Try to determine if this is a graded class from the name format
                const gradedClassMatch = classId.match(
                  /^(\d+)([A-Za-zА-Яа-я])$/
                );
                if (gradedClassMatch) {
                  classesMap[classId].gradeNumber = parseInt(
                    gradedClassMatch[1]
                  );
                  classesMap[classId].classLetter = gradedClassMatch[2];

                  // Determine education level based on grade number
                  const gradeNumber = parseInt(gradedClassMatch[1]);
                  if (gradeNumber <= 4) {
                    classesMap[classId].educationLevel = "primary";
                  } else if (gradeNumber <= 7) {
                    classesMap[classId].educationLevel = "middle";
                  } else {
                    classesMap[classId].educationLevel = "high";
                  }
                } else {
                  // If not a graded class format, assume it's custom
                  classesMap[classId].namingFormat = "custom";
                }
              } else {
                // If class already tracked, add this teacher as homeroom
                classesMap[classId].teacherId = userId;
                classesMap[classId].isTeacherHomeroom = true;
              }
            }
          }

          // Add to batch
          const userRef = adminDb
            .collection("schools")
            .doc(schoolId)
            .collection("users")
            .doc(userId);

          currentBatch.set(userRef, newUserData);
          operationCount++;

          // If we've reached the batch limit, create a new batch
          if (operationCount >= MAX_BATCH_SIZE) {
            batches.push(currentBatch);
            currentBatch = adminDb.batch();
            operationCount = 0;
            console.log(`Created new batch, total batches: ${batches.length}`);
          }

          // Track successful user creation
          results.success.push({
            email: userRecord.email || userEmail,
            password: password,
            userId: userId,
          });

          // Use the guaranteed string userEmail
          createdUserIds[userEmail] = userId;
        } catch (authError: unknown) {
          // Type guard to check if error has expected properties
          const errorWithCode = authError as {
            message?: string;
            code?: string;
          };
          console.error(
            `Firebase Auth error creating user ${userEmail}:`,
            authError
          );

          // Get more descriptive error message based on Firebase Auth error code
          let errorMessage =
            errorWithCode.message || "Unknown authentication error";
          if (errorWithCode.code === "auth/email-already-exists") {
            errorMessage = "Email address is already in use";
          } else if (errorWithCode.code === "auth/invalid-email") {
            errorMessage = "Invalid email format";
          } else if (errorWithCode.code === "auth/invalid-password") {
            errorMessage = "Invalid password format";
          }

          results.failed.push({
            email: userEmail,
            error: errorMessage,
          });
        }
      } catch (error: unknown) {
        // General error handling for other issues
        const typedError = error as { message?: string };
        console.error("Error processing user:", error);

        const firstName = userData.firstName || "";
        const lastName = userData.lastName || "";
        const errorEmail = userData.email || generateEmail(firstName, lastName);

        results.failed.push({
          email: errorEmail,
          error: typedError.message || "Unknown error",
        });
      }
    }

    try {
      // Now process all the classes we need to create or update
      for (const [classId, classData] of Object.entries(classesMap)) {
        // Check if the class already exists
        const classRef = adminDb
          .collection("schools")
          .doc(schoolId)
          .collection("classes")
          .doc(classId);

        const classDoc = await classRef.get();

        if (classDoc.exists) {
          // Class exists, update it
          const existingData = classDoc.data() || {};

          // Prepare updates - carefully merge new student IDs with existing ones
          const updates: {
            studentIds?: string[];
            teacherSubjectPairs?: Array<{
              teacherId: string;
              subjectId: string;
              isHomeroom: boolean;
            }>;
            classTeacherId?: string;
          } = {};

          // Only update student IDs if we have new ones
          if (classData.studentIds.length > 0) {
            // Get existing students and merge with new ones
            const existingStudentIds = existingData.studentIds || [];
            const allStudentIds = [
              ...new Set([...existingStudentIds, ...classData.studentIds]),
            ];
            updates.studentIds = allStudentIds;
          }

          // Handle teacher assignment - only if we have a teacher and it's a homeroom teacher
          if (classData.teacherId && classData.isTeacherHomeroom) {
            // Add the teacher to the teacher-subject pairs as a homeroom teacher
            const teacherSubjectPairs = existingData.teacherSubjectPairs || [];

            // Check if the teacher is already a homeroom teacher
            const existingHomeroomIndex = teacherSubjectPairs.findIndex(
              (pair: { isHomeroom?: boolean }) => pair.isHomeroom === true
            );

            if (existingHomeroomIndex >= 0) {
              // Update the existing homeroom teacher entry
              teacherSubjectPairs[existingHomeroomIndex].teacherId =
                classData.teacherId;
            } else {
              // Add a new entry with this teacher as homeroom
              teacherSubjectPairs.push({
                teacherId: classData.teacherId,
                subjectId: "", // Can be empty initially
                isHomeroom: true,
              });
            }

            updates.teacherSubjectPairs = teacherSubjectPairs;
            updates.classTeacherId = classData.teacherId;
          }

          // Apply updates if we have any
          if (Object.keys(updates).length > 0) {
            currentBatch.update(classRef, updates);
            operationCount++;

            // If we've reached the batch limit, create a new batch
            if (operationCount >= MAX_BATCH_SIZE) {
              batches.push(currentBatch);
              currentBatch = adminDb.batch();
              operationCount = 0;
              console.log(
                `Created new batch, total batches: ${batches.length}`
              );
            }
          }
        } else {
          // Class doesn't exist, create it
          const newClassData: {
            className: string;
            studentIds: string[];
            namingFormat: string;
            createdAt: Timestamp;
            teacherSubjectPairs: Array<{
              teacherId: string;
              subjectId: string;
              isHomeroom: boolean;
            }>;
            educationLevel?: string;
            gradeNumber?: number;
            classLetter?: string;
            classTeacherId?: string;
          } = {
            className: classData.className,
            studentIds: classData.studentIds,
            namingFormat: classData.namingFormat || "graded",
            createdAt: Timestamp.now(),
            teacherSubjectPairs: [],
          };

          // Add education level if available
          if (classData.educationLevel) {
            newClassData.educationLevel = classData.educationLevel;
          }

          // Add grade information if available
          if (classData.gradeNumber) {
            newClassData.gradeNumber = classData.gradeNumber;
          }

          if (classData.classLetter) {
            newClassData.classLetter = classData.classLetter;
          }

          // Add teacher information if available
          if (classData.teacherId) {
            newClassData.classTeacherId = classData.teacherId;

            // Add teacher to teacherSubjectPairs
            newClassData.teacherSubjectPairs.push({
              teacherId: classData.teacherId,
              subjectId: "", // Can be empty initially
              isHomeroom: true,
            });
          }

          currentBatch.set(classRef, newClassData);
          operationCount++;

          // If we've reached the batch limit, create a new batch
          if (operationCount >= MAX_BATCH_SIZE) {
            batches.push(currentBatch);
            currentBatch = adminDb.batch();
            operationCount = 0;
            console.log(`Created new batch, total batches: ${batches.length}`);
          }
        }
      }

      // Add the last batch if it has operations
      if (operationCount > 0) {
        batches.push(currentBatch);
      }

      console.log(
        `Committing ${batches.length} batches with ${
          results.success.length
        } users and ${Object.keys(classesMap).length} classes`
      );

      // Commit all batches
      if (batches.length > 0) {
        // Commit batches sequentially to avoid overwhelming Firestore
        for (let i = 0; i < batches.length; i++) {
          console.log(`Committing batch ${i + 1} of ${batches.length}`);
          await batches[i].commit();
        }
      }

      return NextResponse.json({
        success: true,
        results,
        message: `Successfully created ${results.success.length} out of ${
          results.total
        } users and processed ${Object.keys(classesMap).length} classes`,
      });
    } catch (batchError: unknown) {
      const typedBatchError = batchError as { message?: string };
      console.error("Error committing batch:", batchError);

      // Even if batch fails, we succeeded in creating Firebase Auth accounts
      return NextResponse.json({
        success: false,
        results,
        message: `Created ${results.success.length} Firebase Auth accounts, but failed to store user data`,
        error: typedBatchError.message || "Unknown batch error",
      });
    }
  } catch (error: unknown) {
    // Type the error
    const typedError = error as { message?: string; stack?: string };
    console.error("Error in bulk user import:", error);
    return NextResponse.json(
      {
        error: "Failed to process bulk import",
        details: typedError.message || "Unknown error",
        stack:
          process.env.NODE_ENV === "development" ? typedError.stack : undefined,
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
  try {
    return CryptoJS.AES.encrypt(password, ENCRYPTION_SECRET).toString();
  } catch (error) {
    console.error("Error encrypting password:", error);
    // Return a fallback encrypted value or throw an error
    throw new Error("Failed to encrypt password");
  }
}

// Helper function to generate an email from first and last name
function generateEmail(firstName: string, lastName: string): string {
  // Transliterate Cyrillic characters to Latin for email generation
  const firstInitial = transliterateBulgarianToLatin(
    firstName.toLowerCase()
  ).charAt(0);
  const lastInitial = transliterateBulgarianToLatin(
    lastName.toLowerCase()
  ).charAt(0);
  const randomNumbers = Math.floor(10000 + Math.random() * 90000);

  return `${firstInitial}${lastInitial}${randomNumbers}@poko.com`;
}
