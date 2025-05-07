"use client";

// Login page - provides authentication form
// Features:
// - School selection
// - Email input
// - Password input
// - Validation and error handling

import { useUser } from "@/contexts/UserContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { getSchools } from "@/lib/management/schoolManagement";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

export default function Login() {
  // States for form and loading
  const { user, loading: userLoading } = useUser();
  const { signIn, authError, authLoading, clearAuthError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedSchool, setSelectedSchool] = useState("");
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [localError, setLocalError] = useState("");
  const [loadingLogin, setLoadingLogin] = useState(false);
  const router = useRouter();

  // Check if user is already logged in
  useEffect(() => {
    if (!userLoading && user) {
      // Redirect to the appropriate dashboard based on user role
      router.push(`/${user.role}/dashboard`);
    }
  }, [user, userLoading, router]);

  // Load list of schools
  useEffect(() => {
    const fetchSchools = async () => {
      const fetchedSchools = await getSchools();
      setSchools(fetchedSchools);
    };
    fetchSchools();
  }, []);

  // Clear auth errors when inputs change
  useEffect(() => {
    if (authError) {
      clearAuthError();
    }
  }, [email, password, selectedSchool, authError, clearAuthError]);

  // Handle login form submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");

    if (!email || !selectedSchool) {
      setLocalError("Please enter your email and select a school.");
      return;
    }

    setLoadingLogin(true);

    try {
      // Use the AuthContext's signIn method
      const result = await signIn(email, password);

      if (result) {
        // Authentication successful - UserContext will load user data
        // and trigger the redirect in the above useEffect
        localStorage.setItem("selectedSchool", selectedSchool);
      } else {
        // If authError wasn't set by signIn, set a local error
        setLocalError(
          authError || "Login failed. Please check your credentials."
        );
      }
    } catch (error) {
      console.error("Login error:", error);
      setLocalError("Login failed. Please check your credentials.");
    } finally {
      setLoadingLogin(false);
    }
  };

  if (userLoading) {
    return <div>Зареждане...</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-3xl font-extrabold">
            Влезте в профила си
          </CardTitle>
          <CardDescription className="text-center mt-2">
            Достъп до всички функции на платформата
          </CardDescription>
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
            {(localError || authError) && (
              <p className="text-red-500 text-sm">{localError === "Please enter your email and select a school." ? "Моля, въведете своя имейл и изберете училище." : localError === "Login failed. Please check your credentials." ? "Неуспешно влизане. Моля, проверете данните си за вход." : authError}</p>
            )}
            <Button
              type="submit"
              className="w-full text-white"
              disabled={loadingLogin || authLoading}
            >
              {loadingLogin || authLoading ? "Зареждане..." : "Вход"}
            </Button>

            <div className="text-center mt-4 text-sm">
              <p>
                Вие родител ли сте?{" "}
                <Link
                  href="/parent-signup"
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Регистрирайте се тук
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
