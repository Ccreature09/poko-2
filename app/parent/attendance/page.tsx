"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { useAttendance } from "@/contexts/AttendanceContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  CalendarIcon,
  BookOpenText,
  Clock,
  AlertCircle,
  Users,
} from "lucide-react";
import Sidebar from "@/components/functional/Sidebar";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Child {
  id: string;
  name: string;
  classId?: string;
  className?: string;
}

export default function ParentAttendance() {
  const { user } = useUser();
  const {
    filteredRecords,
    loading,
    error,
    presentCount,
    absentCount,
    lateCount,
    excusedCount,
    presentRate,
    absentRate,
    lateRate,
    excusedRate,
    recordsByDate,
    recordsBySubject,
    filterDays,
    setFilterDays,
    fetchRecords,
  } = useAttendance();

  const [activeTab, setActiveTab] = useState("all");
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [isLoadingChildren, setIsLoadingChildren] = useState(true);
  const [childrenError, setChildrenError] = useState<string | null>(null);

  // Helper function to determine status background color
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200"
          >
            Присъства
          </Badge>
        );
      case "absent":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-200"
          >
            Отсъства
          </Badge>
        );
      case "late":
        return (
          <Badge
            variant="outline"
            className="bg-yellow-50 text-yellow-700 border-yellow-200"
          >
            Закъснява
          </Badge>
        );
      case "excused":
        return (
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-200"
          >
            Извинен
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Fetch parent's children
  useEffect(() => {
    if (!user || user.role !== "parent" || !user.schoolId || !user.userId)
      return;

    const fetchChildren = async () => {
      setIsLoadingChildren(true);
      setChildrenError(null);

      try {
        // Get the parent document to access childrenIds
        const schoolId = user.schoolId as string;
        const userId = user.userId as string;
        const parentDoc = await getDoc(
          doc(db, "schools", schoolId, "users", userId)
        );
        if (!parentDoc.exists()) {
          console.error("Parent document not found");
          setChildrenError("Parent document not found");
          return;
        }

        const parentData = parentDoc.data();
        const childrenIds = parentData.childrenIds || [];
        const childrenList: Child[] = [];

        // Fetch details for each child
        for (const childId of childrenIds) {
          const childDoc = await getDoc(
            doc(db, "schools", user.schoolId, "users", childId)
          );
          if (childDoc.exists() && childDoc.data().role === "student") {
            const childData = childDoc.data();

            // Get class name if available
            let className = "";
            if (childData.homeroomClassId) {
              const classDoc = await getDoc(
                doc(
                  db,
                  "schools",
                  user.schoolId,
                  "classes",
                  childData.homeroomClassId
                )
              );
              if (classDoc.exists()) {
                className = classDoc.data().name || "";
              }
            }

            childrenList.push({
              id: childId,
              name: `${childData.firstName} ${childData.lastName}`,
              classId: childData.homeroomClassId,
              className: className,
            });
          }
        }

        setChildren(childrenList);
        if (childrenList.length > 0 && !selectedChildId) {
          setSelectedChildId(childrenList[0].id);
        }
      } catch (error) {
        console.error("Failed to fetch children:", error);
        setChildrenError("Failed to load children information.");
      } finally {
        setIsLoadingChildren(false);
      }
    };

    fetchChildren();
  }, [user, selectedChildId]);

  // Fetch attendance records for selected child using the AttendanceContext
  useEffect(() => {
    if (!selectedChildId) return;

    // Use the fetchRecords function from the AttendanceContext
    fetchRecords(selectedChildId);
  }, [selectedChildId, filterDays, fetchRecords]);

  if (!user || user.role !== "parent") {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex-1 p-8 bg-gray-50 flex items-center justify-center">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <h3 className="text-lg font-medium">Достъп отказан</h3>
                <p className="text-gray-500 mt-2">
                  Само родители могат да достъпват тази страница.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const selectedChild = children.find((child) => child.id === selectedChildId);
  const attendanceRecords = filteredRecords;

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Sidebar />
      <div className="flex-1 p-4 md:p-8 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-2 text-gray-800">
            Присъствия на детето
          </h1>
          <p className="text-gray-600 mb-6">
            Преглед и проследяване на записите за присъствие на вашето дете
          </p>

          {/* Child selector */}
          {isLoadingChildren ? (
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-md">
              <p className="text-gray-500">Зареждане на деца...</p>
            </div>
          ) : childrenError ? (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-700">{childrenError}</p>
            </div>
          ) : children.length > 0 ? (
            <div className="mb-6">
              <label
                htmlFor="childSelect"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Изберете дете
              </label>
              <Select
                value={selectedChildId || ""}
                onValueChange={(value) => setSelectedChildId(value)}
              >
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue placeholder="Изберете дете" />
                </SelectTrigger>
                <SelectContent>
                  {children.map((child) => (
                    <SelectItem key={child.id} value={child.id}>
                      {child.name}{" "}
                      {child.className ? `(${child.className})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-yellow-700">
                Не са намерени деца към вашия акаунт.
              </p>
            </div>
          )}

          {/* Time filter buttons */}
          {selectedChildId && (
            <div className="mb-6 flex flex-wrap gap-2">
              <Button
                variant={filterDays === 7 ? "default" : "outline"}
                onClick={() => setFilterDays(7)}
                size="sm"
                className={filterDays === 7 ? "text-white" : ""}
              >
                Последните 7 дни
              </Button>
              <Button
                variant={filterDays === 30 ? "default" : "outline"}
                onClick={() => setFilterDays(30)}
                size="sm"
                className={filterDays === 30 ? "text-white" : ""}
              >
                Последните 30 дни
              </Button>
              <Button
                variant={filterDays === 90 ? "default" : "outline"}
                onClick={() => setFilterDays(90)}
                size="sm"
                className={filterDays === 90 ? "text-white" : ""}
              >
                Последните 3 месеца
              </Button>
              <Button
                variant={filterDays === 180 ? "default" : "outline"}
                onClick={() => setFilterDays(180)}
                size="sm"
                className={filterDays === 180 ? "text-white" : ""}
              >
                Последните 6 месеца
              </Button>
            </div>
          )}

          {!selectedChildId ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-800">
                Моля, изберете дете
              </h3>
              <p className="text-gray-500 mt-2">
                Изберете дете от падащото меню, за да видите неговите записи за
                присъствие.
              </p>
            </div>
          ) : loading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
                Зареждане на записите за присъствие...
              </p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-2" />
              <p className="text-red-500">{error}</p>
            </div>
          ) : attendanceRecords.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <CalendarIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-800">
                Няма записи за присъствие
              </h3>
              <p className="text-gray-500 mt-2">
                Не са намерени записи за присъствие за {selectedChild?.name} в
                избрания период от време.
              </p>
            </div>
          ) : (
            <>
              {/* Attendance Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-white">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-500">
                        Присъства
                      </p>
                      <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                        <CalendarIcon className="h-5 w-5 text-green-600" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold mt-2">{presentCount}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {presentRate.toFixed(1)}% от всички
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-white">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-500">
                        Отсъства
                      </p>
                      <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold mt-2">{absentCount}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {absentRate.toFixed(1)}% от всички
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-white">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-500">
                        Закъснява
                      </p>
                      <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-yellow-600" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold mt-2">{lateCount}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {lateRate.toFixed(1)}% от всички
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-white">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-500">
                        Извинен
                      </p>
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <BookOpenText className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold mt-2">{excusedCount}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {excusedRate.toFixed(1)}% от всички
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Attendance Records Tabs */}
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle>
                    Записи за присъствие за {selectedChild?.name}
                  </CardTitle>
                  <CardDescription>
                    Скорошна история на присъствията
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="mb-4"
                  >
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="all">Всички записи</TabsTrigger>
                      <TabsTrigger value="by-date">По дата</TabsTrigger>
                      <TabsTrigger value="by-subject">По предмет</TabsTrigger>
                    </TabsList>

                    {/* All Records Tab */}
                    <TabsContent value="all">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Дата</TableHead>
                            <TableHead>Предмет</TableHead>
                            <TableHead>Час</TableHead>
                            <TableHead>Статус</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {attendanceRecords.length > 0 ? (
                            attendanceRecords.map((record) => (
                              <TableRow
                                key={record.attendanceId}
                                className="hover:bg-gray-50"
                                onClick={(e) => e.preventDefault()}
                              >
                                <TableCell>
                                  {format(record.date.toDate(), "PPP")}
                                </TableCell>
                                <TableCell>{record.subjectName}</TableCell>
                                <TableCell>{record.periodNumber}</TableCell>
                                <TableCell>
                                  {getStatusBadge(record.status)}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell
                                colSpan={4}
                                className="text-center py-4"
                              >
                                Не са намерени записи за присъствие
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>

                    {/* By Date Tab */}
                    <TabsContent value="by-date">
                      {Object.entries(recordsByDate).length > 0 ? (
                        Object.entries(recordsByDate)
                          .sort(
                            ([dateA], [dateB]) =>
                              new Date(dateB).getTime() -
                              new Date(dateA).getTime()
                          )
                          .map(([date, records]) => (
                            <div key={date} className="mb-6">
                              <h3 className="text-md font-medium text-gray-700 mb-2">
                                {format(new Date(date), "PPPP")}
                              </h3>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Предмет</TableHead>
                                    <TableHead>Час</TableHead>
                                    <TableHead>Статус</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {records.map((record) => (
                                    <TableRow key={record.attendanceId}>
                                      <TableCell>
                                        {record.subjectName}
                                      </TableCell>
                                      <TableCell>
                                        {record.periodNumber}
                                      </TableCell>
                                      <TableCell>
                                        {getStatusBadge(record.status)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          ))
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-gray-500">
                            Не са намерени записи за присъствие
                          </p>
                        </div>
                      )}
                    </TabsContent>

                    {/* By Subject Tab */}
                    <TabsContent value="by-subject">
                      {Object.entries(recordsBySubject).length > 0 ? (
                        Object.entries(recordsBySubject)
                          .sort(([subjectA], [subjectB]) =>
                            subjectA.localeCompare(subjectB)
                          )
                          .map(([subject, records]) => (
                            <div key={subject} className="mb-6">
                              <h3 className="text-md font-medium text-gray-700 mb-2">
                                {subject}
                              </h3>
                              <div className="flex gap-4 mb-2">
                                <div className="flex items-center gap-1">
                                  <div className="h-3 w-3 rounded-full bg-green-500"></div>
                                  <span className="text-xs">
                                    Присъства:{" "}
                                    {
                                      records.filter(
                                        (r) => r.status === "present"
                                      ).length
                                    }
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="h-3 w-3 rounded-full bg-red-500"></div>
                                  <span className="text-xs">
                                    Отсъства:{" "}
                                    {
                                      records.filter(
                                        (r) => r.status === "absent"
                                      ).length
                                    }
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                                  <span className="text-xs">
                                    Закъснява:{" "}
                                    {
                                      records.filter((r) => r.status === "late")
                                        .length
                                    }
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                                  <span className="text-xs">
                                    Извинен:{" "}
                                    {
                                      records.filter(
                                        (r) => r.status === "excused"
                                      ).length
                                    }
                                  </span>
                                </div>
                              </div>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Дата</TableHead>
                                    <TableHead>Час</TableHead>
                                    <TableHead>Статус</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {records
                                    .sort(
                                      (a, b) =>
                                        b.date.toDate().getTime() -
                                        a.date.toDate().getTime()
                                    )
                                    .map((record) => (
                                      <TableRow key={record.attendanceId}>
                                        <TableCell>
                                          {format(record.date.toDate(), "PPP")}
                                        </TableCell>
                                        <TableCell>
                                          {record.periodNumber}
                                        </TableCell>
                                        <TableCell>
                                          {getStatusBadge(record.status)}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                </TableBody>
                              </Table>
                            </div>
                          ))
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-gray-500">
                            Не са намерени записи за присъствие
                          </p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
