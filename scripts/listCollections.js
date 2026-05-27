const admin = require('firebase-admin');

// We use the application default credentials from firebase-tools login
admin.initializeApp({
  projectId: 'ubuntu-coliving'
});

async function listCollections() {
  try {
    const db = admin.firestore();
    const collections = await db.listCollections();
    console.log("Collections in ubuntu-coliving:");
    collections.forEach(c => console.log(`- ${c.id}`));
  } catch (err) {
    console.error("Error listing collections:", err);
  }
}

listCollections();
