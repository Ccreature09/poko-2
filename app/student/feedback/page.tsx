"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { useRouter } from "next/navigation";
import { getChildReviews } from "@/lib/parentManagement";
import type { StudentReview } from "@/lib/interfaces";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import Sidebar from "@/components/functional/Sidebar";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function StudentFeedback() {
  const { user } = useUser();
  const router = useRouter();

  const [studentReviews, setStudentReviews] = useState<StudentReview[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>("all");

  useEffect(() => {
    if (!user || user.role !== "student") {
      router.push("/login");
      return;
    }

    const fetchReviews = async () => {
      if (!user.schoolId || !user.userId) return;

      setIsLoading(true);
      try {
        const reviews = await getChildReviews(user.schoolId, user.userId);
        setStudentReviews(reviews);
      } catch (error) {
        console.error("Error fetching reviews:", error);
        toast({
          title: "Грешка",
          description: "Неуспешно зареждане на отзиви.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchReviews();
  }, [user, router]);

  // Filter reviews based on the active tab
  const filteredReviews = studentReviews.filter((review) => {
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
              {isLoading ? (
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
                          )}

                          <div className="w-full sm:w-auto mt-1 sm:mt-0 text-gray-500">
                            {format(review.date.toDate(), "PPP")}
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
