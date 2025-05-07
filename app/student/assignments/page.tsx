"use client";

import { useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { useAssignments } from "@/contexts/AssignmentContext";
import { format } from "date-fns";
import type { Assignment } from "@/lib/interfaces";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Sidebar from "@/components/functional/Sidebar";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Plus,
  FileText,
  Users,
  FileCheck,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function Assignments() {
  const { user } = useUser();
  const { toast } = useToast();
  const {
    activeAssignments,
    pastAssignments,
    loading,
    deleteExistingAssignment,
    fetchStudentSubmission,
    getAssignmentDeadlineStatus,
  } = useAssignments();

  const [deletingAssignmentId, setDeletingAssignmentId] = useState<
    string | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Function to calculate remaining time until deadline
  const getTimeRemaining = (dueDate: Date) => {
    const now = new Date();
    const diffTime = Math.abs(dueDate.getTime() - now.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(
      (diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );

    if (diffDays > 0) {
      return `${diffDays} day${diffDays !== 1 ? "s" : ""} left`;
    } else {
      return `${diffHours} hour${diffHours !== 1 ? "s" : ""} left`;
    }
  };

  // Handle assignment deletion
  const handleDeleteAssignment = async () => {
    if (!user?.schoolId || !deletingAssignmentId) return;

    try {
      setIsDeleting(true);
      await deleteExistingAssignment(deletingAssignmentId);

      toast({
        title: "Success",
        description: "Assignment deleted successfully",
      });

      setDeletingAssignmentId(null);
    } catch (error) {
      console.error("Error deleting assignment:", error);
      toast({
        title: "Error",
        description: "Failed to delete assignment",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Render an assignment card
  const renderAssignmentCard = (assignment: Assignment, isPast: boolean) => {
    const dueDate = new Date(assignment.dueDate.seconds * 1000);
    const deadlineStatus = getAssignmentDeadlineStatus(assignment);
    const isSubmissionDeadline = deadlineStatus === "due-soon";

    return (
      <Card
        key={assignment.assignmentId}
        className={`${isSubmissionDeadline ? "border-orange-200" : ""}`}
      >
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{assignment.title}</span>
            {isSubmissionDeadline && (
              <Badge
                variant="outline"
                className="ml-2 bg-orange-50 text-orange-700 border-orange-200"
              >
                Наближава краен срок
              </Badge>
            )}
            {deadlineStatus === "submitted" && (
              <Badge
                variant="outline"
                className="ml-2 bg-green-50 text-green-700 border-green-200"
              >
                Предадено
              </Badge>
            )}
            {deadlineStatus === "graded" && (
              <Badge
                variant="outline"
                className="ml-2 bg-blue-50 text-blue-700 border-blue-200"
              >
                Оценено
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Предмет: {assignment.subjectName}</CardDescription>
        </CardHeader>

        <CardContent>
          <p className="text-sm mb-4 text-gray-600 line-clamp-2">
            {assignment.description}
          </p>

          <div className="flex items-center text-sm text-gray-500 mb-2">
            <Calendar className="h-4 w-4 mr-2" />
            <span>Краен срок: {format(dueDate, "MMMM d, yyyy")}</span>
          </div>

          {!isPast &&
            deadlineStatus !== "submitted" &&
            deadlineStatus !== "graded" && (
              <div className="flex items-center text-sm text-gray-500">
                <Clock className="h-4 w-4 mr-2" />
                <span>{getTimeRemaining(dueDate)}</span>
              </div>
            )}

          {user?.role === "teacher" && (
            <div className="flex items-center text-sm text-gray-500 mt-2">
              <Users className="h-4 w-4 mr-2" />
              <span>
                {assignment.classIds && assignment.classIds.length > 0
                  ? `${assignment.classIds.length} ${
                      assignment.classIds.length === 1 ? "клас" : "класа"
                    }`
                  : "Избрани ученици"}
              </span>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-2">
          <div className="flex text-xs text-gray-500">
            {user?.role === "teacher" ? (
              <span>Създадено от вас</span>
            ) : (
              <span>Създадено от {assignment.teacherName}</span>
            )}
          </div>

          <div className="flex gap-2 w-full">
            <Link
              href={`${
                user?.role === "teacher"
                  ? "/teacher"
                  : user?.role === "student"
                  ? "/student"
                  : ""
              }/assignments/${assignment.assignmentId}`}
              className="flex-1"
            >
              <Button
                variant={isPast ? "outline" : "ghost"}
                className="w-full text-foreground"
              >
                <>
                  {isPast ||
                  deadlineStatus === "submitted" ||
                  deadlineStatus === "graded" ? (
                    <FileCheck className="h-4 w-4 mr-2" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  {isPast ||
                  deadlineStatus === "submitted" ||
                  deadlineStatus === "graded"
                    ? "Преглед"
                    : user?.role === "teacher"
                    ? "Провери"
                    : "Предай"}
                </>
              </Button>
            </Link>

            {(user?.role === "teacher" || user?.role === "admin") && (
              <>
                <Link
                  href={`/teacher/assignments/${assignment.assignmentId}/edit`}
                >
                  <Button variant="ghost" size="icon" className="w-10 px-0">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </Link>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-10 px-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Изтриване на задание</DialogTitle>
                      <DialogDescription>
                        Сигурни ли сте, че искате да изтриете това задание? Това
                        действие не може да бъде отменено.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setDeletingAssignmentId(null)}
                      >
                        Отказ
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          setDeletingAssignmentId(assignment.assignmentId);
                          handleDeleteAssignment();
                        }}
                        disabled={isDeleting}
                      >
                        {isDeleting &&
                        deletingAssignmentId === assignment.assignmentId
                          ? "Изтриване..."
                          : "Изтрий"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </CardFooter>
      </Card>
    );
  };

  // If user is not logged in
  if (!user) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 p-8">
          <Card>
            <CardContent className="pt-6">
              <p>Please log in to view assignments.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800">Задания</h1>

            {user.role === "teacher" && (
              <Link href="/teacher/assignments/create">
                <Button
                  variant={"outline"}
                  className="flex items-center gap-2 text-foreground"
                >
                  <Plus className="h-4 w-4" />
                  Създаване на задание
                </Button>
              </Link>
            )}
          </div>

          <Tabs defaultValue="active" className="space-y-4">
            <TabsList>
              <TabsTrigger value="active">Активни Задания</TabsTrigger>
              <TabsTrigger value="past">Минали Задания</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4">
              {loading ? (
                <div className="text-center py-8">
                  <p>Зареждане на Задания...</p>
                </div>
              ) : activeAssignments.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 pb-6 text-center">
                    <div className="flex flex-col items-center space-y-3">
                      <FileText className="h-12 w-12 text-gray-300" />
                      <h3 className="text-lg font-medium">
                        Няма активни Задания
                      </h3>
                      {user.role === "teacher" ? (
                        <p className="text-gray-500 mb-4">
                          Все още не сте създали активни Задания.
                        </p>
                      ) : (
                        <p className="text-gray-500 mb-4">
                          Нямате активни Задания в момента.
                        </p>
                      )}

                      {user.role === "teacher" && (
                        <Link href="/teacher/assignments/create">
                          <Button
                            variant={"outline"}
                            className="text-foreground"
                          >
                            Създай задание
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeAssignments.map((assignment) =>
                    renderAssignmentCard(assignment, false)
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="past" className="space-y-4">
              {loading ? (
                <div className="text-center py-8">
                  <p>Зареждане на минали Задания...</p>
                </div>
              ) : pastAssignments.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 pb-6 text-center">
                    <div className="flex flex-col items-center space-y-3">
                      <FileText className="h-12 w-12 text-gray-300" />
                      <h3 className="text-lg font-medium">
                        Няма минали Задания
                      </h3>
                      <p className="text-gray-500">Нямате минали Задания.</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pastAssignments.map((assignment) =>
                    renderAssignmentCard(assignment, true)
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
