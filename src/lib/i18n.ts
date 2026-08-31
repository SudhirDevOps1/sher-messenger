"use client";

import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "hi";

export const dict: Record<Lang, Record<string, string>> = {
  en: {
    // Navigation & Brand
    appName: "SHER Messenger",
    tagline: "ZERO-KNOWLEDGE EPHEMERAL MESSENGER",
    guide: "Guide",
    plan: "Docs",
    admin: "Admin",
    logout: "Exit Room",
    switchLang: "हिन्दी",

    // Hero & Introduction
    heroBadge: "Free · Open Source · End-to-End Encrypted",
    heroTitle: "Private conversations that self-destruct without a trace.",
    heroSub: "Zero login required. Zero tracking. End-to-end encrypted in your browser.",
    heroDesc: "Create an ephemeral room, set a 30-minute timer, and share the 6-character code. All messages are encrypted directly in your browser with Web Crypto AES-256-GCM. When the timer expires or you close the tab, everything is permanently destroyed.",

    // Ephemeral Room Actions
    createRoomTitle: "Create Ephemeral Room",
    createRoomDesc: "No signup or password required. Start a private room in seconds.",
    createRoomCardTitle: "Create Ephemeral Room",
    createRoomCardDesc: "No signup or password required. Start a private room in seconds.",
    joinRoomTitle: "Join with Room Code",
    joinRoomDesc: "Enter the 6-character code shared by your peer to enter instantly.",
    joinRoomCardTitle: "Join with Room Code",
    joinRoomCardDesc: "Enter the 6-character code shared by your peer to enter instantly.",
    displayName: "Your Display Name",
    displayNamePlaceholder: "e.g., Alex, Guest-92",
    roomName: "Room Name (Optional)",
    roomNamePlaceholder: "e.g., Private Discussion",
    maxParticipants: "Max Participants",
    roomCapacity: "Room Capacity",
    usersCount: "users max",
    roomCode: "Room Code",
    roomDuration: "Room Duration (Auto-burn)",
    createRoomBtn: "Create & Enter Room",
    enterRoomCode: "6-Character Room Code",
    enterRoomCodePlaceholder: "e.g., AB92X7",
    joinRoomBtn: "Join Room",
    roomCreatedSuccess: "Room created successfully! Share the code below:",
    copyCode: "Copy Code",
    copyLink: "Copy Link",
    codeCopied: "Room code copied to clipboard!",
    linkCopied: "Direct join link copied to clipboard!",

    // In-Room Experience
    roomTimeRemaining: "Time Remaining",
    membersCount: "Members",
    messagePlaceholder: "Type a sealed message...",
    send: "Send",
    attachFile: "Attach encrypted file",
    burnNotice: "This room and all its messages will automatically self-destruct when time expires.",
    screenshotWarning: "Screen capture detected — content protected for privacy.",
    unfocusedBlurNotice: "Content blurred while window is out of focus for privacy.",
    leaveRoom: "Leave & Wipe Data",
    leaveRoomConfirm: "Are you sure you want to leave? All your local data and keys will be wiped immediately.",

    // Vault Account (Optional Long-term)
    vaultTitle: "Persistent Encrypted Vault (Optional)",
    vaultDesc: "For users who want permanent Double Ratchet identities with long-term contacts.",
    createIdentity: "Create Vault Identity",
    unlockVault: "Unlock Existing Vault",
    handle: "Handle / Username",
    passphrase: "Vault Passphrase",
    entropy: "Passphrase Strength",
    noRecoveryWarning: "I understand there is no recovery if the passphrase is lost.",

    // Admin Console
    adminTitle: "Admin Console",
    adminDesc: "Secure management portal for server operator. Protected by environment credentials.",
    adminEmail: "Admin Email",
    adminPassword: "Admin Password",
    adminLoginBtn: "Unlock Admin Console",
    adminTabOverview: "Overview",
    adminTabRooms: "Active Ephemeral Rooms",
    adminTabUsers: "Identities",
    adminTabInvites: "Invites",
    adminTabNotice: "Broadcast",
    adminTabAudit: "Audit Log",
    activeRooms: "Active Rooms",
    registeredUsers: "Registered Identities",
    ciphertextMessages: "Ciphertext Rows",
    storageAdapter: "Storage Engine",
    terminateRoom: "Terminate & Burn",
    roomBurnedSuccess: "Room terminated and shredded immediately.",
    systemNotice: "System Broadcast (Operational)",
    publishNotice: "Publish Notice",
    clearNotice: "Clear Notice",

    // Security Details & Invariants
    invariant1: "Plaintext messages on server",
    invariant1Val: "0 (Cryptographically impossible)",
    invariant2: "Private keys on server",
    invariant2Val: "0 (Keys stay inside tab)",
    invariant3: "Browser closure behavior",
    invariant3Val: "Automatic session & memory wipe",

    // Common
    close: "Close",
    cancel: "Cancel",
    confirm: "Confirm",
    loading: "Processing...",
    error: "An error occurred",
  },
  hi: {
    // Navigation & Brand
    appName: "शेर मैसेंजर",
    tagline: "शून्य-ज्ञान अस्थायी गुप्त मैसेंजर",
    guide: "मार्गदर्शिका",
    plan: "दस्तावेज़",
    admin: "एडमिन",
    logout: "रूम से बाहर निकलें",
    switchLang: "English",

    // Hero & Introduction
    heroBadge: "निःशुल्क · ओपन सोर्स · एंड-टू-एंड एन्क्रिप्टेड",
    heroTitle: "निजी बातचीत जो बिना किसी निशान के स्वतः नष्ट हो जाती है।",
    heroSub: "बिना किसी लॉगिन या खाते के। कोई ट्रैकिंग नहीं। आपके ब्राउज़र में एंड-टू-एंड एन्क्रिप्टेड।",
    heroDesc: "एक अस्थायी रूम बनाएं, अधिकतम 30 मिनट का समय सेट करें और 6-अक्षरों का कोड शेयर करें। सभी संदेश आपके ब्राउज़र में Web Crypto AES-256-GCM द्वारा सुरक्षित होते हैं। समय समाप्त होने पर या ब्राउज़र बंद करते ही सारा डेटा हमेशा के लिए मिट जाता है।",

    // Ephemeral Room Actions
    createRoomTitle: "नया अस्थायी रूम बनाएं",
    createRoomDesc: "बिना किसी लॉगिन या पासवर्ड के तुरंत एक सुरक्षित रूम शुरू करें।",
    createRoomCardTitle: "नया अस्थायी रूम बनाएं",
    createRoomCardDesc: "बिना किसी लॉगिन या पासवर्ड के तुरंत एक सुरक्षित रूम शुरू करें।",
    joinRoomTitle: "रूम कोड से जुड़ें",
    joinRoomDesc: "अपने साथी द्वारा साझा किया गया 6-अक्षरों का कोड दर्ज करके तुरंत प्रवेश करें।",
    joinRoomCardTitle: "रूम कोड से जुड़ें",
    joinRoomCardDesc: "अपने साथी द्वारा साझा किया गया 6-अक्षरों का कोड दर्ज करके तुरंत प्रवेश करें।",
    displayName: "आपका नाम (Display Name)",
    displayNamePlaceholder: "उदा. राहुल, अतिथि-01",
    roomName: "रूम का नाम (वैकल्पिक)",
    roomNamePlaceholder: "उदा. निजी चर्चा",
    maxParticipants: "अधिकतम सदस्य संख्या",
    roomCapacity: "सदस्य क्षमता",
    usersCount: "अधिकतम सदस्य",
    roomCode: "रूम कोड",
    roomDuration: "रूम की समय सीमा (स्वतः नष्ट)",
    createRoomBtn: "रूम बनाएं और प्रवेश करें",
    enterRoomCode: "6-अक्षरों का रूम कोड",
    enterRoomCodePlaceholder: "उदा. AB92X7",
    joinRoomBtn: "रूम में प्रवेश करें",
    roomCreatedSuccess: "रूम सफलतापूर्वक बन गया! नीचे दिया गया कोड शेयर करें:",
    copyCode: "कोड कॉपी करें",
    copyLink: "लिंक कॉपी करें",
    codeCopied: "रूम कोड क्लिपबोर्ड पर कॉपी हो गया!",
    linkCopied: "सीधा जुड़ने का लिंक कॉपी हो गया!",

    // In-Room Experience
    roomTimeRemaining: "शेष समय",
    membersCount: "सदस्य",
    messagePlaceholder: "सुरक्षित संदेश लिखें...",
    send: "भेजें",
    attachFile: "एन्क्रिप्टेड फ़ाइल जोड़ें",
    burnNotice: "समय समाप्त होते ही यह रूम और इसके सभी संदेश स्वतः नष्ट हो जाएंगे।",
    screenshotWarning: "स्क्रीनशॉट का प्रयास पहचाना गया — गोपनीयता हेतु सामग्री सुरक्षित है।",
    unfocusedBlurNotice: "गोपनीयता हेतु स्क्रीन धुंधली (Blur) कर दी गई है।",
    leaveRoom: "रूम छोड़ें और डेटा मिटाएं",
    leaveRoomConfirm: "क्या आप वाकई बाहर निकलना चाहते हैं? आपका सभी स्थानीय डेटा और चाबियां तुरंत नष्ट कर दी जाएंगी।",

    // Vault Account (Optional Long-term)
    vaultTitle: "स्थायी एन्क्रिप्टेड वॉल्ट (वैकल्पिक)",
    vaultDesc: "उन उपयोगकर्ताओं के लिए जो लंबी अवधि के संपर्कों के साथ डबल रैचेट पहचान चाहते हैं।",
    createIdentity: "नई वॉल्ट पहचान बनाएं",
    unlockVault: "मौजूदा वॉल्ट अनलॉक करें",
    handle: "हैंडल / यूज़रनेम",
    passphrase: "वॉल्ट पासफ़्रेज़",
    entropy: "पासफ़्रेज़ मजबूती",
    noRecoveryWarning: "मैं समझता हूँ कि पासफ़्रेज़ खो जाने पर कोई रिकवरी संभव नहीं है।",

    // Admin Console
    adminTitle: "एडमिन कंसोल",
    adminDesc: "सर्वर ऑपरेटर के लिए सुरक्षित प्रबंधन पोर्टल। केवल पर्यावरण क्रेडेंशियल से सुरक्षित।",
    adminEmail: "एडमिन ईमेल",
    adminPassword: "एडमिन पासवर्ड",
    adminLoginBtn: "एडमिन कंसोल खोलें",
    adminTabOverview: "सिस्टम विवरण",
    adminTabRooms: "सक्रिय अस्थायी रूम",
    adminTabUsers: "पहचान सूची",
    adminTabInvites: "इनवाइट कोड",
    adminTabNotice: "सिस्टम सूचना",
    adminTabAudit: "ऑडिट लॉग",
    activeRooms: "सक्रिय रूम",
    registeredUsers: "पंजीकृत पहचान",
    ciphertextMessages: "एन्क्रिप्टेड संदेश पंक्तियाँ",
    storageAdapter: "स्टोरेज इंजन",
    terminateRoom: "तुरंत नष्ट करें (Burn)",
    roomBurnedSuccess: "रूम को तुरंत समाप्त और नष्ट कर दिया गया।",
    systemNotice: "सिस्टम ब्रॉडकास्ट सूचना",
    publishNotice: "सूचना प्रकाशित करें",
    clearNotice: "सूचना हटाएं",

    // Security Details & Invariants
    invariant1: "सर्वर पर सादा टेक्स्ट संदेश",
    invariant1Val: "0 (क्रिप्टोग्राफ़िक रूप से असंभव)",
    invariant2: "सर्वर पर निजी चाबियां",
    invariant2Val: "0 (चाबियां केवल ब्राउज़र में रहती हैं)",
    invariant3: "ब्राउज़र बंद होने पर",
    invariant3Val: "मेमोरी और डेटा स्वतः नष्ट",

    // Common
    close: "बंद करें",
    cancel: "रद्द करें",
    confirm: "पुष्टि करें",
    loading: "प्रक्रिया जारी है...",
    error: "एक त्रुटि हुई",
  },
};

export const I18nCtx = createContext<{
  lang: Lang;
  t: (k: string) => string;
  setLang: (l: Lang) => void;
}>({
  lang: "en",
  t: (k) => dict.en[k] ?? k,
  setLang: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ked.lang") as Lang;
      if (saved === "hi" || saved === "en") setLangState(saved);
    } catch {}
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("ked.lang", l);
    } catch {}
  };

  const t = (k: string): string => {
    return dict[lang]?.[k] ?? dict.en[k] ?? k;
  };

  return createElement(I18nCtx.Provider, { value: { lang, t, setLang } }, children);
}

export function useI18n() {
  const ctx = useContext(I18nCtx);
  return ctx;
}

