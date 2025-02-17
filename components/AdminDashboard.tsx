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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  bulkCreateUsers,
  exportLoginCredentials,
  getAllUsers,
  exportAllUserCredentials,
} from "@/lib/schoolManagement";
import * as XLSX from "xlsx";
import { BulkUserData } from "@/lib/interfaces";
interface User extends BulkUserData {
  id: string;
  email: string;
  schoolName: string; // Add this line
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [manualUserData, setManualUserData] = useState<BulkUserData>({
    firstName: "",
    lastName: "",
    role: "student",
    phoneNumber: "",
    homeroomClass: "",
    schoolName: user?.schoolName || "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [createdUsers, setCreatedUsers] = useState<
    { email: string; password: string; role: string }[]
  >([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (user) {
      const fetchedUsers = await getAllUsers(user.schoolId);
      setUsers(fetchedUsers as User[]);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchUsers();
    }
  }, [user, fetchUsers]);

  const handleExcelUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelFile) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const data = await excelFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<BulkUserData>(worksheet);

      const formattedData = jsonData.map((row) => ({
        ...row,
        role: row.role as "admin" | "teacher" | "student",
        phoneNumber: String(row.phoneNumber),
      }));

      const createdUsersList = await bulkCreateUsers(
        formattedData,
        user!.schoolId,
        user!.schoolName
      );
      setCreatedUsers(createdUsersList);
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
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const createdUsersList = await bulkCreateUsers(
        [{ ...manualUserData, schoolName: user!.schoolName }],
        user!.schoolId,
        user!.schoolName
      );
      setCreatedUsers(createdUsersList);
      setSuccess("User created successfully");
      setManualUserData({
        firstName: "",
        lastName: "",
        role: "student",
        phoneNumber: "",
        homeroomClass: "",
        schoolName: user!.schoolName || "",
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
    if (createdUsers.length === 0) {
      setError("No users to export");
      return;
    }

    const credentialsText = exportLoginCredentials(createdUsers);
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

  const handleExportAllCredentials = async () => {
    try {
      await exportAllUserCredentials(user!.schoolId);
      setSuccess("User credentials exported successfully");
    } catch (error) {
      console.error("Error exporting user credentials:", error);
      setError("Failed to export user credentials. Please try again.");
    }
  };

  const filteredUsers = users
    .filter((user) =>
      `${user.firstName} ${user.lastName} ${user.email}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    )
    .filter((user) => (roleFilter ? user.role === roleFilter : true))
    .filter((user) => (classFilter ? user.homeroomClass === classFilter : true))
    .sort((a, b) => {
      if (a.lastName && b.lastName) {
        return a.lastName.localeCompare(b.lastName);
      }
      return 0;
    });

  if (!user || user.role !== "admin") {
    return <div>Access denied. Admin privileges required.</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
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
                  onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                  className="mt-1"
                />
              </div>
              <Button type="submit" disabled={!excelFile || loading}>
                {loading ? "Uploading..." : "Upload and Create Users"}
              </Button>
            </form>
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
                    value={manualUserData.homeroomClass}
                    onChange={(e) =>
                      setManualUserData({
                        ...manualUserData,
                        homeroomClass: e.target.value,
                      })
                    }
                    className="mt-1"
                  />
                </div>
              )}
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create User"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      {error && <p className="text-red-500 mt-4">{error}</p>}
      {success && <p className="text-green-500 mt-4">{success}</p>}
      {createdUsers.length > 0 && (
        <Button onClick={handleExportCredentials} className="mt-4 mb-8">
          Export Created User Credentials
        </Button>
      )}
      <Button onClick={handleExportAllCredentials} className="mt-4 mb-8">
        Export All User Credentials
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>User List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4 mb-4">
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Select
              value={roleFilter || ""}
              onValueChange={(value) =>
                setRoleFilter(value === "All Roles" ? null : value)
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Roles">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="student">Student</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={classFilter || ""}
              onValueChange={(value) =>
                setClassFilter(value === "All Classes" ? null : value)
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Classes">All Classes</SelectItem>
                {Array.from(new Set(users.map((user) => user.homeroomClass)))
                  .filter(Boolean)
                  .map((homeroomClass) => (
                    <SelectItem key={homeroomClass} value={homeroomClass || ""}>
                      {homeroomClass}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Last Name</TableHead>
                <TableHead>First Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Phone Number</TableHead>
                <TableHead>Homeroom Class</TableHead>
                <TableHead>School Name</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.lastName}</TableCell>
                  <TableCell>{user.firstName}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell className="capitalize">{user.role}</TableCell>
                  <TableCell>{user.phoneNumber}</TableCell>
                  <TableCell>{user.homeroomClass}</TableCell>
                  <TableCell>{user.schoolName}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
