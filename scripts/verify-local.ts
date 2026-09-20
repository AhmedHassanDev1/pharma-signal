import net from 'node:net';
import { PrismaClient } from '@prisma/client';

async function checkTcp(host: string, port: number, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

async function main() {
  console.log('\n=============================================');
  console.log(' Pharma Signal Platform - Local Verification');
  console.log('=============================================\n');

  let allPassed = true;

  // 1. PostgreSQL TCP Check
  process.stdout.write('[1/3] Checking PostgreSQL container on 127.0.0.1:5432... ');
  const isPgTcpUp = await checkTcp('127.0.0.1', 5432);
  if (isPgTcpUp) {
    console.log('PASS');
  } else {
    console.log('FAIL');
    console.error('      Error: PostgreSQL is not reachable at 127.0.0.1:5432.');
    console.error('      Fix: Run `npm run db:up` to start the container.\n');
    allPassed = false;
  }

  // 2. Database Query Check via Prisma
  if (isPgTcpUp) {
    process.stdout.write('[2/3] Checking PostgreSQL query execution via Prisma... ');
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/pharma_signal?schema=public'
        }
      }
    });

    try {
      await prisma.$queryRaw`SELECT 1`;
      const orgCount = await prisma.organization.count();
      const branchCount = await prisma.branch.count();
      const deviceCount = await prisma.device.count();
      const dsCount = await prisma.dataSource.count();
      console.log('PASS');
      console.log(`      Data: ${orgCount} organizations, ${branchCount} branches, ${deviceCount} devices, ${dsCount} data sources.`);
    } catch (err) {
      console.log('FAIL');
      console.error('      Error executing query:', err instanceof Error ? err.message : err);
      console.error('      Fix: Run `npm run db:migrate` to initialize the database schema.\n');
      allPassed = false;
    } finally {
      await prisma.$disconnect();
    }
  } else {
    console.log('[2/3] Skipping database query check (PostgreSQL is offline).');
  }

  // 3. Backend HTTP Health Check
  process.stdout.write('[3/3] Checking Backend HTTP health endpoint (http://localhost:3000/api/v1/health)... ');
  try {
    const res = await fetch('http://localhost:3000/api/v1/health', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'ok' && data.database === 'up') {
        console.log('PASS');
        console.log(`      Response: ${JSON.stringify(data)}`);
      } else {
        console.log('WARN');
        console.log(`      Unexpected response: ${JSON.stringify(data)}`);
      }
    } else {
      console.log('FAIL');
      console.error(`      Server returned HTTP status ${res.status}`);
    }
  } catch {
    console.log('STANDBY');
    console.log('      Info: Backend is not currently running. Start it with `npm run dev:backend`.');
  }

  console.log('\n---------------------------------------------');
  if (allPassed) {
    console.log(' Result: Infrastructure and Database are READY.');
  } else {
    console.log(' Result: Issues detected. Please follow the fixes above.');
  }
  console.log('---------------------------------------------\n');

  if (!allPassed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected verification error:', err);
  process.exit(1);
});
