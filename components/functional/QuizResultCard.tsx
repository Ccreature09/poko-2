"use client";

import React from "react";
import {
  QuizResult,
  Quiz,
} from "@/lib/interfaces";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTimeSpent } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { AlertCircle, CheckCircle, Clock } from "lucide-react";

interface QuizResultCardProps {
  result: QuizResult;
  quiz?: Quiz;
  showDetails?: boolean;
}

export default function QuizResultCard({
  result,
  quiz,
  showDetails = true,
}: QuizResultCardProps) {
  // Calculate percentage score
  const percentage = Math.round((result.score / result.totalPoints) * 100);
  // No longer using grading scale

  // Determine status badge color and icon
  const getBadgeDetails = () => {
    if (percentage >= 80)
      return {
        variant: "default",
        className: "bg-green-500 hover:bg-green-600",
        icon: <CheckCircle className="h-4 w-4 mr-1" />,
      };
    if (percentage >= 60)
      return {
        variant: "default",
        className: "",
        icon: <CheckCircle className="h-4 w-4 mr-1" />,
      };
    if (percentage >= 40)
      return {
        variant: "secondary",
        className: "bg-amber-500 hover:bg-amber-600 text-white",
        icon: <AlertCircle className="h-4 w-4 mr-1" />,
      };
    return {
      variant: "destructive",
      className: "",
      icon: <AlertCircle className="h-4 w-4 mr-1" />,
    };
  };

  const badge = getBadgeDetails();

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-medium">
            {quiz?.title || "Резултат от тест"}
          </CardTitle>
          <Badge
            variant={
              badge.variant as
                | "default"
                | "secondary"
                | "destructive"
                | "outline"
            }
            className={`flex items-center ${badge.className}`}
          >
            {badge.icon}
            {percentage}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="space-y-4">          {/* Score percentage is displayed in the badge above */}

          {/* Score */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Резултат:</span>
              <span>
                {result.score} / {result.totalPoints} точки
              </span>
            </div>
            <Progress value={percentage} className="h-2" />
          </div>

          {showDetails && (
            <>
              {/* Time information */}
              {result.totalTimeSpent && (
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center text-muted-foreground">
                    <Clock className="h-4 w-4 mr-1 inline" /> Време за
                    изпълнение:
                  </span>
                  <span>{formatTimeSpent(result.totalTimeSpent)}</span>
                </div>
              )}

              {/* Date taken */}
              {result.timestamp && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Дата и час:</span>
                  <span>
                    {format(result.timestamp.toDate(), "dd.MM.yyyy HH:mm")}
                  </span>
                </div>
              )}

              {/* Security violations */}
              {result.securityViolations && result.securityViolations > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-amber-500">
                    Нарушения на сигурността:
                  </span>
                  <Badge
                    variant="outline"
                    className="border-amber-500 text-amber-500"
                  >
                    {result.securityViolations}
                  </Badge>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
