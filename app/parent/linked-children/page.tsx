"use client";

/**
 * Parent Linked Children Management Page
 *
 * Provides a comprehensive interface for parents to manage connections with their children's
 * student accounts. This page enables:
 *
 * Key features:
 * - Sending link requests to connect with student accounts
 * - Viewing pending, accepted, and rejected link requests
 * - Managing already linked student accounts
 * - Direct navigation to child-specific academic information
 * - Secure unlinking process with confirmation dialogs
 *
 * Security and workflow:
 * - Enforces parent role authorization
 * - Implements two-way verification (parent sends request, student must accept)
 * - Maintains data privacy by only showing information for approved links
 * - Tracks request status (pending, accepted, rejected) with visual indicators
 *
 * The page uses Firebase for real-time data management and implements
 * a responsive design with appropriate feedback during asynchronous operations.
 */

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { useRouter } from "next/navigation";
import {
  requestParentChildLink,
  getParentLinkRequests,
  getLinkedChildren,
  unlinkParentChild,
} from "@/lib/parentChildLinking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  UserRound,
  Mail,
  Trash,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";

export default function ManageChildrenPage() {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const [childEmail, setChildEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkRequests, setLinkRequests] = useState<
    Array<{
      id: string;
      childId: string;
      childEmail: string;
      parentId: string;
      status: string;
      createdAt: { toDate: () => Date };
    }>
  >([]);
  const [linkedChildren, setLinkedChildren] = useState<
    { childId: string; childName: string; childEmail: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    if (!user?.schoolId || !user?.userId) return;

    setIsLoading(true);
    try {
      // Load link requests
      const requests = await getParentLinkRequests(user.schoolId, user.userId);
      setLinkRequests(
        requests as Array<{
          id: string;
          childId: string;
          childEmail: string;
          parentId: string;
          status: string;
          createdAt: { toDate: () => Date };
        }>
      );

      // Load linked children
      const children = await getLinkedChildren(user.schoolId, user.userId);
      setLinkedChildren(children);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Грешка при зареждане на данните",
        description: "Моля, опитайте отново по-късно.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Don't redirect while user data is still loading
    if (userLoading) return;

    if (!user) {
      router.push("/login");
      return;
    } // Ensure the user is a parent
    if (user.role !== "parent") {
      router.push(`/${user.role}/dashboard`);
      return;
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !childEmail.trim() ||
      !user?.schoolId ||
      !user?.userId ||
      !user?.firstName ||
      !user?.lastName ||
      !user?.email
    ) {
      return;
    }

    setIsSubmitting(true);
    try {
      await requestParentChildLink(
        user.schoolId,
        user.userId,
        `${user.firstName} ${user.lastName}`, // Combine firstName and lastName
        user.email,
        childEmail.trim()
      );

      toast({
        title: "Заявката е изпратена",
        description: `Изпратихме заявка за свързване на ${childEmail.trim()}`,
        variant: "default",
      });

      setChildEmail("");
      await loadData(); // Reload the data
    } catch (error) {
      toast({
        title: "Грешка",
        description:
          error instanceof Error
            ? error.message
            : "Възникна грешка при изпращане на заявката",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlink = async (linkId: string, childName: string) => {
    if (!user?.schoolId) return;

    try {
      await unlinkParentChild(user.schoolId, linkId);

      toast({
        title: "Успешно премахване",
        description: `Връзката с ${childName} беше премахната`,
        variant: "default",
      });

      await loadData(); // Reload the data
    } catch {
      toast({
        title: "Грешка",
        description: "Възникна грешка при премахване на връзката",
        variant: "destructive",
      });
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge
            variant="outline"
            className="bg-yellow-50 text-yellow-700 border-yellow-300 flex items-center gap-1"
          >
            <Loader2 className="h-3 w-3 animate-spin" /> Изчакваща
          </Badge>
        );
      case "accepted":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-300 flex items-center gap-1"
          >
            <CheckCircle className="h-3 w-3" /> Приета
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-300 flex items-center gap-1"
          >
            <XCircle className="h-3 w-3" /> Отхвърлена
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">
        Управление на свързани ученици
      </h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Добавяне на ученик</CardTitle>
          <CardDescription>
            Въведете имейл адреса на вашето дете, за да изпратите заявка за
            свързване. Ученикът трябва да приеме заявката, за да можете да
            видите неговата информация.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex items-end gap-4">
            <div className="flex-1">
              <label
                htmlFor="childEmail"
                className="text-sm font-medium block mb-2"
              >
                Имейл адрес на ученика
              </label>
              <Input
                id="childEmail"
                type="email"
                value={childEmail}
                onChange={(e) => setChildEmail(e.target.value)}
                placeholder="ученик@example.com"
                required
              />
            </div>
            <Button
              type="submit"
              className="text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Изпращане...
                </>
              ) : (
                "Изпрати заявка"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Tabs defaultValue="linked" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="linked">Свързани ученици</TabsTrigger>
          <TabsTrigger value="requests">Заявки</TabsTrigger>
        </TabsList>

        <TabsContent value="linked">
          <Card>
            <CardHeader>
              <CardTitle>Свързани ученици</CardTitle>
              <CardDescription>
                Ученици, които са приели вашата заявка за свързване. Можете да
                видите техните оценки, присъствия и друга информация.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                </div>
              ) : linkedChildren.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <UserRound className="mx-auto h-12 w-12 mb-4 text-gray-400" />
                  <p className="text-lg font-medium">Няма свързани ученици</p>
                  <p className="text-sm mt-1">
                    Използвайте формата по-горе, за да изпратите заявка за
                    свързване с вашето дете.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {linkedChildren.map((child) => {
                    const linkRequest = linkRequests.find(
                      (req) =>
                        req.childId === child.childId &&
                        req.status === "accepted"
                    );

                    return (
                      <div
                        key={child.childId}
                        className="border rounded-lg p-4"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <UserRound className="h-5 w-5 text-gray-500" />
                              <h3 className="font-medium text-lg">
                                {child.childName}
                              </h3>
                            </div>
                            <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                              <Mail className="h-4 w-4" />
                              <span>{child.childEmail}</span>
                            </div>
                          </div>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash className="h-5 w-5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Премахване на връзка
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Сигурни ли сте, че искате да премахнете
                                  връзката с {child.childName}? Ще загубите
                                  достъп до информацията за този ученик.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Отказ</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    linkRequest &&
                                    handleUnlink(
                                      linkRequest.id,
                                      child.childName
                                    )
                                  }
                                  className="bg-red-500 hover:bg-red-700"
                                >
                                  Премахни
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                          <Button
                            variant="outline"
                            onClick={() =>
                              router.push(
                                `/parent/grades?childId=${child.childId}`
                              )
                            }
                          >
                            Оценки
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() =>
                              router.push(
                                `/parent/attendance?childId=${child.childId}`
                              )
                            }
                          >
                            Присъствия
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() =>
                              router.push(
                                `/parent/assignments?childId=${child.childId}`
                              )
                            }
                          >
                            Задачи
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() =>
                              router.push(
                                `/parent/timetable?childId=${child.childId}`
                              )
                            }
                          >
                            Разписание
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle>Заявки за свързване</CardTitle>
              <CardDescription>
                Заявки, които сте изпратили на ученици, за да се свържете с тях
                като родител.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                </div>
              ) : linkRequests.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="mx-auto h-12 w-12 mb-4 text-gray-400" />
                  <p className="text-lg font-medium">Няма изпратени заявки</p>
                  <p className="text-sm mt-1">
                    Използвайте формата по-горе, за да изпратите заявка за
                    свързване.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {linkRequests.map((request) => (
                    <div key={request.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2">
                            <Mail className="h-5 w-5 text-gray-500" />
                            <span className="font-medium">
                              {request.childEmail}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            Изпратена на:{" "}
                            {new Date(
                              request.createdAt?.toDate()
                            ).toLocaleDateString("bg-BG")}
                          </div>
                        </div>
                        <div>{statusBadge(request.status)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
