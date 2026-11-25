import {
  createGratitudeNote,
  deleteGratitudeNote,
  signInHostWithGoogle,
  signOutHost,
  subscribeToGratitudeNotes,
  subscribeToHostAuth,
  type GratitudeNoteItem,
  type HostAuthState,
} from './gratitudeService';

export interface TokarGratitudeAPI {
  addNote: (name: string, message: string) => Promise<string>;
  deleteNote: (noteId: string) => Promise<void>;
  signInHost: () => Promise<HostAuthState>;
  signOutHost: () => Promise<void>;
  getState: () => {
    notes: GratitudeNoteItem[];
    loaded: boolean;
    auth: HostAuthState;
    errorMessage: string | null;
  };
}

export interface TokarGratitudeUI {
  onNotesUpdated?: (notes: GratitudeNoteItem[], loaded: boolean) => void;
  onAuthUpdated?: (auth: HostAuthState) => void;
  onBoardError?: (message: string) => void;
}

declare global {
  interface Window {
    TokarGratitudeAPI?: TokarGratitudeAPI;
    TokarGratitudeUI?: TokarGratitudeUI;
  }
}

let currentNotes: GratitudeNoteItem[] = [];
let notesLoaded = false;
let currentAuth: HostAuthState = { uid: null, email: null, isHostAdmin: false };
let currentError: string | null = null;

window.TokarGratitudeAPI = {
  addNote: createGratitudeNote,
  deleteNote: deleteGratitudeNote,
  signInHost: signInHostWithGoogle,
  signOutHost,
  getState: () => ({
    notes: currentNotes,
    loaded: notesLoaded,
    auth: currentAuth,
    errorMessage: currentError,
  }),
};

subscribeToGratitudeNotes(
  (notes) => {
    currentNotes = notes;
    notesLoaded = true;
    currentError = null;
    window.TokarGratitudeUI?.onNotesUpdated?.(notes, true);
  },
  (friendlyMessage) => {
    notesLoaded = true;
    currentError = friendlyMessage;
    window.TokarGratitudeUI?.onBoardError?.(friendlyMessage);
  },
);

subscribeToHostAuth((authState) => {
  currentAuth = authState;
  window.TokarGratitudeUI?.onAuthUpdated?.(authState);
});

window.dispatchEvent(new CustomEvent('tokar-gratitude-ready'));
