"use client";

/**
 * Student Feedback Page
 *
 * Interface for students to view and manage feedback received from teachers.
 * This page provides:
 *
 * Key features:
 * - Comprehensive list of all feedback from teachers
 * - Categorized views for positive feedback (praise) and negative feedback (remarks)
 * - Visual distinction between different feedback types
 * - Contextual information about related subjects and teachers
 * - Chronological organization of feedback entries
 *
 * Data flow:
 * - Retrieves feedback data from FeedbackContext
 * - Filters feedback entries based on selected category
 * - Organizes feedback by type with appropriate visual indicators
 * - Implements access control to ensure only the student's own feedback is displayed
 *
 * This page provides students with a clear overview of teacher assessments of their
 * academic performance and behavior, helping them track their progress and identify
 * areas for improvement.
 */

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { useFeedback } from "@/contexts/FeedbackContext";
import { useRouter } from "next/navigation";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import Sidebar from "@/components/functional/layout/Sidebar";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function StudentFeedback() {
  const { user } = useUser();
  const { reviews, loading, error, getReviewsForStudent } = useFeedback();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<string>("all");

  useEffect(() => {
    if (!user || user.role !== "student") {
      router.push("/login");
      return;
    }

    const fetchReviews = async () => {
      if (!user.schoolId || !user.userId) return;

      try {
        await getReviewsForStudent(user.schoolId, user.userId);
      } catch (err) {
        console.error("Error in component while fetching reviews:", err);
        toast({
          title: "Грешка",
          description: "Неуспешно зареждане на отзиви.",
          variant: "destructive",
        });
      }
    };

    fetchReviews();
  }, [user, router, getReviewsForStudent]);

  // Display error toast if there was an error loading reviews
  useEffect(() => {
    if (error) {
      toast({
        title: "Грешка",
        description: error,
        variant: "destructive",
      });
    }
  }, [error]);

  // Filter reviews based on the active tab
  const filteredReviews = reviews.filter((review) => {
    if (activeTab === "all") return true;
    return review.type === activeTab;
  });

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="flex-1 p-8 overflow-auto bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-gray-800">
            Моите отзиви
          </h1>

          {/* Reviews Section */}
          <Card>
            <CardHeader>
              <CardTitle>Отзиви от учителите</CardTitle>
              <CardDescription>Всички отзиви от вашите учители</CardDescription>

              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="mt-4"
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="all">Всички</TabsTrigger>
                  <TabsTrigger value="positive">
                    <ThumbsUp className="h-4 w-4 mr-2 text-green-600" />
                    Похвали
                  </TabsTrigger>
                  <TabsTrigger value="negative">
                    <ThumbsDown className="h-4 w-4 mr-2 text-red-600" />
                    Забележки
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <p>Зареждане...</p>
                </div>
              ) : filteredReviews.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <MessageSquare className="h-12 w-12 text-gray-300 mb-4" />
                  <p className="text-gray-500">
                    {activeTab === "all"
                      ? "Нямате отзиви все още"
                      : `Нямате ${
                          activeTab === "positive" ? "похвали" : "забележки"
                        }`}
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    {filteredReviews.map((review) => (
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
                              <span className="ml-1">{review.subjectName}</span>
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
  );
}
