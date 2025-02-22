import { db } from "@/lib/firebase";
import { collection, doc, getDocs, setDoc, getDoc, query, where } from "firebase/firestore";
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
  timetable: ClassSession
): Promise<void> => {
  try {
    const timetableRef = doc(collection(db, "schools", schoolId, "timetables"));
    const {  ...timetableData } = timetable;
    await setDoc(timetableRef, {...timetableData }, { merge: true });
  } catch (error) {
    console.error("Error saving timetable:", error);
  }
};

export const getTimetable = async (
  schoolId: string,
  classId: string
): Promise<ClassSession> => {
  const timetableRef = doc(db, "schools", schoolId, "timetables", classId);
  const snapshot = await getDoc(timetableRef);
  return snapshot.exists() ? (snapshot.data() as ClassSession) : { entries: [], homeroomClassId: "" };
};

export const fetchTimetablesByHomeroomClassId = async (schoolId: string, homeroomClassId: string): Promise<{ id: string, data: ClassSession }[]> => {
  const timetablesRef = collection(db, "schools", schoolId, "timetables");
  const q = query(timetablesRef, where("homeroomClassId", "==", homeroomClassId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() as ClassSession }));
};
