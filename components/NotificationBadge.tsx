"use client";

import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/contexts/NotificationContext";

export default function NotificationBadge() {
  const { unreadCount } = useNotifications();

  if (unreadCount <= 0) return null;

  return (
    <Badge className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-red-500 text-white text-xs min-w-[18px] h-[18px] flex items-center justify-center rounded-full">
      {unreadCount > 9 ? "9+" : unreadCount}
    </Badge>
  );
}
