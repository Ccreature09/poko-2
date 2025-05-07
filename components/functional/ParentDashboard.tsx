"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useUser } from "@/contexts/UserContext";
import {
  getParentChildren,
  getChildGrades,
  getAllStudentSubmissions,
  getChildQuizResults,
  getChildCheatingAttempts,
  getChildReviews,
} from "@/lib/parentManagement";
import { getSubjects } from "@/lib/subjectManagement";
import { Timestamp, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  Student,
  Grade,
  Assignment,
  AssignmentSubmission,
  Quiz,
  QuizResult,
  CheatAttempt,
  Parent,
} from "@/lib/interfaces";

type ExtendedQuiz = Quiz & {
  subjectName?: string;
  subjectId?: string;
  date?: Timestamp;
};

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import Sidebar from "./Sidebar";
import { useSearchParams } from "next/navigation";
import {
  Users,
  FileText,
  GraduationCap,
  ClipboardList,
  AlertTriangle,
  Clock as ClockIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getChildAttendance } from "@/lib/attendanceManagement";

const ParentDashboard: React.FC = () => {
  const { user, loading: userLoading, error: userError } = useUser();
  const parent = user as Parent | null;
  const searchParams = useSearchParams();

  const [children, setChildren] = useState<Student[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [isLoadingChildren, setIsLoadingChildren] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("grades");

  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjectMap, setSubjectMap] = useState<Record<string, string>>({});
  const [submittedAssignments, setSubmittedAssignments] = useState<
    Array<{
      assignment: Assignment;
      submission: AssignmentSubmission;
    }>
  >([]);
  const [quizData, setQuizData] = useState<{
    quizzes: ExtendedQuiz[];
    results: QuizResult[];
  } | null>(null);
  const [cheatingAttempts, setCheatingAttempts] = useState<
    Record<string, CheatAttempt[]>
  >({});
  const [reviewsData, setReviewsData] = useState<
    {
      reviewId: string;
      title: string;
      content: string;
      type: string;
      teacherName: string;
      date: Timestamp;
      subjectName?: string;
    }[]
  >([]);
  const [attendanceRecords, setAttendanceRecords] = useState<
    {
      attendanceId: string;
      date: Timestamp;
      periodNumber: number;
      status: string;
      subjectName?: string;
      teacherName?: string;
    }[]
  >([]);

  useEffect(() => {
    if (searchParams) {
      const tabParam = searchParams.get("tab");
      if (tabParam) {
        setActiveTab(tabParam);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (userLoading) return;
    if (
      parent &&
      parent.role === "parent" &&
      parent.schoolId &&
      parent.userId
    ) {
      setIsLoadingChildren(true);
      getParentChildren(parent.schoolId, parent.userId)
        .then((fetchedChildren) => {
          setChildren(fetchedChildren);

          if (fetchedChildren.length > 0 && fetchedChildren[0].userId) {
            setSelectedChildId(fetchedChildren[0].userId);
          }
        })
        .catch((err) => {
          console.error("Грешка при извличане на деца:", err);
          setError("Неуспешно зареждане на данните за децата.");
        })
        .finally(() => setIsLoadingChildren(false));
    } else if (!userLoading && !parent) {
      setError("Достъп отказан. Трябва да сте влезли като родител.");
      setIsLoadingChildren(false);
    }
  }, [parent, userLoading]);

  useEffect(() => {
    if (userLoading || !parent) return;
    if (selectedChildId && parent) {
      setIsLoadingData(true);
      setError(null);
      setGrades([]);
      setSubmittedAssignments([]);
      setQuizData(null);
      setCheatingAttempts({});
      setReviewsData([]);
      setAttendanceRecords([]);

      const schoolId = parent.schoolId;
      const childId = selectedChildId;

      if (!schoolId) {
        setError("Школата не е налична");
        setIsLoadingData(false);
        return;
      }

      // Fetch grades, quizzes, reviews, and attendance
      Promise.allSettled([
        getChildGrades(schoolId, childId),
        getChildQuizResults(schoolId, childId),
        getChildReviews(schoolId, childId),
        getChildAttendance(schoolId, parent.userId || "", childId),
      ])
        .then(
          async ([
            gradesResult,
            quizResult,
            reviewsResult,
            attendanceResult,
          ]) => {
            if (gradesResult.status === "fulfilled") {
              setGrades(gradesResult.value);
            } else {
              console.error(
                "Грешка при извличане на оценки:",
                gradesResult.reason
              );
              setError((prev) =>
                prev
                  ? prev + "\nНеуспешно зареждане на оценки."
                  : "Неуспешно зареждане на оценки."
              );
            }

            // Fetch only submitted assignments directly
            try {
              console.log(
                `Starting to fetch assignments for child: ${childId}`
              );
              const submissions = await getAllStudentSubmissions(
                schoolId,
                childId
              );
              console.log("Submissions fetched successfully:", submissions);

              if (submissions.length > 0) {
                console.log(`Found ${submissions.length} submissions`);

                const assignmentIds = new Set(
                  submissions.map((sub) => sub.assignmentId)
                );
                console.log(
                  `Need to fetch ${assignmentIds.size} assignment details`
                );

                // For each submission, get its parent assignment
                const assignmentPromises = Array.from(assignmentIds).map(
                  async (assignmentId) => {
                    const assignmentDoc = await getDoc(
                      doc(db, "schools", schoolId, "assignments", assignmentId)
                    );

                    if (assignmentDoc.exists()) {
                      return {
                        assignmentId,
                        data: assignmentDoc.data() as Assignment,
                      };
                    }
                    return null;
                  }
                );

                const assignmentResults = await Promise.all(assignmentPromises);
                const assignmentMap = new Map();

                assignmentResults.forEach((result) => {
                  if (result) {
                    assignmentMap.set(result.assignmentId, {
                      ...result.data,
                      assignmentId: result.assignmentId,
                    });
                  }
                });

                // Now create the combined data structure
                const submittedAssignmentsData = submissions
                  .map((submission) => {
                    const assignment = assignmentMap.get(
                      submission.assignmentId
                    );
                    if (assignment) {
                      return {
                        assignment,
                        submission: {
                          ...submission,
                          submissionId: submission.submissionId || "",
                        },
                      };
                    }
                    return null;
                  })
                  .filter((item) => item !== null);

                console.log(
                  `Created ${submittedAssignmentsData.length} submission+assignment pairs`
                );
                setSubmittedAssignments(submittedAssignmentsData);
              } else {
                console.log("No submissions found for this child");
                setSubmittedAssignments([]);
              }
            } catch (assignmentsError) {
              console.error(
                "Error fetching submitted assignments:",
                assignmentsError
              );
              setError((prev) =>
                prev
                  ? prev + "\nНеуспешно зареждане на предадени задачи."
                  : "Неуспешно зареждане на предадени задачи."
              );
            }

            if (quizResult.status === "fulfilled") {
              setQuizData(quizResult.value);

              const attemptPromises = quizResult.value.results.map((result) =>
                getChildCheatingAttempts(schoolId, result.quizId, childId)
                  .then((attempts) => ({ quizId: result.quizId, attempts }))
                  .catch((err) => {
                    console.error(
                      `Грешка при извличане на опити за преписване за тест ${result.quizId}:`,
                      err
                    );
                    return { quizId: result.quizId, attempts: [] };
                  })
              );
              Promise.all(attemptPromises).then((attemptResults) => {
                const attemptsMap: Record<string, CheatAttempt[]> = {};
                attemptResults.forEach((res) => {
                  attemptsMap[res.quizId] = res.attempts;
                });
                setCheatingAttempts(attemptsMap);
              });
            } else {
              console.error(
                "Грешка при извличане на тестове:",
                quizResult.reason
              );
              setError((prev) =>
                prev
                  ? prev + "\nНеуспешно зареждане на тестове."
                  : "Неуспешно зареждане на тестове."
              );
            }

            if (reviewsResult.status === "fulfilled") {
              setReviewsData(reviewsResult.value);
            } else {
              console.error(
                "Грешка при извличане на забележки:",
                reviewsResult.reason
              );
              setError((prev) =>
                prev
                  ? prev + "\nНеуспешно зареждане на забележки."
                  : "Неуспешно зареждане на забележки."
              );
            }

            if (attendanceResult.status === "fulfilled") {
              console.log(
                "Successfully fetched attendance records:",
                attendanceResult.value.length,
                "records found"
              );
              setAttendanceRecords(attendanceResult.value);
            } else {
              console.error(
                "Грешка при извличане на записи за присъствие:",
                attendanceResult.reason
              );
              setError((prev) =>
                prev
                  ? prev + "\nНеуспешно зареждане на записи за присъствие."
                  : "Неуспешно зареждане на записи за присъствие."
              );
            }
          }
        )
        .finally(() => setIsLoadingData(false));
    }
  }, [selectedChildId, parent, userLoading]);

  useEffect(() => {
    if (userLoading || !parent) return;
    if (parent && parent.role === "parent" && parent.schoolId) {
      // Fetch subjects to map subject IDs to names
      getSubjects(parent.schoolId)
        .then((fetchedSubjects) => {
          const mapping: Record<string, string> = {};
          fetchedSubjects.forEach((subject) => {
            mapping[subject.subjectId] = subject.name;
          });
          setSubjectMap(mapping);
        })
        .catch((err) => {
          console.error("Грешка при извличане на предмети:", err);
        });
    }
  }, [parent, userLoading]);

  const handleChildChange = (value: string) => {
    setSelectedChildId(value);
  };

  const selectedChild = children.find((c) => c.userId === selectedChildId);

  if (userLoading || isLoadingChildren) {
    return (
      <div className="flex flex-col lg:flex-row h-screen">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <div className="flex-1 p-4 sm:p-6 md:p-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-8 text-gray-800">
              Родителско табло
            </h1>
            <div className="flex justify-center items-center h-64">
              <p>Зареждане...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (userError) {
    return (
      <div className="flex flex-col lg:flex-row h-screen">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <div className="flex-1 p-4 sm:p-6 md:p-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-8 text-gray-800">
              Родителско табло
            </h1>
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
              Грешка при зареждане на потребителски данни: {userError}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!parent || parent.role !== "parent") {
    return (
      <div className="flex flex-col lg:flex-row h-screen">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <div className="flex-1 p-4 sm:p-6 md:p-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-8 text-gray-800">
              Родителско табло
            </h1>
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
              Достъп отказан. Трябва да сте влезли като родител.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="flex flex-col lg:flex-row h-screen">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <div className="flex-1 p-4 sm:p-6 md:p-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-8 text-gray-800">
              Родителско табло
            </h1>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-6">
                {error.split("\n").map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            )}

            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium">Не са намерени деца</h3>
                  <p className="text-gray-500 mt-2 mb-6">
                    Към вашия акаунт в момента няма свързани деца. Използвайте
                    бутона по-долу, за да свържете вашия акаунт с детето ви.
                  </p>
                  <div className="flex justify-center">
                    <Link href="/parent/linked-children">
                      <Button className="bg-blue-600 hover:bg-blue-700">
                        <Users className="h-4 w-4 mr-2" />
                        Свържете дете
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="flex-1 p-4 sm:p-6 md:p-8 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-8 text-gray-800">
            Родителско табло
          </h1>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-6">
              {error.split("\n").map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          )}

          {/* Child Selector */}
          {children.length > 0 && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:space-x-4 mb-6">
              <label
                htmlFor="child-select"
                className="font-medium flex items-center"
              >
                <Users className="h-5 w-5 text-blue-500 mr-2" />
                Преглед на данни за:
              </label>
              <Select
                onValueChange={handleChildChange}
                value={selectedChildId ?? ""}
              >
                <SelectTrigger
                  id="child-select"
                  className="w-full sm:w-[250px]"
                >
                  <SelectValue placeholder="Изберете дете" />
                </SelectTrigger>
                <SelectContent>
                  {children.map((child) => (
                    <SelectItem
                      key={child.userId || ""}
                      value={child.userId || ""}
                    >
                      {child.firstName} {child.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="flex flex-wrap w-full mb-6">
              <TabsTrigger
                value="grades"
                className="flex-1 px-2 h-full text-xs sm:text-sm md:text-base"
              >
                Оценки
              </TabsTrigger>
              <TabsTrigger
                value="assignments"
                className="flex-1  px-2 text-xs sm:text-sm md:text-base"
              >
                Задания
              </TabsTrigger>
              <TabsTrigger
                value="quizzes"
                className="flex-1  px-2 text-xs sm:text-sm md:text-base"
              >
                Тестове
              </TabsTrigger>
              <TabsTrigger
                value="reviews"
                className="flex-1  px-2 text-xs sm:text-sm md:text-base"
              >
                Отзиви
              </TabsTrigger>
              <TabsTrigger
                value="attendance"
                className="flex-1  px-2 text-xs sm:text-sm md:text-base"
              >
                Отсъствия
              </TabsTrigger>
            </TabsList>

            <TabsContent value="grades">
              {isLoadingData ? (
                <Card>
                  <CardContent className="flex justify-center items-center h-64">
                    <p>Зареждане на данни за детето...</p>
                  </CardContent>
                </Card>
              ) : (
                selectedChild && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center">
                        <GraduationCap className="h-5 w-5 mr-2 text-blue-500" />
                        Оценките на {selectedChild.firstName}
                      </CardTitle>
                      <CardDescription>
                        Преглед на всички оценки и академични постижения
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {grades.length > 0 ? (
                        <div className="max-w-full">
                          <ScrollArea className="h-[400px]">
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-[100px] min-w-[100px]">
                                      Предмет
                                    </TableHead>
                                    <TableHead className="min-w-[100px]">
                                      Заглавие
                                    </TableHead>
                                    <TableHead className="min-w-[80px]">
                                      Тип
                                    </TableHead>
                                    <TableHead className="min-w-[80px]">
                                      Оценка
                                    </TableHead>
                                    <TableHead className="min-w-[120px]">
                                      Дата
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {grades.map((grade) => (
                                    <TableRow key={grade.id}>
                                      <TableCell className="font-medium">
                                        {subjectMap[grade.subjectId] ||
                                          grade.subjectId}
                                      </TableCell>
                                      <TableCell>{grade.title}</TableCell>
                                      <TableCell>{grade.type}</TableCell>
                                      <TableCell>
                                        <Badge
                                          variant="outline"
                                          className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
                                        >
                                          {grade.value}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        {format(grade.date.toDate(), "PPP")}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </ScrollArea>
                        </div>
                      ) : (
                        <div className="text-center py-10">
                          <GraduationCap className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                          <h3 className="text-lg font-medium">
                            Все още няма оценки
                          </h3>
                          <p className="text-gray-500 mt-2">
                            Не са намерени оценки за {selectedChild.firstName}.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              )}
            </TabsContent>

            <TabsContent value="assignments">
              {isLoadingData ? (
                <Card>
                  <CardContent className="flex justify-center items-center h-64">
                    <p>Зареждане на данни за детето...</p>
                  </CardContent>
                </Card>
              ) : (
                selectedChild && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center">
                        <FileText className="h-5 w-5 mr-2 text-green-500" />
                        Заданията на {selectedChild.firstName}
                      </CardTitle>
                      <CardDescription>
                        Проследяване на напредъка и предаването на задания
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {submittedAssignments.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full">
                          {submittedAssignments.map(
                            ({ assignment, submission }) => (
                              <AccordionItem
                                key={assignment.assignmentId}
                                value={assignment.assignmentId}
                              >
                                <AccordionTrigger className="hover:bg-gray-50 px-4 py-3">
                                  <div className="flex items-center">
                                    <span className="font-medium">
                                      {assignment.title}
                                    </span>
                                    <Badge className="ml-2 bg-green-500">
                                      Предадена
                                    </Badge>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="space-y-3 px-2 sm:px-4 py-3">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
                                    <div>
                                      <h4 className="text-sm font-medium text-gray-500">
                                        Предмет
                                      </h4>
                                      <p className="text-sm sm:text-base">
                                        {assignment.subjectName}
                                      </p>
                                    </div>
                                    <div>
                                      <h4 className="text-sm font-medium text-gray-500">
                                        Краен срок
                                      </h4>
                                      <p className="text-sm sm:text-base">
                                        {format(
                                          assignment.dueDate.toDate(),
                                          "PPP"
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-500">
                                      Описание
                                    </h4>
                                    <p className="text-sm sm:text-base text-gray-700">
                                      {assignment.description}
                                    </p>
                                  </div>
                                  <div className="mt-3 sm:mt-4 border-t pt-3 sm:pt-4">
                                    <h4 className="font-medium mb-2">
                                      Детайли за предаване
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-2">
                                      <div>
                                        <h5 className="text-sm font-medium text-gray-500">
                                          Предадена на
                                        </h5>
                                        <p className="text-sm sm:text-base">
                                          {format(
                                            submission.submittedAt.toDate(),
                                            "Pp"
                                          )}
                                        </p>
                                      </div>
                                      <div>
                                        <h5 className="text-sm font-medium text-gray-500">
                                          Статус
                                        </h5>
                                        <p className="capitalize text-sm sm:text-base">
                                          {submission.status}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="mb-3 sm:mb-4">
                                      <h5 className="text-sm font-medium text-gray-500 mb-2">
                                        Отговор на {selectedChild.firstName}
                                      </h5>
                                      <div className="bg-gray-50 p-3 sm:p-4 rounded-md border border-gray-200 mt-1 whitespace-pre-wrap">
                                        {submission.content ? (
                                          <p className="text-sm sm:text-base text-gray-800 font-medium">
                                            {submission.content}
                                          </p>
                                        ) : (
                                          <p className="text-sm text-gray-500 italic">
                                            Не е предоставен текстов отговор
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            )
                          )}
                        </Accordion>
                      ) : (
                        <div className="text-center py-10">
                          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                          <h3 className="text-lg font-medium">
                            Все още няма предадени задания
                          </h3>
                          <p className="text-gray-500 mt-2">
                            Не са намерени предадени задания за{" "}
                            {selectedChild.firstName}.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              )}
            </TabsContent>

            <TabsContent value="quizzes">
              {isLoadingData ? (
                <Card>
                  <CardContent className="flex justify-center items-center h-64">
                    <p>Зареждане на данни за детето...</p>
                  </CardContent>
                </Card>
              ) : (
                selectedChild && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center">
                        <ClipboardList className="h-5 w-5 mr-2 text-purple-500" />
                        Тестовете на {selectedChild.firstName}
                      </CardTitle>
                      <CardDescription>
                        Преглед на резултатите от тестове и показатели за
                        представяне
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {quizData && quizData.quizzes.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full">
                          {quizData.quizzes.map((quiz) => {
                            const result = quizData.results.find(
                              (r) => r.quizId === quiz.quizId
                            );
                            const attempts =
                              cheatingAttempts[quiz.quizId] || [];

                            let statusBadge;
                            if (result) {
                              const scorePercent = Math.round(
                                (result.score / result.totalPoints) * 100
                              );
                              if (scorePercent >= 90) {
                                statusBadge = (
                                  <Badge className="ml-2 bg-green-500">
                                    Отличен {scorePercent}%
                                  </Badge>
                                );
                              } else if (scorePercent >= 70) {
                                statusBadge = (
                                  <Badge className="ml-2 bg-blue-500">
                                    Добър {scorePercent}%
                                  </Badge>
                                );
                              } else if (scorePercent >= 50) {
                                statusBadge = (
                                  <Badge className="ml-2 bg-yellow-500">
                                    Среден {scorePercent}%
                                  </Badge>
                                );
                              } else {
                                statusBadge = (
                                  <Badge className="ml-2 bg-red-500">
                                    Нуждае се от работа {scorePercent}%
                                  </Badge>
                                );
                              }
                            } else {
                              statusBadge = (
                                <Badge variant="outline" className="ml-2">
                                  Не е положен
                                </Badge>
                              );
                            }

                            // Get subject name from context
                            const subjectName =
                              quiz.subjectName ||
                              subjectMap[quiz.subjectId || ""] ||
                              "Неизвестен предмет";

                            // Get formatted date or fallback to creation date
                            const dateToShow = quiz.date
                              ? format(quiz.date.toDate(), "PPP")
                              : format(quiz.createdAt.toDate(), "PPP");

                            return (
                              <AccordionItem
                                key={quiz.quizId}
                                value={quiz.quizId}
                              >
                                <AccordionTrigger className="hover:bg-gray-50 px-2 sm:px-4 py-2 sm:py-3">
                                  <div className="flex items-center flex-wrap gap-1">
                                    <span className="font-medium text-sm sm:text-base">
                                      {quiz.title}
                                    </span>
                                    {statusBadge}
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="space-y-2 sm:space-y-3 px-2 sm:px-4 py-2 sm:py-3">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4 mb-2 sm:mb-4">
                                    <div>
                                      <h4 className="text-sm font-medium text-gray-500">
                                        Предмет
                                      </h4>
                                      <p className="text-sm sm:text-base">
                                        {subjectName}
                                      </p>
                                    </div>
                                    <div>
                                      <h4 className="text-sm font-medium text-gray-500">
                                        Дата
                                      </h4>
                                      <p className="text-sm sm:text-base">
                                        {dateToShow}
                                      </p>
                                    </div>
                                  </div>

                                  <div>
                                    <h4 className="text-sm font-medium text-gray-500">
                                      Описание
                                    </h4>
                                    <p className="text-sm sm:text-base text-gray-700">
                                      {quiz.description}
                                    </p>
                                  </div>

                                  {result ? (
                                    <div className="mt-3 sm:mt-4 border-t pt-3 sm:pt-4">
                                      <h4 className="font-medium mb-2 text-sm sm:text-base">
                                        Резултати от теста
                                      </h4>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
                                        <div>
                                          <h5 className="text-sm font-medium text-gray-500">
                                            Точки
                                          </h5>
                                          <p className="font-bold text-sm sm:text-base">
                                            {result.score} /{" "}
                                            {result.totalPoints}
                                          </p>
                                        </div>
                                        <div>
                                          <h5 className="text-sm font-medium text-gray-500">
                                            Процент верни
                                          </h5>
                                          <p className="font-bold text-sm sm:text-base">
                                            {Math.round(
                                              (result.score /
                                                result.totalPoints) *
                                                100
                                            )}
                                            %
                                          </p>
                                        </div>
                                        <div>
                                          <h5 className="text-sm font-medium text-gray-500">
                                            Приключен на
                                          </h5>
                                          <p className="text-sm sm:text-base">
                                            {format(
                                              result.timestamp.toDate(),
                                              "Pp"
                                            )}
                                          </p>
                                        </div>
                                      </div>

                                      {attempts.length > 0 && (
                                        <div className="mt-4 border-t pt-4">
                                          <h4 className="font-medium mb-2 flex items-center text-red-600">
                                            <AlertTriangle className="h-4 w-4 mr-2" />
                                            Отчетени проблеми по време на теста
                                          </h4>
                                          <div className="space-y-2">
                                            {attempts.map((attempt, index) => (
                                              <div
                                                key={index}
                                                className="bg-red-50 p-3 rounded-md border border-red-200"
                                              >
                                                <div className="flex items-start">
                                                  <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                                                  <div>
                                                    <p className="text-red-700 font-medium">
                                                      {attempt.type}
                                                    </p>
                                                    <p className="text-sm text-gray-700">
                                                      {attempt.description}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                      {format(
                                                        attempt.timestamp.toDate(),
                                                        "PPp"
                                                      )}
                                                    </p>
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center bg-gray-50 p-4 rounded-md mt-4">
                                      <div className="text-center">
                                        <p className="text-gray-700 mb-1">
                                          Тестът все още не е положен
                                        </p>
                                        <p className="text-sm text-gray-500">
                                          {selectedChild.firstName} все още не е
                                          положил(а) този тест.
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
                      ) : (
                        <div className="text-center py-10">
                          <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                          <h3 className="text-lg font-medium">
                            Все още няма тестове
                          </h3>
                          <p className="text-gray-500 mt-2">
                            Не са намерени тестове за {selectedChild.firstName}.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              )}
            </TabsContent>

            <TabsContent value="reviews">
              {isLoadingData ? (
                <Card>
                  <CardContent className="flex justify-center items-center h-64">
                    <p>Зареждане на данни за детето...</p>
                  </CardContent>
                </Card>
              ) : (
                selectedChild && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center">
                        <AlertTriangle className="h-5 w-5 mr-2 text-orange-500" />
                        Отзиви на {selectedChild.firstName}
                      </CardTitle>
                      <CardDescription>
                        Преглед на отзиви от учители
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {reviewsData && reviewsData.length > 0 ? (
                        <ScrollArea className="h-[400px]">
                          <Accordion
                            type="single"
                            collapsible
                            className="w-full"
                          >
                            {reviewsData.map((review) => (
                              <AccordionItem
                                key={review.reviewId}
                                value={review.reviewId}
                              >
                                <AccordionTrigger className="hover:bg-gray-50 px-2 sm:px-4 py-2 sm:py-3">
                                  <div className="flex items-center flex-wrap gap-1">
                                    <span className="font-medium text-sm sm:text-base">
                                      {review.title}
                                    </span>
                                    <Badge
                                      className={`ml-1 sm:ml-2 ${
                                        review.type === "positive"
                                          ? "bg-green-500"
                                          : "bg-red-500"
                                      }`}
                                    >
                                      {review.type === "positive"
                                        ? "Похвала"
                                        : "Забележка"}
                                    </Badge>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="space-y-2 sm:space-y-3 px-2 sm:px-4 py-2 sm:py-3">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4 mb-2 sm:mb-4">
                                    <div>
                                      <h4 className="text-sm font-medium text-gray-500">
                                        Учител
                                      </h4>
                                      <p className="text-sm sm:text-base">
                                        {review.teacherName}
                                      </p>
                                    </div>
                                    <div>
                                      <h4 className="text-sm font-medium text-gray-500">
                                        Дата
                                      </h4>
                                      <p className="text-sm sm:text-base">
                                        {format(review.date.toDate(), "PPP")}
                                      </p>
                                    </div>
                                    {review.subjectName && (
                                      <div>
                                        <h4 className="text-sm font-medium text-gray-500">
                                          Предмет
                                        </h4>
                                        <p className="text-sm sm:text-base">
                                          {review.subjectName}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-500">
                                      Съдържание
                                    </h4>
                                    <p className="text-sm sm:text-base text-gray-700 whitespace-pre-wrap">
                                      {review.content}
                                    </p>
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                        </ScrollArea>
                      ) : (
                        <div className="text-center py-10">
                          <AlertTriangle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                          <h3 className="text-lg font-medium">Няма отзиви</h3>
                          <p className="text-gray-500 mt-2">
                            Няма отзиви за {selectedChild.firstName}.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              )}
            </TabsContent>

            <TabsContent value="attendance">
              {isLoadingData ? (
                <Card>
                  <CardContent className="flex justify-center items-center h-64">
                    <p>Зареждане на данни за детето...</p>
                  </CardContent>
                </Card>
              ) : (
                selectedChild && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center">
                        <ClockIcon className="h-5 w-5 mr-2 text-blue-500" />
                        Присъствие на {selectedChild.firstName}
                      </CardTitle>
                      <CardDescription>
                        Преглед на записи за присъствие
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {attendanceRecords && attendanceRecords.length > 0 ? (
                        <div className="space-y-6">
                          {/* Summary stats */}
                          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200 flex flex-col items-center">
                              <span className="text-gray-500 text-xs sm:text-sm mb-1">
                                Общо записи
                              </span>
                              <span className="text-xl sm:text-2xl font-bold">
                                {attendanceRecords.length}
                              </span>
                            </div>
                            <div className="bg-white p-3 sm:p-4 rounded-lg border border-red-200 flex flex-col items-center">
                              <span className="text-gray-500 text-xs sm:text-sm mb-1">
                                Отсъствия
                              </span>
                              <span className="text-xl sm:text-2xl font-bold text-red-500">
                                {
                                  attendanceRecords.filter(
                                    (r) => r.status === "absent"
                                  ).length
                                }
                              </span>
                            </div>
                            <div className="bg-white p-3 sm:p-4 rounded-lg border border-yellow-200 flex flex-col items-center">
                              <span className="text-gray-500 text-xs sm:text-sm mb-1">
                                Закъснения
                              </span>
                              <span className="text-xl sm:text-2xl font-bold text-yellow-500">
                                {
                                  attendanceRecords.filter(
                                    (r) => r.status === "late"
                                  ).length
                                }
                              </span>
                            </div>
                            <div className="bg-white p-3 sm:p-4 rounded-lg border border-blue-200 flex flex-col items-center">
                              <span className="text-gray-500 text-xs sm:text-sm mb-1">
                                Извинени
                              </span>
                              <span className="text-xl sm:text-2xl font-bold text-blue-500">
                                {
                                  attendanceRecords.filter(
                                    (r) => r.status === "excused"
                                  ).length
                                }
                              </span>
                            </div>
                          </div>

                          {/* List of attendance records */}
                          <div className="max-w-full">
                            <ScrollArea className="h-[350px]">
                              <div className="overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="min-w-[120px]">
                                        Дата
                                      </TableHead>
                                      <TableHead className="min-w-[100px]">
                                        Предмет
                                      </TableHead>
                                      <TableHead className="min-w-[80px]">
                                        Статус
                                      </TableHead>
                                      <TableHead className="min-w-[100px]">
                                        Учител
                                      </TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {attendanceRecords.map((record) => (
                                      <TableRow key={record.attendanceId}>
                                        <TableCell className="font-medium">
                                          <div className="text-sm sm:text-base">
                                            {format(
                                              record.date.toDate(),
                                              "PPP"
                                            )}
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            Час: {record.periodNumber}
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-sm sm:text-base">
                                          {record.subjectName}
                                        </TableCell>
                                        <TableCell>
                                          {record.status === "absent" && (
                                            <Badge
                                              variant="outline"
                                              className="bg-red-50 text-red-700 border-red-200 text-xs sm:text-sm whitespace-nowrap"
                                            >
                                              Отсъства
                                            </Badge>
                                          )}
                                          {record.status === "late" && (
                                            <Badge
                                              variant="outline"
                                              className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs sm:text-sm whitespace-nowrap"
                                            >
                                              Закъснява
                                            </Badge>
                                          )}
                                          {record.status === "excused" && (
                                            <Badge
                                              variant="outline"
                                              className="bg-blue-50 text-blue-700 border-blue-200 text-xs sm:text-sm whitespace-nowrap"
                                            >
                                              Извинен
                                            </Badge>
                                          )}
                                          {record.status === "present" && (
                                            <Badge
                                              variant="outline"
                                              className="bg-green-50 text-green-700 border-green-200 text-xs sm:text-sm whitespace-nowrap"
                                            >
                                              Присъства
                                            </Badge>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-sm sm:text-base">
                                          {record.teacherName}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </ScrollArea>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-10">
                          <ClockIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                          <h3 className="text-lg font-medium">
                            Няма записи за присъствие
                          </h3>
                          <p className="text-gray-500 mt-2">
                            Няма записи за присъствие за{" "}
                            {selectedChild.firstName}.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default ParentDashboard;
