import { privateHandler } from '../cloud/handler.mjs';

// Hosted product always requires authentication; missing config fails closed.

export default function handler(_request, response) {
  return privateHandler(_request,response,'data');
}
