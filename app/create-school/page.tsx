"use client";

/**
 * Create School Page
 *
 * Administrative interface for establishing new educational institutions.
 * This page provides:
 *
 * Key features:
 * - One-step school creation with administrator account setup
 * - Institutional profile establishment
 * - Admin credential creation with secure password handling
 * - School administrator designation with full access privileges
 * - Error handling with user-friendly messaging
 *
 * Data flow:
 * - Collects essential school information and admin credentials
 * - Creates school entity in database with unique identifier
 * - Establishes administrator account with proper authentication
 * - Links administrator to the new school with appropriate permissions
 * - Redirects to admin dashboard upon successful creation
 *
 * This interface serves as the entry point for new institutions to join
 * the platform, creating both the school entity and its first administrator
 * in a single process.
 */

import type React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  createSchool,
  storeSchoolData,
} from "@/lib/management/schoolManagement";

/**
 * CreateSchool component renders the form for creating a new school and administrator.
 * @component
 */
export default function CreateSchool() {
  const [schoolName, setSchoolName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  /**
   * Handle form submission to create a new school and its admin account.
   * @param e React.FormEvent from the form submission.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { user, schoolId } = await createSchool(adminEmail, password);
      await storeSchoolData(
        schoolId,
        schoolName,
        user.uid,
        firstName,
        lastName
      );
      router.push(`/admin/dashboard`);
    } catch {
      setError("Неуспешно създаване на училище. Моля, опитайте отново.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md shadow-lg hover:shadow-xl transition-shadow bg-white">
        <CardHeader className="space-y-1 pb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white"
              >
                <path d="M2 9.5V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5.5"></path>
                <path d="M2 14.5V20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5.5"></path>
                <path d="M2 12h20"></path>
                <path d="M12 12v8"></path>
                <path d="M12 12L6 22"></path>
                <path d="M12 12l6 10"></path>
              </svg>
            </div>
          </div>
          <CardTitle className="text-center text-3xl font-extrabold text-gray-900">
            Създайте своето училище
          </CardTitle>
          <CardDescription className="text-center text-gray-500">
            Попълнете данните по-долу, за да създадете ново училище и да станете
            негов администратор
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="school-name" className="text-gray-700">
                Име на училището
              </Label>
              <Input
                id="school-name"
                name="schoolName"
                type="text"
                required
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                placeholder="Въведете официалното име на училището"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first-name" className="text-gray-700">
                  Име
                </Label>
                <Input
                  id="first-name"
                  name="firstName"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  placeholder="Име"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name" className="text-gray-700">
                  Фамилия
                </Label>
                <Input
                  id="last-name"
                  name="lastName"
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  placeholder="Фамилия"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-email" className="text-gray-700">
                Имейл на администратора
              </Label>
              <Input
                id="admin-email"
                name="adminEmail"
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                placeholder="admin@example.com"
              />
              <p className="text-xs text-gray-500">
                Този имейл ще бъде използван за влизане като администратор
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700">
                Парола
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                placeholder="••••••••"
              />
              <p className="text-xs text-gray-500">Минимум 8 символа</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                <p className="text-sm">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Създаване...
                </span>
              ) : (
                "Създаване на училище"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-8 text-center text-sm text-gray-500">
        Имате нужда от помощ?{" "}
        <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
          Контакти за поддръжка
        </a>
      </div>
    </div>
  );
}
