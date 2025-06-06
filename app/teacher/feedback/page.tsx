"use client";

/**
 * Teacher Feedback Management Page
 *
 * Interface for teachers to provide and review student feedback.
 * This page provides:
 *
 * Key features:
 * - Student search and selection functionality
 * - Creation of both positive and negative feedback entries
 * - Subject-specific feedback categorization
 * - Historical feedback review with chronological display
 * - Visual differentiation between praise and criticism
 *
 * Data flow:
 * - Retrieves student data from school records
 * - Fetches subject listings for categorization
 * - Processes feedback submission with teacher attribution
 * - Loads existing feedback history for selected students
 *
 * This interface enables teachers to maintain detailed feedback records for each
 * student, facilitating communication with parents and providing a comprehensive
 * history of student performance and behavior across different subjects.
 */

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { useFeedback } from "@/contexts/FeedbackContext";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getSubjects } from "@/lib/management/subjectManagement";
import type { Student, Subject, ReviewType } from "@/lib/interfaces";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import Sidebar from "@/components/functional/layout/Sidebar";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ThumbsUp, ThumbsDown, MessageSquare, Search } from "lucide-react";

export default function StudentReviews() {
  const { user } = useUser();
  const {
    reviews,
    loading,
    error,
    getReviewsForStudent,
    createReview,
    resetFeedbackState,
  } = useFeedback();
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectMap, setSubjectMap] = useState<Record<string, string>>({});
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [reviewType, setReviewType] = useState<ReviewType>("positive");
  const [reviewTitle, setReviewTitle] = useState<string>("");
  const [reviewContent, setReviewContent] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    if (!user || (user.role !== "teacher" && user.role !== "admin")) {
      router.push("/login");
      return;
    }

    const fetchData = async () => {
      if (!user.schoolId) return;

      setIsLoading(true);
      try {
        // Fetch all students from the school
        const studentsQuery = query(
          collection(db, "schools", user.schoolId, "users"),
          where("role", "==", "student")
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        const studentsList = studentsSnapshot.docs.map((doc) => ({
          ...(doc.data() as Student),
          userId: doc.id,
        }));
        setStudents(studentsList);

        // Fetch all subjects
        const subjectsList = await getSubjects(user.schoolId);
        setSubjects(subjectsList);

        // Create a mapping from subject IDs to subject names
        const mapping: Record<string, string> = {};
        subjectsList.forEach((subject) => {
          mapping[subject.subjectId] = subject.name;
        });
        setSubjectMap(mapping);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          title: "Грешка",
          description: "Неуспешно зареждане на данни.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData(); // Reset feedback state when component unmounts
    return () => {
      resetFeedbackState();
    };
  }, [user, router, resetFeedbackState]);
  // Handle selection of a student and fetch their reviews
  useEffect(() => {
    const fetchReviews = async () => {
      if (!user?.schoolId || !selectedStudent) return;

      try {
        console.debug(
          `[TeacherFeedback] Fetching reviews for student ${selectedStudent}`
        );

        // Set loading state explicitly for UI
        setIsLoading(true);

        // Request reviews from the FeedbackContext
        await getReviewsForStudent(user.schoolId, selectedStudent);

        console.debug(
          `[TeacherFeedback] Reviews fetched successfully, reviews count: ${reviews.length}`
        );
      } catch (err) {
        console.error("Error in component while fetching reviews:", err);
        toast({
          title: "Грешка",
          description: "Неуспешно зареждане на отзиви. Моля, опитайте отново.",
          variant: "destructive",
        });
      } finally {
        // Ensure loading state is properly reset
        setIsLoading(false);
      }
    };

    if (selectedStudent) {
      fetchReviews();
    } else {
      // Reset feedback state when no student is selected
      resetFeedbackState();
    }
  }, [
    selectedStudent,
    user?.schoolId,
    getReviewsForStudent,
    resetFeedbackState,
  ]);

  // Handle student selection with proper state reset
  const handleStudentSelect = (studentId: string) => {
    // Only do something if we're selecting a different student
    if (selectedStudent !== studentId) {
      console.debug(
        `[TeacherFeedback] Changing selected student from ${
          selectedStudent || "none"
        } to ${studentId}`
      );

      // Reset feedback state before changing student to avoid stale data
      resetFeedbackState();

      // Change the selected student
      setSelectedStudent(studentId);

      // Reset form fields
      setReviewTitle("");
      setReviewContent("");
      setReviewType("positive");
      setSelectedSubject("");
    }
  };

  // Monitor loading state changes from the feedback context
  useEffect(() => {
    console.debug(`[TeacherFeedback] Loading state changed: ${loading}`);

    // If the feedbackContext loading state is false, also set the local isLoading to false
    if (loading === false) {
      setIsLoading(false);
    }
  }, [loading]);

  // Monitor review changes
  useEffect(() => {
    console.debug(
      `[TeacherFeedback] Reviews updated: ${reviews.length} received`
    );
  }, [reviews]);

  // Monitor errors
  useEffect(() => {
    if (error) {
      console.debug(`[TeacherFeedback] Error received: ${error}`);
      toast({
        title: "Грешка",
        description: error,
        variant: "destructive",
      });
    }
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.schoolId || !selectedStudent || !user.userId) {
      toast({
        title: "Грешка",
        description: "Моля изберете ученик.",
        variant: "destructive",
      });
      return;
    }

    if (!reviewTitle.trim()) {
      toast({
        title: "Грешка",
        description: "Моля въведете заглавие на забележката.",
        variant: "destructive",
      });
      return;
    }

    if (!reviewContent.trim()) {
      toast({
        title: "Грешка",
        description: "Моля въведете съдържание на забележката.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const reviewData: {
        studentId: string;
        title: string;
        content: string;
        type: ReviewType;
        subjectId?: string;
        subjectName?: string;
      } = {
        studentId: selectedStudent,
        title: reviewTitle,
        content: reviewContent,
        type: reviewType,
      };

      // Only add subject data if a valid subject is selected (not "none")
      if (
        selectedSubject &&
        selectedSubject !== "none" &&
        subjectMap[selectedSubject]
      ) {
        reviewData.subjectId = selectedSubject;
        reviewData.subjectName = subjectMap[selectedSubject];
      }

      // Use the createReview function from the context
      const result = await createReview(
        user.schoolId,
        user.userId,
        `${user.firstName} ${user.lastName}`,
        reviewData
      );

      if (result) {
        toast({
          title: "Успех",
          description: "Отзивът беше добавен успешно.",
        });

        // Reset form
        setReviewTitle("");
        setReviewContent("");
        setReviewType("positive");
      }
    } catch (error) {
      console.error("Error adding review:", error);
      toast({
        title: "Грешка",
        description: "Неуспешно добавяне на отзива.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter students by search query
  const filteredStudents = searchQuery
    ? students.filter((student) =>
        `${student.firstName} ${student.lastName}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      )
    : students;

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="flex-1 p-8 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-gray-800">
            Отзиви за ученици
          </h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Student Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Избор на ученик</CardTitle>
                <CardDescription>
                  Изберете ученик, за да добавите или прегледате отзиви
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-gray-500" />
                    <Input
                      placeholder="Търсене на ученик..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  {isLoading ? (
                    <p className="text-center py-4">Зареждане...</p>
                  ) : (
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-2">
                        {filteredStudents.map((student) => (
                          <div
                            key={student.userId}
                            onClick={() =>
                              student.userId &&
                              handleStudentSelect(student.userId)
                            }
                            className={`p-3 rounded-md cursor-pointer hover:bg-gray-100 transition-colors ${
                              selectedStudent === student.userId
                                ? "bg-blue-50 border border-blue-200"
                                : ""
                            }`}
                          >
                            <p className="font-medium">
                              {student.firstName} {student.lastName}
                            </p>
                            <p className="text-sm text-gray-500">
                              Клас: {student.homeroomClassId}
                            </p>
                          </div>
                        ))}

                        {filteredStudents.length === 0 && (
                          <p className="text-center py-4 text-gray-500">
                            Няма намерени ученици
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Add Review Form */}
            <Card>
              <CardHeader>
                <CardTitle>Добавяне на отзив</CardTitle>
                <CardDescription>
                  Създайте нов положителен или отрицателен отзив
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="review-type">Тип на отзива</Label>
                    <RadioGroup
                      value={reviewType}
                      onValueChange={(value) =>
                        setReviewType(value as ReviewType)
                      }
                      className="flex space-x-4"
                      id="review-type"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="positive" id="positive" />
                        <Label
                          htmlFor="positive"
                          className="flex items-center cursor-pointer"
                        >
                          <ThumbsUp className="h-4 w-4 mr-2 text-green-600" />
                          Похвала
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="negative" id="negative" />
                        <Label
                          htmlFor="negative"
                          className="flex items-center cursor-pointer"
                        >
                          <ThumbsDown className="h-4 w-4 mr-2 text-red-600" />
                          Забележка
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Предмет (незадължително)</Label>
                    <Select
                      value={selectedSubject}
                      onValueChange={setSelectedSubject}
                    >
                      <SelectTrigger id="subject">
                        <SelectValue placeholder="Изберете предмет" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Без предмет</SelectItem>
                        {subjects.map((subject) => (
                          <SelectItem
                            key={subject.subjectId}
                            value={subject.subjectId}
                          >
                            {subject.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title">Заглавие на отзива</Label>
                    <Input
                      id="title"
                      placeholder="Въведете заглавие"
                      value={reviewTitle}
                      onChange={(e) => setReviewTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content">Съдържание на отзива</Label>
                    <Textarea
                      id="content"
                      placeholder="Въведете съдържание"
                      value={reviewContent}
                      onChange={(e) => setReviewContent(e.target.value)}
                      rows={5}
                    />
                  </div>
                </form>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={handleSubmit}
                  className={`w-full ${
                    reviewType === "positive"
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                  disabled={!selectedStudent || isSubmitting}
                >
                  {isSubmitting ? "Изпращане..." : "Добави отзив"}
                </Button>
              </CardFooter>
            </Card>

            {/* Reviews List */}
            <Card>
              <CardHeader>
                <CardTitle>Преглед на отзиви</CardTitle>
                <CardDescription>
                  {selectedStudent
                    ? `Всички отзиви за избрания ученик`
                    : `Изберете ученик, за да видите отзиви`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedStudent ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <MessageSquare className="h-12 w-12 text-gray-300 mb-4" />
                    <p className="text-gray-500">
                      Изберете ученик от списъка отляво, за да видите неговите
                      отзиви
                    </p>
                  </div>
                ) : loading || isLoading ? (
                  <div className="flex flex-col justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mb-3"></div>
                    <p>Зареждане на отзиви...</p>
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <MessageSquare className="h-12 w-12 text-gray-300 mb-4" />
                    <p className="text-gray-500">
                      Няма намерени отзиви за този ученик
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-4">
                      {reviews.map((review) => (
                        <div
                          key={review.reviewId}
                          className={`p-4 rounded-lg border ${
                            review.type === "positive"
                              ? "bg-green-50 border-green-200"
                              : "bg-red-50 border-red-200"
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center">
                              {review.type === "positive" ? (
                                <ThumbsUp className="h-5 w-5 mr-2 text-green-600" />
                              ) : (
                                <ThumbsDown className="h-5 w-5 mr-2 text-red-600" />
                              )}
                              <h3
                                className={`font-medium ${
                                  review.type === "positive"
                                    ? "text-green-700"
                                    : "text-red-700"
                                }`}
                              >
                                {review.title}
                              </h3>
                            </div>
                            <Badge
                              variant="outline"
                              className={`${
                                review.type === "positive"
                                  ? "bg-green-100 text-green-800 border-green-300"
                                  : "bg-red-100 text-red-800 border-red-300"
                              }`}
                            >
                              {review.type === "positive"
                                ? "Похвала"
                                : "Забележка"}
                            </Badge>
                          </div>

                          <p
                            className={`mb-3 ${
                              review.type === "positive"
                                ? "text-green-800"
                                : "text-red-800"
                            }`}
                          >
                            {review.content}
                          </p>

                          <div className="flex flex-wrap items-center justify-between mt-3 text-sm">
                            <div className="flex items-center">
                              <span
                                className={`font-medium ${
                                  review.type === "positive"
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                Преподавател:
                              </span>
                              <span className="ml-1">{review.teacherName}</span>
                            </div>
                            {review.subjectName && (
                              <div className="flex items-center mt-1 sm:mt-0">
                                <span
                                  className={`font-medium ${
                                    review.type === "positive"
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  Предмет:
                                </span>
                                <span className="ml-1">
                                  {review.subjectName}
                                </span>
                              </div>
                            )}{" "}
                            <div className="w-full sm:w-auto mt-1 sm:mt-0 text-gray-500">
                              {review.date
                                ? format(review.date.toDate(), "PPP")
                                : "Няма дата"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
