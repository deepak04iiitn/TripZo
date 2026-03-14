import Trip from '../models/Trip.js';
import User from '../models/User.js';
import UserActivity from '../models/UserActivity.js';
import UserSession from '../models/UserSession.js';

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function startOfUtcMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addUtcMonths(date, months) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function round(value, decimals = 2) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function toUtcDateKey(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseRangeDays(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 30;
  }
  const normalized = Math.floor(parsed);
  if (normalized <= 0) {
    return 30;
  }
  return Math.min(90, normalized);
}

async function getDistinctActiveUserIds(startDate, endDate) {
  return UserActivity.distinct('userId', {
    activityDate: { $gte: startDate, $lt: endDate },
  });
}

async function countTripsCreatedBetween(startDate, endDate) {
  return Trip.countDocuments({
    createdAt: { $gte: startDate, $lt: endDate },
  });
}

export async function getAdminDashboardMetrics(_req, res, next) {
  try {
    const rangeDays = parseRangeDays(_req.query?.rangeDays);
    const now = new Date();
    const todayStart = startOfUtcDay(now);
    const tomorrowStart = addUtcDays(todayStart, 1);
    const rollingWeekStart = addUtcDays(todayStart, -6);
    const rollingMonthStart = addUtcDays(todayStart, -29);
    const selectedRangeStart = addUtcDays(todayStart, -(rangeDays - 1));
    const trendWindowStart = addUtcDays(selectedRangeStart, -29);
    const monthStart = startOfUtcMonth(now);
    const monthEnd = addUtcMonths(monthStart, 1);
    const previousMonthStart = addUtcMonths(monthStart, -1);

    const [
      totalUsers,
      dauUserIds,
      wauUserIds,
      mauUserIds,
      previousMonthUserIds,
      currentMonthUserIds,
      dailyItineraries,
      weeklyItineraries,
      monthlyItineraries,
      averageSessionAgg,
      activityTrendRows,
      itineraryTrendRows,
    ] = await Promise.all([
      User.countDocuments({}),
      getDistinctActiveUserIds(todayStart, tomorrowStart),
      getDistinctActiveUserIds(rollingWeekStart, tomorrowStart),
      getDistinctActiveUserIds(rollingMonthStart, tomorrowStart),
      getDistinctActiveUserIds(previousMonthStart, monthStart),
      getDistinctActiveUserIds(monthStart, monthEnd),
      countTripsCreatedBetween(todayStart, tomorrowStart),
      countTripsCreatedBetween(rollingWeekStart, tomorrowStart),
      countTripsCreatedBetween(monthStart, monthEnd),
      UserSession.aggregate([
        {
          $match: {
            endedAt: { $gte: selectedRangeStart, $lt: tomorrowStart },
            durationSeconds: { $gt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            avgDurationSeconds: { $avg: '$durationSeconds' },
            sessionsCount: { $sum: 1 },
          },
        },
      ]),
      UserActivity.find({
        activityDate: { $gte: trendWindowStart, $lt: tomorrowStart },
      })
        .select('activityDate userId')
        .lean(),
      Trip.aggregate([
        {
          $match: {
            createdAt: { $gte: selectedRangeStart, $lt: tomorrowStart },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
                timezone: 'UTC',
              },
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const dau = dauUserIds.length;
    const wau = wauUserIds.length;
    const mau = mauUserIds.length;
    const dauMauStickiness = mau > 0 ? (dau / mau) * 100 : 0;

    const previousSet = new Set(previousMonthUserIds.map((id) => id.toString()));
    const currentSet = new Set(currentMonthUserIds.map((id) => id.toString()));
    let churnedUsers = 0;

    previousSet.forEach((userId) => {
      if (!currentSet.has(userId)) {
        churnedUsers += 1;
      }
    });

    const monthlyChurnRate = previousSet.size > 0 ? (churnedUsers / previousSet.size) * 100 : 0;
    const avgDurationSeconds = Number(averageSessionAgg?.[0]?.avgDurationSeconds || 0);
    const sessionsCount = Number(averageSessionAgg?.[0]?.sessionsCount || 0);

    const itineraryTrendMap = new Map(
      itineraryTrendRows.map((row) => [String(row._id), Number(row.count || 0)])
    );

    const activityByDate = new Map();
    activityTrendRows.forEach((row) => {
      const key = toUtcDateKey(new Date(row.activityDate));
      if (!activityByDate.has(key)) {
        activityByDate.set(key, new Set());
      }
      activityByDate.get(key).add(String(row.userId));
    });

    const trends = [];
    for (let i = 0; i < rangeDays; i += 1) {
      const day = addUtcDays(selectedRangeStart, i);
      const dayKey = toUtcDateKey(day);
      const dauSet = activityByDate.get(dayKey) || new Set();

      const wauSet = new Set();
      for (let offset = 0; offset < 7; offset += 1) {
        const checkDate = addUtcDays(day, -offset);
        const checkKey = toUtcDateKey(checkDate);
        const checkSet = activityByDate.get(checkKey);
        if (!checkSet) {
          continue;
        }
        checkSet.forEach((id) => wauSet.add(id));
      }

      const mauSet = new Set();
      for (let offset = 0; offset < 30; offset += 1) {
        const checkDate = addUtcDays(day, -offset);
        const checkKey = toUtcDateKey(checkDate);
        const checkSet = activityByDate.get(checkKey);
        if (!checkSet) {
          continue;
        }
        checkSet.forEach((id) => mauSet.add(id));
      }

      trends.push({
        date: dayKey,
        dau: dauSet.size,
        wau: wauSet.size,
        mau: mauSet.size,
        itineraries: itineraryTrendMap.get(dayKey) || 0,
      });
    }

    return res.json({
      metrics: {
        users: {
          totalUsers,
          dau,
          wau,
          mau,
          dauMauStickinessPercent: round(dauMauStickiness),
        },
        itinerariesGenerated: {
          daily: dailyItineraries,
          weekly: weeklyItineraries,
          monthly: monthlyItineraries,
        },
        churn: {
          monthlyRatePercent: round(monthlyChurnRate),
          churnedUsers,
          previousMonthActiveUsers: previousSet.size,
          targetPercent: 10,
          isHealthy: monthlyChurnRate < 10,
        },
        sessions: {
          averageDurationSeconds: Math.round(avgDurationSeconds),
          averageDurationMinutes: round(avgDurationSeconds / 60),
          sampledSessions: sessionsCount,
        },
        dateRange: {
          days: rangeDays,
          from: toUtcDateKey(selectedRangeStart),
          to: toUtcDateKey(todayStart),
        },
        trends,
        generatedAt: now.toISOString(),
      },
    });
  } catch (error) {
    return next(error);
  }
}


