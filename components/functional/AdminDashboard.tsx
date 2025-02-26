"use client";

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  bulkCreateUsers,
  exportLoginCredentials,
  getAllUsers,
  deleteUser,
  type BulkUserData,
  deleteUserAccount,
} from "@/lib/schoolManagement";
import * as XLSX from "xlsx";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Sidebar from "./Sidebar";
interface User extends BulkUserData {
  id: string;
  email: string;
  password: string;
}
export default function AdminDashboard() {
  const { user } = useUser();
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [manualUserData, setManualUserData] = useState<BulkUserData>({
    firstName: "",
    gender: "male",
    lastName: "",
    role: "student",
    phoneNumber: "",
    homeroomClassId: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [excelUsers, setExcelUsers] = useState<BulkUserData[]>([]);

  const fetchUsers = useCallback(async () => {
    if (user) {
      const fetchedUsers = (await getAllUsers(user.schoolId)) as User[];
      setUsers(fetchedUsers);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchUsers();
    }
  }, [user, fetchUsers]);

  const fetchSchoolName = async (schoolId: string) => {
    console.log(schoolId);
    const schoolDoc = await getDoc(doc(db, "schools", schoolId));
    return schoolDoc.exists() ? schoolDoc.data()?.name : null;
  };

  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setExcelFile(file);

    if (file) {
      try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<BulkUserData>(worksheet);

        const formattedData = jsonData.map((row) => ({
          ...row,
          role: row.role as "admin" | "teacher" | "student",
          phoneNumber: row.phoneNumber,
        }));

        setExcelUsers(formattedData);
      } catch (error) {
        console.error("Error reading Excel file:", error);
        setError("Failed to read Excel file. Please try again.");
      }
    } else {
      setExcelUsers([]);
    }
  };

  const handleExcelUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelFile || !user) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const schoolName = await fetchSchoolName(user.schoolId);
      if (!schoolName) {
        throw new Error("School name not found");
      }

      const data = await excelFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<BulkUserData>(worksheet);

      const formattedData = jsonData.map((row) => ({
        ...row,
        role: row.role as "admin" | "teacher" | "student",
        phoneNumber: row.phoneNumber,
      }));

      setExcelUsers(formattedData);
      await bulkCreateUsers(formattedData, user.schoolId, schoolName);
      setSuccess("Users created successfully");
      fetchUsers();
    } catch (error) {
      console.error("Error creating users:", error);
      setError("Failed to create users. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleManualCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const schoolName = await fetchSchoolName(user.schoolId);
      if (!schoolName) {
        throw new Error("School name not found");
      }

      await bulkCreateUsers([manualUserData], user.schoolId, schoolName);
      setSuccess("User created successfully");
      setManualUserData({
        firstName: "",
        gender: "male",
        lastName: "",
        role: "student",
        phoneNumber: "",
        homeroomClassId: "",
      });
      fetchUsers();
    } catch (error) {
      console.error("Error creating user:", error);
      setError("Failed to create user. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCredentials = () => {
    if (users.length === 0) {
      setError("No users to export");
      return;
    }

    const credentialsText = exportLoginCredentials(users);
    const blob = new Blob([credentialsText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "user_credentials.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDeleteUserAccount = async (userId: string) => {
    if (!user) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await deleteUser(user.schoolId, userId);
      await deleteUserAccount(userId); // Add this line to delete the user account
      setSuccess("User and account deleted successfully");
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user account:", error);
      setError("Failed to delete user account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== "admin") {
    return <div>Access denied. Admin privileges required.</div>;
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto bg-gray-50">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">Административно табло</h1>
        
        {/* Status Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-600">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Excel Upload Section */}
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="border-b bg-gray-50">
              <CardTitle className="text-xl text-gray-800">Създаване на потребители (Excel)</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleExcelUpload} className="space-y-4">
                <div>
                  <Label htmlFor="excel-file" className="text-gray-700">Качване на Excel файл</Label>
                  <Input
                    id="excel-file"
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleExcelFileChange}
                    className="mt-2"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={!excelFile || loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                >
                  {loading ? "Качване..." : "Качване и създаване на потребители"}
                </Button>
              </form>

              {excelUsers.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-4 text-gray-700">Прегледани потребители</h3>
                  <div className="mt-4 max-h-64 overflow-y-auto space-y-3">
                    {excelUsers.map((user, index) => (
                      <Card key={index} className="border border-gray-200">
                        <CardContent className="p-4">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <p><span className="font-medium">Име:</span> {user.firstName}</p>
                            <p><span className="font-medium">Фамилия:</span> {user.lastName}</p>
                            <p><span className="font-medium">Роля:</span> {user.role}</p>
                            <p><span className="font-medium">Телефон:</span> {user.phoneNumber}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Manual User Creation Section */}
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="border-b bg-gray-50">
              <CardTitle className="text-xl text-gray-800">Ръчно създаване на потребители</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleManualCreate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName" className="text-gray-700">Име</Label>
                    <Input
                      id="firstName"
                      type="text"
                      value={manualUserData.firstName}
                      onChange={(e) =>
                        setManualUserData({
                          ...manualUserData,
                          firstName: e.target.value,
                        })
                      }
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName" className="text-gray-700">Фамилия</Label>
                    <Input
                      id="lastName"
                      type="text"
                      value={manualUserData.lastName}
                      onChange={(e) =>
                        setManualUserData({
                          ...manualUserData,
                          lastName: e.target.value,
                        })
                      }
                      required
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phoneNumber" className="text-gray-700">Телефонен номер</Label>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      value={manualUserData.phoneNumber}
                      onChange={(e) =>
                        setManualUserData({
                          ...manualUserData,
                          phoneNumber: e.target.value,
                        })
                      }
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="role" className="text-gray-700">Роля</Label>
                    <Select
                      value={manualUserData.role}
                      onValueChange={(value) =>
                        setManualUserData({
                          ...manualUserData,
                          role: value as "admin" | "teacher" | "student",
                        })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Изберете роля" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="teacher">Учител</SelectItem>
                        <SelectItem value="student">Ученик</SelectItem>
                        <SelectItem value="admin">Администратор</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {manualUserData.role === "student" && (
                  <div>
                    <Label htmlFor="homeroomClass" className="text-gray-700">Клас</Label>
                    <Input
                      id="homeroomClass"
                      type="text"
                      value={manualUserData.homeroomClassId}
                      onChange={(e) =>
                        setManualUserData({
                          ...manualUserData,
                          homeroomClassId: e.target.value,
                        })
                      }
                      className="mt-1"
                    />
                  </div>
                )}

                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                >
                  {loading ? "Създаване..." : "Създаване на потребител"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Users List Section */}
        <div className="mt-8">
          {users.length > 0 && (
            <Button 
              onClick={handleExportCredentials} 
              className="mb-4 bg-green-600 hover:bg-green-700 text-white transition-colors"
            >
              Експортиране на потребителски данни
            </Button>
          )}
          
          <Card className="shadow-md">
            <CardHeader className="border-b bg-gray-50">
              <CardTitle className="text-xl text-gray-800">Списък на потребителите</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Имейл
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Име
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Фамилия
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Роля
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Телефон
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Клас
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.firstName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.lastName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                          {user.role}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.phoneNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.homeroomClassId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Button 
                            variant="destructive" 
                            onClick={() => handleDeleteUserAccount(user.id)}
                            className="hover:bg-red-700 transition-colors text-white"
                          >
                            Изтриване
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
