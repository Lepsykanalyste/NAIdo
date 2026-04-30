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

# Import stock routes module
from stock_routes import inventaire_handler, resume_handler, mouvement_handler
# Import GMAO routes module
from gmao_routes import (
    gmao_dashboard, get_equipements, create_equipement,
    get_ots, create_ot, update_ot,
    get_plans, create_plan, generer_ot_depuis_plan,
    get_pieces, get_indicateurs_equipement,
    get_releves_energie, dashboard_energie
)
# Import RH routes module
from rh_routes import (
    rh_dashboard, get_postes, get_employes, create_employe,
    get_contrats, create_contrat,
    get_conges, create_conge, valider_conge,
    get_bulletins, generer_bulletin,
    get_presences, get_evaluations
)
# Import QHSE routes module
from qhse_routes import (
    qhse_dashboard, get_processus_list, create_processus, update_processus,
    get_nc_list, create_nc, update_nc,
    get_documents_list, get_audits_list, create_audit,
    get_risques_list, get_indicateurs,
    get_accidents_list, get_habilitations_list
)

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
async def get_inventaire(
    search: Optional[str] = None,
    atelier_id: Optional[str] = None,
    type_article: Optional[str] = None,
    user=Depends(get_current_user)
):
    """Inventaire par emplacement/atelier"""
    return await inventaire_handler(pool, search, atelier_id, type_article)

@app.get("/api/stock/resume")
async def get_stock_resume(user=Depends(get_current_user)):
    """KPIs stock globaux"""
    return await resume_handler(pool)

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
    """Entrée manuelle en stock"""
    try:
        t = payload.get("type_mouvement", "entree_manuelle")
        if t not in ("entree_manuelle","entree_achat","entree_production","retour"):
            t = "entree_manuelle"
        return await mouvement_handler(pool, payload, t, user.get("id"))
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/stock/entree_raw")
async def entree_stock_raw(payload: dict, user=Depends(get_current_user)):
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
    """Sortie manuelle du stock"""
    try:
        t = payload.get("type_mouvement", "sortie_manuelle")
        if t not in ("sortie_manuelle","sortie_vente","sortie_production","rebut"):
            t = "sortie_manuelle"
        return await mouvement_handler(pool, payload, t, user.get("id"))
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/stock/sortie_raw")
async def sortie_stock_raw(payload: dict, user=Depends(get_current_user)):
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

@app.post("/api/stock/transfert")
async def transfert_stock(payload: dict, user=Depends(get_current_user)):
    """Transfert entre emplacements (= bon de cession automatique)"""
    try:
        return await mouvement_handler(pool, payload, "transfert", user.get("id"))
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


# ══════════════════════════════════════════════════════════════
# ROUTES QHSE
# ══════════════════════════════════════════════════════════════

@app.get("/api/qhse/dashboard")
async def get_qhse_dashboard(user=Depends(get_current_user)):
    return await qhse_dashboard(pool)

# ── PROCESSUS ─────────────────────────────────────────────────
@app.get("/api/qhse/processus")
async def api_get_processus(type_processus: Optional[str]=None, search: Optional[str]=None, user=Depends(get_current_user)):
    return await get_processus_list(pool, type_processus, search)

@app.post("/api/qhse/processus")
async def api_create_processus(payload: dict, user=Depends(get_current_user)):
    try: return await create_processus(pool, payload, user.get("id"))
    except Exception as e: raise HTTPException(400, str(e))

@app.put("/api/qhse/processus/{proc_id}")
async def api_update_processus(proc_id: str, payload: dict, user=Depends(get_current_user)):
    result = await update_processus(pool, proc_id, payload)
    if not result: raise HTTPException(404, "Processus introuvable")
    return result

@app.delete("/api/qhse/processus/{proc_id}")
async def api_delete_processus(proc_id: str, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        await conn.execute("UPDATE processus SET actif=false WHERE id=$1", proc_id)
    return {"success": True}

# ── NON-CONFORMITÉS ───────────────────────────────────────────
@app.get("/api/qhse/nc")
async def api_get_nc(statut: Optional[str]=None, type_nc: Optional[str]=None,
                     gravite: Optional[str]=None, search: Optional[str]=None,
                     user=Depends(get_current_user)):
    return await get_nc_list(pool, statut, type_nc, gravite, search)

@app.post("/api/qhse/nc")
async def api_create_nc(payload: dict, user=Depends(get_current_user)):
    try: return await create_nc(pool, payload, user.get("id"))
    except Exception as e: raise HTTPException(400, str(e))

@app.put("/api/qhse/nc/{nc_id}")
async def api_update_nc(nc_id: str, payload: dict, user=Depends(get_current_user)):
    result = await update_nc(pool, nc_id, payload)
    if not result: raise HTTPException(404, "NC introuvable")
    return result

@app.get("/api/qhse/nc/{nc_id}")
async def api_get_nc_detail(nc_id: str, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM non_conformites WHERE id=$1", nc_id)
        if not row: raise HTTPException(404, "NC introuvable")
        return dict(row)

# ── DOCUMENTS ─────────────────────────────────────────────────
@app.get("/api/qhse/documents")
async def api_get_documents(processus_id: Optional[str]=None, type_document: Optional[str]=None,
                            statut: Optional[str]=None, search: Optional[str]=None,
                            user=Depends(get_current_user)):
    return await get_documents_list(pool, processus_id, type_document, statut, search)

@app.post("/api/qhse/documents")
async def api_create_document(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        if not d.get("code") or not d.get("titre"):
            raise HTTPException(400, "Code et titre requis")
        try:
            row = await conn.fetchrow("""
                INSERT INTO documents_qhse (
                    code, titre, type_document, processus_id,
                    normes_applicables, version, description,
                    redacteur_id, date_redaction, date_prochaine_revision,
                    statut, mots_cles
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'brouillon',$11)
                RETURNING *
            """,
                d["code"].upper(), d["titre"], d.get("type_document","procedure"),
                d.get("processus_id") or None,
                json.dumps(safe_json(d.get("normes_applicables"), [])),
                d.get("version","v1"), d.get("description"),
                d.get("redacteur_id") or user.get("id"),
                d.get("date_redaction") or None,
                d.get("date_prochaine_revision") or None,
                d.get("mots_cles")
            )
            return dict(row)
        except asyncpg.UniqueViolationError:
            raise HTTPException(400, "Code document déjà existant")

@app.put("/api/qhse/documents/{doc_id}/statut")
async def api_update_doc_statut(doc_id: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        statut = payload.get("statut")
        extra = ""
        if statut == "approuve":
            extra = ", date_approbation=CURRENT_DATE, approbateur_id='" + user.get("id","") + "'"
        elif statut == "en_verification":
            extra = ", date_verification=CURRENT_DATE"
        row = await conn.fetchrow(
            f"UPDATE documents_qhse SET statut=$1{extra}, updated_at=NOW() WHERE id=$2 RETURNING *",
            statut, doc_id
        )
        return dict(row)

# ── AUDITS ────────────────────────────────────────────────────
@app.get("/api/qhse/audits")
async def api_get_audits(statut: Optional[str]=None, norme: Optional[str]=None, user=Depends(get_current_user)):
    return await get_audits_list(pool, statut, norme)

@app.post("/api/qhse/audits")
async def api_create_audit(payload: dict, user=Depends(get_current_user)):
    try: return await create_audit(pool, payload, user.get("id"))
    except Exception as e: raise HTTPException(400, str(e))

@app.put("/api/qhse/audits/{audit_id}")
async def api_update_audit(audit_id: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        row = await conn.fetchrow("""
            UPDATE audits SET statut=$1, date_realisation=$2,
                nb_ecarts_majeurs=$3, nb_ecarts_mineurs=$4,
                nb_observations=$5, nb_points_forts=$6, conclusion=$7
            WHERE id=$8 RETURNING *
        """,
            d.get("statut"), d.get("date_realisation") or None,
            int(d.get("nb_ecarts_majeurs",0) or 0), int(d.get("nb_ecarts_mineurs",0) or 0),
            int(d.get("nb_observations",0) or 0), int(d.get("nb_points_forts",0) or 0),
            d.get("conclusion"), audit_id
        )
        return dict(row)

# ── RISQUES ───────────────────────────────────────────────────
@app.get("/api/qhse/risques")
async def api_get_risques(type: Optional[str]=None, categorie: Optional[str]=None, user=Depends(get_current_user)):
    return await get_risques_list(pool, type, categorie)

@app.post("/api/qhse/risques")
async def api_create_risque(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        row = await conn.fetchrow("""
            INSERT INTO risques_opportunites (
                type, categorie, titre, description,
                processus_id, norme_ref,
                probabilite, gravite, detectabilite,
                plan_traitement, responsable_id, date_echeance, statut
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
            RETURNING *
        """,
            d.get("type","risque"), d.get("categorie","qualite"),
            d["titre"], d.get("description"),
            d.get("processus_id") or None, d.get("norme_ref"),
            int(d.get("probabilite",1) or 1), int(d.get("gravite",1) or 1),
            int(d.get("detectabilite",1) or 1),
            d.get("plan_traitement"),
            d.get("responsable_id") or None,
            d.get("date_echeance") or None,
            d.get("statut","identifie")
        )
        return dict(row)

@app.put("/api/qhse/risques/{risque_id}")
async def api_update_risque(risque_id: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        row = await conn.fetchrow("""
            UPDATE risques_opportunites SET
                statut=$1, plan_traitement=$2,
                probabilite_residuelle=$3, gravite_residuelle=$4,
                criticite_residuelle=$5
            WHERE id=$6 RETURNING *
        """,
            d.get("statut"), d.get("plan_traitement"),
            int(d.get("probabilite_residuelle",1) or 1),
            int(d.get("gravite_residuelle",1) or 1),
            int(d.get("probabilite_residuelle",1) or 1) * int(d.get("gravite_residuelle",1) or 1),
            risque_id
        )
        return dict(row)

# ── INDICATEURS ───────────────────────────────────────────────
@app.get("/api/qhse/indicateurs")
async def api_get_indicateurs(processus_id: Optional[str]=None, user=Depends(get_current_user)):
    return await get_indicateurs(pool, processus_id)

@app.post("/api/qhse/indicateurs")
async def api_create_indicateur(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        row = await conn.fetchrow("""
            INSERT INTO indicateurs_qhse (
                code, libelle, processus_id, norme_associee,
                formule, unite, frequence_mesure,
                objectif_valeur, seuil_alerte, sens, responsable_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            RETURNING *
        """,
            d["code"].upper(), d["libelle"],
            d.get("processus_id") or None, d.get("norme_associee"),
            d.get("formule"), d.get("unite"), d.get("frequence_mesure","mensuel"),
            float(d.get("objectif_valeur",0) or 0),
            float(d.get("seuil_alerte",0) or 0) if d.get("seuil_alerte") else None,
            d.get("sens","hausse"),
            d.get("responsable_id") or None
        )
        return dict(row)

@app.post("/api/qhse/indicateurs/{ind_id}/valeur")
async def api_saisir_valeur(ind_id: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO valeurs_indicateurs (indicateur_id, periode, valeur, commentaire, saisi_par)
            VALUES ($1,$2,$3,$4,$5)
            ON CONFLICT (indicateur_id, periode) DO UPDATE SET valeur=$3, commentaire=$4
            RETURNING *
        """,
            ind_id, payload.get("periode") or date.today().isoformat(),
            float(payload["valeur"]), payload.get("commentaire"),
            user.get("id")
        )
        return dict(row)

@app.get("/api/qhse/indicateurs/{ind_id}/historique")
async def api_historique_indicateur(ind_id: str, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM valeurs_indicateurs WHERE indicateur_id=$1 ORDER BY periode DESC LIMIT 24",
            ind_id
        )
        return [dict(r) for r in rows]

# ── ACCIDENTS SST ─────────────────────────────────────────────
@app.get("/api/qhse/accidents")
async def api_get_accidents(type: Optional[str]=None, statut: Optional[str]=None, user=Depends(get_current_user)):
    return await get_accidents_list(pool, type, statut)

@app.post("/api/qhse/accidents")
async def api_create_accident(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        row = await conn.fetchrow("""
            INSERT INTO accidents_incidents (
                type, gravite_sst, titre, description,
                atelier_id, machine_id, victime_nom, victime_id,
                temoins, date_accident, nb_jours_arret,
                cause_immediate, action_immediate, cout_estime
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            RETURNING *
        """,
            d.get("type","incident"), d.get("gravite_sst","leger"),
            d["titre"], d.get("description",""),
            int_or_none(d.get("atelier_id")), int_or_none(d.get("machine_id")),
            d.get("victime_nom"), d.get("victime_id") or None,
            d.get("temoins"),
            d.get("date_accident") or datetime.utcnow().isoformat(),
            int(d.get("nb_jours_arret",0) or 0),
            d.get("cause_immediate"), d.get("action_immediate"),
            float(d.get("cout_estime",0) or 0)
        )
        return dict(row)

# ── HABILITATIONS ─────────────────────────────────────────────
@app.get("/api/qhse/habilitations")
async def api_get_habilitations(utilisateur_id: Optional[str]=None,
                                expiration_proche: bool=False,
                                user=Depends(get_current_user)):
    return await get_habilitations_list(pool, utilisateur_id, expiration_proche)

@app.post("/api/qhse/habilitations")
async def api_create_habilitation(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        row = await conn.fetchrow("""
            INSERT INTO habilitations (
                utilisateur_id, type_habilitation, numero,
                organisme_delivrant, date_obtention, date_expiration,
                statut, notes
            ) VALUES ($1,$2,$3,$4,$5,$6,'valide',$7)
            RETURNING *
        """,
            d["utilisateur_id"], d["type_habilitation"], d.get("numero"),
            d.get("organisme_delivrant"),
            d.get("date_obtention") or None,
            d.get("date_expiration") or None,
            d.get("notes")
        )
        return dict(row)

# ── NORMES ────────────────────────────────────────────────────
@app.get("/api/qhse/normes")
async def api_get_normes(user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM normes_qhse WHERE actif=true ORDER BY code")
        return [dict(r) for r in rows]



# ══════════════════════════════════════════════════════════════
# ROUTES GMAO
# ══════════════════════════════════════════════════════════════

@app.get("/api/gmao/dashboard")
async def api_gmao_dashboard(user=Depends(get_current_user)):
    return await gmao_dashboard(pool)

# ── ÉQUIPEMENTS ───────────────────────────────────────────────
@app.get("/api/gmao/equipements")
async def api_get_equipements(search: Optional[str]=None, statut: Optional[str]=None,
                               atelier_id: Optional[str]=None, criticite: Optional[str]=None,
                               user=Depends(get_current_user)):
    return await get_equipements(pool, search, statut, atelier_id, criticite)

@app.get("/api/gmao/equipements/{eq_id}")
async def api_get_equipement(eq_id: str, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM equipements WHERE id=$1", eq_id)
        if not row: raise HTTPException(404, "Équipement introuvable")
        return dict(row)

@app.post("/api/gmao/equipements")
async def api_create_equipement(payload: dict, user=Depends(get_current_user)):
    try: return await create_equipement(pool, payload, user.get("id"))
    except ValueError as e: raise HTTPException(400, str(e))

@app.put("/api/gmao/equipements/{eq_id}")
async def api_update_equipement(eq_id: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        row = await conn.fetchrow("""
            UPDATE equipements SET
                designation=$1, statut=$2, criticite=$3,
                atelier_id=$4, localisation=$5,
                responsable_id=$6, compteur_heures=$7, notes=$8
            WHERE id=$9 RETURNING *
        """,
            d.get("designation"), d.get("statut","en_service"),
            d.get("criticite","normale"),
            int(d["atelier_id"]) if d.get("atelier_id") else None,
            d.get("localisation"), d.get("responsable_id") or None,
            float(d.get("compteur_heures",0) or 0),
            d.get("notes"), eq_id
        )
        return dict(row)

@app.get("/api/gmao/equipements/{eq_id}/indicateurs")
async def api_indicateurs_equipement(eq_id: str, user=Depends(get_current_user)):
    try: return await get_indicateurs_equipement(pool, eq_id)
    except ValueError as e: raise HTTPException(404, str(e))

@app.get("/api/gmao/disponibilite")
async def api_disponibilite(user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM vue_disponibilite_equipements")
        return [dict(r) for r in rows]

# ── ORDRES DE TRAVAIL ─────────────────────────────────────────
@app.get("/api/gmao/ots")
async def api_get_ots(statut: Optional[str]=None, type_ot: Optional[str]=None,
                       equipement_id: Optional[str]=None, priorite: Optional[str]=None,
                       user=Depends(get_current_user)):
    return await get_ots(pool, statut, type_ot, equipement_id, priorite)

@app.get("/api/gmao/ots/{ot_id}")
async def api_get_ot(ot_id: str, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT ot.*, e.code AS equipement_code, e.designation AS equipement_designation,
                u.nom||' '||u.prenom AS technicien_nom
            FROM ordres_travail ot
            LEFT JOIN equipements e ON e.id=ot.equipement_id
            LEFT JOIN utilisateurs u ON u.id=ot.technicien_id
            WHERE ot.id=$1
        """, ot_id)
        if not row: raise HTTPException(404, "OT introuvable")
        return dict(row)

@app.post("/api/gmao/ots")
async def api_create_ot(payload: dict, user=Depends(get_current_user)):
    try: return await create_ot(pool, payload, user.get("id"))
    except Exception as e: raise HTTPException(400, str(e))

@app.put("/api/gmao/ots/{ot_id}")
async def api_update_ot(ot_id: str, payload: dict, user=Depends(get_current_user)):
    try: return await update_ot(pool, ot_id, payload, user.get("id"))
    except Exception as e: raise HTTPException(400, str(e))

# ── PLANS DE MAINTENANCE ──────────────────────────────────────
@app.get("/api/gmao/plans")
async def api_get_plans(equipement_id: Optional[str]=None, echeance_proche: bool=False,
                         user=Depends(get_current_user)):
    return await get_plans(pool, equipement_id, echeance_proche)

@app.post("/api/gmao/plans")
async def api_create_plan(payload: dict, user=Depends(get_current_user)):
    try: return await create_plan(pool, payload, user.get("id"))
    except Exception as e: raise HTTPException(400, str(e))

@app.post("/api/gmao/plans/{plan_id}/generer-ot")
async def api_generer_ot(plan_id: str, user=Depends(get_current_user)):
    try: return await generer_ot_depuis_plan(pool, plan_id, user.get("id"))
    except ValueError as e: raise HTTPException(400, str(e))

@app.put("/api/gmao/plans/{plan_id}/realiser")
async def api_realiser_plan(plan_id: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        date_real = payload.get("date_realisation") or date.today().isoformat()
        plan = await conn.fetchrow("SELECT * FROM plans_maintenance WHERE id=$1", plan_id)
        if not plan: raise HTTPException(404, "Plan introuvable")
        from datetime import timedelta
        p, pt = plan["periodicite_valeur"], plan["periodicite_type"]
        d = date.fromisoformat(date_real)
        if pt=="jours": prochaine = d+timedelta(days=p)
        elif pt=="semaines": prochaine = d+timedelta(weeks=p)
        else: prochaine = d+timedelta(days=p*30)
        row = await conn.fetchrow(
            "UPDATE plans_maintenance SET derniere_realisation=$1, prochaine_echeance=$2 WHERE id=$3 RETURNING *",
            date_real, prochaine.isoformat(), plan_id
        )
        return dict(row)

# ── PIÈCES DÉTACHÉES ──────────────────────────────────────────
@app.get("/api/gmao/pieces")
async def api_get_pieces(search: Optional[str]=None, alerte_stock: bool=False,
                          user=Depends(get_current_user)):
    return await get_pieces(pool, search, alerte_stock)

@app.post("/api/gmao/pieces")
async def api_create_piece(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        try:
            row = await conn.fetchrow("""
                INSERT INTO pieces_detachees (
                    code, designation, famille, unite,
                    qte_stock, qte_minimum, qte_maximum, prix_unitaire,
                    fournisseur_id, reference_fournisseur,
                    delai_livraison_jours, emplacement_magasin
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                RETURNING *
            """,
                d["code"].upper(), d["designation"], d.get("famille"), d.get("unite","pcs"),
                int(d.get("qte_stock",0) or 0), int(d.get("qte_minimum",0) or 0),
                int(d.get("qte_maximum",100) or 100), float(d.get("prix_unitaire",0) or 0),
                d.get("fournisseur_id") or None, d.get("reference_fournisseur"),
                int(d.get("delai_livraison_jours",7) or 7), d.get("emplacement_magasin")
            )
            return dict(row)
        except Exception as e:
            raise HTTPException(400, str(e))

@app.put("/api/gmao/pieces/{piece_id}/stock")
async def api_update_stock_piece(piece_id: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        mouvement = payload.get("mouvement","entree")
        qte = int(payload.get("qte",0))
        if mouvement == "entree":
            row = await conn.fetchrow(
                "UPDATE pieces_detachees SET qte_stock=qte_stock+$1 WHERE id=$2 RETURNING *",
                qte, piece_id
            )
        else:
            row = await conn.fetchrow(
                "UPDATE pieces_detachees SET qte_stock=GREATEST(0,qte_stock-$1) WHERE id=$2 RETURNING *",
                qte, piece_id
            )
        return dict(row)

# ── HISTORIQUE PANNES ─────────────────────────────────────────
@app.get("/api/gmao/pannes")
async def api_get_pannes(equipement_id: Optional[str]=None, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        q = """
            SELECT hp.*, e.code AS eq_code, e.designation AS eq_designation
            FROM historique_pannes hp
            JOIN equipements e ON e.id=hp.equipement_id
            WHERE 1=1
        """
        params = []
        if equipement_id:
            params.append(equipement_id)
            q += f" AND hp.equipement_id=${len(params)}"
        q += " ORDER BY hp.date_panne DESC LIMIT 100"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]


# ── ÉNERGIE ───────────────────────────────────────────────────
@app.get("/api/gmao/energie/dashboard")
async def api_energie_dashboard(mois: Optional[str]=None, user=Depends(get_current_user)):
    return await dashboard_energie(pool, mois)

@app.get("/api/gmao/energie/releves")
async def api_get_releves(equipement_id: Optional[str]=None, mois: Optional[str]=None,
                           atelier_id: Optional[str]=None, user=Depends(get_current_user)):
    return await get_releves_energie(pool, equipement_id, mois, atelier_id)

@app.post("/api/gmao/energie/releves")
async def api_create_releve(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        if not d.get("equipement_id") or not d.get("date_releve"):
            raise HTTPException(400, "Équipement et date requis")
        heures = float(d.get("heures_marche",0) or 0)
        idx_debut = float(d.get("index_debut",0) or 0)
        idx_fin = float(d.get("index_fin",0) or 0)
        conso = idx_fin - idx_debut
        puissance_moy = round(conso/heures, 3) if heures > 0 else None
        row = await conn.fetchrow("""
            INSERT INTO releves_energie (
                equipement_id, atelier_id, date_releve, shift,
                index_debut, index_fin, heures_marche,
                puissance_moyenne_kw, quantite_produite, unite_production,
                operateur_id, notes
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            RETURNING *
        """,
            d["equipement_id"],
            int(d["atelier_id"]) if d.get("atelier_id") else None,
            d["date_releve"], d.get("shift","journee"),
            idx_debut, idx_fin, heures, puissance_moy,
            float(d.get("quantite_produite",0) or 0) or None,
            d.get("unite_production"),
            d.get("operateur_id") or user.get("id"),
            d.get("notes")
        )
        return dict(row)

@app.get("/api/gmao/energie/mensuel")
async def api_conso_mensuelle(user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM vue_conso_mensuelle LIMIT 100")
        return [dict(r) for r in rows]

@app.get("/api/gmao/energie/parametres")
async def api_get_parametres_energie(user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM parametres_energie LIMIT 1")
        return dict(row) if row else {"tarif_kwh": 105.0}

@app.put("/api/gmao/energie/parametres")
async def api_update_parametres_energie(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        tarif = float(payload.get("tarif_kwh", 105))
        await conn.execute(
            "UPDATE parametres_energie SET tarif_kwh=$1, updated_at=NOW()",
            tarif
        )
        return {"tarif_kwh": tarif, "message": "Tarif mis à jour"}

# ══════════════════════════════════════════════════════════════
# ROUTES RH
# ══════════════════════════════════════════════════════════════

@app.get("/api/rh/dashboard")
async def api_rh_dashboard(user=Depends(get_current_user)):
    return await rh_dashboard(pool)

@app.get("/api/rh/postes")
async def api_get_postes(user=Depends(get_current_user)):
    return await get_postes(pool)

@app.post("/api/rh/postes")
async def api_create_poste(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        row = await conn.fetchrow("""
            INSERT INTO postes (code,intitule,departement,niveau,description)
            VALUES ($1,$2,$3,$4,$5) RETURNING *
        """, d["code"].upper(), d["intitule"], d.get("departement"),
            d.get("niveau"), d.get("description"))
        return dict(row)

@app.get("/api/rh/employes")
async def api_get_employes(search: Optional[str]=None, statut: Optional[str]=None,
                            atelier_id: Optional[str]=None, poste_id: Optional[str]=None,
                            user=Depends(get_current_user)):
    return await get_employes(pool, search, statut, atelier_id, poste_id)

@app.get("/api/rh/employes/{emp_id}")
async def api_get_employe(emp_id: str, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT e.*, p.intitule AS poste_libelle, p.departement,
                at.libelle AS atelier_libelle
            FROM employes e
            LEFT JOIN postes p ON p.id=e.poste_id
            LEFT JOIN ateliers at ON at.id=e.atelier_id
            WHERE e.id=$1
        """, emp_id)
        if not row: raise HTTPException(404, "Employé introuvable")
        return dict(row)

@app.post("/api/rh/employes")
async def api_create_employe(payload: dict, user=Depends(get_current_user)):
    try: return await create_employe(pool, payload, user.get("id"))
    except ValueError as e: raise HTTPException(400, str(e))

@app.put("/api/rh/employes/{emp_id}")
async def api_update_employe(emp_id: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        sets, vals = [], []
        def add(col, val): vals.append(val); sets.append(f"{col}=${len(vals)}")
        for f in ["nom","prenom","telephone","email","adresse","statut","poste_id","atelier_id","notes"]:
            if f in d: add(f, d[f] if f not in ("poste_id","atelier_id") else (int(d[f]) if d[f] else None))
        if not sets: return {"message": "Rien à modifier"}
        vals.append(emp_id)
        row = await conn.fetchrow(f"UPDATE employes SET {','.join(sets)} WHERE id=${len(vals)} RETURNING *", *vals)
        return dict(row)

@app.get("/api/rh/contrats")
async def api_get_contrats(employe_id: Optional[str]=None, user=Depends(get_current_user)):
    return await get_contrats(pool, employe_id)

@app.post("/api/rh/contrats")
async def api_create_contrat(payload: dict, user=Depends(get_current_user)):
    try: return await create_contrat(pool, payload)
    except Exception as e: raise HTTPException(400, str(e))

@app.get("/api/rh/conges")
async def api_get_conges(employe_id: Optional[str]=None, statut: Optional[str]=None,
                          annee: Optional[str]=None, user=Depends(get_current_user)):
    return await get_conges(pool, employe_id, statut, annee)

@app.post("/api/rh/conges")
async def api_create_conge(payload: dict, user=Depends(get_current_user)):
    try: return await create_conge(pool, payload, user.get("id"))
    except Exception as e: raise HTTPException(400, str(e))

@app.put("/api/rh/conges/{conge_id}/valider")
async def api_valider_conge(conge_id: str, payload: dict, user=Depends(get_current_user)):
    try:
        return await valider_conge(pool, conge_id, payload["statut"],
                                   user.get("id"), payload.get("commentaire"))
    except Exception as e: raise HTTPException(400, str(e))

@app.get("/api/rh/bulletins")
async def api_get_bulletins(employe_id: Optional[str]=None, periode: Optional[str]=None,
                             user=Depends(get_current_user)):
    return await get_bulletins(pool, employe_id, periode)

@app.post("/api/rh/bulletins")
async def api_generer_bulletin(payload: dict, user=Depends(get_current_user)):
    try: return await generer_bulletin(pool, payload, user.get("id"))
    except ValueError as e: raise HTTPException(400, str(e))
    except Exception as e: raise HTTPException(500, str(e))

@app.put("/api/rh/bulletins/{bul_id}/statut")
async def api_update_bulletin_statut(bul_id: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE bulletins_paie SET statut=$1 WHERE id=$2 RETURNING *",
            payload["statut"], bul_id
        )
        return dict(row)

@app.get("/api/rh/presences")
async def api_get_presences(employe_id: Optional[str]=None,
                             date_debut: Optional[str]=None,
                             date_fin: Optional[str]=None,
                             user=Depends(get_current_user)):
    return await get_presences(pool, employe_id, date_debut, date_fin)

@app.post("/api/rh/presences")
async def api_saisir_presence(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        row = await conn.fetchrow("""
            INSERT INTO presences (employe_id,date_presence,heure_entree,heure_sortie,
                heures_travaillees,heures_supp,type_presence,notes,saisi_par)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            ON CONFLICT (employe_id,date_presence)
            DO UPDATE SET heure_sortie=$4, heures_travaillees=$5, heures_supp=$6, notes=$8
            RETURNING *
        """,
            d["employe_id"], d["date_presence"],
            d.get("heure_entree") or None, d.get("heure_sortie") or None,
            float(d.get("heures_travaillees",8) or 8),
            float(d.get("heures_supp",0) or 0),
            d.get("type_presence","present"), d.get("notes"),
            user.get("id")
        )
        return dict(row)

@app.get("/api/rh/evaluations")
async def api_get_evaluations(employe_id: Optional[str]=None, user=Depends(get_current_user)):
    return await get_evaluations(pool, employe_id)

@app.post("/api/rh/evaluations")
async def api_create_evaluation(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        notes = [d.get(f"note_{k}") for k in ["qualite_travail","productivite","ponctualite","esprit_equipe","initiative","securite"]]
        notes_valides = [float(n) for n in notes if n]
        note_globale = sum(notes_valides)/len(notes_valides) if notes_valides else None
        row = await conn.fetchrow("""
            INSERT INTO evaluations (
                employe_id, evaluateur_id, periode, date_evaluation,
                note_qualite_travail, note_productivite, note_ponctualite,
                note_esprit_equipe, note_initiative, note_securite, note_globale,
                points_forts, axes_amelioration, objectifs_prochaine_periode, statut
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'brouillon')
            RETURNING *
        """,
            d["employe_id"], d.get("evaluateur_id") or user.get("id"),
            d.get("periode"), d.get("date_evaluation") or date.today().isoformat(),
            float(d.get("note_qualite_travail",0) or 0) or None,
            float(d.get("note_productivite",0) or 0) or None,
            float(d.get("note_ponctualite",0) or 0) or None,
            float(d.get("note_esprit_equipe",0) or 0) or None,
            float(d.get("note_initiative",0) or 0) or None,
            float(d.get("note_securite",0) or 0) or None,
            round(note_globale, 2) if note_globale else None,
            d.get("points_forts"), d.get("axes_amelioration"),
            d.get("objectifs_prochaine_periode")
        )
        return dict(row)

# RH dans nginx aussi

@app.patch("/api/articles/{article_id}/production")
async def update_article_production(article_id: str, payload: dict, user=Depends(get_current_user)):
    """Met à jour les données de production d'un article"""
    async with pool.acquire() as conn:
        d = payload
        row = await conn.fetchrow("""
            UPDATE articles SET
                cadence_heure = $1,
                temps_cycle_min = $2,
                temps_reglage_min = $3,
                conso_mp_kg = $4,
                taux_rebut_std = $5,
                machines_ids = $6
            WHERE id = $7
            RETURNING id, code, designation, cadence_heure, temps_cycle_min,
                      temps_reglage_min, conso_mp_kg, taux_rebut_std, machines_ids
        """,
            int(d["cadence_heure"]) if d.get("cadence_heure") else None,
            float(d["temps_cycle_min"]) if d.get("temps_cycle_min") else None,
            float(d.get("temps_reglage_min", 30) or 30),
            float(d["conso_mp_kg"]) if d.get("conso_mp_kg") else None,
            float(d.get("taux_rebut_std", 2) or 2),
            json.dumps(d.get("machines_ids", [])),
            article_id
        )
        if not row:
            raise HTTPException(404, "Article introuvable")
        return dict(row)

@app.get("/api/articles/{article_id}/temps-production")
async def calcul_temps_production(
    article_id: str,
    quantite: float = 1000,
    user=Depends(get_current_user)
):
    """Calcule le temps de production selon la formule du cahier des charges"""
    async with pool.acquire() as conn:
        art = await conn.fetchrow("SELECT * FROM articles WHERE id=$1", article_id)
        if not art:
            raise HTTPException(404, "Article introuvable")
        
        cadence = art["cadence_heure"] or 0
        temps_reglage = float(art["temps_reglage_min"] or 30) / 60  # en heures
        
        if cadence > 0:
            temps_prod = quantite / cadence + temps_reglage
        else:
            temps_prod = None
        
        return {
            "article_id": article_id,
            "article_code": art["code"],
            "designation": art["designation"],
            "quantite": quantite,
            "cadence_heure": cadence,
            "temps_reglage_h": temps_reglage,
            "temps_production_h": round(temps_prod, 2) if temps_prod else None,
            "formule": f"({quantite} / {cadence}) + {temps_reglage:.2f}h = {round(temps_prod,2) if temps_prod else '?'}h",
        }



# ══════════════════════════════════════════════════════════════
# IA — GROQ + MISTRAL avec bascule automatique
# ══════════════════════════════════════════════════════════════

import httpx

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions"

async def get_ia_keys(pool):
    """Récupère les clés API depuis les paramètres système"""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT cle, valeur FROM parametres_systeme WHERE cle IN ($1,$2,$3,$4)",
            'groq_api_key', 'mistral_api_key', 'ia_enabled', 'ia_contexte_entreprise'
        )
        return {r['cle']: r['valeur'] for r in rows}

async def call_groq(prompt: str, system: str, api_key: str, model="llama-3.3-70b-versatile") -> str:
    """Appel Groq API"""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            GROQ_API_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.3,
                "max_tokens": 2000,
            }
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

async def call_mistral(prompt: str, system: str, api_key: str, model="mistral-large-latest") -> str:
    """Appel Mistral API"""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            MISTRAL_API_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.3,
                "max_tokens": 2000,
            }
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

async def appel_ia(pool, prompt: str, contexte: str = "") -> dict:
    """Bascule automatique Groq → Mistral → erreur"""
    keys = await get_ia_keys(pool)
    
    if keys.get('ia_enabled') == 'false':
        return {"erreur": "IA désactivée dans les paramètres"}
    
    ctx_entreprise = keys.get("ia_contexte_entreprise", "NAI — Usine de fabrication de sacs plastiques, Côte d'Ivoire")
    system_prompt = f"""Tu es l'assistant IA de NAI (anciennement Green Industry), une usine de fabrication de sacs plastiques en Côte d'Ivoire.
Contexte : {ctx_entreprise}
{contexte}
Tu réponds toujours en français, de manière concise et professionnelle.
Tu as accès aux données de production, stock, QHSE, RH et maintenance de l'usine.
Tu ne divulgues jamais les données financières sensibles sauf si autorisé.
Date du jour : {datetime.utcnow().strftime('%d/%m/%Y')}"""

    # 1. Essayer Groq
    groq_key = keys.get('groq_api_key', '')
    if groq_key and groq_key != '***':
        try:
            reponse = await call_groq(prompt, system_prompt, groq_key)
            return {"reponse": reponse, "modele": "Groq llama-3.3-70b", "provider": "groq"}
        except Exception as e:
            print(f"Groq erreur: {e}")
    
    # 2. Basculer sur Mistral
    mistral_key = keys.get('mistral_api_key', '')
    if mistral_key and mistral_key != '***':
        try:
            reponse = await call_mistral(prompt, system_prompt, mistral_key)
            return {"reponse": reponse, "modele": "Mistral large", "provider": "mistral"}
        except Exception as e:
            print(f"Mistral erreur: {e}")
    
    # 3. Essayer Anthropic si dispo
    try:
        import anthropic
        client = anthropic.Anthropic()
        msg = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            system=system_prompt,
            messages=[{"role": "user", "content": prompt}]
        )
        return {"reponse": msg.content[0].text, "modele": "Claude Sonnet", "provider": "anthropic"}
    except Exception as e:
        print(f"Anthropic erreur: {e}")
    
    return {"erreur": "Aucun provider IA disponible. Configurez Groq ou Mistral dans les paramètres."}

@app.post("/api/ia/chat")
async def ia_chat(payload: dict, user=Depends(get_current_user)):
    """Chat IA principal avec contexte NAI complet + mémoire conversation"""
    prompt = payload.get("message", "")
    historique = payload.get("historique", [])  # Messages précédents
    if not prompt:
        raise HTTPException(400, "Message requis")
    
    # Collecter TOUTES les données de l'application
    contexte_complet = ""
    try:
        async with pool.acquire() as conn:
            # Production
            prod = await conn.fetchrow("""
                SELECT
                    (SELECT COUNT(*) FROM sessions_production WHERE DATE(date_session)=CURRENT_DATE) AS sessions_jour,
                    (SELECT COALESCE(SUM(poids_net_kg),0) FROM tickets_production WHERE DATE(created_at)=CURRENT_DATE) AS prod_jour,
                    (SELECT COALESCE(SUM(poids_dechets_kg),0) FROM tickets_production WHERE DATE(created_at)=CURRENT_DATE) AS dechets_jour
            """)
            # Stock
            stock = await conn.fetchrow("""
                SELECT 
                    COUNT(*) AS nb_articles,
                    COALESCE(SUM(sa.qte_disponible),0) AS stock_total,
                    (SELECT COUNT(*) FROM articles a2 LEFT JOIN stock_articles sa2 ON sa2.article_id=a2.id 
                     WHERE COALESCE(sa2.qte_disponible,0) <= COALESCE(a2.stock_mini,0) AND a2.actif=true) AS alertes_stock
                FROM articles a LEFT JOIN stock_articles sa ON sa.article_id=a.id WHERE a.actif=true
            """)
            # GMAO
            gmao = await conn.fetchrow("""
                SELECT
                    (SELECT COUNT(*) FROM equipements WHERE actif=true) AS nb_equipements,
                    (SELECT COUNT(*) FROM equipements WHERE statut='en_panne' AND actif=true) AS en_panne,
                    (SELECT COUNT(*) FROM equipements WHERE statut='operationnel' AND actif=true) AS operationnels,
                    (SELECT COUNT(*) FROM ordres_travail WHERE statut NOT IN ('termine','annule')) AS ot_ouverts
            """)
            # QHSE
            qhse = await conn.fetchrow("""
                SELECT
                    (SELECT COUNT(*) FROM non_conformites WHERE statut NOT IN ('clos','annule')) AS nc_ouvertes,
                    (SELECT COUNT(*) FROM non_conformites WHERE DATE(created_at)=CURRENT_DATE) AS nc_jour,
                    (SELECT COUNT(*) FROM risques_opportunites WHERE type='risque') AS nb_risques,
                    (SELECT COUNT(*) FROM documents_qhse WHERE actif=true) AS nb_documents
            """)
            # RH
            rh = await conn.fetchrow("""
                SELECT
                    (SELECT COUNT(*) FROM employes WHERE actif=true AND statut='actif') AS effectif,
                    (SELECT COUNT(*) FROM conges WHERE statut='en_attente') AS conges_attente
            """)
            # Énergie du mois
            energie = await conn.fetchrow("""
                SELECT COALESCE(SUM(consommation_kwh),0) AS kwh_mois
                FROM releves_energie 
                WHERE DATE_TRUNC('month',date_releve)=DATE_TRUNC('month',CURRENT_DATE)
            """)
            
            contexte_complet = f"""
=== DONNÉES TEMPS RÉEL NAI ===
Date: {datetime.utcnow().strftime('%d/%m/%Y %H:%M')} UTC

PRODUCTION (aujourd'hui):
- Sessions actives: {prod['sessions_jour'] or 0}
- Production conforme: {float(prod['prod_jour'] or 0):.0f} unités
- Déchets: {float(prod['dechets_jour'] or 0):.1f} kg

STOCK:
- Articles actifs: {stock['nb_articles'] or 0}
- Alertes rupture: {stock['alertes_stock'] or 0}

GMAO - ÉQUIPEMENTS AT3:
- Total équipements: {gmao['nb_equipements'] or 0}
- En service: {gmao['operationnels'] or 0}
- En panne: {gmao['en_panne'] or 0}
- Ordres de travail ouverts: {gmao['ot_ouverts'] or 0}

QHSE:
- Non-conformités ouvertes: {qhse['nc_ouvertes'] or 0}
- NC créées aujourd'hui: {qhse['nc_jour'] or 0}
- Risques identifiés: {qhse['nb_risques'] or 0}
- Documents GED: {qhse['nb_documents'] or 0}

RH:
- Effectif actif: {rh['effectif'] or 0} employés
- Congés en attente: {rh['conges_attente'] or 0}

ÉNERGIE (mois en cours):
- Consommation: {float(energie['kwh_mois'] or 0):.1f} kWh
=== FIN DONNÉES ==="""
    except Exception as e:
        contexte_complet = f"(Données temps réel indisponibles: {str(e)[:50]})"
    
    # Intégrer l'historique de conversation pour la mémoire
    contexte_historique = ""
    if historique:
        derniers = historique[-6:]  # 6 derniers messages max
        contexte_historique = "\n=== HISTORIQUE CONVERSATION ===\n"
        for msg in derniers:
            role = "Utilisateur" if msg.get("role") == "user" else "Assistant"
            contexte_historique += f"{role}: {msg.get(chr(39)+chr(99)+chr(111)+chr(110)+chr(116)+chr(101)+chr(110)+chr(116)+chr(39),chr(39)+chr(39))[:200]}\n"
        contexte_historique += "=== FIN HISTORIQUE ===\n"
    
    result = await appel_ia(pool, prompt, contexte_complet + contexte_historique)
    
    # Masquer le provider technique
    if "reponse" in result:
        result.pop("provider", None)
        result.pop("modele", None)
    
    await log_action(pool, user.get("id"), "ia_chat", "ia")
    return result

@app.post("/api/ia/analyser-nc")
async def ia_analyser_nc(payload: dict, user=Depends(get_current_user)):
    """Analyse IA d'une non-conformité — causes probables et actions"""
    nc = payload
    prompt = f"""Analyse cette non-conformité dans notre usine NAI :
    
Titre : {nc.get('titre')}
Type : {nc.get('type_nc')}
Gravité : {nc.get('gravite')}
Description : {nc.get('description')}
Produit concerné : {nc.get('produit_concerne', 'Non spécifié')}
Machine : {nc.get('machine', 'Non spécifié')}

Donne-moi :
1. Les 3 causes racines les plus probables (méthode 5M)
2. L'action corrective immédiate recommandée
3. L'action préventive à long terme
4. Cotation AMDEC suggérée (Gravité/Occurrence/Détectabilité sur 5)

Réponse structurée et concise."""
    
    return await appel_ia(pool, prompt)

@app.post("/api/ia/analyser-panne")
async def ia_analyser_panne(payload: dict, user=Depends(get_current_user)):
    """Analyse IA d'une panne machine"""
    panne = payload
    prompt = f"""Analyse cette panne sur notre équipement :
    
Machine : {panne.get('equipement', 'Extrudeuse plastique')}
Symptômes : {panne.get('symptomes')}
Durée d'arrêt : {panne.get('duree_arret_h', '?')} heures
Contexte : {panne.get('contexte', '')}

Donne-moi :
1. Diagnostic probable (cause technique)
2. Procédure de dépannage étape par étape
3. Pièces détachées susceptibles d'être nécessaires
4. Actions préventives pour éviter la récurrence
5. Estimation durée réparation"""
    
    return await appel_ia(pool, prompt)

@app.post("/api/ia/analyser-stock")
async def ia_analyser_stock(user=Depends(get_current_user)):
    """Analyse IA du stock et recommandations"""
    async with pool.acquire() as conn:
        alertes = await conn.fetch("""
            SELECT a.code, a.designation, a.type_article,
                COALESCE(SUM(sa.qte_disponible),0) AS stock,
                COALESCE(a.stock_mini,0) AS stock_mini
            FROM articles a
            LEFT JOIN stock_articles sa ON sa.article_id=a.id
            WHERE a.actif=true
            GROUP BY a.id
            HAVING COALESCE(SUM(sa.qte_disponible),0) <= COALESCE(a.stock_mini,0)
            LIMIT 10
        """)
        
    if not alertes:
        return {"reponse": "✅ Aucune alerte stock critique détectée. Tous les articles sont au-dessus du stock minimum.", "modele": "Analyse locale"}
    
    liste = "\n".join([f"- {r['code']} {r['designation']} ({r['type_article']}): {r['stock']:.0f} / mini {r['stock_mini']:.0f}" for r in alertes])
    prompt = f"""Voici les articles en rupture ou proche de la rupture dans notre usine NAI :

{liste}

Analyse et donne des recommandations priorisées pour les approvisionnements urgents.
Identifie les risques de production si ces matières ne sont pas réapprovisionnées rapidement."""
    
    return await appel_ia(pool, prompt)

@app.post("/api/ia/rapport-journalier")
async def ia_rapport_journalier(user=Depends(get_current_user)):
    """Génère un rapport journalier automatique"""
    async with pool.acquire() as conn:
        stats = await conn.fetchrow("""
            SELECT
                (SELECT COUNT(*) FROM sessions_production WHERE DATE(date_session)=CURRENT_DATE) AS sessions,
                (SELECT COALESCE(SUM(poids_net_kg),0) FROM tickets_production WHERE DATE(created_at)=CURRENT_DATE) AS prod_conforme,
                (SELECT COALESCE(SUM(poids_dechets_kg),0) FROM tickets_production WHERE DATE(created_at)=CURRENT_DATE) AS dechets,
                (SELECT COUNT(*) FROM equipements WHERE statut='en_panne' AND actif=true) AS pannes,
                (SELECT COUNT(*) FROM non_conformites WHERE DATE(created_at)=CURRENT_DATE) AS nc_jour,
                (SELECT COUNT(*) FROM ordres_travail WHERE DATE(created_at)=CURRENT_DATE) AS ot_jour
        """)
    
    prompt = f"""Génère un rapport journalier professionnel pour NAI basé sur ces données du {datetime.utcnow().strftime('%d/%m/%Y')} :

Production :
- {stats['sessions'] or 0} sessions de production
- {stats['prod_conforme'] or 0:.0f} unités conformes produites  
- {stats['dechets'] or 0:.1f} kg de déchets

Incidents :
- {stats['pannes'] or 0} machine(s) en panne
- {stats['nc_jour'] or 0} non-conformité(s) détectée(s) aujourd'hui
- {stats['ot_jour'] or 0} ordre(s) de travail GMAO créé(s)

Rédige un rapport en 3 sections : Résumé exécutif, Points d'attention, Recommandations pour demain.
Style professionnel, format adapté pour une réunion de direction."""
    
    return await appel_ia(pool, prompt)

@app.post("/api/ia/analyser-processus")
async def ia_analyser_processus(payload: dict, user=Depends(get_current_user)):
    """Analyse IA d'un processus QHSE"""
    proc = payload
    prompt = f"""Analyse ce processus qualité de notre usine NAI (fabrication sacs plastiques) :

Processus : {proc.get('code')} — {proc.get('titre') or proc.get('libelle')}
Type : {proc.get('type_processus')}
Description : {proc.get('description','')}
Finalité : {proc.get('finalite') or proc.get('objectif','')}
Données entrée : {proc.get('donnees_entree','')}
Données sortie : {proc.get('donnees_sortie','')}
Normes : {proc.get('normes_applicables',[])}

En tant qu'expert QHSE certifié ISO 9001/14001/45001/FSSC22000, donne-moi :
1. Points forts de ce processus
2. Risques identifiés et non-conformités potentielles
3. Indicateurs KPI recommandés
4. Améliorations suggérées selon les normes applicables"""
    
    return await appel_ia(pool, prompt)

# ══════════════════════════════════════════════════════════════
# GESTION UTILISATEURS (liée aux RH)
# ══════════════════════════════════════════════════════════════

ROLES_PERMISSIONS = {
    "super_admin":       {"label": "Super Administrateur", "acces": ["*"]},
    "directeur":         {"label": "Directeur", "acces": ["dashboard","production","stock","vente","achat","qhse","rh","gmao","kpi","ia"]},
    "chef_atelier":      {"label": "Chef d'Atelier", "acces": ["dashboard","production","stock","bons_cession","qhse","gmao"]},
    "responsable_qhse":  {"label": "Responsable QHSE", "acces": ["dashboard","qhse","gmao","kpi"]},
    "responsable_rh":    {"label": "Responsable RH", "acces": ["dashboard","rh","utilisateurs"]},
    "technicien_regleur":{"label": "Technicien Régleur", "acces": ["dashboard","production","gmao"]},
    "operateur":         {"label": "Opérateur Machine", "acces": ["dashboard","production"]},
    "controleur_qualite":{"label": "Contrôleur Qualité", "acces": ["dashboard","qhse","production"]},
    "comptable":         {"label": "Comptable", "acces": ["dashboard","vente","achat","stock","kpi"]},
    "responsable_stock": {"label": "Responsable Stock", "acces": ["dashboard","stock","bons_cession","articles"]},
    "commercial":        {"label": "Commercial", "acces": ["dashboard","vente","clients","articles"]},
    "technicien_gmao":   {"label": "Technicien GMAO", "acces": ["dashboard","gmao"]},
    "emballeur":         {"label": "Emballeur", "acces": ["dashboard","production"]},
}

@app.get("/api/utilisateurs")
async def get_utilisateurs(search: Optional[str]=None, role: Optional[str]=None,
                            user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        q = """
            SELECT u.id, u.login, u.nom, u.prenom, u.email, u.role,
                u.actif, u.created_at, u.atelier_id,
                u.derniere_connexion,
                at.libelle AS atelier_libelle, at.code AS atelier_code,
                e.matricule, e.id AS employe_id,
                p.intitule AS poste_libelle
            FROM utilisateurs u
            LEFT JOIN ateliers at ON at.id=u.atelier_id
            LEFT JOIN employes e ON e.user_id=u.id
            LEFT JOIN postes p ON p.id=e.poste_id
            WHERE 1=1
        """
        params = []
        if search:
            params.append(f"%{search}%")
            q += f" AND (u.nom ILIKE ${len(params)} OR u.prenom ILIKE ${len(params)} OR u.login ILIKE ${len(params)})"
        if role:
            params.append(role)
            q += f" AND u.role = ${len(params)}"
        q += " ORDER BY u.nom, u.prenom"
        rows = await conn.fetch(q, *params)
        result = []
        for r in rows:
            d = dict(r)
            d["permissions"] = ROLES_PERMISSIONS.get(d["role"], {})
            result.append(d)
        return result

@app.post("/api/utilisateurs")
async def create_utilisateur(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        if not d.get("login") or not d.get("password"):
            raise HTTPException(400, "Login et mot de passe requis")
        
        # Vérifier login unique
        existing = await conn.fetchval("SELECT id FROM utilisateurs WHERE login=$1", d["login"])
        if existing:
            raise HTTPException(400, f"Login '{d['login']}' déjà utilisé")
        
        import bcrypt
        pwd_hash = bcrypt.hashpw(d["password"].encode(), bcrypt.gensalt()).decode()
        
        try:
            row = await conn.fetchrow("""
                INSERT INTO utilisateurs (login, password_hash, nom, prenom, email, role, actif, atelier_id)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                RETURNING id, login, nom, prenom, email, role, actif, created_at
            """,
                d["login"].lower().strip(),
                pwd_hash,
                d.get("nom","").upper(),
                d.get("prenom",""),
                d.get("email"),
                d.get("role","operateur"),
                True,
                int(d["atelier_id"]) if d.get("atelier_id") else None
            )
            user_id = str(row["id"])
            
            # Lier à l'employé si fourni
            if d.get("employe_id"):
                await conn.execute(
                    "UPDATE employes SET user_id=$1 WHERE id=$2",
                    user_id, d["employe_id"]
                )
            
            return dict(row)
        except Exception as e:
            raise HTTPException(400, str(e))

@app.put("/api/utilisateurs/{user_id}")
async def update_utilisateur(user_id: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        sets, vals = ["role=$1","actif=$2","atelier_id=$3"], [
            d.get("role"), bool(d.get("actif",True)),
            int(d["atelier_id"]) if d.get("atelier_id") else None
        ]
        if d.get("email"):
            vals.append(d["email"]); sets.append(f"email=${len(vals)}")
        if d.get("nom"):
            vals.append(d["nom"].upper()); sets.append(f"nom=${len(vals)}")
        if d.get("prenom"):
            vals.append(d["prenom"]); sets.append(f"prenom=${len(vals)}")
        vals.append(user_id)
        row = await conn.fetchrow(
            f"UPDATE utilisateurs SET {','.join(sets)} WHERE id=${len(vals)} RETURNING *",
            *vals
        )
        return dict(row)

@app.post("/api/utilisateurs/{user_id}/reset-password")
async def reset_password(user_id: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        import bcrypt
        new_pwd = payload.get("password")
        if not new_pwd or len(new_pwd) < 6:
            raise HTTPException(400, "Mot de passe trop court (min 6 caractères)")
        pwd_hash = bcrypt.hashpw(new_pwd.encode(), bcrypt.gensalt()).decode()
        await conn.execute(
            "UPDATE utilisateurs SET password_hash=$1 WHERE id=$2",
            pwd_hash, user_id
        )
        return {"success": True, "message": "Mot de passe réinitialisé"}

@app.get("/api/utilisateurs/roles")
async def get_roles(user=Depends(get_current_user)):
    return [{"code": k, **v} for k,v in ROLES_PERMISSIONS.items()]

@app.get("/api/utilisateurs/{user_id}/acces")
async def get_acces_utilisateur(user_id: str, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT role FROM utilisateurs WHERE id=$1", user_id)
        if not row: raise HTTPException(404)
        role = row["role"]
        return {"role": role, "permissions": ROLES_PERMISSIONS.get(role,{})}


# ══════════════════════════════════════════════════════════════
# SÉCURITÉ & PERMISSIONS v3.2
# ══════════════════════════════════════════════════════════════

FINANCE_ROLES = {"super_admin", "directeur", "comptable"}

def has_finance_access(user: dict) -> bool:
    return user.get("role") in FINANCE_ROLES

def is_super_admin(user: dict) -> bool:
    return user.get("role") == "super_admin"

def filter_finance(data: dict, user: dict) -> dict:
    """Masque les champs financiers selon le rôle"""
    if has_finance_access(user):
        return data
    finance_fields = {
        "prix_achat","prix_vente","valeur_totale","valeur_stock",
        "salaire_base","salaire_brut","salaire_net","cout_total",
        "cout_fcfa","cout_maintenance_annee","masse_salariale_mois",
        "valeur_acquisition","valeur_actuelle","cout_nc","cout_panne",
        "montant_ht","montant_ttc","montant_tva","cout_ht","cout_ttc"
    }
    return {k: ("***" if k in finance_fields and v not in (None, 0, "0") else v)
            for k,v in data.items()}

# ── PERMISSIONS ───────────────────────────────────────────────
@app.get("/api/permissions/moi")
async def mes_permissions(user=Depends(get_current_user)):
    """Retourne les permissions de l'utilisateur connecté"""
    role = user.get("role", "operateur")
    async with pool.acquire() as conn:
        # Récupérer permissions depuis la table
        rows = await conn.fetch(
            "SELECT * FROM permissions_roles WHERE role=$1 OR role='*'",
            role
        )
        perms = {}
        for r in rows:
            perms[r["module"]] = {
                "voir": r["peut_voir"],
                "creer": r["peut_creer"],
                "modifier": r["peut_modifier"],
                "supprimer": r["peut_supprimer"],
                "finance": r["voir_finance"],
            }
    return {
        "role": role,
        "is_super_admin": is_super_admin(user),
        "has_finance": has_finance_access(user),
        "permissions": perms,
        "utilisateur": {
            "id": user.get("id"),
            "login": user.get("login"),
            "nom": user.get("nom"),
            "prenom": user.get("prenom"),
            "atelier_id": user.get("atelier_id"),
        }
    }

@app.get("/api/permissions/roles")
async def get_permissions_roles(user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM permissions_roles ORDER BY role, module")
        return [dict(r) for r in rows]

@app.put("/api/permissions/roles/{role}/{module}")
async def update_permission(role: str, module: str, payload: dict, user=Depends(get_current_user)):
    if not is_super_admin(user):
        raise HTTPException(403, "Réservé au super administrateur")
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO permissions_roles (role, module, peut_voir, peut_creer, peut_modifier, peut_supprimer, voir_finance)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            ON CONFLICT (role, module) DO UPDATE SET
                peut_voir=$3, peut_creer=$4, peut_modifier=$5,
                peut_supprimer=$6, voir_finance=$7
            RETURNING *
        """,
            role, module,
            bool(payload.get("peut_voir", True)),
            bool(payload.get("peut_creer", False)),
            bool(payload.get("peut_modifier", False)),
            bool(payload.get("peut_supprimer", False)),
            bool(payload.get("voir_finance", False))
        )
        return dict(row)

# ── PARAMÈTRES SYSTÈME ────────────────────────────────────────
@app.get("/api/parametres")
async def get_parametres(user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM parametres_systeme ORDER BY cle")
        result = []
        for r in rows:
            d = dict(r)
            # Filtrer selon droits
            if d["modifiable_par"] == "super_admin" and not is_super_admin(user):
                d["valeur"] = "***"  # Masqué
            result.append(d)
        return result

@app.put("/api/parametres/{cle}")
async def update_parametre(cle: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        param = await conn.fetchrow("SELECT * FROM parametres_systeme WHERE cle=$1", cle)
        if not param:
            raise HTTPException(404, "Paramètre introuvable")
        # Vérifier droits
        role_requis = param["modifiable_par"]
        role_user = user.get("role")
        if role_requis == "super_admin" and not is_super_admin(user):
            raise HTTPException(403, "Réservé au super administrateur")
        if role_requis not in ("super_admin",) and role_user not in (role_requis, "super_admin", "directeur"):
            raise HTTPException(403, f"Rôle {role_requis} requis")
        row = await conn.fetchrow(
            "UPDATE parametres_systeme SET valeur=$1, updated_at=NOW() WHERE cle=$2 RETURNING *",
            str(payload["valeur"]), cle
        )
        return dict(row)

@app.get("/api/parametres/{cle}")
async def get_parametre(cle: str, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM parametres_systeme WHERE cle=$1", cle)
        if not row: raise HTTPException(404)
        return dict(row)

# ── LOGS D'ACTIVITÉ ───────────────────────────────────────────
@app.get("/api/logs")
async def get_logs(module: Optional[str]=None, limit: int=100, user=Depends(get_current_user)):
    if not is_super_admin(user) and user.get("role") != "directeur":
        raise HTTPException(403, "Accès restreint")
    async with pool.acquire() as conn:
        q = """
            SELECT l.*, u.login, u.nom, u.prenom
            FROM logs_activite l
            LEFT JOIN utilisateurs u ON u.id=l.utilisateur_id
            WHERE 1=1
        """
        params = []
        if module:
            params.append(module); q += f" AND l.module=${len(params)}"
        q += f" ORDER BY l.created_at DESC LIMIT {limit}"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

async def log_action(pool, user_id: str, action: str, module: str, ressource_id: str=None, details: dict=None):
    """Enregistre une action dans les logs"""
    try:
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO logs_activite (utilisateur_id, action, module, ressource_id, details)
                VALUES ($1,$2,$3,$4,$5)
            """, user_id, action, module, ressource_id, json.dumps(details or {}))
    except:
        pass  # Les logs ne doivent jamais faire planter l'app


# ── IMPORT DOCUMENTS QHSE ─────────────────────────────────────
@app.post("/api/qhse/import-zip")
async def import_qhse_zip(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Import d'un ZIP de documents QHSE via interface web"""
    if not file.filename.endswith('.zip'):
        raise HTTPException(400, "Fichier ZIP requis")
    
    import tempfile, zipfile as zf
    from qhse_import import importer_zip
    
    # Sauvegarder le ZIP temporairement
    with tempfile.NamedTemporaryFile(suffix='.zip', delete=False) as tmp:
        content_bytes = await file.read()
        tmp.write(content_bytes)
        tmp_path = tmp.name
    
    try:
        resultats = await importer_zip(tmp_path)
        await log_action(pool, user.get("id"), "import_qhse", "qhse",
                        details={"nb_importes": len(resultats.get('importes',[]))})
        return {
            "success": True,
            "importes": len(resultats.get('importes', [])),
            "ignores": len(resultats.get('ignores', [])),
            "erreurs": len(resultats.get('erreurs', [])),
            "detail": resultats
        }
    except Exception as e:
        raise HTTPException(500, f"Erreur import: {str(e)}")
    finally:
        import os
        try: os.unlink(tmp_path)
        except: pass

@app.get("/api/qhse/documents/{doc_id}/telecharger")
async def telecharger_document(doc_id: str, user=Depends(get_current_user)):
    """Télécharger un document QHSE"""
    from fastapi.responses import FileResponse
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM documents_qhse WHERE id=$1", doc_id)
        if not row: raise HTTPException(404, "Document introuvable")
        file_path = row["file_path"]
        if not file_path or not Path(file_path).exists():
            raise HTTPException(404, "Fichier non trouvé sur le serveur")
        return FileResponse(file_path, filename=row["file_name"])

@app.get("/api/ia/analyser-document/{doc_id}")  
async def ia_analyser_document(doc_id: str, user=Depends(get_current_user)):
    """Analyse IA d'un document QHSE"""
    async with pool.acquire() as conn:
        doc = await conn.fetchrow("SELECT * FROM documents_qhse WHERE id=$1", doc_id)
        if not doc: raise HTTPException(404, "Document introuvable")
    
    prompt = f"""Analyse ce document qualité NAI :
Code : {doc['code']}
Titre : {doc['titre']}
Type : {doc['type_document']}
Version : {doc['version']}
Normes : {doc['normes_applicables']}

En tant qu'expert QHSE, donne :
1. Résumé de ce que doit contenir ce document
2. Points clés à vérifier lors d'un audit
3. Liens avec les exigences normatives applicables
4. Indicateurs de performance associés"""
    
    result = await appel_ia(pool, prompt)
    return result


# ══════════════════════════════════════════════════════════════
# GED QHSE — Upload, Lecture, Recherche Full-Text
# ══════════════════════════════════════════════════════════════
from doc_reader import extraire_contenu, info_fichier
import shutil, uuid as uuid_lib

UPLOAD_QHSE = Path("/app/uploads/qhse")
UPLOAD_QHSE.mkdir(parents=True, exist_ok=True)

@app.post("/api/qhse/documents/upload")
async def upload_document_qhse(
    file: UploadFile = File(...),
    code: str = Form(None),
    titre: str = Form(None),
    type_document: str = Form("procedure"),
    processus_id: str = Form(None),
    version: str = Form("v1"),
    normes_applicables: str = Form("[]"),
    mots_cles: str = Form(""),
    analyser_ia: str = Form("false"),
    user=Depends(get_current_user)
):
    """Upload d'un document QHSE avec extraction automatique du contenu"""
    ext = Path(file.filename).suffix.lower()
    if ext not in ['.docx','.doc','.pdf','.xlsx','.xls','.pptx']:
        raise HTTPException(400, f"Format non supporté: {ext}")

    # Générer le code si non fourni
    if not code:
        from qhse_import import parser_nom_fichier
        info_parse = parser_nom_fichier(file.filename)
        code = info_parse.get("code") or f"DOC-{str(uuid_lib.uuid4())[:8].upper()}"
        if not titre: titre = info_parse.get("titre", file.filename)
        if not version or version == "v1": version = info_parse.get("version","v1")

    # Sauvegarder le fichier
    safe_name = f"{code}_{version}{ext}"
    dest_path = UPLOAD_QHSE / safe_name
    
    content_bytes = await file.read()
    with open(dest_path, "wb") as f_out:
        f_out.write(content_bytes)
    
    file_size = len(content_bytes)
    
    # Extraire le contenu textuel
    extraction = extraire_contenu(str(dest_path))
    texte = extraction.get("texte", "")
    mots_cles_auto = extraction.get("mots_cles", [])
    nb_mots = extraction.get("nb_mots", 0)
    
    # Résumé IA si demandé
    resume_ia = None
    if analyser_ia.lower() == "true" and texte:
        try:
            prompt = f"""Résume ce document qualité en 5 points maximum, de façon concise :

Titre: {titre}
Type: {type_document}

Contenu:
{texte[:3000]}

Format: bullet points, langage professionnel, français."""
            result = await appel_ia(pool, prompt)
            resume_ia = result.get("reponse")
        except:
            resume_ia = None

    # Insérer en base
    async with pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT id FROM documents_qhse WHERE code=$1", code)
        
        if existing:
            row = await conn.fetchrow("""
                UPDATE documents_qhse SET
                    titre=$1, type_document=$2, processus_id=$3,
                    version=$4, normes_applicables=$5, mots_cles=$6,
                    file_path=$7, file_name=$8, file_size=$9, mime_type=$10,
                    contenu_texte=$11, resume_ia=$12, mots_cles_auto=$13, nb_mots=$14,
                    updated_at=NOW()
                WHERE id=$15 RETURNING *
            """,
                titre, type_document,
                processus_id if processus_id and processus_id != "null" else None,
                version,
                json.dumps(json.loads(normes_applicables) if normes_applicables else []),
                mots_cles, str(dest_path), safe_name, file_size,
                f"application/{ext[1:]}",
                texte, resume_ia, mots_cles_auto, nb_mots,
                str(existing["id"])
            )
            action = "mise_a_jour"
        else:
            row = await conn.fetchrow("""
                INSERT INTO documents_qhse (
                    code, titre, type_document, processus_id, version,
                    normes_applicables, mots_cles,
                    file_path, file_name, file_size, mime_type,
                    contenu_texte, resume_ia, mots_cles_auto, nb_mots,
                    statut, actif
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'brouillon',true)
                RETURNING *
            """,
                code, titre, type_document,
                processus_id if processus_id and processus_id != "null" else None,
                version,
                json.dumps(json.loads(normes_applicables) if normes_applicables else []),
                mots_cles, str(dest_path), safe_name, file_size,
                f"application/{ext[1:]}",
                texte, resume_ia, mots_cles_auto, nb_mots
            )
            action = "creation"

    await log_action(pool, user.get("id"), f"upload_document_{action}", "qhse",
                    ressource_id=code, details={"fichier": safe_name, "nb_mots": nb_mots})
    
    return {
        "success": True,
        "action": action,
        "code": code,
        "titre": titre,
        "version": version,
        "file_name": safe_name,
        "file_size_kb": round(file_size/1024, 1),
        "nb_mots": nb_mots,
        "mots_cles_auto": mots_cles_auto[:10],
        "resume_ia": resume_ia,
        "message": f"Document {action} avec succès"
    }

@app.get("/api/qhse/documents/recherche")
async def recherche_documents(
    q: str,
    type_document: Optional[str] = None,
    processus_id: Optional[str] = None,
    norme: Optional[str] = None,
    user=Depends(get_current_user)
):
    """Recherche full-text dans les documents QHSE"""
    if len(q) < 2:
        raise HTTPException(400, "Requête trop courte")
    
    async with pool.acquire() as conn:
        query = """
            SELECT 
                d.id, d.code, d.titre, d.type_document, d.version,
                d.statut, d.file_name, d.nb_mots,
                d.normes_applicables, d.mots_cles_auto,
                p.titre AS processus_libelle,
                ts_rank(
                    to_tsvector('french', 
                        coalesce(d.contenu_texte,'') || ' ' || 
                        coalesce(d.titre,'') || ' ' || 
                        coalesce(d.mots_cles,'')),
                    plainto_tsquery('french', $1)
                ) AS pertinence,
                ts_headline('french', 
                    coalesce(d.contenu_texte,d.titre,''),
                    plainto_tsquery('french', $1),
                    'MaxWords=30, MinWords=15, StartSel=**,StopSel=**'
                ) AS extrait
            FROM documents_qhse d
            LEFT JOIN processus p ON p.id=d.processus_id
            WHERE d.actif=true
              AND (
                to_tsvector('french', 
                    coalesce(d.contenu_texte,'') || ' ' || 
                    coalesce(d.titre,'') || ' ' ||
                    coalesce(d.mots_cles,''))
                @@ plainto_tsquery('french', $1)
                OR d.titre ILIKE $2
                OR d.code ILIKE $2
                OR d.mots_cles ILIKE $2
              )
        """
        params = [q, f"%{q}%"]
        
        if type_document:
            params.append(type_document)
            query += f" AND d.type_document=${len(params)}"
        if processus_id:
            params.append(processus_id)
            query += f" AND d.processus_id=${len(params)}"
        if norme:
            params.append(f'%"{norme}"%')
            query += f" AND d.normes_applicables::text ILIKE ${len(params)}"
        
        query += " ORDER BY pertinence DESC, d.titre LIMIT 20"
        
        rows = await conn.fetch(query, *params)
        return {
            "requete": q,
            "nb_resultats": len(rows),
            "resultats": [dict(r) for r in rows]
        }

@app.get("/api/qhse/documents/{doc_id}/contenu")
async def get_document_contenu(doc_id: str, user=Depends(get_current_user)):
    """Récupère le contenu textuel extrait d'un document"""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, code, titre, contenu_texte, resume_ia, mots_cles_auto, nb_mots FROM documents_qhse WHERE id=$1",
            doc_id
        )
        if not row: raise HTTPException(404, "Document introuvable")
        return dict(row)

@app.post("/api/qhse/documents/{doc_id}/analyser-ia")
async def analyser_document_ia(doc_id: str, user=Depends(get_current_user)):
    """Lance/relance l'analyse IA d'un document"""
    async with pool.acquire() as conn:
        doc = await conn.fetchrow("SELECT * FROM documents_qhse WHERE id=$1", doc_id)
        if not doc: raise HTTPException(404)
        
        texte = doc["contenu_texte"] or ""
        if not texte and doc["file_path"]:
            extraction = extraire_contenu(doc["file_path"])
            texte = extraction.get("texte","")
            await conn.execute(
                "UPDATE documents_qhse SET contenu_texte=$1, nb_mots=$2 WHERE id=$3",
                texte, extraction.get("nb_mots",0), doc_id
            )
        
        if not texte:
            return {"erreur": "Aucun contenu textuel disponible dans ce document"}
        
        prompt = f"""Analyse ce document qualité NAI de manière experte :

Code: {doc['code']} | Type: {doc['type_document']} | Version: {doc['version']}
Titre: {doc['titre']}
Normes: {doc['normes_applicables']}

CONTENU:
{texte[:4000]}

Fournis:
1. **Résumé** (3-5 phrases) : Objectif et portée du document
2. **Points clés** : Les 5 éléments essentiels
3. **Exigences normatives** : Liens avec ISO 9001/14001/45001/FSSC 22000
4. **Points d'attention** : Ce qui nécessite une vigilance lors d'un audit
5. **Mots-clés** : 10 mots-clés pertinents séparés par des virgules"""

        result = await appel_ia(pool, prompt)
        resume = result.get("reponse","")
        
        await conn.execute(
            "UPDATE documents_qhse SET resume_ia=$1 WHERE id=$2",
            resume, doc_id
        )
        
        return {"resume_ia": resume, "modele": result.get("modele",""), "code": doc["code"]}

@app.get("/api/qhse/documents/{doc_id}/telecharger")
async def telecharger_document(doc_id: str, user=Depends(get_current_user)):
    from fastapi.responses import FileResponse
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM documents_qhse WHERE id=$1", doc_id)
        if not row: raise HTTPException(404)
        fp = row["file_path"]
        if not fp or not Path(fp).exists():
            raise HTTPException(404, "Fichier non trouvé sur le serveur")
        return FileResponse(fp, filename=row["file_name"], 
                           media_type="application/octet-stream")

# ── HEALTH CHECK ───────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok", "api": "NAIdo Python FastAPI v4.0"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=3000, reload=False)
