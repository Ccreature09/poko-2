"use client";

/**
 * Parent Feedback Page
 *
 * Provides a specialized interface for parents to view teacher feedback about their children.
 * This page offers:
 *
 * Key features:
 * - Child selection dropdown for families with multiple students
 * - Categorized view of feedback (all, positive, negative)
 * - Chronological display of teacher comments with visual differentiation
 * - Subject and teacher attribution for each feedback entry
 * - Responsive scrollable interface for handling large feedback volumes
 *
 * Data flow:
 * 1. Fetches parent-child relationships from parent user record
 * 2. Loads feedback data via FeedbackContext for selected child
 * 3. Manages state for filtering and display options
 * 4. Renders feedback with appropriate visual styling based on type
 *
 * The page handles appropriate loading states, empty states, and
 * error conditions with user-friendly feedback mechanisms.
 */

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { useFeedback } from "@/contexts/FeedbackContext";
import { useRouter } from "next/navigation";
import { getParentChildren } from "@/lib/management/parentManagement";
import type { Student } from "@/lib/interfaces";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import Sidebar from "@/components/functional/layout/Sidebar";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ThumbsUp, ThumbsDown, MessageSquare, User } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ParentFeedback() {
  const { user } = useUser();
  const { reviews, loading, error, getReviewsForStudent, resetFeedbackState } =
    useFeedback();
  const router = useRouter();

  const [children, setChildren] = useState<Student[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [isLoadingChildren, setIsLoadingChildren] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>("all");

  useEffect(() => {
    if (!user || user.role !== "parent") {
      router.push("/login");
      return;
    }

    const fetchChildren = async () => {
      if (!user.schoolId || !user.userId) return;

      setIsLoadingChildren(true);
      try {
        const childrenList = await getParentChildren(
          user.schoolId,
          user.userId
        );
        setChildren(childrenList);

        // Automatically select the first child if available
        if (childrenList.length > 0 && childrenList[0].userId) {
          setSelectedChildId(childrenList[0].userId);
        }
      } catch (error) {
        console.error("Error fetching children:", error);
        toast({
          title: "Грешка",
          description: "Неуспешно зареждане на данни за децата.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingChildren(false);
      }
    };

    fetchChildren();
  }, [user, router]);

  // Reset feedback state when component unmounts or when child changes
  useEffect(() => {
    return () => {
      resetFeedbackState();
    };
  }, [resetFeedbackState]);

  // Fetch reviews when a child is selected
  useEffect(() => {
    const fetchReviews = async () => {
      if (!user?.schoolId || !selectedChildId) return;

      try {
        await getReviewsForStudent(user.schoolId, selectedChildId);
      } catch (err) {
        console.error("Error in component while fetching reviews:", err);
        toast({
          title: "Грешка",
          description: "Неуспешно зареждане на отзиви.",
          variant: "destructive",
        });
      }
    };

    if (selectedChildId) {
      fetchReviews();
    }
  }, [selectedChildId, user?.schoolId, getReviewsForStudent]);

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

  const getSelectedChildName = () => {
    const child = children.find((c) => c.userId === selectedChildId);
    return child ? `${child.firstName} ${child.lastName}` : "";
  };

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
            Отзиви за децата
          </h1>

          <div className="space-y-8">
            {/* Child Selection */}
            {children.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Изберете дете</CardTitle>
                  <CardDescription>
                    Прегледайте отзиви от учителите
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Select
                    value={selectedChildId}
                    onValueChange={setSelectedChildId}
                  >
                    <SelectTrigger className="w-full md:w-80">
                      <SelectValue placeholder="Изберете дете" />
                    </SelectTrigger>
                    <SelectContent>
                      {children.map((child) =>
                        child.userId ? (
                          <SelectItem key={child.userId} value={child.userId}>
                            {child.firstName} {child.lastName} - Клас:{" "}
                            {child.homeroomClassId}
                          </SelectItem>
                        ) : null
                      )}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  {isLoadingChildren ? (
                    <p>Зареждане...</p>
                  ) : (
                    <div className="space-y-3">
                      <User className="h-12 w-12 mx-auto text-gray-300" />
                      <p className="text-gray-500">
                        Няма деца, свързани с вашия акаунт
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Reviews Section */}
            {selectedChildId && (
              <Card>
                <CardHeader>
                  <CardTitle>Отзиви за {getSelectedChildName()}</CardTitle>
                  <CardDescription>Всички отзиви от учителите</CardDescription>

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
                      <p>Зареждане на отзиви...</p>
                    </div>
                  ) : filteredReviews.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                      <MessageSquare className="h-12 w-12 text-gray-300 mb-4" />
                      <p className="text-gray-500">
                        {activeTab === "all"
                          ? "Няма отзиви за това дете"
                          : `Няма ${
                              activeTab === "positive" ? "похвали" : "забележки"
                            } за това дете`}
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[500px] pr-4">
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
                                <span className="ml-1">
                                  {review.teacherName}
                                </span>
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
