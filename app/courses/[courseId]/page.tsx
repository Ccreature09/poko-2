"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Course } from "@/lib/interfaces";

export default function CourseDetails() {
  const { courseId } = useParams();
  const [course, setCourse] = useState<Course | null>(null);

  useEffect(() => {
    const fetchCourse = async () => {
      const courseDoc = await getDoc(doc(db, "courses", courseId as string));
      if (courseDoc.exists()) {
        setCourse({ ...courseDoc.data(), courseId: courseDoc.id } as Course);
      }
    };

    fetchCourse();
  }, [courseId]);

  if (!course) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">{course.title}</h1>
      <p className="text-gray-600 mb-4">{course.description}</p>
      <h2 className="text-xl font-semibold mb-2">Chapters</h2>
      {course.chapters.map((chapter) => (
        <div key={chapter.chapterId} className="mb-4">
          <h3 className="text-lg font-medium">{chapter.title}</h3>
          <ul className="list-disc list-inside">
            {chapter.subchapters.map((subchapter) => (
              <li key={subchapter.subchapterId}>{subchapter.title}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
