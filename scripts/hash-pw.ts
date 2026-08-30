import crypto from "node:crypto";

const password = process.argv[2] || process.env.PW || "Admin@123";

function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(pw, salt, 250_000, 32, "sha256").toString("hex");
  return `$pbkdf2-sha256$i=250000$${salt}$${hash}`;
}

const hashed = hashPassword(password);
console.log("\n=======================================================");
console.log("       SHER Messenger v2 — Admin Password Hash");
console.log("=======================================================");
console.log("Password :", password);
console.log("Hash     :", hashed);
console.log("\nPut this in your .env / Cloudflare Dashboard:");
console.log(`ADMIN_PASSWORD_HASH="${hashed}"`);
console.log("=======================================================\n");
