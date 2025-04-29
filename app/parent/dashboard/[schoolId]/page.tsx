"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import ParentDashboard from "@/components/functional/ParentDashboard";
import { Skeleton } from "@/components/ui/skeleton";

export default function ParentDashboardPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const params = useParams<{ schoolId: string }>();
  const schoolId = params?.schoolId || "";

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (user.role !== "parent") {
        // Redirect to role-specific dashboard
        switch (user.role) {
          case "admin":
            router.push(`/admin/dashboard/${user.schoolId}`);
            break;
          case "teacher":
            router.push(`/teacher/dashboard/${user.schoolId}`);
            break;
          case "student":
            router.push(`/student/dashboard/${user.schoolId}`);
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

  if (!user || user.schoolId !== schoolId || user.role !== "parent") {
    return null;
  }

  return <ParentDashboard />;
}