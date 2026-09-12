-- PiliRun schema v2. Runtime migration is owned by storage.worker.ts.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS records (
    collection TEXT NOT NULL
        CHECK (collection IN ('characters', 'tracks', 'runs', 'preferences', 'scenarios', 'scenario-drafts')),
    id TEXT NOT NULL,
    json TEXT NOT NULL CHECK (json_valid(json)),
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (collection, id)
);

CREATE TABLE IF NOT EXISTS music (
    id TEXT PRIMARY KEY,
    json TEXT NOT NULL CHECK (json_valid(json)),
    bytes BLOB NOT NULL
);

CREATE TABLE IF NOT EXISTS scenario_assets (
    scenario_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    json TEXT NOT NULL CHECK (json_valid(json)),
    bytes BLOB NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (scenario_id, asset_id)
);

PRAGMA user_version = 2;
