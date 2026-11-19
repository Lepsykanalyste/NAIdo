# Droits par rôle — NAIdo

Généré à partir de `backend/src/config/permissions.json` (la seule source de vérité, lue par le serveur Node **et** le serveur Python).

- **super_admin** : accès total, y compris la modification des droits des rôles.
- **directeur** : accès total, sauf la modification des droits des rôles et la gestion des comptes *direction* (réservées au super_admin).
- **L** = lecture · **E** = écriture (créer, modifier, supprimer, valider) · **·** = aucun accès.
- Les variantes d'un même poste (opérateur extrusion, soudure…) ont les droits de la colonne « opér. » ; `magasinier_at3` et `magasinier_central` ont ceux de « mag. ».
- Pour modifier un droit : éditer `permissions.json` dans `backend/src/config/` ET `backend_python/` (fichiers identiques), puis redémarrer les deux serveurs.
- Secours : `RBAC_MODE=audit` dans `.env` journalise les refus sans les appliquer (puis `sudo docker compose up -d`).

| Famille de routes | chef | régl. | tech.régl. | opér. | mag. | mag.MP | qualité | qhse | comm. | vente | achat | compt. | rh | techn. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Achats (commandes, réceptions, demandes) | L+E | · | · | · | L | L | · | L | L | L | L+E | L | L | L |
| Arrêts machine | L | L | L | E | · | · | · | L | · | · | · | · | · | L |
| Articles / matières | L | · | · | · | L | · | · | · | L | L | L+E | L | · | · |
| Atelier AT3 (flux, quarantaine) | L+E | · | · | · | · | L | · | · | · | · | · | · | · | · |
| Ateliers (liste) | L | · | · | · | L | · | · | L | · | · | L+E | · | L | L |
| Bons de commande clients | · | · | · | · | · | · | · | · | L+E | · | · | L | · | · |
| Bons de cession | L+E | · | · | · | · | · | L+E | · | · | · | · | · | · | · |
| Composition des articles | L+E | · | · | · | · | · | · | · | L+E | · | · | · | · | · |
| DBM (demandes de matières) | L+E | · | · | · | · | L+E | · | · | · | · | · | · | · | · |
| Devis | · | · | · | · | · | · | · | · | L+E | · | · | L | · | · |
| Demandes de fabrication | · | · | · | · | · | · | · | · | L+E | · | · | L | · | · |
| Emplacements de stock | · | · | · | · | L+E | · | · | · | · | · | · | L | · | · |
| Équipements | L+E | L | L | · | · | · | · | L+E | · | · | · | · | L+E | L+E |
| Fiches TDS/FDS/photos d'article | · | · | · | · | · | · | · | · | · | · | E | · | · | · |
| Fournisseurs | L | · | · | · | · | · | · | L | · | · | · | L | · | L |
| GMAO / maintenance | L+E | · | · | · | · | · | · | L+E | · | · | · | · | L+E | L+E |
| Assistant IA | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| IA : analyse non-conformité | E | · | · | · | · | · | E | E | · | · | · | · | · | · |
| IA : analyse de panne | E | · | · | · | · | · | · | E | · | · | · | · | · | E |
| IA : analyse de processus | · | · | · | · | · | · | · | E | · | · | · | · | · | · |
| IA : analyse de stock | E | · | · | · | E | E | · | · | · | · | · | · | · | · |
| Assistant IA : conversation | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| IA : rapport journalier | E | · | · | · | · | · | · | · | · | · | · | · | · | · |
| Import Sage | L+E | · | · | · | · | · | · | · | · | · | · | · | · | · |
| Incidents | L+E | · | · | · | · | · | · | L+E | · | · | · | · | L+E | L+E |
| KPI | L | · | · | · | · | · | · | · | · | · | · | L | · | · |
| Journaux | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| Lots de production | L+E | L | L | L | · | · | L | · | · | · | · | · | · | · |
| Machines | L | L | L | L | · | · | L | L | L | · | · | · | · | L |
| Mouvements de stock | L+E | · | · | · | L+E | · | · | · | · | · | · | L | · | · |
| Non-conformités | L+E | · | · | · | · | · | L+E | · | · | · | · | · | · | · |
| Ordres de fabrication | L+E | L+E | L+E | L | · | · | L | · | · | · | · | · | · | · |
| Validation du réglage (OF) | E | E | E | · | · | · | · | · | · | · | · | · | · | · |
| Ordres de livraison | · | · | · | · | · | · | · | · | L+E | · | · | L | · | · |
| Ordres de travail | L+E | · | · | · | · | · | · | L+E | · | · | · | · | L+E | L+E |
| Paramètres système | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| Droits des rôles | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| Planning machines | L+E | E | E | · | · | · | · | · | · | · | · | · | · | · |
| Processus qualité | · | · | · | · | · | · | L | L+E | · | · | · | · | · | · |
| QHSE | · | · | · | · | · | · | L | L+E | · | · | · | · | · | · |
| Contrôle qualité (page qualité) | L+E | · | · | · | · | · | L+E | · | · | · | · | · | · | · |
| Rapports | L+E | · | · | · | · | · | · | · | · | · | · | · | · | · |
| Rapports journaliers | L+E | · | · | · | · | · | · | · | · | · | · | · | · | · |
| Référentiels (familles, unités) | L | · | · | · | · | · | · | · | · | · | L+E | · | · | · |
| Réglage (historique) | L | L+E | L+E | · | · | · | · | · | · | · | · | · | · | · |
| RH et paie | · | · | · | · | · | · | · | · | · | · | · | · | L+E | · |
| Rondes chef de quart | L+E | · | · | · | · | · | L+E | · | · | · | · | · | · | · |
| Sessions de production | L+E | L+E | L+E | L+E | · | · | L | · | · | · | · | · | · | · |
| Validation du réglage (session) | E | E | E | · | · | · | · | · | · | · | · | · | · | · |
| Équipes (shifts) | L | L | L | L | · | · | · | · | · | · | · | · | · | · |
| Stock | L | · | · | · | L+E | · | · | · | · | · | · | L | · | · |
| Tickets de production (PDF) | L | · | · | · | · | · | L | · | · | · | · | · | · | · |
| Tickets / bobines | L+E | L+E | L+E | L+E | · | · | L | · | · | · | · | · | · | · |
| Traçabilité matières | L+E | L+E | L+E | · | · | L | L | L | · | · | · | · | · | · |
| Liste des utilisateurs (listes déroulantes) | L | · | · | · | · | · | L | L | · | · | · | · | L | L |
| Gestion des comptes | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| Ventes / clients | L | · | · | · | · | · | · | · | L+E | L+E | · | L | · | · |

## Ouvert à tout utilisateur connecté

- `GET /api/permissions/moi`
- `GET/PUT/POST /api/alertes`
- `GET /api/ateliers`
- `GET /api/kpi/dashboard`
- `GET /api/kpi/trs`
- `GET /api/kpi/rebus`
- `GET /api/gmao/dashboard`
- `GET /api/gmao/energie/dashboard`
- `GET /api/rh/dashboard`
- `GET /api/qhse/dashboard`
- `GET /api/stock/resume`

## Réservé au super_admin

- `POST/PUT/PATCH/DELETE /api/permissions`

## Public (sans connexion)

- `POST /api/auth/login`
- `POST /api/auth/login-badge`
- `GET /api/health`
- `GET /api/tickets/*/view`
- `GET /api/regleur/ticket/*/view`

## Rôles qui héritent d'un autre

- `responsable_qhse` → `qhse`
- `responsable_rh` → `rh`
- `technicien_gmao` → `technicien`
- `responsable_stock` → `magasinier_central`

Un rôle absent de ce tableau n'a accès qu'au tableau de bord et aux alertes.
