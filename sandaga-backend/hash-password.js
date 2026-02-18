#!/usr/bin/env node
// Small CLI to generate bcrypt hashes for seeding or manual updates.

const bcrypt = require('bcrypt');

const [, , plain = '', roundsArg] = process.argv;

if (!plain) {
  console.error('Usage: node hash-password.js <plain-password> [salt-rounds]');
  process.exit(1);
}

const saltRounds = Number(roundsArg || process.env.SALT_ROUNDS || 12);

bcrypt
  .hash(plain, saltRounds)
  .then((hash) => {
    console.log(hash);
  })
  .catch((err) => {
    console.error('Failed to hash password:', err);
    process.exit(1);
  });
