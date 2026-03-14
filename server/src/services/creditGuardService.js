import cron from 'node-cron';
import MonthlyApiUsage from '../models/MonthlyApiUsage.js';

const DEFAULT_MONTHLY_FREE_CREDIT_USD = Number(process.env.GOOGLE_MAPS_MONTHLY_FREE_CREDIT_USD || 200);
const DEFAULT_CRON_SCHEDULE = process.env.CREDIT_GUARD_CRON_SCHEDULE || '*/10 * * * *';

const GEOCODE_UNIT_COST_USD = Number(process.env.GOOGLE_GEOCODE_COST_PER_REQUEST_USD || 0.005);
const PLACES_NEARBY_UNIT_COST_USD = Number(process.env.GOOGLE_PLACES_NEARBY_COST_PER_REQUEST_USD || 0.032);
const DISTANCE_MATRIX_COST_PER_ELEMENT_USD = Number(
  process.env.GOOGLE_DISTANCE_MATRIX_COST_PER_ELEMENT_USD || 0.005
);

function monthKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

async function getOrCreateMonthlyUsageRow(currentMonthKey = monthKey()) {
  return MonthlyApiUsage.findOneAndUpdate(
    { monthKey: currentMonthKey },
    { $setOnInsert: { monthKey: currentMonthKey, creditLimitUsd: DEFAULT_MONTHLY_FREE_CREDIT_USD } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function estimateGoogleApiCostUsd({ apiType, requestCount = 1, elementCount = 0 }) {
  if (apiType === 'geocode') {
    return GEOCODE_UNIT_COST_USD * requestCount;
  }
  if (apiType === 'places_nearby') {
    return PLACES_NEARBY_UNIT_COST_USD * requestCount;
  }
  if (apiType === 'distance_matrix') {
    return DISTANCE_MATRIX_COST_PER_ELEMENT_USD * Math.max(0, elementCount);
  }
  return 0;
}

export async function recordGoogleApiUsageCost({ apiType, requestCount = 1, elementCount = 0 }) {
  const estimatedIncrementUsd = await estimateGoogleApiCostUsd({ apiType, requestCount, elementCount });
  if (!estimatedIncrementUsd) {
    return;
  }
  const currentMonthKey = monthKey();
  await MonthlyApiUsage.updateOne(
    { monthKey: currentMonthKey },
    {
      $setOnInsert: { monthKey: currentMonthKey, creditLimitUsd: DEFAULT_MONTHLY_FREE_CREDIT_USD },
      $inc: { estimatedCostUsd: estimatedIncrementUsd },
    },
    { upsert: true }
  );
}

export async function evaluateMonthlyFreeCreditLimit() {
  const row = await getOrCreateMonthlyUsageRow();
  const shouldBlock = row.estimatedCostUsd >= row.creditLimitUsd;

  const updated = await MonthlyApiUsage.findOneAndUpdate(
    { monthKey: row.monthKey },
    {
      blocked: shouldBlock,
      blockedAt: shouldBlock ? row.blockedAt || new Date() : null,
      lastCheckedAt: new Date(),
    },
    { new: true }
  ).lean();

  return {
    monthKey: updated.monthKey,
    estimatedCostUsd: updated.estimatedCostUsd,
    creditLimitUsd: updated.creditLimitUsd,
    blocked: updated.blocked,
  };
}

export async function isMonthlyFreeLimitExceeded() {
  const state = await evaluateMonthlyFreeCreditLimit();
  return state.blocked;
}

export async function assertCanGenerateNewItinerary() {
  const blocked = await isMonthlyFreeLimitExceeded();
  if (blocked) {
    const error = new Error(
      'We have crossed our monthly free limits. We are working on it to get it back.'
    );
    error.statusCode = 429;
    throw error;
  }
}

export function startMonthlyCreditMonitor() {
  const task = cron.schedule(
    DEFAULT_CRON_SCHEDULE,
    async () => {
      try {
        await evaluateMonthlyFreeCreditLimit();
      } catch (error) {
        console.error('Credit guard cron failed:', error.message);
      }
    },
    { scheduled: true, timezone: 'UTC' }
  );

  // Run once at startup so block state is always fresh.
  evaluateMonthlyFreeCreditLimit().catch((error) => {
    console.error('Initial credit guard check failed:', error.message);
  });

  return {
    stop() {
      task.stop();
      task.destroy();
    },
  };
}


