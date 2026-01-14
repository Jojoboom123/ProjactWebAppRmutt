const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

console.log("🔥 Firebase Admin Initialized");

//  ฟังก์ชันหลัก: ปรับให้รับค่า token, title, body, data ตรงๆ เพื่อให้ server.js เรียกใช้ง่าย
exports.sendPushNotification = async (token, title, body, data = {}, options = {}) => {
  try {
    if (!token) {
        console.log('⚠️ No FCM Token provided, skipping notification.');
        return;
    }

    // แปลง data ทุกตัวเป็น String (Firebase บังคับ)
    const stringifiedData = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        typeof value === 'string' ? value : JSON.stringify(value)
      ])
    );

    const message = {
      token: token,
      notification: {
        title: title,
        body: body
      },
      data: stringifiedData, // ส่ง Data ไปด้วย (เช่น roomId)
      android: {
        notification: {
          sound: 'default',
          priority: 'high',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            contentAvailable: true
          }
        }
      }
    };

    const response = await admin.messaging().send(message);
    console.log('✅ Notification sent successfully:', response);
    return { success: true, messageId: response };

  } catch (error) {
    console.error('❌ Error sending notification:', error.message);
    
    // จัดการกรณี Token หมดอายุ
    if (error.code === 'messaging/registration-token-not-registered') {
        return { success: false, error: 'INVALID_TOKEN' };
    }
    return { success: false, error: error.code };
  }
};