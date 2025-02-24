"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateProfile } from "firebase/auth";
import { doc, updateDoc} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export default function Profile() {
  const { user, loading } = useUser();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName);
      setLastName(user.lastName);
      setEmail(user.email);
    }
  }, [user]);

 

  if (loading) {
    return <div>Зареждане...</div>;
  }

  if (!user) {
    return <div>Моля, влезте в системата, за да видите профила си.</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: `${firstName} ${lastName}`,
        });
      } else {
        throw new Error("No authenticated user found");
      }

      // Update Firestore document
      const userRef = doc(db, "schools", user.schoolId, "users", user.userId);
      await updateDoc(userRef, {
        firstName,
        lastName,
        email,
      });

      setSuccess("Профилът е актуализиран успешно");
    } catch {
      setError("Неуспешно актуализиране на профила");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Потребителски профил</h1>
      <Card>
        <CardHeader>
          <CardTitle>Редактиране на профил</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="firstName">Име</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="lastName">Фамилия</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Имейл</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">
                Нова парола (оставете празно, за да запазите текущата)
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-red-500">Неуспешно актуализиране на профила</p>}
            {success && <p className="text-green-500">Профилът е актуализиран успешно</p>}
            <Button type="submit" className="text-white">Актуализиране на профила</Button>
          </form>
        </CardContent>
      </Card>
      {/* Add role-specific information here */}
     
    </div>
  );
}
