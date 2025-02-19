import { db } from "@/lib/firebase";
import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import type { Subject } from "@/lib/interfaces";

export const getSubjects = async (schoolId: string): Promise<Subject[]> => {
  const subjectsCollection = collection(db, "schools", schoolId, "subjects");
  const subjectsSnapshot = await getDocs(subjectsCollection);
  return subjectsSnapshot.docs.map(
    (doc) =>
      ({
        subjectId: doc.id,
        ...doc.data(),
      } as Subject)
  );
};

export const addSubject = async (
  schoolId: string,
  subject: Subject
): Promise<void> => {
  const subjectsCollection = collection(db, "schools", schoolId, "subjects");
  await setDoc(doc(subjectsCollection), subject);
};

export const deleteSubject = async (
  schoolId: string,
  subjectId: string
): Promise<void> => {
  const subjectRef = doc(db, "schools", schoolId, "subjects", subjectId);
  await deleteDoc(subjectRef);
};
