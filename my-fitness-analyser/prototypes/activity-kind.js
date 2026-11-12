const kinds = {
  running: 'run', track_running: 'run', trail_running: 'run', street_running: 'run',
  treadmill_running: 'treadmill', indoor_running: 'treadmill', virtual_running: 'treadmill',
  walking: 'walk', indoor_walking: 'walk', hiking: 'walk',
  cycling: 'cycling', road_biking: 'cycling', mountain_biking: 'cycling', gravel_cycling: 'cycling',
  indoor_cycling: 'stationary-bike', indoorCycling: 'stationary-bike', spin: 'stationary-bike', virtual_ride: 'stationary-bike',
  elliptical: 'elliptical', cross_trainer: 'elliptical',
  stair_climbing: 'stairs', stairClimbing: 'stairs', stair_stepper: 'stairs', floor_climbing: 'stairs',
  strength_training: 'strength', strengthTraining: 'strength', training: 'workout', strength: 'strength',
  fitness_equipment: 'workout', cardio_training: 'workout',
  swimming: 'swim', lap_swimming: 'swim', open_water_swimming: 'swim', swimming_pool: 'swim', open_water: 'swim',
  rowing: 'rowing', indoor_rowing: 'rowing', indoorRowing: 'rowing', rowing_v2: 'rowing',
  yoga: 'mobility', pilates: 'mobility',
  indoor_cardio: 'workout', cross_training: 'workout', hiit: 'workout', other: 'workout'
};

export const activityLabels = {
  run: 'Run', treadmill: 'Treadmill run', walk: 'Walk', cycling: 'Ride',
  'stationary-bike': 'Stationary bike', elliptical: 'Elliptical', stairs: 'Stair climbing',
  strength: 'Strength training', swim: 'Swim', rowing: 'Rowing', mobility: 'Yoga or Pilates', workout: 'Workout'
};

export const supportedGarminKind = key => Object.hasOwn(kinds, key);
export function activityKind(activity) {
  const provider = activity.provider?.detail?.activityTypeDTO?.typeKey;
  const description = [activity.fitSubSport, activity.sport, activity.title].join(' ');
  if (/\b(backward|backwards|retro)[ _-]+run/i.test(description)) return 'workout';
  if (/treadmill|indoor[ _-]+run|virtual[ _-]+run/i.test(description)) return 'treadmill';
  const subSport=Object.hasOwn(kinds,activity.fitSubSport)?kinds[activity.fitSubSport]:null;
  if (subSport && ['stationary-bike','elliptical','stairs','strength','swim','rowing','mobility'].includes(subSport)) return subSport;
  if (activity.sport==='Walk' && kinds[provider]==='run') return 'walk';
  if (supportedGarminKind(provider)) return kinds[provider];
  if (subSport) return subSport;
  return Object.keys(activityLabels).find(key => activityLabels[key] === activity.sport)
    || (/^track run$/i.test(activity.sport) ? 'run' : Object.hasOwn(kinds,activity.sport?.toLowerCase())?kinds[activity.sport.toLowerCase()]:'workout');
}

export const isScreenshot = activity => activity.sourceFile==='Owner-supplied screenshots';
export const garminId = activity => activity.provider?.id ?? activity.garminActivityId ?? null;
export const runTerrain = activity => /track/i.test([activity.fitSubSport,activity.provider?.detail?.activityTypeDTO?.typeKey,activity.sport].join(' '))?'track'
  : /trail/i.test([activity.fitSubSport,activity.provider?.detail?.activityTypeDTO?.typeKey,activity.sport].join(' '))?'trail':'general';
export const isGarminOutdoorRun = activity => activityKind(activity) === 'run'
  && !isScreenshot(activity)
  && Boolean(garminId(activity) || activity.source === 'Garmin Connect' || activity.source === 'garmin')
  && Boolean(activity.records?.some(row => Number.isFinite(row.lat) && Number.isFinite(row.lon))
    || ['track_running','trail_running','street_running'].includes(activity.provider?.detail?.activityTypeDTO?.typeKey));
