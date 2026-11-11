CREATE TABLE `article` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`titre` text NOT NULL,
	`resume` text DEFAULT '' NOT NULL,
	`categorie_id` text,
	`contenu_json` text NOT NULL,
	`contenu_html` text NOT NULL,
	`statut` text DEFAULT 'brouillon' NOT NULL,
	`publie_le` integer,
	`cree_le` integer NOT NULL,
	`modifie_le` integer NOT NULL,
	FOREIGN KEY (`categorie_id`) REFERENCES `categorie`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `article_slug_unique` ON `article` (`slug`);--> statement-breakpoint
CREATE INDEX `article_statut_publie_idx` ON `article` (`statut`,`publie_le`);--> statement-breakpoint
CREATE TABLE `categorie` (
	`id` text PRIMARY KEY NOT NULL,
	`nom` text NOT NULL,
	`slug` text NOT NULL,
	`cree_le` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categorie_slug_unique` ON `categorie` (`slug`);