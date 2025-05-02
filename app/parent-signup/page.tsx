"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSchools } from "@/lib/schoolManagement";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

export default function ParentSignup() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [selectedSchool, setSelectedSchool] = useState("");
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  // Load schools list on component mount
  useEffect(() => {
    const fetchSchools = async () => {
      const fetchedSchools = await getSchools();
      setSchools(fetchedSchools);
    };
    fetchSchools();
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Basic validation
    if (!firstName || !lastName || !email || !password || !gender || !selectedSchool) {
      setError("Моля, попълнете всички полета.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Паролите не съвпадат.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Паролата трябва да е поне 6 символа.");
      setLoading(false);
      return;
    }

    try {
      // Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const userId = userCredential.user.uid;
      
      // Create user document in Firestore
      const parentData = {
        userId,
        firstName,
        lastName,
        email,
        role: "parent",
        gender,
        phoneNumber: "", // Optional field that can be updated later
        schoolId: selectedSchool,
        childrenIds: [], // Will be updated when parent-child links are established
        inbox: { conversations: [], unreadCount: 0 }, // Initialize empty inbox
      };

      await setDoc(doc(db, "schools", selectedSchool, "users", userId), parentData);
      
      setSuccess(true);
      
      // Clear form
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setGender("");
      
      // Redirect to login page after a delay
      setTimeout(() => {
        router.push("/login");
      }, 3000);
      
    } catch (error: any) {
      console.error("Registration error:", error);
      if (error.code === "auth/email-already-in-use") {
        setError("Този имейл адрес вече се използва.");
      } else {
        setError(`Грешка при регистрацията: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-3xl font-extrabold">
            Регистрация за родители
          </CardTitle>
          <CardDescription className="text-center">
            Създайте акаунт, за да следите успеха на вашето дете
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="text-center py-4">
              <h3 className="text-lg font-medium text-green-600 mb-2">Успешна регистрация!</h3>
              <p className="mb-4">Вашият акаунт беше създаден успешно.</p>
              <p>Ще бъдете пренасочени към страницата за вход...</p>
            </div>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">Име</Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Фамилия</Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="email">Имейл адрес</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="gender">Пол</Label>
                <Select onValueChange={(value) => setGender(value as "male" | "female")} required>
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="Изберете пол" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Мъж</SelectItem>
                    <SelectItem value="female">Жена</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
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
                <Label htmlFor="password">Парола</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="confirmPassword">Потвърдете паролата</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              
              {error && <p className="text-red-500 text-sm">{error}</p>}
              
              <Button type="submit" className="w-full text-white" disabled={loading}>
                {loading ? "Регистрация..." : "Регистрирай се"}
              </Button>
              
              <div className="text-center text-sm mt-4">
                <p>
                  Вече имате акаунт?{" "}
                  <Link href="/login" className="text-blue-600 hover:text-blue-800">
                    Влезте тук
                  </Link>
                </p>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}