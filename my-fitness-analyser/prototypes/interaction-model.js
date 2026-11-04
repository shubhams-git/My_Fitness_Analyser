// Last recorded sample at/before elapsed time, clamped at both ends. No interpolation.
export function recordIndexAtElapsed(records, elapsed) {
  if(!records.length)return -1;
  let low=0,high=records.length-1;
  while(low<high){const mid=Math.ceil((low+high)/2);if(records[mid].t<=elapsed)low=mid;else high=mid-1;}
  return low;
}
