"use client"

import { useState, useEffect } from "react"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { SubjectClass, HomeroomClass } from "@/lib/interfaces"
import Link from "next/link"

export default function Classes() {
  const [subjectClasses, setSubjectClasses] = useState<SubjectClass[]>([])
  const [homeroomClasses, setHomeroomClasses] = useState<HomeroomClass[]>([])

  useEffect(() => {
    const fetchClasses = async () => {
      const subjectClassesCollection = collection(db, "subjectClasses")
      const homeroomClassesCollection = collection(db, "homeroomClasses")

      const subjectClassesSnapshot = await getDocs(subjectClassesCollection)
      const homeroomClassesSnapshot = await getDocs(homeroomClassesCollection)

      setSubjectClasses(subjectClassesSnapshot.docs.map((doc) => ({ ...doc.data(), classId: doc.id }) as SubjectClass))
      setHomeroomClasses(
        homeroomClassesSnapshot.docs.map((doc) => ({ ...doc.data(), classId: doc.id }) as HomeroomClass),
      )
    }

    fetchClasses()
  }, [])

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Classes</h1>
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Subject Classes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjectClasses.map((subjectClass) => (
            <div key={subjectClass.classId} className="border p-4 rounded-lg shadow">
              <h3 className="text-lg font-medium mb-2">{subjectClass.subject}</h3>
              <p className="text-gray-600 mb-2">
                Teacher: {subjectClass.teacher.firstName} {subjectClass.teacher.lastName}
              </p>
              <p className="text-gray-600 mb-2">Students: {subjectClass.students.length}</p>
              <Link href={`/classes/${subjectClass.classId}`} className="text-blue-500 hover:underline">
                View Class
              </Link>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-2">Homeroom Classes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {homeroomClasses.map((homeroomClass) => (
            <div key={homeroomClass.classId} className="border p-4 rounded-lg shadow">
              <h3 className="text-lg font-medium mb-2">{homeroomClass.className}</h3>
              <p className="text-gray-600 mb-2">
                Teacher: {homeroomClass.homeroomTeacher.firstName} {homeroomClass.homeroomTeacher.lastName}
              </p>
              <p className="text-gray-600 mb-2">Students: {homeroomClass.students.length}</p>
              <Link href={`/classes/${homeroomClass.classId}`} className="text-blue-500 hover:underline">
                View Class
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

