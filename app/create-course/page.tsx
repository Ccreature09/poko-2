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
      const courseRef = collection(db, "schools", user.schoolId, "courses");
      const docData = {
        title,
        description,
        chapters,
        teacherId: user.userId,
        createdAt: new Date(),
        classIds: selectedClasses,
      };
      const docRef = await addDoc(courseRef, docData);

      await setDoc(
        docRef,
        { id: docRef.id, courseId: docRef.id },
        { merge: true }
      );

      router.push(`/dashboard/${user.schoolId}`);
    } catch (error) {
      console.error("Грешка при създаване на курс:", error);
    }
  };

  if (!user || user.role !== "teacher") return null;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <h1 className="text-3xl font-bold mb-8">Създаване на нов курс</h1>
        <Card>
          <CardHeader>
            <CardTitle>Детайли за курса</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Заглавие на курса</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Описание на курса</Label>
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
                <Label htmlFor="class">Изберете класове</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full text-white">
                      {renderSelectedClasses() || "Изберете класове"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {classes.map((cls) => (
                      <DropdownMenuItem
                        key={cls.classId}
                        onSelect={() => handleClassSelect(cls.classId)}
                      >
                        {cls.className}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Глави</h3>
                {chapters.map((chapter, chapterIndex) => (
                  <div key={chapter.chapterId} className="space-y-2 mb-4">
                    <Input
                      placeholder={`Заглавие на глава ${chapterIndex + 1}`}
                      value={chapter.title}
                      onChange={(e) =>
                        handleChapterChange(
                          chapterIndex,
                          "title",
                          e.target.value
                        )
                      }
                      required
                    />
                    <Textarea
                      placeholder={`Описание на глава ${chapterIndex + 1}`}
                      value={chapter.description}
                      onChange={(e) =>
                        handleChapterChange(
                          chapterIndex,
                          "description",
                          e.target.value
                        )
                      }
                      required
                    />
                    <Button
                      type="button"
                      onClick={() => handleDeleteChapter(chapterIndex)}
                      className="text-white"
                    >
                      Изтриване на глава
                    </Button>
                    <div className="ml-4">
                      <h4 className="text-md font-semibold mb-2">
                        Подглави
                      </h4>
                      {chapter.subchapters.map(
                        (subchapter, subchapterIndex) => (
                          <div
                            key={subchapter.subchapterId}
                            className="space-y-2 mb-4"
                          >
                            <Input
                              placeholder={`Заглавие на подглава ${
                                subchapterIndex + 1
                              }`}
                              value={subchapter.title}
                              onChange={(e) =>
                                handleSubchapterChange(
                                  chapterIndex,
                                  subchapterIndex,
                                  "title",
                                  e.target.value
                                )
                              }
                              required
                            />
                            <Button
                              type="button"
                              onClick={() =>
                                handleDeleteSubchapter(
                                  chapterIndex,
                                  subchapterIndex
                                )
                              }
                              className="text-white"
                            >
                              Изтриване на подглава
                            </Button>
                            <div className="ml-4">
                              <h5 className="text-sm font-semibold mb-2">
                                Теми
                              </h5>
                              {subchapter.topics.map((topic, topicIndex) => (
                                <div
                                  key={topic.topicId}
                                  className="space-y-2 mb-4"
                                >
                                  <Input
                                    placeholder={`Заглавие на тема ${
                                      topicIndex + 1
                                    }`}
                                    value={topic.title}
                                    onChange={(e) =>
                                      handleTopicChange(
                                        chapterIndex,
                                        subchapterIndex,
                                        topicIndex,
                                        "title",
                                        e.target.value
                                      )
                                    }
                                    required
                                  />
                                  <Textarea
                                    placeholder={`Съдържание на тема ${
                                      topicIndex + 1
                                    }`}
                                    value={topic.content}
                                    onChange={(e) =>
                                      handleTopicChange(
                                        chapterIndex,
                                        subchapterIndex,
                                        topicIndex,
                                        "content",
                                        e.target.value
                                      )
                                    }
                                    required
                                  />
                                  <Button
                                    type="button"
                                    onClick={() =>
                                      handleDeleteTopic(
                                        chapterIndex,
                                        subchapterIndex,
                                        topicIndex
                                      )
                                    }
                                    className="text-white"
                                  >
                                    Изтриване на тема
                                  </Button>
                                </div>
                              ))}
                              <Button
                                type="button"
                                onClick={() =>
                                  handleAddTopic(chapterIndex, subchapterIndex)
                                }
                                className="text-white"
                              >
                                Добавяне на тема
                              </Button>
                            </div>
                          </div>
                        )
                      )}
                      <Button
                        type="button"
                        onClick={() => handleAddSubchapter(chapterIndex)}
                        className="text-white"
                      >
                        Добавяне на подглава
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  onClick={handleAddChapter}
                  className="text-white"
                >
                  Добавяне на глава
                </Button>
              </div>
              <Button type="submit" className="text-white">
                Създаване на курс
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
