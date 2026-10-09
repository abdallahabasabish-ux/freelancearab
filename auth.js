// auth.js
import { auth, db, googleProvider } from './firebase-config.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const DOM = {
    authSection: document.getElementById('auth-section'),
    profileForm: document.getElementById('profile-form'),
    googleBtn: document.getElementById('google-login-btn'),
    alert: document.getElementById('auth-alert'),
    dashboard: document.getElementById('user-dashboard'),
    logoutBtn: document.getElementById('logout-btn')
};

let currentUser = null;

function showAlert(msg, isError = false) {
    DOM.alert.style.display = 'block';
    DOM.alert.className = isError ? 'alert alert-error' : 'alert alert-success';
    DOM.alert.innerText = msg;
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const docSnap = await getDoc(doc(db, "students", user.uid));
        
        if (docSnap.exists()) {
            renderDashboard(docSnap.data());
        } else {
            DOM.googleBtn.style.display = 'none';
            DOM.profileForm.style.display = 'block';
            showAlert("يرجى استكمال البيانات الإلزامية مرة واحدة فقط.");
        }
    } else {
        DOM.authSection.style.display = 'block';
        DOM.dashboard.style.display = 'none';
        DOM.googleBtn.style.display = 'block';
        DOM.profileForm.style.display = 'none';
        DOM.alert.style.display = 'none';
    }
});

DOM.googleBtn.onclick = async () => {
    try { await signInWithPopup(auth, googleProvider); } 
    catch (err) { showAlert(err.message, true); }
};

DOM.profileForm.onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('save-profile-btn');
    btn.disabled = true; btn.innerText = "جاري التوثيق...";

    const data = {
        firstName: document.getElementById('f-name').value.trim(),
        lastName: document.getElementById('l-name').value.trim(),
        phone: document.getElementById('c-code').value.trim() + document.getElementById('phone').value.trim(),
        age: parseInt(document.getElementById('age').value),
        email: currentUser.email,
        photoURL: currentUser.photoURL || 'https://via.placeholder.com/150',
        createdAt: new Date().toISOString(),
        role: "student",
        completedLessons: [],
        pointsTotal: 0,
        certificates: []
    };

    // جلب الموقع
    try {
        const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
        data.location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch(e) { data.location = { lat: null, lng: null }; }

    try {
        await setDoc(doc(db, "students", currentUser.uid), data);
        renderDashboard(data);
    } catch(err) {
        showAlert("خطأ في الحفظ: " + err.message, true);
        btn.disabled = false; btn.innerText = "حفظ ودخول الأكاديمية";
    }
};

function renderDashboard(data) {
    DOM.authSection.style.display = 'none';
    DOM.dashboard.style.display = 'block';
    
    document.getElementById('user-photo').src = data.photoURL;
    document.getElementById('welcome-message').innerText = `أهلاً بك، ${data.firstName} ${data.lastName}`;
    document.getElementById('user-points').innerText = data.pointsTotal || 0;
    
    const locText = data.location && data.location.lat ? "✅ تم توثيق موقعك الجغرافي" : "⚠️ لم يتم توثيق الموقع";
    document.getElementById('user-info').innerText = `${data.email} | ${data.phone} | ${locText}`;

    // عرض الشهادات
    const certList = document.getElementById('certificates-list');
    certList.innerHTML = '';
    
    if(!data.certificates || data.certificates.length === 0) {
        certList.innerHTML = '<p style="color: var(--text-muted);">لا يوجد شهادات معتمدة حتى الآن. أكمل كورساتك لتحصل عليها!</p>';
        return;
    }

    data.certificates.forEach(cert => {
        const lnk = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(cert.courseName)}&organizationName=${encodeURIComponent("أكاديمية عرب فريلانسر")}&issueYear=${new Date(cert.date).getFullYear()}&certUrl=${encodeURIComponent(cert.pdfLink)}&certId=${cert.verifyCode}`;
        
        certList.innerHTML += `
            <div style="background-color: var(--bg-color); padding: 1.5rem; border-radius: 6px; margin-bottom: 1rem; border: 1px solid var(--border-color);">
                <h4 style="color: var(--primary-color); font-size: 1.2rem; margin-bottom: 0.5rem;">${cert.courseName}</h4>
                <p style="margin-bottom: 0.5rem;">تاريخ الإصدار: <strong>${new Date(cert.date).toLocaleDateString('ar-EG')}</strong></p>
                <p style="margin-bottom: 1rem;">كود التحقق: <span style="background: #e5e7eb; padding: 3px 8px; border-radius: 4px; color: #000; font-family: monospace; font-weight: bold;">${cert.verifyCode}</span></p>
                <div style="display:flex; gap: 10px;">
                    <a href="${cert.pdfLink}" target="_blank" class="btn btn-secondary">عرض الشهادة (PDF)</a>
                    <a href="${lnk}" target="_blank" class="btn" style="background-color: #0a66c2; color: #fff;">مشاركة على LinkedIn</a>
                </div>
            </div>`;
    });
}

DOM.logoutBtn.onclick = () => signOut(auth);
