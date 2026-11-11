CREATE TABLE `tarif` (
	`id` text PRIMARY KEY NOT NULL,
	`libelle` text NOT NULL,
	`duree_minutes` integer,
	`prix_centimes` integer NOT NULL,
	`ordre` integer DEFAULT 0 NOT NULL
);
