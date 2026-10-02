'use strict';

// Fail closed: validate COLOSSUS_ACCOUNTS_JSON BEFORE loading any modules or
// touching the database.  When the env var is absent the process exits 1 and
// prints the variable name so the caller knows what is missing.
const raw = process.env.COLOSSUS_ACCOUNTS_JSON;
if (!raw) {
  console.error('[seed] required env var COLOSSUS_ACCOUNTS_JSON is not set');
  process.exit(1);
}

let accounts;
try {
  accounts = JSON.parse(raw);
} catch (e) {
  console.error('[seed] COLOSSUS_ACCOUNTS_JSON must be valid JSON:', e.message);
  process.exit(1);
}

if (!Array.isArray(accounts)) {
  console.error('[seed] COLOSSUS_ACCOUNTS_JSON must be a JSON array');
  process.exit(1);
}

// Database URL is required for PrismaClient / PrismaPg adapter.
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[seed] DATABASE_URL is required');
  process.exit(1);
}

const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  let count = 0;

  for (const account of accounts) {
    const passwordHash = bcrypt.hashSync(account.password, 10);

    await prisma.colossusAccount.upsert({
      where: { email: account.email },
      update: {
        passwordHash,
        role: account.role,
        loginPath: account.loginPath ?? null,
      },
      create: {
        email: account.email,
        role: account.role,
        passwordHash,
        loginPath: account.loginPath ?? null,
      },
    });

    await prisma.user.upsert({
      where: { email: account.email },
      update: { role: account.role, passwordHash },
      create: {
        email: account.email,
        name: account.name ?? account.email,
        role: account.role,
        passwordHash,
      },
    });

    count++;
  }

  console.log(`[seed] colossus_accounts upserted ${count}`);
}

main()
  .catch((error) => {
    console.error('[seed] failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
