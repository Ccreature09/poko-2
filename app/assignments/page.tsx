"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/functional/Sidebar";

interface Assignment {
  id: string;
  title: string;
  dueDate: string;
  courseId: string;
  courseName: string;
  status: "pending" | "submitted";
}

export default function Assignments() {
  const { user } = useUser();
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  useEffect(() => {
    const fetchAssignments = async () => {
      if (!user || !user.schoolId) return;

      const assignmentsRef = collection(
        db,
        "schools",
        user.schoolId,
        "assignments"
      );
      const q = query(
        assignmentsRef,
        where("studentIds", "array-contains", user.userId)
      );
      const querySnapshot = await getDocs(q);
      const fetchedAssignments = querySnapshot.docs.map(
        (doc) => ({ ...doc.data(), id: doc.id } as Assignment)
      );
      setAssignments(fetchedAssignments);
    };

    fetchAssignments();
  }, [user]);

  if (!user) return null;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <h1 className="text-3xl font-bold mb-8">Задачи</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assignments.map((assignment) => (
            <Card key={assignment.id}>
              <CardHeader>
                <CardTitle>{assignment.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-2">
                  Курс: {assignment.courseName}
                </p>
                <p className="text-muted-foreground mb-4">
                  Срок: {new Date(assignment.dueDate).toLocaleDateString()}
                </p>
                <Button
                  variant={
                    assignment.status === "submitted" ? "secondary" : "default"
                  }
                >
                  {assignment.status === "submitted" ? "Предадено" : "Предай"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
