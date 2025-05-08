"use client";

/**
 * Parent Dashboard Page
 *
 * Main entry point for parent users that provides:
 * - Overview of all linked children's academic performance
 * - Summary cards with key metrics (grades, attendance, assignments)
 * - Quick access to recent notifications and important events
 * - Navigation to child-specific detailed views
 *
 * Security:
 * - Enforces role-based access control (parent role required)
 * - Redirects non-parent users to appropriate dashboards
 * - Prevents unauthenticated access with login redirection
 *
 * Technical implementation:
 * - Uses UserContext for authentication and role verification
 * - Delegates dashboard rendering to ParentDashboard component
 * - Implements responsive loading states with skeleton placeholder
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import ParentDashboard from "@/components/functional/dashboards/ParentDashboard";
import { Skeleton } from "@/components/ui/skeleton";

export default function ParentDashboardPage() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (user.role !== "parent") {
        // Redirect to role-specific dashboard
        switch (user.role) {
          case "admin":
            router.push(`/admin/dashboard`);
            break;
          case "teacher":
            router.push(`/teacher/dashboard`);
            break;
          case "student":
            router.push(`/student/dashboard`);
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
  if (!user || user.role !== "parent") {
    return null;
  }

  return <ParentDashboard />;
}
