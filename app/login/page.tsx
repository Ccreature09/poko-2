"use client";

// Страница за вход в системата
// Предоставя форма за автентикация с:
// - Избор на училище
// - Въвеждане на имейл
// - Въвеждане на парола
// Включва валидация и обработка на грешки

import { useUser } from "@/contexts/UserContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { getSchools, loginUser } from "@/lib/schoolManagement";
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

export default function Login() {
  // Състояния за форма и зареждане
  const { user, loading } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedSchool, setSelectedSchool] = useState("");
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  const [loadingLogin, setLoadingLogin] = useState(false);
  const router = useRouter();

  // Проверка дали потребителят вече е влязъл
  useEffect(() => {
    if (!loading && user) {
      // Redirect to the appropriate dashboard based on user role
      router.push(`/${user.role}/dashboard/${user.schoolId}`);
    }
  }, [user, loading, router]);

  // Зареждане на списъка с училища
  useEffect(() => {
    const fetchSchools = async () => {
      const fetchedSchools = await getSchools();
      setSchools(fetchedSchools);
    };
    fetchSchools();
  }, []);

  // Обработка на форма за вход
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoadingLogin(true);

    if (!email || !selectedSchool) {
      setError("Моля, въведете вашия имейл и изберете училище.");
      setLoadingLogin(false);
      return;
    }

    try {
      await loginUser(email, password, selectedSchool);
      router.push(`/dashboard/${selectedSchool}`);
    } catch (error) {
      console.error("Login error:", error);
      setError("Неуспешен вход. Моля, проверете вашите данни.");
    } finally {
      setLoadingLogin(false);
    }
  };

  if (loading) {
    return <div>Зареждане...</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-3xl font-extrabold">
            Влезте в акаунта си
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <Label htmlFor="school">Училище</Label>
              <Select onValueChange={setSelectedSchool} required>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Изберете училище" />
                </SelectTrigger>
                <SelectContent>
                  {schools.map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      {school.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="email">Имейл адрес</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="password">Парола</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button type="submit" className="w-full text-white" disabled={loadingLogin}>
              {loadingLogin ? "Зареждане..." : "Вход"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
