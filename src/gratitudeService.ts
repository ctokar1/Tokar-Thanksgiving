import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';

export const GRATITUDE_COLLECTION = 'gratitude_notes';
export const NAME_MAX_LENGTH = 48;
export const MESSAGE_MAX_LENGTH = 240;
export const HOST_ADMIN_EMAIL = 'c_tokar@chuh.org';
const VALID_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export interface GratitudeNoteItem {
  id: string;
  name: string;
  message: string;
  dateLabel: string;
  createdAtMs: number;
}

export interface HostAuthState {
  uid: string | null;
  email: string | null;
  isHostAdmin: boolean;
}

function formatDateLabel(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return 'Just now';
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function subscribeToGratitudeNotes(
  onData: (notes: GratitudeNoteItem[]) => void,
  onError: (friendlyMessage: string, structuredError: Error) => void,
): () => void {
  const q = query(
    collection(db, GRATITUDE_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(100),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const notes: GratitudeNoteItem[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data({ serverTimestamps: 'estimate' }) as {
          name?: unknown;
          message?: unknown;
          createdAt?: Timestamp | null;
        };
        const createdAtMs =
          data.createdAt && typeof data.createdAt.toMillis === 'function'
            ? data.createdAt.toMillis()
            : Date.now();
        return {
          id: docSnap.id,
          name: typeof data.name === 'string' ? data.name.slice(0, NAME_MAX_LENGTH) : 'Family Guest',
          message:
            typeof data.message === 'string' ? data.message.slice(0, MESSAGE_MAX_LENGTH) : '',
          dateLabel: formatDateLabel(createdAtMs),
          createdAtMs,
        };
      });
      onData(notes);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, GRATITUDE_COLLECTION);
      } catch (structuredErr) {
        const msg =
          error instanceof Error && error.message.includes('Quota exceeded')
            ? 'Daily shared board quota was reached. Please try again tomorrow.'
            : 'Unable to load shared gratitude notes right now. Please refresh to try again.';
        onError(
          msg,
          structuredErr instanceof Error ? structuredErr : new Error(String(structuredErr)),
        );
      }
    },
  );
}

export async function createGratitudeNote(rawName: string, rawMessage: string): Promise<string> {
  const name = rawName.trim().slice(0, NAME_MAX_LENGTH);
  const message = rawMessage.trim().slice(0, MESSAGE_MAX_LENGTH);

  if (name.length < 1 || message.length < 1) {
    throw new Error('Please enter both your name and what you are thankful for.');
  }

  try {
    const docRef = await addDoc(collection(db, GRATITUDE_COLLECTION), {
      name,
      message,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, GRATITUDE_COLLECTION);
  }
}

export async function deleteGratitudeNote(noteId: string): Promise<void> {
  if (!noteId || noteId.length > 128 || !VALID_ID_PATTERN.test(noteId)) {
    throw new Error('Invalid note identifier.');
  }

  const docPath = `${GRATITUDE_COLLECTION}/${noteId}`;
  try {
    await deleteDoc(doc(db, GRATITUDE_COLLECTION, noteId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

function mapAuthState(user: User | null): HostAuthState {
  return {
    uid: user?.uid ?? null,
    email: user?.email ?? null,
    isHostAdmin: Boolean(user && user.email === HOST_ADMIN_EMAIL && user.emailVerified),
  };
}

export function subscribeToHostAuth(onAuth: (state: HostAuthState) => void): () => void {
  return onAuthStateChanged(auth, (user) => {
    onAuth(mapAuthState(user));
  });
}

export async function signInHostWithGoogle(): Promise<HostAuthState> {
  const cred = await signInWithPopup(auth, googleProvider);
  return mapAuthState(cred.user);
}

export async function signOutHost(): Promise<void> {
  await signOut(auth);
}
