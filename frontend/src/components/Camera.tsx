import { useRef, useState, useCallback, useEffect } from 'react';

interface CapturedPhoto {
  dataUrl: string;
  timestamp: number;
}

export default function Camera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [countdown, setCountdown] = useState<number | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsStreaming(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'カメラの起動に失敗しました';
      setError(message);
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setPhotos(prev => [...prev, { dataUrl, timestamp: Date.now() }]);
  }, []);

  const captureWithCountdown = useCallback(() => {
    setCountdown(3);
    let count = 3;

    const timer = setInterval(() => {
      count--;
      if (count === 0) {
        clearInterval(timer);
        setCountdown(null);
        capturePhoto();
      } else {
        setCountdown(count);
      }
    }, 1000);
  }, [capturePhoto]);

  const switchCamera = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, []);

  const deletePhoto = useCallback((index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  }, []);

  const downloadPhoto = useCallback((photo: CapturedPhoto) => {
    const link = document.createElement('a');
    link.href = photo.dataUrl;
    link.download = `encore_${new Date(photo.timestamp).toISOString()}.jpg`;
    link.click();
  }, []);

  useEffect(() => {
    if (isStreaming) {
      startCamera();
    }
  }, [facingMode]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div style={styles.container}>
      <div style={styles.cameraSection}>
        <div style={styles.viewfinder}>
          <video
            ref={videoRef}
            style={styles.video}
            playsInline
            muted
          />
          {countdown !== null && (
            <div style={styles.countdown}>{countdown}</div>
          )}
          {!isStreaming && (
            <div style={styles.placeholder}>
              <p>カメラが停止中です</p>
              <button onClick={startCamera} style={styles.btnPrimary}>
                カメラを起動
              </button>
            </div>
          )}
        </div>
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {error && (
          <div style={styles.error}>{error}</div>
        )}

        {isStreaming && (
          <div style={styles.controls}>
            <button onClick={switchCamera} style={styles.btnSecondary}>
              切替
            </button>
            <button onClick={captureWithCountdown} style={styles.captureBtn}>
              撮影
            </button>
            <button onClick={stopCamera} style={styles.btnSecondary}>
              停止
            </button>
          </div>
        )}
      </div>

      {photos.length > 0 && (
        <div style={styles.gallery}>
          <h3 style={styles.galleryTitle}>撮影した写真 ({photos.length})</h3>
          <div style={styles.photoGrid}>
            {photos.map((photo, index) => (
              <div key={photo.timestamp} style={styles.photoCard}>
                <img
                  src={photo.dataUrl}
                  alt={`撮影 ${index + 1}`}
                  style={styles.photoImg}
                />
                <div style={styles.photoActions}>
                  <button
                    onClick={() => downloadPhoto(photo)}
                    style={styles.photoBtn}
                  >
                    保存
                  </button>
                  <button
                    onClick={() => deletePhoto(index)}
                    style={{ ...styles.photoBtn, color: '#dc2626' }}
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
  },
  cameraSection: {
    marginBottom: '2rem',
  },
  viewfinder: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16 / 9',
    backgroundColor: '#111',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  placeholder: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    color: '#999',
  },
  countdown: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '6rem',
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  controls: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '1rem',
    marginTop: '1rem',
  },
  captureBtn: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    border: '3px solid #6366f1',
    backgroundColor: 'white',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  btnPrimary: {
    padding: '0.75rem 2rem',
    backgroundColor: '#6366f1',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.95rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  btnSecondary: {
    padding: '0.5rem 1rem',
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  error: {
    padding: '0.75rem',
    marginTop: '1rem',
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    fontSize: '0.85rem',
  },
  gallery: {
    marginTop: '1rem',
  },
  galleryTitle: {
    fontSize: '1.1rem',
    marginBottom: '1rem',
  },
  photoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '1rem',
  },
  photoCard: {
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  photoImg: {
    width: '100%',
    aspectRatio: '16 / 9',
    objectFit: 'cover',
  },
  photoActions: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.5rem',
  },
  photoBtn: {
    padding: '0.25rem 0.75rem',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '0.8rem',
    color: '#6366f1',
    fontWeight: '500',
  },
};
