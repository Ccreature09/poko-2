"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Course } from "@/lib/interfaces";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import Sidebar from "@/components/Sidebar";

export default function Courses() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    const fetchCourses = async () => {
      if (!user || !user.schoolId) return;

      const coursesRef = collection(db, "schools", user.schoolId, "courses");
      const q = query(
        coursesRef,
        where("studentIds", "array-contains", user.userId)
      );
      const querySnapshot = await getDocs(q);
      const fetchedCourses = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          courseId: data.courseId,
          title: data.title,
          description: data.description,
          chapters: data.chapters,
        } as Course;
      });
      setCourses(fetchedCourses);
    };

    fetchCourses();
  }, [user]);

  if (!user) return null;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <h1 className="text-3xl font-bold mb-8">My Courses</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Card key={course.courseId}>
              <CardHeader>
                <CardTitle>{course.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  {course.description}
                </p>
                <Progress value={33} className="mb-2" />
                <p className="text-sm text-muted-foreground">33% Complete</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
