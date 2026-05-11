// src/middleware/errorHandler.js
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

const handleCastError = (err) => new AppError(`Invalid ${err.path}: ${err.value}`, 400);
const handleDuplicateError = (err) => {
  const field = Object.keys(err.keyValue || {}).find(k => k !== 'company') || Object.keys(err.keyValue || {})[0] || 'field';
  const value = err.keyValue?.[field];
  return new AppError(`Duplicate ${field}${value ? `: "${value}"` : ''} — record already exists.`, 409);
};
const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  return new AppError(`Validation failed: ${errors.join('. ')}`, 422);
};
const handleJWTError = () => new AppError('Invalid token. Please log in again.', 401);
const handleJWTExpiredError = () => new AppError('Token expired. Please log in again.', 401);

const sendError = (err, res) => {
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  }
  logger.error('UNEXPECTED ERROR:', err);
  return res.status(500).json({
    success: false,
    message: 'Something went wrong. Please try again.',
  });
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  let error = err;
  if (err.name === 'CastError') error = handleCastError(err);
  if (err.code === 11000) error = handleDuplicateError(err);
  if (err.name === 'ValidationError') error = handleValidationError(err);
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();
  sendError(error, res);
};
