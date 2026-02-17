import { MasterData, INITIAL_MASTER_DATA, SavedDraft, ReportTypeString } from '../types';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, deleteDoc, 
  onSnapshot, query, orderBy
} from 'firebase/firestore';

// --- FIREBASE CONFIGURATION ---
// ユーザーより提供された設定値を適用
const firebaseConfig = {
  apiKey: "AIzaSyCYT45WYMTTCpp3MDvUShT1yEwz-x9mYWQ",
  authDomain: "core-safe.firebaseapp.com",
  projectId: "core-safe",
  storageBucket: "core-safe.firebasestorage.app",
  messagingSenderId: "538945747105",
  appId: "1:538945747105:web:09373b659159a8b8c618e0"
};

// Initialize Firebase
let db: any;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  console.log("Firebase connected successfully to project: core-safe");
} catch (e) {
  console.error("Firebase Initialization Error:", e);
}

// Collection References
const MASTER_COLLECTION = 'masterData';
const DRAFTS_COLLECTION = 'drafts';

// --- In-Memory Cache for Synchronous UI Access ---
let _cachedMasterData: MasterData = { ...INITIAL_MASTER_DATA };
let _cachedDrafts: SavedDraft[] = [];

// Initialize Data from LocalStorage (Offline / Startup Cache)
const loadFromLocal = () => {
  try {
    const localMaster = localStorage.getItem('master_cache');
    if (localMaster) {
      _cachedMasterData = { ...INITIAL_MASTER_DATA, ...JSON.parse(localMaster) };
    }
    const localDrafts = localStorage.getItem('drafts_cache');
    if (localDrafts) {
      _cachedDrafts = JSON.parse(localDrafts);
    }
  } catch (e) {
    console.error("LocalStorage load failed", e);
  }
};

loadFromLocal();

// --- Real-time Sync Listeners ---
if (db) {
  // 1. Master Data Listener
  onSnapshot(doc(db, MASTER_COLLECTION, 'main'), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data() as MasterData;
      _cachedMasterData = { ...INITIAL_MASTER_DATA, ...data };
      localStorage.setItem('master_cache', JSON.stringify(_cachedMasterData));
    }
  }, (error) => {
      console.warn("Firestore access error (Master):", error);
  });

  // 2. Drafts Listener
  const q = query(collection(db, DRAFTS_COLLECTION), orderBy('lastModified', 'desc'));
  onSnapshot(q, (snapshot) => {
    const drafts: SavedDraft[] = [];
    snapshot.forEach((doc) => {
      drafts.push(doc.data() as SavedDraft);
    });
    _cachedDrafts = drafts;
    localStorage.setItem('drafts_cache', JSON.stringify(drafts));
  }, (error) => {
      console.warn("Firestore access error (Drafts):", error);
  });
}

// --- Master Data Services ---

export const getMasterData = (): MasterData => {
  return _cachedMasterData;
};

export const saveMasterData = async (data: MasterData) => {
  // Optimistic Update (即時反映)
  _cachedMasterData = data;
  localStorage.setItem('master_cache', JSON.stringify(data));

  // Sync to Cloud
  if (db) {
    try {
      await setDoc(doc(db, MASTER_COLLECTION, 'main'), data);
    } catch (e) {
      console.error("Error saving master to cloud:", e);
      alert("クラウドへの保存に失敗しました。設定を確認してください。");
    }
  }
};

// --- Draft Services ---

export const getDrafts = (): SavedDraft[] => {
  return _cachedDrafts;
};

/**
 * 重要：データ軽量化関数
 * - 現場写真(photoUrl)は容量が大きいため、保存時に削除します（印刷PCで挿入する運用のため）。
 * - 署名(signatureDataUrl)はテキストとして扱えるサイズのため保持します。
 */
const stripHeavyImages = (data: any, type: ReportTypeString): any => {
  // データのディープコピーを作成
  const cleaned = JSON.parse(JSON.stringify(data));

  // 安全訓練報告書の現場写真を削除
  if (type === 'SAFETY_TRAINING' && cleaned.photoUrl) {
    cleaned.photoUrl = null; 
  }

  // 他のレポートタイプでも画像があればここで削除処理を追加可能
  // 現状はSAFETY_TRAININGのみphotoUrlを使用

  return cleaned;
};

export const saveDraft = (draftId: string | null, type: ReportTypeString, data: any): string => {
  const timestamp = Date.now();
  const id = draftId || timestamp.toString();

  // 1. 保存用データを作成（ここで写真を削除）
  const cloudData = stripHeavyImages(data, type);
  
  const draftDoc: SavedDraft = {
    id,
    type,
    lastModified: timestamp,
    data: cloudData
  };

  // 2. ローカルキャッシュを更新
  // 注意：LocalStorageの容量エラーも防ぐため、ローカル保存分も写真を削除した状態にします。
  const existingIdx = _cachedDrafts.findIndex(d => d.id === id);
  if (existingIdx >= 0) {
      _cachedDrafts[existingIdx] = draftDoc;
  } else {
      _cachedDrafts.unshift(draftDoc);
  }
  
  try {
    localStorage.setItem('drafts_cache', JSON.stringify(_cachedDrafts));
  } catch(e) {
    console.warn("LocalStorage full, but proceeding to cloud save.");
  }

  // 3. Firestoreへ保存
  if (db) {
    // 非同期で保存（UIをブロックしない）
    setDoc(doc(db, DRAFTS_COLLECTION, id), draftDoc).catch(e => {
      console.error("Cloud save failed:", e);
      alert("クラウドへの保存に失敗しました。インターネット接続を確認してください。");
    });
  }

  return id;
};

export const deleteDraft = async (id: string) => {
  // Optimistic Update
  _cachedDrafts = _cachedDrafts.filter(d => d.id !== id);
  localStorage.setItem('drafts_cache', JSON.stringify(_cachedDrafts));

  // Sync to Cloud
  if (db) {
    try {
      await deleteDoc(doc(db, DRAFTS_COLLECTION, id));
    } catch (e) {
      console.error("Cloud delete failed:", e);
    }
  }
};

export const deleteDraftsByProject = async (projectName: string) => {
  const toDeleteIds = _cachedDrafts
    .filter(d => d.data.project === projectName)
    .map(d => d.id);

  // Optimistic Update
  _cachedDrafts = _cachedDrafts.filter(d => d.data.project !== projectName);
  localStorage.setItem('drafts_cache', JSON.stringify(_cachedDrafts));

  // Sync to Cloud
  if (db) {
    toDeleteIds.forEach(async (id) => {
      try {
        await deleteDoc(doc(db, DRAFTS_COLLECTION, id));
      } catch(e) {
        console.error("Delete draft failed", e);
      }
    });
  }
};

// --- Image Services ---

export const compressImage = async (file: File): Promise<string> => {
  return new Promise((resolve) => {
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
        // Compress to JPEG 0.7
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    };
  });
};