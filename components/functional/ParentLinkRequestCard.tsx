import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, UserRound, Mail } from "lucide-react";
import { respondToLinkRequest } from "@/lib/parentChildLinking";
import { toast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { deleteNotification, Notification } from "@/lib/notificationManagement";

interface ParentLinkRequestCardProps {
  notification: Notification & {
    metadata?: {
      linkRequestId: string;
      parentName: string;
      parentEmail: string;
    };
  };
  onActionComplete: () => void;
}

const ParentLinkRequestCard: React.FC<ParentLinkRequestCardProps> = ({
  notification,
  onActionComplete,
}) => {
  const { user } = useUser();
  const [isLoading, setIsLoading] = React.useState(false);

  if (!notification?.metadata?.linkRequestId) {
    return null;
  }

  const { linkRequestId, parentName, parentEmail } = notification.metadata;

  const handleResponse = async (response: "accepted" | "rejected") => {
    if (!user?.schoolId) return;

    setIsLoading(true);
    try {
      await respondToLinkRequest(user.schoolId, linkRequestId, response);

      // Delete the notification after the student has responded
      if (notification.id) {
        await deleteNotification(user.schoolId, user.userId, notification.id);
      }

      toast({
        title:
          response === "accepted"
            ? "Заявката е приета"
            : "Заявката е отхвърлена",
        description:
          response === "accepted"
            ? `Свързан сте с родител ${parentName}`
            : `Отхвърлихте заявката от ${parentName}`,
        variant: "default",
      });

      onActionComplete();
    } catch (error) {
      console.error("Error responding to link request:", error);
      toast({
        title: "Грешка",
        description: "Възникна грешка при обработка на заявката",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Заявка за свързване от родител</CardTitle>
        <CardDescription>
          Родител иска да се свърже с вашия акаунт, за да вижда вашите оценки,
          присъствия и друга информация.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-3">
          <UserRound className="h-10 w-10 text-gray-400 mt-1" />
          <div>
            <p className="font-medium text-lg">{parentName}</p>
            <div className="flex items-center gap-1 text-gray-500">
              <Mail className="h-4 w-4" />
              <span>{parentEmail}</span>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => handleResponse("rejected")}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Отхвърли
        </Button>
        <Button onClick={() => handleResponse("accepted")} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Приеми
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ParentLinkRequestCard;
