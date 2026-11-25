# Security Specification — Shared Family Gratitude Board

## 1. Data Invariants
1. **Default-Deny Catch-All**: All paths not explicitly matched in `firestore.rules` are denied for both reads and writes.
2. **Strict Schema (`GratitudeNote`)**: Every document in `/gratitude_notes/{noteId}` MUST contain ONLY `['name', 'message', 'createdAt']`. No extra shadow fields (`isAdmin`, `approved`, `email`, etc.) are permitted.
3. **Bounded String Lengths**:
   - `name`: string, `1 <= name.size() <= 48`
   - `message`: string, `1 <= message.size() <= 240`
4. **Server Temporal Integrity**: `createdAt` MUST be a Firestore timestamp equal to `request.time` (`serverTimestamp()`). Client-forged timestamps are rejected.
5. **Path Variable Hardening**: Every single-document operation (`get`, `create`, `update`, `delete`) enforces `isValidId(noteId)` (`<= 128` chars, `^[a-zA-Z0-9_\\-]+$`).
6. **Immutability of Notes**: Posted notes cannot be edited (`allow update: if false;`), preventing tampering or vandalism of other guests' keepsake cards.
7. **Host-Only Moderation (Deletion)**: Only a verified host admin (`c_tokar@chuh.org` with `email_verified == true` or listed in `/admins/{uid}`) may delete notes from the shared board.
8. **Zero PII Exposure**: No emails, phone numbers, addresses, or auth tokens are stored in `gratitude_notes`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection**: `{ name: "Joni", message: "Pie!", createdAt: request.time, isAdmin: true }` -> `PERMISSION_DENIED` (`hasOnly` rejects extra key).
2. **Empty Name**: `{ name: "", message: "Family", createdAt: request.time }` -> `PERMISSION_DENIED` (`name.size() >= 1`).
3. **Name Exceeding 48 Chars (DoW / Overflow)**: `{ name: "A".repeat(49), message: "Family", createdAt: request.time }` -> `PERMISSION_DENIED` (`name.size() <= 48`).
4. **Empty Message**: `{ name: "Jason", message: "", createdAt: request.time }` -> `PERMISSION_DENIED` (`message.size() >= 1`).
5. **Message Exceeding 240 Chars (1MB Payload Attack)**: `{ name: "Jason", message: "X".repeat(241), createdAt: request.time }` -> `PERMISSION_DENIED` (`message.size() <= 240`).
6. **Wrong Field Type (`name` as number)**: `{ name: 123, message: "Turkey", createdAt: request.time }` -> `PERMISSION_DENIED` (`is string`).
7. **Wrong Field Type (`message` as array/map)**: `{ name: "Scotty", message: ["Popcorn"], createdAt: request.time }` -> `PERMISSION_DENIED` (`is string`).
8. **Missing Required Field (`createdAt`)**: `{ name: "Kristin", message: "Popcorn dessert" }` -> `PERMISSION_DENIED` (`hasAll`).
9. **Spoofed Client Timestamp**: `{ name: "Brandon", message: "Potatoes", createdAt: Timestamp(2020-01-01) }` -> `PERMISSION_DENIED` (`createdAt == request.time`).
10. **ID Poisoning**: Document ID `"bad/id$123"` or 200-char ID on `create`/`get`/`delete` -> `PERMISSION_DENIED` (`isValidId(noteId)`).
11. **Unauthorized Note Tampering (`update`)**: Any `update` on `/gratitude_notes/{noteId}` -> `PERMISSION_DENIED` (`allow update: if false;`).
12. **Email Spoofing / Unverified Delete**: `delete` by non-admin or `email: "c_tokar@chuh.org"` with `email_verified: false` -> `PERMISSION_DENIED` (`isAdmin()` requires `email_verified == true`).
