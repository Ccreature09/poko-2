import { NextRequest, NextResponse } from "next/server";
import CryptoJS from "crypto-js";
import { initAdmin } from "@/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

// Server-side encryption secret (not available to client)
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET!;

export async function GET(request: NextRequest) {
  try {
    // Get schoolId from query params
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId");

    if (!schoolId) {
      return NextResponse.json({ error: "Missing school ID" }, { status: 400 });
    }

    // Initialize Firebase Admin
    const app = await initAdmin();
    const adminDb = getFirestore(app);

    // Fetch all users with encrypted passwords from the school
    const usersRef = adminDb
      .collection("schools")
      .doc(schoolId)
      .collection("users");
    const usersSnapshot = await usersRef.get();

    const passwordsMap: Record<string, string> = {};

    // Decrypt each user's password and add it to the map
    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      const userId = doc.id;

      try {
        if (userData.encryptedPassword) {
          const bytes = CryptoJS.AES.decrypt(
            userData.encryptedPassword,
            ENCRYPTION_SECRET
          );
          const decryptedPassword = bytes.toString(CryptoJS.enc.Utf8);

          if (decryptedPassword) {
            passwordsMap[userId] = decryptedPassword;
          } else {
            passwordsMap[userId] = "Unable to decrypt";
          }
        } else {
          passwordsMap[userId] = "No password stored";
        }
      } catch (error) {
        console.error(`Error decrypting password for user ${userId}:`, error);
        passwordsMap[userId] = "Error: Unable to decrypt";
      }
    });

    return NextResponse.json(passwordsMap);
  } catch (error: unknown) {
    const typedError = error as { message?: string };
    console.error("Error fetching decrypted passwords:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch passwords",
        details: typedError.message || "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
