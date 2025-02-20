"use client";

import type React from "react";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Sidebar from "@/components/Sidebar";

export default function CreateCourse() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [chapters, setChapters] = useState([{ title: "", description: "" }]);

  const handleAddChapter = () => {
    setChapters([...chapters, { title: "", description: "" }]);
  };

  const handleChapterChange = (index: number, field: string, value: string) => {
    const updatedChapters = [...chapters];
    updatedChapters[index] = { ...updatedChapters[index], [field]: value };
    setChapters(updatedChapters);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.schoolId) return;

    try {
      const courseRef = collection(db, "schools", user.schoolId, "courses");
      await addDoc(courseRef, {
        title,
        description,
        chapters,
        teacherId: user.userId,
        createdAt: new Date(),
      });

      router.push("/dashboard");
    } catch (error) {
      console.error("Error creating course:", error);
    }
  };

  if (!user || user.role !== "teacher") return null;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <h1 className="text-3xl font-bold mb-8">Create New Course</h1>
        <Card>
          <CardHeader>
            <CardTitle>Course Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Course Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Course Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setDescription(e.target.value)
                  }
                  required
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Chapters</h3>
                {chapters.map((chapter, index) => (
                  <div key={index} className="space-y-2 mb-4">
                    <Input
                      placeholder={`Chapter ${index + 1} Title`}
                      value={chapter.title}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleChapterChange(index, "title", e.target.value)
                      }
                      required
                    />
                    <Textarea
                      placeholder={`Chapter ${index + 1} Description`}
                      value={chapter.description}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        handleChapterChange(
                          index,
                          "description",
                          e.target.value
                        )
                      }
                      required
                    />
                  </div>
                ))}
                <Button type="button" onClick={handleAddChapter}>
                  Add Chapter
                </Button>
              </div>
              <Button type="submit">Create Course</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
