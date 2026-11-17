CREATE TABLE matches (id TEXT PRIMARY KEY, room TEXT NOT NULL REFERENCES rooms(code), n INTEGER NOT NULL, winner TEXT, UNIQUE(room,n));
--> statement-breakpoint
CREATE TABLE bouts (id TEXT PRIMARY KEY, match_id TEXT NOT NULL REFERENCES matches(id), n INTEGER NOT NULL, ready_a INTEGER NOT NULL DEFAULT 0, ready_b INTEGER NOT NULL DEFAULT 0, deadline INTEGER, a INTEGER, b INTEGER, winner TEXT, reason TEXT, UNIQUE(match_id,n));
