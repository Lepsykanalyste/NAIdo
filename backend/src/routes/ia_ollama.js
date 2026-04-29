const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';

// Appel Ollama
async function appelOllama(messages, model = OLLAMA_MODEL) {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: { temperature: 0.7, num_predict: 1024 }
    })
  });
  if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
  const data = await response.json();
  return data.message?.content || '';
}

// Contexte système NAIdo
const SYSTEM_PROMPT = `Tu es l'assistant IA interne de NAIdo, le système ERP/MES de Green Industry.
Tu aides les équipes de production, qualité, maintenance et management.
Tu réponds en français, de manière concise et pratique.
Tu as accès au contexte de l'atelier et tu peux analyser les non-conformités, pannes, KPI de production.
Tu proposes des actions correctives basées sur les meilleures pratiques industrielles et les normes ISO.`;

// POST /api/ia/chat — Chat général
router.post('/chat', auth, async (req, res) => {
  try {
    const { message, contexte, historique = [], atelier_id } = req.body;

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + (contexte ? `\n\nContexte : ${contexte}` : '') },
      ...historique.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    const reponse = await appelOllama(messages);

    // Sauvegarder la conversation
    await db.query(`
      INSERT INTO ia_conversations (utilisateur_id, atelier_id, type_contexte, messages, modele_ia)
      VALUES ($1,$2,'general',$3,$4)
    `, [req.user.id, atelier_id, JSON.stringify([...historique, { role:'user', content:message }, { role:'assistant', content:reponse }]), OLLAMA_MODEL]);

    res.json({ reponse, modele: OLLAMA_MODEL });
  } catch (err) {
    res.status(500).json({ error: 'IA non disponible : ' + err.message });
  }
});

// POST /api/ia/analyser-nc — Analyse automatique d'une non-conformité
router.post('/analyser-nc', auth, async (req, res) => {
  try {
    const { nc_id } = req.body;

    const { rows } = await db.query(`
      SELECT nc.*, at.libelle AS atelier, a.designation AS article, a.code AS article_code,
        o.numero_of
      FROM non_conformites nc
      LEFT JOIN ateliers at ON at.id = nc.atelier_id
      LEFT JOIN articles a ON a.id = nc.article_id
      LEFT JOIN ordres_fabrication o ON o.id = nc.of_id
      WHERE nc.id=$1
    `, [nc_id]);

    if (!rows.length) return res.status(404).json({ error: 'NC introuvable' });
    const nc = rows[0];

    const prompt = `
Analyse cette non-conformité industrielle et propose des actions correctives :

N° NC : ${nc.numero_nc}
Type : ${nc.type}
Gravité : ${nc.gravite}
Atelier : ${nc.atelier || 'Non précisé'}
Article : ${nc.article || 'Non précisé'} (${nc.article_code || ''})
OF : ${nc.numero_of || 'Non précisé'}
Description : ${nc.description}
Causes identifiées : ${nc.causes_identifiees || 'Non précisées'}
IPR AMDEC : ${nc.ipr_amdec || 'Non calculé'} (G:${nc.gravite_amdec || '?'} x O:${nc.occurrence_amdec || '?'} x D:${nc.detectabilite_amdec || '?'})

Fournis :
1. Analyse des causes racines probables (méthode 5M ou Ishikawa)
2. Actions correctives immédiates recommandées
3. Actions préventives pour éviter la récurrence
4. Niveau de priorité de traitement
5. Clause ISO 9001 potentiellement impactée
`;

    const analyse = await appelOllama([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ]);

    // Sauvegarder l'analyse
    await db.query('UPDATE non_conformites SET analyse_ia=$1 WHERE id=$2', [analyse, nc_id]);

    await db.query(`
      INSERT INTO ia_suggestions (type, entite_type, entite_id, suggestion, confiance)
      VALUES ('analyse_nc', 'non_conformite', $1, $2, 0.85)
    `, [nc_id, analyse]);

    res.json({ analyse, nc: nc.numero_nc });
  } catch (err) {
    res.status(500).json({ error: 'IA non disponible : ' + err.message });
  }
});

// POST /api/ia/analyser-production — Analyse KPI production
router.post('/analyser-production', auth, async (req, res) => {
  try {
    const { atelier_id, date_debut, date_fin } = req.body;

    const { rows: stats } = await db.query(`
      SELECT
        atelier_nom,
        COUNT(*) AS nb_rapports,
        ROUND(AVG(trs_calcule),2) AS trs_moyen,
        ROUND(AVG(taux_rebus_calcule),2) AS rebus_moyen,
        ROUND(AVG(rendement_matiere_pct),2) AS rendement_moyen,
        SUM(poids_net_kg) AS total_production,
        SUM(poids_dechets_kg) AS total_dechets,
        SUM(poids_pertes_kg) AS total_pertes,
        SUM(temps_arret_min) AS total_arrets
      FROM vue_rapports_journaliers
      WHERE date_rapport BETWEEN $1 AND $2
        AND statut IN ('valide','soumis')
        ${atelier_id ? 'AND atelier_id=$3' : ''}
      GROUP BY atelier_nom
    `, atelier_id ? [date_debut, date_fin, atelier_id] : [date_debut, date_fin]);

    if (!stats.length) return res.json({ analyse: 'Aucune donnée disponible pour cette période.' });

    const s = stats[0];
    const prompt = `
Analyse ces indicateurs de production et propose des améliorations :

Atelier : ${s.atelier_nom}
Période : ${date_debut} au ${date_fin}
Nombre de rapports : ${s.nb_rapports}

KPI :
- TRS moyen : ${s.trs_moyen}% (objectif : ≥80%)
- Taux rebus moyen : ${s.rebus_moyen}% (objectif : ≤3%)
- Rendement matière : ${s.rendement_moyen}%
- Production totale : ${s.total_production} kg
- Déchets : ${s.total_dechets} kg
- Pertes : ${s.total_pertes} kg
- Temps d'arrêt total : ${s.total_arrets} min

Fournis :
1. Analyse des points forts et points faibles
2. Causes probables des écarts par rapport aux objectifs
3. Actions d'amélioration prioritaires
4. Estimation du gain potentiel si les actions sont appliquées
5. Recommandations pour la prochaine période
`;

    const analyse = await appelOllama([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ]);

    res.json({ analyse, stats: s });
  } catch (err) {
    res.status(500).json({ error: 'IA non disponible : ' + err.message });
  }
});

// POST /api/ia/generer-procedure — Générer une procédure ISO
router.post('/generer-procedure', auth, async (req, res) => {
  try {
    const { titre, type_processus, atelier, contexte } = req.body;

    const prompt = `
Génère une procédure industrielle conforme ISO 9001 :

Titre : ${titre}
Type de processus : ${type_processus}
Atelier concerné : ${atelier}
Contexte spécifique : ${contexte || 'Industrie plastique / sacherie'}

La procédure doit inclure :
1. Objet et domaine d'application
2. Documents de référence (normes ISO)
3. Responsabilités
4. Description du processus (étapes numérotées)
5. Enregistrements requis
6. Indicateurs de performance
7. Gestion des non-conformités liées

Format : structuré, clair, adapté à une utilisation tablette en atelier.
`;

    const procedure = await appelOllama([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ]);

    res.json({ procedure });
  } catch (err) {
    res.status(500).json({ error: 'IA non disponible : ' + err.message });
  }
});

// POST /api/ia/analyser-panne — Analyse d'une panne machine
router.post('/analyser-panne', auth, async (req, res) => {
  try {
    const { equipement, symptomes, historique_pannes } = req.body;

    const prompt = `
Analyse cette panne machine et propose un diagnostic :

Équipement : ${equipement}
Symptômes : ${symptomes}
Historique des pannes récentes : ${historique_pannes || 'Non fourni'}

Fournis :
1. Diagnostic probable (causes les plus vraisemblables)
2. Vérifications immédiates à effectuer
3. Pièces susceptibles d'être défectueuses
4. Procédure de réparation recommandée
5. Actions préventives pour éviter la récurrence
6. Estimation du temps de réparation
`;

    const analyse = await appelOllama([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ]);

    res.json({ analyse });
  } catch (err) {
    res.status(500).json({ error: 'IA non disponible : ' + err.message });
  }
});

// GET /api/ia/status — Vérifier si Ollama est disponible
router.get('/status', auth, async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await response.json();
    const modeles = data.models?.map(m => m.name) || [];
    res.json({
      disponible: true,
      url: OLLAMA_URL,
      modele_actif: OLLAMA_MODEL,
      modeles_disponibles: modeles
    });
  } catch {
    res.json({ disponible: false, url: OLLAMA_URL, message: 'Ollama non accessible' });
  }
});

// GET /api/ia/suggestions — Suggestions IA non appliquées
router.get('/suggestions', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT * FROM ia_suggestions
      WHERE appliquee=false AND rejetee=false
      ORDER BY created_at DESC LIMIT 20
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/ia/suggestions/:id/appliquer
router.put('/suggestions/:id/appliquer', auth, async (req, res) => {
  try {
    await db.query('UPDATE ia_suggestions SET appliquee=true WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
