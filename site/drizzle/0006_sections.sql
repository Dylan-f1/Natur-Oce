CREATE TABLE `section` (
	`id` text PRIMARY KEY NOT NULL,
	`modele` text NOT NULL,
	`titre` text NOT NULL,
	`texte` text DEFAULT '' NOT NULL,
	`liste` text DEFAULT '' NOT NULL,
	`bouton` integer DEFAULT false NOT NULL,
	`image_cle` text,
	`image_alt` text,
	`apres` text NOT NULL,
	`ordre` integer DEFAULT 0 NOT NULL,
	`modifie_le` integer NOT NULL
);
