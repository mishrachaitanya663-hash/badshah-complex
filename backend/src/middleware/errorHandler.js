export function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Image is too large' });
  }
  if (error.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ error: 'Too many images' });
  }

  const status = error.status || (error.message?.includes('Only jpeg') ? 400 : 500);
  if (status >= 500) console.error(error);
  return res.status(status).json({ error: error.message || 'Internal server error' });
}
