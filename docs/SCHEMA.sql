-- PiliRun schema v1. Runtime migration is owned by storage.worker.ts.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS records (
    collection TEXT NOT NULL
        CHECK (collection IN ('characters', 'tracks', 'runs', 'preferences')),
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

PRAGMA user_version = 1;
