"""
NAIdo GMAO — Routes FastAPI
Équipements, OT, Maintenance préventive, Pièces détachées, Historique
Inspiré des projets EmacSah/GMAO-Suite-Odoo, wailammar99/gmao, LionelCoutinot/gmao
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from datetime import datetime, date, timedelta
import json

router = APIRouter(prefix="/api/gmao", tags=["gmao"])

def int_or_none(v):
    if v is None or v == "": return None
    try: return int(v)
    except: return None

def safe_json(v, fb=None):
    if fb is None: fb = []
    if isinstance(v, (list, dict)): return v
    if not v: return fb
    try: return json.loads(v)
    except: return fb

# ── DASHBOARD ─────────────────────────────────────────────────
async def gmao_dashboard(pool):
    async with pool.acquire() as conn:
        try:
            row = await conn.fetchrow("SELECT * FROM vue_gmao_dashboard")
            return dict(row) if row else {}
        except Exception as e:
            print(f"GMAO dashboard error: {e}")
            return {}

# ── ÉQUIPEMENTS ───────────────────────────────────────────────
async def get_equipements(pool, search=None, statut=None, atelier_id=None, criticite=None):
    async with pool.acquire() as conn:
        q = """
            SELECT e.*,
                COALESCE(at.libelle,'') AS atelier_libelle,
                COALESCE(at.code,'') AS atelier_code,
                COALESCE(u.nom||' '||u.prenom,'') AS responsable_nom,
                (SELECT COUNT(*) FROM ordres_travail ot WHERE ot.equipement_id=e.id AND ot.statut NOT IN ('termine','annule')) AS ot_en_cours,
                (SELECT MIN(pm.prochaine_echeance) FROM plans_maintenance pm WHERE pm.equipement_id=e.id AND pm.actif=true) AS prochaine_maintenance,
                (SELECT COUNT(*) FROM historique_pannes hp WHERE hp.equipement_id=e.id) AS nb_pannes_total
            FROM equipements e
            LEFT JOIN ateliers at ON at.id=e.atelier_id
            LEFT JOIN utilisateurs u ON u.id=e.responsable_id
            WHERE e.actif=true
        """
        params = []
        if statut:
            params.append(statut)
            q += f" AND e.statut=${len(params)}"
        if atelier_id:
            params.append(int(atelier_id))
            q += f" AND e.atelier_id=${len(params)}"
        if criticite:
            params.append(criticite)
            q += f" AND e.criticite=${len(params)}"
        if search:
            params.append(f"%{search}%")
            q += f" AND (e.code ILIKE ${len(params)} OR e.designation ILIKE ${len(params)} OR e.marque ILIKE ${len(params)})"
        q += " ORDER BY e.criticite DESC, e.designation"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

async def create_equipement(pool, data: dict, user_id: str):
    async with pool.acquire() as conn:
        try:
            row = await conn.fetchrow("""
                INSERT INTO equipements (
                    code, designation, atelier_id, localisation,
                    type_equipement, famille, criticite,
                    marque, modele, numero_serie,
                    puissance, tension,
                    date_acquisition, date_mise_en_service, date_fin_garantie,
                    duree_vie_ans, valeur_acquisition,
                    responsable_id, statut, notes
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
                RETURNING *
            """,
                data["code"].upper(), data["designation"],
                int_or_none(data.get("atelier_id")),
                data.get("localisation"),
                data.get("type_equipement","machine"),
                data.get("famille"),
                data.get("criticite","normale"),
                data.get("marque"), data.get("modele"), data.get("numero_serie"),
                data.get("puissance"), data.get("tension"),
                data.get("date_acquisition") or None,
                data.get("date_mise_en_service") or None,
                data.get("date_fin_garantie") or None,
                int_or_none(data.get("duree_vie_ans")),
                float(data.get("valeur_acquisition",0) or 0),
                data.get("responsable_id") or None,
                data.get("statut","en_service"),
                data.get("notes")
            )
            return dict(row)
        except Exception as e:
            raise ValueError(str(e))

# ── ORDRES DE TRAVAIL ─────────────────────────────────────────
async def get_ots(pool, statut=None, type_ot=None, equipement_id=None, priorite=None):
    async with pool.acquire() as conn:
        q = """
            SELECT ot.*,
                e.code AS equipement_code, e.designation AS equipement_designation,
                e.criticite AS equipement_criticite,
                at.libelle AS atelier_libelle,
                td.nom||' '||td.prenom AS technicien_nom,
                dm.nom||' '||dm.prenom AS demandeur_nom
            FROM ordres_travail ot
            LEFT JOIN equipements e ON e.id=ot.equipement_id
            LEFT JOIN ateliers at ON at.id=e.atelier_id
            LEFT JOIN utilisateurs td ON td.id=ot.technicien_id
            LEFT JOIN utilisateurs dm ON dm.id=ot.demandeur_id
            WHERE 1=1
        """
        params = []
        if statut:
            params.append(statut)
            q += f" AND ot.statut=${len(params)}"
        if type_ot:
            params.append(type_ot)
            q += f" AND ot.type_ot=${len(params)}"
        if equipement_id:
            params.append(equipement_id)
            q += f" AND ot.equipement_id=${len(params)}"
        if priorite:
            params.append(priorite)
            q += f" AND ot.priorite=${len(params)}"
        q += " ORDER BY CASE ot.priorite WHEN 'urgente' THEN 1 WHEN 'haute' THEN 2 WHEN 'normale' THEN 3 ELSE 4 END, ot.date_demande DESC LIMIT 200"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

async def create_ot(pool, data: dict, user_id: str):
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow("""
                INSERT INTO ordres_travail (
                    type_ot, equipement_id, plan_maintenance_id,
                    titre, description, symptomes, priorite,
                    date_planifiee, duree_estimee_h,
                    demandeur_id, technicien_id,
                    arret_machine, statut, notes
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'ouvert',$13)
                RETURNING *
            """,
                data.get("type_ot","curatif"),
                data.get("equipement_id") or None,
                data.get("plan_maintenance_id") or None,
                data["titre"], data.get("description"), data.get("symptomes"),
                data.get("priorite","normale"),
                data.get("date_planifiee") or None,
                float(data.get("duree_estimee_h",1) or 1),
                data.get("demandeur_id") or user_id,
                data.get("technicien_id") or None,
                bool(data.get("arret_machine",False)),
                data.get("notes")
            )
            # Si urgence ou panne → mettre équipement en panne
            if data.get("type_ot") in ("curatif","urgence") and data.get("equipement_id") and data.get("arret_machine"):
                await conn.execute(
                    "UPDATE equipements SET statut='en_panne' WHERE id=$1",
                    data["equipement_id"]
                )
            return dict(row)

async def update_ot(pool, ot_id: str, data: dict, user_id: str):
    async with pool.acquire() as conn:
        async with conn.transaction():
            statut = data.get("statut")
            extra_sets = ""
            extra_vals = []

            if statut == "en_cours" and not data.get("date_debut_reel"):
                extra_sets += ", date_debut_reel=NOW()"
            if statut == "termine":
                extra_sets += ", date_fin_reel=NOW(), updated_at=NOW()"
                # Calculer durée réelle
                ot = await conn.fetchrow("SELECT * FROM ordres_travail WHERE id=$1", ot_id)
                if ot and ot["date_debut_reel"]:
                    duree = (datetime.utcnow() - ot["date_debut_reel"].replace(tzinfo=None)).total_seconds() / 3600
                    extra_sets += f", duree_reelle_h={round(duree,2)}"

            # Calcul coût total
            cout_mo = float(data.get("cout_main_oeuvre",0) or 0)
            cout_pi = float(data.get("cout_pieces",0) or 0)
            cout_total = cout_mo + cout_pi

            row = await conn.fetchrow(f"""
                UPDATE ordres_travail SET
                    statut=$1, priorite=$2,
                    technicien_id=$3, date_planifiee=$4,
                    travaux_realises=$5, cause_panne=$6, solution_appliquee=$7,
                    pieces_utilisees=$8,
                    cout_main_oeuvre=$9, cout_pieces=$10, cout_total=$11,
                    duree_arret_h=$12, arret_machine=$13, notes=$14
                    {extra_sets}
                WHERE id=$15 RETURNING *
            """,
                statut or "ouvert",
                data.get("priorite","normale"),
                data.get("technicien_id") or None,
                data.get("date_planifiee") or None,
                data.get("travaux_realises"),
                data.get("cause_panne"),
                data.get("solution_appliquee"),
                json.dumps(safe_json(data.get("pieces_utilisees"),[])),
                cout_mo, cout_pi, cout_total,
                float(data.get("duree_arret_h",0) or 0),
                bool(data.get("arret_machine",False)),
                data.get("notes"),
                ot_id
            )

            # Si terminé → remettre équipement en service + créer historique panne si curatif
            if statut == "termine" and row:
                await conn.execute(
                    "UPDATE equipements SET statut='en_service' WHERE id=$1",
                    row["equipement_id"]
                )
                if row["type_ot"] in ("curatif","urgence") and row["symptomes"]:
                    duree_arret = float(row["duree_arret_h"] or 0)
                    await conn.execute("""
                        INSERT INTO historique_pannes
                            (equipement_id, ot_id, date_panne, date_remise_service,
                             symptomes, cause, duree_arret_h, cout_panne, mttr)
                        VALUES ($1,$2,$3,NOW(),$4,$5,$6,$7,$8)
                    """,
                        row["equipement_id"], ot_id,
                        row["date_debut_reel"] or row["date_demande"],
                        row["symptomes"], row["cause_panne"],
                        duree_arret, cout_total,
                        float(row["duree_reelle_h"] or 0) if "duree_reelle_h" in dict(row) else None
                    )

            return dict(row)

# ── PLANS DE MAINTENANCE ──────────────────────────────────────
async def get_plans(pool, equipement_id=None, echeance_proche=False):
    async with pool.acquire() as conn:
        q = """
            SELECT pm.*,
                e.code AS equipement_code, e.designation AS equipement_designation,
                e.criticite, at.libelle AS atelier_libelle,
                u.nom||' '||u.prenom AS technicien_nom
            FROM plans_maintenance pm
            JOIN equipements e ON e.id=pm.equipement_id
            LEFT JOIN ateliers at ON at.id=e.atelier_id
            LEFT JOIN utilisateurs u ON u.id=pm.technicien_id
            WHERE pm.actif=true
        """
        params = []
        if equipement_id:
            params.append(equipement_id)
            q += f" AND pm.equipement_id=${len(params)}"
        if echeance_proche:
            q += f" AND pm.prochaine_echeance <= CURRENT_DATE + INTERVAL '30 days'"
        q += " ORDER BY pm.prochaine_echeance ASC NULLS LAST"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

async def create_plan(pool, data: dict, user_id: str):
    async with pool.acquire() as conn:
        # Calculer prochaine échéance
        derniere = data.get("derniere_realisation")
        periodicite = int(data.get("periodicite_valeur",30))
        periodicite_type = data.get("periodicite_type","jours")
        if derniere:
            d = date.fromisoformat(derniere)
            if periodicite_type == "jours": prochaine = d + timedelta(days=periodicite)
            elif periodicite_type == "semaines": prochaine = d + timedelta(weeks=periodicite)
            elif periodicite_type == "mois": prochaine = d + timedelta(days=periodicite*30)
            else: prochaine = date.today() + timedelta(days=periodicite)
        else:
            prochaine = date.today() + timedelta(days=periodicite)

        row = await conn.fetchrow("""
            INSERT INTO plans_maintenance (
                equipement_id, titre, description, type_maintenance,
                periodicite_type, periodicite_valeur,
                duree_estimee_h, technicien_id, nb_techniciens,
                pieces_necessaires, checklist, cout_estime,
                derniere_realisation, prochaine_echeance, actif
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true)
            RETURNING *
        """,
            data["equipement_id"], data["titre"],
            data.get("description"),
            data.get("type_maintenance","preventive"),
            periodicite_type, periodicite,
            float(data.get("duree_estimee_h",1) or 1),
            data.get("technicien_id") or None,
            int(data.get("nb_techniciens",1) or 1),
            json.dumps(safe_json(data.get("pieces_necessaires"),[])),
            json.dumps(safe_json(data.get("checklist"),[])),
            float(data.get("cout_estime",0) or 0),
            derniere or None, prochaine.isoformat()
        )
        return dict(row)

async def generer_ot_depuis_plan(pool, plan_id: str, user_id: str):
    """Génère automatiquement un OT depuis un plan de maintenance"""
    async with pool.acquire() as conn:
        plan = await conn.fetchrow("SELECT * FROM plans_maintenance WHERE id=$1", plan_id)
        if not plan:
            raise ValueError("Plan introuvable")
        ot = await conn.fetchrow("""
            INSERT INTO ordres_travail (
                type_ot, equipement_id, plan_maintenance_id,
                titre, description, priorite,
                date_planifiee, duree_estimee_h,
                demandeur_id, technicien_id,
                pieces_utilisees, statut
            ) VALUES ('preventif',$1,$2,$3,$4,'normale',$5,$6,$7,$8,$9,'planifie')
            RETURNING *
        """,
            plan["equipement_id"], plan_id,
            f"MP: {plan['titre']}",
            plan["description"],
            plan["prochaine_echeance"],
            plan["duree_estimee_h"],
            user_id, plan["technicien_id"],
            json.dumps(safe_json(plan["pieces_necessaires"],[]))
        )
        # Mettre à jour la prochaine échéance du plan
        periode = plan["periodicite_valeur"]
        ptype = plan["periodicite_type"]
        if ptype == "jours": delta = timedelta(days=periode)
        elif ptype == "semaines": delta = timedelta(weeks=periode)
        else: delta = timedelta(days=periode*30)
        new_echeance = (plan["prochaine_echeance"] + delta).isoformat()
        await conn.execute(
            "UPDATE plans_maintenance SET derniere_realisation=$1, prochaine_echeance=$2 WHERE id=$3",
            plan["prochaine_echeance"], new_echeance, plan_id
        )
        return dict(ot)

# ── PIÈCES DÉTACHÉES ──────────────────────────────────────────
async def get_pieces(pool, search=None, alerte_stock=False):
    async with pool.acquire() as conn:
        q = """
            SELECT pd.*,
                f.nom AS fournisseur_nom
            FROM pieces_detachees pd
            LEFT JOIN fournisseurs f ON f.id=pd.fournisseur_id
            WHERE pd.actif=true
        """
        params = []
        if alerte_stock:
            q += " AND pd.qte_stock <= pd.qte_minimum"
        if search:
            params.append(f"%{search}%")
            q += f" AND (pd.code ILIKE ${len(params)} OR pd.designation ILIKE ${len(params)})"
        q += " ORDER BY (pd.qte_stock <= pd.qte_minimum) DESC, pd.designation"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

# ── INDICATEURS MTBF / MTTR ───────────────────────────────────
async def get_indicateurs_equipement(pool, equipement_id: str):
    async with pool.acquire() as conn:
        eq = await conn.fetchrow("SELECT * FROM equipements WHERE id=$1", equipement_id)
        if not eq: raise ValueError("Équipement introuvable")

        pannes = await conn.fetch(
            "SELECT * FROM historique_pannes WHERE equipement_id=$1 ORDER BY date_panne",
            equipement_id
        )
        ots = await conn.fetch(
            "SELECT * FROM ordres_travail WHERE equipement_id=$1 ORDER BY date_demande",
            equipement_id
        )

        nb_pannes = len(pannes)
        total_arret = sum(float(p["duree_arret_h"] or 0) for p in pannes)
        total_cout = sum(float(o["cout_total"] or 0) for o in ots if o["statut"]=="termine")

        mttr = total_arret / nb_pannes if nb_pannes > 0 else 0

        heures_fonctionnement = float(eq["compteur_heures"] or 0)
        mtbf = (heures_fonctionnement - total_arret) / nb_pannes if nb_pannes > 0 else heures_fonctionnement

        disponibilite = (heures_fonctionnement - total_arret) / heures_fonctionnement * 100 if heures_fonctionnement > 0 else 100

        return {
            "equipement": dict(eq),
            "nb_pannes": nb_pannes,
            "total_heures_arret": round(total_arret, 2),
            "mttr": round(mttr, 2),
            "mtbf": round(mtbf, 2),
            "disponibilite_pct": round(disponibilite, 2),
            "cout_maintenance_total": round(total_cout, 2),
            "nb_interventions": len(ots),
            "historique_pannes": [dict(p) for p in pannes[-10:]],
        }
