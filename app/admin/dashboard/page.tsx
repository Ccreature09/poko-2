// AdminDashboardPage Component - Main entry point for school administration dashboard
// Provides access to school statistics, recent activities, and management shortcuts
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import AdminDashboard from "@/components/functional/dashboards/AdminDashboard";
import { Skeleton } from "@/components/ui/skeleton";
import Sidebar from "@/components/functional/layout/Sidebar";

export default function AdminDashboardPage() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    // Authentication and role-based access control
    // Redirects non-admin users to appropriate dashboards
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (user.role !== "admin") {
        // Redirect to role-specific dashboard
        switch (user.role) {
          case "teacher":
            router.push(`/teacher/dashboard`);
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

  // Show loading state while checking authentication
  if (loading) {
    return <Skeleton className="w-full h-96" />;
  }

  // Prevent rendering for non-admin users
  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-auto p-3 md:p-6 lg:p-8 bg-gray-50">
        <AdminDashboard schoolId={user.schoolId} />
      </main>
    </div>
  );
}
