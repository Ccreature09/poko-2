"use client";

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
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
  getClassById,
  getAllClasses,
  type BulkUserData,
  deleteUserAccount,
} from "@/lib/schoolManagement";
import * as XLSX from "xlsx";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Sidebar from "./Sidebar";
import type { HomeroomClass } from "@/lib/interfaces";

interface User extends BulkUserData {
  id: string;
  email: string;
  password: string;
}
export default function AdminDashboard() {
  const { user } = useAuth();
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
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
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

  const handleDeleteUser = async (userId: string) => {
    if (!user) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await deleteUser(user.schoolId, userId);
      setSuccess("User deleted successfully");
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      setError("Failed to delete user. Please try again.");
    } finally {
      setLoading(false);
    }
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

  const isHomeroomClass = (data: any): data is HomeroomClass => {
    return data && data.classId && data.className && data.yearGroup && data.classTeacherId && Array.isArray(data.studentIds);
  };

  const handleDeleteClassUsers = async (classId: string) => {
    if (!user) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const classData = await getClassById(user.schoolId, classId);
      if (isHomeroomClass(classData)) {
        for (const studentId of classData.studentIds) {
          await deleteUser(user.schoolId, studentId);
        }
      }
      setSuccess("All users from the class deleted successfully");
      fetchUsers();
    } catch (error) {
      console.error("Error deleting class users:", error);
      setError("Failed to delete class users. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchClasses = async () => {
      if (!user) return;
      const fetchedClasses = await getAllClasses(user.schoolId);
      setClasses(fetchedClasses.map((classItem: any) => ({ id: classItem.id, name: classItem.name })));
    };
    fetchClasses();
  }, [user]);

  const handleDeleteClass = async (classId: string) => {
    if (!user) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const classData = await getClassById(user.schoolId, classId) as unknown as HomeroomClass;
      if (classData && classData.studentIds) {
        for (const studentId of classData.studentIds) {
          await deleteUser(user.schoolId, studentId);
        }
      }
      setSuccess("Class deleted successfully");
      const fetchClasses = async () => {
        if (!user) return;
        const fetchedClasses = await getAllClasses(user.schoolId);
        setClasses(fetchedClasses.map((classItem: any) => ({ id: classItem.id, name: classItem.name })));
      };
      fetchClasses();
    } catch (error) {
      console.error("Error deleting class:", error);
      setError("Failed to delete class. Please try again.");
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
      <div className="flex-1 p-8 overflow-auto">
        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Bulk User Creation (Excel)</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleExcelUpload} className="space-y-4">
                <div>
                  <Label htmlFor="excel-file">Upload Excel File</Label>
                  <Input
                    id="excel-file"
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleExcelFileChange}
                    className="mt-1"
                  />
                </div>
                <Button type="submit" disabled={!excelFile || loading} className="text-white">
                  {loading ? "Uploading..." : "Upload and Create Users"}
                </Button>
              </form>
              <div className="mt-4 max-h-64 overflow-y-auto">
                {excelUsers.map((user, index) => (
                  <Card key={index} className="mb-2">
                    <CardContent>
                      <p><strong>First Name:</strong> {user.firstName}</p>
                      <p><strong>Last Name:</strong> {user.lastName}</p>
                      <p><strong>Role:</strong> {user.role}</p>
                      <p><strong>Phone Number:</strong> {user.phoneNumber}</p>
                      <p><strong>Homeroom Class:</strong> {user.homeroomClassId}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
        
            <CardHeader>
              <CardTitle>Manual User Creation</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleManualCreate} className="space-y-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
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
                  <Label htmlFor="lastName">Last Name</Label>
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
                <div>
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    type="number"
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
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={manualUserData.role}
                    onValueChange={(value) =>
                      setManualUserData({
                        ...manualUserData,
                        role: value as "admin" | "teacher" | "student",
                      })
                    }
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="teacher">Teacher</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {manualUserData.role === "student" && (
                  <div>
                    <Label htmlFor="homeroomClass">Homeroom Class</Label>
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
                <Button type="submit" disabled={loading} className="text-white">
                  {loading ? "Creating..." : "Create User"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
        {error && <p className="text-red-500 mt-4">{error}</p>}
        {success && <p className="text-green-500 mt-4">{success}</p>}
        {users.length > 0 && (
          <Button onClick={handleExportCredentials} className="mt-4 text-white">
            Export User Credentials
          </Button>
        )}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>User List</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    First Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Homeroom Class
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.firstName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.lastName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                      {user.role}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.phoneNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.homeroomClassId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <Button variant="destructive" onClick={() => handleDeleteUserAccount(user.id)} className="text-white">
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Delete Class</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formElement = e.target as HTMLFormElement;
                const selectElement = formElement.querySelector('[name="classId"]') as HTMLSelectElement;
                handleDeleteClass(selectElement.value);
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="classId">Select Class</Label>
                <Select name="classId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((classItem) => (
                      <SelectItem key={classItem.id} value={classItem.id}>
                        {classItem.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" variant="destructive" disabled={loading} className="text-white">
                {loading ? "Deleting..." : "Delete Class"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
