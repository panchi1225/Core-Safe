import { db } from '../firebase';
import { 
  collection, 
  getDocs, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  Timestamp,
  setDoc,     
  addDoc,     
  getDoc,     
  writeBatch
} from 'firebase/firestore';
import { SavedDraft, MasterData, INITIAL_MASTER_DATA, EmployeeData } from '../types'; // EmployeeDataを追加

const DRAFTS_COLLECTION = 'drafts';
const MASTER_COLLECTION = 'masterData';
const MASTER_DOC_ID = 'general';
const EMPLOYEES_COLLECTION = 'employees'; // ★追加

// ■ データを全件取得する
export const fetchDrafts = async (): Promise<SavedDraft[]> => {
  try {
    const q = query(collection(db, DRAFTS_COLLECTION), orderBy('lastModified', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        type: data.type,
        lastModified: data.lastModified instanceof Timestamp 
          ? data.lastModified.toMillis() 
          : data.lastModified, 
        data: data.data
      } as SavedDraft;
    });
  } catch (error) {
    console.error("データの読み込みに失敗しました: ", error);
    throw error;
  }
};

// ■ データを削除する
export const removeDraft = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, DRAFTS_COLLECTION, id));
  } catch (error) {
    console.error("データの削除に失敗しました: ", error);
    throw error;
  }
};

// ■ データを保存する
export const saveDraft = async (
  draftId: string | null, 
  type: string, 
  data: any
): Promise<string> => {
  try {
    const draftData = {
      type,
      data,
      lastModified: Timestamp.now()
    };

    if (draftId) {
      await setDoc(doc(db, DRAFTS_COLLECTION, draftId), draftData, { merge: true });
      return draftId;
    } else {
      const docRef = await addDoc(collection(db, DRAFTS_COLLECTION), draftData);
      return docRef.id;
    }
  } catch (error) {
    console.error("保存に失敗しました: ", error);
    throw error;
  }
};

// ■ マスタデータを取得する
export const getMasterData = async (): Promise<MasterData> => {
  try {
    const docRef = doc(db, MASTER_COLLECTION, MASTER_DOC_ID);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as MasterData;
    } else {
      return INITIAL_MASTER_DATA;
    }
  } catch (error) {
    console.error("マスタデータの読み込み失敗: ", error);
    return INITIAL_MASTER_DATA;
  }
};

// ■ マスタデータを保存する
export const saveMasterData = async (data: MasterData): Promise<void> => {
  try {
    await setDoc(doc(db, MASTER_COLLECTION, MASTER_DOC_ID), data);
  } catch (error) {
    console.error("マスタデータの保存失敗: ", error);
    throw error;
  }
};

// ■ 画像圧縮ヘルパー
export const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

// ■ プロジェクト関連データの一括削除
export const deleteDraftsByProject = async (projectName: string): Promise<void> => {
  try {
    const allDrafts = await getDocs(collection(db, DRAFTS_COLLECTION));
    const batch = writeBatch(db);
    let count = 0;
    allDrafts.forEach(doc => {
      const data = doc.data();
      if (data.data && data.data.project === projectName) {
        batch.delete(doc.ref);
        count++;
      }
    });
    if (count > 0) {
      await batch.commit();
    }
  } catch (error) {
    console.error("プロジェクト一括削除失敗: ", error);
    throw error;
  }
};

// ■ 特定のプロジェクトの「安全管理計画表」だけを探す機能
export const fetchSafetyPlansByProject = async (projectName: string): Promise<SavedDraft[]> => {
  try {
    const allDrafts = await fetchDrafts();
    const matchedPlans = allDrafts.filter(draft => 
      draft.type === 'SAFETY_PLAN' && 
      draft.data.project === projectName
    );
    return matchedPlans;
  } catch (error) {
    console.error("安全管理計画表の検索に失敗しました: ", error);
    throw error;
  }
};

// --- ★以下、新規追加: 社員データ管理機能 ---

// ■ 社員データを全件取得する
export const fetchEmployees = async (): Promise<EmployeeData[]> => {
  try {
    const snapshot = await getDocs(collection(db, EMPLOYEES_COLLECTION));
    const employees: EmployeeData[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      // FirestoreのデータとIDを結合
      employees.push({ ...data, id: doc.id } as EmployeeData);
    });
    
    // フリガナ順にソート（カナがない場合は空文字扱いで後ろへ）
    return employees.sort((a, b) => {
      const kanaA = (a.furiganaSei || "") + (a.furiganaMei || "");
      const kanaB = (b.furiganaSei || "") + (b.furiganaMei || "");
      return kanaA.localeCompare(kanaB, 'ja');
    });
  } catch (error) {
    console.error("社員データの取得失敗:", error);
    return [];
  }
};

// ■ 社員データを保存する（新規・更新）
export const saveEmployee = async (employee: EmployeeData): Promise<void> => {
  try {
    // IDがなければ新規作成(timestamp)、あれば更新
    const id = employee.id || Date.now().toString();
    const docRef = doc(db, EMPLOYEES_COLLECTION, id);
    
    // undefinedがあるとFirestoreでエラーになるためnull変換
    const dataToSave = JSON.parse(JSON.stringify({ ...employee, id }, (k, v) => v === undefined ? null : v));
    
    // マージ保存（既存フィールドを維持しつつ更新）
    await setDoc(docRef, dataToSave, { merge: true });
  } catch (error) {
    console.error("社員データの保存失敗:", error);
    throw error;
  }
};

// ■ 社員データを削除する
export const deleteEmployee = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, EMPLOYEES_COLLECTION, id));
  } catch (error) {
    console.error("社員データの削除失敗:", error);
    throw error;
  }
};
