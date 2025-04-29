"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import StudentDashboard from "@/components/functional/StudentDashboard";
import { Skeleton } from "@/components/ui/skeleton";
import type { Student } from "@/lib/interfaces";

export default function StudentDashboardPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const params = useParams<{ schoolId: string }>();
  const schoolId = params?.schoolId || "";

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (user.role !== "student") {
        // Redirect to role-specific dashboard
        switch (user.role) {
          case "admin":
            router.push(`/admin/dashboard/${user.schoolId}`);
            break;
          case "teacher":
            router.push(`/teacher/dashboard/${user.schoolId}`);
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

  if (!user || user.schoolId !== schoolId || user.role !== "student") {
    return null;
  }

  return <StudentDashboard user={user as Student & { schoolId: string }} />;
}