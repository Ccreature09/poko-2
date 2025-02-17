"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateProfile } from "firebase/auth";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Teacher, Student } from "@/lib/interfaces";

export default function Profile() {
  const { user, loading } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [roleSpecificData, setRoleSpecificData] = useState<any>(null);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName);
      setLastName(user.lastName);
      setEmail(user.email);
      fetchRoleSpecificData();
    }
  }, [user]);

  const fetchRoleSpecificData = async () => {
    if (!user) return;

    const userRef = doc(db, "schools", user.schoolId, "users", user.userId);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();

    if (user.role === "teacher") {
      const teacherData = userData as Teacher;
      setRoleSpecificData(teacherData.subjectsTaught);
    } else if (user.role === "student") {
      const studentData = userData as Student;
      setRoleSpecificData(studentData.enrolledSubjects);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <div>Please log in to view your profile.</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      // Update Firebase Auth profile
      await updateProfile(user, {
        displayName: `${firstName} ${lastName}`,
      });

      // Update Firestore document
      const userRef = doc(db, "schools", user.schoolId, "users", user.userId);
      await updateDoc(userRef, {
        firstName,
        lastName,
        email,
      });

      setSuccess("Profile updated successfully");
    } catch {
      setError("Failed to update profile");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">User Profile</h1>
      <Card>
        <CardHeader>
          <CardTitle>Edit Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
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
                New Password (leave blank to keep current)
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-red-500">{error}</p>}
            {success && <p className="text-green-500">{success}</p>}
            <Button type="submit">Update Profile</Button>
          </form>
        </CardContent>
      </Card>
      {/* Add role-specific information here */}
      {user.role === "teacher" && roleSpecificData && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Subjects Taught</CardTitle>
          </CardHeader>
          <CardContent>
            <ul>
              {roleSpecificData.map((subject: string, index: number) => (
                <li key={index}>{subject}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      {user.role === "student" && roleSpecificData && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Enrolled Subjects</CardTitle>
          </CardHeader>
          <CardContent>
            <ul>
              {roleSpecificData.map(
                (subject: { subject: string }, index: number) => (
                  <li key={index}>{subject.subject}</li>
                )
              )}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
