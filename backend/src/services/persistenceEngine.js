// src/services/persistenceEngine.js
// ── STRICT MONGODB MODE ───────────────────────────────────────────────────────
// All local JSON fallback code has been removed. This service is now a thin
// wrapper around Mongoose that throws a 503 if the database is not connected.
// ─────────────────────────────────────────────────────────────────────────────
const mongoose = require('mongoose');
const logger = require('../utils/logger');

const assertConnected = () => {
  if (mongoose.connection.readyState !== 1) {
    logger.error('Database is not connected. Rejecting operation.');
    const err = new Error('Database not connected. Please check your MongoDB Atlas connection.');
    err.statusCode = 503;
    throw err;
  }
};

class PersistenceService {
  async perform(collection, Model, action, params = {}) {
    assertConnected();

    try {
      switch (action) {
        case 'read': {
          let query = Model.find(params.query || {});
          if (params.sort) query = query.sort(params.sort);
          if (params.populate) query = query.populate(params.populate);
          if (params.limit && params.limit > 0) {
            const page = params.page || 1;
            const skip = (page - 1) * params.limit;
            query = query.skip(skip).limit(params.limit);
          }
          const [data, total] = await Promise.all([
            query.lean(),
            Model.countDocuments(params.query || {}),
          ]);
          const limit = params.limit || 0;
          return {
            data,
            total,
            page: params.page || 1,
            pages: limit > 0 ? Math.ceil(total / limit) : 1,
          };
        }

        case 'create':
          return await Model.create(params.data);

        case 'update':
          return await Model.findOneAndUpdate(
            params.query || { _id: params.id },
            params.data,
            { new: true, runValidators: true }
          );

        case 'delete':
          return await Model.findOneAndDelete(
            params.query || { _id: params.id }
          );

        case 'bulkDelete':
          return await Model.deleteMany(params.query);

        case 'updateMany':
          return await Model.updateMany(params.query, params.data);

        case 'findById':
          return await Model.findById(params.id)
            .populate(params.populate || '')
            .lean();

        default:
          throw new Error(`Unknown persistence action: ${action}`);
      }
    } catch (err) {
      // Re-throw 503 errors as-is; wrap other errors
      if (err.statusCode === 503) throw err;
      logger.error(`MongoDB error during ${action} on ${collection}: ${err.message}`);
      throw err;
    }
  }
}

module.exports = new PersistenceService();
