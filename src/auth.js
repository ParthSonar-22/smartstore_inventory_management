// src/auth.js – Firebase Authentication with Email Verification
import { auth, googleProvider, db } from './firebase.js';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

function isValidEmail(email) {
  // Standard email format validation (requires username, @, domain, and valid TLD)
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(email);
}

export function renderAuthPage() {
  const page = document.getElementById('auth-page');
  page.innerHTML = `
    <div class="min-h-screen relative overflow-hidden flex items-center justify-center p-5">

      <!-- ── Animated gradient background ── -->
      <div class="absolute inset-0 bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e]"></div>

      <!-- Animated blobs -->
      <div class="absolute top-0 left-1/4 w-80 h-80 bg-primary/20 rounded-full blur-3xl blob"></div>
      <div class="absolute bottom-10 right-1/4 w-72 h-72 bg-secondary-container/40 rounded-full blur-3xl blob blob-delay-2"></div>
      <div class="absolute top-1/2 -right-20 w-64 h-64 bg-tertiary/20 rounded-full blur-3xl blob blob-delay-4"></div>
      <div class="absolute -bottom-10 left-0 w-56 h-56 bg-primary-container/30 rounded-full blur-3xl blob blob-delay-2"></div>

      <!-- ── Glass card ── -->
      <div class="relative z-10 w-full max-w-md">

        <!-- Logo + branding -->
        <div class="text-center mb-6">
          <div class="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-secondary-container shadow-2xl shadow-primary/40 mb-3.5">
            <img src="/logo.jpg" alt="SmartStore" class="w-16 h-16 rounded-2xl object-cover">
          </div>
          <h1 class="font-headline-sm text-[28px] font-bold text-white tracking-tight">SmartStore</h1>
          <p class="font-body-sm text-[13px] text-white/60 mt-0.5">Smart Inventory & Purchase Manager</p>
        </div>

        <!-- Card container -->
        <div id="auth-card-body" class="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-6 shadow-2xl transition-all">

          <!-- ══ FORM VIEW (Sign In / Sign Up) ══ -->
          <div id="auth-form-container">
            <!-- Tab bar -->
            <div class="flex bg-white/10 rounded-xl p-1 mb-5" id="auth-tabs">
              <button id="tab-signin" class="auth-tab flex-1 py-2 rounded-lg font-label-metric text-label-metric font-bold text-on-primary bg-primary transition-all">Sign In</button>
              <button id="tab-signup" class="auth-tab flex-1 py-2 rounded-lg font-label-metric text-label-metric font-semibold text-white/60 transition-all">Sign Up</button>
            </div>

            <!-- Error banner -->
            <div id="auth-error" class="hidden mb-4 p-3 rounded-xl bg-error-container/60 border border-error/30 text-[#ffb4ab] font-body-sm text-[13px] leading-snug"></div>

            <!-- Success banner -->
            <div id="auth-success" class="hidden mb-4 p-3 rounded-xl bg-primary/20 border border-primary/30 text-primary font-body-sm text-[13px] leading-snug"></div>

            <!-- Email -->
            <div class="mb-3">
              <label class="font-label-metric text-[11px] text-white/50 uppercase tracking-wider block mb-1.5">Email Address *</label>
              <input id="auth-email" type="email" placeholder="name@yourcompany.com" autocomplete="email"
                class="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/70 focus:bg-white/15 transition-all font-body-md text-body-md">
            </div>

            <!-- Password -->
            <div class="mb-3">
              <div class="flex items-center justify-between mb-1.5">
                <label class="font-label-metric text-[11px] text-white/50 uppercase tracking-wider block">Password *</label>
                <span id="pwd-hint" class="font-label-metric text-[10px] text-white/40">Min. 6 characters</span>
              </div>
              <input id="auth-password" type="password" placeholder="••••••••" autocomplete="current-password"
                class="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/70 focus:bg-white/15 transition-all font-body-md text-body-md">
            </div>

            <!-- Extra Profile & Invoice Address fields for Sign Up -->
            <div id="signup-extra-fields" class="hidden space-y-3 mb-4 pt-2 border-t border-white/15">
              <div class="text-[12px] text-primary font-semibold flex items-center gap-1.5 pt-1">
                <span class="material-symbols-outlined text-[16px]">receipt_long</span>
                <span>Invoice Recipient & Address (Saved for Bills)</span>
              </div>
              <div>
                <label class="font-label-metric text-[11px] text-white/50 uppercase tracking-wider block mb-1">Full Name (Invoice Recipient) *</label>
                <input id="auth-name" type="text" placeholder="e.g. Rajesh Sharma" autocomplete="name"
                  class="w-full bg-white/10 border border-white/15 rounded-xl px-3.5 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/70 focus:bg-white/15 transition-all text-[13px]">
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="font-label-metric text-[11px] text-white/50 uppercase tracking-wider block mb-1">Store / Business</label>
                  <input id="auth-shop" type="text" placeholder="e.g. Apex Hardware"
                    class="w-full bg-white/10 border border-white/15 rounded-xl px-3 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/70 focus:bg-white/15 transition-all text-[13px]">
                </div>
                <div>
                  <label class="font-label-metric text-[11px] text-white/50 uppercase tracking-wider block mb-1">Phone / Mobile</label>
                  <input id="auth-phone" type="tel" placeholder="e.g. 9820012345" autocomplete="tel"
                    class="w-full bg-white/10 border border-white/15 rounded-xl px-3 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/70 focus:bg-white/15 transition-all text-[13px]">
                </div>
              </div>
              <div>
                <label class="font-label-metric text-[11px] text-white/50 uppercase tracking-wider block mb-1">Local Address (for Invoices)</label>
                <input id="auth-address" type="text" placeholder="e.g. Shop No. 4, Market Complex" autocomplete="street-address"
                  class="w-full bg-white/10 border border-white/15 rounded-xl px-3.5 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/70 focus:bg-white/15 transition-all text-[13px]">
              </div>
              <div class="grid grid-cols-3 gap-2">
                <div>
                  <label class="font-label-metric text-[10px] text-white/50 uppercase tracking-wider block mb-1">City</label>
                  <input id="auth-city" type="text" placeholder="Mumbai"
                    class="w-full bg-white/10 border border-white/15 rounded-xl px-2.5 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/70 focus:bg-white/15 transition-all text-[12px]">
                </div>
                <div>
                  <label class="font-label-metric text-[10px] text-white/50 uppercase tracking-wider block mb-1">State</label>
                  <input id="auth-state" type="text" placeholder="Maharashtra"
                    class="w-full bg-white/10 border border-white/15 rounded-xl px-2.5 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/70 focus:bg-white/15 transition-all text-[12px]">
                </div>
                <div>
                  <label class="font-label-metric text-[10px] text-white/50 uppercase tracking-wider block mb-1">PIN Code</label>
                  <input id="auth-pincode" type="text" placeholder="400001"
                    class="w-full bg-white/10 border border-white/15 rounded-xl px-2.5 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/70 focus:bg-white/15 transition-all text-[12px]">
                </div>
              </div>
            </div>

            <!-- Primary action -->
            <button id="auth-submit"
              class="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline-sm text-[15px] font-bold shadow-xl shadow-primary/25 active:scale-95 transition-all mb-4 flex items-center justify-center gap-2">
              <span class="material-symbols-outlined text-[18px]">login</span>
              <span id="auth-submit-label">Sign In</span>
            </button>

            <!-- Divider -->
            <div class="flex items-center gap-3 mb-4">
              <div class="flex-1 h-px bg-white/15"></div>
              <span class="font-label-metric text-[10px] text-white/40 uppercase tracking-wider">or</span>
              <div class="flex-1 h-px bg-white/15"></div>
            </div>

            <!-- Google -->
            <button id="google-signin"
              class="w-full py-3 rounded-xl bg-white text-[#1f1f1f] font-headline-sm text-[14px] font-bold flex items-center justify-center gap-3 hover:bg-gray-100 active:scale-95 transition-all shadow-xl">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.165 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          </div>

          <!-- ══ EMAIL VERIFICATION VIEW (shown when unverified) ══ -->
          <div id="auth-verify-container" class="hidden text-center py-1">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 text-primary mb-3.5 shadow-lg">
              <span class="material-symbols-outlined text-[36px]">mark_email_unread</span>
            </div>
            <h2 class="font-headline-sm text-[22px] font-bold text-white mb-1.5">Verify Your Email</h2>
            <p class="font-body-sm text-[13px] text-white/70 leading-relaxed mb-4">
              A verification link was sent to:<br>
              <span id="verify-email-display" class="font-semibold text-primary break-all"></span>
            </p>

            <div class="p-3.5 rounded-xl bg-white/5 border border-white/10 text-left mb-5">
              <div class="flex items-start gap-2.5">
                <span class="material-symbols-outlined text-primary text-[18px] mt-0.5 flex-shrink-0">verified_user</span>
                <div class="font-body-sm text-[12px] text-white/80 leading-normal">
                  <span class="font-semibold text-white block mb-0.5">Quick 2-Step Activation:</span>
                  1. Open your inbox (or Spam folder)<br>
                  2. Click the verification link from Firebase<br>
                  Then tap <strong>I've Verified — Sign In</strong> below.
                </div>
              </div>
            </div>

            <div id="verify-msg" class="hidden mb-4 p-2.5 rounded-xl bg-primary/20 text-primary font-body-sm text-[12px]"></div>

            <button id="btn-verified-signin"
              class="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline-sm text-[14px] font-bold shadow-xl shadow-primary/25 active:scale-95 transition-all mb-3 flex items-center justify-center gap-2">
              <span class="material-symbols-outlined text-[18px]">check_circle</span>
              <span>I've Verified — Sign In</span>
            </button>

            <div class="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
              <button id="btn-resend-link" type="button" class="text-white/60 hover:text-white font-label-metric text-[12px] py-1.5 underline underline-offset-4 transition-colors">
                Resend Link
              </button>
              <button id="btn-back-to-auth" type="button" class="text-white/60 hover:text-white font-label-metric text-[12px] py-1.5 transition-colors">
                Change Email / Back
              </button>
            </div>
          </div>

        </div>

        <!-- Footer note -->
        <p class="text-center font-body-sm text-[11px] text-white/30 mt-4">
          Protected by Google Firebase Authentication 🔐
        </p>
      </div>
    </div>
  `;

  // ── Logic & Event Handlers ──────────────────────────────────
  let mode = 'signin'; // 'signin' | 'signup'
  let pendingEmail = '';
  let pendingPassword = '';

  const tabSignin       = document.getElementById('tab-signin');
  const tabSignup       = document.getElementById('tab-signup');
  const submitLabel     = document.getElementById('auth-submit-label');
  const submitBtn       = document.getElementById('auth-submit');
  const errBox          = document.getElementById('auth-error');
  const successBox      = document.getElementById('auth-success');
  const formContainer   = document.getElementById('auth-form-container');
  const verifyContainer = document.getElementById('auth-verify-container');
  const verifyEmailDisp = document.getElementById('verify-email-display');
  const verifyMsg       = document.getElementById('verify-msg');

  const signupExtra     = document.getElementById('signup-extra-fields');

  function setTab(t) {
    mode = t;
    const active   = 'auth-tab flex-1 py-2 rounded-lg font-label-metric text-label-metric font-bold text-on-primary bg-primary transition-all';
    const inactive = 'auth-tab flex-1 py-2 rounded-lg font-label-metric text-label-metric font-semibold text-white/60 transition-all';
    tabSignin.className = t === 'signin' ? active : inactive;
    tabSignup.className = t === 'signup' ? active : inactive;
    submitLabel.textContent = t === 'signin' ? 'Sign In' : 'Create Account & Verify';
    if (t === 'signup') {
      signupExtra?.classList.remove('hidden');
    } else {
      signupExtra?.classList.add('hidden');
    }
    errBox.classList.add('hidden');
    successBox.classList.add('hidden');
  }

  tabSignin.addEventListener('click', () => setTab('signin'));
  tabSignup.addEventListener('click', () => setTab('signup'));

  function showErr(msg) {
    errBox.textContent = msg;
    errBox.classList.remove('hidden');
    successBox.classList.add('hidden');
  }

  function showSuccess(msg) {
    successBox.textContent = msg;
    successBox.classList.remove('hidden');
    errBox.classList.add('hidden');
  }

  function setLoading(on) {
    submitBtn.disabled = on;
    submitBtn.innerHTML = on
      ? `<span class="material-symbols-outlined text-[18px] animate-spin">sync</span><span>Please wait…</span>`
      : `<span class="material-symbols-outlined text-[18px]">${mode === 'signin' ? 'login' : 'how_to_reg'}</span><span id="auth-submit-label">${mode === 'signin' ? 'Sign In' : 'Create Account & Verify'}</span>`;
  }

  function showVerifyScreen(email, password = '') {
    pendingEmail = email;
    pendingPassword = password;
    verifyEmailDisp.textContent = email;
    formContainer.classList.add('hidden');
    verifyContainer.classList.remove('hidden');
    verifyMsg.classList.add('hidden');
  }

  function showFormScreen() {
    verifyContainer.classList.add('hidden');
    formContainer.classList.remove('hidden');
    errBox.classList.add('hidden');
  }

  // ── Submit handler ──────────────────────────────────────────
  submitBtn.addEventListener('click', async () => {
    const emailInput = document.getElementById('auth-email');
    const pwdInput   = document.getElementById('auth-password');
    const email      = emailInput.value.trim();
    const password   = pwdInput.value;

    if (!email || !password) {
      return showErr('Please enter both email and password.');
    }

    // Real email validation
    if (!isValidEmail(email)) {
      return showErr('Please enter a valid, real email address (e.g., name@gmail.com).');
    }

    // Real-life password constraint: min 6 chars (enforced by Firebase)
    if (password.length < 6) {
      return showErr('Password must be at least 6 characters long.');
    }

    setLoading(true);
    errBox.classList.add('hidden');
    successBox.classList.add('hidden');

    try {
      if (mode === 'signup') {
        const name = document.getElementById('auth-name')?.value.trim();
        if (!name) {
          setLoading(false);
          return showErr('Please enter your full name for invoice recipient info.');
        }

        const profileData = {
          name: name,
          shopName: document.getElementById('auth-shop')?.value.trim() || '',
          phone: document.getElementById('auth-phone')?.value.trim() || '',
          address1: document.getElementById('auth-address')?.value.trim() || '',
          address2: '',
          city: document.getElementById('auth-city')?.value.trim() || 'Mumbai',
          state: document.getElementById('auth-state')?.value.trim() || 'Maharashtra',
          pincode: document.getElementById('auth-pincode')?.value.trim() || '400001',
          email: email,
          updatedAt: new Date().toISOString()
        };

        // ── Sign Up Flow ──────────────────────────────────────
        // 1. Create user in Firebase
        const cred = await createUserWithEmailAndPassword(auth, email, password);

        // Save profile locally & into Firestore
        try {
          localStorage.setItem('smartstore_user_profile', JSON.stringify(profileData));
          await setDoc(doc(db, 'users', cred.user.uid), profileData, { merge: true });
        } catch (_) {}

        // 2. Try sending verification email gracefully in background
        try {
          await sendEmailVerification(cred.user);
        } catch (_) {}
        // User is now logged in; onAuthStateChanged will open main-app seamlessly!
      } else {
        // ── Sign In Flow ──────────────────────────────────────
        const cred = await signInWithEmailAndPassword(auth, email, password);
        // If unverified, try to send verification in background without blocking access
        if (!cred.user.emailVerified) {
          try {
            await sendEmailVerification(cred.user);
          } catch (_) {}
        }
        // User logged in; onAuthStateChanged in app.js will open main app!
      }
    } catch (e) {
      const msgs = {
        'auth/user-not-found':       'No account found with this email. Please Sign Up.',
        'auth/wrong-password':       'Incorrect password. Please try again.',
        'auth/email-already-in-use': 'An account already exists with this email. Please Sign In.',
        'auth/invalid-email':        'Please enter a valid real email address.',
        'auth/too-many-requests':    'Too many attempts. Please wait a few moments and try again.',
        'auth/invalid-credential':   'Incorrect email or password. Please verify and try again.',
        'auth/weak-password':        'Password is too short. Please use at least 6 characters.',
      };
      showErr(msgs[e.code] || e.message);
    } finally {
      setLoading(false);
    }
  });

  // ── Verification screen actions ─────────────────────────────
  document.getElementById('btn-verified-signin').addEventListener('click', async () => {
    // Switch to sign-in tab with pre-filled email
    showFormScreen();
    setTab('signin');
    if (pendingEmail) {
      document.getElementById('auth-email').value = pendingEmail;
    }
    if (pendingPassword) {
      document.getElementById('auth-password').value = pendingPassword;
    }
    showSuccess('Please enter your password to sign in once you have clicked the link in your email.');
  });

  document.getElementById('btn-resend-link').addEventListener('click', async () => {
    if (!pendingEmail) return;
    try {
      verifyMsg.textContent = 'Sending fresh verification link…';
      verifyMsg.className = 'mb-4 p-2.5 rounded-xl bg-white/10 text-white font-body-sm text-[12px] block';
      
      // Attempt temporary sign-in to resend verification
      if (pendingPassword) {
        const cred = await signInWithEmailAndPassword(auth, pendingEmail, pendingPassword);
        await sendEmailVerification(cred.user);
        await signOut(auth);
        verifyMsg.textContent = '✓ Fresh verification link sent! Check your inbox & spam folder.';
        verifyMsg.className = 'mb-4 p-2.5 rounded-xl bg-primary/20 text-primary font-body-sm text-[12px] block';
      } else {
        verifyMsg.textContent = 'Please go back and Sign In to trigger a new verification link.';
        verifyMsg.className = 'mb-4 p-2.5 rounded-xl bg-white/10 text-white font-body-sm text-[12px] block';
      }
    } catch (e) {
      verifyMsg.textContent = e.code === 'auth/too-many-requests'
        ? 'Please wait a minute before requesting another link.'
        : 'Could not resend email right now. Please check your inbox.';
      verifyMsg.className = 'mb-4 p-2.5 rounded-xl bg-error-container/40 text-[#ffb4ab] font-body-sm text-[12px] block';
    }
  });

  document.getElementById('btn-back-to-auth').addEventListener('click', () => {
    showFormScreen();
    setTab('signin');
  });

  // ── Google Sign In (Google accounts are pre-verified) ────────
  document.getElementById('google-signin').addEventListener('click', async () => {
    errBox.classList.add('hidden');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') {
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/cancelled-popup-request' || e.code === 'auth/internal-error') {
          showErr('Google popup is restricted in this app view. Please use Email and Password above.');
        } else {
          showErr(e.message || 'Could not complete Google sign-in. Please use Email and Password.');
        }
      }
    }
  });

  // Enter key trigger
  ['auth-email','auth-password'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') submitBtn.click();
    });
  });
}
