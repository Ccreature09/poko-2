'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { 
  getParentChildren, 
  getChildGrades, 
  getChildAssignments, 
  getChildQuizResults, 
  getChildCheatingAttempts, 
  getChildReviews 
} from '@/lib/parentManagement';
import { getChildAttendance, generateAttendanceReport } from '@/lib/attendanceManagement';
import { getSubjects } from '@/lib/subjectManagement';
import { Timestamp } from 'firebase/firestore';
import type { 
  Student, 
  Grade, 
  Assignment, 
  AssignmentSubmission, 
  Quiz, 
  QuizResult, 
  CheatAttempt, 
  Parent, 
  Subject, 
  StudentReview, 
  AttendanceRecord, 
  AttendanceReport 
} from '@/lib/interfaces';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import Sidebar from './Sidebar';
import { useSearchParams } from 'next/navigation';
import { 
  Users, 
  FileText, 
  GraduationCap, 
  ClipboardList, 
  AlertTriangle, 
  MessageSquare, 
  ThumbsUp, 
  ThumbsDown, 
  User, 
  Clock, 
  Check
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceReport, setAttendanceReport] = useState<AttendanceReport | null>(null);

  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectMap, setSubjectMap] = useState<Record<string, string>>({});
  const [assignmentsData, setAssignmentsData] = useState<{ assignments: Assignment[], submissions: Record<string, AssignmentSubmission> } | null>(null);
  const [quizData, setQuizData] = useState<{ quizzes: Quiz[], results: QuizResult[] } | null>(null);
  const [cheatingAttempts, setCheatingAttempts] = useState<Record<string, CheatAttempt[]>>({});
  const [studentReviews, setStudentReviews] = useState<StudentReview[]>([]);

  const [stats, setStats] = useState([
    { title: "Моите деца", value: 0, icon: Users },
    { title: "Задачи", value: 0, icon: FileText },
    { title: "Тестове", value: 0, icon: ClipboardList },
  ]);

  useEffect(() => {
    if (searchParams) {
      const tabParam = searchParams.get('tab');
      if (tabParam) {
        setActiveTab(tabParam);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (userLoading) return;
    if (parent && parent.role === 'parent') {
      setIsLoadingChildren(true);
      getParentChildren(parent.schoolId, parent.userId)
        .then(fetchedChildren => {
          setChildren(fetchedChildren);
          
          // Update the stats
          setStats(prev => [
            { ...prev[0], value: fetchedChildren.length },
            ...prev.slice(1)
          ]);
          
          if (fetchedChildren.length > 0) {
            setSelectedChildId(fetchedChildren[0].userId);
          } else {
            setError("Към този акаунт няма свързани деца.");
          }
        })
        .catch(err => {
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
      setAssignmentsData(null);
      setQuizData(null);
      setCheatingAttempts({});

      const schoolId = parent.schoolId;
      const childId = selectedChildId;

      Promise.allSettled([
        getChildGrades(schoolId, childId),
        getChildAssignments(schoolId, childId),
        getChildQuizResults(schoolId, childId),
        getChildReviews(schoolId, childId)
      ]).then(([gradesResult, assignmentsResult, quizResult, reviewsResult]) => {

        if (gradesResult.status === 'fulfilled') {
          setGrades(gradesResult.value);
        } else {
          console.error("Грешка при извличане на оценки:", gradesResult.reason);
          setError(prev => prev ? prev + "\nНеуспешно зареждане на оценки." : "Неуспешно зареждане на оценки.");
        }

        if (assignmentsResult.status === 'fulfilled') {
          setAssignmentsData(assignmentsResult.value);
          
          // Update assignments stats
          setStats(prev => [
            prev[0],
            { ...prev[1], value: assignmentsResult.value.assignments.length },
            ...prev.slice(2)
          ]);
        } else {
          console.error("Грешка при извличане на задачи:", assignmentsResult.reason);
          setError(prev => prev ? prev + "\nНеуспешно зареждане на задачи." : "Неуспешно зареждане на задачи.");
        }

        if (quizResult.status === 'fulfilled') {
          setQuizData(quizResult.value);
          
          // Update quiz stats
          setStats(prev => [
            prev[0],
            prev[1],
            { ...prev[2], value: quizResult.value.quizzes.length },
          ]);
          
          const attemptPromises = quizResult.value.results.map(result =>
            getChildCheatingAttempts(schoolId, result.quizId, childId)
              .then(attempts => ({ quizId: result.quizId, attempts }))
              .catch(err => {
                  console.error(`Грешка при извличане на опити за преписване за тест ${result.quizId}:`, err);
                  return { quizId: result.quizId, attempts: [] };
              })
          );
          Promise.all(attemptPromises).then(attemptResults => {
            const attemptsMap: Record<string, CheatAttempt[]> = {};
            attemptResults.forEach(res => {
              attemptsMap[res.quizId] = res.attempts;
            });
            setCheatingAttempts(attemptsMap);
          });
        } else {
          console.error("Грешка при извличане на тестове:", quizResult.reason);
          setError(prev => prev ? prev + "\nНеуспешно зареждане на тестове." : "Неуспешно зареждане на тестове.");
        }

        if (reviewsResult.status === 'fulfilled') {
          setStudentReviews(reviewsResult.value);
        } else {
          console.error("Грешка при извличане на забележки:", reviewsResult.reason);
          setError(prev => prev ? prev + "\nНеуспешно зареждане на забележки." : "Неуспешно зареждане на забележки.");
        }

      }).finally(() => setIsLoadingData(false));
    }
  }, [selectedChildId, parent, userLoading]);

  useEffect(() => {
    if (userLoading || !parent) return;
    if (selectedChildId && parent && activeTab === "attendance") {
      setIsLoadingData(true);
      
      // Get a date 30 days ago for default view
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDate = Timestamp.fromDate(thirtyDaysAgo);
      
      getChildAttendance(parent.schoolId, parent.userId, selectedChildId, startDate)
        .then((records: AttendanceRecord[]) => {
          setAttendanceRecords(records);
          
          // Generate attendance report
          return generateAttendanceReport(parent.schoolId, selectedChildId, startDate, Timestamp.now());
        })
        .then((report: AttendanceReport) => {
          setAttendanceReport(report);
        })
        .catch((err: Error) => {
          console.error("Error fetching attendance data:", err);
          setError(prev => prev ? `${prev}\nНеуспешно зареждане на данни за присъствие.` : "Неуспешно зареждане на данни за присъствие.");
        })
        .finally(() => setIsLoadingData(false));
    }
  }, [selectedChildId, parent, userLoading, activeTab]);

  useEffect(() => {
    if (userLoading || !parent) return;
    if (parent && parent.role === 'parent' && parent.schoolId) {
      // Fetch subjects to map subject IDs to names
      getSubjects(parent.schoolId)
        .then(fetchedSubjects => {
          setSubjects(fetchedSubjects);
          // Create a mapping from subject IDs to subject names
          const mapping: Record<string, string> = {};
          fetchedSubjects.forEach(subject => {
            mapping[subject.subjectId] = subject.name;
          });
          setSubjectMap(mapping);
        })
        .catch(err => {
          console.error("Грешка при извличане на предмети:", err);
        });
    }
  }, [parent, userLoading]);

  const handleChildChange = (value: string) => {
    setSelectedChildId(value);
  };

  const selectedChild = children.find(c => c.userId === selectedChildId);

  if (userLoading || isLoadingChildren) {
    return (
      <div className="flex flex-col lg:flex-row h-screen">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <div className="flex-1 p-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-gray-800">Родителско табло</h1>
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
        <div className="flex-1 p-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-gray-800">Родителско табло</h1>
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
              Грешка при зареждане на потребителски данни: {userError}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!parent || parent.role !== 'parent') {
    return (
      <div className="flex flex-col lg:flex-row h-screen">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <div className="flex-1 p-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-gray-800">Родителско табло</h1>
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
              Достъп отказан. Трябва да сте влезли като родител.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (children.length === 0 && !error) {
    return (
      <div className="flex flex-col lg:flex-row h-screen">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <div className="flex-1 p-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-gray-800">Родителско табло</h1>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium">Не са намерени деца</h3>
                  <p className="text-gray-500 mt-2">
                    Към вашия акаунт в момента няма свързани деца. Моля, свържете се с администрацията на училището.
                  </p>
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
      <div className="flex-1 p-8 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-gray-800">Родителско табло</h1>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-6">
              {error.split('\n').map((line, i) => <p key={i}>{line}</p>)}
            </div>
          )}

          {/* Child Selector */}
          {children.length > 0 && (
            <div className="flex items-center space-x-4 mb-6">
              <label htmlFor="child-select" className="font-medium flex items-center">
                <Users className="h-5 w-5 text-blue-500 mr-2" />
                Преглед на данни за:
              </label>
              <Select onValueChange={handleChildChange} value={selectedChildId ?? ''}>
                <SelectTrigger id="child-select" className="w-[250px]">
                  <SelectValue placeholder="Изберете дете" />
                </SelectTrigger>
                <SelectContent>
                  {children.map(child => (
                    <SelectItem key={child.userId} value={child.userId}>
                      {child.firstName} {child.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-6">
              <TabsTrigger value="grades">Оценки</TabsTrigger>
              <TabsTrigger value="assignments">Задачи</TabsTrigger>
              <TabsTrigger value="quizzes">Тестове</TabsTrigger>
              <TabsTrigger value="reviews">Забележки</TabsTrigger>
              <TabsTrigger value="attendance">Отсъствия</TabsTrigger>
            </TabsList>

            <TabsContent value="grades">
              {isLoadingData ? (
                <Card>
                  <CardContent className="flex justify-center items-center h-64">
                    <p>Зареждане на данни за детето...</p>
                  </CardContent>
                </Card>
              ) : selectedChild && (
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
                      <ScrollArea className="h-[400px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Предмет</TableHead>
                              <TableHead>Заглавие</TableHead>
                              <TableHead>Тип</TableHead>
                              <TableHead>Оценка</TableHead>
                              <TableHead>Дата</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {grades.map(grade => (
                              <TableRow key={grade.id}>
                                <TableCell className="font-medium">{subjectMap[grade.subjectId] || grade.subjectId}</TableCell>
                                <TableCell>{grade.title}</TableCell>
                                <TableCell>{grade.type}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200">
                                    {grade.value}
                                  </Badge>
                                </TableCell>
                                <TableCell>{format(grade.date.toDate(), 'PPP')}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    ) : (
                      <div className="text-center py-10">
                        <GraduationCap className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium">Все още няма оценки</h3>
                        <p className="text-gray-500 mt-2">Не са намерени оценки за {selectedChild.firstName}.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="assignments">
              {isLoadingData ? (
                <Card>
                  <CardContent className="flex justify-center items-center h-64">
                    <p>Зареждане на данни за детето...</p>
                  </CardContent>
                </Card>
              ) : selectedChild && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center">
                      <FileText className="h-5 w-5 mr-2 text-green-500" />
                      Задачите на {selectedChild.firstName}
                    </CardTitle>
                    <CardDescription>
                      Проследяване на напредъка и предаването на задачи
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {assignmentsData && assignmentsData.assignments.length > 0 ? (
                      <Accordion type="single" collapsible className="w-full">
                        {assignmentsData.assignments.map(assignment => {
                          const submission = assignmentsData.submissions[assignment.assignmentId];
                          
                          let statusBadge;
                          if (submission) {
                            switch(submission.status) {
                              case 'graded':
                                statusBadge = <Badge className="ml-2 bg-green-500">Оценена</Badge>;
                                break;
                              case 'submitted':
                                statusBadge = <Badge variant="secondary" className="ml-2">Предадена</Badge>;
                                break;
                              default:
                                statusBadge = <Badge variant="outline" className="ml-2">{submission.status}</Badge>;
                            }
                          } else {
                            statusBadge = <Badge variant="outline" className="ml-2 bg-yellow-50 text-yellow-700 border-yellow-200">Непредадена</Badge>;
                          }
                          
                          return (
                            <AccordionItem key={assignment.assignmentId} value={assignment.assignmentId}>
                              <AccordionTrigger className="hover:bg-gray-50 px-4 py-3">
                                <div className="flex items-center">
                                  <span className="font-medium">{assignment.title}</span>
                                  {statusBadge}
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="space-y-3 px-4 py-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-500">Предмет</h4>
                                    <p>{assignment.subjectName}</p>
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-500">Краен срок</h4>
                                    <p>{format(assignment.dueDate.toDate(), 'PPP')}</p>
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className="text-sm font-medium text-gray-500">Описание</h4>
                                  <p className="text-gray-700">{assignment.description}</p>
                                </div>
                                
                                {submission ? (
                                  <div className="mt-4 border-t pt-4">
                                    <h4 className="font-medium mb-2">Детайли за предаване</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                                      <div>
                                        <h5 className="text-sm font-medium text-gray-500">Предадена на</h5>
                                        <p>{format(submission.submittedAt.toDate(), 'Pp')}</p>
                                      </div>
                                      <div>
                                        <h5 className="text-sm font-medium text-gray-500">Статус</h5>
                                        <p className="capitalize">{submission.status === 'graded' ? 'Оценена' : submission.status === 'submitted' ? 'Предадена' : submission.status}</p>
                                      </div>
                                    </div>
                                    
                                    <div className="mb-4">
                                      <h5 className="text-sm font-medium text-gray-500">Съдържание</h5>
                                      <div className="bg-gray-50 p-3 rounded border mt-1">
                                        <p>{submission.content}</p>
                                      </div>
                                    </div>
                                    
                                    {submission.feedback && (
                                      <div className="bg-blue-50 p-4 rounded-md">
                                        <h5 className="font-medium mb-2 text-blue-700">Обратна връзка от учителя</h5>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          {submission.feedback.grade && (
                                            <div>
                                              <h6 className="text-sm font-medium text-blue-600">Оценка</h6>
                                              <p className="font-bold text-lg">{submission.feedback.grade}</p>
                                            </div>
                                          )}
                                          <div>
                                            <h6 className="text-sm font-medium text-blue-600">Оценена на</h6>
                                            <p>{format(submission.feedback.gradedAt.toDate(), 'Pp')}</p>
                                          </div>
                                        </div>
                                        <div className="mt-2">
                                          <h6 className="text-sm font-medium text-blue-600">Коментар</h6>
                                          <p>{submission.feedback.comment}</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center bg-yellow-50 p-4 rounded-md mt-4">
                                    <div className="text-center">
                                      <p className="text-yellow-700 mb-1">Задачата все още не е предадена</p>
                                      <p className="text-sm text-gray-500">
                                        {selectedChild.firstName} все още не е предал(а) тази задача.
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
                        <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium">Все още няма задачи</h3>
                        <p className="text-gray-500 mt-2">Не са намерени задачи за {selectedChild.firstName}.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="quizzes">
              {isLoadingData ? (
                <Card>
                  <CardContent className="flex justify-center items-center h-64">
                    <p>Зареждане на данни за детето...</p>
                  </CardContent>
                </Card>
              ) : selectedChild && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center">
                      <ClipboardList className="h-5 w-5 mr-2 text-purple-500" />
                      Тестовете на {selectedChild.firstName}
                    </CardTitle>
                    <CardDescription>
                      Преглед на резултатите от тестове и показатели за представяне
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {quizData && quizData.quizzes.length > 0 ? (
                      <Accordion type="single" collapsible className="w-full">
                        {quizData.quizzes.map(quiz => {
                          const result = quizData.results.find(r => r.quizId === quiz.quizId);
                          const attempts = cheatingAttempts[quiz.quizId] || [];
                          
                          let statusBadge;
                          if (result) {
                            const scorePercent = Math.round((result.score / result.totalPoints) * 100);
                            if (scorePercent >= 90) {
                              statusBadge = <Badge className="ml-2 bg-green-500">Отличен {scorePercent}%</Badge>;
                            } else if (scorePercent >= 70) {
                              statusBadge = <Badge className="ml-2 bg-blue-500">Добър {scorePercent}%</Badge>;
                            } else if (scorePercent >= 50) {
                              statusBadge = <Badge className="ml-2 bg-yellow-500">Среден {scorePercent}%</Badge>;
                            } else {
                              statusBadge = <Badge className="ml-2 bg-red-500">Нуждае се от работа {scorePercent}%</Badge>;
                            }
                          } else {
                            statusBadge = <Badge variant="outline" className="ml-2">Не е положен</Badge>;
                          }
                          
                          // Get subject name from context
                          const subjectName = (quiz as any).subjectName || subjectMap[(quiz as any).subjectId] || 'Неизвестен предмет';
                          
                          // Get formatted date or fallback to creation date
                          const dateToShow = (quiz as any).date 
                            ? format((quiz as any).date.toDate(), 'PPP')
                            : format(quiz.createdAt.toDate(), 'PPP');
                          
                          return (
                            <AccordionItem key={quiz.quizId} value={quiz.quizId}>
                              <AccordionTrigger className="hover:bg-gray-50 px-4 py-3">
                                <div className="flex items-center">
                                  <span className="font-medium">{quiz.title}</span>
                                  {statusBadge}
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="space-y-3 px-4 py-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-500">Предмет</h4>
                                    <p>{subjectName}</p>
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-500">Дата</h4>
                                    <p>{dateToShow}</p>
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className="text-sm font-medium text-gray-500">Описание</h4>
                                  <p className="text-gray-700">{quiz.description}</p>
                                </div>
                                
                                {result ? (
                                  <div className="mt-4 border-t pt-4">
                                    <h4 className="font-medium mb-2">Резултати от теста</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                      <div>
                                        <h5 className="text-sm font-medium text-gray-500">Резултат</h5>
                                        <p className="text-lg font-bold">{result.score} / {result.totalPoints}</p>
                                      </div>
                                      <div>
                                        <h5 className="text-sm font-medium text-gray-500">Процент</h5>
                                        <p className="text-lg font-bold">{Math.round((result.score / result.totalPoints) * 100)}%</p>
                                      </div>
                                      <div>
                                        <h5 className="text-sm font-medium text-gray-500">Завършен на</h5>
                                        <p className="text-lg">{format(result.timestamp.toDate(), 'PP')}</p>
                                      </div>
                                    </div>
                                    
                                    {attempts.length > 0 && (
                                      <div className="bg-orange-50 p-4 rounded-md mt-4">
                                        <h5 className="font-medium text-orange-700 flex items-center">
                                          <AlertTriangle className="h-4 w-4 mr-2" />
                                          Открити потенциални опити за преписване ({attempts.length})
                                        </h5>
                                        <ul className="list-disc list-inside mt-2 space-y-1 text-orange-800">
                                          {attempts.map((attempt, index) => (
                                            <li key={index} className="text-sm">
                                              <span className="font-medium">{format(attempt.timestamp.toDate(), 'Pp')}</span>: {attempt.type} - {attempt.description}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center bg-gray-50 p-6 rounded-md mt-4">
                                    <div className="text-center">
                                      <p className="text-gray-700 mb-1">Тестът все още не е положен</p>
                                      <p className="text-sm text-gray-500">
                                        {selectedChild.firstName} не е завършил(а) този тест.
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
                        <h3 className="text-lg font-medium">Все още няма тестове</h3>
                        <p className="text-gray-500 mt-2">Не са намерени тестове за {selectedChild.firstName}.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="reviews">
              {isLoadingData ? (
                <Card>
                  <CardContent className="flex justify-center items-center h-64">
                    <p>Зареждане на данни за детето...</p>
                  </CardContent>
                </Card>
              ) : selectedChild && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center">
                      <MessageSquare className="h-5 w-5 mr-2 text-orange-500" />
                      Забележки за {selectedChild.firstName}
                    </CardTitle>
                    <CardDescription>
                      Преглед на всички забележки и отзиви от учителите
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {studentReviews.length > 0 ? (
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-4">
                          {studentReviews.map(review => (
                            <div 
                              key={review.reviewId} 
                              className={`p-4 border rounded-md ${
                                review.type === 'positive' 
                                  ? 'bg-green-50 border-green-200'
                                  : review.type === 'negative'
                                  ? 'bg-red-50 border-red-200'
                                  : 'bg-blue-50 border-blue-200'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <h3 className="font-medium flex items-center">
                                  {review.type === 'positive' 
                                    ? <ThumbsUp className="h-4 w-4 text-green-500 mr-2" />
                                    : review.type === 'negative'
                                    ? <ThumbsDown className="h-4 w-4 text-red-500 mr-2" />
                                    : <MessageSquare className="h-4 w-4 text-blue-500 mr-2" />
                                  }
                                  {review.title}
                                </h3>
                                <Badge variant="outline">
                                  {review.type === 'positive' 
                                    ? 'Положителна'
                                    : review.type === 'negative'
                                    ? 'Отрицателна'
                                    : 'Неутрална'
                                  }
                                </Badge>
                              </div>
                              
                              <p className="text-sm mb-3">{review.content}</p>
                              
                              <div className="flex justify-between text-xs text-gray-500">
                                <span className="flex items-center">
                                  <User className="h-3 w-3 mr-1" />
                                  {review.teacherName}
                                </span>
                                <span>{format(review.date.toDate(), 'PPP')}</span>
                              </div>
                              
                              {review.subjectName && (
                                <div className="mt-2">
                                  <Badge variant="outline" className="text-xs">
                                    {review.subjectName}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="text-center py-10">
                        <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium">Все още няма забележки</h3>
                        <p className="text-gray-500 mt-2">Няма забележки за {selectedChild.firstName}.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="attendance">
              {isLoadingData ? (
                <Card>
                  <CardContent className="flex justify-center items-center h-64">
                    <p>Зареждане на данни за присъствие...</p>
                  </CardContent>
                </Card>
              ) : selectedChild && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center">
                      <Clock className="h-5 w-5 mr-2 text-blue-500" />
                      Присъствия на {selectedChild.firstName}
                    </CardTitle>
                    <CardDescription>
                      Преглед на присъствия, отсъствия и закъснения през последните 30 дни
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {attendanceRecords.length > 0 ? (
                      <>
                        {/* Attendance Summary */}
                        {attendanceReport && (
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
                              <p className="text-sm text-blue-700 mb-1">Общо отсъствия</p>
                              <p className="text-2xl font-bold">{attendanceReport.absentDays}</p>
                            </div>
                            <div className="bg-yellow-50 p-4 rounded-md border border-yellow-100">
                              <p className="text-sm text-yellow-700 mb-1">Закъснения</p>
                              <p className="text-2xl font-bold">{attendanceReport.lateDays}</p>
                            </div>
                            <div className="bg-green-50 p-4 rounded-md border border-green-100">
                              <p className="text-sm text-green-700 mb-1">Извинени</p>
                              <p className="text-2xl font-bold">{attendanceReport.excusedDays}</p>
                            </div>
                            <div className="bg-red-50 p-4 rounded-md border border-red-100">
                              <p className="text-sm text-red-700 mb-1">Неизвинени</p>
                              <p className="text-2xl font-bold">{attendanceReport.absentDays - attendanceReport.excusedDays}</p>
                            </div>
                          </div>
                        )}
                        
                        {/* Attendance Records Table */}
                        <ScrollArea className="h-[350px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Дата</TableHead>
                                <TableHead>Предмет</TableHead>
                                <TableHead>Час</TableHead>
                                <TableHead>Статус</TableHead>
                                <TableHead>Извинено</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {attendanceRecords.map(record => (
                                <TableRow key={record.attendanceId}>
                                  <TableCell>{format(record.date.toDate(), 'PP')}</TableCell>
                                  <TableCell>{record.subjectName}</TableCell>
                                  <TableCell>{record.periodNumber}</TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={`${
                                        record.status === 'present'
                                          ? 'bg-green-50 text-green-700 border-green-200'
                                          : record.status === 'absent'
                                          ? 'bg-red-50 text-red-700 border-red-200'
                                          : record.status === 'late'
                                          ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                          : 'bg-blue-50 text-blue-700 border-blue-200'
                                      }`}
                                    >
                                      {record.status === 'present'
                                        ? 'Присъства'
                                        : record.status === 'absent'
                                        ? 'Отсъства'
                                        : record.status === 'late'
                                        ? 'Закъснява'
                                        : record.status === 'excused'
                                        ? 'Извинено'
                                        : record.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {record.justified 
                                      ? <Check className="h-5 w-5 text-green-500" /> 
                                      : record.status === 'absent' 
                                      ? <AlertTriangle className="h-5 w-5 text-red-500" /> 
                                      : null}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </>
                    ) : (
                      <div className="text-center py-10">
                        <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium">Няма данни за присъствие</h3>
                        <p className="text-gray-500 mt-2">
                          Няма записи за присъствие за {selectedChild.firstName} през последните 30 дни.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default ParentDashboard;