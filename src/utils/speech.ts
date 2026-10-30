import { SupportedLang } from '../types/index.ts';
import { LANGS } from './i18n.ts';

export interface WebSpeechSession {
  stop: () => void;
  abort: () => void;
}

export interface WebSpeechOptions {
  lang: SupportedLang;
  baseText: string;
  onTranscript: (updatedText: string, interimText?: string) => void;
  onError: (friendlyErrorMessage: string, errorCode?: string) => void;
  onListeningChange: (isListening: boolean) => void;
}

/**
 * Returns the browser's native SpeechRecognition constructor if available.
 */
export function getSpeechRecognitionClass(): any | null {
  if (typeof window === 'undefined') return null;
  const win = window as any;
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

/**
 * Checks whether the current browser environment supports the Web Speech API.
 */
export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionClass() !== null;
}

/**
 * Checks whether the app is running in a Secure Context (HTTPS or localhost).
 * Browsers strictly prohibit microphone access in insecure contexts.
 */
export function isAppSecureContext(): boolean {
  if (typeof window === 'undefined') return true;
  if (window.isSecureContext !== undefined) {
    return window.isSecureContext;
  }
  return window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

/**
 * Returns the current site domain/origin for permission instructions.
 */
export function getCurrentSiteOrigin(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin || `${window.location.protocol}//${window.location.host}`;
}

/**
 * Checks whether the app is currently running inside an iframe (e.g. AI Studio preview).
 */
export function isRunningInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Maps VoxSetu supported languages to their BCP-47 speech recognition locale codes.
 */
export function getSpeechLangCode(lang: SupportedLang): string {
  if (LANGS[lang]?.speechCode) {
    return LANGS[lang].speechCode;
  }
  switch (lang) {
    case 'hi':
      return 'hi-IN';
    case 'kn':
      return 'kn-IN';
    case 'te':
      return 'te-IN';
    case 'en':
    default:
      return 'en-IN';
  }
}

/**
 * Pure function to safely append newly transcribed speech onto existing user text
 * without overwriting or deleting anything previously typed.
 */
export function appendSpokenText(existingText: string, newSpokenChunk: string): string {
  const cleanSpoken = newSpokenChunk.trim();
  if (!cleanSpoken) return existingText;

  const base = existingText || '';
  if (!base.trim()) {
    return cleanSpoken;
  }

  // Check if existing text already ends with whitespace or newline
  if (/\s$/.test(base)) {
    return `${base}${cleanSpoken}`;
  }

  return `${base} ${cleanSpoken}`;
}

/**
 * Explicitly triggers the browser's microphone permission prompt using getUserMedia.
 * This is useful after permission was previously denied or prompt was dismissed,
 * allowing the user to click "Retry" and be presented with the browser permission dialog.
 */
export async function requestMicrophonePermission(): Promise<{ granted: boolean; error?: string }> {
  if (typeof window === 'undefined') return { granted: false, error: 'Window not available' };

  if (!isAppSecureContext()) {
    return {
      granted: false,
      error: `Voice input requires HTTPS. Current origin (${getCurrentSiteOrigin()}) is not secure.`,
    };
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return {
      granted: false,
      error: 'Media devices API not supported in this browser.',
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Immediately release the audio tracks so the recording indicator in the browser tab turns off
    stream.getTracks().forEach((track) => track.stop());
    return { granted: true };
  } catch (err: any) {
    const name = err?.name || '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return { granted: false, error: 'not-allowed' };
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return { granted: false, error: 'audio-capture' };
    }
    return { granted: false, error: err?.message || 'Permission request failed' };
  }
}

/**
 * Queries the current microphone permission state if the Permissions API is available.
 */
export async function queryMicrophonePermission(): Promise<'granted' | 'prompt' | 'denied' | 'unknown'> {
  if (typeof navigator === 'undefined' || !navigator.permissions || !navigator.permissions.query) {
    return 'unknown';
  }
  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return status.state;
  } catch {
    return 'unknown';
  }
}

/**
 * Starts a Web Speech Recognition session using SpeechRecognition or webkitSpeechRecognition.
 * CRITICAL: Must ONLY be called in response to a user click gesture (e.g. clicking the mic button).
 * Real-time results are inserted into the description without deleting text the user already typed.
 */
export function startWebSpeechRecognition(options: WebSpeechOptions): WebSpeechSession | null {
  // Check secure context
  if (!isAppSecureContext()) {
    options.onError(
      `Voice input requires a secure HTTPS connection. The current site (${getCurrentSiteOrigin()}) is not secure. Please open the app over HTTPS.`,
      'insecure_context'
    );
    return null;
  }

  const SpeechClass = getSpeechRecognitionClass();

  if (!SpeechClass) {
    options.onError(
      'Voice input is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Safari, or type your description manually.',
      'unsupported'
    );
    return null;
  }

  try {
    const recognition = new SpeechClass();
    const speechLocale = getSpeechLangCode(options.lang);

    recognition.lang = speechLocale;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let isManualStop = false;

    recognition.onstart = () => {
      options.onListeningChange(true);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = 0; i < event.results.length; ++i) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      const totalSpoken = (finalTranscript + ' ' + interimTranscript).replace(/\s+/g, ' ').trim();
      if (totalSpoken) {
        const mergedText = appendSpokenText(options.baseText, totalSpoken);
        options.onTranscript(mergedText, interimTranscript.trim());
      }
    };

    recognition.onerror = (event: any) => {
      const code = event.error;

      // Ignore deliberate user stops
      if (code === 'aborted' && isManualStop) {
        return;
      }

      let message = 'An error occurred during voice recognition. Please try again or type manually.';

      switch (code) {
        case 'not-allowed':
        case 'service-not-allowed':
          message = 'not-allowed';
          break;
        case 'no-speech':
          message = 'No speech was detected. Please speak closer to your microphone or try again.';
          break;
        case 'audio-capture':
          message =
            'No microphone was detected. Please ensure a working microphone is connected and enabled on your device.';
          break;
        case 'network':
          message =
            'Network communication error during speech recognition. Please check your internet connection.';
          break;
        case 'aborted':
          message = 'Voice input was interrupted.';
          break;
        case 'language-not-supported':
          message = `Voice recognition in locale ${speechLocale} is not available on this device.`;
          break;
        default:
          if (event.message) {
            message = `Speech recognition error: ${event.message}`;
          }
          break;
      }

      options.onError(message, code);
    };

    recognition.onend = () => {
      options.onListeningChange(false);
    };

    recognition.start();

    return {
      stop: () => {
        isManualStop = true;
        try {
          recognition.stop();
        } catch {
          // ignore
        }
      },
      abort: () => {
        isManualStop = true;
        try {
          recognition.abort();
        } catch {
          // ignore
        }
      },
    };
  } catch (err: any) {
    const errMsg = err?.message || '';
    if (errMsg.includes('not-allowed') || errMsg.includes('permission')) {
      options.onError('not-allowed', 'not-allowed');
    } else {
      options.onError(
        errMsg || 'Unable to initialize microphone speech recognition. Please check your browser settings.',
        'init_failed'
      );
    }
    options.onListeningChange(false);
    return null;
  }
}
