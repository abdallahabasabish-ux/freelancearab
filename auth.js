// auth.js
import { auth, db } from './firebase-config.js';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const provider = new GoogleAuthProvider();

// عناصر واجهة المستخدم
const authSection = document.getElementById('auth-section');
const profileForm = document.getElementById('profile-form');
const googleBtn = document.getElementById('google-login-btn');
const authMessage = document.getElementById('auth-message');
const userDashboard = document.getElementById('user-dashboard');
const logoutBtn = document.getElementById('logout-btn');

let currentUser = null;

// 1. مراقبة حالة تسجيل الدخول
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        // التحقق مما إذا كان الطالب قد استكمل بياناته سابقاً
        const docRef = doc(db, "students", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            // البيانات مكتملة، عرض لوحة الترحيب
            showUserDashboard(docSnap.data());
        } else {
            // أول مرة يسجل دخول، إظهار نموذج استكمال البيانات
            googleBtn.style.display = 'none';
            profileForm.style.display = 'block';
            authMessage.innerText = "نجح تسجيل الدخول! يرجى استكمال البيانات أدناه.";
            authMessage.style.color = "green";
        }
    } else {
        // غير مسجل دخول
        authSection.style.display = 'block';
        userDashboard.style.display = 'none';
        googleBtn.style.display = 'block';
        profileForm.style.display = 'none';
    }
});

// 2. التسجيل بواسطة Google
googleBtn.addEventListener('click', async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        authMessage.innerText = "حدث خطأ أثناء تسجيل الدخول: " + error.message;
        authMessage.style.color = "red";
    }
});

// 3. استكمال البيانات وحفظ الموقع الجغرافي
profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('save-profile-btn');
    submitBtn.innerText = "جاري تحديد الموقع وحفظ البيانات...";
    submitBtn.disabled = true;

    // جلب بيانات النموذج
    const firstName = document.getElementById('first-name').value;
    const middleName = document.getElementById('middle-name').value;
    const lastName = document.getElementById('last-name').value;
    const phone = document.getElementById('country-code').value + document.getElementById('phone').value;
    const age = document.getElementById('age').value;

    // دالة لتحديد الموقع الجغرافي
    const getLocation = () => {
        return new Promise((resolve, reject) => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    position => resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    }),
                    error => reject(error)
                );
            } else {
                reject(new Error("المتصفح لا يدعم تحديد الموقع"));
            }
        });
    };

    try {
        // محاولة جلب الإحداثيات
        let locationData = { lat: null, lng: null, country: "غير محدد", city: "غير محدد" };
        try {
            const coords = await getLocation();
            locationData.lat = coords.lat;
            locationData.lng = coords.lng;
            
            // في مشروع حقيقي يتم استخدام API مثل (OpenCage أو Google Maps) لتحويل الإحداثيات لاسم دولة ومدينة.
            // هنا سنحفظ الإحداثيات كإثبات موقع للسهولة.
            locationData.country = "تم حفظ الإحداثيات"; 
        } catch (locError) {
            console.log("تعذر تحديد الموقع الجغرافي، سيتم الحفظ بدونه.");
        }

        // حفظ البيانات في Firestore في مجموعة students
        const studentData = {
            firstName: firstName,
            middleName: middleName,
            lastName: lastName,
            fullName: `${firstName} ${middleName} ${lastName}`,
            phone: phone,
            age: age,
            email: currentUser.email,
            photoURL: currentUser.photoURL, // الصورة من جيميل
            location: locationData,
            createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, "students", currentUser.uid), studentData);
        
        alert("تم إنشاء الحساب بنجاح!");
        showUserDashboard(studentData);
        
    } catch (error) {
        authMessage.innerText = "خطأ في حفظ البيانات: " + error.message;
        authMessage.style.color = "red";
        submitBtn.innerText = "حفظ البيانات والدخول للأكاديمية";
        submitBtn.disabled = false;
    }
});

// 4. عرض واجهة المستخدم بعد الدخول
function showUserDashboard(data) {
    authSection.style.display = 'none';
    userDashboard.style.display = 'block';
    
    document.getElementById('user-photo').src = data.photoURL || 'https://via.placeholder.com/100';
    document.getElementById('welcome-message').innerText = `أهلاً بك يا ${data.firstName}!`;
    
    if(data.location && data.location.lat) {
        document.getElementById('user-location').innerText = `تم تسجيل دخولك بناءً على إحداثيات موقعك`;
    }
}

// 5. تسجيل الخروج
logoutBtn.addEventListener('click', () => {
    signOut(auth);
});
