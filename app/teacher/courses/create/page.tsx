"use client";

import type React from "react";
import type { HomeroomClass } from "@/lib/interfaces";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { collection, addDoc, getDocs, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Sidebar from "@/components/functional/Sidebar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { v4 as uuidv4 } from "uuid";

export default function CreateCourse() {
  const { user } = useUser();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [chapters, setChapters] = useState([
    {
      chapterId: uuidv4(),
      title: "",
      description: "",
      subchapters: [
        {
          subchapterId: uuidv4(),
          title: "",
          topics: [{ topicId: uuidv4(), title: "", content: "" }],
        },
      ],
    },
  ]);
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
        teacherIds: doc.data().teacherIds || [], // Add the missing teacherIds property with a default empty array
      }));
      setClasses(classesList);
    };
    fetchClasses();
  }, [user]);

  const handleAddChapter = () => {
    setChapters([
      ...chapters,
      {
        chapterId: uuidv4(),
        title: "",
        description: "",
        subchapters: [
          {
            subchapterId: uuidv4(),
            title: "",
            topics: [{ topicId: uuidv4(), title: "", content: "" }],
          },
        ],
      },
    ]);
  };

  const handleChapterChange = (index: number, field: string, value: string) => {
    const updatedChapters = [...chapters];
    updatedChapters[index] = { ...updatedChapters[index], [field]: value };
    setChapters(updatedChapters);
  };

  const handleAddSubchapter = (chapterIndex: number) => {
    const updatedChapters = [...chapters];
    updatedChapters[chapterIndex].subchapters.push({
      subchapterId: uuidv4(),
      title: "",
      topics: [{ topicId: uuidv4(), title: "", content: "" }],
    });
    setChapters(updatedChapters);
  };

  const handleSubchapterChange = (
    chapterIndex: number,
    subchapterIndex: number,
    field: string,
    value: string
  ) => {
    const updatedChapters = [...chapters];
    updatedChapters[chapterIndex].subchapters[subchapterIndex] = {
      ...updatedChapters[chapterIndex].subchapters[subchapterIndex],
      [field]: value,
    };
    setChapters(updatedChapters);
  };

  const handleAddTopic = (chapterIndex: number, subchapterIndex: number) => {
    const updatedChapters = [...chapters];
    updatedChapters[chapterIndex].subchapters[subchapterIndex].topics.push({
      topicId: uuidv4(),
      title: "",
      content: "",
    });
    setChapters(updatedChapters);
  };

  const handleTopicChange = (
    chapterIndex: number,
    subchapterIndex: number,
    topicIndex: number,
    field: string,
    value: string
  ) => {
    const updatedChapters = [...chapters];
    updatedChapters[chapterIndex].subchapters[subchapterIndex].topics[
      topicIndex
    ] = {
      ...updatedChapters[chapterIndex].subchapters[subchapterIndex].topics[
        topicIndex
      ],
      [field]: value,
    };
    setChapters(updatedChapters);
  };

  const handleDeleteChapter = (index: number) => {
    const updatedChapters = chapters.filter((_, i) => i !== index);
    setChapters(updatedChapters);
  };

  const handleDeleteSubchapter = (
    chapterIndex: number,
    subchapterIndex: number
  ) => {
    const updatedChapters = [...chapters];
    updatedChapters[chapterIndex].subchapters = updatedChapters[
      chapterIndex
    ].subchapters.filter((_, i) => i !== subchapterIndex);
    setChapters(updatedChapters);
  };

  const handleDeleteTopic = (
    chapterIndex: number,
    subchapterIndex: number,
    topicIndex: number
  ) => {
    const updatedChapters = [...chapters];
    updatedChapters[chapterIndex].subchapters[subchapterIndex].topics =
      updatedChapters[chapterIndex].subchapters[subchapterIndex].topics.filter(
        (_, i) => i !== topicIndex
      );
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
      .map(
        (classId) => classes.find((cls) => cls.classId === classId)?.className
      )
      .join(", ");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.schoolId) return;

    try {
      const teacherName = `${user.firstName} ${user.lastName}`;
      
      const courseRef = collection(db, "schools", user.schoolId, "courses");
      const docData = {
        title,
        description,
        subject,
        chapters,
        teacherId: user.userId,
        teacherName: teacherName,
        createdAt: new Date(),
        classIds: selectedClasses,
      };
      const docRef = await addDoc(courseRef, docData);

      await setDoc(
        docRef,
        { id: docRef.id, courseId: docRef.id },
        { merge: true }
      );

      router.push(`/teacher/dashboard/${user.schoolId}`);
    } catch (error) {
      console.error("Грешка при създаване на курс:", error);
    }
  };

  if (!user || user.role !== "teacher") return null;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">Създаване на нов курс</h1>
        <Card className="max-w-4xl mx-auto shadow-md">
          <CardHeader className="border-b bg-white">
            <CardTitle className="text-xl text-gray-800">Детайли за курса</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-gray-700">Заглавие на курса</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="border-gray-200 focus:border-blue-300"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-gray-700">Предмет</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Напр. Математика, Български език, Физика"
                    required
                    className="border-gray-200 focus:border-blue-300"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-gray-700">Описание на курса</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="min-h-[100px] border-gray-200 focus:border-blue-300"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="teacherName" className="text-gray-700">Преподавател</Label>
                  <Input
                    id="teacherName"
                    value={`${user?.firstName || ""} ${user?.lastName || ""}`}
                    disabled
                    className="bg-gray-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="class" className="text-gray-700">Изберете класове</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between bg-white border-gray-200 hover:bg-gray-50">
                        <span className="truncate">{renderSelectedClasses() || "Изберете класове"}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2">
                          <path d="m6 9 6 6 6-6"/>
                        </svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[200px]">
                      {classes.map((cls) => (
                        <DropdownMenuItem
                          key={cls.classId}
                          onSelect={() => handleClassSelect(cls.classId)}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={selectedClasses.includes(cls.classId)}
                              readOnly
                              className="mr-2"
                            />
                            {cls.className}
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="space-y-4 border-t pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">Глави</h3>
                  <Button
                    type="button"
                    onClick={handleAddChapter}
                    className="bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                  >
                    Добавяне на глава
                  </Button>
                </div>

                {chapters.map((chapter, chapterIndex) => (
                  <Card key={chapter.chapterId} className="border border-gray-200">
                    <CardHeader className="bg-gray-50 pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <Input
                            placeholder={`Заглавие на глава ${chapterIndex + 1}`}
                            value={chapter.title}
                            onChange={(e) => handleChapterChange(chapterIndex, "title", e.target.value)}
                            required
                            className="border-gray-200 focus:border-blue-300"
                          />
                          <Textarea
                            placeholder={`Описание на глава ${chapterIndex + 1}`}
                            value={chapter.description}
                            onChange={(e) => handleChapterChange(chapterIndex, "description", e.target.value)}
                            required
                            className="border-gray-200 focus:border-blue-300"
                          />
                        </div>
                        <Button
                          type="button"
                          onClick={() => handleDeleteChapter(chapterIndex)}
                          variant="destructive"
                          className="ml-4"
                        >
                          Изтриване
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-md font-semibold text-gray-700">Подглави</h4>
                          <Button
                            type="button"
                            onClick={() => handleAddSubchapter(chapterIndex)}
                            className="bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                          >
                            Добавяне на подглава
                          </Button>
                        </div>
                        
                        {chapter.subchapters.map((subchapter, subchapterIndex) => (
                          <Card key={subchapter.subchapterId} className="border border-gray-100">
                            <CardContent className="pt-4">
                              <div className="flex items-start justify-between mb-4">
                                <Input
                                  placeholder={`Заглавие на подглава ${subchapterIndex + 1}`}
                                  value={subchapter.title}
                                  onChange={(e) => handleSubchapterChange(chapterIndex, subchapterIndex, "title", e.target.value)}
                                  required
                                  className="border-gray-200 focus:border-blue-300"
                                />
                                <Button
                                  type="button"
                                  onClick={() => handleDeleteSubchapter(chapterIndex, subchapterIndex)}
                                  variant="destructive"
                                  className="ml-4"
                                >
                                  Изтриване
                                </Button>
                              </div>

                              <div className="ml-4 space-y-4">
                                <div className="flex items-center justify-between">
                                  <h5 className="text-sm font-semibold text-gray-700">Теми</h5>
                                  <Button
                                    type="button"
                                    onClick={() => handleAddTopic(chapterIndex, subchapterIndex)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                                  >
                                    Добавяне на тема
                                  </Button>
                                </div>

                                {subchapter.topics.map((topic, topicIndex) => (
                                  <div key={topic.topicId} className="space-y-2 p-4 bg-gray-50 rounded-lg">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1 space-y-2">
                                        <Input
                                          placeholder={`Заглавие на тема ${topicIndex + 1}`}
                                          value={topic.title}
                                          onChange={(e) => handleTopicChange(chapterIndex, subchapterIndex, topicIndex, "title", e.target.value)}
                                          required
                                          className="border-gray-200 focus:border-blue-300"
                                        />
                                        <Textarea
                                          placeholder={`Съдържание на тема ${topicIndex + 1}`}
                                          value={topic.content}
                                          onChange={(e) => handleTopicChange(chapterIndex, subchapterIndex, topicIndex, "content", e.target.value)}
                                          required
                                          className="border-gray-200 focus:border-blue-300"
                                        />
                                      </div>
                                      <Button
                                        type="button"
                                        onClick={() => handleDeleteTopic(chapterIndex, subchapterIndex, topicIndex)}
                                        variant="destructive"
                                        className="ml-4"
                                      >
                                        Изтриване
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="pt-6 border-t">
                <Button 
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-colors text-lg py-6"
                >
                  Създаване на курс
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
