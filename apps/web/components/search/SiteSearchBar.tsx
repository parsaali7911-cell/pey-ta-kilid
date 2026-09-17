'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/lib/i18n-public';
import {
  readFileAsDataUrl,
  saveVisualSearchPayload,
  uploadVisualSearchImage,
} from '@/lib/visual-search';
import { browserSpeechRecognition, transcribeVoiceWithFallback } from '@/lib/voice-search';
import {
  hasSpeechRecognition,
  isInAppBrowser,
  isIosSafari,
  isMobileUa,
  pickAudioRecorderMime,
} from '@/lib/mobile-device';

const RECENT_KEY = 'peytakilid_recent_searches';
const MAX_RECENT = 4;

function loadRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecent(q: string) {
  const trimmed = q.trim();
  if (!trimmed) return;
  const next = [trimmed, ...loadRecent().filter((x) => x !== trimmed)].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

function SearchIcon() {
  return (
    <svg className="site-search-bar__svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.25" />
      <path d="M20 20L16 16" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg className="site-search-bar__svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8.5V18a1.5 1.5 0 001.5 1.5h13A1.5 1.5 0 0020 18V8.5A1.5 1.5 0 0018.5 7H15l-1.2-1.6A1 1 0 0012.94 5H8.06A1 1 0 007.2 5.4L6 7H4.5A1.5 1.5 0 003 8.5z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

function MicIcon({ active }: { active?: boolean }) {
  return (
    <svg className="site-search-bar__svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="9"
        y="4"
        width="6"
        height="11"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.25"
        fill={active ? 'currentColor' : 'none'}
      />
      <path
        d="M6 11a6 6 0 0012 0M12 17v3"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Homepage search bar — text / photo / voice → Search. */
export function SiteSearchBar({
  locale,
  copy,
  variant = 'header',
  showRecent = false,
  suggestions = [],
  initialQuery = '',
  placeholder,
  alwaysShowSuggestions = false,
}: {
  locale: Locale;
  copy: Record<string, string>;
  variant?: 'header' | 'hero' | 'inline';
  showRecent?: boolean;
  suggestions?: string[];
  initialQuery?: string;
  placeholder?: string;
  /** Hero: keep example chips visible (ChatGPT / Perplexity pattern). */
  alwaysShowSuggestions?: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [recent, setRecent] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState('');
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceErr, setVoiceErr] = useState('');
  const recorderStopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  const go = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) return;
      saveRecent(trimmed);
      setRecent(loadRecent());
      router.push(`/${locale}/search?q=${encodeURIComponent(trimmed)}`);
    },
    [locale, router],
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    go(query);
  }

  async function onPhotoSelected(file: File | null) {
    if (!file || photoBusy || voiceBusy || voiceRecording) return;
    if (isInAppBrowser()) {
      setPhotoErr(copy.search_photo_in_app || '');
      return;
    }
    setPhotoErr('');
    setPhotoBusy(true);
    try {
      const captionHint = query.trim();
      const [payload, previewDataUrl] = await Promise.all([
        uploadVisualSearchImage(file, locale, captionHint || undefined),
        readFileAsDataUrl(file).catch(() => null),
      ]);
      saveVisualSearchPayload({ ...payload, previewDataUrl });
      const qs = new URLSearchParams({ photo: '1' });
      if (captionHint) qs.set('q', captionHint);
      router.push(`/${locale}/search?${qs.toString()}`);
    } catch (err) {
      setPhotoErr(err instanceof Error ? err.message : copy.search_photo_failed || '');
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function toggleVoiceSearch() {
    if (photoBusy || voiceBusy) return;

    if (voiceRecording && recorderStopRef.current) {
      recorderStopRef.current();
      recorderStopRef.current = null;
      return;
    }

    setVoiceErr('');
    if (isInAppBrowser()) {
      setVoiceErr(copy.search_voice_in_app || '');
      return;
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setVoiceErr(copy.search_voice_unavailable || '');
      return;
    }

    if ((isIosSafari() || isMobileUa()) && hasSpeechRecognition()) {
      setVoiceRecording(true);
      setVoiceBusy(true);
      try {
        const text = await browserSpeechRecognition(locale);
        if (!text.trim()) {
          setVoiceErr(copy.search_voice_empty || '');
          return;
        }
        setQuery(text);
        go(text);
      } catch {
        setVoiceErr(copy.search_voice_failed || '');
      } finally {
        setVoiceRecording(false);
        setVoiceBusy(false);
      }
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceErr(copy.search_voice_unavailable || '');
      return;
    }

    setVoiceRecording(true);
    setVoiceBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickAudioRecorderMime();
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      recorderStopRef.current = () => {
        if (recorder.state !== 'inactive') recorder.stop();
      };

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setVoiceRecording(false);
        recorderStopRef.current = null;
        try {
          const blob = chunks.length ? new Blob(chunks, { type: mimeType }) : null;
          if (!blob?.size) {
            setVoiceErr(copy.search_voice_empty || '');
            return;
          }
          const result = await transcribeVoiceWithFallback(blob, locale);
          const text = result.query.trim();
          if (!text) {
            setVoiceErr(copy.search_voice_empty || '');
            return;
          }
          setQuery(text);
          go(text);
        } catch {
          setVoiceErr(copy.search_voice_failed || '');
        } finally {
          setVoiceBusy(false);
        }
      };

      recorder.start();
      window.setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop();
      }, 8000);
    } catch {
      setVoiceRecording(false);
      setVoiceBusy(false);
      recorderStopRef.current = null;
      setVoiceErr(copy.search_voice_denied || '');
    }
  }

  const showHints =
    (showRecent || variant !== 'header') &&
    (alwaysShowSuggestions || focused) &&
    (recent.length > 0 || suggestions.length > 0);

  const rootClass = [
    'site-search-bar',
    `site-search-bar--${variant}`,
    photoBusy || voiceBusy ? 'site-search-bar--busy' : '',
    voiceRecording ? 'site-search-bar--recording' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass}>
      <form className="site-search-bar__form" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor={`pk-search-${variant}`}>
          {copy.search_label}
        </label>
        <span className="site-search-bar__icon" aria-hidden>
          <SearchIcon />
        </span>
        <input
          id={`pk-search-${variant}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 140)}
          placeholder={placeholder || copy.search_placeholder}
          autoComplete="off"
          disabled={photoBusy || voiceBusy || voiceRecording}
        />
        <button
          type="button"
          className={`site-search-bar__voice${voiceRecording ? ' active' : ''}`}
          aria-label={copy.search_voice_btn}
          title={voiceRecording ? copy.search_voice_listening : copy.search_voice_btn}
          disabled={photoBusy || voiceBusy}
          onClick={() => void toggleVoiceSearch()}
        >
          {voiceBusy && !voiceRecording ? '…' : <MicIcon active={voiceRecording} />}
        </button>
        <button
          type="button"
          className="site-search-bar__photo"
          aria-label={copy.search_photo_btn}
          title={copy.search_photo_btn}
          disabled={photoBusy || voiceBusy || voiceRecording}
          onClick={() => fileRef.current?.click()}
        >
          {photoBusy ? '…' : <CameraIcon />}
        </button>
        <button
          className="site-search-bar__submit"
          type="submit"
          aria-label={copy.search_submit}
          disabled={photoBusy || voiceBusy || voiceRecording}
        >
          {copy.search_submit}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => void onPhotoSelected(e.target.files?.[0] ?? null)}
        />
      </form>

      {showHints ? (
        <div className="site-search-bar__hints" role="listbox">
          {recent.length && focused ? (
            <>
              <span className="site-search-bar__hints-label">{copy.search_recent}</span>
              <div className="site-search-bar__chips">
                {recent.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="site-search-bar__chip"
                    onMouseDown={() => go(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {suggestions.length ? (
            <div className="site-search-bar__chips site-search-bar__chips--examples">
              {suggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="site-search-bar__chip site-search-bar__chip--example"
                  onMouseDown={() => go(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {photoErr ? <p className="site-search-bar__err">{photoErr}</p> : null}
      {voiceErr ? <p className="site-search-bar__err">{voiceErr}</p> : null}
      {voiceRecording ? (
        <p className="site-search-bar__voice-hint">{copy.search_voice_listening}</p>
      ) : null}
      {!photoErr &&
      !voiceErr &&
      !voiceRecording &&
      copy.mp_search_hint &&
      (variant === 'hero' || variant === 'inline') ? (
        <p className="site-search-bar__tip">{copy.mp_search_hint}</p>
      ) : null}
    </div>
  );
}
