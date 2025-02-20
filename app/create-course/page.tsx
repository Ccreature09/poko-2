"use client";

import type React from "react";
import type { HomeroomClass } from "@/lib/interfaces";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Sidebar from "@/components/Sidebar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

export default function CreateCourse() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [chapters, setChapters] = useState([{ title: "", description: "" }]);
  const [classes, setClasses] = useState<HomeroomClass[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);

  useEffect(() => {
    const fetchClasses = async () => {
      if (!user || !user.schoolId) return;
      const classesRef = collection(db, "schools", user.schoolId, "classes");
      const classesSnapshot = await getDocs(classesRef);
      const classesList = classesSnapshot.docs.map((doc) => ({
        classId: doc.id,
        className: doc.data().className,
        yearGroup: doc.data().yearGroup,
        classTeacherId: doc.data().classTeacherId,
        studentIds: doc.data().studentIds,
      }));
      setClasses(classesList);
    };
    fetchClasses();
  }, [user]);

  const handleAddChapter = () => {
    setChapters([...chapters, { title: "", description: "" }]);
  };

  const handleChapterChange = (index: number, field: string, value: string) => {
    const updatedChapters = [...chapters];
    updatedChapters[index] = { ...updatedChapters[index], [field]: value };
    setChapters(updatedChapters);
  };

  const handleClassSelect = (classId: string) => {
    setSelectedClasses((prevSelected) =>
      prevSelected.includes(classId)
        ? prevSelected.filter((id) => id !== classId)
        : [...prevSelected, classId]
    );
  };

  const renderSelectedClasses = () => {
    return selectedClasses
      .map((classId) => classes.find((cls) => cls.classId === classId)?.className)
      .join(", ");
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
        classIds: selectedClasses,
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
                <Label htmlFor="class">Select Classes</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full text-white">
                      {renderSelectedClasses() || "Select Classes"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {classes.map((cls) => (
                      <DropdownMenuItem key={cls.classId} onSelect={() => handleClassSelect(cls.classId)}>
                        {cls.className}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
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
                <Button type="button" onClick={handleAddChapter} className="text-white">
                  Add Chapter
                </Button>
              </div>
              <Button type="submit" className="text-white">Create Course</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
