// Build-time Semrush evidence parsing. No imports, network or runtime dependencies.
// Do not treat missing values as zero; that can fabricate low-difficulty opportunities.
export function parseSemrushNumber(value){
 const s=String(value??'').trim();
 if(!s||s==='-'||/^n\/?a$/i.test(s))return null;
 if(!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(s))return null;
 const n=Number(s);
 return Number.isFinite(n)?n:null;
}
export function csvSafeCell(value){
 let s=String(value??'');
 // Excel/Sheets may treat quoted CSV fields as executable spreadsheet formulas.
 // The apostrophe neutralizes formulas while keeping the underlying source file untouched.
 if(/^[\x00-\x20]*[=+@-]/.test(s))s="'"+s;
 return '"'+s.replaceAll('"','""')+'"';
}
