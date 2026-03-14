import Trip from '../models/Trip.js';
import SavedTrip from '../models/SavedTrip.js';
import { generateItineraryPlan } from '../services/itineraryPlannerService.js';
import {
  validateItineraryGenerationPayload,
  validateTripCreationPayload,
  validateTripStatusPayload,
} from '../utils/validators.js';

function normalizeTripStatus(tripDoc) {
  const now = new Date();
  const start = new Date(`${tripDoc.startDate}T00:00:00`);
  const end = new Date(`${tripDoc.endDate}T23:59:59`);

  if (tripDoc.status === 'completed') {
    return 'completed';
  }
  if (start > now) {
    return 'upcoming';
  }
  if (end < now) {
    return 'completed';
  }
  return 'ongoing';
}

function parseNumberQuery(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeOwner(ownerDoc) {
  if (!ownerDoc || typeof ownerDoc !== 'object') {
    return null;
  }
  return {
    id: ownerDoc._id?.toString?.() || ownerDoc.id || '',
    username: ownerDoc.username || '',
    fullName: ownerDoc.fullName || '',
    profileImageUrl: ownerDoc.profileImageUrl || '',
  };
}

function publicTrip(tripDoc, options = {}) {
  const object = tripDoc.toObject ? tripDoc.toObject() : tripDoc;
  const owner = normalizeOwner(options.owner || object.userId);
  const tripId = object._id?.toString?.() || object.id;
  const savedTripIds = options.savedTripIds || null;
  const isSaved = savedTripIds?.has?.(tripId) ? true : Boolean(object.isSaved);

  return {
    id: tripId,
    title: object.title,
    coverImageUrl: object.coverImageUrl || '',
    createdAt: object.createdAtIso || object.createdAt,
    startDate: object.startDate,
    endDate: object.endDate,
    durationDays: object.durationDays,
    budget: object.budget,
    from: object.from,
    status: normalizeTripStatus(object),
    optimization: object.optimization,
    stats: object.stats,
    likesCount: Number(object.likesCount || 0),
    isLiked: Boolean(object.isLiked),
    isSaved,
    owner,
    days: object.days || [],
    updatedAt: object.updatedAt,
  };
}

export async function generateTripDraft(req, res, next) {
  try {
    const { errors, value } = validateItineraryGenerationPayload(req.body);
    if (errors.length) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const draft = await generateItineraryPlan(value);
    return res.json({
      message: 'Itinerary generated successfully.',
      trip: draft,
    });
  } catch (error) {
    return next(error);
  }
}

export async function createTrip(req, res, next) {
  try {
    const { errors, value } = validateTripCreationPayload(req.body);
    if (errors.length) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const trip = await Trip.create({
      ...value,
      userId: req.auth.userId,
    });

    return res.status(201).json({
      message: 'Trip saved successfully.',
      trip: publicTrip(trip),
    });
  } catch (error) {
    return next(error);
  }
}

export async function listTrips(req, res, next) {
  try {
    const trips = await Trip.find({ userId: req.auth.userId }).sort({ startDate: -1, createdAt: -1 });
    return res.json({
      trips: trips.map(publicTrip),
    });
  } catch (error) {
    return next(error);
  }
}

export async function listExploreTrips(req, res, next) {
  try {
    const searchQuery = String(req.query?.search || '').trim();
    const budget = String(req.query?.budget || '').trim();
    const sort = String(req.query?.sort || 'newest').trim();
    const durationMin = parseNumberQuery(req.query?.durationMin);
    const durationMax = parseNumberQuery(req.query?.durationMax);

    const match = {};

    if (searchQuery) {
      const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      match.$or = [{ title: regex }, { 'from.label': regex }];
    }

    if (['$', '$$', '$$$'].includes(budget)) {
      match.budget = budget;
    }

    if (durationMin !== null || durationMax !== null) {
      match.durationDays = {};
      if (durationMin !== null) {
        match.durationDays.$gte = Math.max(1, Math.floor(durationMin));
      }
      if (durationMax !== null) {
        match.durationDays.$lte = Math.max(1, Math.floor(durationMax));
      }
    }

    let sortBy = { createdAt: -1 };
    if (sort === 'popular') {
      sortBy = { likesCount: -1, createdAt: -1 };
    } else if (sort === 'durationAsc') {
      sortBy = { durationDays: 1, createdAt: -1 };
    } else if (sort === 'durationDesc') {
      sortBy = { durationDays: -1, createdAt: -1 };
    }

    const [savedRows, tripsFromOthers] = await Promise.all([
      SavedTrip.find({ userId: req.auth.userId }).select('tripId'),
      Trip.find({ ...match, userId: { $ne: req.auth.userId } })
        .populate('userId', 'username fullName profileImageUrl')
        .sort(sortBy)
        .limit(120),
    ]);
    const savedTripIds = new Set(savedRows.map((item) => item.tripId?.toString?.()).filter(Boolean));
    let trips = tripsFromOthers;

    // If there are no community trips from other users yet, show the current user's
    // trips so Explore does not look empty in early-stage/dev environments.
    if (!trips.length) {
      trips = await Trip.find(match)
        .populate('userId', 'username fullName profileImageUrl')
        .sort(sortBy)
        .limit(120);
    }

    const exploreTrips = trips
      .map((trip) => publicTrip(trip, { savedTripIds }))
      .filter((trip) => trip.status === 'completed' && !trip.isSaved);

    return res.json({
      trips: exploreTrips,
    });
  } catch (error) {
    return next(error);
  }
}

export async function listLatestTrips(req, res, next) {
  try {
    const limitQuery = Number(req.query?.limit);
    const limit = Number.isFinite(limitQuery) ? Math.max(1, Math.min(Math.floor(limitQuery), 120)) : 40;

    const trips = await Trip.find({})
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.json({
      trips: trips.map(publicTrip),
    });
  } catch (error) {
    return next(error);
  }
}

export async function listSavedTrips(req, res, next) {
  try {
    const savedRows = await SavedTrip.find({ userId: req.auth.userId })
      .sort({ createdAt: -1 })
      .populate({
        path: 'tripId',
        populate: {
          path: 'userId',
          select: 'username fullName profileImageUrl',
        },
      });
    const savedTripIds = new Set(savedRows.map((item) => item.tripId?._id?.toString?.()).filter(Boolean));

    const trips = savedRows
      .map((row) => row.tripId)
      .filter(Boolean)
      .map((trip) => publicTrip(trip, { savedTripIds }));

    return res.json({ trips });
  } catch (error) {
    return next(error);
  }
}

export async function saveTripForUser(req, res, next) {
  try {
    const trip = await Trip.findById(req.params.tripId).populate('userId', 'username fullName profileImageUrl');
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }

    await SavedTrip.findOneAndUpdate(
      { userId: req.auth.userId, tripId: req.params.tripId },
      { userId: req.auth.userId, tripId: req.params.tripId },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({
      message: 'Trip saved successfully.',
      trip: publicTrip(trip, {
        savedTripIds: new Set([trip._id.toString()]),
      }),
    });
  } catch (error) {
    return next(error);
  }
}

export async function removeSavedTripForUser(req, res, next) {
  try {
    await SavedTrip.deleteOne({ userId: req.auth.userId, tripId: req.params.tripId });
    return res.json({ message: 'Saved trip removed.' });
  } catch (error) {
    return next(error);
  }
}

export async function getTripById(req, res, next) {
  try {
    const trip = await Trip.findOne({ _id: req.params.tripId, userId: req.auth.userId });
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }

    return res.json({ trip: publicTrip(trip) });
  } catch (error) {
    return next(error);
  }
}

export async function updateTripStatus(req, res, next) {
  try {
    const { errors, value } = validateTripStatusPayload(req.body);
    if (errors.length) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const trip = await Trip.findOneAndUpdate(
      { _id: req.params.tripId, userId: req.auth.userId },
      { status: value.status },
      { new: true }
    );

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }

    return res.json({
      message: 'Trip status updated.',
      trip: publicTrip(trip),
    });
  } catch (error) {
    return next(error);
  }
}

export async function deleteTrip(req, res, next) {
  try {
    const trip = await Trip.findOneAndDelete({ _id: req.params.tripId, userId: req.auth.userId });
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }
    return res.json({ message: 'Trip deleted successfully.' });
  } catch (error) {
    return next(error);
  }
}

export async function updateTripLike(req, res, next) {
  try {
    const trip = await Trip.findOne({ _id: req.params.tripId, userId: req.auth.userId });
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }

    const nextLike = typeof req.body?.like === 'boolean' ? req.body.like : !trip.isLiked;
    trip.isLiked = nextLike;
    trip.likesCount = nextLike ? 1 : 0;
    await trip.save();

    return res.json({
      message: 'Trip like updated.',
      trip: publicTrip(trip),
    });
  } catch (error) {
    return next(error);
  }
}


