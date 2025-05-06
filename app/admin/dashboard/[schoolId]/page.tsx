"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import AdminDashboard from "@/components/functional/AdminDashboard";
import Sidebar from "@/components/functional/Sidebar";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminDashboardPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const params = useParams<{ schoolId: string }>();
  const schoolId = params?.schoolId || "";

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (user.role !== "admin") {
        // Redirect to role-specific dashboard
        switch (user.role) {
          case "teacher":
            router.push(`/teacher/dashboard/${user.schoolId}`);
            break;
          case "student":
            router.push(`/student/dashboard/${user.schoolId}`);
            break;
          case "parent":
            router.push(`/parent/dashboard/${user.schoolId}`);
            break;
          default:
            router.push("/login");
        }
      } else if (user.schoolId !== schoolId) {
        router.push("/login");
      }
    }
  }, [user, loading, schoolId, router]);

  if (loading) {
    return <Skeleton className="w-full h-96" />;
  }

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 w-full mx-auto">
        <div className="max-w-full md:max-w-4xl lg:max-w-7xl mx-auto">
          <AdminDashboard schoolId={schoolId} />
        </div>
      </main>
    </div>
  );
}
