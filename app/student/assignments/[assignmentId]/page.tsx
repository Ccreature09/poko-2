"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { useUser } from "@/contexts/UserContext";
import { useAssignments } from "@/contexts/AssignmentContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import Sidebar from "@/components/functional/layout/Sidebar";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  CheckCircle,
  XCircle,
  FileCheck,
  Clock,
  ArrowLeft,
} from "lucide-react";

export default function AssignmentDetail() {
  const { user } = useUser();
  const router = useRouter();
  const params = useParams<{ assignmentId: string }>();
  const assignmentId = params?.assignmentId;
  const { toast } = useToast();

  const {
    selectedAssignment,
    setSelectedAssignment,
    selectedSubmission,
    setSelectedSubmission,
    loading,
    fetchAssignmentById,
    fetchStudentSubmission,
    submitStudentAssignment,
    getAssignmentDeadlineStatus,
    canSubmit,
    canResubmit,
  } = useAssignments();

  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fetch the assignment and submission when the component mounts
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.schoolId || !assignmentId) return;

      try {
        // Fetch assignment details
        const assignment = await fetchAssignmentById(assignmentId as string);

        if (!assignment) {
          toast({
            title: "Грешка",
            description: "Заданието не беше намерено",
            variant: "destructive",
          });
          router.push("/student/assignments");
          return;
        }

        setSelectedAssignment(assignment);

        // If user is a student, fetch their submission
        if (user.role === "student" && user.userId) {
          const submission = await fetchStudentSubmission(
            assignmentId as string,
            user.userId
          );

          if (submission) {
            setSelectedSubmission(submission);
            setContent(submission.content);
          }
        }
      } catch (error) {
        console.error("Error fetching assignment:", error);
        toast({
          title: "Грешка",
          description: "Неуспешно зареждане на детайлите за заданието",
          variant: "destructive",
        });
      }
    };

    fetchData();
  }, [
    assignmentId,
    user,
    fetchAssignmentById,
    fetchStudentSubmission,
    setSelectedAssignment,
    setSelectedSubmission,
    router,
    toast,
  ]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  const handleSubmit = async () => {
    if (
      !user?.schoolId ||
      !user?.userId ||
      !assignmentId ||
      !selectedAssignment
    )
      return;

    if (!content.trim()) {
      toast({
        title: "Грешка",
        description: "Моля, въведете съдържание за вашето предаване",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      const isResubmission = selectedSubmission !== null;
      const updatedSubmission = await submitStudentAssignment(
        assignmentId as string,
        content,
        isResubmission
      );

      if (updatedSubmission) {
        setSelectedSubmission(updatedSubmission);
      }

      toast({
        title: "Успешно",
        description: "Заданието е предадено успешно",
      });
    } catch (error: unknown) {
      console.error("Error submitting assignment:", error);
      toast({
        title: "Грешка",
        description:
          error instanceof Error
            ? error.message
            : "Неуспешно предаване на заданието",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Helper function to check if the assignment is past due date
  const isAssignmentPast = selectedAssignment?.dueDate
    ? new Date(selectedAssignment.dueDate.seconds * 1000) < new Date()
    : false;

  if (!user) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 p-8">
          <Card>
            <CardContent className="pt-6">
              <p>Моля, влезте в профила си, за да видите това задание.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 p-8">
          <div className="max-w-5xl mx-auto">
            <Card>
              <CardContent className="pt-6 text-center">
                <p>Зареждане на детайли за заданието...</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedAssignment) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 p-8">
          <div className="max-w-5xl mx-auto">
            <Card>
              <CardContent className="pt-6 text-center">
                <p>Заданието не беше намерено.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const dueDate = new Date(selectedAssignment.dueDate.seconds * 1000);
  const deadlineStatus = getAssignmentDeadlineStatus(selectedAssignment);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад
            </Button>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-800">
                  {selectedAssignment.title}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge className="mr-2 bg-blue-50 text-blue-600 border-blue-200">
                    {selectedAssignment.subjectName}
                  </Badge>

                  {isAssignmentPast ? (
                    <Badge
                      variant="outline"
                      className="bg-gray-50 text-gray-600 border-gray-200"
                    >
                      Затворена
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-green-50 text-green-600 border-green-200"
                    >
                      Активна
                    </Badge>
                  )}

                  {deadlineStatus === "submitted" && (
                    <Badge
                      variant="outline"
                      className="bg-green-50 text-green-700 border-green-200"
                    >
                      Предадено
                    </Badge>
                  )}

                  {deadlineStatus === "graded" && (
                    <Badge
                      variant="outline"
                      className="bg-blue-50 text-blue-700 border-blue-200"
                    >
                      Оценено
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Assignment details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Описание</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose max-w-none">
                    {selectedAssignment.description ? (
                      <p className="whitespace-pre-wrap text-gray-700">
                        {selectedAssignment.description}
                      </p>
                    ) : (
                      <p className="text-gray-500 italic">
                        Няма предоставено описание
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Student Submission Section */}
              {user.role === "student" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Вашето Предаване</CardTitle>
                    {selectedSubmission ? (
                      <CardDescription>
                        Предадено на{" "}
                        {format(
                          new Date(
                            selectedSubmission.submittedAt.seconds * 1000
                          ),
                          "MMMM d, yyyy 'в' h:mm a"
                        )}
                        {selectedSubmission.status === "late" && (
                          <span className="text-orange-500 ml-2">
                            (Закъсняло предаване)
                          </span>
                        )}
                        {selectedSubmission.status === "resubmitted" && (
                          <span className="text-blue-500 ml-2">
                            (Повторно предаване)
                          </span>
                        )}
                      </CardDescription>
                    ) : (
                      <CardDescription>
                        {canSubmit(selectedAssignment)
                          ? "Все още не сте предали това задание"
                          : "Крайният срок за това задание е изтекло"}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {selectedSubmission &&
                    selectedSubmission.status === "graded" &&
                    selectedSubmission.feedback ? (
                      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                        <h4 className="font-medium mb-2 flex items-center">
                          <FileCheck className="h-4 w-4 mr-2 text-blue-500" />
                          Обратна Връзка от Учителя
                        </h4>
                        <p className="text-sm mb-3">
                          {selectedSubmission.feedback.comment}
                        </p>
                        {selectedSubmission.feedback.grade !== undefined && (
                          <div className="flex items-center">
                            <span className="text-sm font-medium mr-2">
                              Оценка:
                            </span>
                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200">
                              {selectedSubmission.feedback.grade}
                            </Badge>
                          </div>
                        )}
                      </div>
                    ) : null}

                    <Textarea
                      placeholder="Въведете вашето решение тук..."
                      className="min-h-[200px] mb-4"
                      value={content}
                      onChange={handleContentChange}
                      disabled={
                        submitting ||
                        (!canSubmit(selectedAssignment) &&
                          !selectedSubmission) ||
                        (selectedSubmission &&
                          !canResubmit(
                            selectedAssignment,
                            selectedSubmission
                          )) ||
                        selectedSubmission?.status === "graded"
                      }
                    />

                    {(!selectedSubmission ||
                      canResubmit(selectedAssignment, selectedSubmission)) &&
                      !selectedSubmission?.status?.includes("graded") && (
                        <div className="flex justify-end">
                          {isAssignmentPast &&
                          !selectedAssignment.allowLateSubmission ? (
                            <p className="text-red-500 text-sm">
                              Крайният срок за това задание е изтекло
                            </p>
                          ) : (
                            <Button
                              variant={"outline"}
                              onClick={handleSubmit}
                              disabled={submitting || content.trim() === ""}
                            >
                              {submitting
                                ? "Предаване..."
                                : selectedSubmission
                                ? "Повторно Предаване"
                                : "Предай Заданието"}
                            </Button>
                          )}
                        </div>
                      )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar with assignment info */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Детайли</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Краен Срок</p>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-5 w-5 text-gray-400" />
                      <span className="font-medium">
                        {format(dueDate, "d MMMM yyyy")}
                      </span>
                    </div>
                    {!isAssignmentPast && (
                      <div className="flex items-center space-x-2 mt-1">
                        <Clock className="h-5 w-5 text-gray-400" />
                        <span className="text-sm">
                          {format(dueDate, "HH:mm")} часа
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-sm text-gray-500 mb-1">Учител</p>
                    <p className="font-medium">
                      {selectedAssignment.teacherName}
                    </p>
                  </div>

                  {selectedAssignment.classIds &&
                    selectedAssignment.classIds.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">
                          Възложено за Класове
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {selectedAssignment.classIds.map((classId) => (
                            <Badge
                              key={classId}
                              variant="outline"
                              className="bg-gray-50"
                            >
                              {classId}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                  <div>
                    <p className="text-sm text-gray-500 mb-1">
                      Настройки за Предаване
                    </p>
                    <div className="flex flex-col space-y-2 mt-1">
                      <div className="flex items-start">
                        {selectedAssignment.allowLateSubmission ? (
                          <CheckCircle className="h-4 w-4 mr-2 text-green-500 mt-0.5" />
                        ) : (
                          <XCircle className="h-4 w-4 mr-2 text-red-500 mt-0.5" />
                        )}
                        <span className="text-sm">
                          Закъснели предавания{" "}
                          {selectedAssignment.allowLateSubmission
                            ? "разрешени"
                            : "не са разрешени"}
                        </span>
                      </div>

                      <div className="flex items-start">
                        {selectedAssignment.allowResubmission ? (
                          <CheckCircle className="h-4 w-4 mr-2 text-green-500 mt-0.5" />
                        ) : (
                          <XCircle className="h-4 w-4 mr-2 text-red-500 mt-0.5" />
                        )}
                        <span className="text-sm">
                          Повторни предавания{" "}
                          {selectedAssignment.allowResubmission
                            ? "разрешени"
                            : "не са разрешени"}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
