CREATE TABLE players (id TEXT PRIMARY KEY, name TEXT NOT NULL, animal INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE rooms (code TEXT PRIMARY KEY, host TEXT NOT NULL REFERENCES players(id), guest TEXT REFERENCES players(id));
--> statement-breakpoint
CREATE TABLE rounds (id TEXT PRIMARY KEY, room TEXT NOT NULL REFERENCES rooms(code), n INTEGER NOT NULL, a INTEGER, b INTEGER, winner TEXT, UNIQUE(room,n));
--> statement-breakpoint
CREATE TABLE collections (owner TEXT NOT NULL REFERENCES players(id), friend TEXT NOT NULL REFERENCES players(id), PRIMARY KEY(owner,friend));
