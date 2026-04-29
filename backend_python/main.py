from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import asyncpg, os, json
from contextlib import asynccontextmanager
from typing import Optional, List, Any
from pydantic import BaseModel
import uvicorn

# ── CONFIG ─────────────────────────────────────────────────────
DB_URL = os.getenv("DATABASE_URL", "postgresql://naido_user:naido_pass_2026@naido_postgres:5436/naido_db")
JWT_SECRET = os.getenv("JWT_SECRET", "naido_secret_2026")

# ── DB POOL ────────────────────────────────────────────────────
pool = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global pool
    pool = await asyncpg.create_pool(DB_URL, min_size=3, max_size=10)
    print("NAIdo Python API démarré ✓")
    yield
    await pool.close()

app = FastAPI(title="NAIdo API", version="4.0", lifespan=lifespan)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── AUTH ───────────────────────────────────────────────────────
import jwt, bcrypt
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer(auto_error=False)

async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    if not creds:
        raise HTTPException(401, "Token manquant")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
        return payload
    except:
        raise HTTPException(401, "Token invalide")

# ── HELPERS ────────────────────────────────────────────────────
def safe_json(val, fallback=None):
    """Parse JSON en toute sécurité - accepte string, list, dict, None"""
    if fallback is None:
        fallback = []
    if val is None or val == "" or val == "null" or val == "undefined":
        return fallback
    if isinstance(val, (list, dict)):
        return val
    if isinstance(val, str):
        try:
            return json.loads(val)
        except:
            return fallback
    return fallback

def num(v, default=None):
    """Convertit en float ou None"""
    if v is None or v == "":
        return default
    try:
        return float(v)
    except:
        return default

def int_or_none(v):
    """Convertit en int ou None"""
    if v is None or v == "":
        return None
    try:
        return int(v)
    except:
        return None

# ── ROUTES AUTH ────────────────────────────────────────────────
from datetime import datetime, timedelta

class LoginRequest(BaseModel):
    login: str
    password: str

@app.post("/api/auth/login")
async def login(req: LoginRequest):
    async with pool.acquire() as conn:
        user = await conn.fetchrow(
            "SELECT u.*, r.nom as role FROM utilisateurs u LEFT JOIN roles r ON r.id=u.role_id WHERE u.login=$1 AND u.actif=true",
            req.login
        )
        if not user:
            raise HTTPException(401, "Identifiants incorrects")
        if not bcrypt.checkpw(req.password.encode(), user['password_hash'].encode()):
            raise HTTPException(401, "Identifiants incorrects")
        token = jwt.encode({
            "id": str(user['id']),
            "login": user['login'],
            "role": user['role'],
            "nom": user['nom'],
            "prenom": user['prenom'],
            "exp": datetime.utcnow() + timedelta(days=7)
        }, JWT_SECRET, algorithm="HS256")
        return {"token": token, "user": {"id": str(user['id']), "login": user['login'], "nom": user['nom'], "prenom": user['prenom'], "role": user['role']}}

# ── ROUTES ARTICLES ────────────────────────────────────────────
@app.get("/api/articles")
async def get_articles(
    search: Optional[str] = None,
    type_article: Optional[str] = None,
    exclure_mp: Optional[str] = None,
    famille_id: Optional[str] = None,
    user=Depends(get_current_user)
):
    async with pool.acquire() as conn:
        q = """
            SELECT a.id, a.code, a.designation, a.couleur, a.type_article,
                a.poids_theorique_kg, a.poids_reel_kg, a.cadence_theorique_kg_h,
                a.temps_reglage_min, a.prix_achat, a.prix_vente, a.prix_cession_interne,
                a.stock_mini, a.tracabilite_type, a.format_lot, a.actif,
                a.longueur_mm, a.largeur_mm, a.hauteur_mm,
                a.photo_path, a.fiche_technique_path, a.fiche_securite_path,
                a.dlc_jours, a.points_ccp, a.normes_iso, a.certifications,
                a.fournisseur, a.reference_fournisseur, a.densite,
                a.temperature_fusion, a.temperature_traitement,
                a.conditions_stockage, a.risques_securite, a.epi_requis,
                a.composition, a.notes, a.atelier_production_id,
                a.famille_id, a.unite_mesure_id, a.created_at,
                f.libelle AS famille_libelle, f.code AS famille_code,
                um.code AS unite_code, um.libelle AS unite_libelle,
                COALESCE(SUM(sa.qte_disponible),0) AS stock_total
            FROM articles a
            LEFT JOIN familles_articles f ON f.id=a.famille_id
            LEFT JOIN unites_mesure um ON um.id=a.unite_mesure_id
            LEFT JOIN stock_articles sa ON sa.article_id=a.id
            WHERE a.actif=true
        """
        params = []
        if exclure_mp == "true":
            q += " AND a.type_article!='matiere_premiere'"
        if type_article:
            params.append(type_article)
            q += f" AND a.type_article=${len(params)}"
        if famille_id:
            params.append(int(famille_id))
            q += f" AND a.famille_id=${len(params)}"
        if search:
            params.append(f"%{search}%")
            q += f" AND (a.code ILIKE ${len(params)} OR a.designation ILIKE ${len(params)})"
        q += " GROUP BY a.id,f.libelle,f.code,um.code,um.libelle ORDER BY a.type_article,a.code"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

@app.get("/api/articles/{article_id}")
async def get_article(article_id: str, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT a.*, f.libelle AS famille_libelle, um.code AS unite_code,
               COALESCE(SUM(sa.qte_disponible),0) AS stock_total
               FROM articles a
               LEFT JOIN familles_articles f ON f.id=a.famille_id
               LEFT JOIN unites_mesure um ON um.id=a.unite_mesure_id
               LEFT JOIN stock_articles sa ON sa.article_id=a.id
               WHERE a.id=$1 GROUP BY a.id,f.libelle,um.code""",
            article_id
        )
        if not row:
            raise HTTPException(404, "Article introuvable")
        return dict(row)

@app.post("/api/articles")
async def create_article(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        if not d.get("code") or not d.get("designation"):
            raise HTTPException(400, "Code et désignation requis")
        try:
            row = await conn.fetchrow("""
                INSERT INTO articles (
                    code,designation,famille_id,unite_mesure_id,type_article,
                    tracabilite_type,format_lot,couleur,
                    longueur_mm,largeur_mm,hauteur_mm,
                    poids_theorique_kg,poids_reel_kg,poids_mandrin_kg,
                    cadence_theorique_kg_h,temps_reglage_min,
                    prix_achat,prix_vente,prix_cession_interne,
                    stock_mini,dlc_jours,allergenes,points_ccp,
                    normes_iso,atelier_production_id,
                    composition,notes,actif
                ) VALUES (
                    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
                    $15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,true
                ) RETURNING id,code,designation,type_article
            """,
                d["code"].upper().strip(),
                d["designation"].strip(),
                int_or_none(d.get("famille_id")),
                int_or_none(d.get("unite_mesure_id")),
                d.get("type_article", "produit_fini"),
                d.get("tracabilite_type", "lot"),
                d.get("format_lot", "LOT-YYYYMMDD-001"),
                d.get("couleur") or None,
                num(d.get("longueur_mm")),
                num(d.get("largeur_mm")),
                num(d.get("hauteur_mm")),
                num(d.get("poids_theorique_kg")),
                num(d.get("poids_reel_kg")),
                num(d.get("poids_mandrin_kg")),
                num(d.get("cadence_theorique_kg_h")),
                num(d.get("temps_reglage_min"), 30),
                num(d.get("prix_achat"), 0),
                num(d.get("prix_vente"), 0),
                num(d.get("prix_cession_interne"), 0),
                num(d.get("stock_mini"), 0),
                int_or_none(d.get("dlc_jours")),
                d.get("allergenes") or None,
                bool(d.get("points_ccp", False)),
                d.get("normes_iso") or None,
                int_or_none(d.get("atelier_production_id")),
                json.dumps(safe_json(d.get("composition"), [])),
                d.get("notes") or None,
            )
            return dict(row)
        except asyncpg.UniqueViolationError:
            raise HTTPException(400, f"Code '{d['code']}' déjà existant")

@app.put("/api/articles/{article_id}")
async def update_article(article_id: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        sets, vals = [], []

        def add(col, val):
            vals.append(val)
            sets.append(f"{col}=${len(vals)}")

        if "designation" in d: add("designation", d["designation"])
        if "famille_id" in d: add("famille_id", int_or_none(d["famille_id"]))
        if "unite_mesure_id" in d: add("unite_mesure_id", int_or_none(d["unite_mesure_id"]))
        if "atelier_production_id" in d: add("atelier_production_id", int_or_none(d["atelier_production_id"]))
        if "type_article" in d: add("type_article", d["type_article"])
        if "couleur" in d: add("couleur", d["couleur"] or None)
        if "fournisseur" in d: add("fournisseur", d["fournisseur"] or None)
        if "poids_theorique_kg" in d: add("poids_theorique_kg", num(d["poids_theorique_kg"]))
        if "cadence_theorique_kg_h" in d: add("cadence_theorique_kg_h", num(d["cadence_theorique_kg_h"]))
        if "temps_reglage_min" in d: add("temps_reglage_min", num(d["temps_reglage_min"], 30))
        if "prix_achat" in d: add("prix_achat", num(d["prix_achat"], 0))
        if "prix_vente" in d: add("prix_vente", num(d["prix_vente"], 0))
        if "prix_cession_interne" in d: add("prix_cession_interne", num(d["prix_cession_interne"], 0))
        if "stock_mini" in d: add("stock_mini", num(d["stock_mini"], 0))
        if "normes_iso" in d: add("normes_iso", d["normes_iso"] or None)
        if "notes" in d: add("notes", d["notes"] or None)
        if "points_ccp" in d: add("points_ccp", bool(d["points_ccp"]))
        if "actif" in d: add("actif", bool(d["actif"]))
        # JSONB — Python gère nativement, zéro problème de type
        if "composition" in d:
            add("composition", json.dumps(safe_json(d["composition"], [])))

        from datetime import datetime
        add("updated_at", datetime.utcnow())
        vals.append(article_id)

        row = await conn.fetchrow(
            f"UPDATE articles SET {','.join(sets)} WHERE id=${len(vals)} RETURNING id,code,designation",
            *vals
        )
        if not row:
            raise HTTPException(404, "Article introuvable")
        return dict(row)

@app.delete("/api/articles/{article_id}")
async def delete_article(article_id: str, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        await conn.execute("UPDATE articles SET actif=false WHERE id=$1", article_id)
        return {"success": True}

# ── ROUTES RÉFÉRENTIELS ────────────────────────────────────────
@app.get("/api/referentiels/familles")
async def get_familles(user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM familles_articles WHERE actif=true ORDER BY libelle")
        return [dict(r) for r in rows]

@app.get("/api/referentiels/unites")
async def get_unites(user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM unites_mesure WHERE actif=true ORDER BY code")
        return [dict(r) for r in rows]

@app.get("/api/ateliers")
async def get_ateliers(user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM ateliers WHERE actif=true ORDER BY code")
        return [dict(r) for r in rows]

# ── ROUTES STOCK ───────────────────────────────────────────────
@app.get("/api/stock/inventaire")
async def get_inventaire(search: Optional[str] = None, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        q = """
            SELECT a.id, a.code, a.designation, a.type_article,
                COALESCE(a.stock_mini,0) AS stock_mini,
                f.libelle AS famille, um.code AS unite,
                COALESCE(SUM(sa.qte_disponible),0) AS stock_total_dispo,
                COALESCE(SUM(sa.qte_reservee),0) AS stock_total_reserve,
                COALESCE(SUM(sa.valeur_stock),0) AS valeur_totale,
                CASE WHEN COALESCE(SUM(sa.qte_disponible),0) <= COALESCE(a.stock_mini,0)
                     AND COALESCE(a.stock_mini,0) > 0 THEN true ELSE false END AS alerte_stock_bas
            FROM articles a
            LEFT JOIN familles_articles f ON f.id=a.famille_id
            LEFT JOIN unites_mesure um ON um.id=a.unite_mesure_id
            LEFT JOIN stock_articles sa ON sa.article_id=a.id
            WHERE a.actif=true
        """
        params = []
        if search:
            params.append(f"%{search}%")
            q += f" AND (a.code ILIKE $1 OR a.designation ILIKE $1)"
        q += " GROUP BY a.id,f.libelle,um.code ORDER BY a.type_article,a.code"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

@app.get("/api/stock/lots")
async def get_lots(statut: Optional[str] = None, search: Optional[str] = None, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        q = """
            SELECT l.*, a.code AS article_code, a.designation AS article_designation,
                e.code AS emplacement_code
            FROM lots_stock l
            JOIN articles a ON a.id=l.article_id
            LEFT JOIN emplacements_stock e ON e.id=l.emplacement_id
            WHERE 1=1
        """
        params = []
        if statut:
            params.append(statut)
            q += f" AND l.statut=${len(params)}"
        if search:
            params.append(f"%{search}%")
            q += f" AND (a.code ILIKE ${len(params)} OR l.numero_lot ILIKE ${len(params)})"
        q += " ORDER BY l.date_reception DESC LIMIT 200"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

@app.post("/api/stock/entree")
async def entree_stock(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        async with conn.transaction():
            article_id = payload.get("article_id")
            emplacement_id = int(payload["emplacement_id"]) if payload.get("emplacement_id") not in (None, "", "null") else None
            qte = float(payload.get("qte", 0))
            prix = float(payload.get("prix_unitaire", 0) or 0)
            numero_lot = payload.get("numero_lot") or None
            date_dlc = payload.get("date_dlc") or None

            if not article_id or qte <= 0:
                raise HTTPException(400, "Article et quantité requis")

            if numero_lot:
                existing = await conn.fetchrow(
                    "SELECT id FROM lots_stock WHERE numero_lot=$1 AND article_id=$2",
                    numero_lot, article_id
                )
                if existing:
                    await conn.execute(
                        "UPDATE lots_stock SET qte_disponible=qte_disponible+$1 WHERE id=$2",
                        qte, existing["id"]
                    )
                else:
                    await conn.execute("""
                        INSERT INTO lots_stock (article_id,emplacement_id,numero_lot,qte_initiale,qte_disponible,prix_unitaire,date_dlc,statut)
                        VALUES ($1,$2,$3,$4,$4,$5,$6,'disponible')
                    """, article_id, emplacement_id, numero_lot, qte, prix, date_dlc)

            if emplacement_id:
                await conn.execute("""
                    INSERT INTO stock_articles (article_id,emplacement_id,qte_disponible,valeur_stock,derniere_entree)
                    VALUES ($1,$2,$3,$3*$4,NOW())
                    ON CONFLICT (article_id,emplacement_id)
                    DO UPDATE SET qte_disponible=stock_articles.qte_disponible+$3,
                        valeur_stock=stock_articles.valeur_stock+($3*$4), derniere_entree=NOW()
                """, article_id, emplacement_id, qte, prix)

            # Journal
            try:
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS journal_stock (
                        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        article_id UUID, emplacement_id INTEGER,
                        type VARCHAR(10), qte NUMERIC(12,3),
                        prix_unitaire NUMERIC(12,4) DEFAULT 0,
                        numero_lot VARCHAR(100), notes TEXT,
                        cree_par UUID, created_at TIMESTAMPTZ DEFAULT NOW()
                    )
                """)
                await conn.execute(
                    "INSERT INTO journal_stock (article_id,emplacement_id,type,qte,prix_unitaire,numero_lot,notes,cree_par) VALUES ($1,$2,'entree',$3,$4,$5,$6,$7)",
                    article_id, emplacement_id, qte, prix, numero_lot,
                    payload.get("notes"), user.get("id")
                )
            except Exception as je:
                print(f"Journal: {je}")
            return {"success": True, "message": f"Entree de {qte} enregistree"}

@app.post("/api/stock/sortie")
async def sortie_stock(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        async with conn.transaction():
            article_id = payload.get("article_id")
            emplacement_id = int(payload["emplacement_id"]) if payload.get("emplacement_id") not in (None, "", "null") else None
            qte = float(payload.get("qte", 0))
            if not article_id or qte <= 0:
                raise HTTPException(400, "Article et quantité requis")

            # Vérifier stock
            dispo = await conn.fetchval(
                "SELECT COALESCE(SUM(qte_disponible),0) FROM stock_articles WHERE article_id=$1",
                article_id
            )
            if float(dispo) < qte:
                raise HTTPException(400, f"Stock insuffisant: {dispo} disponible, {qte} demandé")

            if emplacement_id:
                await conn.execute(
                    "UPDATE stock_articles SET qte_disponible=GREATEST(0,qte_disponible-$1),derniere_sortie=NOW() WHERE article_id=$2 AND emplacement_id=$3",
                    qte, article_id, emplacement_id
                )
            else:
                await conn.execute(
                    "UPDATE stock_articles SET qte_disponible=GREATEST(0,qte_disponible-$1),derniere_sortie=NOW() WHERE article_id=$2",
                    qte, article_id
                )
            # Journal
            try:
                await conn.execute(
                    "INSERT INTO journal_stock (article_id,emplacement_id,type,qte,notes,cree_par) VALUES ($1,$2,'sortie',$3,$4,$5) ON CONFLICT DO NOTHING",
                    article_id, emplacement_id, qte, payload.get("notes"), user.get("id")
                )
            except Exception as je:
                print(f"Journal sortie: {je}")
            return {"success": True, "message": f"Sortie de {qte} enregistree"}

@app.get("/api/emplacements")
async def get_emplacements(user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT e.*, a.libelle AS atelier_libelle, a.code AS atelier_code
            FROM emplacements_stock e
            LEFT JOIN ateliers a ON a.id=e.atelier_id
            WHERE e.actif=true ORDER BY e.code
        """)
        return [dict(r) for r in rows]

# ── ROUTES VENTE ───────────────────────────────────────────────
@app.get("/api/vente/clients")
async def get_clients(search: Optional[str] = None, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        q = "SELECT * FROM clients_complet WHERE actif=true"
        params = []
        if search:
            params.append(f"%{search}%")
            q += f" AND (code ILIKE $1 OR raison_sociale ILIKE $1)"
        q += " ORDER BY raison_sociale LIMIT 200"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

@app.post("/api/vente/clients")
async def create_client(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        if not d.get("code") or not d.get("raison_sociale"):
            raise HTTPException(400, "Code et raison sociale requis")
        try:
            row = await conn.fetchrow("""
                INSERT INTO clients_complet (code,type,raison_sociale,contact_nom,telephone,email,adresse,ville,pays,nif,rc,condition_paiement,delai_paiement_jours,credit_limite,notes)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *
            """, d["code"].upper(), d.get("type","B2B"), d["raison_sociale"],
                d.get("contact_nom"), d.get("telephone"), d.get("email"),
                d.get("adresse"), d.get("ville"), d.get("pays","Algérie"),
                d.get("nif"), d.get("rc"),
                d.get("condition_paiement","30_jours"),
                int(d.get("delai_paiement_jours") or 30),
                float(d.get("credit_limite") or 0),
                d.get("notes"))
            return dict(row)
        except asyncpg.UniqueViolationError:
            raise HTTPException(400, "Code déjà existant")

@app.get("/api/vente/ventes")
async def get_ventes(statut: Optional[str] = None, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        q = """
            SELECT v.*, c.raison_sociale AS client_nom
            FROM ventes v LEFT JOIN clients_complet c ON c.id=v.client_id
            WHERE 1=1
        """
        params = []
        if statut:
            params.append(statut)
            q += f" AND v.statut=${len(params)}"
        q += " ORDER BY v.created_at DESC LIMIT 100"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

@app.post("/api/vente/ventes")
async def create_vente(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        async with conn.transaction():
            d = payload
            lignes = d.get("lignes", [])
            total_ht = sum(
                float(l["quantite"]) * float(l["prix_unitaire_ht"]) * (1 - float(l.get("taux_remise",0))/100)
                for l in lignes
            )
            tva = float(d.get("taux_tva", 19))
            total_tva = total_ht * tva / 100
            total_ttc = total_ht + total_tva

            vente = await conn.fetchrow("""
                INSERT INTO ventes (type_vente,statut,client_id,montant_ht,taux_tva,montant_tva,montant_ttc,mode_paiement,reference_client,notes,cree_par)
                VALUES ($1,'brouillon',$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
            """, d.get("type_vente","B2B"), d.get("client_id"),
                total_ht, tva, total_tva, total_ttc,
                d.get("mode_paiement","virement"),
                d.get("reference_client"), d.get("notes"),
                user.get("id"))

            for l in lignes:
                ht = float(l["quantite"]) * float(l["prix_unitaire_ht"])
                tv = ht * float(l.get("taux_tva",19)) / 100
                await conn.execute("""
                    INSERT INTO lignes_vente (vente_id,article_id,designation,quantite,prix_unitaire_ht,taux_tva,montant_ht,montant_tva,montant_ttc)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                """, str(vente["id"]), l.get("article_id"), l.get("designation",""),
                    float(l["quantite"]), float(l["prix_unitaire_ht"]),
                    float(l.get("taux_tva",19)), ht, tv, ht+tv)

            return dict(vente)

@app.put("/api/vente/ventes/{vente_id}/statut")
async def update_vente_statut(vente_id: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE ventes SET statut=$1 WHERE id=$2 RETURNING *",
            payload["statut"], vente_id
        )
        return dict(row)

@app.get("/api/vente/ventes/stats/resume")
async def ventes_stats(user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT
                COUNT(*) FILTER (WHERE statut!='annule') AS nb_ventes,
                COALESCE(SUM(montant_ttc) FILTER (WHERE statut!='annule'),0) AS ca_ttc,
                COALESCE(SUM(montant_paye),0) AS total_encaisse,
                COALESCE(SUM(solde_restant),0) AS total_restant,
                COUNT(*) FILTER (WHERE statut='brouillon') AS nb_brouillon
            FROM ventes
        """)
        return dict(row)

# ── ROUTES ACHAT ───────────────────────────────────────────────
@app.get("/api/achat/fournisseurs")
async def get_fournisseurs(search: Optional[str] = None, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        q = "SELECT * FROM fournisseurs WHERE actif=true"
        params = []
        if search:
            params.append(f"%{search}%")
            q += f" AND (code ILIKE $1 OR raison_sociale ILIKE $1)"
        q += " ORDER BY raison_sociale LIMIT 200"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

@app.post("/api/achat/fournisseurs")
async def create_fournisseur(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        if not d.get("code") or not d.get("raison_sociale"):
            raise HTTPException(400, "Code et raison sociale requis")
        try:
            row = await conn.fetchrow("""
                INSERT INTO fournisseurs (code,raison_sociale,contact_nom,telephone,email,adresse,ville,pays,nif,condition_paiement,delai_paiement_jours,notes)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
            """, d["code"].upper(), d["raison_sociale"],
                d.get("contact_nom"), d.get("telephone"), d.get("email"),
                d.get("adresse"), d.get("ville"), d.get("pays","Algérie"),
                d.get("nif"), d.get("condition_paiement","30_jours"),
                int(d.get("delai_paiement_jours") or 30), d.get("notes"))
            return dict(row)
        except asyncpg.UniqueViolationError:
            raise HTTPException(400, "Code déjà existant")

@app.get("/api/achat/commandes")
async def get_commandes(statut: Optional[str] = None, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        q = """
            SELECT ca.*, f.raison_sociale AS fournisseur_nom
            FROM commandes_achat ca LEFT JOIN fournisseurs f ON f.id=ca.fournisseur_id
            WHERE 1=1
        """
        params = []
        if statut:
            params.append(statut)
            q += f" AND ca.statut=${len(params)}"
        q += " ORDER BY ca.created_at DESC LIMIT 100"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

@app.post("/api/achat/commandes")
async def create_commande(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        async with conn.transaction():
            d = payload
            lignes = d.get("lignes", [])
            total_ht = sum(float(l["quantite_commandee"]) * float(l["prix_unitaire_ht"]) for l in lignes)
            tva = float(d.get("taux_tva", 19))
            total_tva = total_ht * tva / 100

            cmd = await conn.fetchrow("""
                INSERT INTO commandes_achat (statut,fournisseur_id,date_commande,montant_ht,taux_tva,montant_tva,montant_ttc,notes,cree_par)
                VALUES ('brouillon',$1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
            """, d.get("fournisseur_id"),
                d.get("date_commande") or "today",
                total_ht, tva, total_tva, total_ht+total_tva,
                d.get("notes"), user.get("id"))

            for l in lignes:
                ht = float(l["quantite_commandee"]) * float(l["prix_unitaire_ht"])
                await conn.execute("""
                    INSERT INTO lignes_achat (commande_id,article_id,designation,quantite_commandee,prix_unitaire_ht,taux_tva,montant_ht,montant_ttc)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                """, str(cmd["id"]), l.get("article_id"), l.get("designation",""),
                    float(l["quantite_commandee"]), float(l["prix_unitaire_ht"]),
                    float(l.get("taux_tva",19)), ht, ht*(1+float(l.get("taux_tva",19))/100))

            return dict(cmd)

@app.put("/api/achat/commandes/{cmd_id}/statut")
async def update_commande_statut(cmd_id: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE commandes_achat SET statut=$1 WHERE id=$2 RETURNING *",
            payload["statut"], cmd_id
        )
        return dict(row)


# ── MOUVEMENTS STOCK ──────────────────────────────────────────
@app.get("/api/stock/mouvements")
async def get_mouvements(limit: int = 50, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        try:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS journal_stock (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    article_id UUID REFERENCES articles(id),
                    emplacement_id INTEGER,
                    type VARCHAR(10) NOT NULL,
                    qte NUMERIC(12,3) NOT NULL,
                    prix_unitaire NUMERIC(12,4) DEFAULT 0,
                    numero_lot VARCHAR(100),
                    notes TEXT,
                    cree_par UUID,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            rows = await conn.fetch("""
                SELECT j.id, j.created_at, j.type, j.qte, j.numero_lot, j.notes,
                    j.prix_unitaire,
                    a.code AS article_code, a.designation AS article_designation,
                    e.code AS emplacement_code
                FROM journal_stock j
                JOIN articles a ON a.id=j.article_id
                LEFT JOIN emplacements_stock e ON e.id=j.emplacement_id
                ORDER BY j.created_at DESC
                LIMIT $1
            """, limit)
            return [dict(r) for r in rows]
        except Exception as e:
            print(f"Erreur mouvements: {e}")
            return []


@app.post("/api/stock/lots")
async def creer_lot(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        async with conn.transaction():
            d = payload
            if not d.get("article_id"):
                raise HTTPException(400, "Article requis")
            if not d.get("numero_lot"):
                raise HTTPException(400, "Numéro de lot requis")
            qte = float(d.get("qte_initiale", 0))
            if qte <= 0:
                raise HTTPException(400, "Quantité requise")
            
            emplacement_id = int(d["emplacement_id"]) if d.get("emplacement_id") not in (None,"","null") else None
            prix = float(d.get("prix_unitaire", 0) or 0)
            
            try:
                row = await conn.fetchrow("""
                    INSERT INTO lots_stock (
                        article_id, emplacement_id, numero_lot,
                        qte_initiale, qte_disponible, prix_unitaire,
                        date_fabrication, date_dlc, date_dluo,
                        date_reception, statut
                    ) VALUES ($1,$2,$3,$4,$4,$5,$6,$7,$8,CURRENT_DATE,'disponible')
                    RETURNING *
                """,
                    d["article_id"], emplacement_id, d["numero_lot"],
                    qte, prix,
                    d.get("date_fabrication") or None,
                    d.get("date_dlc") or None,
                    d.get("date_dluo") or None,
                )
            except asyncpg.UniqueViolationError:
                raise HTTPException(400, "Ce numéro de lot existe déjà")
            
            if emplacement_id:
                await conn.execute("""
                    INSERT INTO stock_articles (article_id,emplacement_id,qte_disponible,valeur_stock,derniere_entree)
                    VALUES ($1,$2,$3,$3*$4,NOW())
                    ON CONFLICT (article_id,emplacement_id)
                    DO UPDATE SET
                        qte_disponible=stock_articles.qte_disponible+$3,
                        valeur_stock=stock_articles.valeur_stock+($3*$4),
                        derniere_entree=NOW()
                """, d["article_id"], emplacement_id, qte, prix)
            
            return dict(row)

@app.put("/api/stock/lots/{lot_id}")
async def update_lot_statut(lot_id: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        valid = ['disponible','quarantaine','bloque','perime','epuise']
        if payload.get("statut") not in valid:
            raise HTTPException(400, "Statut invalide")
        row = await conn.fetchrow(
            "UPDATE lots_stock SET statut=$1 WHERE id=$2 RETURNING *",
            payload["statut"], lot_id
        )
        return dict(row)

# ── HEALTH CHECK ───────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok", "api": "NAIdo Python FastAPI v4.0"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=3000, reload=False)
