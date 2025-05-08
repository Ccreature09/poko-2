// UserManagement Component - Handles creation and administration of school users
// Allows creating, editing, and managing users with different roles (admin, teacher, student, parent)
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@/contexts/UserContext";
import { useRouter } from "next/navigation";
import { collection, getDocs, doc } from "firebase/firestore";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import type { HomeroomClass } from "@/lib/interfaces";
import {
  handleAddUser,
  handleEditUser,
  handleDeleteUser,
  downloadImportTemplate,
  processImportFile,
  importUsers,
  exportUsersData,
} from "@/lib/management/userManagement";
import { UserData, UserFormData } from "@/lib/interfaces";

// UI Components
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
import Sidebar from "@/components/functional/layout/Sidebar";
import { UserAccountFeedback } from "@/components/functional/UserAccountFeedback";
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
  FileDown,
} from "lucide-react";

// Type definitions
type UserRole = "admin" | "teacher" | "student" | "parent";

export default function UserManagement() {
  const { user } = useUser();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Main state for users and filtering
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

  // Dialog control states
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAccountFeedbackOpen, setIsAccountFeedbackOpen] = useState(false);
  const [isExportPasswordDialogOpen, setIsExportPasswordDialogOpen] =
    useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

  // Form data and user management
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
  const [importData, setImportData] = useState<UserData[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  // Account creation results tracking
  const [accountCreationResults, setAccountCreationResults] = useState<{
    successAccounts: {
      email: string;
      password: string;
      userId: string;
      role?: string;
    }[];
    failedAccounts: { email: string; error: string }[];
  }>({
    successAccounts: [],
    failedAccounts: [],
  });

  /**
   * Fetches all users for the current school
   */
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
        title: "Грешка",
        description: "Неуспешно зареждане на потребителите",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user?.schoolId]);

  /**
   * Fetches all classes for the current school
   * Used for assigning students and teachers to classes
   */
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
          title: "Информация",
          description:
            "Няма намерени класове. Моля, добавете класове в секцията за управление на класове.",
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
        title: "Грешка",
        description: "Неуспешно зареждане на класовете. Моля, опитайте отново.",
        variant: "destructive",
      });
    }
  }, [user?.schoolId]);

  useEffect(() => {
    // Authentication check and initial data loading
    if (user?.role !== "admin") {
      router.push("/login");
    } else {
      fetchUsers();
      fetchClasses();
    }
  }, [user, router, fetchUsers, fetchClasses]);

  /**
   * Gets a class name by ID
   * @param classId - The ID of the class
   * @returns The class name or a placeholder if not found
   */
  const getClassNameById = (classId: string | undefined): string => {
    if (!classId) return "None";

    const classObj = classes.find((cls) => cls.classId === classId);
    return classObj ? classObj.className : "Unknown Class";
  };

  useEffect(() => {
    // Filter, sort, and search users
    let result = [...users];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (user) =>
          user.firstName.toLowerCase().includes(query) ||
          user.lastName.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
      );
    }

    // Apply role filter
    if (roleFilter !== "all") {
      result = result.filter((user) => user.role === roleFilter);
    }

    // Apply sorting
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

  /**
   * Changes the sort order for a column
   * @param key - Column key to sort by
   */
  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  /**
   * Handles submission of the add user form
   * Creates a new user and shows account creation feedback
   * @param e - Form submission event
   */
  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId) return;

    setIsSubmitting(true);
    try {
      const result = await handleAddUser(user.schoolId, userFormData);

      if (result && result.success) {
        setAccountCreationResults({
          successAccounts: [
            {
              email: result.accountDetails?.email || userFormData.email,
              password:
                result.accountDetails?.password || "Password not available",
              userId: result.userId,
              role: userFormData.role,
            },
          ],
          failedAccounts: [],
        });

        setIsAddUserDialogOpen(false);
        setIsAccountFeedbackOpen(true);

        setUserFormData({
          firstName: "",
          lastName: "",
          email: "",
          phoneNumber: "",
          role: "student",
          gender: "male",
        });

        fetchUsers();
        fetchClasses();
        toast({
          title: "Успешно",
          description: "Потребителят е добавен успешно",
        });
      } else if (result && !result.success) {
        setAccountCreationResults({
          successAccounts: [],
          failedAccounts: [
            {
              email: userFormData.email,
              error: result.error || "Failed to create user account",
            },
          ],
        });
        setIsAddUserDialogOpen(false);
        setIsAccountFeedbackOpen(true);
        toast({
          title: "Грешка",
          description: "Неуспешно добавяне на потребител",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error calling handleAddUser:", error);

      setAccountCreationResults({
        successAccounts: [],
        failedAccounts: [
          {
            email: userFormData.email,
            error: (error as Error).message,
          },
        ],
      });
      setIsAddUserDialogOpen(false);
      setIsAccountFeedbackOpen(true);
      toast({
        title: "Грешка",
        description: "Неуспешно добавяне на потребител",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handles submission of the edit user form
   * Updates an existing user's data
   * @param e - Form submission event
   */
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
        toast({
          title: "Успешно",
          description: "Потребителят е актуализиран успешно",
        });
      }
    } catch (error) {
      console.error("Error updating user:", error);
      toast({
        title: "Грешка",
        description: "Неуспешно актуализиране на потребител",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handles deletion of a user
   * Removes the user from Firebase Auth and Firestore
   */
  const handleDeleteUserSubmit = async () => {
    if (!user?.schoolId || !selectedUser) return;

    setIsSubmitting(true);
    try {
      const success = await handleDeleteUser(user.schoolId, selectedUser);

      if (success) {
        setIsDeleteDialogOpen(false);
        fetchUsers();

        if (
          selectedUser.role === "teacher" ||
          selectedUser.role === "student"
        ) {
          fetchClasses();
        }
        toast({
          title: "Успешно",
          description: "Потребителят е изтрит успешно",
        });
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Грешка",
        description: "Неуспешно изтриване на потребител",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Processes an imported CSV/Excel file of users
   * Validates data and prepares for import
   * @param e - File input change event
   */
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
          title: "Грешка",
          description:
            "Няма валидни данни за импорт. Моля, проверете грешките и опитайте отново.",
          variant: "destructive",
        });
      } else if (errors.length > 0) {
        toast({
          title: "Предупреждение",
          description: `Открити са ${errors.length} грешки. Някои редове няма да бъдат импортирани.`,
          variant: "destructive",
        });
      } else if (processedData.length > 0) {
        toast({
          title: "Успешно",
          description: `Готови за импорт ${processedData.length} потребители.`,
        });
      }
    } catch (error) {
      console.error("Error processing import file:", error);
      toast({
        title: "Грешка",
        description:
          "Неуспешно обработване на файла. Уверете се, че е валиден Excel файл.",
        variant: "destructive",
      });
    }
  };

  /**
   * Handles importing users from prepared data
   * Creates multiple users at once from a file
   */
  const handleImportUsers = async () => {
    if (!user?.schoolId || importData.length === 0) return;

    setIsSubmitting(true);
    try {
      const result = await importUsers(user.schoolId, importData);

      if (result) {
        setIsImportDialogOpen(false);

        if (result.successAccounts && result.successAccounts.length > 0) {
          setAccountCreationResults({
            successAccounts: result.successAccounts,
            failedAccounts: result.failedAccounts || [],
          });
          setIsAccountFeedbackOpen(true);
        }

        setImportData([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }

        fetchUsers();
        fetchClasses();
        toast({
          title: "Успешно",
          description: "Потребителите са импортирани успешно.",
        });
      }
    } catch (error) {
      console.error("Error importing users:", error);
      toast({
        title: "Грешка",
        description: "Неуспешен импорт на потребители",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Verifies admin password and exports users data
   * Required to ensure data protection for sensitive operations
   * @param e - Form submission event
   */
  const verifyAndExportUsers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId || !auth.currentUser) return;

    setIsVerifyingPassword(true);
    try {
      // Create the credential
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email || "",
        exportPassword
      );

      // Reauthenticate the user
      await reauthenticateWithCredential(auth.currentUser, credential);

      // Close the dialog
      setIsExportPasswordDialogOpen(false);
      setExportPassword("");

      // Proceed with export
      await exportUsersData(user.schoolId);
      toast({
        title: "Успех",
        description: "Данните за потребителите са експортирани успешно.",
      });
    } catch (error) {
      console.error("Error in verification or export:", error);
      toast({
        title: "Грешка",
        description: "Неуспешна верификация. Моля, проверете паролата си.",
        variant: "destructive",
      });
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  /**
   * Determines if a user can be deleted
   * Administrators and the current user cannot be deleted
   * @param userData - User to check
   * @returns Boolean indicating if user can be deleted
   */
  function canDeleteUser(userData: UserData | null): boolean {
    if (!userData) {
      return false;
    }

    if (userData.userId === user?.userId) {
      return false;
    }

    if (userData.role === "admin") {
      return false;
    }

    return true;
  }

  /**
   * Gets badge styling for different user roles
   * @param role - Role of the user
   * @returns CSS class string for styling the badge
   */
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

  /**
   * Prepares the form for editing an existing user
   * @param user - The user to edit
   */
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
    });
    setIsEditUserDialogOpen(true);
  }

  /**
   * Prepares for user deletion
   * @param user - The user to delete
   */
  function handleDeleteClick(user: UserData) {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  }

  // Protect route - return null if user is not an admin
  if (!user || user.role !== "admin") {
    return null;
  }

  // Main component rendering
  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="flex-1 p-4 md:p-8 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
                Управление на потребители
              </h1>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">
                Добавяне, редактиране и управление на потребители в училището
              </p>
            </div>

            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Dialog
                open={isImportDialogOpen}
                onOpenChange={setIsImportDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 text-xs sm:text-sm h-9 sm:h-10"
                  >
                    <Upload className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden xs:inline">Масов импорт</span>
                    <span className="xs:hidden">Импорт</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Масов импорт на потребители</DialogTitle>
                    <DialogDescription>
                      Качете Excel файл с данни за потребители за едновременно
                      импортиране на множество потребители.
                      <Button
                        onClick={downloadImportTemplate}
                        variant="outline"
                        className="mt-2 text-xs sm:text-sm"
                        size="sm"
                      >
                        <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        Изтегли шаблон
                      </Button>
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="border rounded-md p-3 sm:p-4">
                      <Label htmlFor="file-upload">Качете Excel файл</Label>
                      <Input
                        id="file-upload"
                        type="file"
                        accept=".xlsx, .xls"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="mt-2 text-sm"
                      />
                    </div>

                    {importErrors.length > 0 && (
                      <div className="border border-red-300 bg-red-50 rounded-md p-3 sm:p-4">
                        <p className="font-medium text-red-800 mb-2 text-sm sm:text-base">
                          Грешки:
                        </p>
                        <ScrollArea className="h-32 sm:h-40">
                          <ul className="list-disc pl-5 space-y-1">
                            {importErrors.map((error, index) => (
                              <li
                                key={index}
                                className="text-red-700 text-xs sm:text-sm"
                              >
                                {error}
                              </li>
                            ))}
                          </ul>
                        </ScrollArea>
                      </div>
                    )}

                    {importData.length > 0 && (
                      <div>
                        <p className="font-medium mb-2 text-sm sm:text-base">
                          Преглед ({importData.length} потребители):
                        </p>
                        <ScrollArea className="h-32 sm:h-40 border rounded-md">
                          <div className="overflow-x-auto">
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
                                    <TableCell className="text-xs sm:text-sm">
                                      {user.firstName} {user.lastName}
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {user.role}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs sm:text-sm">
                                      {["student", "teacher"].includes(
                                        user.role
                                      ) ? (
                                        user.classNamingFormat === "graded" ? (
                                          `${user.gradeNumber}${user.classLetter}`
                                        ) : (
                                          user.customClassName
                                        )
                                      ) : (
                                        <span className="text-gray-400">-</span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>

                  <DialogFooter className="flex-col space-y-2 sm:space-y-0 sm:flex-row sm:justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setIsImportDialogOpen(false)}
                      className="w-full sm:w-auto text-xs sm:text-sm"
                      size="sm"
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
                      className="w-full sm:w-auto text-xs sm:text-sm"
                      size="sm"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" />
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
                open={isExportPasswordDialogOpen}
                onOpenChange={setIsExportPasswordDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 text-xs sm:text-sm h-9 sm:h-10"
                  >
                    <FileDown className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span>Експорт</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Експорт на потребители</DialogTitle>
                    <DialogDescription>
                      Моля, въведете паролата си, за да потвърдите експорта на
                      данни.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={verifyAndExportUsers} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="exportPassword">Парола</Label>
                      <Input
                        id="exportPassword"
                        type="password"
                        value={exportPassword}
                        onChange={(e) => setExportPassword(e.target.value)}
                        required
                      />
                    </div>
                    <DialogFooter className="flex-col space-y-2 sm:space-y-0 sm:flex-row">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsExportPasswordDialogOpen(false)}
                        className="w-full sm:w-auto text-xs sm:text-sm"
                        size="sm"
                      >
                        Отказ
                      </Button>
                      <Button
                        type="submit"
                        disabled={isVerifyingPassword}
                        className="w-full text-white sm:w-auto text-xs sm:text-sm"
                        size="sm"
                      >
                        {isVerifyingPassword ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                            Проверка...
                          </>
                        ) : (
                          "Експорт"
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog
                open={isAddUserDialogOpen}
                onOpenChange={setIsAddUserDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2 text-white text-xs sm:text-sm h-9 sm:h-10">
                    <UserPlus className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span>Добави потребител</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
                    {/* Move role selection to the top */}
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
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phoneNumber">
                          Телефон
                          {userFormData.role === "admin" ||
                          userFormData.role === "parent"
                            ? " *"
                            : ""}
                        </Label>
                        <Input
                          id="phoneNumber"
                          value={userFormData.phoneNumber}
                          onChange={(e) =>
                            setUserFormData({
                              ...userFormData,
                              phoneNumber: e.target.value,
                            })
                          }
                          required={
                            userFormData.role === "admin" ||
                            userFormData.role === "parent"
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

                    {/* Student-specific fields */}
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

                    {/* Teacher-specific fields */}
                    {userFormData.role === "teacher" && (
                      <div className="space-y-2">
                        <Label htmlFor="teacherHomeroom">
                          Класен ръководител на
                        </Label>
                        <Select
                          value={userFormData.homeroomClassId || "none"}
                          onValueChange={(value) =>
                            setUserFormData({
                              ...userFormData,
                              homeroomClassId:
                                value === "none" ? undefined : value,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Избери клас" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              Не е класен ръководител
                            </SelectItem>
                            {classes.map((cls) => (
                              <SelectItem key={cls.classId} value={cls.classId}>
                                {cls.className}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <DialogFooter className="flex-col space-y-2 sm:space-y-0 sm:flex-row">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddUserDialogOpen(false)}
                        className="w-full sm:w-auto text-xs sm:text-sm"
                        size="sm"
                      >
                        Отказ
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full text-white sm:w-auto text-xs sm:text-sm"
                        size="sm"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
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
            <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
              <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 mb-4 sm:mb-6">
                <div className="relative w-full sm:flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Търсене по име, фамилия или имейл..."
                    className="pl-9 text-sm"
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

                <div className="flex-none">
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-full sm:w-[180px] text-xs sm:text-sm h-9 sm:h-10">
                      <div className="flex items-center gap-2">
                        <Filter className="h-3 w-3 sm:h-4 sm:w-4" />
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
                  <div className="overflow-x-auto -mx-3 sm:mx-0">
                    <div className="inline-block min-w-full align-middle">
                      <div className="rounded-md border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[50px]">#</TableHead>
                              <TableHead>
                                <button
                                  className="flex items-center gap-1 hover:text-blue-600 transition-colors text-xs sm:text-sm"
                                  onClick={() => handleSort("lastName")}
                                >
                                  Име и фамилия
                                  {sortConfig.key === "lastName" && (
                                    <ArrowDownUp className="h-3 w-3" />
                                  )}
                                </button>
                              </TableHead>
                              <TableHead className="hidden sm:table-cell">
                                <button
                                  className="flex items-center gap-1 hover:text-blue-600 transition-colors text-xs sm:text-sm"
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
                                  className="flex items-center gap-1 hover:text-blue-600 transition-colors text-xs sm:text-sm"
                                  onClick={() => handleSort("role")}
                                >
                                  Роля
                                  {sortConfig.key === "role" && (
                                    <ArrowDownUp className="h-3 w-3" />
                                  )}
                                </button>
                              </TableHead>
                              <TableHead className="hidden md:table-cell">
                                Клас
                              </TableHead>
                              <TableHead className="w-[80px] sm:w-[120px] text-right">
                                Действия
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredUsers.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={6}
                                  className="text-center py-8 sm:py-10 text-gray-500 text-sm"
                                >
                                  Няма намерени потребители
                                </TableCell>
                              </TableRow>
                            ) : (
                              filteredUsers.map((userData, index) => (
                                <TableRow key={userData.userId}>
                                  <TableCell className="font-medium text-xs sm:text-sm">
                                    {index + 1}
                                  </TableCell>
                                  <TableCell className="text-xs sm:text-sm">
                                    <div>
                                      {userData.firstName} {userData.lastName}
                                    </div>
                                    <div className="text-xs text-gray-500 sm:hidden">
                                      {userData.email}
                                    </div>
                                  </TableCell>
                                  <TableCell className="hidden sm:table-cell text-xs sm:text-sm">
                                    {userData.email}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      className={`${getRoleBadgeStyle(
                                        userData.role
                                      )} border text-xs`}
                                    >
                                      {userData.role === "admin" &&
                                        "Администратор"}
                                      {userData.role === "teacher" && "Учител"}
                                      {userData.role === "student" && "Ученик"}
                                      {userData.role === "parent" && "Родител"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell text-xs sm:text-sm">
                                    {userData.role === "student" ||
                                    userData.role === "teacher"
                                      ? getClassNameById(
                                          userData.homeroomClassId
                                        )
                                      : "-"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1 sm:gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          handleEditClick(userData)
                                        }
                                        className="h-8 w-8 p-0"
                                      >
                                        <Pencil className="h-3 w-3 sm:h-4 sm:w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className={`h-8 w-8 p-0 ${
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
                                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 text-xs sm:text-sm text-gray-500">
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
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редактиране на потребител</DialogTitle>
            <DialogDescription>
              Променете данните за избрания потребител
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditUserSubmit} className="space-y-4 my-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">
                  Телефон
                  {userFormData.role === "admin" ||
                  userFormData.role === "parent"
                    ? " *"
                    : ""}
                </Label>
                <Input
                  id="phoneNumber"
                  value={userFormData.phoneNumber}
                  onChange={(e) =>
                    setUserFormData({
                      ...userFormData,
                      phoneNumber: e.target.value,
                    })
                  }
                  required={
                    userFormData.role === "admin" ||
                    userFormData.role === "parent"
                  }
                  placeholder={
                    userFormData.role === "admin" ||
                    userFormData.role === "parent"
                      ? "+359 88 888 8888"
                      : ""
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
                <Label htmlFor="teacherHomeroom">Класен ръководител на</Label>
                <Select
                  value={userFormData.homeroomClassId || "none"}
                  onValueChange={(value) =>
                    setUserFormData({
                      ...userFormData,
                      homeroomClassId: value === "none" ? undefined : value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Избери клас" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      Не е класен ръководител
                    </SelectItem>
                    {classes.map((cls) => (
                      <SelectItem key={cls.classId} value={cls.classId}>
                        {cls.className}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <DialogFooter className="flex-col space-y-2 sm:space-y-0 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditUserDialogOpen(false)}
                className="w-full sm:w-auto text-xs sm:text-sm"
                size="sm"
              >
                Отказ
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto text-xs sm:text-sm"
                size="sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
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
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Изтриване на потребител</DialogTitle>
            <DialogDescription>
              Сигурни ли сте, че искате да изтриете този потребител? Това
              действие не може да бъде отменено.
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="py-3 sm:py-4">
              <p className="font-medium text-sm sm:text-base">
                {selectedUser.firstName} {selectedUser.lastName}
              </p>
              <p className="text-xs sm:text-sm text-gray-500">
                {selectedUser.email}
              </p>
              <Badge
                className={`${getRoleBadgeStyle(
                  selectedUser.role
                )} border mt-2 text-xs`}
              >
                {selectedUser.role === "admin" && "Администратор"}
                {selectedUser.role === "teacher" && "Учител"}
                {selectedUser.role === "student" && "Ученик"}
                {selectedUser.role === "parent" && "Родител"}
              </Badge>
            </div>
          )}

          <DialogFooter className="flex-col space-y-2 sm:space-y-0 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              className="w-full sm:w-auto text-xs sm:text-sm"
              size="sm"
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
              className="w-full sm:w-auto text-xs sm:text-sm"
              size="sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
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

      <Dialog
        open={isAccountFeedbackOpen}
        onOpenChange={setIsAccountFeedbackOpen}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Резултати от създаване на потребители</DialogTitle>
            <DialogDescription>
              Информация за потребителските акаунти, създадени във Firebase
              Authentication
            </DialogDescription>
          </DialogHeader>

          <UserAccountFeedback
            successAccounts={accountCreationResults.successAccounts}
            failedAccounts={accountCreationResults.failedAccounts}
            onClose={() => setIsAccountFeedbackOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
