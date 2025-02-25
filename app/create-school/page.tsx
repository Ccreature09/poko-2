"use client";

import type React from "react";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSchool, storeSchoolData } from "@/lib/schoolManagement";

export default function CreateSchool() {
  const [schoolName, setSchoolName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { user, schoolId } = await createSchool(
        schoolName,
        adminEmail,
        password
      );
      await storeSchoolData(schoolId, schoolName, user.uid);
      router.push(`/dashboard/${schoolId}`);
    } catch {
      setError("Неуспешно създаване на училище. Моля, опитайте отново.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-3xl font-extrabold">
            Създайте своето училище
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="school-name">Име на училището</Label>
              <Input
                id="school-name"
                name="schoolName"
                type="text"
                required
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="admin-email">Имейл на администратора</Label>
              <Input
                id="admin-email"
                name="adminEmail"
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="password">Парола</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
              />
            </div>
            {error && <p className="text-red-500 text-sm">Неуспешно създаване на училище. Моля, опитайте отново.</p>}
            <Button type="submit" className="w-full text-white" disabled={loading}>
              {loading ? "Създаване на училище..." : "Създаване на училище"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
