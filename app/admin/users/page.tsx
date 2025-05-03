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
  updateDoc,
  deleteDoc,
  addDoc,
  writeBatch,
  Timestamp,
  setDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { v4 as uuidv4 } from "uuid";
import type {
  UserBase,
  HomeroomClass,
  ClassNamingFormat,
} from "@/lib/interfaces";

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
import * as XLSX from "xlsx";

type UserRole = "admin" | "teacher" | "student" | "parent";
type UserData = UserBase & {
  role: UserRole;
  childrenIds?: string[];
  teachesClasses?: string[];
};

interface UserFormData {
  userId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  role: UserRole;
  gender: string;
  homeroomClassId?: string;
  childrenIds?: string[];
  teachesClasses?: string[];
}

interface BulkImportUserData extends UserFormData {
  yearGroup?: number;
  classLetter?: string;
  customClassName?: string;
  classNamingFormat?: ClassNamingFormat;
}

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
          teacherIds: data.teacherIds || [],
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

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId) return;

    setIsSubmitting(true);
    try {
      const usersRef = collection(doc(db, "schools", user.schoolId), "users");

      const emailCheckQuery = query(
        usersRef,
        where("email", "==", userFormData.email)
      );
      const emailCheck = await getDocs(emailCheckQuery);

      if (!emailCheck.empty) {
        toast({
          title: "Error",
          description: "A user with this email already exists",
          variant: "destructive",
        });
        return;
      }

      const newUserData: {
        firstName: string;
        lastName: string;
        email: string;
        phoneNumber: string;
        role: UserRole;
        gender: string;
        createdAt: Timestamp;
        schoolId: string;
        inbox: { conversations: never[]; unreadCount: number };
        homeroomClassId?: string;
        enrolledSubjects?: never[];
        teachesClasses?: string[];
      } = {
        firstName: userFormData.firstName,
        lastName: userFormData.lastName,
        email: userFormData.email,
        phoneNumber: userFormData.phoneNumber,
        role: userFormData.role,
        gender: userFormData.gender,
        createdAt: Timestamp.now(),
        schoolId: user.schoolId,
        inbox: { conversations: [], unreadCount: 0 },
      };

      if (userFormData.role === "student" && userFormData.homeroomClassId) {
        newUserData.homeroomClassId = userFormData.homeroomClassId;
        newUserData.enrolledSubjects = [];
      } else if (userFormData.role === "teacher") {
        newUserData.teachesClasses = userFormData.teachesClasses || [];
      }

      await addDoc(usersRef, newUserData);

      toast({
        title: "Success",
        description: "User added successfully",
      });

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
    } catch (error) {
      console.error("Error adding user:", error);
      toast({
        title: "Error",
        description: "Failed to add user",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId || !selectedUser?.userId) return;

    setIsSubmitting(true);
    try {
      const userRef = doc(
        db,
        "schools",
        user.schoolId,
        "users",
        selectedUser.userId
      );

      if (userFormData.email !== selectedUser.email) {
        const usersRef = collection(doc(db, "schools", user.schoolId), "users");
        const emailCheckQuery = query(
          usersRef,
          where("email", "==", userFormData.email)
        );
        const emailCheck = await getDocs(emailCheckQuery);

        if (!emailCheck.empty) {
          const conflictingUser = emailCheck.docs[0];
          if (conflictingUser.id !== selectedUser.userId) {
            toast({
              title: "Error",
              description: "This email is already in use by another user",
              variant: "destructive",
            });
            setIsSubmitting(false);
            return;
          }
        }
      }

      const updateData: {
        firstName: string;
        lastName: string;
        email: string;
        phoneNumber: string;
        gender: string;
        homeroomClassId?: string;
        teachesClasses?: string[];
      } = {
        firstName: userFormData.firstName,
        lastName: userFormData.lastName,
        email: userFormData.email,
        phoneNumber: userFormData.phoneNumber,
        gender: userFormData.gender,
      };

      if (userFormData.role === "student" && userFormData.homeroomClassId) {
        updateData.homeroomClassId = userFormData.homeroomClassId;
      }

      if (userFormData.role === "teacher" && userFormData.teachesClasses) {
        updateData.teachesClasses = userFormData.teachesClasses;
      }

      await updateDoc(userRef, updateData);

      toast({
        title: "Success",
        description: "User updated successfully",
      });

      setIsEditUserDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error("Error updating user:", error);
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!user?.schoolId || !selectedUser?.userId) return;

    setIsSubmitting(true);
    try {
      await deleteDoc(
        doc(db, "schools", user.schoolId, "users", selectedUser.userId)
      );

      toast({
        title: "Success",
        description: "User deleted successfully",
      });

      setIsDeleteDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadImportTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      [
        "firstName",
        "lastName",
        "phoneNumber",
        "role",
        "gender",
        "classNamingFormat",
        "yearGroup",
        "classLetter",
        "customClassName",
        "homeroomClassId",
      ],
      [
        "John",
        "Doe",
        "555-123-4567",
        "student",
        "male",
        "graded",
        "9",
        "A",
        "",
        "",
      ],
      [
        "Jane",
        "Smith",
        "555-987-6543",
        "student",
        "female",
        "custom",
        "",
        "",
        "English Advanced",
        "",
      ],
      [
        "Emily",
        "Johnson",
        "555-456-7890",
        "teacher",
        "female",
        "graded",
        "10",
        "B",
        "",
        "",
      ],
      [
        "Sarah",
        "Williams",
        "555-234-5678",
        "admin",
        "female",
        "",
        "",
        "",
        "",
        "",
      ],
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "User Import Template");

    XLSX.writeFile(wb, "user_import_template.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportErrors([]);
    setImportData([]);

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = event.target?.result;
        if (!data) return;

        const workbook = XLSX.read(data as string, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData: Record<string, string | number>[] =
          XLSX.utils.sheet_to_json(sheet);

        const errors: string[] = [];
        const processedData: BulkImportUserData[] = [];

        // Handle processing of the imported data
        for (let i = 0; i < jsonData.length; i++) {
          const row: Record<string, string | number> = jsonData[i];
          const rowIndex = i + 2;

          const requiredFields = ["firstName", "lastName", "role", "gender"];
          const missingFields = requiredFields.filter((field) => !row[field]);

          if (row.role === "student" || row.role === "teacher") {
            if (!row.classNamingFormat) {
              missingFields.push("classNamingFormat");
            } else if (
              row.classNamingFormat === "graded" &&
              (!row.yearGroup || !row.classLetter)
            ) {
              if (!row.yearGroup) missingFields.push("yearGroup");
              if (!row.classLetter) missingFields.push("classLetter");
            } else if (
              row.classNamingFormat === "custom" &&
              !row.customClassName
            ) {
              missingFields.push("customClassName");
            }
          }

          if (missingFields.length > 0) {
            errors.push(
              `Row ${rowIndex}: Missing required fields: ${missingFields.join(
                ", "
              )}`
            );
            continue;
          }

          if (!["admin", "teacher", "student"].includes(String(row.role))) {
            errors.push(
              `Row ${rowIndex}: Invalid role. Must be 'admin', 'teacher', or 'student'`
            );
            continue;
          }

          if (!["male", "female", "other"].includes(String(row.gender))) {
            errors.push(
              `Row ${rowIndex}: Invalid gender. Must be 'male', 'female', or 'other'`
            );
            continue;
          }

          if (
            (String(row.role) === "student" ||
              String(row.role) === "teacher") &&
            row.classNamingFormat &&
            !["graded", "custom"].includes(String(row.classNamingFormat))
          ) {
            errors.push(
              `Row ${rowIndex}: Invalid classNamingFormat. Must be 'graded' or 'custom'`
            );
            continue;
          }

          const processedRow: BulkImportUserData = {
            firstName: row.firstName as string,
            lastName: row.lastName as string,
            phoneNumber: (row.phoneNumber as string) || "",
            role: row.role as UserRole,
            gender: row.gender as string,
            email: `${(row.firstName as string).toLowerCase().charAt(0)}${(
              row.lastName as string
            )
              .toLowerCase()
              .charAt(0)}${Math.floor(
              10000 + Math.random() * 90000
            )}@school.com`, // Generate an email as in importUsers
          };

          if (row.role === "student" || row.role === "teacher") {
            processedRow.classNamingFormat =
              row.classNamingFormat as ClassNamingFormat;

            if (row.classNamingFormat === "graded") {
              processedRow.yearGroup = row.yearGroup as number;
              processedRow.classLetter = row.classLetter as string;
            } else if (row.classNamingFormat === "custom") {
              processedRow.customClassName = row.customClassName as string;
            }

            if (row.homeroomClassId) {
              processedRow.homeroomClassId = row.homeroomClassId as string;
            }
          }

          processedData.push(processedRow);
        }

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
        console.error("Error parsing file:", error);
        toast({
          title: "Error",
          description:
            "Failed to parse file. Please ensure it's a valid Excel file.",
          variant: "destructive",
        });
      }
    };

    reader.readAsBinaryString(file);
  };

  const getOrCreateClass = async (
    userData: BulkImportUserData,
    teacherId: string = ""
  ): Promise<string> => {
    if (!user?.schoolId) return "";
    let className = "";
    let namingFormat: ClassNamingFormat = "graded";
    let gradeNumber: number | undefined = undefined;
    let classLetter: string | undefined = undefined;
    let customName: string | undefined = undefined;

    if (
      userData.classNamingFormat === "graded" &&
      userData.yearGroup &&
      userData.classLetter
    ) {
      className = `${userData.yearGroup}${userData.classLetter}`;
      namingFormat = "graded";
      gradeNumber = userData.yearGroup;
      classLetter = userData.classLetter;
    } else if (
      userData.classNamingFormat === "custom" &&
      userData.customClassName
    ) {
      className = userData.customClassName;
      namingFormat = "custom";
      customName = userData.customClassName;
    } else if (userData.homeroomClassId) {
      className = userData.homeroomClassId;
    } else {
      return "";
    }

    // Find existing class by name (not by id)
    const classesRef = collection(db, "schools", user.schoolId, "classes");
    const q = query(classesRef, where("className", "==", className));
    const snapshot = await getDocs(q);
    let classDocId = "";
    if (!snapshot.empty) {
      classDocId = snapshot.docs[0].id;
      // Optionally update classTeacherId if needed
      if (teacherId && !snapshot.docs[0].data().classTeacherId) {
        await updateDoc(doc(classesRef, classDocId), {
          classTeacherId: teacherId,
        });
      }
      return classDocId;
    } else {
      // Use Firestore's automatic document ID
      const newClassRef = doc(classesRef);
      classDocId = newClassRef.id;
      const classData: any = {
        classId: classDocId,
        className,
        namingFormat,
        studentIds: [],
        teacherIds: [],
        classTeacherId: teacherId || "",
      };
      if (namingFormat === "graded") {
        classData.gradeNumber = gradeNumber;
        classData.classLetter = classLetter;
      } else if (namingFormat === "custom") {
        classData.customName = customName;
      }
      await setDoc(newClassRef, classData);
      return classDocId;
    }
  };

  const importUsers = async () => {
    if (!user?.schoolId || importData.length === 0) return;

    setIsSubmitting(true);
    const batch = writeBatch(db);
    const usersRef = collection(doc(db, "schools", user.schoolId), "users");

    try {
      const createdUserIds: Record<string, string> = {};

      for (let i = 0; i < importData.length; i++) {
        const userData = importData[i];

        const email = `${userData.firstName
          .toLowerCase()
          .charAt(0)}${userData.lastName.toLowerCase().charAt(0)}${Math.floor(
          10000 + Math.random() * 90000
        )}@school.com`;

        const newUserRef = doc(usersRef);
        const userId = newUserRef.id;
        createdUserIds[i] = userId;

        const newUserData: any = {
          userId,
          firstName: userData.firstName,
          lastName: userData.lastName,
          email,
          phoneNumber: userData.phoneNumber || "",
          role: userData.role,
          gender: userData.gender,
          createdAt: Timestamp.now(),
          schoolId: user.schoolId,
          inbox: { conversations: [], unreadCount: 0 },
        };

        let classId = "";
        if (
          ["student", "teacher"].includes(userData.role) &&
          userData.classNamingFormat
        ) {
          classId = await getOrCreateClass(
            userData,
            userData.role === "teacher" ? userId : ""
          );
          if (classId) {
            newUserData.homeroomClassId = classId;
          }
        }

        if (userData.role === "student") {
          newUserData.enrolledSubjects = [];
        } else if (userData.role === "teacher") {
          newUserData.teachesClasses = [];
        }

        batch.set(newUserRef, newUserData);
      }

      await batch.commit();

      const classBatch = writeBatch(db);

      for (let i = 0; i < importData.length; i++) {
        const userData = importData[i];
        const userId = createdUserIds[i];
        let classId = "";
        if (
          ["student", "teacher"].includes(userData.role) &&
          userData.classNamingFormat
        ) {
          classId = userData.homeroomClassId || "";
        }
        if (userData.role === "student" && classId) {
          const classRef = doc(
            db,
            "schools",
            user.schoolId,
            "classes",
            classId
          );
          classBatch.update(classRef, { studentIds: arrayUnion(userId) });
        } else if (userData.role === "teacher" && classId) {
          const teacherRef = doc(db, "schools", user.schoolId, "users", userId);
          classBatch.update(teacherRef, {
            teachesClasses: arrayUnion(classId),
          });

          const classRef = doc(
            db,
            "schools",
            user.schoolId,
            "classes",
            classId
          );
          classBatch.update(classRef, {
            teacherIds: arrayUnion(userId),
            classTeacherId: userId,
          });
        }
      }

      await classBatch.commit();

      toast({
        title: "Success",
        description: `Successfully imported ${importData.length} users.`,
      });

      setIsImportDialogOpen(false);
      fetchUsers();
      fetchClasses();
    } catch (error) {
      console.error("Error importing users:", error);
      toast({
        title: "Error",
        description: "Failed to import users. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
                    <DialogTitle>Bulk Import Users</DialogTitle>
                    <DialogDescription>
                      Upload an Excel file with user data to import multiple
                      users at once.
                      <Button
                        onClick={downloadImportTemplate}
                        variant="outline"
                        className="mt-2"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Template
                      </Button>
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="border rounded-md p-4">
                      <Label htmlFor="file-upload">Upload Excel File</Label>
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
                        <p className="font-medium text-red-800 mb-2">Errors:</p>
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
                          Preview ({importData.length} users):
                        </p>
                        <ScrollArea className="h-40 border rounded-md">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Class</TableHead>
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
                      Cancel
                    </Button>
                    <Button
                      onClick={importUsers}
                      disabled={
                        importData.length === 0 ||
                        importErrors.length > 0 ||
                        isSubmitting
                      }
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        "Import Users"
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

                  <form onSubmit={handleAddUser} className="space-y-4 my-4">
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
                          <TableHead className="w-[140px] text-right">
                            Действия
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={5}
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
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleDeleteClick(userData)}
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

          <form onSubmit={handleEditUser} className="space-y-4 my-4">
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
              onClick={handleDeleteUser}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Изтриване...
                </>
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
