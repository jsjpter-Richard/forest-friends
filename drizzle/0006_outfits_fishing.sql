CREATE TABLE purchases (owner TEXT NOT NULL REFERENCES players(id), item TEXT NOT NULL, paid INTEGER NOT NULL, PRIMARY KEY(owner,item));
--> statement-breakpoint
CREATE TABLE outfits (owner TEXT PRIMARY KEY REFERENCES players(id), hat TEXT, clothes TEXT, accessory TEXT);
--> statement-breakpoint
CREATE TABLE fishing_casts (id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES players(id), start_at INTEGER NOT NULL, phase INTEGER NOT NULL, zone REAL NOT NULL, species TEXT NOT NULL, result TEXT NOT NULL DEFAULT 'pending');
--> statement-breakpoint
CREATE TABLE fish_gifts (id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES players(id), friend TEXT NOT NULL REFERENCES players(id), species TEXT NOT NULL);
