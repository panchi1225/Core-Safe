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
import { SavedDraft, MasterData, INITIAL_MASTER_DATA, EmployeeData, DiagramImage } from '../types';

const DRAFTS_COLLECTION = 'drafts';
const MASTER_COLLECTION = 'masterData';
const MASTER_DOC_ID = 'general';
const EMPLOYEES_COLLECTION = 'employees';
const DIAGRAM_IMAGES_COLLECTION = 'diagramImages'; // 配置図元画像コレクション

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
// ★修正: equipment のフォールバック処理を追加、safetyInstructionItems のフォールバック処理を追加
export const getMasterData = async (): Promise<MasterData> => {
  try {
    const docRef = doc(db, MASTER_COLLECTION, MASTER_DOC_ID);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as Partial<MasterData>;
      
      // ★訓練内容(topics)を新しい初期値で強制上書き
      // （※Firestoreには保存しないが、アプリ上では新しい値を使う）
      // もしFirestoreも更新したい場合は、ここで saveMasterData を呼ぶことも可能ですが、
      // 読み込みのたびに書き込むのは負荷が高いため、今回は「取得したデータに上書きして返す」だけに留めます。
      // これにより、画面上では新しいリストが表示され、ユーザーが何か変更して保存したタイミングでFirestoreも更新されます。
      
      const mergedData: MasterData = {
        projects: data.projects || INITIAL_MASTER_DATA.projects,
        workplaces: data.workplaces || INITIAL_MASTER_DATA.workplaces,
        contractors: data.contractors || INITIAL_MASTER_DATA.contractors,
        supervisors: data.supervisors || INITIAL_MASTER_DATA.supervisors,
        locations: data.locations || INITIAL_MASTER_DATA.locations,
        roles: data.roles || INITIAL_MASTER_DATA.roles,
        topics: INITIAL_MASTER_DATA.topics,
        jobTypes: data.jobTypes || INITIAL_MASTER_DATA.jobTypes,
        goals: data.goals || INITIAL_MASTER_DATA.goals,
        predictions: data.predictions || INITIAL_MASTER_DATA.predictions,
        countermeasures: data.countermeasures || INITIAL_MASTER_DATA.countermeasures,
        subcontractors: data.subcontractors || INITIAL_MASTER_DATA.subcontractors,
        processes: data.processes || INITIAL_MASTER_DATA.processes,
        cautions: data.cautions || INITIAL_MASTER_DATA.cautions,
        // --- 安全衛生日誌用マスタ ---
        machines: data.machines || INITIAL_MASTER_DATA.machines,
        equipment: data.equipment || INITIAL_MASTER_DATA.equipment,
        safetyInstructionItems: data.safetyInstructionItems || INITIAL_MASTER_DATA.safetyInstructionItems,
      };

      return mergedData;
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

// ■ 画像圧縮ヘルパー（既存：他の帳票で使用、変更不可）
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

// ■ 配置図専用の画像圧縮関数
// MAX_WIDTH: 600px、JPEG品質: 0.4（ファイルサイズ削減を優先、1枚あたり約30〜80KB目標）
export const compressDiagramImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        // 元画像が MAX_WIDTH 以下の場合はそのままのサイズを使用
        const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        resolve(canvas.toDataURL('image/jpeg', 0.4));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

// ============================
// 配置図元画像管理機能
// ============================

// ■ 配置図元画像をFirestoreに保存する
export const saveDiagramImage = async (
  projectName: string,
  imageDataUrl: string,
  fileName: string
): Promise<void> => {
  try {
    await addDoc(collection(db, DIAGRAM_IMAGES_COLLECTION), {
      projectName,
      imageDataUrl,
      fileName,
      createdAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("配置図元画像の保存に失敗しました: ", error);
    throw error;
  }
};

// ■ 指定した現場名の配置図元画像を全件取得する（createdAt降順）
export const fetchDiagramImages = async (projectName: string): Promise<DiagramImage[]> => {
  try {
    const snapshot = await getDocs(collection(db, DIAGRAM_IMAGES_COLLECTION));
    const images: DiagramImage[] = [];
    
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      // projectName でフィルタ
      if (data.projectName === projectName) {
        images.push({
          id: docSnap.id,
          projectName: data.projectName,
          imageDataUrl: data.imageDataUrl,
          fileName: data.fileName,
          // Timestamp → ミリ秒タイムスタンプに変換
          createdAt: data.createdAt instanceof Timestamp
            ? data.createdAt.toMillis()
            : data.createdAt,
        });
      }
    });

    // createdAt の降順（新しい順）でソート
    images.sort((a, b) => b.createdAt - a.createdAt);
    
    return images;
  } catch (error) {
    console.error("配置図元画像の取得に失敗しました: ", error);
    throw error;
  }
};

// ■ 配置図元画像を1件削除する
export const removeDiagramImage = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, DIAGRAM_IMAGES_COLLECTION, id));
  } catch (error) {
    console.error("配置図元画像の削除に失敗しました: ", error);
    throw error;
  }
};

// ■ 指定した現場名の配置図元画像を全件削除する（writeBatch使用）
export const deleteDiagramImagesByProject = async (projectName: string): Promise<void> => {
  try {
    const snapshot = await getDocs(collection(db, DIAGRAM_IMAGES_COLLECTION));
    const batch = writeBatch(db);
    let count = 0;

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.projectName === projectName) {
        batch.delete(docSnap.ref);
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`[deleteDiagramImagesByProject] ${projectName} の配置図元画像 ${count} 件を削除しました`);
    }
  } catch (error) {
    console.error("配置図元画像の一括削除に失敗しました: ", error);
    throw error;
  }
};

// ■ プロジェクト関連データの一括削除
// ★修正: 一時保存データに加えて、配置図元画像もすべて削除する
export const deleteDraftsByProject = async (projectName: string): Promise<void> => {
  try {
    // (1) 一時保存データの削除
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

    // (2) 配置図元画像の削除
    await deleteDiagramImagesByProject(projectName);
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

// --- 社員データ管理機能 ---

// ■ 社員データを全件取得する
export const fetchEmployees = async (): Promise<EmployeeData[]> => {
  try {
    const snapshot = await getDocs(collection(db, EMPLOYEES_COLLECTION));
    const employees: EmployeeData[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      employees.push({ ...data, id: doc.id } as EmployeeData);
    });
    
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
    const id = employee.id || Date.now().toString();
    const docRef = doc(db, EMPLOYEES_COLLECTION, id);
    const dataToSave = JSON.parse(JSON.stringify({ ...employee, id }, (k, v) => v === undefined ? null : v));
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
