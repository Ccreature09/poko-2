"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Check, Lock, LogOut, Shield, User } from "lucide-react";
import {
  updateProfile,
  updateEmail,
  updatePassword,
  signOut,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import {
  doc,
  updateDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import Sidebar from "@/components/functional/Sidebar";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import * as CryptoJS from "crypto-js";

// Helper function to encrypt a password using AES encryption
function encryptPassword(password: string): string {
  // Get encryption secret from environment variable
  const encryptionSecret = process.env.NEXT_PUBLIC_ENCRYPTION_SECRET;

  // Make sure we have an encryption secret
  if (!encryptionSecret) {
    throw new Error("Encryption secret is not configured");
  }

  return CryptoJS.AES.encrypt(password, encryptionSecret).toString();
}

// Define types for role-specific data
interface RoleData {
  // Common fields that might be in any role data
  [key: string]:
    | string
    | number
    | boolean
    | undefined
    | Array<{ id: string; name: string }>;

  // Student-specific fields
  class?: string;
  recentGradesCount?: number;

  // Teacher-specific fields
  classCount?: number;

  // Parent-specific fields
  childrenCount?: number;
  children?: Array<{
    id: string;
    name: string;
  }>;
}

export default function Profile() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("profile");

  // Profile data
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  // Role-specific data
  const [roleData, setRoleData] = useState<RoleData | null>(null);

  // Status
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setEmail(user.email || "");
      setPhoneNumber(user.phoneNumber || "");
      // Fix for TypeScript error: properly cast the gender value
      setGender((user.gender as "male" | "female") || "male");

      // Fetch additional role-specific data
      fetchRoleSpecificData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchRoleSpecificData = async () => {
    if (!user || !user.schoolId || !user.userId) return;

    try {
      const data: RoleData = {};

      // Fetch different data based on user role
      if (user.role === "student") {
        // Get student's class and current grades
        const userDoc = await getDoc(
          doc(db, "schools", user.schoolId, "users", user.userId)
        );
        const userData = userDoc.data();

        if (userData?.homeroomClassId) {
          const classDoc = await getDoc(
            doc(
              db,
              "schools",
              user.schoolId,
              "classes",
              userData.homeroomClassId
            )
          );
          if (classDoc.exists()) {
            data.class = classDoc.data().name;
          }
        }

        // Get recent grades
        const gradesQuery = query(
          collection(db, "schools", user.schoolId, "grades"),
          where("studentId", "==", user.userId),
          where(
            "createdAt",
            ">=",
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          ) // Last 30 days
        );

        const gradesSnapshot = await getDocs(gradesQuery);
        data.recentGradesCount = gradesSnapshot.size;
      } else if (user.role === "teacher") {
        // Get teacher's subjects
        const classesQuery = query(
          collection(db, "schools", user.schoolId, "classes"),
          where("teacherId", "==", user.userId)
        );

        const classesSnapshot = await getDocs(classesQuery);
        data.classCount = classesSnapshot.size;
      } else if (user.role === "parent") {
        // Get parent's children
        const userDoc = await getDoc(
          doc(db, "schools", user.schoolId, "users", user.userId)
        );
        const userData = userDoc.data();

        if (userData?.childrenIds && userData.childrenIds.length > 0) {
          data.childrenCount = userData.childrenIds.length;

          // Get children names
          const children: Array<{ id: string; name: string }> = [];
          for (const childId of userData.childrenIds) {
            const childDoc = await getDoc(
              doc(db, "schools", user.schoolId, "users", childId)
            );
            if (childDoc.exists()) {
              const childData = childDoc.data();
              children.push({
                id: childId,
                name: `${childData.firstName} ${childData.lastName}`,
              });
            }
          }
          data.children = children;
        }
      }

      setRoleData(data);
    } catch (error) {
      console.error("Error fetching role data:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-t-2 border-blue-500 border-r-2 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Зареждане...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Достъп отказан</CardTitle>
            <CardDescription>
              Моля, влезте в системата, за да видите профила си.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => router.push("/login")} className="w-full">
              Към страницата за вход
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      // Update Auth profile
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: `${firstName} ${lastName}`,
        });

        // Update email if changed and authorized
        if (email !== user.email) {
          await updateEmail(auth.currentUser, email);
        }
      } else {
        throw new Error("No authenticated user found");
      }

      // Update Firestore document
      if (!user.schoolId || !user.userId) {
        throw new Error("User data is incomplete");
      }

      const userRef = doc(db, "schools", user.schoolId, "users", user.userId);
      await updateDoc(userRef, {
        firstName,
        lastName,
        email,
        phoneNumber,
        gender,
        updatedAt: new Date(),
      });

      setSuccess("Профилът е актуализиран успешно");

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (error) {
      console.error("Profile update error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Неуспешно актуализиране на профила"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      if (!auth.currentUser) {
        throw new Error("No authenticated user found");
      }

      if (!user || !user.schoolId || !user.userId) {
        throw new Error("User data is incomplete");
      }

      if (newPassword !== confirmPassword) {
        throw new Error("Паролите не съвпадат");
      }

      if (newPassword.length < 6) {
        throw new Error("Паролата трябва да бъде поне 6 символа");
      }

      // Re-authenticate user first
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email!,
        currentPassword
      );

      await reauthenticateWithCredential(auth.currentUser, credential);

      // Change password in Firebase Authentication
      await updatePassword(auth.currentUser, newPassword);

      // Encrypt the password using AES (same method as used in user creation)
      const encryptedPassword = encryptPassword(newPassword);

      // Update encrypted password in Firestore document
      const userRef = doc(db, "schools", user.schoolId, "users", user.userId);
      await updateDoc(userRef, {
        encryptedPassword: encryptedPassword,
        passwordUpdatedAt: new Date(),
      });

      // Reset form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordDialog(false);

      setSuccess("Паролата е актуализирана успешно");

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (error) {
      console.error("Password update error:", error);

      // Handle Firebase Auth specific errors with proper typing
      if (error instanceof Error) {
        const firebaseError = error as { code?: string; message: string };
        if (firebaseError.code === "auth/wrong-password") {
          setError("Грешна текуща парола");
        } else if (firebaseError.code === "auth/weak-password") {
          setError("Паролата трябва да бъде поне 6 символа");
        } else if (firebaseError.code === "auth/requires-recent-login") {
          setError(
            "За промяна на паролата е необходимо да влезете отново в системата"
          );
        } else {
          setError(
            firebaseError.message || "Неуспешно актуализиране на паролата"
          );
        }
      } else {
        setError("Неуспешно актуализиране на паролата");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Helper to get user role label in Bulgarian
  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Администратор";
      case "teacher":
        return "Учител";
      case "student":
        return "Ученик";
      case "parent":
        return "Родител";
      default:
        return role;
    }
  };

  // Helper to get initials for avatar
  const getInitials = () => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 p-4 md:p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold mb-2 text-gray-800">
            Информация за профила
          </h1>
          <p className="text-gray-600 mb-6">
            Вашата профилна информация е показана по-долу. За промени, моля,
            обърнете се към администратор.
          </p>

          {success && (
            <Alert className="mb-6 bg-green-50 border-green-200">
              <Check className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Успех</AlertTitle>
              <AlertDescription className="text-green-700">
                {success}
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert className="mb-6 bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertTitle className="text-red-800">Грешка</AlertTitle>
              <AlertDescription className="text-red-700">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Profile sidebar */}
            <div className="md:col-span-1">
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center mb-4">
                    <div className="relative mb-3">
                      <Avatar className="h-24 w-24 border-4 border-white shadow">
                        <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                          {getInitials()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <h3 className="text-lg font-semibold">
                      {firstName} {lastName}
                    </h3>
                    <div className="flex items-center text-sm text-gray-600 mt-1">
                      <Shield className="h-3.5 w-3.5 mr-1" />
                      <span>{getRoleLabel(user.role)}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => setActiveTab("profile")}
                    >
                      <User className="mr-2 h-4 w-4" />
                      <span>Основна информация</span>
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => setActiveTab("security")}
                    >
                      <Lock className="mr-2 h-4 w-4" />
                      <span>Сигурност</span>
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={handleSignOut}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Изход</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Role-specific summary card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {user.role === "student"
                      ? "Ученически данни"
                      : user.role === "teacher"
                      ? "Учителски данни"
                      : user.role === "parent"
                      ? "Информация за децата"
                      : "Администраторски данни"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {user.role === "student" && roleData && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Клас:</span>
                        <span className="font-medium">
                          {roleData.class || "Не е зададен"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">
                          Скорошни оценки:
                        </span>
                        <span className="font-medium">
                          {roleData.recentGradesCount || 0}
                        </span>
                      </div>
                    </div>
                  )}

                  {user.role === "teacher" && roleData && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">
                          Брой класове:
                        </span>
                        <span className="font-medium">
                          {roleData.classCount || 0}
                        </span>
                      </div>
                    </div>
                  )}

                  {user.role === "parent" && roleData && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">
                          Брой деца:
                        </span>
                        <span className="font-medium">
                          {roleData.childrenCount || 0}
                        </span>
                      </div>

                      {roleData.children && roleData.children.length > 0 && (
                        <div className="mt-3">
                          <h4 className="text-sm text-gray-500 mb-1">Деца:</h4>
                          <ul className="space-y-1">
                            {roleData.children.map((child) => (
                              <li key={child.id} className="text-sm">
                                {child.name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {user.role === "admin" && (
                    <div className="text-sm text-gray-500">
                      Имате пълни администраторски права за училището.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Main content */}
            <div className="md:col-span-3">
              {activeTab === "profile" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Основна информация</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <svg
                            className="h-5 w-5 text-blue-400"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-blue-800">
                            Информация
                          </h3>
                          <div className="mt-1 text-sm text-blue-700">
                            Това е вашата профилна информация. За промяна на
                            лични данни, моля свържете се с администратор.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label
                            htmlFor="firstName"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Име
                          </Label>
                          <div className="p-2.5 bg-gray-50 rounded-md border border-gray-200">
                            <p className="text-gray-900">{firstName}</p>
                          </div>
                        </div>
                        <div>
                          <Label
                            htmlFor="lastName"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Фамилия
                          </Label>
                          <div className="p-2.5 bg-gray-50 rounded-md border border-gray-200">
                            <p className="text-gray-900">{lastName}</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <Label
                          htmlFor="email"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Имейл
                        </Label>
                        <div className="p-2.5 bg-gray-50 rounded-md border border-gray-200">
                          <p className="text-gray-900">{email}</p>
                        </div>
                      </div>

                      <div>
                        <Label
                          htmlFor="phoneNumber"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Телефонен номер
                        </Label>
                        <div className="p-2.5 bg-gray-50 rounded-md border border-gray-200">
                          <p className="text-gray-900">
                            {phoneNumber || "Не е посочен"}
                          </p>
                        </div>
                      </div>

                      <div>
                        <Label
                          htmlFor="gender"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Пол
                        </Label>
                        <div className="p-2.5 bg-gray-50 rounded-md border border-gray-200">
                          <p className="text-gray-900">
                            {gender === "male" ? "Мъж" : "Жена"}
                          </p>
                        </div>
                      </div>

                      <div>
                        <Label
                          htmlFor="role"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Роля
                        </Label>
                        <div className="p-2.5 bg-gray-50 rounded-md border border-gray-200">
                          <p className="text-gray-900">
                            {getRoleLabel(user.role)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeTab === "security" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Сигурност</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">Парола</h3>
                          <p className="text-sm text-gray-500">
                            Променете вашата парола за достъп
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => setShowPasswordDialog(true)}
                        >
                          Промяна на паролата
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Промяна на паролата</DialogTitle>
            <DialogDescription>
              Въведете текущата си парола и новата парола, която искате да
              използвате.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <Label htmlFor="currentPassword">Текуща парола</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="newPassword">Нова парола</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="confirmPassword">Потвърдете новата парола</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPasswordDialog(false)}
              >
                Отказ
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <span className="animate-spin h-4 w-4 mr-2 border-2 border-white border-r-transparent rounded-full"></span>
                ) : (
                  "Промяна на паролата"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
