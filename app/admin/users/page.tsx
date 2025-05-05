"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@/contexts/UserContext";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { UserBase, HomeroomClass } from "@/lib/interfaces";
import {
  handleAddUser,
  handleEditUser,
  handleDeleteUser,
  downloadImportTemplate,
  processImportFile,
  importUsers,
  UserFormData,
  UserData,
  BulkImportUserData,
} from "@/lib/userManagement";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import Sidebar from "@/components/functional/Sidebar";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
  Upload,
  Pencil,
  Trash2,
  Search,
  X,
  Filter,
  ArrowDownUp,
  Download,
  Loader2,
} from "lucide-react";

type UserRole = "admin" | "teacher" | "student" | "parent";

export default function UserManagement() {
  const { user } = useUser();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [classes, setClasses] = useState<HomeroomClass[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({
    key: "lastName",
    direction: "asc",
  });

  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [userFormData, setUserFormData] = useState<UserFormData>({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    role: "student",
    gender: "male",
  });

  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importData, setImportData] = useState<BulkImportUserData[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const fetchUsers = useCallback(async () => {
    if (!user?.schoolId) return;

    setIsLoading(true);
    try {
      const usersRef = collection(doc(db, "schools", user.schoolId), "users");
      const snapshot = await getDocs(usersRef);

      const fetchedUsers: UserData[] = [];
      snapshot.forEach((doc) => {
        const userData = doc.data() as UserData;
        fetchedUsers.push({
          ...userData,
          userId: doc.id,
        });
      });

      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user?.schoolId]);

  const fetchClasses = useCallback(async () => {
    if (!user?.schoolId) return;

    try {
      console.log("Fetching classes for school:", user.schoolId);

      const classesRef = collection(db, "schools", user.schoolId, "classes");
      const snapshot = await getDocs(classesRef);

      if (snapshot.empty) {
        console.log("No classes found in the database");
        setClasses([]);
        toast({
          title: "Information",
          description:
            "No classes found. Please add classes in the Classes Management section.",
        });
        return;
      }

      const fetchedClasses: HomeroomClass[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const className = data.className || data.name || `Class ${doc.id}`;

        fetchedClasses.push({
          ...data,
          classId: doc.id,
          className: className,
          studentIds: data.studentIds || [],
          teacherSubjectPairs: data.teacherSubjectPairs || [],
          namingFormat: data.namingFormat || "custom",
          classTeacherId: data.classTeacherId || "",
        } as HomeroomClass);
      });

      fetchedClasses.sort((a, b) => {
        if (a.gradeNumber !== undefined && b.gradeNumber !== undefined) {
          if (a.gradeNumber !== b.gradeNumber) {
            return a.gradeNumber - b.gradeNumber;
          }
          if (a.classLetter && b.classLetter) {
            return a.classLetter.localeCompare(b.classLetter);
          }
        }
        return (a.className || "").localeCompare(b.className || "");
      });

      console.log(
        `Successfully fetched ${fetchedClasses.length} classes:`,
        fetchedClasses.map((c) => `${c.classId}: ${c.className}`)
      );

      setClasses(fetchedClasses);
    } catch (error) {
      console.error("Error fetching classes:", error);
      toast({
        title: "Error",
        description: "Failed to load classes. Please try again.",
        variant: "destructive",
      });
    }
  }, [user?.schoolId]);

  useEffect(() => {
    if (user?.role !== "admin") {
      router.push("/login");
    } else {
      fetchUsers();
      fetchClasses();
    }
  }, [user, router, fetchUsers, fetchClasses]);

  useEffect(() => {
    let result = [...users];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (user) =>
          user.firstName.toLowerCase().includes(query) ||
          user.lastName.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
      );
    }

    if (roleFilter !== "all") {
      result = result.filter((user) => user.role === roleFilter);
    }

    result.sort((a, b) => {
      const key = sortConfig.key as keyof UserData;
      const valueA = (a[key] as string | number) || "";
      const valueB = (b[key] as string | number) || "";

      if (valueA < valueB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valueA > valueB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    setFilteredUsers(result);
  }, [users, searchQuery, roleFilter, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId) return;

    setIsSubmitting(true);
    try {
      const userId = await handleAddUser(user.schoolId, userFormData);

      if (userId) {
        setUserFormData({
          firstName: "",
          lastName: "",
          email: "",
          phoneNumber: "",
          role: "student",
          gender: "male",
        });

        setIsAddUserDialogOpen(false);
        fetchUsers();
        fetchClasses();
      }
    } catch (error) {
      console.error("Error calling handleAddUser:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId || !selectedUser?.userId) return;

    setIsSubmitting(true);
    try {
      const success = await handleEditUser(
        user.schoolId,
        selectedUser.userId,
        userFormData,
        selectedUser.email
      );

      if (success) {
        setIsEditUserDialogOpen(false);
        fetchUsers();
        fetchClasses();
      }
    } catch (error) {
      console.error("Error updating user:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUserSubmit = async () => {
    if (!user?.schoolId || !selectedUser) return;

    setIsSubmitting(true);
    try {
      const success = await handleDeleteUser(user.schoolId, selectedUser);

      if (success) {
        setIsDeleteDialogOpen(false);
        fetchUsers();

        // Refresh classes data if a teacher or student was deleted
        if (
          selectedUser.role === "teacher" ||
          selectedUser.role === "student"
        ) {
          fetchClasses();
        }
      }
    } catch (error) {
      console.error("Error deleting user:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportErrors([]);
    setImportData([]);

    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { processedData, errors } = await processImportFile(file);

      setImportErrors(errors);
      setImportData(processedData);

      if (errors.length > 0 && processedData.length === 0) {
        toast({
          title: "Error",
          description:
            "No valid data to import. Please check the errors and try again.",
          variant: "destructive",
        });
      } else if (errors.length > 0) {
        toast({
          title: "Warning",
          description: `Found ${errors.length} errors. Some rows will not be imported.`,
          variant: "destructive",
        });
      } else if (processedData.length > 0) {
        toast({
          title: "Success",
          description: `Ready to import ${processedData.length} users.`,
        });
      }
    } catch (error) {
      console.error("Error processing import file:", error);
      toast({
        title: "Error",
        description:
          "Failed to parse file. Please ensure it's a valid Excel file.",
        variant: "destructive",
      });
    }
  };

  const handleImportUsers = async () => {
    if (!user?.schoolId || importData.length === 0) return;

    setIsSubmitting(true);
    try {
      const success = await importUsers(user.schoolId, importData);

      if (success) {
        setIsImportDialogOpen(false);
        fetchUsers();
        fetchClasses();
      }
    } catch (error) {
      console.error("Error importing users:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Function to check if a user can be deleted - prevent admins from deleting themselves or other admins
  function canDeleteUser(userData: UserData | null): boolean {
    // If userData is null or undefined, we can't delete
    if (!userData) {
      return false;
    }

    // Admin cannot delete themselves
    if (userData.userId === user?.userId) {
      return false;
    }

    // Admin cannot delete other admins
    if (userData.role === "admin") {
      return false;
    }

    return true;
  }

  function getRoleBadgeStyle(role: string) {
    switch (role) {
      case "admin":
        return "bg-blue-100 text-blue-800";
      case "teacher":
        return "bg-green-100 text-green-800";
      case "student":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  function handleEditClick(user: UserData) {
    setSelectedUser(user);
    setUserFormData({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      gender: user.gender,
      homeroomClassId: user.homeroomClassId,
      childrenIds: user.childrenIds,
      teachesClasses: user.teachesClasses || [],
    });
    setIsEditUserDialogOpen(true);
  }

  function handleDeleteClick(user: UserData) {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  }

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="flex-1 p-8 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                Управление на потребители
              </h1>
              <p className="text-gray-600 mt-1">
                Добавяне, редактиране и управление на потребители в училището
              </p>
            </div>

            <div className="flex gap-3">
              <Dialog
                open={isImportDialogOpen}
                onOpenChange={setIsImportDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    <span>Масов импорт</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Масов импорт на потребители</DialogTitle>
                    <DialogDescription>
                      Качете Excel файл с данни за потребители за едновременно
                      импортиране на множество потребители.
                      <Button
                        onClick={downloadImportTemplate}
                        variant="outline"
                        className="mt-2"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Изтегли шаблон
                      </Button>
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="border rounded-md p-4">
                      <Label htmlFor="file-upload">Качете Excel файл</Label>
                      <Input
                        id="file-upload"
                        type="file"
                        accept=".xlsx, .xls"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="mt-2"
                      />
                    </div>

                    {importErrors.length > 0 && (
                      <div className="border border-red-300 bg-red-50 rounded-md p-4">
                        <p className="font-medium text-red-800 mb-2">Грешки:</p>
                        <ScrollArea className="h-40">
                          <ul className="list-disc pl-5 space-y-1">
                            {importErrors.map((error, index) => (
                              <li key={index} className="text-red-700 text-sm">
                                {error}
                              </li>
                            ))}
                          </ul>
                        </ScrollArea>
                      </div>
                    )}

                    {importData.length > 0 && (
                      <div>
                        <p className="font-medium mb-2">
                          Преглед ({importData.length} потребители):
                        </p>
                        <ScrollArea className="h-40 border rounded-md">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Име</TableHead>
                                <TableHead>Роля</TableHead>
                                <TableHead>Клас</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {importData.map((user, index) => (
                                <TableRow key={index}>
                                  <TableCell>
                                    {user.firstName} {user.lastName}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{user.role}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    {["student", "teacher"].includes(
                                      user.role
                                    ) ? (
                                      user.classNamingFormat === "graded" ? (
                                        `${user.yearGroup}${user.classLetter}`
                                      ) : (
                                        user.customClassName
                                      )
                                    ) : (
                                      <span className="text-gray-400">N/A</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsImportDialogOpen(false)}
                    >
                      Отказ
                    </Button>
                    <Button
                      onClick={handleImportUsers}
                      disabled={
                        importData.length === 0 ||
                        importErrors.length > 0 ||
                        isSubmitting
                      }
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Импортиране...
                        </>
                      ) : (
                        "Импортирай потребители"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog
                open={isAddUserDialogOpen}
                onOpenChange={setIsAddUserDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2 text-white">
                    <UserPlus className="h-4 w-4" />
                    <span>Добави потребител</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Добавяне на нов потребител</DialogTitle>
                    <DialogDescription>
                      Попълнете необходимата информация за създаване на нов
                      потребител
                    </DialogDescription>
                  </DialogHeader>

                  <form
                    onSubmit={handleAddUserSubmit}
                    className="space-y-4 my-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">Име *</Label>
                        <Input
                          id="firstName"
                          value={userFormData.firstName}
                          onChange={(e) =>
                            setUserFormData({
                              ...userFormData,
                              firstName: e.target.value,
                            })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="lastName">Фамилия *</Label>
                        <Input
                          id="lastName"
                          value={userFormData.lastName}
                          onChange={(e) =>
                            setUserFormData({
                              ...userFormData,
                              lastName: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Имейл *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={userFormData.email}
                        onChange={(e) =>
                          setUserFormData({
                            ...userFormData,
                            email: e.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phoneNumber">Телефон</Label>
                        <Input
                          id="phoneNumber"
                          value={userFormData.phoneNumber}
                          onChange={(e) =>
                            setUserFormData({
                              ...userFormData,
                              phoneNumber: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="gender">Пол</Label>
                        <Select
                          value={userFormData.gender}
                          onValueChange={(value) =>
                            setUserFormData({ ...userFormData, gender: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Избери пол" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Мъж</SelectItem>
                            <SelectItem value="female">Жена</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="role">Роля *</Label>
                      <Select
                        value={userFormData.role}
                        onValueChange={(value: UserRole) =>
                          setUserFormData({ ...userFormData, role: value })
                        }
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Избери роля" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Администратор</SelectItem>
                          <SelectItem value="teacher">Учител</SelectItem>
                          <SelectItem value="student">Ученик</SelectItem>
                          <SelectItem value="parent">Родител</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {userFormData.role === "student" && (
                      <div className="space-y-2">
                        <Label htmlFor="homeroomClassId">Клас *</Label>
                        <Select
                          value={userFormData.homeroomClassId}
                          onValueChange={(value) =>
                            setUserFormData({
                              ...userFormData,
                              homeroomClassId: value,
                            })
                          }
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Избери клас" />
                          </SelectTrigger>
                          <SelectContent>
                            {classes.map((cls) => (
                              <SelectItem key={cls.classId} value={cls.classId}>
                                {cls.className}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {userFormData.role === "teacher" && (
                      <div className="space-y-2">
                        <Label>Преподавани класове</Label>
                        <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                          {classes.length === 0 ? (
                            <p className="text-sm text-gray-500">
                              Няма налични класове
                            </p>
                          ) : (
                            classes.map((cls) => (
                              <div
                                key={cls.classId}
                                className="flex items-center space-x-2"
                              >
                                <input
                                  type="checkbox"
                                  id={`add-class-${cls.classId}`}
                                  checked={
                                    userFormData.teachesClasses?.includes(
                                      cls.classId
                                    ) ?? false
                                  }
                                  onChange={(e) => {
                                    const newClasses = e.target.checked
                                      ? [
                                          ...(userFormData.teachesClasses ||
                                            []),
                                          cls.classId,
                                        ]
                                      : userFormData.teachesClasses?.filter(
                                          (id) => id !== cls.classId
                                        ) || [];
                                    setUserFormData({
                                      ...userFormData,
                                      teachesClasses: newClasses,
                                    });
                                  }}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <label
                                  htmlFor={`add-class-${cls.classId}`}
                                  className="text-sm"
                                >
                                  {cls.className}
                                </label>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddUserDialogOpen(false)}
                      >
                        Отказ
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Добавяне...
                          </>
                        ) : (
                          "Добави"
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Търсене по име, фамилия или имейл..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600"
                      onClick={() => setSearchQuery("")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex gap-3">
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-[180px]">
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        <SelectValue placeholder="Филтър по роля" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Всички роли</SelectItem>
                      <SelectItem value="admin">Администратори</SelectItem>
                      <SelectItem value="teacher">Учители</SelectItem>
                      <SelectItem value="student">Ученици</SelectItem>
                      <SelectItem value="parent">Родители</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isLoading ? (
                <div className="text-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                  <p className="mt-2 text-gray-500">
                    Зареждане на потребители...
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">#</TableHead>
                          <TableHead>
                            <button
                              className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                              onClick={() => handleSort("lastName")}
                            >
                              Име и фамилия
                              {sortConfig.key === "lastName" && (
                                <ArrowDownUp className="h-3 w-3" />
                              )}
                            </button>
                          </TableHead>
                          <TableHead>
                            <button
                              className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                              onClick={() => handleSort("email")}
                            >
                              Имейл
                              {sortConfig.key === "email" && (
                                <ArrowDownUp className="h-3 w-3" />
                              )}
                            </button>
                          </TableHead>
                          <TableHead>
                            <button
                              className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                              onClick={() => handleSort("role")}
                            >
                              Роля
                              {sortConfig.key === "role" && (
                                <ArrowDownUp className="h-3 w-3" />
                              )}
                            </button>
                          </TableHead>
                          <TableHead>Клас</TableHead>
                          <TableHead className="w-[140px] text-right">
                            Действия
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="text-center py-10 text-gray-500"
                            >
                              Няма намерени потребители
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredUsers.map((userData, index) => (
                            <TableRow key={userData.userId}>
                              <TableCell className="font-medium">
                                {index + 1}
                              </TableCell>
                              <TableCell>
                                {userData.firstName} {userData.lastName}
                              </TableCell>
                              <TableCell>{userData.email}</TableCell>
                              <TableCell>
                                <Badge
                                  className={`${getRoleBadgeStyle(
                                    userData.role
                                  )} border`}
                                >
                                  {userData.role === "admin" && "Администратор"}
                                  {userData.role === "teacher" && "Учител"}
                                  {userData.role === "student" && "Ученик"}
                                  {userData.role === "parent" && "Родител"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {userData.role === "student" &&
                                userData.homeroomClassId
                                  ? classes.find(
                                      (cls) =>
                                        cls.classId === userData.homeroomClassId
                                    )?.className || "N/A"
                                  : userData.role === "teacher" &&
                                    userData.teachesClasses?.length
                                  ? userData.teachesClasses
                                      .map(
                                        (classId) =>
                                          classes.find(
                                            (cls) => cls.classId === classId
                                          )?.className || "N/A"
                                      )
                                      .join(", ")
                                  : "N/A"}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditClick(userData)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`${
                                      canDeleteUser(userData)
                                        ? "text-red-500 hover:text-red-700 hover:bg-red-50"
                                        : "text-gray-400 cursor-not-allowed"
                                    }`}
                                    onClick={() =>
                                      canDeleteUser(userData) &&
                                      handleDeleteClick(userData)
                                    }
                                    disabled={!canDeleteUser(userData)}
                                    title={
                                      !canDeleteUser(userData)
                                        ? userData.userId === user?.userId
                                          ? "Не можете да изтриете собствения си акаунт"
                                          : "Администраторите не могат да бъдат изтрити"
                                        : "Изтрий потребителя"
                                    }
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="mt-4 text-sm text-gray-500">
                    Показани {filteredUsers.length} от {users.length}{" "}
                    потребители
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={isEditUserDialogOpen}
        onOpenChange={setIsEditUserDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактиране на потребител</DialogTitle>
            <DialogDescription>
              Променете данните за избрания потребител
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditUserSubmit} className="space-y-4 my-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Име *</Label>
                <Input
                  id="firstName"
                  value={userFormData.firstName}
                  onChange={(e) =>
                    setUserFormData({
                      ...userFormData,
                      firstName: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Фамилия *</Label>
                <Input
                  id="lastName"
                  value={userFormData.lastName}
                  onChange={(e) =>
                    setUserFormData({
                      ...userFormData,
                      lastName: e.target.value,
                    })
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Имейл *</Label>
              <Input
                id="email"
                type="email"
                value={userFormData.email}
                onChange={(e) =>
                  setUserFormData({ ...userFormData, email: e.target.value })
                }
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Телефон</Label>
                <Input
                  id="phoneNumber"
                  value={userFormData.phoneNumber}
                  onChange={(e) =>
                    setUserFormData({
                      ...userFormData,
                      phoneNumber: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender">Пол</Label>
                <Select
                  value={userFormData.gender}
                  onValueChange={(value) =>
                    setUserFormData({ ...userFormData, gender: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Избери пол" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Мъж</SelectItem>
                    <SelectItem value="female">Жена</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {userFormData.role === "student" && (
              <div className="space-y-2">
                <Label htmlFor="homeroomClassId">Клас *</Label>
                <Select
                  value={userFormData.homeroomClassId}
                  onValueChange={(value) =>
                    setUserFormData({ ...userFormData, homeroomClassId: value })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Избери клас" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.classId} value={cls.classId}>
                        {cls.className}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {userFormData.role === "teacher" && (
              <div className="space-y-2">
                <Label>Преподавани класове</Label>
                <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                  {classes.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      Няма налични класове
                    </p>
                  ) : (
                    classes.map((cls) => (
                      <div
                        key={cls.classId}
                        className="flex items-center space-x-2"
                      >
                        <input
                          type="checkbox"
                          id={`class-${cls.classId}`}
                          checked={
                            userFormData.teachesClasses?.includes(
                              cls.classId
                            ) ?? false
                          }
                          onChange={(e) => {
                            const newClasses = e.target.checked
                              ? [
                                  ...(userFormData.teachesClasses || []),
                                  cls.classId,
                                ]
                              : userFormData.teachesClasses?.filter(
                                  (id) => id !== cls.classId
                                ) || [];
                            setUserFormData({
                              ...userFormData,
                              teachesClasses: newClasses,
                            });
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label
                          htmlFor={`class-${cls.classId}`}
                          className="text-sm"
                        >
                          {cls.className}
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditUserDialogOpen(false)}
              >
                Отказ
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Запазване...
                  </>
                ) : (
                  "Запази"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Изтриване на потребител</DialogTitle>
            <DialogDescription>
              Сигурни ли сте, че искате да изтриете този потребител? Това
              действие не може да бъде отменено.
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="py-4">
              <p className="font-medium">
                {selectedUser.firstName} {selectedUser.lastName}
              </p>
              <p className="text-sm text-gray-500">{selectedUser.email}</p>
              <Badge
                className={`${getRoleBadgeStyle(
                  selectedUser.role
                )} border mt-2`}
              >
                {selectedUser.role === "admin" && "Администратор"}
                {selectedUser.role === "teacher" && "Учител"}
                {selectedUser.role === "student" && "Ученик"}
                {selectedUser.role === "parent" && "Родител"}
              </Badge>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Отказ
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUserSubmit}
              disabled={
                isSubmitting ||
                (selectedUser ? !canDeleteUser(selectedUser) : true)
              }
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Изтриване...
                </>
              ) : selectedUser && !canDeleteUser(selectedUser) ? (
                "Изтриването не е разрешено"
              ) : (
                "Изтрий"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
