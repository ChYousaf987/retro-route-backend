class apiError extends Error {
  constructor(statusCode, message, success = false, error = null) {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.success = success;
    this.error = error;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      statusCode: this.statusCode,
      message: this.message,
      success: this.success,
      error: this.error,
    };
  }
}

export { apiError };
