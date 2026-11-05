import { privateHandler } from '../cloud/handler.mjs';
export default function handler(request,response){const route=request.query?.route||new URL(request.url,'https://app.invalid').searchParams.get('route');return privateHandler(request,response,route);}
