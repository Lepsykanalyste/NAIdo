"""
NAIdo Stock v2 — Routes FastAPI
Logique : stock par emplacement, tout manuel, journal complet
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
import asyncpg, json
from datetime import datetime

router = APIRouter(prefix="/api/stock", tags=["stock"])

# Import depuis main
import sys
sys.path.insert(0, '/app')

async def get_pool():
    from main import pool
    return pool

# ── INVENTAIRE PAR ATELIER ────────────────────────────────────
async def inventaire_handler(pool, search=None, atelier_id=None, type_article=None):
    async with pool.acquire() as conn:
        q = """
            SELECT
                at.id AS atelier_id,
                at.code AS atelier_code,
                at.libelle AS atelier_libelle,
                e.id AS emplacement_id,
                e.code AS emplacement_code,
                e.libelle AS emplacement_libelle,
                e.type AS emplacement_type,
                a.id AS article_id,
                a.code AS article_code,
                a.designation,
                a.type_article,
                COALESCE(a.stock_mini, 0) AS stock_mini,
                um.code AS unite,
                COALESCE(sa.qte_disponible, 0) AS qte_disponible,
                COALESCE(sa.qte_reservee, 0) AS qte_reservee,
                COALESCE(sa.valeur_stock, 0) AS valeur_stock,
                CASE WHEN COALESCE(sa.qte_disponible,0) <= COALESCE(a.stock_mini,0)
                     AND COALESCE(a.stock_mini,0) > 0
                     THEN true ELSE false END AS alerte_stock_bas,
                sa.derniere_entree,
                sa.derniere_sortie
            FROM stock_articles sa
            JOIN articles a ON a.id = sa.article_id
            JOIN emplacements_stock e ON e.id = sa.emplacement_id
            LEFT JOIN ateliers at ON at.id = e.atelier_id
            LEFT JOIN unites_mesure um ON um.id = a.unite_mesure_id
            WHERE a.actif = true AND e.actif = true
              AND sa.qte_disponible > 0
        """
        params = []
        if search:
            params.append(f"%{search}%")
            q += f" AND (a.code ILIKE ${len(params)} OR a.designation ILIKE ${len(params)})"
        if atelier_id:
            params.append(int(atelier_id))
            q += f" AND at.id = ${len(params)}"
        if type_article:
            params.append(type_article)
            q += f" AND a.type_article = ${len(params)}"
        q += " ORDER BY at.code, e.code, a.type_article, a.code"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

# ── RÉSUMÉ STOCK GLOBAL ───────────────────────────────────────
async def resume_handler(pool):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT
                COUNT(DISTINCT sa.article_id) AS nb_articles,
                COUNT(DISTINCT sa.emplacement_id) AS nb_emplacements,
                COALESCE(SUM(sa.qte_disponible), 0) AS qte_totale,
                COALESCE(SUM(sa.valeur_stock), 0) AS valeur_totale,
                COUNT(*) FILTER (
                    WHERE sa.qte_disponible <= COALESCE(a.stock_mini, 0)
                    AND COALESCE(a.stock_mini, 0) > 0
                ) AS nb_alertes,
                COUNT(DISTINCT ls.id) FILTER (WHERE ls.statut = 'disponible') AS nb_lots_actifs,
                COUNT(DISTINCT ls.id) FILTER (
                    WHERE ls.date_dlc IS NOT NULL AND ls.date_dlc < CURRENT_DATE
                ) AS nb_lots_expires,
                COUNT(DISTINCT ls.id) FILTER (
                    WHERE ls.date_dlc IS NOT NULL
                    AND ls.date_dlc >= CURRENT_DATE
                    AND ls.date_dlc <= CURRENT_DATE + INTERVAL '30 days'
                ) AS nb_lots_proches
            FROM stock_articles sa
            JOIN articles a ON a.id = sa.article_id
            LEFT JOIN lots_stock ls ON ls.article_id = sa.article_id
            WHERE a.actif = true
        """)
        return dict(row)

# ── MOUVEMENT STOCK ───────────────────────────────────────────
async def mouvement_handler(pool, payload: dict, type_mouvement: str, user_id: str):
    """
    Gère tous les mouvements de stock :
    - entree_manuelle, entree_achat : ajoute au stock emplacement
    - sortie_manuelle, sortie_vente, rebut : retire du stock emplacement
    - transfert : retire de source, ajoute à destination
    """
    async with pool.acquire() as conn:
        async with conn.transaction():
            article_id = payload.get("article_id")
            if not article_id:
                raise ValueError("Article requis")
            
            qte = float(payload.get("qte", 0))
            if qte <= 0:
                raise ValueError("Quantité invalide")
            
            emplacement_id = int(payload["emplacement_id"]) if payload.get("emplacement_id") not in (None, "", "null") else None
            emplacement_dest_id = int(payload["emplacement_destination_id"]) if payload.get("emplacement_destination_id") not in (None, "", "null") else None
            prix = float(payload.get("prix_unitaire", 0) or 0)
            numero_lot = payload.get("numero_lot") or None
            notes = payload.get("notes") or None
            reference_doc = payload.get("reference_doc") or None

            # ── ENTRÉE ──────────────────────────────────────
            if type_mouvement in ("entree_manuelle", "entree_achat", "entree_production", "retour"):
                if not emplacement_id:
                    raise ValueError("Emplacement requis pour une entrée")
                
                # Mettre à jour stock_articles
                await conn.execute("""
                    INSERT INTO stock_articles (article_id, emplacement_id, qte_disponible, valeur_stock, derniere_entree)
                    VALUES ($1, $2, $3, $3 * $4, NOW())
                    ON CONFLICT (article_id, emplacement_id)
                    DO UPDATE SET
                        qte_disponible = stock_articles.qte_disponible + $3,
                        valeur_stock   = stock_articles.valeur_stock + ($3 * $4),
                        derniere_entree = NOW()
                """, article_id, emplacement_id, qte, prix)

                # Mettre à jour ou créer le lot
                if numero_lot:
                    existing = await conn.fetchrow(
                        "SELECT id FROM lots_stock WHERE numero_lot=$1 AND article_id=$2",
                        numero_lot, article_id
                    )
                    if existing:
                        await conn.execute(
                            "UPDATE lots_stock SET qte_disponible = qte_disponible + $1 WHERE id = $2",
                            qte, existing["id"]
                        )
                    else:
                        date_dlc = payload.get("date_dlc") or None
                        await conn.execute("""
                            INSERT INTO lots_stock (article_id, emplacement_id, numero_lot, qte_initiale, qte_disponible, prix_unitaire, date_dlc, statut)
                            VALUES ($1, $2, $3, $4, $4, $5, $6, 'disponible')
                        """, article_id, emplacement_id, numero_lot, qte, prix, date_dlc)

            # ── SORTIE ───────────────────────────────────────
            elif type_mouvement in ("sortie_manuelle", "sortie_vente", "sortie_production", "rebut"):
                if not emplacement_id:
                    raise ValueError("Emplacement requis pour une sortie")
                
                # Vérifier stock disponible
                dispo = await conn.fetchval(
                    "SELECT COALESCE(qte_disponible, 0) FROM stock_articles WHERE article_id=$1 AND emplacement_id=$2",
                    article_id, emplacement_id
                )
                if not dispo or float(dispo) < qte:
                    raise ValueError(f"Stock insuffisant dans cet emplacement : {dispo or 0} disponible, {qte} demandé")
                
                # Déduire stock
                await conn.execute("""
                    UPDATE stock_articles
                    SET qte_disponible = qte_disponible - $1,
                        valeur_stock   = GREATEST(0, valeur_stock - ($1 * NULLIF(valeur_stock / NULLIF(qte_disponible, 1), 0))),
                        derniere_sortie = NOW()
                    WHERE article_id=$2 AND emplacement_id=$3
                """, qte, article_id, emplacement_id)

                # FIFO sur les lots
                lots = await conn.fetch("""
                    SELECT id, qte_disponible FROM lots_stock
                    WHERE article_id=$1 AND statut='disponible' AND qte_disponible > 0
                    ORDER BY date_reception ASC, created_at ASC
                """, article_id)
                reste = qte
                for lot in lots:
                    if reste <= 0:
                        break
                    deduire = min(reste, float(lot["qte_disponible"]))
                    await conn.execute(
                        "UPDATE lots_stock SET qte_disponible = qte_disponible - $1 WHERE id = $2",
                        deduire, lot["id"]
                    )
                    await conn.execute(
                        "UPDATE lots_stock SET statut='epuise' WHERE id=$1 AND qte_disponible <= 0",
                        lot["id"]
                    )
                    reste -= deduire

            # ── TRANSFERT ────────────────────────────────────
            elif type_mouvement == "transfert":
                if not emplacement_id or not emplacement_dest_id:
                    raise ValueError("Emplacement source ET destination requis pour un transfert")
                
                # Vérifier stock source
                dispo = await conn.fetchval(
                    "SELECT COALESCE(qte_disponible, 0) FROM stock_articles WHERE article_id=$1 AND emplacement_id=$2",
                    article_id, emplacement_id
                )
                if not dispo or float(dispo) < qte:
                    raise ValueError(f"Stock insuffisant en source : {dispo or 0} disponible")
                
                # Retirer de la source
                await conn.execute("""
                    UPDATE stock_articles
                    SET qte_disponible = qte_disponible - $1, derniere_sortie = NOW()
                    WHERE article_id=$2 AND emplacement_id=$3
                """, qte, article_id, emplacement_id)
                
                # Ajouter à la destination
                await conn.execute("""
                    INSERT INTO stock_articles (article_id, emplacement_id, qte_disponible, derniere_entree)
                    VALUES ($1, $2, $3, NOW())
                    ON CONFLICT (article_id, emplacement_id)
                    DO UPDATE SET qte_disponible = stock_articles.qte_disponible + $3, derniere_entree = NOW()
                """, article_id, emplacement_dest_id, qte)

            else:
                raise ValueError(f"Type de mouvement inconnu : {type_mouvement}")

            # ── JOURNAL ──────────────────────────────────────
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS journal_stock (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    article_id UUID, emplacement_id INTEGER,
                    emplacement_destination_id INTEGER,
                    type VARCHAR(30), qte NUMERIC(12,3),
                    prix_unitaire NUMERIC(12,4) DEFAULT 0,
                    numero_lot VARCHAR(100), reference_doc VARCHAR(100),
                    notes TEXT, cree_par UUID,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            await conn.execute("""
                INSERT INTO journal_stock
                    (article_id, emplacement_id, emplacement_destination_id, type, qte,
                     prix_unitaire, numero_lot, reference_doc, notes, cree_par)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            """, article_id, emplacement_id, emplacement_dest_id, type_mouvement,
                qte, prix, numero_lot, reference_doc, notes, user_id)

            return {"success": True, "message": f"{type_mouvement} de {qte} enregistré"}
