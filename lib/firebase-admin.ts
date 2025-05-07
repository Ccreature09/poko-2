import admin from "firebase-admin";

interface FirebaseAdminAppParams {
  projectId: string;
  clientEmail: string;
  privateKey: string | undefined;
}

function formatPrivateKey(key: string | undefined) {
  if (!key) return "";
  // Handle both escaped newlines and already formatted keys
  return key.includes("\\n") ? key.replace(/\\n/g, "\n") : key;
}

export function createFirebaseAdminApp(params: FirebaseAdminAppParams) {
  // Check if all required parameters are present
  if (!params.projectId || !params.clientEmail || !params.privateKey) {
    console.error("Missing required Firebase admin parameters");
    throw new Error("Firebase Admin SDK missing required configuration");
  }

  const privateKey = formatPrivateKey(params.privateKey);

  // Check if admin app is already initialized
  if (admin.apps.length > 0) {
    return admin.app();
  }

  // Create credential and initialize app
  try {
    const cert = admin.credential.cert({
      projectId: params.projectId,
      clientEmail: params.clientEmail,
      privateKey,
    });

    return admin.initializeApp({
      credential: cert,
      projectId: params.projectId,
    });
  } catch (error) {
    console.error("Error initializing Firebase Admin SDK:", error);
    throw new Error("Failed to initialize Firebase Admin SDK");
  }
}

export async function initAdmin() {
  try {
    // Log the presence of environment variables (without exposing sensitive values)
    console.log(
      "Firebase Admin initialization: checking environment variables"
    );
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId) console.warn("Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID");
    if (!clientEmail) console.warn("Missing FIREBASE_CLIENT_EMAIL");
    if (!privateKey) console.warn("Missing FIREBASE_PRIVATE_KEY");

    // Add more detailed logging for debugging
    console.log(`Project ID available: ${!!projectId}`);
    console.log(`Client Email available: ${!!clientEmail}`);
    console.log(`Private Key available: ${!!privateKey}`);

    const params = {
      projectId: projectId as string,
      clientEmail: clientEmail as string,
      privateKey: privateKey,
    };

    return createFirebaseAdminApp(params);
  } catch (error) {
    console.error("Failed to initialize Firebase Admin:", error);
    throw error; // Re-throw to let calling code handle it
  }
}
