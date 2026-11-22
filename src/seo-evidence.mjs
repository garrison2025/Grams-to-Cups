// Build-time Semrush evidence parsing. No imports, network or runtime dependencies.
// Do not treat missing values as zero; that can fabricate low-difficulty opportunities.
export function parseSemrushNumber(value){
 const s=String(value??'').trim();
 if(!s||s==='-'||/^n\/?a$/i.test(s))return null;
 if(!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(s))return null;
 const n=Number(s);
 return Number.isFinite(n)&&n>=0?n:null;
}

// Semrush KD is a bounded 0–100 score; traffic and volume are different metrics.
// Never call a missing, negative or out-of-range difficulty score an easy keyword.
export function parseSemrushKD(value){
 const n=parseSemrushNumber(value);
 return n!==null&&n<=100?n:null;
}
export function csvSafeCell(value){
 let s=String(value??'');
 // Excel/Sheets may treat quoted CSV fields as executable spreadsheet formulas.
 // The apostrophe neutralizes formulas while keeping the underlying source file untouched.
 if(/^[\s\u0000-\u001f\u200b-\u200d\ufeff]*[=+@-]/u.test(s))s="'"+s;
 return '"'+s.replaceAll('"','""')+'"';
}
