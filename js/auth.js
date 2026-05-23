import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export function setupAuth(app, db) {
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();

  const authPanel     = document.getElementById("auth-panel");
  const authForm      = document.getElementById("auth-form");
  const inputEmail    = document.getElementById("input-email");
  const inputPassword = document.getElementById("input-password");
  const btnSubmit     = document.getElementById("btn-submit");
  const btnGoogle     = document.getElementById("btn-google");
  const btnShowSignin = document.getElementById("btn-show-signin");
  const btnShowSignup = document.getElementById("btn-show-signup");
  const authError     = document.getElementById("auth-error");

  let mode = "signin";

  btnShowSignin.addEventListener("click", () => {
    mode = "signin";
    btnSubmit.textContent = "Sign In";
    btnShowSignin.classList.add("active");
    btnShowSignup.classList.remove("active");
    authError.textContent = "";
  });

  btnShowSignup.addEventListener("click", () => {
    mode = "signup";
    btnSubmit.textContent = "Sign Up";
    btnShowSignup.classList.add("active");
    btnShowSignin.classList.remove("active");
    authError.textContent = "";
  });

  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    authError.textContent = "";
    const email = inputEmail.value.trim();
    const password = inputPassword.value;
    btnSubmit.disabled = true;
    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
        window.location.href = "client.html";
        return;
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      authError.textContent = friendlyError(err.code);
    } finally {
      btnSubmit.disabled = false;
    }
  });

  btnGoogle.addEventListener("click", async () => {
    authError.textContent = "";
    btnGoogle.disabled = true;
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        authError.textContent = friendlyError(err.code);
      }
    } finally {
      btnGoogle.disabled = false;
    }
  });

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      authPanel.hidden = false;
      authForm.reset();
      authError.textContent = "";
      return;
    }

    authPanel.hidden = true;

    // Write user record so admins can look up UID by email
    await setDoc(doc(db, "users", user.uid), { email: user.email }, { merge: true });

    // Route based on admin status
    const adminSnap = await getDoc(doc(db, "admins", user.uid));
    window.location.href = adminSnap.exists() ? "admin.html" : "client.html";
  });
}

function friendlyError(code) {
  const messages = {
    "auth/invalid-email":          "That doesn't look like a valid email address.",
    "auth/user-not-found":         "No account found with that email.",
    "auth/wrong-password":         "Incorrect password. Please try again.",
    "auth/email-already-in-use":   "An account with that email already exists. Try signing in.",
    "auth/weak-password":          "Password must be at least 6 characters.",
    "auth/too-many-requests":      "Too many attempts. Please wait a moment and try again.",
    "auth/network-request-failed": "Network error. Check your internet connection.",
    "auth/invalid-credential":     "Incorrect email or password. Please try again.",
  };
  return messages[code] || "Something went wrong. Please try again.";
}
