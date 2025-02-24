"use client";

import type React from "react";

import { SubjectManagement } from "@/components/functional/SubjectManagement";
import Sidebar from "@/components/functional/Sidebar";

export default function ManageSubjects() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <h1 className="text-3xl font-bold mb-8">Управление на предмети</h1>
        <SubjectManagement />
      </div>
    </div>
  );
}
