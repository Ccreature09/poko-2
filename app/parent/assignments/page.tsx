"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { useAssignments } from "@/contexts/AssignmentContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Clock,
  AlertCircle,
  Users,
  CheckCircle,
  XCircle,
  Calendar,
  Eye,
} from "lucide-react";
import Sidebar from "@/components/functional/Sidebar";
import { db } from "@/lib/firebase";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import type { Assignment, AssignmentSubmission } from "@/lib/interfaces";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSubmissionsByStudent } from "@/lib/management/parentManagement";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  determineAssignmentStatus,
  getAssignmentStatusBadgeProps,
} from "@/lib/translations/assignmentStatusTranslations";

interface Child {
  id: string;
  name: string;
  classId?: string;
  className?: string;
}

// Helper function to determine submission status badge
const getStatusBadge = (
  assignment: Assignment,
  submission?: AssignmentSubmission
) => {
  // Determine the status using our utility function
  const status = determineAssignmentStatus(assignment, submission);

  // Get badge properties (text and styling)
  const badgeProps = getAssignmentStatusBadgeProps(status);

  return (
    <Badge variant="outline" className={badgeProps.className}>
      {badgeProps.text}
    </Badge>
  );
};

// Format deadline date in a friendly way
const formatDeadline = (timestamp: Timestamp) => {
  const date = new Date(timestamp.seconds * 1000);
  const now = new Date();
  const isPast = date < now;

  if (isPast) {
    return `Просрочено: ${format(date, "dd.MM.yyyy")}`;
  } else {
    const days = Math.ceil(
      (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days === 0) return "Днес";
    if (days === 1) return "Утре";
    if (days < 7) return `След ${days} дни`;
    return format(date, "dd.MM.yyyy");
  }
};

// Get formatted grade
const getGrade = (submission?: AssignmentSubmission) => {
  if (
    !submission ||
    submission.status !== "graded" ||
    !submission.feedback?.grade
  ) {
    return "-";
  }
  return submission.feedback.grade.toFixed(2);
};

export default function ParentAssignments() {
  const { user } = useUser();
  const {
    assignments,
    loading,
    error: assignmentError,
    submissions,
    setSelectedAssignment,
    setSelectedSubmission,
    refreshAssignments,
  } = useAssignments();

  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Define valid tab types
  type TabType = "all" | "pending" | "submitted" | "overdue";
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [childAssignments, setChildAssignments] = useState<Assignment[]>([]);
  const [childSubmissions, setChildSubmissions] = useState<
    Record<string, AssignmentSubmission>
  >({});
  const [selectedAssignmentData, setSelectedAssignmentData] =
    useState<Assignment | null>(null);
  const [selectedSubmissionData, setSelectedSubmissionData] =
    useState<AssignmentSubmission | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Fetch parent's children
  useEffect(() => {
    if (!user || user.role !== "parent" || !user.schoolId || !user.userId)
      return;

    const fetchChildren = async () => {
      try {
        // Use non-null assertion since we've checked these exist in the guard above
        const schoolId = user.schoolId!;
        const userId = user.userId!;

        // Get the parent document to access childrenIds
        const parentDoc = await getDoc(
          doc(db, "schools", schoolId, "users", userId)
        );
        if (!parentDoc.exists()) {
          console.error("Parent document not found");
          return;
        }

        const parentData = parentDoc.data();
        const childrenIds = parentData.childrenIds || [];
        const childrenList: Child[] = [];

        // Fetch details for each child
        for (const childId of childrenIds) {
          const childDoc = await getDoc(
            doc(db, "schools", schoolId, "users", childId)
          );
          if (childDoc.exists() && childDoc.data().role === "student") {
            const childData = childDoc.data();

            // Get class name if available
            let className = "";
            if (childData.homeroomClassId) {
              const classDoc = await getDoc(
                doc(
                  db,
                  "schools",
                  schoolId,
                  "classes",
                  childData.homeroomClassId
                )
              );
              if (classDoc.exists()) {
                className = classDoc.data().name || "";
              }
            }

            childrenList.push({
              id: childId,
              name: `${childData.firstName} ${childData.lastName}`,
              classId: childData.homeroomClassId,
              className: className,
            });
          }
        }

        setChildren(childrenList);
        if (childrenList.length > 0) {
          setSelectedChildId(childrenList[0].id);
        }
      } catch (error) {
        console.error("Failed to fetch children:", error);
        setError("Failed to load children information.");
      }
    };

    fetchChildren();
  }, [user]);

  // Filter assignments for the selected child when assignments or selected child changes
  useEffect(() => {
    if (!selectedChildId || !assignments || !user?.schoolId) {
      setChildAssignments([]);
      setChildSubmissions({});
      return;
    }

    const filterAssignmentsForChild = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Get the child's homeroom class
        const childDoc = await getDoc(
          doc(db, "schools", user.schoolId!, "users", selectedChildId)
        );

        if (!childDoc.exists()) {
          throw new Error("Child document not found");
        }

        const childData = childDoc.data();
        const homeroomClassId = childData.homeroomClassId;

        // Filter assignments by class or direct student assignment
        const filteredAssignments = assignments.filter((assignment) => {
          // Check if assigned directly to student
          if (
            assignment.studentIds &&
            assignment.studentIds.includes(selectedChildId)
          ) {
            return true;
          }

          // Check if assigned to student's class
          if (
            homeroomClassId &&
            assignment.classIds &&
            assignment.classIds.includes(homeroomClassId)
          ) {
            return true;
          }

          return false;
        });

        setChildAssignments(filteredAssignments);

        // Get submissions for this child (if needed)
        if (filteredAssignments.length > 0) {
          const submissionsData = await getSubmissionsByStudent(
            user.schoolId!,
            selectedChildId
          );
          setChildSubmissions(submissionsData.submissions);
        } else {
          setChildSubmissions({});
        }
      } catch (error) {
        console.error("Error filtering assignments:", error);
        setError("Failed to load assignments. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    filterAssignmentsForChild();
  }, [user, selectedChildId, assignments]);

  // Create variables for assignments in each category
  const getAssignmentsByCategory = () => {
    if (!childAssignments || childAssignments.length === 0) {
      return {
        all: [] as Assignment[],
        pending: [] as Assignment[],
        submitted: [] as Assignment[],
        overdue: [] as Assignment[],
      };
    }

    const now = new Date();

    const all = [...childAssignments];
    const pending = childAssignments.filter((a) => {
      const hasSubmission = !!childSubmissions[a.assignmentId];
      const dueDate = new Date(a.dueDate.seconds * 1000);
      return !hasSubmission && dueDate >= now;
    });
    const submitted = childAssignments.filter(
      (a) => !!childSubmissions[a.assignmentId]
    );
    const overdue = childAssignments.filter((a) => {
      const hasSubmission = !!childSubmissions[a.assignmentId];
      const dueDate = new Date(a.dueDate.seconds * 1000);
      return !hasSubmission && dueDate < now;
    });

    return {
      all,
      pending,
      submitted,
      overdue,
    } as const; // Use const assertion for strict typing
  };

  const assignmentsByCategory = getAssignmentsByCategory();

  // Function to show assignment details
  const showAssignmentDetails = (
    assignment: Assignment,
    submission?: AssignmentSubmission
  ) => {
    setSelectedAssignmentData(assignment);
    setSelectedSubmissionData(submission || null);
    // Also update the global context state
    setSelectedAssignment(assignment);
    if (submission) {
      setSelectedSubmission(submission);
    }
    setIsDetailsOpen(true);
  };

  // Refresh data when component mounts
  useEffect(() => {
    refreshAssignments();
  }, [refreshAssignments]);

  if (!user || user.role !== "parent") {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex-1 p-8 bg-gray-50 flex items-center justify-center">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <h3 className="text-lg font-medium">Достъп отказан</h3>
                <p className="text-gray-500 mt-2">
                  Само родители могат да достъпват тази страница.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const selectedChild = children.find((child) => child.id === selectedChildId);

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Sidebar />
      <div className="flex-1 p-4 md:p-8 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-2 text-gray-800">
            Задачи на детето
          </h1>
          <p className="text-gray-600 mb-6">
            Преглед и проследяване на училищните задачи на вашето дете
          </p>

          {/* Child selector */}
          {children.length > 0 ? (
            <div className="mb-6">
              <label
                htmlFor="childSelect"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Изберете дете
              </label>
              <Select
                value={selectedChildId || ""}
                onValueChange={(value) => setSelectedChildId(value)}
              >
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue placeholder="Изберете дете" />
                </SelectTrigger>
                <SelectContent>
                  {children.map((child) => (
                    <SelectItem key={child.id} value={child.id}>
                      {child.name}{" "}
                      {child.className ? `(${child.className})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-yellow-700">
                Не са намерени деца към вашия акаунт.
              </p>
            </div>
          )}

          {!selectedChildId ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-800">
                Моля, изберете дете
              </h3>
              <p className="text-gray-500 mt-2">
                Изберете дете от падащото меню, за да видите неговите задачи.
              </p>
            </div>
          ) : isLoading || loading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Зареждане на задачите...</p>
            </div>
          ) : error || assignmentError ? (
            <div className="text-center py-12">
              <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-2" />
              <p className="text-red-500">{error || assignmentError}</p>
            </div>
          ) : childAssignments.length > 0 ? (
            <>
              {/* Assignments Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-white">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-500">
                        Общо задачи
                      </p>
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold mt-2">
                      {childAssignments.length}
                    </h3>
                  </CardContent>
                </Card>

                <Card className="bg-white">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-500">
                        Предадени
                      </p>
                      <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold mt-2">
                      {Object.keys(childSubmissions).length}
                    </h3>
                  </CardContent>
                </Card>

                <Card className="bg-white">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-500">
                        Чакащи
                      </p>
                      <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-yellow-600" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold mt-2">
                      {assignmentsByCategory.pending.length}
                    </h3>
                  </CardContent>
                </Card>

                <Card className="bg-white">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-500">
                        Просрочени
                      </p>
                      <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                        <XCircle className="h-5 w-5 text-red-600" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold mt-2">
                      {assignmentsByCategory.overdue.length}
                    </h3>
                  </CardContent>
                </Card>
              </div>

              {/* Assignments Tabs */}
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle>Задачи за {selectedChild?.name}</CardTitle>
                  <CardDescription>
                    Преглед на текущи и минали задачи
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs
                    value={activeTab}
                    onValueChange={(value: string) =>
                      setActiveTab(value as TabType)
                    }
                    className="mb-4"
                  >
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="all">Всички</TabsTrigger>
                      <TabsTrigger value="pending">Чакащи</TabsTrigger>
                      <TabsTrigger value="submitted">Предадени</TabsTrigger>
                      <TabsTrigger value="overdue">Просрочени</TabsTrigger>
                    </TabsList>

                    <TabsContent value="all">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Заглавие</TableHead>
                            <TableHead>Учител</TableHead>
                            <TableHead>Предмет</TableHead>
                            <TableHead>Краен срок</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead>Оценка</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {assignmentsByCategory.all.length > 0 ? (
                            assignmentsByCategory.all
                              .sort(
                                (a: Assignment, b: Assignment) =>
                                  b.dueDate.seconds - a.dueDate.seconds
                              )
                              .map((assignment: Assignment) => {
                                const submission =
                                  childSubmissions[assignment.assignmentId];
                                return (
                                  <TableRow key={assignment.assignmentId}>
                                    <TableCell className="font-medium">
                                      {assignment.title}
                                    </TableCell>
                                    <TableCell>
                                      {assignment.teacherName}
                                    </TableCell>
                                    <TableCell>
                                      {assignment.subjectName}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center">
                                        <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                                        {formatDeadline(assignment.dueDate)}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      {getStatusBadge(assignment, submission)}
                                    </TableCell>
                                    <TableCell>
                                      {getGrade(submission)}
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() =>
                                          showAssignmentDetails(
                                            assignment,
                                            submission
                                          )
                                        }
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                          ) : (
                            <TableRow>
                              <TableCell
                                colSpan={7}
                                className="text-center py-4"
                              >
                                Не са намерени задачи в тази категория
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>

                    <TabsContent value="pending">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Заглавие</TableHead>
                            <TableHead>Учител</TableHead>
                            <TableHead>Предмет</TableHead>
                            <TableHead>Краен срок</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead>Оценка</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {assignmentsByCategory.pending.length > 0 ? (
                            assignmentsByCategory.pending
                              .sort(
                                (a: Assignment, b: Assignment) =>
                                  b.dueDate.seconds - a.dueDate.seconds
                              )
                              .map((assignment: Assignment) => {
                                const submission =
                                  childSubmissions[assignment.assignmentId];
                                return (
                                  <TableRow key={assignment.assignmentId}>
                                    <TableCell className="font-medium">
                                      {assignment.title}
                                    </TableCell>
                                    <TableCell>
                                      {assignment.teacherName}
                                    </TableCell>
                                    <TableCell>
                                      {assignment.subjectName}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center">
                                        <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                                        {formatDeadline(assignment.dueDate)}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      {getStatusBadge(assignment, submission)}
                                    </TableCell>
                                    <TableCell>
                                      {getGrade(submission)}
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() =>
                                          showAssignmentDetails(
                                            assignment,
                                            submission
                                          )
                                        }
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                          ) : (
                            <TableRow>
                              <TableCell
                                colSpan={7}
                                className="text-center py-4"
                              >
                                Не са намерени задачи в тази категория
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>

                    <TabsContent value="submitted">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Заглавие</TableHead>
                            <TableHead>Учител</TableHead>
                            <TableHead>Предмет</TableHead>
                            <TableHead>Краен срок</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead>Оценка</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {assignmentsByCategory.submitted.length > 0 ? (
                            assignmentsByCategory.submitted
                              .sort(
                                (a: Assignment, b: Assignment) =>
                                  b.dueDate.seconds - a.dueDate.seconds
                              )
                              .map((assignment: Assignment) => {
                                const submission =
                                  childSubmissions[assignment.assignmentId];
                                return (
                                  <TableRow key={assignment.assignmentId}>
                                    <TableCell className="font-medium">
                                      {assignment.title}
                                    </TableCell>
                                    <TableCell>
                                      {assignment.teacherName}
                                    </TableCell>
                                    <TableCell>
                                      {assignment.subjectName}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center">
                                        <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                                        {formatDeadline(assignment.dueDate)}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      {getStatusBadge(assignment, submission)}
                                    </TableCell>
                                    <TableCell>
                                      {getGrade(submission)}
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() =>
                                          showAssignmentDetails(
                                            assignment,
                                            submission
                                          )
                                        }
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                          ) : (
                            <TableRow>
                              <TableCell
                                colSpan={7}
                                className="text-center py-4"
                              >
                                Не са намерени задачи в тази категория
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>

                    <TabsContent value="overdue">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Заглавие</TableHead>
                            <TableHead>Учител</TableHead>
                            <TableHead>Предмет</TableHead>
                            <TableHead>Краен срок</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead>Оценка</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {assignmentsByCategory.overdue.length > 0 ? (
                            assignmentsByCategory.overdue
                              .sort(
                                (a: Assignment, b: Assignment) =>
                                  b.dueDate.seconds - a.dueDate.seconds
                              )
                              .map((assignment: Assignment) => {
                                const submission =
                                  childSubmissions[assignment.assignmentId];
                                return (
                                  <TableRow key={assignment.assignmentId}>
                                    <TableCell className="font-medium">
                                      {assignment.title}
                                    </TableCell>
                                    <TableCell>
                                      {assignment.teacherName}
                                    </TableCell>
                                    <TableCell>
                                      {assignment.subjectName}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center">
                                        <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                                        {formatDeadline(assignment.dueDate)}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      {getStatusBadge(assignment, submission)}
                                    </TableCell>
                                    <TableCell>
                                      {getGrade(submission)}
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() =>
                                          showAssignmentDetails(
                                            assignment,
                                            submission
                                          )
                                        }
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                          ) : (
                            <TableRow>
                              <TableCell
                                colSpan={7}
                                className="text-center py-4"
                              >
                                Не са намерени задачи в тази категория
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-800">
                Няма задачи за показване
              </h3>
              <p className="text-gray-500 mt-2">
                Не са намерени задачи за {selectedChild?.name}.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Assignment Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl">
          {selectedAssignmentData && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedAssignmentData.title}</DialogTitle>
                <DialogDescription className="flex justify-between items-center pt-2">
                  <span>Предмет: {selectedAssignmentData.subjectName}</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    До:{" "}
                    {format(
                      new Date(selectedAssignmentData.dueDate.seconds * 1000),
                      "PPP"
                    )}
                  </span>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {selectedAssignmentData.description && (
                  <div>
                    <h3 className="text-sm font-medium mb-1">Описание:</h3>
                    <div className="text-sm p-3 bg-gray-50 rounded-md whitespace-pre-wrap">
                      {selectedAssignmentData.description}
                    </div>
                  </div>
                )}

                <div className="border-t pt-3">
                  <h3 className="text-sm font-medium mb-2">
                    Статус на предаване:
                  </h3>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(
                      selectedAssignmentData,
                      selectedSubmissionData || undefined
                    )}
                    <span className="text-sm">
                      {selectedSubmissionData
                        ? `Предадено на ${format(
                            new Date(
                              selectedSubmissionData.submittedAt.seconds * 1000
                            ),
                            "PPP"
                          )}`
                        : "Не е предадено"}
                    </span>
                  </div>
                </div>

                {selectedSubmissionData && (
                  <>
                    <div>
                      <h3 className="text-sm font-medium mb-1">
                        Съдържание на предаденото:
                      </h3>
                      <div className="text-sm p-3 bg-gray-50 rounded-md whitespace-pre-wrap max-h-40 overflow-auto">
                        {selectedSubmissionData.content || "Няма съдържание."}
                      </div>
                    </div>

                    {selectedSubmissionData.status === "graded" &&
                      selectedSubmissionData.feedback && (
                        <div>
                          <h3 className="text-sm font-medium mb-1">
                            Обратна връзка от учителя:
                          </h3>
                          <div className="text-sm p-3 bg-blue-50 rounded-md whitespace-pre-wrap">
                            {selectedSubmissionData.feedback.comment ||
                              "Учителят не е оставил обратна връзка."}
                          </div>

                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-sm font-medium">Оценка:</span>
                            <Badge
                              variant="outline"
                              className="bg-green-50 text-green-700 border-green-200"
                            >
                              {selectedSubmissionData.feedback.grade?.toFixed(
                                2
                              ) || "Без оценка"}
                            </Badge>
                          </div>
                        </div>
                      )}
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
