import { trainingDataset,syntheticHistory } from '../prototypes/training-data.mjs';
import { privateHandler } from '../cloud/handler.mjs';
export default function handler(request,response){if(process.env.FITNESS_CLOUD_ENABLED==='1')return privateHandler(request,response,'training');response.setHeader('Cache-Control','no-store');response.status(200).json({...trainingDataset(syntheticHistory(),{}, {window:new URL(request.url,'http://localhost').searchParams.get('window')==='all'?'all':'90',anchor:'2026-11-01',synthetic:true}),local:false,lastSync:null});}
