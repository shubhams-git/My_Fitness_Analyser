import { loadPrototypeData } from '../prototypes/data.mjs';

// GitHub/Vercel preview is deliberately synthetic-only. The private-data folder
// is ignored by Git and is not part of the deployment bundle.
const payload = await loadPrototypeData();

export default function handler(_request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'self'; base-uri 'none'");
  response.status(200).json(payload);
}
