import { db } from "@/lib/firebase";
import { collection, doc, getDocs, setDoc, getDoc } from "firebase/firestore";
import type { HomeroomClass, ClassSession } from "@/lib/interfaces";

export const getClasses = async (
  schoolId: string
): Promise<HomeroomClass[]> => {
  const classesRef = collection(db, "schools", schoolId, "classes");
  const snapshot = await getDocs(classesRef);
  return snapshot.docs.map(
    (doc) =>
      ({
        classId: doc.id,
        ...doc.data(),
      } as HomeroomClass)
  );
};

export const saveTimetable = async (
  schoolId: string,
  classId: string,
  timetable: ClassSession[]
): Promise<void> => {
  const timetableRef = doc(db, "schools", schoolId, "timetables", classId);
  await setDoc(timetableRef, { entries: timetable });
};

export const getTimetable = async (
  schoolId: string,
  classId: string
): Promise<ClassSession[]> => {
  const timetableRef = doc(db, "schools", schoolId, "timetables", classId);
  const snapshot = await getDoc(timetableRef);
  return snapshot.exists() ? snapshot.data().entries : [];
};
