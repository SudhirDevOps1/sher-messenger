"use client";

import { createContext, useContext } from "react";

export type Lang = "en" | "hi";

export const dict: Record<Lang, Record<string, string>> = {
  en: {
    appName: "KED-VAULT",
    tagline: "PERSONAL ZERO-KNOWLEDGE MESSENGER",
    heroTitle1: "Your keys never leave",
    heroTitle2: "this tab.",
    heroSub: "The relay is allowed to be stupid.",
    heroDesc: "Every conversation is sealed client-side with a real Double Ratchet before it touches the network. No phone number, no email, no analytics, no cloud backup, no admin. Passphrase is the vault key — if it is lost, nobody can recover your history, including me. That is the whole point.",
    createRoom: "Create 30m Room",
    joinRoom: "Join Room",
    roomName: "Room name",
    maxUsers: "Max users",
    create: "Create room",
    join: "Enter room",
    shareCode: "Share code",
    inviteDetected: "invite detected",
    freshRelay: "Fresh relay detected — no identity yet. You can be the first operator.",
    initRelay: "Initialize private relay (one-time)",
    handle: "HANDLE (PUBLIC ON THIS RELAY)",
    passphrase: "PASSPHRASE = VAULT KEY",
    entropy: "ENTROPY",
    noRecovery: "I understand there is no recovery path.",
    generate: "Generate bundle & register",
    unlock: "Decrypt vault locally",
    adminGate: "Admin console — env gate",
    adminDesc: "Web is public — this panel opens only with ADMIN_EMAIL + ADMIN_PASSWORD env. Same values unlock it. Web stays open, admin stays hidden.",
    adminOk: "Env verified — you are in. No bearer paste needed if you are logged in as admin.",
    freeRoomTitle: "Free 30-minute rooms — no login",
    freeRoomDesc: "Web stays public, /admin is hidden. Anyone creates a room, sets max users (2-30) and 30m hard cap, shares a 6-char code, joiner enters code and chats. 30m auto-burn, tab close wipes session.",
  },
  hi: {
    appName: "KED-VAULT",
    tagline: "व्यक्तिगत जीरो-नॉलेज मैसेंजर",
    heroTitle1: "आपकी चाबियाँ कभी",
    heroTitle2: "इस टैब से बाहर नहीं जातीं।",
    heroSub: "रिले को बेवकूफ रहने दिया जाता है।",
    heroDesc: "हर बातचीत नेटवर्क छूने से पहले Double Ratchet से सील होती है। कोई फोन, ईमेल, एनालिटिक्स, क्लाउड बैकअप नहीं। पासफ्रेज ही वॉल्ट की चाबी है — खो गई तो कोई भी हिस्ट्री वापस नहीं ला सकता।",
    createRoom: "30 मिनट रूम बनाएं",
    joinRoom: "रूम में प्रवेश करें",
    roomName: "रूम का नाम",
    maxUsers: "अधिकतम यूज़र",
    create: "रूम बनाएं",
    join: "प्रवेश करें",
    shareCode: "कोड शेयर करें",
    inviteDetected: "इनवाइट मिला",
    freshRelay: "नया रिले मिला — कोई पहचान नहीं। आप पहले ऑपरेटर बन सकते हैं।",
    initRelay: "प्राइवेट रिले शुरू करें (एक बार)",
    handle: "हैंडल (रिले पर सार्वजनिक)",
    passphrase: "पासफ्रेज = वॉल्ट चाबी",
    entropy: "एंट्रॉपी",
    noRecovery: "मैं समझता हूँ कोई रिकवरी नहीं है।",
    generate: "बंडल बनाएं और रजिस्टर करें",
    unlock: "वॉल्ट को लोकल डिक्रिप्ट करें",
    adminGate: "एडमिन कंसोल — env गेट",
    adminDesc: "वेब सार्वजनिक है — यह पैनल सिर्फ ADMIN_EMAIL + ADMIN_PASSWORD env से खुलता है।",
    adminOk: "Env सत्यापित — लॉगिन है तो bearer पेस्ट की जरूरत नहीं।",
    freeRoomTitle: "फ्री 30 मिनट रूम — बिना लॉगिन",
    freeRoomDesc: "कोई भी रूम बनाए, maxUsers 2-30 सेट करे, 30 मिनट हार्ड कैप, 6-अक्षर कोड शेयर, कोड डालते ही चैट। 30 मिनट बाद ऑटो-बर्न, टैब बंद = वाइप।",
  },
};

export const I18nCtx = createContext<{ lang: Lang; t: (k: string) => string; setLang: (l: Lang) => void }>({ lang: "en", t: (k) => dict.en[k] ?? k, setLang: () => {} });

export const useI18n = () => useContext(I18nCtx);
