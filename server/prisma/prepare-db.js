import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory if DATABASE_URL is not already set
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';
const isPostgres = databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://');
const targetProvider = isPostgres ? 'postgresql' : 'sqlite';

const schemaPath = path.resolve(__dirname, 'schema.prisma');
let schemaContent = fs.readFileSync(schemaPath, 'utf8');

// Match: provider = "sqlite" or provider = "postgresql" within datasource db block
const datasourceRegex = /(datasource\s+db\s*\{[\s\S]*?provider\s*=\s*")([^"]+)("[\s\S]*?\})/;
const match = schemaContent.match(datasourceRegex);

let schemaModified = false;
if (match && match[2] !== targetProvider) {
  console.log(`🔄 Switching Prisma datasource provider from "${match[2]}" to "${targetProvider}" to match DATABASE_URL...`);
  schemaContent = schemaContent.replace(datasourceRegex, `$1${targetProvider}$3`);
  fs.writeFileSync(schemaPath, schemaContent, 'utf8');
  schemaModified = true;
} else {
  console.log(`✅ Prisma datasource provider is already "${targetProvider}" (matches DATABASE_URL).`);
}

// Generate Prisma Client if provider changed or if requested
try {
  if (schemaModified || process.argv.includes('--generate')) {
    console.log('📦 Running "prisma generate"...');
    execSync('npx prisma generate', {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      env: process.env
    });
  }

  // Push schema to DB if --push flag is passed (e.g. docker startup, setup)
  if (process.argv.includes('--push')) {
    console.log(`🚀 Synchronizing schema with ${targetProvider.toUpperCase()} database ("prisma db push")...`);
    execSync('npx prisma db push --accept-data-loss', {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      env: process.env
    });
    console.log('✅ Database schema synchronized successfully.');
  }
} catch (error) {
  console.error('❌ Error during Prisma preparation:', error.message);
  process.exit(1);
}
