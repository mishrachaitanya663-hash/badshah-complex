export function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Image is too large' });
  }
  if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Too many images or unexpected file field' });
  }

  const status = error.status || (/only jpeg|png|webp|gif/i.test(error.message || '') ? 400 : 500);
  if (status >= 500) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
  return res.status(status).json({ error: error.message || 'Request failed' });
}
