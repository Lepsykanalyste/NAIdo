import re

with open('/home/sophopsy-ia/NAIdo/backend_python/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# ─────────────────────────────────────────────────────────────
# 1. CORRIGER LA COMPOSITION JSON BRUTE dans le PDF OF
# ─────────────────────────────────────────────────────────────
old_compo = """      {f'<div class="row"><span class="lbl">Composition</span><span class="val" style="font-size:7pt;">{d["composition"]}</span></div>' if d.get('composition') else ''}"""

new_compo = """      {_compo_html(d.get('composition'))}"""

content = content.replace(old_compo, new_compo)

# ─────────────────────────────────────────────────────────────
# 2. AJOUTER LA FONCTION _compo_html avant la route of_pdf
# ─────────────────────────────────────────────────────────────
old_route = '@app.get("/api/of/{of_id}/pdf")'
new_route = '''def _compo_html(composition_raw):
    """Transforme la composition JSON en HTML lisible pour le PDF OF"""
    if not composition_raw:
        return ''
    import json
    try:
        if isinstance(composition_raw, str):
            compo = json.loads(composition_raw)
        else:
            compo = composition_raw
        if not compo or not isinstance(compo, list):
            return ''
        rows = ''
        total_pct = 0
        for i, c in enumerate(compo):
            bg = '#f9fafb' if i % 2 == 0 else '#fff'
            pct = float(c.get('pct') or 0)
            total_pct += pct
            rows += f"""<tr style="background:{bg};">
                <td style="padding:4px 8px;font-weight:700;color:#92400e;">{c.get('code','—')}</td>
                <td style="padding:4px 8px;">{c.get('designation','—')}</td>
                <td style="padding:4px 8px;text-align:center;font-weight:700;">{pct:.1f}%</td>
            </tr>"""
        return f"""
        <div style="margin-top:8px;">
          <div style="background:#fef3c7;padding:4px 8px;font-size:7pt;font-weight:700;text-transform:uppercase;
               color:#92400e;border:1px solid #fde68a;border-bottom:none;border-radius:4px 4px 0 0;">
            🧪 Composition matières premières
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:8pt;border:1px solid #fde68a;">
            <thead><tr style="background:#92400e;color:#fff;">
              <th style="padding:4px 8px;text-align:left;">Code MP</th>
              <th style="padding:4px 8px;text-align:left;">Désignation</th>
              <th style="padding:4px 8px;text-align:center;">%</th>
            </tr></thead>
            <tbody>{rows}</tbody>
            <tfoot><tr style="background:#fef3c7;font-weight:700;">
              <td colspan="2" style="padding:4px 8px;color:#92400e;">TOTAL</td>
              <td style="padding:4px 8px;text-align:center;color:#92400e;">{total_pct:.1f}%</td>
            </tr></tfoot>
          </table>
        </div>"""
    except Exception:
        return ''


@app.get("/api/of/{of_id}/pdf")'''

content = content.replace(old_route, new_route)

# ─────────────────────────────────────────────────────────────
# 3. CORRIGER : utiliser at3_composition_of si disponible
#    (composition validée par le chef AT3 prime sur la composition article)
# ─────────────────────────────────────────────────────────────
old_select = """                       a.designation AS article_nom, a.code AS article_code,
                       a.longueur_mm, a.largeur_mm, a.composition,"""
new_select = """                       a.designation AS article_nom, a.code AS article_code,
                       a.longueur_mm, a.largeur_mm,
                       COALESCE(o.at3_composition_of, a.composition, '[]'::jsonb) AS composition,"""
content = content.replace(old_select, new_select)

# ─────────────────────────────────────────────────────────────
# 4. CORRIGER : Afficher le nom de l'atelier au lieu de l'ID
# ─────────────────────────────────────────────────────────────
old_atelier_select = """                LEFT JOIN utilisateurs u ON u.login='admin'
                WHERE o.id=$1"""
new_atelier_select = """                LEFT JOIN utilisateurs u ON u.login='admin'
                LEFT JOIN ateliers at ON at.id::text = o.atelier_id::text
                WHERE o.id=$1"""
content = content.replace(old_atelier_select, new_atelier_select)

old_atelier_html = """      <div class="row"><span class="lbl">Atelier</span><span class="val">{d.get('atelier_id') or '—'}</span></div>"""
new_atelier_html = """      <div class="row"><span class="lbl">Atelier</span><span class="val">{d.get('atelier_libelle') or d.get('atelier_id') or '—'}</span></div>"""
content = content.replace(old_atelier_html, new_atelier_html)

# Ajouter atelier_libelle dans le SELECT
old_chef = """                LEFT JOIN utilisateurs u ON u.login='admin'
                LEFT JOIN ateliers at ON at.id::text = o.atelier_id::text
                WHERE o.id=$1"""
new_chef = """                LEFT JOIN utilisateurs u ON u.login='admin'
                LEFT JOIN ateliers at ON at.id::text = o.atelier_id::text
                WHERE o.id=$1"""
# (déjà fait, pas besoin de changer)

# Ajouter at.libelle dans le SELECT principal
old_cols = """                       u.nom||' '||u.prenom AS chef_nom
                FROM ordres_fabrication o"""
new_cols = """                       u.nom||' '||u.prenom AS chef_nom,
                       at.libelle AS atelier_libelle
                FROM ordres_fabrication o"""
content = content.replace(old_cols, new_cols)

# ─────────────────────────────────────────────────────────────
# 5. CORRIGER STATUT : "planifie" par défaut au lieu de "lance"
#    dans la route POST /api/of
# ─────────────────────────────────────────────────────────────
# Chercher l'insert OF et changer le statut par défaut
old_statut = """statut = data.get('statut', 'planifie')"""
# Si la valeur est déjà bonne, pas besoin de changer
# Chercher si "lance" est mis comme défaut
content = re.sub(
    r"statut\s*=\s*data\.get\('statut',\s*'lance'\)",
    "statut = data.get('statut', 'planifie')",
    content
)

# ─────────────────────────────────────────────────────────────
# Sauvegarder
# ─────────────────────────────────────────────────────────────
with open('/home/sophopsy-ia/NAIdo/backend_python/main.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ Corrections appliquées :")
print("  1. Composition JSON → tableau HTML lisible dans PDF OF")
print("  2. Utilise at3_composition_of si validée par chef AT3")
print("  3. Nom atelier au lieu de l'ID numérique")
print("  4. Statut par défaut = planifie")
