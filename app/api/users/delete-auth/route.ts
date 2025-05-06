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
  } catch (error: any) {
    console.error("Error deleting Firebase auth account:", error);

    // Handle case where user might already be deleted in Authentication
    if (error.code === "auth/user-not-found") {
      return NextResponse.json(
        {
          success: true,
          message: "User doesn't exist in Auth or already deleted",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to delete auth account" },
      { status: 500 }
    );
  }
}
