"use client";

import { NotificationCategory } from "@/lib/notificationManagement";
import { Bell } from "lucide-react";

interface EmptyStateProps {
  category?: NotificationCategory | "all";
  showOnlyUnread?: boolean;
}

export default function EmptyState({
  category,
  showOnlyUnread,
}: EmptyStateProps) {
  // Get appropriate message based on category and filter status
  const getMessage = () => {
    if (showOnlyUnread) {
      if (!category || category === "all") {
        return "Нямате непрочетени известия";
      }

      const categoryMessages: Record<NotificationCategory, string> = {
        assignments: "Нямате непрочетени известия за задачи",
        quizzes: "Нямате непрочетени известия за тестове",
        grades: "Нямате непрочетени известия за оценки",
        attendance: "Нямате непрочетени известия за присъствия",
        feedback: "Нямате непрочетени известия за отзиви",
        system: "Нямате непрочетени системни известия",
        messages: "Нямате непрочетени известия за съобщения",
      };

      return categoryMessages[category as NotificationCategory];
    } else {
      if (!category || category === "all") {
        return "Нямате известия";
      }

      const categoryMessages: Record<NotificationCategory, string> = {
        assignments: "Нямате известия за задачи",
        quizzes: "Нямате известия за тестове",
        grades: "Нямате известия за оценки",
        attendance: "Нямате известия за присъствия",
        feedback: "Нямате известия за отзиви",
        system: "Нямате системни известия",
        messages: "Нямате известия за съобщения",
      };

      return categoryMessages[category as NotificationCategory];
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-8 sm:py-12">
      <Bell className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 mb-3 sm:mb-4" />
      <h3 className="text-lg sm:text-xl font-medium text-gray-500 mb-2 text-center">
        {getMessage()}
      </h3>
      <p className="text-sm sm:text-base text-gray-400 text-center max-w-[90%] sm:max-w-md">
        {showOnlyUnread
          ? "Когато получите нови известия, те ще се появят тук."
          : "Когато получите известия, те ще се появят тук."}
      </p>
    </div>
  );
}
