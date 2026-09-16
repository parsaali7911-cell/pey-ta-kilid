/** Shared mobile / in-app browser helpers for camera and mic. */

export function isMobileUa(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
}

export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Instagram|FBAN|FBAV|Line\/|WhatsApp|Telegram|Twitter|Snapchat|TikTok|LinkedInApp|MicroMessenger|WeChat/i.test(
    navigator.userAgent,
  );
}

export function hasSpeechRecognition(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function pickAudioRecorderMime(): string {
  const candidates = isIosSafari()
    ? ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/aac']
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return 'audio/webm';
}
