const { createGoogleSheetsHandler } = require('../scripts/google-api-handler.cjs');

const handlerCache = new Map();

function getFeatureSlug(request) {
  const rawFeature = request.query?.feature;
  const feature = Array.isArray(rawFeature) ? rawFeature[0] : rawFeature;
  return String(feature || '').trim();
}

module.exports = async function handler(request, response) {
  const slug = getFeatureSlug(request);

  if (!slug) {
    response.status(404).json({ error: 'Thiếu tên endpoint API.' });
    return;
  }

  if (!handlerCache.has(slug)) {
    handlerCache.set(slug, createGoogleSheetsHandler(slug));
  }

  await handlerCache.get(slug)(request, response);
};
