import { useRef, useState, useCallback, useEffect } from 'react';

// --- 状態 ---
type Phase =
  | 'idle'        // カメラ停止
  | 'waiting'     // カメラ起動済み、受付待ち
  | 'countdown'   // 受付後5秒カウントダウン
  | 'shooting'    // 撮影中（30秒）
  | 'ended';      // 撮影終了

interface CapturedPhoto {
  dataUrl: string;
  timestamp: number;
}

// --- チャイム音を Web Audio API で生成 ---
function playChime() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // 2音のチャイム（ピンポーン）
    [880, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.4, now + i * 0.35);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.35 + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.35);
      osc.stop(now + i * 0.35 + 0.8);
    });
  } catch {
    // AudioContext が使えない場合は無視
  }
}

export default function Camera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [countdown, setCountdown] = useState(0);       // 受付後カウントダウン
  const [remaining, setRemaining] = useState(30);       // 撮影残り秒数
  const [slideX, setSlideX] = useState(0);              // 受付スライドの位置
  const [warning, setWarning] = useState<string | null>(null); // 画面警告テキスト

  const slideTrackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startTouchX = useRef(0);

  // --- カメラ起動 ---
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1080 },
          height: { ideal: 1920 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setPhase('waiting');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'カメラの起動に失敗しました');
    }
  }, [facingMode]);

  // --- カメラ切替 ---
  const switchCamera = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, []);

  // facingMode 変更時にカメラ再起動
  useEffect(() => {
    if (phase === 'waiting') {
      startCamera();
    }
  }, [facingMode]);

  // --- 撮影 ---
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    // ビューファインダーの表示領域（縦長）に合わせてクロップ
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const viewEl = video.parentElement;
    const displayW = viewEl?.clientWidth ?? vw;
    const displayH = viewEl?.clientHeight ?? vh;
    const targetRatio = displayW / displayH; // 縦長フレームのアスペクト比

    let sx = 0, sy = 0, sw = vw, sh = vh;
    const videoRatio = vw / vh;

    if (videoRatio > targetRatio) {
      // 映像が横長 → 左右をクロップ
      sw = Math.round(vh * targetRatio);
      sx = Math.round((vw - sw) / 2);
    } else {
      // 映像が縦長 → 上下をクロップ
      sh = Math.round(vw / targetRatio);
      sy = Math.round((vh - sh) / 2);
    }

    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    // デモ: スマホに自動保存（ダウンロード）
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `encore_${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
    link.click();

    setPhotos(prev => [...prev, { dataUrl, timestamp: Date.now() }]);
  }, []);

  // --- 受付完了 → 5秒カウントダウン → 撮影開始 ---
  const startCountdown = useCallback(() => {
    setPhase('countdown');
    setCountdown(5);
    let count = 5;
    const timer = setInterval(() => {
      count--;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(timer);
        setPhase('shooting');
        setRemaining(30);
      }
    }, 1000);
  }, []);

  // --- 撮影タイマー（30秒）---
  useEffect(() => {
    if (phase !== 'shooting') return;

    setWarning(null);
    let sec = 30;
    timerRef.current = setInterval(() => {
      sec--;
      setRemaining(sec);

      if (sec === 10) setWarning('残り10秒');
      else if (sec === 5) setWarning('残り5秒');
      else if (sec > 5 && sec < 10) setWarning(null);

      if (sec <= 0) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        setPhase('ended');
        setWarning('撮影終了');
        playChime();
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  // --- クリーンアップ ---
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // --- リセット（もう一度） ---
  const resetSession = useCallback(() => {
    setPhase('waiting');
    setSlideX(0);
    setRemaining(30);
    setWarning(null);
    setCountdown(0);
    setPhotos([]);
  }, []);

  // --- 受付スライドのタッチハンドラ ---
  const trackWidth = () => (slideTrackRef.current?.offsetWidth ?? 280) - 56;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    isDragging.current = true;
    startTouchX.current = e.touches[0].clientX - slideX;
  }, [slideX]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const x = Math.max(0, Math.min(e.touches[0].clientX - startTouchX.current, trackWidth()));
    setSlideX(x);
  }, []);

  const onTouchEnd = useCallback(() => {
    isDragging.current = false;
    if (slideX >= trackWidth() * 0.85) {
      setSlideX(trackWidth());
      startCountdown();
    } else {
      setSlideX(0);
    }
  }, [slideX, startCountdown]);

  // マウス対応（PCでもテスト可能に）
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startTouchX.current = e.clientX - slideX;
    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const x = Math.max(0, Math.min(ev.clientX - startTouchX.current, trackWidth()));
      setSlideX(x);
    };
    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      setSlideX(prev => {
        if (prev >= trackWidth() * 0.85) {
          startCountdown();
          return trackWidth();
        }
        return 0;
      });
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [slideX, startCountdown]);

  // --- 残り秒の色 ---
  const timerColor = remaining <= 5 ? '#ef4444' : remaining <= 10 ? '#f59e0b' : '#fff';

  return (
    <div style={S.wrapper}>
      {/* ヘッダー */}
      <div style={S.header}>
        <a href="/dashboard" style={S.backLink}>&larr; 戻る</a>
        <span style={S.title}>特典会撮影機能デモ</span>
        {phase !== 'idle' && (
          <button onClick={switchCamera} style={S.switchBtn}>切替</button>
        )}
      </div>

      {/* ビューファインダー（縦長・フルスクリーン） */}
      <div style={S.viewfinder}>
        <video ref={videoRef} style={S.video} playsInline muted />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* カメラ未起動 */}
        {phase === 'idle' && (
          <div style={S.overlay}>
            <p style={{ color: '#ccc', marginBottom: '1rem', fontSize: '0.9rem' }}>特典会撮影のデモです</p>
            <button onClick={startCamera} style={S.btnStart}>カメラを起動</button>
          </div>
        )}

        {/* 受付後カウントダウン */}
        {phase === 'countdown' && (
          <div style={S.overlayCountdown}>
            <div style={S.bigNumber}>{countdown}</div>
            <p style={{ color: '#fff', fontSize: '1rem' }}>撮影開始まで</p>
          </div>
        )}

        {/* 撮影中タイマー */}
        {phase === 'shooting' && (
          <div style={S.timerBar}>
            <span style={{ ...S.timerText, color: timerColor }}>{remaining}s</span>
          </div>
        )}

        {/* 警告テキスト（10秒前、5秒前） */}
        {warning && phase === 'shooting' && (
          <div style={S.warningOverlay}>{warning}</div>
        )}

        {/* 撮影終了 */}
        {phase === 'ended' && (
          <div style={S.overlayEnded}>
            <div style={S.endedText}>撮影終了</div>
            <button onClick={resetSession} style={S.btnRestart}>もう一度</button>
          </div>
        )}
      </div>

      {/* コントロール部分 */}
      <div style={S.controlArea}>
        {/* 受付スライドボタン（waiting時のみ） */}
        {phase === 'waiting' && (
          <div style={S.slideTrack} ref={slideTrackRef}>
            <div style={S.slideLabel}>スライドで受付</div>
            <div
              style={{ ...S.slideThumb, transform: `translateX(${slideX}px)` }}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onMouseDown={onMouseDown}
            >
              &rsaquo;&rsaquo;
            </div>
          </div>
        )}

        {/* シャッターボタン（shooting時のみ） */}
        {phase === 'shooting' && (
          <button onClick={capturePhoto} style={S.captureBtn}>
            <div style={S.captureBtnInner} />
          </button>
        )}
      </div>

      {/* 撮影した写真プレビュー */}
      {photos.length > 0 && (
        <div style={S.gallery}>
          <h3 style={S.galleryTitle}>撮影した写真 ({photos.length})</h3>
          <div style={S.photoGrid}>
            {photos.map((photo, i) => (
              <div key={photo.timestamp} style={S.photoCard}>
                <img src={photo.dataUrl} alt={`撮影 ${i + 1}`} style={S.photoImg} />
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <div style={S.error}>{error}</div>}
    </div>
  );
}

// --- スタイル ---
const S: Record<string, React.CSSProperties> = {
  wrapper: {
    maxWidth: '430px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100dvh',
    background: '#000',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.5rem 0.75rem',
    background: '#111',
    color: '#fff',
    flexShrink: 0,
  },
  backLink: {
    color: '#aaa',
    fontSize: '0.8rem',
    textDecoration: 'none',
  },
  title: {
    fontSize: '0.85rem',
    fontWeight: '600',
  },
  switchBtn: {
    padding: '0.25rem 0.75rem',
    border: '1px solid #555',
    borderRadius: '4px',
    background: 'transparent',
    color: '#ccc',
    fontSize: '0.75rem',
    cursor: 'pointer',
  },

  // ビューファインダー：縦長で画面いっぱい
  viewfinder: {
    position: 'relative',
    flex: 1,
    minHeight: 0,
    background: '#000',
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },

  // オーバーレイ
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.7)',
  },
  overlayCountdown: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.6)',
  },
  bigNumber: {
    fontSize: '8rem',
    fontWeight: '900',
    color: '#fff',
    lineHeight: 1,
  },
  overlayEnded: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.75)',
    gap: '1.5rem',
  },
  endedText: {
    fontSize: '2.5rem',
    fontWeight: '900',
    color: '#ef4444',
    textShadow: '0 2px 12px rgba(239,68,68,0.5)',
  },
  btnRestart: {
    padding: '0.75rem 2rem',
    border: '1px solid #fff',
    borderRadius: '9999px',
    background: 'transparent',
    color: '#fff',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
  },

  // タイマーバー
  timerBar: {
    position: 'absolute',
    top: '0.75rem',
    right: '0.75rem',
    background: 'rgba(0,0,0,0.5)',
    borderRadius: '8px',
    padding: '0.25rem 0.75rem',
  },
  timerText: {
    fontSize: '1.5rem',
    fontWeight: '800',
    fontVariantNumeric: 'tabular-nums',
  },

  // 警告オーバーレイ
  warningOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '2.5rem',
    fontWeight: '900',
    color: '#f59e0b',
    textShadow: '0 2px 12px rgba(0,0,0,0.7)',
    pointerEvents: 'none',
  },

  // コントロールエリア
  controlArea: {
    flexShrink: 0,
    padding: '1rem',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '80px',
    background: '#111',
  },

  // スライド受付ボタン
  slideTrack: {
    position: 'relative',
    width: '280px',
    height: '56px',
    borderRadius: '28px',
    background: 'linear-gradient(90deg, #059669, #10b981)',
    overflow: 'hidden',
    userSelect: 'none',
    touchAction: 'none',
  },
  slideLabel: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '0.9rem',
    fontWeight: '600',
    letterSpacing: '0.05em',
    pointerEvents: 'none',
  },
  slideThumb: {
    position: 'absolute',
    top: '4px',
    left: '4px',
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#059669',
    cursor: 'grab',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
    transition: 'none',
  },

  // シャッターボタン
  captureBtn: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    border: '4px solid #fff',
    background: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  captureBtnInner: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: '#fff',
  },

  // カメラ起動ボタン
  btnStart: {
    padding: '0.75rem 2rem',
    backgroundColor: '#6366f1',
    color: 'white',
    border: 'none',
    borderRadius: '9999px',
    fontSize: '0.95rem',
    fontWeight: '600',
    cursor: 'pointer',
  },

  // ギャラリー
  gallery: {
    padding: '1rem',
    background: '#111',
  },
  galleryTitle: {
    fontSize: '0.9rem',
    color: '#ccc',
    marginBottom: '0.75rem',
  },
  photoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.5rem',
  },
  photoCard: {
    borderRadius: '4px',
    overflow: 'hidden',
  },
  photoImg: {
    width: '100%',
    aspectRatio: '3 / 4',
    objectFit: 'cover',
    display: 'block',
  },

  error: {
    padding: '0.75rem',
    margin: '0.5rem',
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    fontSize: '0.85rem',
  },
};
