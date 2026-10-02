/**
 * Local API fixtures for the static design-review preview.
 *
 * The preview has no backend: every /api call would resolve against the static
 * host and come back as index.html, so screens would render empty or throw.
 * `ApiClient` short-circuits to this module when PREVIEW_MODE is on, which
 * keeps the stub data in ONE place instead of smeared through components.
 *
 * Reached only from a `if (PREVIEW_MODE)` branch, so production drops it.
 */

/** Fixed timestamps — a mockup must look identical on every capture. */
const NOW = '2026-05-21T09:12:00.000Z';
const EARLIER = '2026-05-19T16:40:00.000Z';
const CREATED = '2026-04-02T11:05:00.000Z';

/**
 * Exact-path fixtures, keyed by the normalized path (no leading `/`, no `api/`
 * prefix, no query string).
 */
const GET_FIXTURES: Record<string, unknown> = {
  // ── Identity / firm context ──────────────────────────────────────────
  // intakeRequired:false so the intake gate lets every screen render on a
  // cold load instead of bouncing the reviewer into the onboarding chat.
  'firm/me': {
    id: 'firm-bg-001',
    name: 'Sofia Tech Ltd',
    intakeRequired: false,
    intakeCompleteAt: CREATED,
    displayCurrency: 'USD',
  },

  // ── Banking / generic connectors ─────────────────────────────────────
  connectors: [
    {
      id: 'conn-bank-01',
      sourceType: 'UniCredit Bulbank',
      status: 'ACTIVE',
      lastSyncAt: EARLIER,
      createdAt: CREATED,
    },
  ],

  // ── Cloud storage ────────────────────────────────────────────────────
  // Google Drive is ACTIVE in Picker (drive.file) mode, which is the card
  // that carries all three actions under review: Choose files, Sync now and
  // Disconnect. Dropbox stays disconnected so the Connect state is visible
  // on the same screen.
  'connectors/oauth/connections': [
    {
      id: 'cloud-gdrive-01',
      provider: 'googledrive',
      status: 'ACTIVE',
      syncScope: {
        mode: 'folders',
        folderIds: [],
        fileIds: ['file-01', 'file-02', 'file-03'],
        folderNames: {},
      },
      fullAccess: false,
      lastSyncAt: NOW,
      createdAt: CREATED,
    },
  ],

  // Picker (drive.file) mode — the less privileged scope.
  'connectors/oauth/googledrive/picker-config': { fullAccessEnabled: false },

  'connectors/oauth/googledrive/files': {
    files: [
      {
        documentId: 'doc-01',
        fileId: 'file-01',
        name: 'Annual Report 2025.pdf',
        sizeBytes: 2_419_200,
        processingStatus: 'PROCESSED',
        createdAt: EARLIER,
      },
      {
        documentId: 'doc-02',
        fileId: 'file-02',
        name: 'Q1 Management Accounts.xlsx',
        sizeBytes: 486_400,
        processingStatus: 'PROCESSED',
        createdAt: EARLIER,
      },
      {
        documentId: 'doc-03',
        fileId: 'file-03',
        name: 'Supplier Contracts (signed).pdf',
        sizeBytes: 1_048_576,
        processingStatus: 'PROCESSING',
        createdAt: NOW,
      },
    ],
    grantLost: false,
  },

  // ── Business-app connectors ──────────────────────────────────────────
  'integrations/providers': [],
  'integrations/connections': [],
};

/** Prefix fixtures for paths that carry an id/slug segment. */
const GET_PATTERNS: Array<[RegExp, unknown]> = [
  // Any other provider's file list is simply empty.
  [/^connectors\/oauth\/[^/]+\/files$/, { files: [], grantLost: false }],
  [/^connectors\/oauth\/[^/]+\/children$/, { entries: [] }],
];

/** Strip the `/api` prefix, leading slashes and any query string. */
function normalize(path: string): string {
  return path
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/^\/+/, '')
    .replace(/^api\/?/, '')
    .split('?')[0]
    .replace(/\/+$/, '');
}

/**
 * Resolve a request against the fixtures.
 *
 * Unknown GETs REJECT rather than resolving to a made-up shape: every call
 * site in this app already handles a failed load with an empty state, so a
 * rejection degrades to the same screen the real app shows offline, whereas a
 * wrong-shaped success would crash a template. Writes resolve `{ ok: true }`
 * so buttons stay clickable for the reviewer.
 */
export function previewRespond<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
): Promise<T> {
  const key = normalize(path);

  if (method === 'GET') {
    if (key in GET_FIXTURES) {
      return Promise.resolve(clone(GET_FIXTURES[key]) as T);
    }
    for (const [pattern, value] of GET_PATTERNS) {
      if (pattern.test(key)) return Promise.resolve(clone(value) as T);
    }
    return Promise.reject(
      new Error(`[preview] no fixture for GET ${key} — screen falls back to its empty state`),
    );
  }

  return Promise.resolve({ ok: true } as T);
}

/** Deep copy so a component mutating a result cannot corrupt the fixture. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
