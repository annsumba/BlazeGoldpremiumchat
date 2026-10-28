import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Send, Trash2, Loader2, ShieldAlert, RefreshCw, ExternalLink } from 'lucide-react';

type Props = {
  onPosted: () => void;
  /** Uploads the recorded blob and inserts a voice status row. */
  upload: (file: Blob) => Promise<void>;
};

type MicState = 'idle' | 'recording' | 'recorded' | 'denied' | 'unsupported' | 'iframe';

// Records a voice note with MediaRecorder, previews it, and posts it
// as a status. Handles mic permission with a clear allow/retry flow.
export const VoiceRecorder = ({ onPosted, upload }: Props) => {
  const [micState, setMicState] = useState<MicState>('idle');
  const [posting, setPosting] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const urlRef = useRef<string>('');
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const supported = typeof navigator !== 'undefined'
    && !!navigator.mediaDevices
    && !!navigator.mediaDevices.getUserMedia
    && typeof window !== 'undefined'
    && 'MediaRecorder' in window;

  // getUserMedia only works on a secure top-level document. Inside an
  // embedded preview iframe (e.g. bolt.new) the browser silently blocks
  // mic access, so the "Allow" prompt never appears. Detect that case up
  // front and tell the user to open the app in a new tab instead.
  const inIframe = typeof window !== 'undefined'
    && window.top !== window.self;

  useEffect(() => () => {
    stopTimer();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const start = async () => {
    setUploadError('');
    if (inIframe) { setMicState('iframe'); return; }
    if (!supported) { setMicState('unsupported'); return; }
    // Use the Permissions API to detect a blocked mic early when available.
    try {
      if (navigator.permissions?.query) {
        const perm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        if (perm.state === 'denied') { setMicState('denied'); return; }
      }
    } catch { /* Permissions API not supported — fall through to getUserMedia */ }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      mediaRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        blobRef.current = blob;
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = URL.createObjectURL(blob);
        setMicState('recorded');
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      setMicState('recording');
      setSeconds(0);
      stopTimer();
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        setMicState('denied');
      } else if (err?.name === 'NotFoundError' || err?.name === 'NotReadableError') {
        setMicState('unsupported');
      } else {
        setMicState('denied');
      }
    }
  };

  const stop = () => {
    if (mediaRef.current && mediaRef.current.state !== 'inactive') mediaRef.current.stop();
    setMicState('recorded');
    stopTimer();
  };

  const discard = () => {
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = ''; }
    blobRef.current = null;
    setMicState('idle');
    setSeconds(0);
  };

  const post = async () => {
    if (!blobRef.current) return;
    setPosting(true);
    setUploadError('');
    try {
      await upload(blobRef.current);
      discard();
      onPosted();
    } catch {
      setUploadError('Could not upload voice note. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (micState === 'iframe') {
    return (
      <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-5 flex flex-col items-center gap-3 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-500/15 flex items-center justify-center">
          <ShieldAlert size={24} className="text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-amber-300">Mic blocked in preview</p>
          <p className="text-xs text-gray-400 mt-1 max-w-[280px]">
            Voice recording needs microphone access, which is blocked inside this embedded preview. Open BlazeGold in a new tab to record your voice note.
          </p>
        </div>
        <button
          onClick={() => window.open(window.location.href, '_blank')}
          className="mt-1 px-4 py-2 rounded-full gold-bg text-ink-900 text-sm font-medium flex items-center gap-2 hover:scale-105 transition"
        >
          <ExternalLink size={15} /> Open BlazeGold in new tab
        </button>
      </div>
    );
  }

  if (micState === 'denied' || micState === 'unsupported') {
    const denied = micState === 'denied';
    return (
      <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-5 flex flex-col items-center gap-3 text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center">
          <ShieldAlert size={24} className="text-red-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-red-300">
            {denied ? 'Microphone blocked' : 'No microphone found'}
          </p>
          <p className="text-xs text-gray-400 mt-1 max-w-[260px]">
            {denied
              ? 'We need microphone access to record your voice note. Tap below to try again, and choose "Allow" when your browser asks.'
              : 'This device has no microphone available, or it could not be reached. Connect a mic and try again.'}
          </p>
        </div>
        {denied && (
          <button onClick={start} className="mt-1 px-4 py-2 rounded-full gold-bg text-ink-900 text-sm font-medium flex items-center gap-2 hover:scale-105 transition">
            <RefreshCw size={15} /> Allow microphone
          </button>
        )}
      </div>
    );
  }

  if (micState === 'recorded') {
    return (
      <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
        <audio ref={audioRef} src={urlRef.current} controls className="w-full" />
        <div className="flex items-center gap-2">
          <button onClick={discard} disabled={posting} className="flex-1 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 flex items-center justify-center gap-2 text-sm disabled:opacity-50">
            <Trash2 size={16} /> Discard
          </button>
          <button onClick={post} disabled={posting} className="flex-1 btn-gold py-2.5 flex items-center justify-center gap-2 text-sm disabled:opacity-50">
            {posting ? <><Loader2 size={16} className="animate-spin" /> Uploading...</> : <><Send size={16} /> Post voice (+5)</>}
          </button>
        </div>
        {uploadError && <p className="text-xs text-red-400 text-center">{uploadError}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col items-center gap-3">
      {micState === 'recording' ? (
        <>
          <div className="flex items-center gap-2 text-red-300">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="font-mono font-bold text-lg">{fmt(seconds)}</span>
          </div>
          <button onClick={stop} className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 transition">
            <Square size={24} fill="currentColor" />
          </button>
          <p className="text-xs text-gray-400">Tap to stop recording</p>
        </>
      ) : (
        <>
          <button onClick={start} className="w-16 h-16 rounded-full gold-bg text-ink-900 flex items-center justify-center shadow-gold-lg hover:scale-105 transition">
            <Mic size={26} />
          </button>
          <p className="text-xs text-gray-400">Record a voice note status</p>
        </>
      )}
    </div>
  );
};
