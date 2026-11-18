export const RECOVERY_DAYS=28;
const dayMs=86400000;
const dateKey=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const between=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max?value:null;
const dateBefore=(date,days)=>new Date(Date.parse(date)-days*dayMs).toISOString().slice(0,10);

// The same numeric allowlist applies at ingestion and at the Gemini boundary.
export const recoveryMetrics={
 sleep:{
  sleepS:['Estimated sleep','s',1,86400],napS:['Estimated nap time','s',0,86400],
  deepS:['Estimated deep sleep','s',0,86400],lightS:['Estimated light sleep','s',0,86400],
  remS:['Estimated REM sleep','s',0,86400],awakeS:['Estimated awake time','s',0,86400],
  unmeasuredS:['Unmeasured time in sleep window','s',0,86400],score:['Garmin sleep score','score',0,100]
 },
 hrv:{overnightMs:['Overnight average HRV','ms',1,300],weeklyMs:['Garmin weekly average HRV','ms',1,300]},
 wellness:{
  restingHrBpm:['Garmin resting heart rate','bpm',1,250],stress:['Garmin daily average stress','score',0,100],
  batteryMin:['Garmin daily Body Battery low','score',0,100],batteryMax:['Garmin daily Body Battery high','score',0,100],
  batteryCharged:['Garmin daily Body Battery charge','points',0,1000],batteryDrained:['Garmin daily Body Battery drain','points',0,1000]
 }
};

export function recoveryValues(domain,row){
 const values=Object.fromEntries(Object.entries(recoveryMetrics[domain]).map(([key,[,,min,max]])=>[key,between(row?.[key],min,max)]));
 if(domain==='sleep'&&values.sleepS===null){
  // Without a detected sleep episode, placeholders for stages and score have
  // no measurement basis. A reported nap can exist independently.
  return values.napS>0?{napS:values.napS}:null;
 }
 return Object.values(values).some(value=>value!==null)?values:null;
}

const feeds={
 sleep:{
  path:(start,end)=>`/sleep-service/sleep/dailySleepSummariesByDate?startDate=${start}&endDate=${end}`,
  rows:data=>data,
  project:r=>({sleepS:r.sleepTimeSeconds,napS:r.napTimeSeconds,deepS:r.deepSleepSeconds,lightS:r.lightSleepSeconds,
   remS:r.deviceRemCapable===false?null:r.remSleepSeconds,awakeS:r.awakeSleepSeconds,
   unmeasuredS:r.unmeasurableSleepSeconds,score:r.sleepScores?.overall?.value,
   windowConfirmed:r.sleepWindowConfirmed,fromDevice:r.sleepFromDevice})
 },
 hrv:{
  path:(start,end)=>`/hrv-service/hrv/daily/${start}/${end}`,
  rows:data=>data?.hrvSummaries,
  project:r=>({overnightMs:r.lastNightAvg,weeklyMs:r.weeklyAvg})
 },
 wellness:{
  path:(start,end)=>`/usersummary-service/v2/dailysummaries?startDate=${start}&endDate=${end}`,
  rows:data=>data?.data,
  project:r=>r.includesWellnessData===true?{restingHrBpm:r.heartRate?.restingValue,stress:r.stress?.avgLevel,
   batteryMin:r.bodyBattery?.minValue,batteryMax:r.bodyBattery?.maxValue,
   batteryCharged:r.bodyBattery?.chargedValue,batteryDrained:r.bodyBattery?.drainedValue}:null
 }
};

export async function fetchGarminRecovery(client,anchor){
 const start=dateBefore(anchor,RECOVERY_DAYS-1),signal=AbortSignal.timeout(12000);
 const results=await Promise.all(Object.entries(feeds).map(async([domain,feed])=>{
  try{
   const rows=feed.rows(await client.json(feed.path(start,anchor),{signal}));
   if(!Array.isArray(rows)||rows.length>200)throw new Error('Invalid Garmin summary');
   const byDate={};
   for(const row of rows){
    const date=row?.calendarDate;
    if(!dateKey(date)||date<start||date>anchor)continue;
    const projected=feed.project(row),values=recoveryValues(domain,projected);
    if(!values)continue;
    const quality=domain==='sleep'&&values.sleepS!=null?
     Object.fromEntries(['windowConfirmed','fromDevice'].flatMap(key=>typeof projected[key]==='boolean'?[[key,projected[key]]]:[])):{};
    if(Object.hasOwn(byDate,date)){
     // Conflicting summaries for a date are ambiguous. Omit that date.
     byDate[date]=null;
    }else byDate[date]={...values,...quality};
   }
   return [domain,{state:'fetched',through:anchor,days:Object.fromEntries(Object.entries(byDate).filter(([,value])=>value))}];
  }catch{return [domain,{state:'unavailable',through:anchor}];}
 }));
 return Object.fromEntries(results);
}

export function mergeGarminRecovery(previous={},latest){
 return Object.fromEntries(Object.entries(latest).map(([domain,feed])=>[
  domain,feed.state==='fetched'?feed:{...previous?.[domain],state:'unavailable',attemptedThrough:feed.through}
 ]));
}

export function recoveryEvidence(source,anchor,add){
 const domains={};
 for(const domain of Object.keys(feeds)){
  const feed=source?.[domain],rows=[];
  for(let daysAgo=0;daysAgo<RECOVERY_DAYS;daysAgo++){
   const date=dateBefore(anchor,daysAgo),row=feed?.days?.[date],values=recoveryValues(domain,row);
   if(!values)continue;
   const ref=`recovery.${domain}.d${daysAgo}`,metrics=Object.keys(values).filter(key=>values[key]!==null);
   for(const key of metrics){
    const [label,unit]=recoveryMetrics[domain][key];
    add(`${ref}.${key}`,label,values[key],unit);
   }
   rows.push({daysAgo,ref,metrics,...(domain==='sleep'&&values.sleepS!=null?{
    windowConfirmed:typeof row.windowConfirmed==='boolean'?row.windowConfirmed:null,
    fromDevice:typeof row.fromDevice==='boolean'?row.fromDevice:null
   }:{})});
  }
  const coverage=Object.fromEntries(Object.keys(recoveryMetrics[domain]).map(key=>[
   key,rows.filter(row=>row.metrics.includes(key)).length
  ]));
  for(const [prefix,minDay,maxDay] of [['recent7',0,7],['previous7',7,14],['recent28',0,28]]){
   for(const [key,[label,unit]] of Object.entries(recoveryMetrics[domain])){
    const observed=rows.filter(row=>row.daysAgo>=minDay&&row.daysAgo<maxDay&&row.metrics.includes(key));
    if(observed.length<2)continue;
    const total=observed.reduce((sum,row)=>sum+feed.days[dateBefore(anchor,row.daysAgo)][key],0);
    add(`recovery.${domain}.${prefix}.${key}`,label+' mean across recorded days',Math.round(total/observed.length*10)/10,unit);
    add(`recovery.${domain}.${prefix}.${key}Days`,label+' days contributing to mean',observed.length,'days');
   }
  }
  const syncedDaysAgo=dateKey(feed?.through)?(Date.parse(anchor)-Date.parse(feed.through))/dayMs:null;
  domains[domain]={state:['fetched','unavailable'].includes(feed?.state)?feed.state:'not-synced',
   syncedDaysAgo:syncedDaysAgo>=0?syncedDaysAgo:null,recordedDays:rows.length,coverage,rows};
 }
 return {source:'Garmin Connect',windowDays:RECOVERY_DAYS,dayBasis:'Garmin calendar date; sleep is the provider-labelled night.',
  limitations:'Watch-derived estimates. Missing days and fields are unknown. Today may be incomplete. Stage estimates, HRV, stress and Body Battery are context, not clinical or readiness measurements.',domains};
}
