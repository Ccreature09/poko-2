"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { useCourses } from "@/contexts/CoursesContext";
import { updateCourse, getCourseById } from "@/lib/management/courseManagement";
import { v4 as uuidv4 } from "uuid";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Course, HomeroomClass, Chapter } from "@/lib/interfaces";

import Sidebar from "@/components/functional/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";

export default function EditCourse() {
  // Извличане на параметрите от URL адреса, в случая courseId
  const params = useParams<{ courseId: string }>();
  const courseId = params?.courseId;
  const router = useRouter();
  const { user } = useUser();
  const { courses, setCourses } = useCourses();

  // useState кукита за управление на състоянието на компонента
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [classes, setClasses] = useState<HomeroomClass[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);

  // Fetch course data when component mounts
  useEffect(() => {
    const fetchCourse = async () => {
      if (!user?.schoolId || !courseId) return;

      try {
        setInitialLoading(true);

        // Fetch course from API
        const courseData = await getCourseById(user.schoolId, courseId);

        // Check if user is authorized to edit this course
        if (user.role !== "admin" && courseData.teacherId !== user.userId) {
          toast({
            title: "Permission Denied",
            description: "You don't have permission to edit this course",
            variant: "destructive",
          });
          router.push(`/${user.role}/courses/${courseId}`);
          return;
        }

        setCourse(courseData);

        // Populate form with course data
        setTitle(courseData.title);
        setDescription(courseData.description || "");
        setSubject(courseData.subject || "");
        setChapters(courseData.chapters || []);
        setSelectedClasses(courseData.classIds || []);

        // Fetch classes
        const classesCollection = collection(
          db,
          "schools",
          user.schoolId,
          "classes"
        );
        const classesSnapshot = await getDocs(classesCollection);
        const classesData = classesSnapshot.docs.map(
          (doc) => ({ ...doc.data(), classId: doc.id } as HomeroomClass)
        );
        setClasses(classesData);
      } catch (error) {
        console.error("Error fetching course:", error);
        toast({
          title: "Error",
          description: "Failed to load course data",
          variant: "destructive",
        });
      } finally {
        setInitialLoading(false);
      }
    };

    fetchCourse();
  }, [user, courseId, router]);

  // Функция за обработка на промени в дадена глава
  const handleChapterChange = (index: number, field: string, value: string) => {
    const updatedChapters = [...chapters];
    updatedChapters[index] = { ...updatedChapters[index], [field]: value };
    setChapters(updatedChapters);
  };

  // Функция за обработка на промени в даден подраздел на глава
  const handleSubchapterChange = (
    chapterIndex: number,
    subchapterIndex: number,
    field: string,
    value: string
  ) => {
    const updatedChapters = [...chapters];
    // Check if subchapters array exists
    if (!updatedChapters[chapterIndex].subchapters) {
      updatedChapters[chapterIndex].subchapters = [];
    }
    updatedChapters[chapterIndex].subchapters![subchapterIndex] = {
      ...updatedChapters[chapterIndex].subchapters![subchapterIndex],
      [field]: value,
    };
    setChapters(updatedChapters);
  };

  // Функция за обработка на промени в дадена тема на подраздел
  const handleTopicChange = (
    chapterIndex: number,
    subchapterIndex: number,
    topicIndex: number,
    field: string,
    value: string
  ) => {
    const updatedChapters = [...chapters];
    // Check if subchapters array exists
    if (!updatedChapters[chapterIndex].subchapters) {
      updatedChapters[chapterIndex].subchapters = [];
    }
    // Check if topics array exists
    if (!updatedChapters[chapterIndex].subchapters![subchapterIndex].topics) {
      updatedChapters[chapterIndex].subchapters![subchapterIndex].topics = [];
    }
    updatedChapters[chapterIndex].subchapters![subchapterIndex].topics[
      topicIndex
    ] = {
      ...updatedChapters[chapterIndex].subchapters![subchapterIndex].topics[
        topicIndex
      ],
      [field]: value,
    };
    setChapters(updatedChapters);
  };

  // Функция за добавяне на нова глава
  const handleAddChapter = () => {
    setChapters([
      ...chapters,
      {
        chapterId: uuidv4(),
        title: "",
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

  // Функция за добавяне на нов подраздел към глава
  const handleAddSubchapter = (chapterIndex: number) => {
    const updatedChapters = [...chapters];
    // Check if subchapters array exists before pushing
    if (!updatedChapters[chapterIndex].subchapters) {
      updatedChapters[chapterIndex].subchapters = [];
    }
    updatedChapters[chapterIndex].subchapters!.push({
      subchapterId: uuidv4(),
      title: "",
      topics: [{ topicId: uuidv4(), title: "", content: "" }],
    });
    setChapters(updatedChapters);
  };

  // Функция за добавяне на нова тема към подраздел
  const handleAddTopic = (chapterIndex: number, subchapterIndex: number) => {
    const updatedChapters = [...chapters];
    // Check if subchapters array exists
    if (!updatedChapters[chapterIndex].subchapters) {
      updatedChapters[chapterIndex].subchapters = [];
    }
    // Check if topics array exists
    if (!updatedChapters[chapterIndex].subchapters![subchapterIndex].topics) {
      updatedChapters[chapterIndex].subchapters![subchapterIndex].topics = [];
    }
    updatedChapters[chapterIndex].subchapters![subchapterIndex].topics.push({
      topicId: uuidv4(),
      title: "",
      content: "",
    });
    setChapters(updatedChapters);
  };

  // Функция за изтриване на глава
  const handleDeleteChapter = (index: number) => {
    const updatedChapters = chapters.filter((_, i) => i !== index);
    setChapters(updatedChapters);
  };

  // Функция за изтриване на подраздел
  const handleDeleteSubchapter = (
    chapterIndex: number,
    subchapterIndex: number
  ) => {
    const updatedChapters = [...chapters];
    // Check if subchapters array exists before filtering
    if (!updatedChapters[chapterIndex].subchapters) {
      return; // If no subchapters, nothing to delete
    }
    updatedChapters[chapterIndex].subchapters = updatedChapters[
      chapterIndex
    ].subchapters!.filter((_, i) => i !== subchapterIndex);
    setChapters(updatedChapters);
  };

  // Функция за изтриване на тема
  const handleDeleteTopic = (
    chapterIndex: number,
    subchapterIndex: number,
    topicIndex: number
  ) => {
    const updatedChapters = [...chapters];
    // Check if subchapters and topics arrays exist before filtering
    if (
      !updatedChapters[chapterIndex].subchapters ||
      !updatedChapters[chapterIndex].subchapters![subchapterIndex].topics
    ) {
      return; // If no subchapters or topics, nothing to delete
    }
    updatedChapters[chapterIndex].subchapters![subchapterIndex].topics =
      updatedChapters[chapterIndex].subchapters![subchapterIndex].topics.filter(
        (_, i) => i !== topicIndex
      );
    setChapters(updatedChapters);
  };

  // Функция за обработка на избор на клас
  const handleClassSelect = (classId: string) => {
    setSelectedClasses((prevSelected) =>
      prevSelected.includes(classId)
        ? prevSelected.filter((id) => id !== classId)
        : [...prevSelected, classId]
    );
  };

  // Функция за рендериране на избраните класове
  const renderSelectedClasses = () => {
    return selectedClasses
      .map(
        (classId) => classes.find((cls) => cls.classId === classId)?.className
      )
      .join(", ");
  };

  // Функция за обработка на изпращане на формата
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.schoolId || !courseId) return;

    try {
      setLoading(true);

      const courseData = {
        title,
        description,
        subject,
        chapters,
        classIds: selectedClasses,
        updatedAt: new Date(),
      };

      await updateCourse(user.schoolId, courseId, courseData);

      // Update the course in context
      if (course) {
        const updatedCourse = { ...course, ...courseData };
        const updatedCourses = courses.map((c) =>
          c.courseId === courseId ? updatedCourse : c
        );
        setCourses(updatedCourses);
      }

      toast({
        title: "Success",
        description: "Course updated successfully",
      });

      router.push(`/${user.role}/courses/${courseId}`);
    } catch (error) {
      console.error("Error updating course:", error);
      toast({
        title: "Error",
        description: "Failed to update course. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Ако потребителят не е учител или администратор, не се показва нищо
  if (!user || (user.role !== "teacher" && user.role !== "admin")) return null;

  // Ако данните се зареждат, показва се индикатор за зареждане
  if (initialLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 p-8">
          <Card>
            <CardContent className="pt-6 text-center">
              <p>Зареждане на курс...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Основен изглед на страницата за редактиране на курс
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">
          Редактиране на курс
        </h1>
        <Card className="max-w-4xl mx-auto shadow-md">
          <CardHeader className="border-b bg-white">
            <CardTitle className="text-xl text-gray-800">
              Детайли за курса
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-gray-700">
                    Заглавие на курса
                  </Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="border-gray-200 focus:border-blue-300"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-gray-700">
                    Предмет
                  </Label>
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
                <Label htmlFor="description" className="text-gray-700">
                  Описание на курса
                </Label>
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
                  <Label htmlFor="teacherName" className="text-gray-700">
                    Преподавател
                  </Label>
                  <Input
                    id="teacherName"
                    value={`${user?.firstName || ""} ${user?.lastName || ""}`}
                    disabled
                    className="bg-gray-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="class" className="text-gray-700">
                    Изберете класове
                  </Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between border-gray-200"
                      >
                        <span className="truncate">
                          {renderSelectedClasses() || "Изберете класове"}
                        </span>
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 15 15"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="ml-2 h-4 w-4"
                        >
                          <path
                            d="M4.93179 5.43179C4.75605 5.60753 4.75605 5.89245 4.93179 6.06819C5.10753 6.24392 5.39245 6.24392 5.56819 6.06819L7.49999 4.13638L9.43179 6.06819C9.60753 6.24392 9.89245 6.24392 10.0682 6.06819C10.2439 5.89245 10.2439 5.60753 10.0682 5.43179L7.81819 3.18179C7.73379 3.0974 7.61933 3.04999 7.49999 3.04999C7.38064 3.04999 7.26618 3.0974 7.18179 3.18179L4.93179 5.43179ZM10.0682 9.56819C10.2439 9.39245 10.2439 9.10753 10.0682 8.93179C9.89245 8.75606 9.60753 8.75606 9.43179 8.93179L7.49999 10.8636L5.56819 8.93179C5.39245 8.75606 5.10753 8.75606 4.93179 8.93179C4.75605 9.10753 4.75605 9.39245 4.93179 9.56819L7.18179 11.8182C7.26618 11.9026 7.38064 11.95 7.49999 11.95C7.61933 11.95 7.73379 11.9026 7.81819 11.8182L10.0682 9.56819Z"
                            fill="currentColor"
                            fillRule="evenodd"
                            clipRule="evenodd"
                          ></path>
                        </svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 max-h-[300px] overflow-auto">
                      {classes.map((cls) => (
                        <DropdownMenuItem
                          key={cls.classId}
                          onSelect={(e) => {
                            e.preventDefault();
                            handleClassSelect(cls.classId);
                          }}
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

              {/* Секция за управление на главите на курса */}
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
                  <Card
                    key={chapter.chapterId}
                    className="border border-gray-200"
                  >
                    <CardHeader className="bg-gray-50 pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <Input
                            placeholder={`Заглавие на глава ${
                              chapterIndex + 1
                            }`}
                            value={chapter.title}
                            onChange={(e) =>
                              handleChapterChange(
                                chapterIndex,
                                "title",
                                e.target.value
                              )
                            }
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
                          <h4 className="font-medium text-gray-700">
                            Подглави
                          </h4>
                          <Button
                            type="button"
                            onClick={() => handleAddSubchapter(chapterIndex)}
                            className="bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                          >
                            Добавяне на подглава
                          </Button>
                        </div>

                        {chapter.subchapters &&
                          chapter.subchapters.map(
                            (subchapter, subchapterIndex) => (
                              <Card
                                key={subchapter.subchapterId}
                                className="border-gray-200"
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-start justify-between mb-4">
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
                                      className="border-gray-200 focus:border-blue-300"
                                    />
                                    <Button
                                      type="button"
                                      onClick={() =>
                                        handleDeleteSubchapter(
                                          chapterIndex,
                                          subchapterIndex
                                        )
                                      }
                                      variant="destructive"
                                      className="ml-4"
                                    >
                                      Изтриване
                                    </Button>
                                  </div>

                                  <div className="ml-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                      <h5 className="text-sm font-semibold text-gray-700">
                                        Теми
                                      </h5>
                                      <Button
                                        type="button"
                                        onClick={() =>
                                          handleAddTopic(
                                            chapterIndex,
                                            subchapterIndex
                                          )
                                        }
                                        className="bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                                      >
                                        Добавяне на тема
                                      </Button>
                                    </div>

                                    {subchapter.topics.map(
                                      (topic, topicIndex) => (
                                        <div
                                          key={topic.topicId}
                                          className="space-y-2 p-4 bg-gray-50 rounded-lg"
                                        >
                                          <div className="flex items-start justify-between">
                                            <div className="flex-1 space-y-2">
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
                                                className="border-gray-200 focus:border-blue-300"
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
                                                className="border-gray-200 focus:border-blue-300"
                                              />
                                            </div>
                                            <Button
                                              type="button"
                                              onClick={() =>
                                                handleDeleteTopic(
                                                  chapterIndex,
                                                  subchapterIndex,
                                                  topicIndex
                                                )
                                              }
                                              variant="destructive"
                                              className="ml-4"
                                            >
                                              Изтриване
                                            </Button>
                                          </div>
                                        </div>
                                      )
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            )
                          )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="pt-6 border-t">
                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-colors text-lg py-6"
                  disabled={loading}
                >
                  {loading ? "Запазване..." : "Запази промените"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
