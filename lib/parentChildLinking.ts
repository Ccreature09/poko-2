import {
  doc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  getDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createNotification } from "@/lib/management/notificationManagement";
import { getUserByEmail } from "@/lib/utils";

// Interface for parent-child link requests
export interface LinkRequest {
  id: string;
  parentId: string;
  parentName: string;
  parentEmail: string;
  childId?: string;
  childEmail: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: import("firebase/firestore").Timestamp | null; // Firestore Timestamp
  updatedAt: import("firebase/firestore").Timestamp | null; // Firestore Timestamp
}

// Interface for linked child info
export interface LinkedChild {
  childId: string;
  childName: string;
  childEmail: string;
}

/**
 * Send a request to link a parent with a child using child's email
 */
export const requestParentChildLink = async (
  schoolId: string,
  parentId: string,
  parentName: string,
  parentEmail: string,
  childEmail: string
): Promise<string> => {
  try {
    // First check if the child email exists in the system
    const childUser = await getUserByEmail(schoolId, childEmail);

    if (!childUser) {
      throw new Error(`No user found with email ${childEmail}`);
    }

    // Check if the user is actually a student
    if (childUser.role !== "student") {
      throw new Error(`User with email ${childEmail} is not a student`);
    }

    // Check if request already exists
    const existingRequestsQuery = query(
      collection(db, "schools", schoolId, "parentChildLinks"),
      where("parentId", "==", parentId),
      where("childEmail", "==", childEmail),
      where("status", "==", "pending")
    );

    const existingRequests = await getDocs(existingRequestsQuery);
    if (!existingRequests.empty) {
      throw new Error(
        `You already have a pending request to link with ${childEmail}`
      );
    }

    // Check if already linked
    const linkedQuery = query(
      collection(db, "schools", schoolId, "parentChildLinks"),
      where("parentId", "==", parentId),
      where("childId", "==", childUser.userId),
      where("status", "==", "accepted")
    );

    const linkedRequests = await getDocs(linkedQuery);
    if (!linkedRequests.empty) {
      throw new Error(`You are already linked with ${childEmail}`);
    }

    // Create the link request
    const linkRequest = {
      parentId,
      parentName,
      parentEmail,
      childId: childUser.userId,
      childEmail,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Add the request to Firestore
    const linkRef = await addDoc(
      collection(db, "schools", schoolId, "parentChildLinks"),
      linkRequest
    );

    // Update with the ID
    await updateDoc(linkRef, { id: linkRef.id });

    // Create a notification for the child
    await createNotification(schoolId, {
      userId: childUser.userId,
      title: "Заявка за свързване от родител",
      message: `${parentName} (${parentEmail}) иска да се свърже с вас като родител. Моля, приемете или отхвърлете заявката.`,
      type: "system-announcement",
      priority: "high",
      metadata: {
        linkRequestId: linkRef.id,
        parentName,
        parentEmail,
        parentId,
      },
      link: "/notifications", // Link to the notifications page where they can accept
    });

    return linkRef.id;
  } catch (error) {
    console.error("Error requesting parent-child link:", error);
    throw error;
  }
};

/**
 * Get all link requests for a child
 */
export const getChildLinkRequests = async (
  schoolId: string,
  childId: string,
  status: "pending" | "accepted" | "rejected" | "all" = "pending"
): Promise<LinkRequest[]> => {
  try {
    let requestsQuery;

    if (status === "all") {
      requestsQuery = query(
        collection(db, "schools", schoolId, "parentChildLinks"),
        where("childId", "==", childId)
      );
    } else {
      requestsQuery = query(
        collection(db, "schools", schoolId, "parentChildLinks"),
        where("childId", "==", childId),
        where("status", "==", status)
      );
    }

    const requestsSnapshot = await getDocs(requestsQuery);
    return requestsSnapshot.docs.map((docSnapshot) => {
      const data = docSnapshot.data() as DocumentData;
      return {
        id: docSnapshot.id,
        parentId: data.parentId,
        parentName: data.parentName,
        parentEmail: data.parentEmail,
        childId: data.childId,
        childEmail: data.childEmail,
        status: data.status,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    });
  } catch (error) {
    console.error("Error getting child link requests:", error);
    return [];
  }
};

/**
 * Get all link requests for a parent
 */
export const getParentLinkRequests = async (
  schoolId: string,
  parentId: string,
  status: "pending" | "accepted" | "rejected" | "all" = "all"
): Promise<LinkRequest[]> => {
  try {
    let requestsQuery;

    if (status === "all") {
      requestsQuery = query(
        collection(db, "schools", schoolId, "parentChildLinks"),
        where("parentId", "==", parentId)
      );
    } else {
      requestsQuery = query(
        collection(db, "schools", schoolId, "parentChildLinks"),
        where("parentId", "==", parentId),
        where("status", "==", status)
      );
    }

    const requestsSnapshot = await getDocs(requestsQuery);
    return requestsSnapshot.docs.map((docSnapshot) => {
      const data = docSnapshot.data() as DocumentData;
      return {
        id: docSnapshot.id,
        parentId: data.parentId,
        parentName: data.parentName,
        parentEmail: data.parentEmail,
        childId: data.childId,
        childEmail: data.childEmail,
        status: data.status,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    });
  } catch (error) {
    console.error("Error getting parent link requests:", error);
    return [];
  }
};

/**
 * Get linked children for a parent
 */
export const getLinkedChildren = async (
  schoolId: string,
  parentId: string
): Promise<LinkedChild[]> => {
  try {
    const linkedQuery = query(
      collection(db, "schools", schoolId, "parentChildLinks"),
      where("parentId", "==", parentId),
      where("status", "==", "accepted")
    );

    const linkedSnapshot = await getDocs(linkedQuery);

    // For each linked child, get their details
    const linkedChildren: LinkedChild[] = [];

    for (const linkDoc of linkedSnapshot.docs) {
      const linkData = linkDoc.data();
      const childId = linkData.childId;

      // Get child details
      const childDoc = await getDoc(
        doc(db, "schools", schoolId, "users", childId)
      );

      if (childDoc.exists()) {
        const childData = childDoc.data();
        linkedChildren.push({
          childId,
          childName: childData.name,
          childEmail: linkData.childEmail,
        });
      }
    }

    return linkedChildren;
  } catch (error) {
    console.error("Error getting linked children:", error);
    return [];
  }
};

/**
 * Respond to a parent-child link request
 */
export const respondToLinkRequest = async (
  schoolId: string,
  requestId: string,
  response: "accepted" | "rejected"
): Promise<boolean> => {
  try {
    const requestRef = doc(
      db,
      "schools",
      schoolId,
      "parentChildLinks",
      requestId
    );
    const requestDoc = await getDoc(requestRef);

    if (!requestDoc.exists()) {
      throw new Error("Link request not found");
    }

    const requestData = requestDoc.data() as LinkRequest;

    if (requestData.status !== "pending") {
      throw new Error("This request has already been processed");
    }

    // Update the request status
    await updateDoc(requestRef, {
      status: response,
      updatedAt: serverTimestamp(),
    });

    // If the response is 'accepted', update the parent's user document
    if (response === "accepted" && requestData.childId) {
      const parentRef = doc(
        db,
        "schools",
        schoolId,
        "users",
        requestData.parentId
      );
      // Add the child's ID to the parent's childrenIds array
      await updateDoc(parentRef, {
        childrenIds: arrayUnion(requestData.childId),
      });
    }

    // Notify the parent about the response
    let notificationTitle, notificationMessage;

    if (response === "accepted") {
      notificationTitle = "Връзка с ученик приета";
      notificationMessage = `Вашата заявка за свързване с ${requestData.childEmail} беше приета.`;
    } else {
      notificationTitle = "Връзка с ученик отхвърлена";
      notificationMessage = `Вашата заявка за свързване с ${requestData.childEmail} беше отхвърлена.`;
    }

    await createNotification(schoolId, {
      userId: requestData.parentId,
      title: notificationTitle,
      message: notificationMessage,
      type: "system-announcement",
      metadata: {
        linkRequestId: requestId,
        childEmail: requestData.childEmail,
        response,
      },
      link: "/parent/linked-children", // Direct to the linked-children page instead of dashboard
    });

    return true;
  } catch (error) {
    console.error("Error responding to link request:", error);
    throw error;
  }
};

/**
 * Delete a parent-child link
 */
export const unlinkParentChild = async (
  schoolId: string,
  linkId: string
): Promise<boolean> => {
  try {
    // Get the link information before deleting
    const linkRef = doc(db, "schools", schoolId, "parentChildLinks", linkId);
    const linkDoc = await getDoc(linkRef);

    if (!linkDoc.exists()) {
      throw new Error("Link not found");
    }

    const linkData = linkDoc.data() as LinkRequest;

    // Delete the link document
    await deleteDoc(linkRef);

    // If there's a childId, update the parent's document to remove it
    if (linkData.childId && linkData.status === "accepted") {
      const parentRef = doc(
        db,
        "schools",
        schoolId,
        "users",
        linkData.parentId
      );
      // Remove the child's ID from the parent's childrenIds array
      await updateDoc(parentRef, {
        childrenIds: arrayRemove(linkData.childId),
      });
    }

    return true;
  } catch (error) {
    console.error("Error unlinking parent-child:", error);
    throw error;
  }
};
