module.exports = (err, req, res, next) => {
  console.error(`[ERROR ${new Date().toISOString()}]`, err.message);
  console.error(err.stack);

  // Don't expose raw database errors to client
  if (err.message?.includes('database') || err.message?.includes('constraint')) {
    return res.status(500).json({
      error: 'Internal server error',
      code: 'DB_ERROR'
    });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR'
  });
};
