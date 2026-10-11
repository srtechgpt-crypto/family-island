// Firebase 연결(공식 CDN 모듈, 버전 고정)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, connectAuthEmulator, onAuthStateChanged, signInAnonymously, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, connectDatabaseEmulator, ref, get, set, update, remove, onValue, off, runTransaction, serverTimestamp, onDisconnect, push, query, orderByChild, equalTo }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "../config/firebaseConfig.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
// 개발용: 내 PC(localhost)에서 ?emu 로 열면 진짜 섬 대신 시험용 에뮬레이터에 연결
export const EMU = ["localhost", "127.0.0.1"].includes(location.hostname) && new URLSearchParams(location.search).has("emu");
if (EMU) { connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true }); connectDatabaseEmulator(db, "127.0.0.1", 9000); }
export { onAuthStateChanged, signInAnonymously, signOut, getRedirectResult, ref, get, set, update, remove, onValue, off, runTransaction, serverTimestamp, onDisconnect, push, query, orderByChild, equalTo };

export async function signInGoogle() {
  const provider = new GoogleAuthProvider();
  try { return await signInWithPopup(auth, provider); }
  catch (e) {
    if (String(e.code).includes("popup")) return signInWithRedirect(auth, provider);
    throw e;
  }
}

// 서버 시각 차이(ms) — 회차 계산용
let offset = 0;
onValue(ref(db, ".info/serverTimeOffset"), s => { offset = s.val() || 0; });
export const serverNow = () => Math.round(Date.now() + offset);

// 연결 상태
const connListeners = new Set();
let connected = false;
onValue(ref(db, ".info/connected"), s => { connected = !!s.val(); connListeners.forEach(f => f(connected)); });
export const isConnected = () => connected;
export const onConnection = f => { connListeners.add(f); f(connected); return () => connListeners.delete(f); };

export const fpath = (fid, ...parts) => ["families", fid, ...parts].join("/");
export const rid = (n = 20) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, b => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join(""); };
