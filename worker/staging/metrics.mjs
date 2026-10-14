// Test-only instrumentation; returns only aggregate row counts, never SQL/data.
export function meteredDB(database){
 const totals={read:0,written:0,queries:0};
 const record=r=>{totals.read+=r.meta?.rows_read||0;totals.written+=r.meta?.rows_written||0;totals.queries++;return r;};
 const statement=native=>({native,bind(...args){return statement(native.bind(...args));},async first(column){const r=record(await native.all());const row=r.results[0]||null;return column&&row?row[column]:row;},async all(){return record(await native.all());},async run(){return record(await native.run());}});
 return {totals,DB:{prepare(sql){return statement(database.prepare(sql));},async batch(statements){const result=await database.batch(statements.map(s=>s.native));return result.map(record);}}};
}
