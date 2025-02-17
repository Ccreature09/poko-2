"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { SubjectClass, HomeroomClass, Timetable } from "@/lib/interfaces"

export default function ClassDetails() {
  const { classId } = useParams()
  const [classData, setClassData] = useState<SubjectClass | HomeroomClass | null>(null)
  const [timetable, setTimetable] = useState<Timetable | null>(null)

  useEffect(() => {
    const fetchClassData = async () => {
      const subjectClassDoc = await getDoc(doc(db, "subjectClasses", classId as string))
      const homeroomClassDoc = await getDoc(doc(db, "homeroomClasses", classId as string))

      if (subjectClassDoc.exists()) {
        setClassData({ ...subjectClassDoc.data(), classId: subjectClassDoc.id } as SubjectClass)
      } else if (homeroomClassDoc.exists()) {
        setClassData({ ...homeroomClassDoc.data(), classId: homeroomClassDoc.id } as HomeroomClass)
      }

      // Fetch timetable
      const timetableDoc = await getDoc(doc(db, "timetables", classId as string))
      if (timetableDoc.exists()) {
        setTimetable(timetableDoc.data() as Timetable)
      }
    }

    fetchClassData()
  }, [classId])

  if (!classData) {
    return <div>Loading...</div>
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">
        {"subject" in classData ? `${classData.subject} Class` : `${classData.className} Homeroom`}
      </h1>
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Class Information</h2>
        <p className="text-gray-600">
          Teacher:{" "}
          {"teacher" in classData
            ? `${classData.teacher.firstName} ${classData.teacher.lastName}`
            : `${classData.homeroomTeacher.firstName} ${classData.homeroomTeacher.lastName}`}
        </p>
        <p className="text-gray-600">Students: {classData.students.length}</p>
      </div>
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Students</h2>
        <ul className="list-disc list-inside">
          {classData.students.map((student) => (
            <li key={student.userId}>
              {student.firstName} {student.lastName}
            </li>
          ))}
        </ul>
      </div>
      {timetable && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Timetable</h2>
          {Object.entries(timetable).map(([day, sessions]) => (
            <div key={day} className="mb-4">
              <h3 className="text-lg font-medium mb-2">{day}</h3>
              <ul className="list-disc list-inside">
                {sessions.map((session, index) => (
                  <li key={index}>
                    {session.subject}: {session.startTime} - {session.endTime}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

