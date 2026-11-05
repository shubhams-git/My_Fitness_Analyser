import { demonstration } from '../prototypes/data.mjs';
import { syntheticHistory } from '../prototypes/training-data.mjs';
import { privateHandler } from '../cloud/handler.mjs';

// GitHub/Vercel preview is deliberately synthetic-only. The private-data folder
// is ignored by Git and is not part of the deployment bundle.
const payload = process.env.FITNESS_CLOUD_ENABLED==='1'?null:{activities:[demonstration(),...syntheticHistory()],defaultId:'demo',mode:'synthetic-design-preview'};

export default function handler(_request, response) {
  if(process.env.FITNESS_CLOUD_ENABLED==='1')return privateHandler(_request,response,'data');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'self'; base-uri 'none'");
  response.status(200).json(payload);
}
