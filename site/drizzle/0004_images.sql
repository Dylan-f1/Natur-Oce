CREATE TABLE `image` (
	`cle` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`donnees` blob NOT NULL,
	`largeur` integer NOT NULL,
	`hauteur` integer NOT NULL,
	`taille` integer NOT NULL,
	`cree_le` integer NOT NULL
);
