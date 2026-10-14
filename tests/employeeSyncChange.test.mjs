import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {act,create} from 'react-test-renderer';
import {guardedEmployeeChange,EmployeeChangeError} from '../src/utils/employeeSyncChange.ts';
import {loadModule} from './helpers.mjs';
const {employeeWriteBody}=await loadModule('src/services/employeeServerWrite.ts');
for(const kind of ['add','edit','delete'])test(`employee ${kind} automatically invalidates, commits, settles and syncs without manual action`,async()=>{
  const calls=[];
  await guardedEmployeeChange({prepare:async()=>{calls.push('invalidate');return {ticket:'verified-ticket'};},write:async()=>{assert.deepEqual(calls,['invalidate']);calls.push(kind);},settle:async t=>{assert.equal(t,'verified-ticket');calls.push('settle');},synchronize:async t=>{assert.equal(t,'verified-ticket');calls.push('sync');}});
  assert.deepEqual(calls,['invalidate',kind,'settle','sync']);
});
for(const failed of ['prepare','write','settle','synchronize'])test(`${failed} failure is visible with the correct Firestore result and no unsafe next operation`,async()=>{
  const calls=[];const step=name=>async()=>{calls.push(name);if(name===failed)throw Error('synthetic failure');return {ticket:'ticket'};};
  await assert.rejects(guardedEmployeeChange({prepare:step('prepare'),write:step('write'),settle:step('settle'),synchronize:step('synchronize')}),e=>e instanceof EmployeeChangeError&&e.saved===['settle','synchronize'].includes(failed));
  assert.deepEqual(calls,['prepare','write','settle','synchronize'].slice(0,['prepare','write','settle','synchronize'].indexOf(failed)+1));
});
test('server commit preserves setDoc merge behavior including nested qualification fields, nulls and existing IDs',()=>{
  const employee={id:'synthetic',nameSei:'架空',nameMei:'社員',qualifications:{slinging:true},healthCheckDay:null,sealImage:'NOT-SENT-TO-WORKER'};
  const [write]=employeeWriteBody('demo-core-safe',employee).writes;
  assert.equal(write.update.name,'projects/demo-core-safe/databases/(default)/documents/employees/synthetic');
  assert.ok(write.updateMask.fieldPaths.includes('qualifications.slinging'));assert.ok(!write.updateMask.fieldPaths.includes('qualifications'));
  assert.deepEqual(write.update.fields.healthCheckDay,{nullValue:null});assert.deepEqual(write.update.fields.qualifications.mapValue.fields.slinging,{booleanValue:true});
  assert.deepEqual(employeeWriteBody('demo-core-safe','synthetic').writes,[{delete:write.update.name}]);
});

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.TestEmployeeChangeError=EmployeeChangeError;
const {useEmployeeAutofillSync}=await loadModule('src/components/EmployeeAutofillSync.tsx',{
  employeeAutofillService:`export const publicAutofillConfigured=true;export const employeeSyncStatus=async()=>globalThis.employeeInitialStatus?globalThis.employeeInitialStatus():({admin:false,pending:0,available:true});export const controlEmployeeAutofill=async()=>{};export const synchronizeEmployeeAutofill=()=>{throw Error('Manual sync must not be called');};export const changeEmployeeAndAutofill=(write,progress)=>globalThis.employeeAutoChange(write,progress);`,
  employeeSyncChange:`export const EmployeeChangeError=globalThis.TestEmployeeChangeError;`,
});
function Harness(){const state=useEmployeeAutofillSync();globalThis.employeeSyncState=state;return React.createElement('p',{role:'status'},state.message);}
test('automatic change needs no manual sync and reports saved-but-unsynced result visibly',async()=>{
  let tree;globalThis.employeeAutoChange=async write=>{await write('id-token');throw new EmployeeChangeError('Firestore保存成功／公開同期失敗',true);};
  await act(async()=>{tree=create(React.createElement(Harness));});let saved=false,result;
  await act(async()=>{result=await globalThis.employeeSyncState.change(async token=>{assert.equal(token,'id-token');saved=true;});});
  assert.equal(saved,true);assert.equal(result,true);assert.ok(JSON.stringify(tree.toJSON()).includes('Firestore保存成功／公開同期失敗'));
  await act(async()=>tree.unmount());
});

test('late initial status cannot hide the result of a completed employee change',async()=>{
  let resolveStatus,tree;
  globalThis.employeeInitialStatus=()=>new Promise(resolve=>{resolveStatus=resolve;});
  globalThis.employeeAutoChange=async write=>{await write();throw new EmployeeChangeError('Firestore保存成功／公開同期失敗',true);};
  await act(async()=>{tree=create(React.createElement(Harness));});
  await act(async()=>{await globalThis.employeeSyncState.change(async()=>{});});
  await act(async()=>{resolveStatus({admin:false,pending:1,available:false});});
  assert.ok(JSON.stringify(tree.toJSON()).includes('Firestore保存成功／公開同期失敗'));
  await act(async()=>tree.unmount());delete globalThis.employeeInitialStatus;
});
