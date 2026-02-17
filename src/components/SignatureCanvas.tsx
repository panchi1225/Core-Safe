
import React, { useRef, useState, useEffect } from 'react';

interface Props {
  onSave: (dataUrl: string) => void;
  onClear: () => void;
  lineWidth?: number;
  keepOpenOnSave?: boolean;
}

const SignatureCanvas: React.FC<Props> = ({ onSave, onClear, lineWidth = 3.5, keepOpenOnSave = false }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Pen Only Mode state
  const [usePenMode, setUsePenMode] = useState(false);
  
  // Canvas dimensions state
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Orientation state for auto-landscape
  const [isPortrait, setIsPortrait] = useState(false);

  // Check orientation on resize
  useEffect(() => {
    const checkOrientation = () => {
      // Treat as portrait if height > width
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  // Handle resizing of the canvas when modal opens or window resizes
  useEffect(() => {
    if (!isModalOpen || !containerRef.current) return;

    // Wait for the layout to settle
    const timer = setTimeout(() => {
      const updateSize = () => {
        if (containerRef.current) {
          const dpr = window.devicePixelRatio || 1;
          // clientWidth/Height respect the CSS rotation and flexbox constraints
          const width = Math.floor(containerRef.current.clientWidth * dpr);
          const height = Math.floor(containerRef.current.clientHeight * dpr);
          
          if (width > 0 && height > 0) {
            setCanvasSize({ width, height });
          }
        }
      };
      updateSize();
    }, 300);

    return () => clearTimeout(timer);
  }, [isModalOpen, isPortrait]);

  // Update canvas context properties
  useEffect(() => {
    if (!isModalOpen || canvasSize.width === 0) return;
    
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#000';
      }
    }
  }, [canvasSize, isModalOpen, lineWidth]);

  /**
   * getPos:
   * マウス・タッチ座標をCanvas内のローカル座標（ピクセル単位）に変換します。
   */
  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX;
    const cy = e.clientY;

    const dx = cx - rect.left;
    const dy = cy - rect.top;

    if (isPortrait) {
      // 縦持ち(UIは90度回転)時のマッピング
      return {
        x: (dy / rect.height) * canvas.width,
        y: (1 - (dx / rect.width)) * canvas.height
      };
    } else {
      // 通常時
      return {
        x: (dx / rect.width) * canvas.width,
        y: (dy / rect.height) * canvas.height
      };
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (usePenMode && e.pointerType !== 'pen') return;
    
    // イベントのデフォルト挙動を抑制（選択やメニュー表示の防止）
    e.preventDefault();
    e.stopPropagation();
    
    setIsDrawing(true);
    (e.target as Element).setPointerCapture(e.pointerId);
    const pos = getPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    ctx?.beginPath();
    ctx?.moveTo(pos.x, pos.y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    if (usePenMode && e.pointerType !== 'pen') return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const pos = getPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    ctx?.lineTo(pos.x, pos.y);
    ctx?.stroke();
    if (!hasSignature) setHasSignature(true);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasSignature(false);
  };

  const handleSaveAndClose = () => {
    if (canvasRef.current && hasSignature) {
      const canvas = canvasRef.current;
      
      const sourceX = 0;
      const sourceY = canvas.height * 0.25; 
      const sourceWidth = canvas.width;
      const sourceHeight = canvas.height * 0.5; 

      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = sourceWidth;
      outputCanvas.height = sourceHeight;

      const ctx = outputCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(
            canvas, 
            sourceX, sourceY, sourceWidth, sourceHeight, 
            0, 0, outputCanvas.width, outputCanvas.height
        );
        onSave(outputCanvas.toDataURL('image/png'));
      }

      if (keepOpenOnSave) {
        handleClearCanvas();
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        setIsModalOpen(false);
      }
    }
  };

  if (!isModalOpen) {
    return (
      <div 
        onClick={() => setIsModalOpen(true)}
        className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 hover:border-blue-300 bg-white text-gray-500 transition-all group"
      >
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-2 group-hover:bg-blue-100 transition-colors">
            <i className="fa-solid fa-pen-nib text-xl text-gray-400 group-hover:text-blue-500"></i>
        </div>
        <span className="font-bold text-sm group-hover:text-blue-600">タップして署名を記入</span>
      </div>
    );
  }

  const modalContainerClass = isPortrait
    ? "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100dvh] h-[100dvw] rotate-90 origin-center"
    : "fixed inset-0 w-full h-full";

  return (
    <div 
      className="fixed inset-0 z-[100] bg-gray-900 bg-opacity-95 select-none touch-none" 
      onContextMenu={(e) => e.preventDefault()}
      style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
    >
      <div className={`${modalContainerClass} bg-white flex flex-col overflow-hidden shadow-2xl relative select-none`}>
        
        {saveSuccess && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] bg-gray-800 bg-opacity-90 text-white px-8 py-6 rounded-xl shadow-2xl animate-fade-in flex flex-col items-center backdrop-blur-sm pointer-events-none">
                <i className="fa-solid fa-check-circle text-5xl text-green-400 mb-4"></i>
                <span className="font-bold text-xl mb-1">保存しました</span>
                <span className="text-sm text-gray-300">続けて次の署名をお願いします</span>
            </div>
        )}

        <div className="bg-gray-100 flex-none border-b shadow-sm z-20 select-none">
            <div className="relative flex justify-between items-center px-4 py-4 border-b border-gray-200 bg-white min-h-[72px]">
                <button
                    type="button"
                    onClick={() => { setIsModalOpen(false); onClear(); }}
                    className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 border border-gray-300 z-10 relative"
                >
                    閉じる
                </button>
                
                <h3 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-bold text-lg text-gray-800 hidden sm:flex items-center justify-center pointer-events-none">
                    <i className="fa-solid fa-pen-nib mr-2 text-gray-500"></i>署名記入
                </h3>

                <div className="flex items-center gap-2 z-10 relative">
                    <button
                        type="button"
                        onClick={handleClearCanvas}
                        className="px-3 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg flex items-center border border-red-200 transition-colors"
                    >
                        <i className="fa-solid fa-eraser mr-1"></i> <span className="hidden sm:inline">書き直し</span><span className="sm:hidden">消去</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleSaveAndClose}
                        disabled={!hasSignature}
                        className={`px-4 py-2 text-sm font-bold rounded-lg flex items-center shadow-sm transition-colors ${
                            hasSignature ? 'bg-blue-600 text-white active:scale-95 hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                    >
                        <i className="fa-solid fa-check mr-1"></i> 確定
                    </button>
                </div>
            </div>

            <div className="relative flex justify-end items-center px-4 py-3 bg-gray-50">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-red-600 text-sm font-bold flex items-center pointer-events-none whitespace-nowrap">
                    <i className="fa-solid fa-circle-exclamation mr-1"></i>
                    <span className="hidden sm:inline">必ずフルネームで記入してください</span>
                    <span className="sm:hidden">フルネーム記入</span>
                </div>

                <label className={`
                  flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold cursor-pointer transition-colors shadow-sm select-none border-2 z-10 relative bg-white
                  ${usePenMode 
                    ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700' 
                    : 'bg-green-600 text-white border-green-700 hover:bg-green-700'}
                `}>
                  <input type="checkbox" className="hidden" checked={usePenMode} onChange={(e) => setUsePenMode(e.target.checked)} />
                  <i className={`fa-solid ${usePenMode ? 'fa-pen-fancy' : 'fa-hand-pointer'} text-lg`}></i>
                  <span>{usePenMode ? 'ペン' : '指'}</span>
                </label>
            </div>
        </div>

        <div className="flex-1 min-h-0 bg-gray-50 p-2 sm:p-4 pb-8 sm:pb-8 flex flex-col select-none">
             <div 
               ref={containerRef} 
               className="flex-1 min-h-0 w-full bg-white border-2 border-gray-300 shadow-inner rounded-xl overflow-hidden touch-none relative select-none"
             >
                <div className="absolute inset-0 flex flex-col pointer-events-none select-none">
                    <div className="h-[25%] w-full bg-gray-100 opacity-60 border-b-2 border-dashed border-gray-400 flex items-end justify-center pb-1">
                       <span className="text-[10px] sm:text-xs text-gray-500 font-bold tracking-widest">枠外（記入不可。表示されません！）</span>
                    </div>

                    <div className="h-[50%] w-full flex items-center justify-center bg-transparent">
                        {!hasSignature && (
                            <div className="text-center text-gray-200">
                                <span className="text-4xl sm:text-6xl font-bold mb-2 block">署名エリア</span>
                                <span className="text-xs sm:text-lg font-bold">点線の中に大きく記入してください</span>
                                <div className="sm:hidden text-red-300 text-[10px] mt-1 font-bold">※必ずフルネームで記入してください</div>
                            </div>
                        )}
                    </div>

                    <div className="h-[25%] w-full bg-gray-100 opacity-60 border-t-2 border-dashed border-gray-400 flex items-start justify-center pt-1">
                       <span className="text-[10px] sm:text-xs text-gray-500 font-bold tracking-widest">枠外（記入不可。表示されません！）</span>
                    </div>
                </div>
                
                {canvasSize.width > 0 && (
                    <canvas
                        ref={canvasRef}
                        width={canvasSize.width}
                        height={canvasSize.height}
                        style={{ 
                            width: '100%', 
                            height: '100%', 
                            touchAction: 'none',
                            userSelect: 'none',
                            WebkitUserSelect: 'none',
                            WebkitTouchCallout: 'none'
                        }}
                        className="absolute inset-0 z-10 cursor-crosshair block touch-none select-none"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        onContextMenu={(e) => e.preventDefault()}
                    />
                )}
             </div>
        </div>

      </div>
    </div>
  );
};

export default SignatureCanvas;
