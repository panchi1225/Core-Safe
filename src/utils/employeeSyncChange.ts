export class EmployeeChangeError extends Error {
  saved: boolean;
  constructor(message: string, saved: boolean) { super(message); this.saved=saved; }
}
interface Options {
  prepare: () => Promise<{ticket:string}>;
  write: () => Promise<void>;
  settle: (ticket:string) => Promise<void>;
  synchronize: (ticket:string) => Promise<unknown>;
}
// The write callback must send a server-only request, never enqueue an offline
// Firestore SDK write. If its outcome is unknown, retain the durable barrier.
export async function guardedEmployeeChange({prepare,write,settle,synchronize}: Options) {
  let ticket: string;
  try { ticket=(await prepare()).ticket; }
  catch {throw new EmployeeChangeError('公開用の旧社員情報を無効化できませんでした。Firestoreの社員変更は開始していません。通信状況を確認してください。',false);}
  try {await write();}
  catch {throw new EmployeeChangeError('Firestoreの社員変更を確認できませんでした。公開自動入力は停止しています。保存結果を社員名簿で確認し、管理者に復旧を依頼してください。自動再送は行いません。',false);}
  try {await settle(ticket);await synchronize(ticket);}
  catch {throw new EmployeeChangeError('Firestoreの社員変更は成功しましたが、公開用社員情報の同期を確認できませんでした。旧情報は公開せず、同期が完了するまで手入力をご利用ください。管理者は保存内容・他の変更処理を確認して障害復旧を行ってください。',true);}
}
