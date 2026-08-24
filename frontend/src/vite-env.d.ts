/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

export interface UpdateStatusData {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  percent?: number;
  releaseNotes?: string;
  error?: string;
}

declare global {
  interface Window {
    electronAPI?: {
      isElectron?: boolean;
      platform?: string;
      getAppVersion?: () => Promise<string>;
      getDbPath?: () => Promise<string>;
      checkForUpdates?: () => Promise<UpdateStatusData>;
      quitAndInstall?: () => Promise<void>;
      onUpdateStatus?: (callback: (data: UpdateStatusData) => void) => () => void;
    };
  }
}
