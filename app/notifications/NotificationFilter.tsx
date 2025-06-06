"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface NotificationFilterProps {
  showOnlyUnread: boolean;
  setShowOnlyUnread: (value: boolean) => void;
}

export default function NotificationFilter({
  showOnlyUnread,
  setShowOnlyUnread,
}: NotificationFilterProps) {
  return (
    <div className="flex items-center justify-end space-x-2 mb-3 sm:mb-4">
      <Switch
        id="unread-mode"
        checked={showOnlyUnread}
        onCheckedChange={setShowOnlyUnread}
      />
      <Label htmlFor="unread-mode" className="text-sm sm:text-base">
        Покажи само непрочетени
      </Label>
    </div>
  );
}
