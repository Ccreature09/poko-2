"use client";

import { useUser } from "@/contexts/UserContext";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import Sidebar from "@/components/functional/Sidebar";
import { useCourses } from "@/contexts/CoursesContext";
import Link from "next/link";
import { BookOpen, Users, Clock, ArrowRight, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { deleteCourse } from "@/lib/courseManagement";
import { useRouter } from "next/navigation";
import { getDocs, query, collectionGroup, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { UserBase } from "@/lib/interfaces";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Courses() {
  const { user } = useUser();
  const { courses, setCourses } = useCourses();
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
  const [teacherNames, setTeacherNames] = useState<{[key: string]: string}>({});
  const router = useRouter();

  useEffect(() => {
    const fetchTeacherNames = async () => {
      const teacherIds = [...new Set(courses.map(course => course.teacherId))];
      const teacherNamesMap: {[key: string]: string} = {};
      
      for (const teacherId of teacherIds) {
        if (teacherId) {
          const usersQuery = query(
            collectionGroup(db, "users"),
            where("userId", "==", teacherId)
          );
          
          try {
            const userSnapshot = await getDocs(usersQuery);
            if (!userSnapshot.empty) {
              const teacherDoc = userSnapshot.docs[0];
              const teacherData = teacherDoc.data() as UserBase;
              teacherNamesMap[teacherId] = `${teacherData.firstName} ${teacherData.lastName}`;
            }
          } catch (error) {
            console.error("Error fetching teacher data:", error);
          }
        }
      }
      
      setTeacherNames(teacherNamesMap);
    };

    if (courses.length > 0) {
      fetchTeacherNames();
    }
  }, [courses]);

  if (!user) return null;

  const courseColors = [
    "bg-blue-100 border-blue-300 text-blue-700",
    "bg-green-100 border-green-300 text-green-700",
    "bg-purple-100 border-purple-300 text-purple-700",
    "bg-amber-100 border-amber-300 text-amber-700",
    "bg-pink-100 border-pink-300 text-pink-700",
    "bg-cyan-100 border-cyan-300 text-cyan-700",
  ];

  const handleDeleteCourse = async (courseId: string) => {
    if (!user?.schoolId) return;
    try {
      await deleteCourse(user.schoolId, courseId);
      setCourses(courses.filter(c => c.courseId !== courseId));
      setDeletingCourseId(null);
    } catch (error) {
      console.error("Error deleting course:", error);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar className="hidden lg:block" />
      <div className="flex-1 pt-16 lg:pt-4 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto pb-12">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold">Моите курсове</h1>
          </div>
          
          {courses.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-muted/20">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Няма налични курсове</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-8">
                Все още не сте се записали в курсове или не са ви добавени курсове.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course, index) => (
                <Card key={course.courseId} className="h-full overflow-hidden hover:shadow-lg transition-all duration-300 border hover:border-primary/20">
                  <div className={`h-3 w-full ${courseColors[index % courseColors.length].split(' ')[0]}`}></div>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <Badge variant="outline" className={courseColors[index % courseColors.length]}>
                        {course.subject || "Предмет"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{course.classIds || "9"} клас</span>
                    </div>
                    <CardTitle className="mt-3 group-hover:text-primary transition-colors">
                      {course.title}
                    </CardTitle>
                  </CardHeader>
                  
                  <CardContent>
                    <p className="text-muted-foreground line-clamp-2 mb-4 h-12">
                      {course.description}
                    </p>
                    
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Прогрес</span>
                          <span className="font-medium">33%</span>
                        </div>
                        <Progress value={33} className="h-2" />
                      </div>
                      
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Users className="h-4 w-4 mr-1" />
                        <span>{teacherNames[course.teacherId] || "Преподавател"}</span>
                      </div>
                      
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Clock className="h-4 w-4 mr-1" />
                        <span>{course.chapters.length || 0} урока</span>
                      </div>
                    </div>
                  </CardContent>
                  
                  <CardFooter className="pt-0">
                    <div className="w-full flex items-center gap-2">
                      <Link href={`/courses/${course.courseId}`} className="flex-1">
                        <Button variant="ghost" size="sm" className="w-full justify-between group">
                          <span>Към курса</span>
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Button>
                      </Link>
                      
                      {(user.role === "teacher" || user.role === "admin") && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-10 px-0"
                            onClick={() => router.push(`/courses/${course.courseId}/edit`)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-10 px-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Изтриване на курс</DialogTitle>
                                <DialogDescription>
                                  Сигурни ли сте, че искате да изтриете този курс? Това действие не може да бъде отменено.
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setDeletingCourseId(null)}>
                                  Отказ
                                </Button>
                                <Button 
                                  variant="destructive" 
                                  onClick={() => handleDeleteCourse(course.courseId)}
                                  disabled={deletingCourseId === course.courseId}
                                >
                                  {deletingCourseId === course.courseId ? "Изтриване..." : "Изтрий"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
