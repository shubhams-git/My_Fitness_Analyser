import {syntheticHistory} from '../prototypes/training-data.mjs';
import {coachingEvidence} from '../analysis/coaching-evidence.mjs';

export function syntheticCoaching(){
 const anchor='2026-11-07',activities=syntheticHistory().map(a=>({...a,synthetic:false,source:'Garmin Connect'}));
 const recovery=Object.fromEntries(['sleep','hrv','wellness'].map(domain=>{
  const days=Object.fromEntries(Array.from({length:28},(_,i)=>{
   const date=new Date(Date.parse(anchor)-i*86400000).toISOString().slice(0,10);
   const row={
    sleep:{sleepS:24800+(i%6)*430,score:68+i%20,napS:i%5?0:1200,deepS:4200,lightS:15200,remS:5500,awakeS:1000,unmeasuredS:0,fromDevice:true,windowConfirmed:i>0},
    hrv:{overnightMs:43+i%14,weeklyMs:50+i%3},
    wellness:{restingHrBpm:48+i%5,stress:20+i%9,batteryMin:18+i%11,batteryMax:78+i%8,batteryCharged:45+i%12,batteryDrained:38+i%15}
   }[domain];
   return [date,row];
  }).filter((_,i)=>i%8!==7));
  return [domain,{state:'fetched',through:anchor,days}];
 }));
 return coachingEvidence({activities:Object.fromEntries(activities.map(a=>[a.id,a])),feedback:{},garminRecovery:recovery},
  {anchor,strengthEntries:[{date_key:'2026-11-05',focus:'Legs',minutes:40}],includeRecovery:true});
}
