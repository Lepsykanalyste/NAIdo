# Reconstruire la base de naido

1. Charger la structure de reference : `database/schema_reference_20261117.sql` (105 tables, etat du 17-18 novembre 2026).
2. Appliquer ensuite ces migrations, dans cet ordre (verifie par un rejeu complet sur une base vide : aucune erreur) :

| Ordre | Fichier | Role |
|---|---|---|
| 1 | `migration_controles_rondes.sql` | tables du controle avant cession et de la ronde chef de quart |
| 2 | `migration_contraintes_atelier.sql` | causes d'arret (fin_shift) et statut d'OF (en_attente_operateur) |
| 3 | `migration_correctifs_audit.sql` | colonnes attendues par le code : non-conformites, plans GMAO, audits QHSE, journal de stock |
| 4 | `migration_lots_unicite.sql` | un numero de lot n'est unique que par article |
| 5 | `migration_trigger_sync_stock.sql` | une ligne de stock par (article, emplacement) ; declencheur neutre |
| 6 | `migration_stock_sans_declencheur.sql` | declencheur de stock neutre (les routes mettent a jour le stock) |

Les deux derniers fichiers donnent le meme resultat final : le declencheur `sync_stock_articles` ne fait rien. L'ordre n'a donc pas d'importance entre eux.

Commande de rejeu (sur naido, depuis `~/NAIdo`), une migration a la fois :

    sudo docker exec -i naido_postgres psql -U naido_user -d naido_db -v ON_ERROR_STOP=1 < database/migration_controles_rondes.sql

Verification apres reconstruction : `bash ~/controle_stock_livraison.sh` doit se terminer par `[OK]`.
