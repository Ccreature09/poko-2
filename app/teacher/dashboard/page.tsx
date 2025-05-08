"use client";

/**
 * Teacher Dashboard Page
 *
 * Main entry point for teachers accessing the application dashboard.
 * This page provides:
 *
 * Key features:
 * - Centralized access to teacher-specific functions and analytics
 * - Authentication and role-based access control
 * - Automatic redirection based on user role
 * - Loading state management during authentication
 *
 * Data flow:
 * - Retrieves user data from UserContext
 * - Validates user role and permission
 * - Routes to appropriate dashboard based on user type
 * - Renders the teacher dashboard component with user data
 *
 * This serves as the main interface for teachers to access student information,
 * manage classes, track attendance, review academic progress, and manage
 * communication with students and parents.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import TeacherDashboard from "@/components/functional/dashboards/TeacherDashboard";
import { Skeleton } from "@/components/ui/skeleton";
import type { Teacher } from "@/lib/interfaces";

export default function TeacherDashboardPage() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (user.role !== "teacher") {
        // Redirect to role-specific dashboard
        switch (user.role) {
          case "admin":
            router.push(`/admin/dashboard`);
            break;
          case "student":
            router.push(`/student/dashboard`);
            break;
          case "parent":
            router.push(`/parent/dashboard`);
            break;
          default:
            router.push("/login");
        }
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return <Skeleton className="w-full h-96" />;
  }

  if (!user || user.role !== "teacher") {
    return null;
  }

  return <TeacherDashboard user={user as Teacher & { schoolId: string }} />;
}
