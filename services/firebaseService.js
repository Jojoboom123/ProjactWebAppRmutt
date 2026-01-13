
const admin = require("firebase-admin");

let serviceAccount;

try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } 
    else {
        serviceAccount = require("../firebase-key.json");
    }

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("✅ Firebase Admin Initialized");
    }
} catch (error) {
    console.error("⚠️ Firebase Warning: ไม่พบ Service Account (ระบบแจ้งเตือนจะไม่ทำงาน)");
}

exports.sendPushNotification = async (fcmToken, title, body, data = {}) => {
    try {
        if (!serviceAccount || !fcmToken) return;

        const message = {
            token: fcmToken,
            notification: {
                title: title,
                body: body
            },
            // data ต้องเป็น String ทั้งหมด (ข้อกำหนดของ Firebase)
            data: {
                roomId: data.roomId ? data.roomId.toString() : "",
                click_action: "FLUTTER_NOTIFICATION_CLICK"
            }
        };

        await admin.messaging().send(message);
        console.log(`🔔 Notification Sent to: ${fcmToken.substring(0, 10)}...`);
    } catch (error) {
        console.error("❌ Notification Error:", error.message);
    }
};