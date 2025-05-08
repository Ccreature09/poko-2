"use client";

/**
 * Teacher Course Detail Page
 *
 * Comprehensive interface for viewing and navigating educational content.
 * This page provides:
 *
 * Key features:
 * - Interactive course content navigation with hierarchical chapter structure
 * - Rich content display with topic-by-topic progression
 * - Course information dashboard with content statistics
 * - Sequential topic navigation with progress indicators
 * - Course management options for editing and deletion
 * - Access control enforcement based on teacher ownership
 *
 * Data flow:
 * - Retrieves detailed course structure and content from context
 * - Manages navigation state for chapter/subchapter/topic selection
 * - Synchronizes content display with navigation selections
 * - Validates user permissions for management operations
 * - Processes course deletion with confirmation workflow
 *
 * This interface serves as the primary content delivery mechanism for
 * educational materials, enabling teachers to review their published
 * course content and manage the course lifecycle with editing and
 * deletion capabilities.
 */

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { toast } from "@/hooks/use-toast";
import Sidebar from "@/components/functional/layout/Sidebar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { useCourses } from "@/contexts/CoursesContext";
import type { Course, Subchapter, Topic } from "@/lib/interfaces";
import {
  BookOpen,
  Clock,
  ArrowLeft,
  BookOpenText,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteCourse } from "@/lib/management/courseManagement";

export default function CourseDetails() {
  // Вземане на параметрите от URL, в случая courseId
  const params = useParams<{ courseId: string }>();
  const courseId = params?.courseId || "";
  // Вземане на потребителската информация от контекста
  const { user } = useUser();
  // Вземане на курсовете и функцията за обновяване от контекста
  const { courses, setCourses } = useCourses();
  // Състояние за текущия курс
  const [course, setCourse] = useState<Course | null>(null);
  // Състояние за избраната подглава
  const [selectedSubchapter, setSelectedSubchapter] =
    useState<Subchapter | null>(null);
  // Състояние за избраната тема
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  // Current topic index
  const [currentTopicIndex, setCurrentTopicIndex] = useState<number>(0);
  // Състояние за стойността по подразбиране на акордеона
  const [defaultAccordionValue, setDefaultAccordionValue] = useState<
    string | undefined
  >(undefined);
  // Състояние за показване на диалога за изтриване
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  // Състояние за индикация дали се извършва изтриване
  const [deleting, setDeleting] = useState(false);
  // Router за навигация
  const router = useRouter();

  // useEffect hook, който се изпълнява при промяна на courseId, user?.schoolId или courses
  useEffect(() => {
    if (user?.schoolId) {
      // Намиране на курса по courseId
      const courseData = courses.find((course) => course.courseId === courseId);
      if (courseData) {
        setCourse(courseData);
        // Итериране през главите и подглавите, за да се намери първата тема и да се зададе като избрана
        for (const chapter of courseData.chapters) {
          for (const subchapter of chapter.subchapters || []) {
            if (subchapter.topics.length > 0) {
              setSelectedSubchapter(subchapter);
              setSelectedTopic(subchapter.topics[0] || null);
              setCurrentTopicIndex(0);
              setDefaultAccordionValue(
                `chapter-${courseData.chapters.indexOf(chapter)}`
              );
              return;
            }
          }
        }
      }
    }
  }, [courseId, user?.schoolId, courses]);

  // Функция за изтриване на курса
  const handleDeleteCourse = async () => {
    if (!user?.schoolId || !courseId) return;

    try {
      setDeleting(true);
      await deleteCourse(user.schoolId, courseId as string);

      // Обновяване на курсовете в контекста
      setCourses(courses.filter((c) => c.courseId !== courseId));

      toast({
        title: "Успешно",
        description: "Курсът е изтрит успешно",
      });

      router.push(`/${user.role}/courses`);
    } catch (error) {
      console.error("Error deleting course:", error);
      toast({
        title: "Грешка",
        description: "Неуспешно изтриване на курса",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // Navigate to the next topic
  const goToNextTopic = () => {
    if (
      !selectedSubchapter ||
      currentTopicIndex >= selectedSubchapter.topics.length - 1
    )
      return;
    setCurrentTopicIndex(currentTopicIndex + 1);
    setSelectedTopic(selectedSubchapter.topics[currentTopicIndex + 1]);
  };

  // Navigate to the previous topic
  const goToPreviousTopic = () => {
    if (!selectedSubchapter || currentTopicIndex <= 0) return;
    setCurrentTopicIndex(currentTopicIndex - 1);
    setSelectedTopic(selectedSubchapter.topics[currentTopicIndex - 1]);
  };

  // Select a specific topic by index
  const selectTopicByIndex = (index: number) => {
    if (
      !selectedSubchapter ||
      index < 0 ||
      index >= selectedSubchapter.topics.length
    )
      return;
    setCurrentTopicIndex(index);
    setSelectedTopic(selectedSubchapter.topics[index]);
  };

  // Update topic index when changing subchapter
  const handleSubchapterChange = (subchapter: Subchapter) => {
    setSelectedSubchapter(subchapter);
    setSelectedTopic(subchapter.topics[0] || null);
    setCurrentTopicIndex(0);
  };

  // Ако курсът не е намерен, показва се индикатор за зареждане
  if (!course) {
    return (
      <div className="flex min-h-screen">
        <Sidebar className="hidden lg:block" />
        <div className="flex-1 pt-16 lg:pt-4 px-4 lg:px-8 flex items-center justify-center">
          <div className="text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground animate-pulse" />
            <h2 className="text-xl font-semibold mt-4">Loading course...</h2>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar className="hidden lg:block" />

      <div className="flex-1 pt-16 lg:pt-4">
        <div className="max-w-7xl mx-auto">
          {/* Course header */}
          <div className="border-b pb-4 px-4 lg:px-8">
            <div className="mb-2">
              <Link href={`/${user?.role || "student"}/courses`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="pl-0 text-foreground"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Обратно към всички курсове
                </Button>
              </Link>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">
                  {course.title}
                </h1>
                <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
                  {course.description}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 max-w-[300px]">
                {Array.isArray(course.classIds) ? (
                  course.classIds.map((classId, index) => (
                    <Badge key={index} variant="secondary" className="text-sm">
                      {classId} клас
                    </Badge>
                  ))
                ) : (
                  <Badge variant="secondary" className="text-sm">
                    {course.classIds || "9"} клас
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row">
            {/* Chapter/Subchapter navigation */}
            <div className="w-full lg:w-1/4 border-r">
              <div className="p-4 bg-muted/10">
                <h3 className="font-medium mb-2 flex items-center">
                  <BookOpenText className="h-4 w-4 mr-2" />
                  Съдържание на курса
                </h3>
                <Accordion
                  type="single"
                  collapsible
                  defaultValue={defaultAccordionValue || ""}
                  className="w-full"
                >
                  {course.chapters.map((chapter, chapterIndex) => (
                    <AccordionItem
                      key={chapter.title}
                      value={`chapter-${chapterIndex}`}
                      className="border-b-0"
                    >
                      <AccordionTrigger className="py-2 px-2 hover:bg-muted/20 rounded-md text-sm">
                        {chapter.title}
                      </AccordionTrigger>
                      <AccordionContent>
                        <Accordion type="multiple" className="w-full pl-2">
                          {chapter.subchapters?.map((subchapter) => (
                            <AccordionItem
                              key={subchapter.subchapterId}
                              value={`subchapter-${subchapter.subchapterId}`}
                              className="border-b-0"
                            >
                              <AccordionTrigger
                                className={`py-1.5 px-2 hover:bg-muted/20 rounded-md text-sm ${
                                  selectedSubchapter?.subchapterId ===
                                  subchapter.subchapterId
                                    ? "text-primary font-medium"
                                    : ""
                                }`}
                                onClick={(e) => {
                                  // Prevent the accordion from toggling when clicking directly on the trigger
                                  if (e.target === e.currentTarget) {
                                    e.preventDefault();
                                    handleSubchapterChange(subchapter);
                                  }
                                }}
                              >
                                <div className="flex items-center">
                                  <FileText className="h-3.5 w-3.5 mr-2 flex-shrink-0" />
                                  <span className="truncate">
                                    {subchapter.title}
                                  </span>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="pl-6">
                                <ul className="space-y-1 py-1">
                                  {subchapter.topics.map(
                                    (topic, topicIndex) => (
                                      <li
                                        key={`${subchapter.title}-${topicIndex}`}
                                        className={`py-1 px-2 rounded-md cursor-pointer transition-colors text-sm hover:bg-muted/20 flex items-center ${
                                          selectedSubchapter?.subchapterId ===
                                            subchapter.subchapterId &&
                                          currentTopicIndex === topicIndex
                                            ? "bg-primary/10 text-primary font-medium"
                                            : "text-muted-foreground"
                                        }`}
                                        onClick={() => {
                                          setSelectedSubchapter(subchapter);
                                          setSelectedTopic(topic);
                                          setCurrentTopicIndex(topicIndex);
                                        }}
                                      >
                                        <span
                                          className={`w-1.5 h-1.5 rounded-full mr-2 ${
                                            selectedSubchapter?.subchapterId ===
                                              subchapter.subchapterId &&
                                            currentTopicIndex === topicIndex
                                              ? "bg-primary"
                                              : "bg-gray-300"
                                          }`}
                                        ></span>
                                        {topic.title}
                                      </li>
                                    )
                                  )}
                                </ul>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </div>

            {/* Main content area */}
            <div className="flex-1 p-4 lg:p-8 overflow-auto">
              {selectedSubchapter && selectedTopic ? (
                <div className="max-w-3xl">
                  <Card className="mb-6">
                    <CardHeader className="border-b bg-muted/10">
                      <Badge variant="outline" className="mb-2 w-fit">
                        {selectedSubchapter.title}
                      </Badge>
                      <CardTitle>{selectedTopic.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="prose prose-stone max-w-none">
                        <p className="whitespace-pre-wrap">
                          {selectedTopic.content}
                        </p>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between pt-2 border-t">
                      <div className="text-sm text-muted-foreground">
                        Тема {currentTopicIndex + 1} of{" "}
                        {selectedSubchapter.topics.length}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={goToPreviousTopic}
                          disabled={currentTopicIndex <= 0}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" /> Предишна
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={goToNextTopic}
                          disabled={
                            currentTopicIndex >=
                            selectedSubchapter.topics.length - 1
                          }
                        >
                          Следваща <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>

                  {/* Topic navigation dots */}
                  {selectedSubchapter.topics.length > 1 && (
                    <div className="flex justify-center gap-1 mt-2">
                      {selectedSubchapter.topics.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => selectTopicByIndex(index)}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            currentTopicIndex === index
                              ? "bg-primary"
                              : "bg-gray-300 hover:bg-gray-400"
                          }`}
                          aria-label={`Go to topic ${index + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-2">За този курс</h2>
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {course.description}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-6">
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <BookOpen className="h-4 w-4 text-primary" />
                          <span className="font-medium">Глави</span>
                        </div>
                        <p className="text-2xl font-semibold">
                          {course.chapters.length}
                        </p>
                      </div>

                      <div className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="font-medium">Подглави</span>
                        </div>
                        <p className="text-2xl font-semibold">
                          {course.chapters.reduce(
                            (count, chapter) =>
                              count + (chapter.subchapters?.length || 0),
                            0
                          )}
                        </p>
                      </div>

                      <div className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="h-4 w-4 text-primary" />
                          <span className="font-medium">Прогрес</span>
                        </div>
                        <p className="text-2xl font-semibold">33%</p>
                      </div>
                    </div>
                  </div>

                  <h2 className="text-xl font-semibold mb-4">
                    Съдържание на курса
                  </h2>
                  <div className="space-y-6">
                    {course.chapters.map((chapter, index) => (
                      <Card key={index}>
                        <CardHeader className="bg-muted/5 border-b">
                          <CardTitle className="text-lg">
                            {chapter.title}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                          {(chapter.subchapters?.length ?? 0) > 0 && (
                            <div className="space-y-4">
                              <Accordion type="multiple" className="w-full">
                                {chapter.subchapters?.map((subchapter) => (
                                  <AccordionItem
                                    key={subchapter.subchapterId}
                                    value={`overview-${subchapter.subchapterId}`}
                                    className="border-l border-b-0 pl-4"
                                  >
                                    <AccordionTrigger className="text-base font-medium hover:no-underline py-2">
                                      {subchapter.title}
                                    </AccordionTrigger>
                                    <AccordionContent>
                                      {subchapter.topics?.length > 0 && (
                                        <ul className="space-y-1 pl-2">
                                          {subchapter.topics.map(
                                            (topic, topicIndex) => (
                                              <li
                                                key={`${subchapter.title}-${topicIndex}`}
                                                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary cursor-pointer py-1.5 px-2 rounded-md hover:bg-muted/20"
                                                onClick={() => {
                                                  setSelectedSubchapter(
                                                    subchapter
                                                  );
                                                  setSelectedTopic(topic);
                                                  setCurrentTopicIndex(
                                                    topicIndex
                                                  );
                                                }}
                                              >
                                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                                                {topic.title}
                                              </li>
                                            )
                                          )}
                                        </ul>
                                      )}
                                    </AccordionContent>
                                  </AccordionItem>
                                ))}
                              </Accordion>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              {/* Course actions for teacher/admin */}
              {user &&
              ((user.role === "teacher" && course.teacherId === user.userId) ||
                user.role === "admin") ? (
                <div className="flex items-center space-x-2 mt-4">
                  <Button
                    variant={"outline"}
                    onClick={() =>
                      router.push(`/${user.role}/courses/${courseId}/edit`)
                    }
                  >
                    Редактирай курса
                  </Button>

                  <Dialog
                    open={showDeleteDialog}
                    onOpenChange={setShowDeleteDialog}
                  >
                    <DialogTrigger asChild>
                      <Button variant="destructive" className="text-white">
                        Изтрий курса
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Изтрий курса</DialogTitle>
                        <DialogDescription>
                          Сигурни ли сте, че искате да изтриете този курс? Това
                          действие не може да бъде отменено. Всички учебни
                          материали ще бъдат премахнати за постоянно.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setShowDeleteDialog(false)}
                        >
                          Отмени триенето
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleDeleteCourse}
                          disabled={deleting}
                        >
                          {deleting ? "Изтриване..." : "Изтрий курса"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
