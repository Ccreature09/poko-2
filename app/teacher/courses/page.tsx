"use client";

import { useUser } from "@/contexts/UserContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import Sidebar from "@/components/functional/layout/Sidebar";
import { useCourses } from "@/contexts/CoursesContext";
import Link from "next/link";
import {
  BookOpen,
  Users,
  Calendar,
  ArrowRight,
  PlusCircle,
  Edit,
  Trash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function TeacherCourses() {
  const { user } = useUser();
  const { courses } = useCourses();
  const router = useRouter();
  const [courseToDelete, setCourseToDelete] = useState<string | null>(null);

  // Redirect if user is not a teacher
  useEffect(() => {
    if (user && user.role !== "teacher") {
      router.push("/dashboard");
    }
  }, [user, router]);

  const handleDeleteCourse = async () => {
    if (!courseToDelete || !user?.schoolId) return;

    try {
      await deleteDoc(
        doc(db, "schools", user.schoolId, "courses", courseToDelete)
      );
      setCourseToDelete(null);
      // The CoursesContext will handle refreshing the courses list
    } catch (error) {
      console.error("Error deleting course:", error);
    }
  };

  if (!user || user.role !== "teacher") return null;

  // Filter courses for this teacher
  const teacherCourses = courses.filter(
    (course) => course.teacherId === user.userId
  );

  const courseColors = [
    "bg-blue-100 border-blue-300 text-blue-700",
    "bg-green-100 border-green-300 text-green-700",
    "bg-purple-100 border-purple-300 text-purple-700",
    "bg-amber-100 border-amber-300 text-amber-700",
    "bg-pink-100 border-pink-300 text-pink-700",
    "bg-cyan-100 border-cyan-300 text-cyan-700",
  ];

  return (
    <div className="flex min-h-screen">
      <Sidebar className="hidden lg:block" />
      <div className="flex-1 pt-16 lg:pt-4 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto pb-12">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold mb-4 sm:mb-0">
              Моите курсове
            </h1>
            <Link href="/teacher/courses/create" className="inline-block">
              <Button className="flex text-white items-center gap-2">
                <PlusCircle className="h-4 w-4" />
                <span>Създаване на курс</span>
              </Button>
            </Link>
          </div>

          {teacherCourses.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-muted/20">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                Нямате създадени курсове
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-8">
                Все още не сте създали курсове. Натиснете бутона &quot;Създаване
                на курс&quot;, за да създадете нов курс за вашите ученици.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teacherCourses.map((course, index) => (
                <Card
                  key={course.courseId}
                  className="h-full overflow-hidden hover:shadow-lg transition-all duration-300 border hover:border-primary/20"
                >
                  <div
                    className={`h-3 w-full ${
                      courseColors[index % courseColors.length].split(" ")[0]
                    }`}
                  ></div>
                  <CardHeader className="pb-2 space-y-2">
                    <div className="flex justify-between items-start my-2">
                      <Badge
                        variant="outline"
                        className={courseColors[index % courseColors.length]}
                      >
                        {course.subject || "Предмет"}
                      </Badge>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 ml-1"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle cx="12" cy="12" r="1" />
                              <circle cx="12" cy="5" r="1" />
                              <circle cx="12" cy="19" r="1" />
                            </svg>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/teacher/courses/${course.courseId}/edit`}
                            >
                              <div className="flex items-center">
                                <Edit className="mr-2 h-4 w-4" />
                                <span>Редактиране</span>
                              </div>
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setCourseToDelete(course.courseId)}
                          >
                            <Trash className="mr-2 h-4 w-4" />
                            <span>Изтриване</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <CardTitle className="mt-2 group-hover:text-primary transition-colors">
                      {course.title}
                    </CardTitle>
                  </CardHeader>

                  <CardContent>
                    <p className="text-muted-foreground line-clamp-2 mb-4 h-12">
                      {course.description}
                    </p>

                    <div className="space-y-4">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Users className="h-4 w-4 mr-1" />
                        <span>
                          {course.classIds && course.classIds.length > 0
                            ? `${course.classIds.length} клас${
                                course.classIds.length > 1 ? "а" : ""
                              }`
                            : "Няма избрани класове"}
                        </span>
                      </div>

                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 mr-1" />
                        <span>
                          {course.chapters?.length || 0} глав
                          {course.chapters?.length !== 1 ? "и" : "а"}
                        </span>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="pt-0">
                    <div className="w-full">
                      <Link
                        href={`/teacher/courses/${course.courseId}`}
                        className="block w-full"
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-between group"
                        >
                          <span>Към курса</span>
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Button>
                      </Link>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <AlertDialog
        open={!!courseToDelete}
        onOpenChange={(open: boolean) => !open && setCourseToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Сигурни ли сте?</AlertDialogTitle>
            <AlertDialogDescription>
              Това действие не може да бъде отменено. Курсът и всичките му
              материали ще бъдат изтрити.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отказ</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCourse}
              className="bg-destructive text-destructive-foreground"
            >
              Изтриване
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
