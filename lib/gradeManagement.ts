/**
 * Grade management utilities
 * 
 * This file contains functions for:
 * - Adding, updating, and deleting grades
 * - Creating notifications for students and their parents
 */

import { 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    getDoc, 
    query, 
    where, 
    getDocs, 
    Timestamp 
} from "firebase/firestore";
import { db } from "./firebase";
import type { Grade, GradeType, Subject } from "./interfaces";
import { createNotification, createNotificationBulk, NotificationType, getNotificationLink } from "./notificationManagement";

/**
 * Add a new grade for a student
 */
export const addGrade = async (
    schoolId: string,
    studentId: string,
    subjectId: string,
    teacherId: string,
    data: {
        value: number;
        title: string;
        description?: string;
        type: GradeType;
        date: Date;
    }
): Promise<Grade> => {
    try {
        // Validate grade value (Bulgarian grading system: 2-6)
        if (data.value < 2 || data.value > 6) {
            throw new Error("Grade value must be between 2 and 6");
        }

        // Create grade object
        const gradeData: Omit<Grade, "id"> = {
            studentId,
            subjectId,
            teacherId,
            value: data.value,
            title: data.title,
            description: data.description,
            type: data.type,
            date: Timestamp.fromDate(data.date),
            createdAt: Timestamp.now()
        };

        // Add grade to database
        const gradesCollection = collection(db, "schools", schoolId, "grades");
        const docRef = await addDoc(gradesCollection, gradeData);
        const gradeId = docRef.id;
        
        // Update the document with its ID
        await updateDoc(docRef, { id: gradeId });

        // Get subject name for notification
        const subjectDoc = await getDoc(doc(db, "schools", schoolId, "subjects", subjectId));
        const subjectName = subjectDoc.exists() ? (subjectDoc.data() as Subject).name : "Unknown subject";

        // Create notification for student
        await createNotification(schoolId, {
            userId: studentId,
            title: "Нова оценка",
            message: `Имате нова оценка ${data.value} по ${subjectName}: ${data.title}`,
            type: "new-grade",
            relatedId: gradeId,
            link: await getNotificationLink("new-grade", gradeId)
        });

        // Create notification for student's parents
        await notifyParents(schoolId, studentId, {
            title: "Нова оценка",
            message: `Вашето дете получи нова оценка ${data.value} по ${subjectName}: ${data.title}`,
            type: "new-grade",
            relatedId: gradeId,
            link: await getNotificationLink("new-grade", gradeId)
        });

        return {
            ...gradeData,
            id: gradeId
        } as Grade;
    } catch (error) {
        console.error("Error adding grade:", error);
        throw error;
    }
};

/**
 * Update an existing grade
 */
export const updateGrade = async (
    schoolId: string,
    gradeId: string,
    updates: Partial<{
        value: number;
        title: string;
        description: string;
        type: GradeType;
        date: Date;
    }>
): Promise<void> => {
    try {
        const gradeRef = doc(db, "schools", schoolId, "grades", gradeId);
        const gradeDoc = await getDoc(gradeRef);
        
        if (!gradeDoc.exists()) {
            throw new Error("Grade not found");
        }
        
        const gradeData = gradeDoc.data() as Grade;

        // Prepare updates object
        const updatesObj: Record<string, any> = {};
        if (updates.value !== undefined) {
            // Validate grade value
            if (updates.value < 2 || updates.value > 6) {
                throw new Error("Grade value must be between 2 and 6");
            }
            updatesObj.value = updates.value;
        }
        if (updates.title !== undefined) updatesObj.title = updates.title;
        if (updates.description !== undefined) updatesObj.description = updates.description;
        if (updates.type !== undefined) updatesObj.type = updates.type;
        if (updates.date !== undefined) updatesObj.date = Timestamp.fromDate(updates.date);

        // Update the grade
        await updateDoc(gradeRef, updatesObj);

        // Get subject name for notification
        const subjectDoc = await getDoc(doc(db, "schools", schoolId, "subjects", gradeData.subjectId));
        const subjectName = subjectDoc.exists() ? (subjectDoc.data() as Subject).name : "Unknown subject";

        // Create notification for student
        await createNotification(schoolId, {
            userId: gradeData.studentId,
            title: "Променена оценка",
            message: `Вашата оценка по ${subjectName}: ${gradeData.title} беше променена`,
            type: "edited-grade",
            relatedId: gradeId,
            link: await getNotificationLink("edited-grade", gradeId)
        });

        // Create notification for student's parents
        await notifyParents(schoolId, gradeData.studentId, {
            title: "Променена оценка",
            message: `Оценката на вашето дете по ${subjectName}: ${gradeData.title} беше променена`,
            type: "edited-grade",
            relatedId: gradeId,
            link: await getNotificationLink("edited-grade", gradeId)
        });
    } catch (error) {
        console.error("Error updating grade:", error);
        throw error;
    }
};

/**
 * Delete a grade
 */
export const deleteGrade = async (
    schoolId: string,
    gradeId: string
): Promise<void> => {
    try {
        const gradeRef = doc(db, "schools", schoolId, "grades", gradeId);
        const gradeDoc = await getDoc(gradeRef);
        
        if (!gradeDoc.exists()) {
            throw new Error("Grade not found");
        }
        
        const gradeData = gradeDoc.data() as Grade;

        // Get subject name for notification
        const subjectDoc = await getDoc(doc(db, "schools", schoolId, "subjects", gradeData.subjectId));
        const subjectName = subjectDoc.exists() ? (subjectDoc.data() as Subject).name : "Unknown subject";

        // Create notification for student before deleting the grade
        await createNotification(schoolId, {
            userId: gradeData.studentId,
            title: "Изтрита оценка",
            message: `Вашата оценка ${gradeData.value} по ${subjectName}: ${gradeData.title} беше изтрита`,
            type: "deleted-grade",
            relatedId: gradeId,
            link: await getNotificationLink("deleted-grade", gradeId)
        });

        // Create notification for student's parents
        await notifyParents(schoolId, gradeData.studentId, {
            title: "Изтрита оценка",
            message: `Оценката ${gradeData.value} на вашето дете по ${subjectName}: ${gradeData.title} беше изтрита`,
            type: "deleted-grade",
            relatedId: gradeId,
            link: await getNotificationLink("deleted-grade", gradeId)
        });

        // Delete the grade
        await deleteDoc(gradeRef);

    } catch (error) {
        console.error("Error deleting grade:", error);
        throw error;
    }
};

/**
 * Get grades for a student
 */
export const getStudentGrades = async (
    schoolId: string,
    studentId: string
): Promise<Grade[]> => {
    try {
        const gradesCollection = collection(db, "schools", schoolId, "grades");
        const gradesQuery = query(gradesCollection, where("studentId", "==", studentId));
        const gradesSnapshot = await getDocs(gradesQuery);
        
        return gradesSnapshot.docs.map(doc => ({
            ...doc.data() as Grade,
            id: doc.id
        }));
    } catch (error) {
        console.error("Error getting student grades:", error);
        throw error;
    }
};

/**
 * Get all grades for a subject
 */
export const getSubjectGrades = async (
    schoolId: string,
    subjectId: string
): Promise<Grade[]> => {
    try {
        const gradesCollection = collection(db, "schools", schoolId, "grades");
        const gradesQuery = query(gradesCollection, where("subjectId", "==", subjectId));
        const gradesSnapshot = await getDocs(gradesQuery);
        
        return gradesSnapshot.docs.map(doc => ({
            ...doc.data() as Grade,
            id: doc.id
        }));
    } catch (error) {
        console.error("Error getting subject grades:", error);
        throw error;
    }
};

/**
 * Get all grades entered by a teacher
 */
export const getTeacherGrades = async (
    schoolId: string,
    teacherId: string
): Promise<Grade[]> => {
    try {
        const gradesCollection = collection(db, "schools", schoolId, "grades");
        const gradesQuery = query(gradesCollection, where("teacherId", "==", teacherId));
        const gradesSnapshot = await getDocs(gradesQuery);
        
        return gradesSnapshot.docs.map(doc => ({
            ...doc.data() as Grade,
            id: doc.id
        }));
    } catch (error) {
        console.error("Error getting teacher grades:", error);
        throw error;
    }
};

/**
 * Helper function to notify a student's parents
 */
const notifyParents = async (
    schoolId: string,
    studentId: string,
    notification: {
        title: string;
        message: string;
        type: NotificationType;
        relatedId?: string;
        link?: string;
    }
): Promise<void> => {
    try {
        // Find parents of the student
        const usersCollection = collection(db, "schools", schoolId, "users");
        const parentsQuery = query(usersCollection, where("role", "==", "parent"));
        const parentsSnapshot = await getDocs(parentsQuery);
        
        // Filter parents who have this student as a child
        const parentIds: string[] = [];
        for (const parentDoc of parentsSnapshot.docs) {
            const parentData = parentDoc.data();
            if (parentData.childrenIds && parentData.childrenIds.includes(studentId)) {
                parentIds.push(parentDoc.id);
            }
        }

        // For parent notifications, we'll modify the link to include the child's ID
        const parentNotification = {
            ...notification,
            // For grade-related notifications, add the studentId parameter to the link
            link: notification.type.includes('grade') 
                ? `/grades?childId=${studentId}` 
                : notification.link
        };

        // If there are parents, create notifications for them
        if (parentIds.length > 0) {
            await createNotificationBulk(schoolId, parentIds, parentNotification);
        }
    } catch (error) {
        console.error("Error notifying parents:", error);
        throw error;
    }
};