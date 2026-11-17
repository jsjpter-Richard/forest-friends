CREATE TABLE profiles (player TEXT PRIMARY KEY REFERENCES players(id), code TEXT NOT NULL UNIQUE, seen INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE TABLE friend_links (a TEXT NOT NULL REFERENCES players(id), b TEXT NOT NULL REFERENCES players(id), requester TEXT NOT NULL REFERENCES players(id), status TEXT NOT NULL DEFAULT 'pending', PRIMARY KEY(a,b));
--> statement-breakpoint
CREATE TABLE invites (id TEXT PRIMARY KEY, sender TEXT NOT NULL REFERENCES players(id), recipient TEXT NOT NULL REFERENCES players(id), room TEXT NOT NULL REFERENCES rooms(code), status TEXT NOT NULL DEFAULT 'pending', expires INTEGER NOT NULL);
