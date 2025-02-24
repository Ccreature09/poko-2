"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import AdminDashboard from "@/components/functional/AdminDashboard";
import TeacherDashboard from "@/components/functional/TeacherDashboard";
import StudentDashboard from "@/components/functional/StudentDashboard";
import { Skeleton } from "@/components/ui/skeleton";
import type { Teacher, Student } from "@/lib/interfaces";

export default function DashboardPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const { user, loading } = useUser();
  const router = useRouter();
  const [params, setParams] = useState<{ schoolId: string } | null>(null);

  useEffect(() => {
    paramsPromise.then(setParams);
  }, [paramsPromise]);

  useEffect(() => {
    if (!loading && params && (!user || user.schoolId !== params.schoolId)) {
      router.push("/login");
    }
  }, [user, loading, params, router]);

  if (loading || !params) {
    return <Skeleton className="w-full h-96" />;
  }

  if (!user || user.schoolId !== params.schoolId) {
    return null; // This will be handled by the useEffect hook above
  }

  switch (user.role) {
    case "admin":
      return <AdminDashboard />;
    case "teacher":
      return <TeacherDashboard user={user as Teacher & { schoolId: string }} />;
    case "student":
      return <StudentDashboard user={user as Student & { schoolId: string }} />;
    default:
      return <div>Невалидна роля на потребителя</div>;
  }
}
