import { NextRequest, NextResponse } from "next/server";
import * as CryptoJS from "crypto-js";
import { initAdmin } from "@/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

// Server-side encryption secret (not available to client)
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { userId, schoolId, password } = data;

    if (!userId || !schoolId || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Initialize Firebase Admin
    const app = await initAdmin();
    const adminDb = getFirestore(app);

    // Encrypt the password using server-side encryption key
    const encryptedPassword = CryptoJS.AES.encrypt(
      password,
      ENCRYPTION_SECRET
    ).toString();

    // Update the Firestore document with the encrypted password
    const userRef = adminDb
      .collection("schools")
      .doc(schoolId)
      .collection("users")
      .doc(userId);

    await userRef.update({
      encryptedPassword: encryptedPassword,
      passwordUpdatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error: unknown) {
    const typedError = error as { message?: string };
    console.error("Error updating password:", error);
    return NextResponse.json(
      {
        error: "Failed to update password",
        details: typedError.message || "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
