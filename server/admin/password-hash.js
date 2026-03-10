"use strict";

const argon2 = require("argon2");

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
};

function isArgon2idHash(value) {
  return String(value || "").startsWith("$argon2id$");
}

async function hashPassword(password) {
  const normalizedPassword = String(password || "");
  if (!normalizedPassword) {
    throw new Error("Passwords must not be empty.");
  }

  return argon2.hash(normalizedPassword, ARGON2_OPTIONS);
}

async function verifyPassword(passwordHash, password) {
  return argon2.verify(String(passwordHash || ""), String(password || ""));
}

module.exports = {
  ARGON2_OPTIONS,
  hashPassword,
  isArgon2idHash,
  verifyPassword,
};
