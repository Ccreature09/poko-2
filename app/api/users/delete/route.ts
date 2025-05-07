import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/lib/firebase-admin";

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    const adminApp = await initAdmin();
    const auth = adminApp.auth();

    // Delete the user from Firebase Authentication
    await auth.deleteUser(userId);

    return NextResponse.json(
      { success: true, message: "Auth account deleted successfully" },
      { status: 200 }
    );
  } catch (error: unknown) {
    const typedError = error as { code?: string; message?: string };
    console.error("Error deleting Firebase auth account:", error);

    // Handle case where user might already be deleted in Authentication
    if (typedError.code === "auth/user-not-found") {
      return NextResponse.json(
        {
          success: true,
          message: "User doesn't exist in Auth or already deleted",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: typedError.message || "Failed to delete auth account" },
      { status: 500 }
    );
  }
}
