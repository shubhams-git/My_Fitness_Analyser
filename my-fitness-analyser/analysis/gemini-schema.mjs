// Gemini's constrained decoder has a state budget. Repeating hundreds of fact
// IDs through nested arrays exceeds it. The provider gets bounded structure;
// Ajv and the evidence validator retain the complete request-specific enums.
export function providerSchema(value){
 if(Array.isArray(value))return value.map(providerSchema);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key,v])=>!['minLength','maxLength','uniqueItems'].includes(key)&&!(key==='enum'&&Array.isArray(v)&&v.length>24)).map(([key,v])=>[key,providerSchema(v)]));
 return value;
}
