import { db } from '../firebase';
import { 
  collection, 
  getDocs, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  Timestamp,
  setDoc,     // ★ここが増えています
  addDoc,     // ★ここが増えています
  getDoc,     // ★ここが増えています
  writeBatch  // ★ここが増えています
} from 'firebase/firestore';
import { SavedDraft, MasterData, INITIAL_MASTER_DATA } from '../types';

const DRAFTS_COLLECTION = 'drafts';
const MASTER_COLLECTION = 'masterData';
const MASTER_DOC_ID = 'general';

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
// --- src/services/firebaseService.ts の一番下に追記 ---

// ■ 特定のプロジェクトの「安全管理計画表」だけを探す機能
export const fetchSafetyPlansByProject = async (projectName: string): Promise<SavedDraft[]> => {
  try {
    // 全件取得してからフィルタリング（Firestoreのインデックス問題を回避するため簡易的に実装）
    const allDrafts = await fetchDrafts();
    
    // 「タイプが安全管理計画表」かつ「プロジェクト名が一致するもの」だけを抜き出す
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
