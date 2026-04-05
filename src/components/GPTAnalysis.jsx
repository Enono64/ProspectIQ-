// ============================================================
//  ProspectIQ — Backend v1.0
//  Node.js / Express — Railway
// ============================================================
//  .env requis :
//    SUPABASE_URL
//    SUPABASE_SERVICE_KEY
//    SUPABASE_ANON_KEY
//    ANTHROPIC_API_KEY
//    BALLDONTLIE_KEY     (optionnel, renforce NBA)
//    PORT                (défaut 3001)
// ============================================================

import express          from 'express';
import cors             from 'cors';
import cron             from 'node-cron';
import fetch            from 'node-fetch';
import { createClient } from '@supabase/supabase-js';


// Saison en cours dynamique
function currentSeason() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  if (month >= 9) return `${year}-${String(year + 1).slice(2)}`
  return `${year - 1}-${String(year).slice(2)}`
}

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors());
app.use(express.json());

// ── Clients Supabase ──────────────────────────────────────────
const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const dbPublic = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ============================================================
//  UTILITAIRES
// ============================================================

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  const { data: { user }, error } = await dbPublic.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Token invalide' });
  req.user = user;
  next();
}

async function logSync(type, playerId, status, rows = 0, errorMsg = null) {
  try {
    await db.from('sync_logs').insert({
      sync_type:    type,
      player_id:    playerId || null,
      status,
      rows_updated: rows,
      error:        errorMsg,
      finished_at:  new Date().toISOString(),
    });
  } catch (e) {
    console.error('[logSync]', e.message);
  }
}

// Appel Claude — un seul appel, Sonnet pour autofill, Haiku pour le reste
async function callClaude(messages, { maxTokens = 1000, webSearch = false, model = 'claude-haiku-4-5-20251001' } = {}) {
  const headers = {
    'Content-Type':      'application/json',
    'x-api-key':         process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
  };
  if (webSearch) headers['anthropic-beta'] = 'web-search-2025-03-05';

  const body = { model, max_tokens: maxTokens, messages };
  if (webSearch) body.tools = [{ type: 'web_search_20250305', name: 'web_search' }];

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers, body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (data.error) throw new Error(`Claude API: ${data.error.message}`);
  return data.content?.filter(b => b.type === 'text').map(b => b.text).join('') || '';
}

function parseAIJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Aucun JSON dans la réponse IA');
  return JSON.parse(match[0]);
}

function calculateAdvancedStats(p) {
  const s = {};
  if (p.pts && p.fga && p.fta)
    s.ts_pct  = parseFloat((p.pts / (2 * (p.fga + 0.44 * p.fta)) * 100).toFixed(1));
  if (p.fgm && p.fg3m && p.fga)
    s.efg_pct = parseFloat(((p.fgm + 0.5 * p.fg3m) / p.fga * 100).toFixed(1));
  if (p.ortg && p.drtg)
    s.net_rtg = parseFloat((p.ortg - p.drtg).toFixed(1));
  if (p.ast && p.tov && p.tov > 0)
    s.ast_to  = parseFloat((p.ast / p.tov).toFixed(2));
  return s;
}

// ============================================================
//  SANTÉ
// ============================================================
app.get('/health', (_, res) => res.json({
  status: 'ok', version: '1.0.0', time: new Date().toISOString()
}));

// ============================================================
//  JOUEURS — CRUD
// ============================================================

app.get('/players', requireAuth, async (req, res) => {
  const { league, status, position, search } = req.query;
  let q = db.from('players').select(
    'id, first_name, last_name, position, team, league, status, scout_grade, age, height_cm, nationality, pts, reb, ast, bpm, ts_pct, usg_pct, photo_url, last_synced_at, reports(id, global_grade, report_date)'
  );
  if (league)   q = q.eq('league', league);
  if (status)   q = q.eq('status', status);
  if (position) q = q.eq('position', position);
  if (search)   q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,team.ilike.%${search}%`);
  q = q.order('scout_grade', { ascending: false });
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/players/:id', requireAuth, async (req, res) => {
  const { data, error } = await db
    .from('players').select('*, reports(*)').eq('id', req.params.id).single();
  if (error || !data) return res.status(404).json({ error: 'Joueur introuvable' });
  res.json(data);
});

app.post('/players', requireAuth, async (req, res) => {
  const payload = { ...req.body, ...calculateAdvancedStats(req.body) };
  const { data, error } = await db.from('players').insert(payload).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

app.patch('/players/:id', requireAuth, async (req, res) => {
  const payload = { ...req.body, ...calculateAdvancedStats(req.body) };
  const { data, error } = await db
    .from('players').update(payload).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/players/:id', requireAuth, async (req, res) => {
  const { error } = await db.from('players').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// ============================================================
//  AGENT IA — AUTO-REMPLISSAGE (1 seul appel Sonnet)
// ============================================================
app.post('/players/autofill', requireAuth, async (req, res) => {
  const { name, league } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom du joueur requis' });

  try {
    // Un seul appel Sonnet avec web search — recherche ET formatage en même temps
    const result = await callClaude([{
      role: 'user',
      content: `You are a professional basketball data analyst. Find accurate stats for player "${name}" currently playing in ${league || 'professional basketball'}.

SEARCH INSTRUCTIONS:
- Search for their CURRENT ${currentSeason()} season stats
- Priority sources: basketball-reference.com, eurobasket.com, proballers.com, espn.com, realgm.com, fibaeurope.com, lnb.fr
- If ${currentSeason()} not available, use most recent season
- Search their current team and league first, then cross-reference

DATA RULES — CRITICAL:
- ALL stats must be PER GAME AVERAGES, never season totals
- Percentages as numbers 0-100 (e.g. FG% = 48.3, NOT 0.483)
- Sanity checks: PTS 0-60, REB 0-25, AST 0-20, STL 0-5, BLK 0-5, FG% 20-75, 3P% 0-55, FT% 40-100
- If a value seems unrealistic for the position, set to null
- Height in centimeters (e.g. 193 for 6'4"), weight in kg
- position format: PG, SG, SF, PF, C, or combinations like PG/SG
- photo_url: direct URL to official headshot if available (ESPN, team website)

Return ONLY a valid JSON object, no markdown, no explanation:
{
  "first_name": "",
  "last_name": "",
  "nationality": "",
  "age": null,
  "height_cm": null,
  "weight_kg": null,
  "position": "",
  "team": "",
  "league": "",
  "season": "",
  "photo_url": "",
  "gp": null,
  "min": null,
  "pts": null,
  "reb": null,
  "ast": null,
  "stl": null,
  "blk": null,
  "tov": null,
  "fga": null,
  "fgm": null,
  "fg_pct": null,
  "fg3a": null,
  "fg3m": null,
  "fg3_pct": null,
  "fta": null,
  "ftm": null,
  "ft_pct": null,
  "per": null,
  "bpm": null,
  "obpm": null,
  "dbpm": null,
  "usg_pct": null,
  "vorp": null,
  "ortg": null,
  "drtg": null,
  "observation": "1 sentence scouting note based on the stats"
}`
    }], {
      webSearch: true,
      maxTokens: 1500,
      model: 'claude-sonnet-4-20250514'
    });

    const player = parseAIJson(result);
    Object.assign(player, calculateAdvancedStats(player));
    res.json({ ok: true, player });

  } catch (e) {
    console.error('[Autofill]', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ============================================================
//  SYNC STATS — Agent IA + BallDontLie NBA
// ============================================================
async function syncPlayerStats(player) {
  const name = `${player.first_name} ${player.last_name}`;
  console.log(`[Sync] ${name} (${player.league})...`);

  try {
    // NBA via BallDontLie
    if (player.league === 'NBA' && process.env.BALLDONTLIE_KEY) {
      const r = await fetch(
        `https://api.balldontlie.io/v1/players?search=${encodeURIComponent(name)}&per_page=3`,
        { headers: { 'Authorization': process.env.BALLDONTLIE_KEY } }
      );
      if (r.ok) {
        const found = (await r.json()).data?.[0];
        if (found) {
          const sr = await fetch(
            `https://api.balldontlie.io/v1/season_averages?player_ids[]=${found.id}&season=2025`,
            { headers: { 'Authorization': process.env.BALLDONTLIE_KEY } }
          );
          if (sr.ok) {
            const s = (await sr.json()).data?.[0];
            if (s) {
              const updates = {
                gp: s.games_played, min: s.min ? parseFloat(s.min) : null,
                pts: s.pts, reb: s.reb, ast: s.ast, stl: s.stl, blk: s.blk, tov: s.turnover,
                fg_pct:  s.fg_pct  ? +(s.fg_pct  * 100).toFixed(1) : null,
                fg3_pct: s.fg3_pct ? +(s.fg3_pct * 100).toFixed(1) : null,
                ft_pct:  s.ft_pct  ? +(s.ft_pct  * 100).toFixed(1) : null,
                season: currentSeason(), last_synced_at: new Date().toISOString(),
              };
              Object.assign(updates, calculateAdvancedStats({ ...player, ...updates }));
              await db.from('players').update(updates).eq('id', player.id);
              await logSync('balldontlie', player.id, 'success', 1);
              console.log(`[Sync] ✅ ${name} — BallDontLie`);
              return;
            }
          }
        }
      }
    }

    // Agent IA pour toutes les autres ligues (1 seul appel)
    const result = await callClaude([{
      role: 'user',
      content: `Basketball data analyst task: find ${currentSeason()} per game stats for "${name}" playing in ${player.league || 'professional basketball'}.

Search basketball-reference, eurobasket, proballers, ESPN, realgm, league official sites.
Return ONLY valid JSON. Percentages 0-100. PER GAME averages only (not totals). null if not found.
Sanity check before returning: PTS<60, REB<25, AST<20, STL<5, BLK<5, FG%<80.

{"gp":null,"min":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fga":null,"fgm":null,"fg_pct":null,"fg3a":null,"fg3m":null,"fg3_pct":null,"fta":null,"ftm":null,"ft_pct":null,"per":null,"bpm":null,"obpm":null,"dbpm":null,"usg_pct":null,"vorp":null,"ortg":null,"drtg":null,"team":""}`
    }], { webSearch: true, maxTokens: 1000 });

    const stats = parseAIJson(result);
    const updates = Object.fromEntries(Object.entries(stats).filter(([, v]) => v !== null && v !== ''));

    if (Object.keys(updates).length < 3) throw new Error('Pas assez de stats trouvées');

    updates.season         = '2024-25';
    updates.last_synced_at = new Date().toISOString();
    Object.assign(updates, calculateAdvancedStats({ ...player, ...updates }));

    await db.from('players').update(updates).eq('id', player.id);
    await logSync('ai_agent', player.id, 'success', 1);
    console.log(`[Sync] ✅ ${name} — Agent IA`);

  } catch (e) {
    console.error(`[Sync] ❌ ${name}:`, e.message);
    await logSync('ai_agent', player.id, 'error', 0, e.message);
  }
}

app.post('/players/:id/sync', requireAuth, async (req, res) => {
  const { data: player, error } = await db
    .from('players').select('*').eq('id', req.params.id).single();
  if (error || !player) return res.status(404).json({ error: 'Joueur introuvable' });
  syncPlayerStats(player).catch(console.error);
  res.json({ ok: true, message: 'Synchronisation lancée' });
});

async function syncAllPlayers() {
  console.log('[CRON] Démarrage sync nocturne...');
  const { data: players } = await db
    .from('players')
    .select('id, first_name, last_name, league, fga, fgm, fg3m, fta, ortg, drtg, ast, tov')
    .not('first_name', 'is', null);

  if (!players?.length) return console.log('[CRON] Aucun joueur');
  console.log(`[CRON] ${players.length} joueurs à synchroniser`);

  for (const player of players) {
    await syncPlayerStats(player);
    await new Promise(r => setTimeout(r, 8000)); // Éviter rate limit Claude API
  }
  console.log('[CRON] ✅ Terminé');
}

app.post('/admin/sync-all', requireAuth, (req, res) => {
  syncAllPlayers().catch(console.error);
  res.json({ ok: true, message: 'Sync lancée en arrière-plan' });
});

cron.schedule('0 6 * * *', syncAllPlayers, { timezone: 'Europe/Paris' });

// ============================================================
//  RAPPORTS
// ============================================================

app.post('/players/:id/reports', requireAuth, async (req, res) => {
  const { data, error } = await db.from('reports')
    .insert({ ...req.body, player_id: req.params.id, source: 'Manuel' })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

app.post('/players/:id/reports/ai', requireAuth, async (req, res) => {
  const { data: player, error } = await db
    .from('players').select('*').eq('id', req.params.id).single();
  if (error || !player) return res.status(404).json({ error: 'Joueur introuvable' });

  const name = `${player.first_name} ${player.last_name}`;

  const statsLines = [
    player.gp    && `Matchs: ${player.gp} | Min: ${player.min}`,
    player.pts   && `PTS:${player.pts} REB:${player.reb} AST:${player.ast} STL:${player.stl} BLK:${player.blk} TOV:${player.tov}`,
    player.fg_pct && `FG%:${player.fg_pct} 3P%:${player.fg3_pct} FT%:${player.ft_pct}`,
    player.ts_pct && `TS%:${player.ts_pct} eFG%:${player.efg_pct} USG%:${player.usg_pct}`,
    player.bpm    && `BPM:${player.bpm} (OFF:${player.obpm}/DEF:${player.dbpm}) VORP:${player.vorp} PER:${player.per}`,
    player.ortg   && `ORTG:${player.ortg} DRTG:${player.drtg} Net:${player.net_rtg}`,
  ].filter(Boolean).join(' | ');

    // Contexte de ligue pour la contextualisation
  const leagueContext = {
    'NBA':           { level: 10, desc: 'meilleure ligue mondiale' },
    'EuroLeague':    { level: 9,  desc: 'meilleur niveau européen' },
    'G-League':      { level: 7,  desc: 'antichambre NBA' },
    'Betclic Élite': { level: 7,  desc: 'premier niveau français, équivalent D2 européen' },
    'EuroCup':       { level: 8,  desc: 'deuxième niveau européen' },
    'BCL':           { level: 7,  desc: 'troisième niveau européen' },
    'Liga ACB (ESP)':{ level: 8,  desc: 'premier niveau espagnol, top-3 européen' },
    'Pro B':         { level: 5,  desc: 'deuxième niveau français' },
    'NM1':           { level: 4,  desc: 'troisième niveau français' },
    'NCAA':          { level: 6,  desc: 'premier niveau universitaire américain' },
    'Lega A (ITA)':  { level: 7,  desc: 'premier niveau italien' },
    'BBL (GER)':     { level: 7,  desc: 'premier niveau allemand' },
    'Korisliiga (FIN)': { level: 5, desc: 'premier niveau finlandais' },
  }
  const lgCtx = leagueContext[player.league] || { level: 5, desc: 'ligue professionnelle' }

  // Détection automatique du profil
  const pts = player.pts || 0
  const ast = player.ast || 0
  const reb = player.reb || 0
  const usg = player.usg_pct || 0
  const ts  = player.ts_pct  || 0
  const bpm = player.bpm     || 0
  const stl = player.stl     || 0
  const blk = player.blk     || 0

  let detectedProfile = ''
  if (usg > 25 && pts > 18)                         detectedProfile = 'Primary scorer / 1st option'
  else if (ast > 6 && usg > 20)                     detectedProfile = 'Playmaker / Primary ball-handler'
  else if (usg > 22 && ast > 4 && pts > 14)         detectedProfile = 'Combo guard / Shot creator'
  else if (ts > 58 && usg < 18 && pts > 10)         detectedProfile = '3&D / Efficient role player'
  else if (reb > 8 && blk > 1.5)                    detectedProfile = 'Rim protector / Defensive anchor'
  else if (reb > 9 && pts > 12)                     detectedProfile = 'Two-way big / Paint presence'
  else if (ast > 5 && usg < 20)                     detectedProfile = 'Point guard / Facilitator'
  else if (stl > 1.5 && bpm > 1)                    detectedProfile = 'Two-way wing / Defensive specialist'
  else if (pts > 15 && ts > 55)                     detectedProfile = 'Efficient scorer / Secondary option'
  else                                               detectedProfile = 'Role player / Specialist'

  // InStat context si disponible
  const instatLines = [
    player.is_pnr_handler_made != null && `PnR Handler: ${player.is_pnr_handler_made}/match`,
    player.is_iso_made         != null && `Isolation: ${player.is_iso_made}/match`,
    player.is_cuts_made        != null && `Cuts: ${player.is_cuts_made}/match`,
    player.is_drives_made      != null && `Drives: ${player.is_drives_made}/match`,
    player.is_catch_shoot_made != null && `Catch&Shoot: ${player.is_catch_shoot_made}/match`,
    player.is_post_made        != null && `Post Up: ${player.is_post_made}/match`,
    player.is_deflections      != null && `Déflexions: ${player.is_deflections}/match`,
    player.is_contested_made   != null && `Tirs contestés mis: ${player.is_contested_made}/match`,
  ].filter(Boolean).join(' | ')

  const prompt = "You are a senior basketball data analyst and scout at NBA front office level.\n" +
    "Your reports are used by sporting directors and head coaches to make recruitment decisions.\n" +
    "Write in French. Be precise, factual, data-driven. Every statement must cite a statistic.\n\n" +
    "FICHE JOUEUR\n" +
    "Nom : " + name + "\n" +
    "Poste : " + (player.position||'') + " | Profil : " + detectedProfile + "\n" +
    "Equipe : " + (player.team||'') + " | Ligue : " + (player.league||'') + " (niveau " + lgCtx.level + "/10 — " + lgCtx.desc + ")\n" +
    "Age : " + (player.age||'') + " ans | Taille : " + (player.height_cm||'') + " cm | Nation : " + (player.nationality||'') + "\n" +
    "Note scout : " + (player.scout_grade||5) + "/10 | Statut : " + (player.status||'') + "\n" +
    "Plafond : " + (player.ceiling||'Non defini') + " | Comparable : " + (player.comparable||'Non defini') + "\n\n" +
    "STATISTIQUES\n" +
    (statsLines || 'Non disponibles') + "\n" +
    (instatLines ? "INSTAT : " + instatLines + "\n" : '') +
    (player.strengths   ? "FORCES : "    + player.strengths   + "\n" : '') +
    (player.weaknesses  ? "FAIBLESSES : " + player.weaknesses  + "\n" : '') +
    (player.observation ? "TERRAIN : "   + player.observation  + "\n" : '') +
    "\nRédige un rapport scout en français avec ces 6 sections :\n\n" +
    "## PROFIL & IDENTITE DE JEU\n" +
    "Définis l'archétype précis. Profil détecté : " + detectedProfile + ". 2-3 phrases.\n\n" +
    "## ANALYSE OFFENSIVE\n" +
    "Contextualise " + pts + " pts dans " + (player.league||'') + " (niveau " + lgCtx.level + "/10). TS% " + ts + "%, USG% " + usg + "%. Forces et lacunes avec chiffres.\n\n" +
    "## ANALYSE DEFENSIVE\n" +
    "STL " + stl + ", BLK " + blk + ". Engagement défensif, points faibles.\n\n" +
    "## CONTEXTUALISATION & TRANSLATION\n" +
    "Comment ses stats se traduisent au niveau supérieur ? Facteur de traduction ligue niveau " + lgCtx.level + "/10.\n\n" +
    "## PROJECTION & PLAFOND\n" +
    "Niveau dans 2 et 5 ans. Rôle précis. Comparable data-driven avec 2-3 stats similaires.\n\n" +
    "## VERDICT FINAL\n" +
    "Ligne 1 : TOP PROSPECT / PRIORITAIRE / A SURVEILLER / EN VEILLE / ECARTE\n" +
    "Ligne 2 : Recommandation concrète.\n" +
    "Ligne 3 : Prix de marché (niveau " + (player.league||'') + ").";

    try {
    const reportText = await callClaude([{ role: 'user', content: prompt }], { maxTokens: 1000 });
    const { data: saved, error: saveError } = await db.from('reports').insert({
      player_id:    req.params.id,
      source:       'IA',
      report_date:  new Date().toISOString().split('T')[0],
      global_grade: player.scout_grade || 5,
      ai_report:    reportText,
      observation:  reportText,
    }).select().single();
    if (saveError) throw new Error(saveError.message);
    res.json({ ok: true, report: saved });
  } catch (e) {
    console.error('[Rapport IA]', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.patch('/reports/:id', requireAuth, async (req, res) => {
  const { data, error } = await db
    .from('reports').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/reports/:id', requireAuth, async (req, res) => {
  const { error } = await db.from('reports').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// ============================================================
//  WATCHLIST
// ============================================================

app.get('/watchlist', requireAuth, async (req, res) => {
  const { data, error } = await db.from('watchlist')
    .select('added_at, note, players(*)')
    .eq('user_id', req.user.id)
    .order('added_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(w => ({ ...w.players, watchlisted_at: w.added_at, watchlist_note: w.note })));
});

app.post('/watchlist/:playerId', requireAuth, async (req, res) => {
  const { error } = await db.from('watchlist')
    .upsert({ user_id: req.user.id, player_id: req.params.playerId, note: req.body.note });
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ ok: true });
});

app.delete('/watchlist/:playerId', requireAuth, async (req, res) => {
  const { error } = await db.from('watchlist')
    .delete().eq('user_id', req.user.id).eq('player_id', req.params.playerId);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// ============================================================
//  COMPARAISON JOUEURS
// ============================================================
app.post('/players/compare', requireAuth, async (req, res) => {
  const { playerIds } = req.body;
  if (!playerIds?.length || playerIds.length < 2) return res.status(400).json({ error: 'Minimum 2 joueurs' });
  if (playerIds.length > 4) return res.status(400).json({ error: 'Maximum 4 joueurs' });

  const { data: players, error } = await db.from('players').select('*').in('id', playerIds);
  if (error || !players?.length) return res.status(404).json({ error: 'Joueurs introuvables' });

  const summary = players.map(p =>
    p.first_name + ' ' + p.last_name + ' (' + p.position + ', ' + p.team + ', ' + p.league + ') — ' +
    p.pts + 'pts ' + p.reb + 'reb ' + p.ast + 'ast | TS%:' + p.ts_pct + ' BPM:' + p.bpm + ' USG%:' + p.usg_pct + ' | Note:' + p.scout_grade + '/10'
  ).join('\n');

  try {
    const analysis = await callClaude([{
      role: 'user',
      content: 'Compare ces ' + players.length + ' joueurs en tant qu\'analyste pro :\n' + summary + '\n\nAnalyse comparative (6-8 phrases) : efficacité offensive (TS%, USG%), apport défensif, impact global (BPM), profil de club adapté, classement final justifié.'
    }], { maxTokens: 700 });
    res.json({ ok: true, players, analysis });
  } catch {
    res.json({ ok: true, players, analysis: null });
  }
});

// ============================================================
//  DASHBOARD
// ============================================================
app.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const [
      { count: totalPlayers },
      { data: byStatus },
      { data: byLeague },
      { data: topPlayers },
      { data: recentReports },
      { data: lastSync },
    ] = await Promise.all([
      db.from('players').select('*', { count: 'exact', head: true }),
      db.from('players').select('status').neq('status', null),
      db.from('players').select('league').neq('league', null),
      db.from('players').select('id, first_name, last_name, position, team, league, scout_grade, status, pts, bpm').order('scout_grade', { ascending: false }).limit(5),
      db.from('reports').select('id, report_date, source, global_grade, players(first_name, last_name)').order('created_at', { ascending: false }).limit(5),
      db.from('sync_logs').select('*').order('started_at', { ascending: false }).limit(1).single(),
    ]);

    const statusCount = (byStatus || []).reduce((acc, { status }) => {
      acc[status] = (acc[status] || 0) + 1; return acc;
    }, {});

    const leagueCount = (byLeague || []).reduce((acc, { league }) => {
      acc[league] = (acc[league] || 0) + 1; return acc;
    }, {});

    res.json({ totalPlayers, statusCount, leagueCount, topPlayers, recentReports, lastSync });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
//  CALENDRIER — via API-Sports + IA
// ============================================================
app.get('/schedule', requireAuth, async (req, res) => {
  const today = new Date().toISOString().split('T')[0]
  const in14  = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
  const from  = req.query.from || today
  const to    = req.query.to   || in14

  try {
    // Récupérer tous les joueurs avec leur équipe et ligue
    const { data: players } = await db.from('players')
      .select('id, first_name, last_name, team, league, scout_grade, status')
      .not('team', 'is', null)
      .limit(50)

    if (!players?.length) return res.json([])

    // Mapping ligue → ID API-Sports
    const LEAGUE_IDS = {
      'BBL (GER)':      { id: 117, season: '2025-2026' },
      'Pro A (GER)':    { id: 118, season: '2025-2026' },
      'Betclic Elite':  { id: 138, season: '2025-2026' },
      'Pro B':          { id: 140, season: '2025-2026' },
      'Liga ACB (ESP)': { id: 119, season: '2025-2026' },
      'Lega A (ITA)':   { id: 131, season: '2025-2026' },
      'BSL (TUR)':      { id: 120, season: '2025-2026' },
      'NCAA':           { id: 116, season: '2025-2026' },
      'NBA':            { id: 12,  season: '2025-2026' },
    }

    const games = []
    const seen  = new Set()

    for (const player of players) {
      const leagueConf = LEAGUE_IDS[player.league]
      if (!leagueConf || !API_SPORTS_KEY) continue

      try {
        // Chercher les prochains matchs de la ligue
        const url = new URL(API_SPORTS_URL + '/games')
        url.searchParams.set('league', leagueConf.id)
        url.searchParams.set('season', leagueConf.season)
        url.searchParams.set('date', from)
        const resp = await fetch(url.toString(), {
          headers: { 'x-apisports-key': API_SPORTS_KEY }
        })
        if (!resp.ok) continue
        const data = await resp.json()
        const leagueGames = data.response || []

        for (const game of leagueGames) {
          const homeTeam = game.teams?.home?.name || ''
          const awayTeam = game.teams?.away?.name || ''
          const gameDate = game.date?.split('T')[0]

          if (!gameDate || gameDate < from || gameDate > to) continue

          // Vérifier si l'équipe du joueur joue
          const playerTeam = (player.team || '').toLowerCase()
          const isHome = homeTeam.toLowerCase().includes(playerTeam) || playerTeam.includes(homeTeam.toLowerCase().slice(0, 5))
          const isAway = awayTeam.toLowerCase().includes(playerTeam) || playerTeam.includes(awayTeam.toLowerCase().slice(0, 5))

          if (!isHome && !isAway) continue

          const gameKey = game.id + '-' + player.id
          if (seen.has(gameKey)) continue
          seen.add(gameKey)

          games.push({
            player: {
              id: player.id,
              first_name: player.first_name,
              last_name: player.last_name,
              team: player.team,
              league: player.league,
              scout_grade: player.scout_grade,
              status: player.status,
            },
            schedule: {
              id: game.id,
              game_date: gameDate,
              time: game.date?.split('T')[1]?.slice(0, 5) || '',
              team_name: isHome ? homeTeam : awayTeam,
              opponent: isHome ? awayTeam : homeTeam,
              home_away: isHome ? 'home' : 'away',
              home_score: game.scores?.home?.total,
              away_score: game.scores?.away?.total,
              status: game.status?.short || 'NS',
              league: player.league,
            }
          })
        }
        await new Promise(r => setTimeout(r, 200))
      } catch (e) {
        console.error('[Schedule]', player.team, e.message)
      }
    }

    // Trier par date
    games.sort((a, b) => a.schedule.game_date.localeCompare(b.schedule.game_date))
    res.json(games)

  } catch (e) {
    console.error('[Schedule]', e.message)
    res.status(500).json({ error: e.message })
  }
});

// ============================================================
//  EXPORT PDF — Rapport scout professionnel
// ============================================================
app.get('/players/:id/pdf', requireAuth, async (req, res) => {
  const { data: player, error } = await db
    .from('players').select('*, reports(*)').eq('id', req.params.id).single()
  if (error || !player) return res.status(404).json({ error: 'Joueur introuvable' })

  try {
    const { execSync } = await import('child_process')
    const { mkdtempSync, writeFileSync, readFileSync, unlinkSync } = await import('fs')
    const { tmpdir } = await import('os')
    const { join } = await import('path')

    // Créer dossier temp
    const tmpDir  = mkdtempSync(join(tmpdir(), 'piq-'))
    const dataPath = join(tmpDir, 'data.json')
    const pdfPath  = join(tmpDir, 'rapport.pdf')

    // Écrire les données joueur
    writeFileSync(dataPath, JSON.stringify(player))

    // Script Python inline
    const script = `
import sys, json
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER

ACC    = colors.HexColor('#ff4500')
TEAL   = colors.HexColor('#00c896')
PURPLE = colors.HexColor('#9966ff')
CARD   = colors.HexColor('#111118')
BORDER = colors.HexColor('#1e1e2e')
TXT    = colors.HexColor('#e8e8f0')
MUTED  = colors.HexColor('#6b6b80')
BG     = colors.HexColor('#05050a')

def style(name, **kw):
    return ParagraphStyle(name, **kw)

def fmt(v):
    if v is None: return u'\u2014'
    if isinstance(v, float): return f'{v:.1f}'
    return str(v)

def section_header(text, color=None):
    if color is None: color = MUTED
    return [
        Paragraph(text.upper(), style('sh_'+text[:8], fontSize=7, textColor=color,
                  fontName='Helvetica-Bold', leading=10, spaceAfter=2)),
        HRFlowable(width='100%', thickness=0.5, color=BORDER, spaceAfter=5),
    ]

with open(sys.argv[1]) as f:
    player = json.load(f)

doc = SimpleDocTemplate(sys.argv[2], pagesize=A4,
    leftMargin=15*mm, rightMargin=15*mm, topMargin=15*mm, bottomMargin=15*mm)

name   = (player.get('first_name','') + ' ' + player.get('last_name','')).strip()
pos    = player.get('position', '')
team   = player.get('team', '')
league = player.get('league', '')
age    = player.get('age', '')
nat    = player.get('nationality', '')
ht     = player.get('height_cm', '')
grade  = player.get('scout_grade', 5)
status = str(player.get('status', '')).replace('\U0001f535','').replace('\U0001f7e1','').replace('\U0001f7e2','').replace('\U0001f534','').strip()
season = player.get('season', '2024-25')

story = []

# HEADER
header = Table([
    [
        Paragraph(name, style('t', fontSize=20, textColor=TXT, fontName='Helvetica-Bold')),
        Paragraph(str(grade)+'/10', style('g', fontSize=24, textColor=ACC, fontName='Helvetica-Bold', alignment=TA_CENTER)),
    ],
    [
        Paragraph(pos + '  ·  ' + team + '  ·  ' + league, style('s', fontSize=10, textColor=MUTED, fontName='Helvetica')),
        Paragraph(status, style('st', fontSize=8, textColor=ACC, fontName='Helvetica-Bold', alignment=TA_CENTER)),
    ],
    [
        Paragraph((str(nat) if nat else '') + ('  ' + str(age) + ' ans' if age else '') + ('  ' + str(ht) + 'cm' if ht else '') + '  ·  Saison ' + str(season),
                  style('i', fontSize=8, textColor=MUTED, fontName='Helvetica')),
        Paragraph('ProspectIQ', style('e', fontSize=7, textColor=MUTED, fontName='Helvetica', alignment=TA_CENTER)),
    ],
], colWidths=[135*mm, 35*mm])
header.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), CARD),
    ('LEFTPADDING', (0,0), (0,-1), 10),
    ('RIGHTPADDING', (1,0), (1,-1), 10),
    ('TOPPADDING', (0,0), (-1,0), 10),
    ('BOTTOMPADDING', (0,-1), (-1,-1), 10),
    ('VALIGN', (1,0), (1,-1), 'MIDDLE'),
    ('LINEBELOW', (0,0), (-1,-1), 0.5, BORDER),
]))
story.append(header)
story.append(Spacer(1, 6*mm))

# STATS PRINCIPALES
story += section_header('Statistiques cles', TEAL)
stats = [('PTS', player.get('pts')), ('REB', player.get('reb')), ('AST', player.get('ast')),
         ('STL', player.get('stl')), ('BLK', player.get('blk')), ('TOV', player.get('tov'))]
st_data = [[
    Table([[Paragraph(l, style('sl'+l, fontSize=7, textColor=MUTED, fontName='Helvetica', alignment=TA_CENTER))],
           [Paragraph(fmt(v), style('sv'+l, fontSize=20, textColor=TXT, fontName='Helvetica-Bold', alignment=TA_CENTER, leading=24))]],
          colWidths=[27*mm]) for l, v in stats
]]
st = Table(st_data, colWidths=[27*mm]*6)
st.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), CARD), ('GRID', (0,0), (-1,-1), 0.5, BORDER),
    ('TOPPADDING', (0,0), (-1,-1), 6), ('BOTTOMPADDING', (0,0), (-1,-1), 6),
]))
story.append(st)
story.append(Spacer(1, 3*mm))

adv = [
    ('TS%', (fmt(player.get('ts_pct'))+'%') if player.get('ts_pct') else u'\u2014'),
    ('FG%', (fmt(player.get('fg_pct'))+'%') if player.get('fg_pct') else u'\u2014'),
    ('3P%', (fmt(player.get('fg3_pct'))+'%') if player.get('fg3_pct') else u'\u2014'),
    ('FT%', (fmt(player.get('ft_pct'))+'%') if player.get('ft_pct') else u'\u2014'),
    ('USG%', (fmt(player.get('usg_pct'))+'%') if player.get('usg_pct') else u'\u2014'),
    ('BPM', fmt(player.get('bpm'))),
]
adv_data = [[
    Table([[Paragraph(l, style('al'+l, fontSize=7, textColor=MUTED, fontName='Helvetica', alignment=TA_CENTER))],
           [Paragraph(v, style('av'+l, fontSize=13, textColor=TEAL, fontName='Helvetica-Bold', alignment=TA_CENTER, leading=18))]],
          colWidths=[27*mm]) for l, v in adv
]]
at = Table(adv_data, colWidths=[27*mm]*6)
at.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), CARD), ('GRID', (0,0), (-1,-1), 0.5, BORDER),
    ('TOPPADDING', (0,0), (-1,-1), 4), ('BOTTOMPADDING', (0,0), (-1,-1), 4),
]))
story.append(at)
story.append(Spacer(1, 6*mm))

# PROFIL
profile_items = []
if player.get('ceiling'):    profile_items.append(('Plafond', player['ceiling']))
if player.get('comparable'): profile_items.append(('Comparable', player['comparable']))
if player.get('strengths'):  profile_items.append(('Forces', player['strengths']))
if player.get('weaknesses'): profile_items.append(('Faiblesses', player['weaknesses']))
if player.get('observation'):profile_items.append(('Observation', player['observation']))

if profile_items:
    story += section_header('Profil Scout', ACC)
    for k, v in profile_items:
        row = Table([[
            Paragraph(k, style('pk'+k[:4], fontSize=8, textColor=MUTED, fontName='Helvetica-Bold')),
            Paragraph(str(v), style('pv'+k[:4], fontSize=9, textColor=TXT, fontName='Helvetica', leading=13)),
        ]], colWidths=[35*mm, 130*mm])
        row.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('TOPPADDING', (0,0), (-1,-1), 4), ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LINEBELOW', (0,0), (-1,-1), 0.3, BORDER),
        ]))
        story.append(row)
    story.append(Spacer(1, 6*mm))

# RAPPORT IA
reports = player.get('reports', [])
ai_report = None
for r in reports:
    if r.get('ai_report'):
        ai_report = r['ai_report']; break

if ai_report:
    story += section_header('Rapport Scout IA', PURPLE)
    for line in ai_report.split('\n'):
        line = line.strip()
        if not line: continue
        clean = line.replace('##','').replace('**','').replace('*','').replace('#','').strip()
        if not clean: continue
        is_title = clean.isupper() or (len(clean) < 70 and clean.endswith(':') and '.' not in clean)
        if is_title:
            story.append(Paragraph(clean, style('rh'+clean[:5], fontSize=9, textColor=PURPLE,
                fontName='Helvetica-Bold', leading=14, spaceAfter=2, spaceBefore=4)))
        else:
            story.append(Paragraph(clean, style('rb'+clean[:5], fontSize=9, textColor=TXT,
                fontName='Helvetica', leading=13, spaceAfter=2)))
    story.append(Spacer(1, 6*mm))

# FOOTER
story.append(Spacer(1, 4*mm))
story.append(HRFlowable(width='100%', thickness=0.5, color=BORDER))
story.append(Spacer(1, 2*mm))
story.append(Paragraph(
    'ProspectIQ Scout Report  ·  ' + name + '  ·  Rapport genere automatiquement par IA',
    style('ft', fontSize=7, textColor=MUTED, fontName='Helvetica', alignment=TA_CENTER)
))

doc.build(story)
print('OK')
`
    const scriptPath = join(tmpDir, 'gen.py')
    writeFileSync(scriptPath, script)

    // Exécuter Python
    execSync(`python3 ${scriptPath} ${dataPath} ${pdfPath}`, { timeout: 30000 })

    // Lire et envoyer le PDF
    const pdfBuffer = readFileSync(pdfPath)
    const filename = `rapport_${player.first_name}_${player.last_name}.pdf`.replace(/\s+/g, '_')

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', pdfBuffer.length)
    res.send(pdfBuffer)

    // Nettoyer
    try { execSync(`rm -rf ${tmpDir}`) } catch {}

  } catch (e) {
    console.error('[PDF]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ============================================================
//  FIT ANALYSIS — Style de jeu et compatibilité système
// ============================================================
app.post('/players/:id/fit-analysis', requireAuth, async (req, res) => {
  const { data: player } = await db.from('players').select('*').eq('id', req.params.id).single()
  if (!player) return res.status(404).json({ ok: false, error: 'Joueur introuvable' })

  const name = player.first_name + ' ' + player.last_name
  const pts = player.pts || 0
  const ast = player.ast || 0
  const reb = player.reb || 0
  const stl = player.stl || 0
  const blk = player.blk || 0
  const usg = player.usg_pct || 0
  const ts  = player.ts_pct || 0
  const fg3 = player.fg3_pct || 0
  const fg3a = player.fg3a || 0
  const tov = player.tov || 0
  const min = player.min || 0

  const statsStr = [
    pts && `PTS:${pts}`, ast && `AST:${ast}`, reb && `REB:${reb}`,
    stl && `STL:${stl}`, blk && `BLK:${blk}`, usg && `USG%:${usg}`,
    ts && `TS%:${ts}`, fg3 && `3P%:${fg3}`, fg3a && `3PA:${fg3a}`,
    tov && `TOV:${tov}`, min && `MIN:${min}`,
    player.bpm && `BPM:${player.bpm}`,
  ].filter(Boolean).join(' | ')

  const prompt = `Tu es analyste basketball NBA. Analyse le profil de jeu de ${name} (${player.position}, ${player.team}, ${player.league}) basé sur ses stats : ${statsStr}.

Génère une analyse JSON structurée. Réponds UNIQUEMENT avec ce JSON valide :

{
  "tempo_scores": {
    "fast": <0-100>,
    "mixed": <0-100>,
    "slow": <0-100>
  },
  "tempo_note": "<1 phrase expliquant le tempo idéal avec stats>",
  "ideal_roles": [
    {"id": "<role_id>", "primary": true/false},
    {"id": "<role_id>", "primary": false}
  ],
  "role_note": "<1 phrase sur le rôle avec stats>",
  "systems": [
    {"id": "pace_space", "score": <0-100>},
    {"id": "half_court", "score": <0-100>},
    {"id": "defense", "score": <0-100>},
    {"id": "motion", "score": <0-100>},
    {"id": "transition", "score": <0-100>}
  ],
  "systems_note": "<1 phrase sur le meilleur système>",
  "nba_comparable": {
    "name": "<Prénom Nom joueur NBA>",
    "reason": "<1 phrase avec 2-3 stats similaires>"
  },
  "strengths": ["<force 1>", "<force 2>", "<force 3>"],
  "weaknesses": ["<limite 1>", "<limite 2>"],
  "verdict": "<1 phrase verdict scout percutante>"
}

Roles disponibles: primary_scorer, secondary_scorer, playmaker, three_d, rim_protector, rebounder, connector.
Base-toi strictement sur les stats. Sois précis et data-driven.`

  try {
    const result = await callClaude([{ role: 'user', content: prompt }], { maxTokens: 1000, model: 'claude-sonnet-4-20250514' })
    const json = JSON.parse(result.replace(/```json|```/g, '').trim())
    res.json({ ok: true, analysis: json })
  } catch (e) {
    console.error('[FitAnalysis]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})


// ============================================================
//  SEED — 10 joueurs de démo
// ============================================================
app.post('/admin/seed-players', requireAuth, async (req, res) => {
  const players = [
    {
      first_name: 'Killian', last_name: 'Hayes', position: 'PG', nationality: 'Français',
      age: 23, height_cm: 196, weight_kg: 88, team: 'FC Bayern Munich', league: 'BBL (GER)',
      season: '2024-25', scout_grade: 8, status: '🔵 SUIVI ACTIF',
      pts: 14.2, reb: 3.8, ast: 6.1, stl: 1.2, blk: 0.3, tov: 2.4,
      fgm: 4.8, fga: 11.2, fg_pct: 42.8, fg3m: 1.4, fg3a: 4.1, fg3_pct: 34.1,
      ftm: 3.2, fta: 3.8, ft_pct: 84.2, min: 28.4, gp: 28,
      usg_pct: 22.1, ts_pct: 54.3, bpm: 2.8, per: 16.2,
      ceiling: 'NBA starter / EuroLeague All-Star',
      comparable: 'Tyus Jones', strengths: 'Vision de jeu, création, clutch',
      weaknesses: 'Consistance au tir, défense', observation: 'Meneur de grande classe, lecture du jeu exceptionnelle'
    },
    {
      first_name: 'Théo', last_name: 'Maledon', position: 'PG/SG', nationality: 'Français',
      age: 23, height_cm: 193, weight_kg: 84, team: 'Cholet Basket', league: 'Betclic Elite',
      season: '2024-25', scout_grade: 7, status: '🟡 À SURVEILLER',
      pts: 16.8, reb: 3.2, ast: 4.9, stl: 1.4, blk: 0.2, tov: 2.1,
      fgm: 5.6, fga: 13.1, fg_pct: 42.7, fg3m: 2.1, fg3a: 5.8, fg3_pct: 36.2,
      ftm: 3.5, fta: 4.1, ft_pct: 85.4, min: 30.2, gp: 24,
      usg_pct: 24.8, ts_pct: 55.1, bpm: 1.9, per: 17.4,
      ceiling: 'EuroCup / G-League',
      comparable: 'Frank Ntilikina', strengths: 'Vitesse, tir en mouvement, défense',
      weaknesses: 'Physique, taille au poste', observation: 'Retour en France convaincant après passage NBA'
    },
    {
      first_name: 'Hugo', last_name: 'Besson', position: 'SG/SF', nationality: 'Français',
      age: 23, height_cm: 196, weight_kg: 90, team: 'Rostock Seawolves', league: 'BBL (GER)',
      season: '2024-25', scout_grade: 7, status: '🟡 À SURVEILLER',
      pts: 13.4, reb: 4.1, ast: 2.8, stl: 1.1, blk: 0.4, tov: 1.6,
      fgm: 4.5, fga: 10.2, fg_pct: 44.1, fg3m: 1.8, fg3a: 4.9, fg3_pct: 36.7,
      ftm: 2.6, fta: 3.2, ft_pct: 81.3, min: 26.8, gp: 26,
      usg_pct: 19.8, ts_pct: 55.8, bpm: 1.4, per: 14.9,
      ceiling: 'EuroCup starter',
      comparable: 'Kevin Lisch', strengths: 'Tir 3 points, moteur défensif',
      weaknesses: 'Création en isolement, usage limité', observation: 'Excellent dans les systèmes de spacing'
    },
    {
      first_name: 'Olivier', last_name: 'Sarr', position: 'C/PF', nationality: 'Français',
      age: 25, height_cm: 213, weight_kg: 110, team: 'Virtus Bologna', league: 'Lega A (ITA)',
      season: '2024-25', scout_grade: 7, status: '🟡 À SURVEILLER',
      pts: 11.2, reb: 7.8, ast: 1.4, stl: 0.8, blk: 1.9, tov: 1.8,
      fgm: 4.2, fga: 8.1, fg_pct: 51.9, fg3m: 0.3, fg3a: 1.1, fg3_pct: 27.3,
      ftm: 2.5, fta: 3.8, ft_pct: 65.8, min: 22.4, gp: 22,
      usg_pct: 17.2, ts_pct: 56.4, bpm: 1.2, per: 16.8,
      ceiling: 'EuroLeague rotation / NBA two-way',
      comparable: 'Isaiah Hartenstein', strengths: 'Protection de cercle, rebond, passe',
      weaknesses: 'Lancers francs, jeu extérieur', observation: 'Défenseur élite, doit améliorer ses lancers'
    },
    {
      first_name: 'Pacôme', last_name: 'Dadiet', position: 'SF/PF', nationality: 'Français',
      age: 20, height_cm: 203, weight_kg: 95, team: 'New York Knicks', league: 'NBA',
      season: '2024-25', scout_grade: 8, status: '🔵 SUIVI ACTIF',
      pts: 7.4, reb: 3.2, ast: 1.1, stl: 0.7, blk: 0.6, tov: 0.9,
      fgm: 2.6, fga: 6.8, fg_pct: 38.2, fg3m: 1.1, fg3a: 3.4, fg3_pct: 32.4,
      ftm: 1.1, fta: 1.4, ft_pct: 78.6, min: 16.8, gp: 31,
      usg_pct: 14.2, ts_pct: 51.8, bpm: -0.8, per: 10.4,
      ceiling: 'NBA starter / 3&D wing',
      comparable: 'OG Anunoby jeune', strengths: 'Athlétisme, défense, tir catch&shoot',
      weaknesses: 'Création balle en main, consistance', observation: 'Rookie prometteur, courbe de progression excellente'
    },
    {
      first_name: 'Bilal', last_name: 'Coulibaly', position: 'SF', nationality: 'Français',
      age: 20, height_cm: 200, weight_kg: 91, team: 'Washington Wizards', league: 'NBA',
      season: '2024-25', scout_grade: 8, status: '🔵 SUIVI ACTIF',
      pts: 11.8, reb: 3.9, ast: 2.2, stl: 1.4, blk: 0.8, tov: 1.4,
      fgm: 4.2, fga: 10.1, fg_pct: 41.6, fg3m: 1.4, fg3a: 4.2, fg3_pct: 33.3,
      ftm: 2.0, fta: 2.6, ft_pct: 76.9, min: 27.4, gp: 44,
      usg_pct: 18.8, ts_pct: 52.4, bpm: 0.4, per: 12.8,
      ceiling: 'NBA All-Star / 2-way star',
      comparable: 'Mikal Bridges jeune', strengths: 'Défense élite, transition, athlétisme',
      weaknesses: 'Tir à 3 points, création offensive', observation: 'Progression défensive remarquable en 2e saison'
    },
    {
      first_name: 'Alpha', last_name: 'Diallo', position: 'SG/SF', nationality: 'Guinéen/Français',
      age: 26, height_cm: 196, weight_kg: 98, team: 'AS Monaco', league: 'EuroLeague',
      season: '2024-25', scout_grade: 8, status: '🔵 SUIVI ACTIF',
      pts: 15.6, reb: 5.2, ast: 2.4, stl: 1.8, blk: 0.6, tov: 1.9,
      fgm: 5.4, fga: 11.8, fg_pct: 45.8, fg3m: 1.6, fg3a: 4.2, fg3_pct: 38.1,
      ftm: 3.2, fta: 4.1, ft_pct: 78.0, min: 28.6, gp: 26,
      usg_pct: 21.4, ts_pct: 57.2, bpm: 3.1, per: 18.4,
      ceiling: 'EuroLeague All-Star / NBA rotation',
      comparable: 'Joe Ingles', strengths: 'Tir 3P, intensité défensive, clutch',
      weaknesses: 'Création en dribble, taille au poste', observation: "Un des meilleurs 3&D d'EuroLeague cette saison"
    },
    {
      first_name: 'Victor', last_name: 'Wembanyama', position: 'C/PF', nationality: 'Français',
      age: 21, height_cm: 224, weight_kg: 109, team: 'San Antonio Spurs', league: 'NBA',
      season: '2024-25', scout_grade: 10, status: '🔵 SUIVI ACTIF',
      pts: 24.8, reb: 10.6, ast: 3.8, stl: 1.4, blk: 3.6, tov: 3.2,
      fgm: 9.2, fga: 19.4, fg_pct: 47.4, fg3m: 2.8, fg3a: 7.6, fg3_pct: 36.8,
      ftm: 3.6, fta: 4.8, ft_pct: 75.0, min: 32.2, gp: 56,
      usg_pct: 30.8, ts_pct: 59.4, bpm: 9.8, per: 31.2,
      ceiling: 'Meilleur joueur NBA all-time',
      comparable: 'Hakeem Olajuwon + Dirk Nowitzki', strengths: 'Tout — unicité totale',
      weaknesses: 'Gestion du temps de jeu (santé)', observation: 'Alien. Joueur générationnel. Aucun comparable réel.'
    },
    {
      first_name: 'Zaccharie', last_name: 'Risacher', position: 'SF/SG', nationality: 'Français',
      age: 19, height_cm: 203, weight_kg: 91, team: 'Atlanta Hawks', league: 'NBA',
      season: '2024-25', scout_grade: 8, status: '🟡 À SURVEILLER',
      pts: 9.2, reb: 2.8, ast: 1.4, stl: 0.6, blk: 0.4, tov: 1.1,
      fgm: 3.4, fga: 8.2, fg_pct: 41.5, fg3m: 1.6, fg3a: 4.4, fg3_pct: 36.4,
      ftm: 0.8, fta: 1.1, ft_pct: 72.7, min: 24.2, gp: 48,
      usg_pct: 16.4, ts_pct: 54.2, bpm: -0.4, per: 11.2,
      ceiling: 'NBA starter / 3&D wing élite',
      comparable: 'Nicolas Batum jeune', strengths: 'Taille, QI basket, tir catch&shoot',
      weaknesses: 'Création balle en main, physique', observation: 'Pick #1 2024 — progression attendue en année 2'
    },
    {
      first_name: 'Matthew', last_name: 'Strazel', position: 'PG', nationality: 'Français',
      age: 22, height_cm: 188, weight_kg: 80, team: 'Monaco', league: 'Betclic Elite',
      season: '2024-25', scout_grade: 7, status: '🟡 À SURVEILLER',
      pts: 12.4, reb: 2.6, ast: 5.8, stl: 1.2, blk: 0.1, tov: 2.2,
      fgm: 4.1, fga: 9.8, fg_pct: 41.8, fg3m: 1.8, fg3a: 5.1, fg3_pct: 35.3,
      ftm: 2.4, fta: 2.9, ft_pct: 82.8, min: 27.6, gp: 22,
      usg_pct: 20.4, ts_pct: 53.8, bpm: 1.6, per: 14.8,
      ceiling: 'EuroCup / EuroLeague rotation',
      comparable: 'Evan Fournier jeune', strengths: 'Playmaking, tir mi-distance, leadership',
      weaknesses: 'Taille, défense sur les gros PG', observation: 'Meneur élite du championnat de France'
    },
  ]

  try {
    const results = []
    for (const player of players) {
      // Calculer stats avancées
      const advanced = {}
      if (player.pts && player.fga && player.fta)
        advanced.ts_pct = parseFloat((player.pts / (2 * (player.fga + 0.44 * player.fta)) * 100).toFixed(1))
      if (player.fgm && player.fg3m && player.fga)
        advanced.efg_pct = parseFloat(((player.fgm + 0.5 * player.fg3m) / player.fga * 100).toFixed(1))

      const payload = { ...player, ...advanced }
      const { data, error } = await db.from('players').insert(payload).select().single()
      if (error) results.push({ name: player.first_name + ' ' + player.last_name, error: error.message })
      else results.push({ name: player.first_name + ' ' + player.last_name, ok: true, id: data.id })
    }
    const success = results.filter(r => r.ok).length
    res.json({ ok: true, inserted: success, total: players.length, results })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ============================================================
//  GPT ANALYSIS — OpenAI avec prompts spécialisés
// ============================================================

const OPENAI_KEY = process.env.OPENAI_API_KEY

async function callGPT(systemPrompt, userPrompt, maxTokens = 1500) {
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY manquante dans Railway')
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + OPENAI_KEY,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ]
    })
  })
  const data = await resp.json()
  if (data.error) throw new Error('OpenAI: ' + data.error.message)
  return data.choices?.[0]?.message?.content || ''
}

const GPT_PROMPTS = {

  // ── 1. BARTTORVIK ─────────────────────────────────────────
  barttorvik: `Tu es un assistant expert en lecture et interprétation des données Bartorvik pour le scouting basket NCAA.
Tu raisonnes comme un analyste-recruteur orienté terrain, projection et décision. Tu n'es ni un fan, ni un simple lecteur de tableau.

MISSION : transformer les stats Bartorvik en lecture scout utile pour Betclic Elite, ProB, Elite 2 et Europe secondaire.
QUESTION DE FOND : "Est-ce que ce profil m'aide à gagner à un niveau pro donné, dans un rôle précis, à un coût cohérent ?"

PIÈGES À CONNAÎTRE :
- Très bonne efficacité + faible usage = finisseur bien servi, pas créateur transposable
- Bon % à 3pts = peut être petit volume, corners ouverts, peu de tirs en mouvement
- BPM séduisant = signal de filtration, pas preuve d'adaptation au basket pro européen
- Une bonne ligne NCAA ne garantit JAMAIS une traduction FIBA

CE QUI MONTE EN EUROPE : discipline, rapidité de décision, tir respecté, lecture PnR propre, mobilité utile
CE QUI BAISSE : scoreurs dépendants du volume, profils athlétiques tactiquement flottants, faux 3&D

NIVEAUX : Betclic Elite (impact transférable rapide) / ProB haut (adaptation tactique crédible) / ProB-Elite 2 (pari de rôle) / Europe secondaire

FORMAT OBLIGATOIRE :
## LECTURE RAPIDE
## CE QUE LES CHIFFRES DISENT VRAIMENT
## CE QUI EST ENCOURAGEANT
## CE QUI M'ALERTE
## CE QUE JE VEUX VOIR À LA VIDÉO
## TRADUCTION EUROPE
## VERDICT
- Verdict scout :
- Niveau conseillé :
- Pari sur 10 :
- Recommandation : OUI / OUI MAIS / NON

Style : français, direct, scout, sans blabla, orienté décision.`,

  // ── 2. SCOUT NCAA ─────────────────────────────────────────
  ncaa: `Tu es un assistant expert en scout basket NCAA, spécialisé dans l'évaluation de joueurs pour le basket professionnel français et européen (Betclic Elite, ProB, Elite 2).

MISSION : analyser un joueur NCAA comme un recruteur pro, transformer des stats brutes en lecture terrain, projeter son niveau réel en Europe, identifier son rôle optimal, évaluer son accessibilité marché.

PRINCIPES :
- Toujours distinguer : faits observables / interprétations / projections / zones d'incertitude
- Ne jamais sur-vendre un joueur
- Accorder une grande importance au FIT — un bon joueur NCAA n'est pas automatiquement bon en Europe
- Toujours remettre en contexte pace, usage, niveau de conférence et rôle NCAA
- Distinguer créateur principal vs scoreur qui dribble
- Distinguer bon shooteur vs shooteur crédible
- Signaler les défenses "statistiquement correctes mais visuellement douteuses"
- Préciser le risque G-League / Summer League / NBA si pertinent

FORMAT :
1. Identité du joueur (nom, poste, taille, âge, université, conférence)
2. Profil en une phrase
3. Forces (4-8 points concrets)
4. Limites / drapeaux orange
5. Traduction Europe (ce qui monte, ce qui baisse)
6. Rôle idéal
7. Niveau cible (Betclic Elite / ProB / Elite 2 / Europe secondaire)
8. Accessibilité marché
9. Comparaison de contexte si utile
10. Verdict scout + note /10 + rapport qualité/prix (faible/correct/bon/très bon) + OUI / OUI MAIS / NON

Style : français, direct, scout, orienté décision.`,

  // ── 3. INSTAT ─────────────────────────────────────────────
  instat: `Tu es un assistant expert en scouting basket, spécialisé dans l'analyse de données, captures, exports et clips issus d'InStat.

MISSION : transformer une page InStat, un copier-coller de statistiques, un shot chart, des splits, des playtypes ou des notes vidéo en vraie lecture scout utile pour la décision.
Tu raisonnes comme un analyste-recruteur orienté terrain. Tu ne fais pas du commentaire de stats. Tu produis une lecture basket concrète, hiérarchisée, exploitable par un coach, un GM ou un scout.

RÈGLE MAJEURE : Tu n'inventes jamais ce que tu ne vois pas. Tu travailles uniquement à partir des éléments fournis.

PRIORITÉS D'ANALYSE JOUEUR :
- rôle offensif réel
- niveau de création : primaire, secondaire, finisseur
- qualité du tir : volume, adresse, sélection, types de tirs
- efficacité sur pick-and-roll
- lecture des aides
- jeu sans ballon
- finition au cercle
- capacité à provoquer des fautes
- niveau de pertes de balle
- rapport usage / rendement
- défense sur l'homme
- navigation d'écran
- switchabilité
- impact physique
- constance
- discipline

CE QU'IL FAUT ÉVITER :
- surévaluer un joueur uniquement parce qu'il score
- confondre volume et vraie création
- conclure trop vite sur un petit échantillon
- ignorer le contexte de ligue, rythme, rôle et usage

FORMAT :
1. SYNTHÈSE EXPRESS (4-6 lignes)
2. CE QUE DISENT LES DONNÉES (points forts, signaux faibles, stats qui comptent, incohérences, contexte)
3. LECTURE SCOUT (rôle réel, création, tir, finition, lecture, jeu sans ballon, défense, physique, constance)
4. TRANSPOSABILITÉ (ce qui monte, ce qui risque d'être exposé, environnement idéal, niveau de projection)
5. VERDICT (vraie cible / à suivre sérieusement / fit situationnel / production trompeuse / non prioritaire)
6. CHECKLIST VIDÉO (5-10 choses précises à vérifier sur séquences)

Style : précis, direct, scout, concret, sobre, phrases courtes.`,

  // ── 4. ANALYSE EUROPE ─────────────────────────────────────
  europe: `Tu es un assistant expert du recrutement basket en Europe.

MISSION : analyser un joueur à partir de statistiques, vidéo, notes de scouting ou description, puis produire une lecture utile pour une décision de recrutement.
Tu raisonnes comme un recruteur orienté : projection FIBA, traduction du niveau vers l'Europe, réalité du rôle, compatibilité tactique, rapport risque/potentiel/coût, accessibilité selon le marché.

TU ANALYSES EN PRIORITÉ :
- création balle en main / jeu sans ballon
- tir : volume, mécanique, difficulté, vitesse d'exécution
- finition / lecture pick-and-roll / qualité de passe
- défense on-ball et d'équipe
- mobilité latérale / discipline / polyvalence
- physique transposable / moteur / constance / maturité

MARCHÉS À UTILISER :
France (Betclic Elite, ProB, Elite 2) / Allemagne BBL-ProA / Belgique-Pays-Bas / Finlande / Roumanie / Hongrie / République tchèque / Slovaquie / Pologne / Bulgarie / Kosovo / Chypre / Estonie-Lettonie-Lituanie / Balkans secondaires / Espagne Primera FEB / Italie A2-B / Turquie secondaire / Serbie secondaire

RÈGLES : distingue ce qui est observé, probable et incertain. Ne sur-vends jamais. N'utilise pas des stats brutes sans contexte.

FORMAT :
1. Profil express (poste réel, taille fonctionnelle, rôle offensif, rôle défensif, archétype)
2. Ce qui traduit bien en Europe
3. Ce qui pose question
4. Projection FIBA (niveau cible, rôle projeté, environnement idéal, championnats cohérents)
5. Lecture recrutement (valeur du profil, niveau de risque, fenêtre de recrutement, pari court terme ou développement)
6. Verdict (verdict principal, pourquoi, priorité de suivi : forte / moyenne / faible)

Style : clair, précis, concret, orienté décision, vocabulaire de scouting, pas de blabla.`,

  // ── 5. SQBB RECRUITER ─────────────────────────────────────
  sqbb: `Tu es un assistant expert du recrutement basket pour le Saint-Quentin Basket-Ball (SQBB).
Tu raisonnes comme un recruteur orienté : fit coach, réalité terrain, projection FIBA/Europe, complémentarité d'effectif, budget, valeur marché, marge de progression.

CONTEXTE SQBB :
- Coach qui aime jouer vite, multiplier les possessions
- Importance du rebond offensif
- Défense avec présence dans les gaps
- Priorité aux profils physiques avec marge de progression
- Budget limité à l'échelle Betclic Elite
- Aucune contrainte JFL/NJFL bloquante

ADN DES JOUEURS RECHERCHÉS : capables de courir / physiques / mobiles / moteur / répétition des efforts / actifs au rebond offensif / utiles sans monopoliser le ballon / capables de défendre dans un cadre collectif exigeant / coachables / qui veulent passer un cap / profils sous-cotés et valorisables

MÉFIE-TOI : meneurs gestionnaires sans menace / scoreurs qui ne créent pas / profils trop faibles physiquement / faux stretchs / pivots lourds ou à mauvaises mains

MARCHÉS À EXPLORER EN PRIORITÉ : NCAA / Allemagne D2-ProA / Finlande / Roumanie / Hongrie / Kosovo / Chypre / Rép. tchèque / Slovaquie / BNXT / Balkans secondaires / Baltique secondaire / France ProB-N1 / Espagne-Italie-Turquie-Serbie secondaires

FORMAT ANALYSE JOUEUR :
1. Profil express (poste réel, taille fonctionnelle, rôle offensif, rôle défensif, archétype)
2. Ce qui colle au SQBB
3. Ce qui pose question
4. Projection SQBB (fit jeu rapide, fit rebond offensif, fit défense en gaps, fit physique, marge de progression, rôle projeté)
5. Lecture marché (niveau/marchés cohérents, accessibilité estimée, rapport valeur/risque, type de pari)
6. Verdict : OUI / OUI MAIS / NON + conditions de réussite

Style : français, tranchant, scout, concret, sans langue de bois.`,

  // ── 6. SHORTLIST RECRUTEMENT ──────────────────────────────
  shortlist: `Tu es directeur du recrutement d'un club français de basket.

MISSION : construire des shortlists réalistes, intelligentes et hiérarchisées selon un besoin précis.
Tu travailles comme un recruteur terrain + GM. Tu cherches des joueurs accessibles. Tu hiérarchises la faisabilité. Tu distingues joueur séduisant et joueur vraiment signable.

RÈGLES IMPÉRATIVES :
- Ne jamais proposer des noms fantaisistes
- Ne jamais faire passer un joueur inaccessible pour une cible réaliste
- Toujours distinguer : meilleur fit / plus réaliste / sleeper / pari
- Toujours expliquer pourquoi un joueur colle ET pourquoi il peut échouer
- Toujours intégrer le contexte donné : budget, division, urgence, JFL ou non-JFL, expérience Europe
- Privilégier les profils utiles à gagner, pas seulement les CV brillants
- Toujours séparer attractivité théorique et signabilité réelle
- Ne jamais surévaluer un nom pour son CV seul
- Répondre en français, de manière directe, structurée, sans jargon inutile

FORMAT SHORTLIST :
1. Résumé du besoin
2. Critères prioritaires
3. Shortlist principale
   Pour chaque joueur : Nom / Poste-taille-âge / Club ou dernier contexte / Pourquoi il colle / Pourquoi il est réaliste ou non / Forces clés / Points de vigilance / Projection de niveau / Faisabilité (haute/moyenne/faible)
4. Classement final (les plus réalistes / meilleurs fits basket / sleepers / paris)
5. Recommandation finale (qui appeler d'abord / qui surveiller / qui écarter)

Style : GM pragmatique, recrutement pur, franc, utile.`,

  // ── 7. PLAYER FINDER EUROPE ───────────────────────────────
  player_finder: `Tu es un assistant expert en identification de profils basket pour le recrutement.

MISSION : trouver des joueurs correspondant à un besoin précis, filtrer les profils selon poste, rôle réel, style de jeu, niveau visé, budget, passeport/statut, âge, potentiel de progression, compatibilité tactique et accessibilité du marché.
Tu raisonnes comme un recruteur qui doit sortir une shortlist utile, réaliste et actionnable.

TU ES FORT SUR : poste 1 créateur up-tempo / combo scoreur / ailier 3&D / 4 shooteur / 5 mobile protecteur / profil défensif / scoreur second unit / meneur gestion PnR / profil Europe secondaire à forte valeur / rookie NCAA transposable / joueur undervalued marché secondaire

MARCHÉS À EXPLORER : NCAA / Europe secondaire / Allemagne ProA-D2 / Finlande / Roumanie / Hongrie / Kosovo / Chypre / Bulgarie / Rép. tchèque / Slovaquie / Balkans secondaires / BNXT / ProB-N1 / Espagne secondaire / Italie A2-B / Turquie-Serbie-Baltique secondaires

RÈGLES ABSOLUES :
- Ne propose pas un nom juste parce qu'il est fort — explique pourquoi il colle au besoin
- Précise le niveau de risque
- Dis quand un joueur paraît probablement hors de portée
- Distingue : profil parfait / profil réaliste / profil pari / profil opportunité
- Ne promets jamais qu'un joueur est signable sans élément solide
- Parle en termes : accessible / probablement tendu / ambitieux / hors marché

FORMAT :
1. Lecture du besoin (poste réel, rôle offensif, rôle défensif, niveau visé, contraintes clés)
2. Ce qu'il faut chercher (qualités indispensables, qualités secondaires, risques à éviter)
3. Shortlist (pour chaque joueur : nom, profil, pourquoi il colle, ce qui plaît, ce qui pose question, niveau/marché cohérent, accessibilité estimée, verdict)
4. Classement final (Tier 1 : fit fort / Tier 2 : réalistes / Tier 3 : paris-opportunités)
5. Recommandation (qui suivre en priorité, quel type de vidéo regarder, quelles infos manquent)

Style : efficace, précis, staff-oriented, concret, sans remplissage, avec un vrai tri.`,

  // ── 8. VEILLE TOP 10 ──────────────────────────────────────
  veille: `Tu es un directeur du recrutement et scout senior spécialisé dans le basket professionnel européen.

MISSION : produire une veille hebdomadaire Top 10 orientée recrutement, à partir du web, sur les meilleures performances individuelles dans les championnats ciblés.
Ton rôle n'est pas de faire une revue de boxscores. Ton rôle est de transformer des performances récentes en lecture scout exploitable pour la décision.

5 QUESTIONS OBLIGATOIRES :
1. Qui a vraiment performé ?
2. Quelle part de la performance est durable et transposable ?
3. Le joueur est-il réellement recrutables ?
4. Pour quel niveau ce joueur projette-t-il vraiment ?
5. Faut-il appeler, surveiller, ou écarter ?

CADRE DE PROJECTION : Betclic Elite / Elite 2 / NM1 / autres championnats européens pertinents

RÈGLES ABSOLUES :
- Utilise le web systématiquement pour toute veille hebdomadaire
- Ne jamais inventer un joueur, une performance, un club ou un statut contractuel
- Ne jamais confondre grosse ligne de stats et vraie cible recrutement
- Toujours séparer : qualité basket, signabilité réelle, timing marché, projection de niveau
- Toujours tenir compte du championnat, du contexte de match, du rôle, de l'âge, du physique, du passeport
- Préciser si le joueur est : cible immédiate / veille active / surveillance simple / à écarter

MÉTHODE :
1. Cherche les meilleures performances récentes — ne classe pas seulement par points
2. Intègre : efficacité, création, défense, rebond, playmaking, protection de cercle, volume, usage, impact réel
3. Pour chaque joueur : niveau de l'opposition, outils physiques, capacité à créer un avantage, lecture du jeu, valeur sans ballon, répétabilité de la performance, risque de mirage statistique
4. Estime : faisabilité recrutement, fenêtre de marché, risque économique, niveau cible le plus logique

FORMAT :
1. Hypothèse de travail (championnats couverts, période, profils ciblés)
2. Top 10 de la semaine
   Pour chaque joueur : rang / nom / poste-taille-âge / club-championnat / performance récente / pourquoi la perf ressort / lecture scout / ce qui peut traduire ou non / forces clés / points de vigilance / projection championnat / niveau France (Betclic/Elite 2/NM1/pas prioritaire) / recrutabilité (haute/moyenne/faible) / fenêtre d'action (maintenant/été/surveillance) / verdict (appeler/suivre/écarter)
3. Classement croisé final (adaptés Betclic / Elite 2 / NM1 / hors France / plus réalistes / sleepers / paris / mirages)
4. Recommandation finale (qui appeler d'abord / qui surveiller / qui est fort mais hors marché / qui écarter)

Style : franc, pragmatique, scout professionnel, utile à la décision, aucune langue de bois.
Interdictions : pas de noms inventés / pas de blabla / pas de fascination pour les points sans contexte / pas de conclusion molle.`,

}


app.post('/players/:id/gpt-analysis', requireAuth, async (req, res) => {
  const { data: player } = await db.from('players').select('*').eq('id', req.params.id).single()
  if (!player) return res.status(404).json({ ok: false, error: 'Joueur introuvable' })

  const { mode } = req.body // 'ncaa' | 'europe' | 'sqbb' | 'auto'
  const name = player.first_name + ' ' + player.last_name

  // Detection automatique parmi les 8 agents
  let selectedMode = mode || 'auto'
  if (selectedMode === 'auto') {
    const league = (player.league || '').toLowerCase()
    const tags   = (player.tags || '').toLowerCase()
    if (league.includes('ncaa') || league.includes('college') || league.includes('juco')) {
      selectedMode = 'barttorvik'
    } else if (tags.includes('sqbb') || tags.includes('saint-quentin')) {
      selectedMode = 'sqbb'
    } else {
      selectedMode = 'europe'
    }
  }

  const systemPrompt = GPT_PROMPTS[selectedMode] || GPT_PROMPTS.europe

  function buildPlayerInput(p) {
    const stats = {
      matchs: p.gp, minutes: p.min,
      pts: p.pts, reb: p.reb, ast: p.ast, stl: p.stl, blk: p.blk, tov: p.tov,
      fg_pct: p.fg_pct, fg3_pct: p.fg3_pct, fg3m: p.fg3m, fg3a: p.fg3a,
      ft_pct: p.ft_pct, ts_pct: p.ts_pct, efg_pct: p.efg_pct,
      usg_pct: p.usg_pct, bpm: p.bpm, obpm: p.obpm, dbpm: p.dbpm,
      vorp: p.vorp, per: p.per, ortg: p.ortg, drtg: p.drtg,
    }
    const statsClean = Object.fromEntries(Object.entries(stats).filter(([,v]) => v != null))

    return [
      'Analyse ce joueur pour du scouting basket.',
      '',
      'IDENTITÉ :',
      'Nom : ' + name,
      'Poste : ' + (p.position || 'NC') + ' | Âge : ' + (p.age || 'NC') + ' ans | Taille : ' + (p.height_cm || 'NC') + 'cm | Poids : ' + (p.weight_kg || 'NC') + 'kg',
      'Nationalité : ' + (p.nationality || 'NC') + ' | Équipe : ' + (p.team || 'NC') + ' | Ligue : ' + (p.league || 'NC'),
      'Saison : ' + (p.season || '2024-25') + ' | Note scout : ' + (p.scout_grade || 5) + '/10',
      '',
      'STATISTIQUES :',
      JSON.stringify(statsClean, null, 2),
      '',
      p.strengths  ? 'Forces connues : ' + p.strengths  : '',
      p.weaknesses ? 'Faiblesses : '     + p.weaknesses : '',
      p.ceiling    ? 'Plafond estimé : ' + p.ceiling    : '',
      p.comparable ? 'Comparable : '     + p.comparable : '',
      p.observation ? 'Observation terrain : ' + p.observation : '',
      '',
      "Fais une vraie lecture scout. Ne survend pas. Signale les zones incertaines.",
    ].filter(l => l !== '').join('\n')
  }

  const userPrompt = buildPlayerInput(player)

  try {
    const analysis = await callGPT(systemPrompt, userPrompt, 1500)
    res.json({ ok: true, analysis, mode: selectedMode, model: 'gpt-4o' })
  } catch (e) {
    console.error('[GPT Analysis]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// Recherche de joueurs par besoin (Player Finder + Shortlist)
app.post('/gpt-search', requireAuth, async (req, res) => {
  const { query, mode: searchMode = 'player_finder' } = req.body
  if (!query) return res.status(400).json({ ok: false, error: 'Query requise' })
  const prompt = GPT_PROMPTS[searchMode] || GPT_PROMPTS.player_finder
  try {
    const analysis = await callGPT(prompt, query, 1500)
    res.json({ ok: true, analysis, mode: searchMode })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// Veille Top 10 Scout
app.post('/gpt-veille', requireAuth, async (req, res) => {
  const { leagues, dateFrom, dateTo, postes, niveau } = req.body
  const userPrompt = 'Fais la veille Top 10 Scout. Championnats : ' + (leagues || 'Pro B, Elite 2, NM1, Allemagne ProA, BNXT, Adriatique, NCAA') + '. Periode : ' + (dateFrom || 'cette semaine') + '. Postes : ' + (postes || 'tous') + '. Niveau cible : ' + (niveau || 'Betclic Elite, Elite 2, NM1') + '. Je veux des joueurs reellement recrutables. Finis par : appeler / surveiller / hors marche / ecarter.'
  try {
    const analysis = await callGPT(GPT_PROMPTS.veille, userPrompt, 2000)
    res.json({ ok: true, analysis })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ============================================================
//  LOGS
// ============================================================
app.get('/admin/sync-logs', requireAuth, async (req, res) => {
  const { data, error } = await db.from('sync_logs')
    .select('*, players(first_name, last_name)')
    .order('started_at', { ascending: false }).limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ============================================================
//  DÉMARRAGE
// ============================================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🏀 ProspectIQ API v1.0 — port ${PORT}`);
  console.log(`   Sync nocturne : 6h00 Europe/Paris`);
});


// ============================================================
//  BARTTORVIK — Stats NCAA avancées
// ============================================================
app.post('/players/:id/sync-barttorvik', requireAuth, async (req, res) => {
  const { id } = req.params
  const { data: player } = await db.from('players').select('first_name, last_name, team, barttorvik_url').eq('id', id).single()
  if (!player) return res.status(404).json({ error: 'Joueur introuvable' })

  // Extraire params depuis l'URL ou utiliser nom/équipe
  let year = new Date().getFullYear()
  let playerName = `${player.first_name} ${player.last_name}`
  let teamName = player.team || ''

  if (player.barttorvik_url) {
    const url = new URL(player.barttorvik_url)
    year      = url.searchParams.get('year') || year
    playerName = url.searchParams.get('p')   || playerName
    teamName   = url.searchParams.get('t')   || teamName
  }

  try {
    const apiUrl = `https://barttorvik.com/getplayer.php?year=${year}&player=${encodeURIComponent(playerName)}&team=${encodeURIComponent(teamName)}`
    const resp = await fetch(apiUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    })

    if (!resp.ok) throw new Error(`Barttorvik HTTP ${resp.status}`)
    const data = await resp.json()

    if (!data || !data.length) {
      // Fallback scraping HTML
      const htmlUrl = `https://barttorvik.com/playerstat.php?year=${year}&p=${encodeURIComponent(playerName)}&t=${encodeURIComponent(teamName)}`
      const htmlResp = await fetch(htmlUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      })
      const html = await htmlResp.text()

      const getVal = (label) => {
        const regex = new RegExp(`${label}[^\\d-]*([\\d.-]+)`, 'i')
        const m = html.match(regex)
        return m ? parseFloat(m[1]) : null
      }

      const updates = {
        pts:     getVal('PTS'),
        reb:     getVal('REB'),
        ast:     getVal('AST'),
        stl:     getVal('STL'),
        blk:     getVal('BLK'),
        fg_pct:  getVal('FG%') || getVal('eFG'),
        fg3_pct: getVal('3P%'),
        ft_pct:  getVal('FT%'),
        usg_pct: getVal('Usg'),
        bpm:     getVal('BPM') || getVal('OBPM'),
        porpag:  getVal('PORPAG'),
        adjoe:   getVal('AdjOE'),
        season:  `${year-1}-${String(year).slice(2)}`,
        last_synced_at: new Date().toISOString(),
      }

      const filtered = Object.fromEntries(Object.entries(updates).filter(([,v]) => v !== null))
      if (Object.keys(filtered).length < 3) throw new Error('Stats insuffisantes trouvées sur Barttorvik')

      await db.from('players').update(filtered).eq('id', id)
      await logSync('barttorvik', id, 'success', 1)
      return res.json({ ok: true, stats: filtered, source: 'html' })
    }

    // Parser la réponse JSON Barttorvik
    const p = Array.isArray(data[0]) ? data[0] : data
    const updates = {
      pts:     parseFloat(p[4])  || null,
      reb:     parseFloat(p[7])  || null,
      ast:     parseFloat(p[8])  || null,
      stl:     parseFloat(p[10]) || null,
      blk:     parseFloat(p[11]) || null,
      fg_pct:  parseFloat(p[14]) || null,
      fg3_pct: parseFloat(p[15]) || null,
      ft_pct:  parseFloat(p[16]) || null,
      usg_pct: parseFloat(p[17]) || null,
      bpm:     parseFloat(p[19]) || null,
      porpag:  parseFloat(p[22]) || null,
      adjoe:   parseFloat(p[20]) || null,
      season:  `${year-1}-${String(year).slice(2)}`,
      last_synced_at: new Date().toISOString(),
    }

    const filtered = Object.fromEntries(Object.entries(updates).filter(([,v]) => v !== null))
    await db.from('players').update(filtered).eq('id', id)
    await logSync('barttorvik', id, 'success', 1)
    res.json({ ok: true, stats: filtered, source: 'api' })

  } catch (e) {
    console.error('[Barttorvik]', e.message)
    await logSync('barttorvik', id, 'error', 0, e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ============================================================
//  KENPOM — Contexte équipe NCAA
// ============================================================
app.post('/players/:id/sync-kenpom', requireAuth, async (req, res) => {
  const { id } = req.params
  const { team, kenpom_user, kenpom_pass } = req.body
  if (!team) return res.status(400).json({ error: 'Nom d\'équipe requis' })

  try {
    // Login KenPom
    const loginResp = await fetch('https://kenpom.com/handlers/login_handler.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://kenpom.com/index.php',
      },
      body: new URLSearchParams({
        email:    kenpom_user || process.env.KENPOM_EMAIL,
        password: kenpom_pass || process.env.KENPOM_PASSWORD,
        submit:   'Login',
      }),
      redirect: 'manual',
    })

    const cookies = loginResp.headers.get('set-cookie') || ''
    if (!cookies.includes('PHPSESSID')) throw new Error('Login KenPom échoué — vérifie tes identifiants')

    // Récupérer la page équipe
    const teamUrl = `https://kenpom.com/team.php?team=${encodeURIComponent(team)}`
    const teamResp = await fetch(teamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': cookies,
      }
    })

    if (!teamResp.ok) throw new Error(`KenPom team HTTP ${teamResp.status}`)
    const html = await teamResp.text()

    const getVal = (label) => {
      const regex = new RegExp(`${label}[^\\d-]*([\\d.]+)`, 'i')
      const m = html.match(regex)
      return m ? parseFloat(m[1]) : null
    }

    const teamStats = {
      kenpom_adjoe:  getVal('AdjO') || getVal('Adj\\. O'),
      kenpom_adjde:  getVal('AdjD') || getVal('Adj\\. D'),
      kenpom_tempo:  getVal('AdjT') || getVal('Adj\\. T'),
      kenpom_luck:   getVal('Luck'),
      kenpom_rank:   getVal('Rk') || getVal('Rank'),
    }

    const filtered = Object.fromEntries(Object.entries(teamStats).filter(([,v]) => v !== null))

    if (Object.keys(filtered).length === 0) throw new Error('Aucune donnée KenPom trouvée')

    // Sauvegarder les stats équipe dans la fiche joueur
    await db.from('players').update(filtered).eq('id', id)
    res.json({ ok: true, teamStats: filtered })

  } catch (e) {
    console.error('[KenPom]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ============================================================
//  RECHERCHE BARTTORVIK par nom (sans URL)
// ============================================================
app.get('/barttorvik/search', requireAuth, async (req, res) => {
  const { name, team, year } = req.query
  if (!name) return res.status(400).json({ error: 'Nom requis' })

  try {
    const y = year || new Date().getFullYear()
    const url = `https://barttorvik.com/getplayer.php?year=${y}&player=${encodeURIComponent(name)}${team ? `&team=${encodeURIComponent(team)}` : ''}`
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    res.json({ ok: true, data })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})


// ============================================================
//  PLAYER SEASONS — Stats multi-ligues
// ============================================================

// GET toutes les saisons d'un joueur
app.get('/players/:id/seasons', requireAuth, async (req, res) => {
  const { data, error } = await db
    .from('player_seasons')
    .select('*')
    .eq('player_id', req.params.id)
    .order('season', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST — ajouter une ligne de stats
app.post('/players/:id/seasons', requireAuth, async (req, res) => {
  const payload = { ...req.body, player_id: req.params.id, updated_at: new Date().toISOString() }
  const { data, error } = await db.from('player_seasons').upsert(payload, {
    onConflict: 'player_id,season,league'
  }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// PATCH — modifier une stat inline
app.patch('/seasons/:seasonId', requireAuth, async (req, res) => {
  const { data, error } = await db
    .from('player_seasons')
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq('id', req.params.seasonId)
    .select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// DELETE — supprimer une ligne de stats
app.delete('/seasons/:seasonId', requireAuth, async (req, res) => {
  const { error } = await db.from('player_seasons').delete().eq('id', req.params.seasonId)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

// ============================================================
//  VALEUR MARCHANDE — Estimée par IA
// ============================================================
app.post('/players/:id/market-value', requireAuth, async (req, res) => {
  const { data: player } = await db.from('players').select('*').eq('id', req.params.id).single()
  if (!player) return res.status(404).json({ error: 'Joueur introuvable' })

  const statsLines = [
    player.pts     != null && `PTS: ${player.pts}`,
    player.ast     != null && `AST: ${player.ast}`,
    player.reb     != null && `REB: ${player.reb}`,
    player.ts_pct  != null && `TS%: ${player.ts_pct}`,
    player.usg_pct != null && `USG%: ${player.usg_pct}`,
    player.bpm     != null && `BPM: ${player.bpm}`,
    player.net_rtg != null && `Net: ${player.net_rtg}`,
  ].filter(Boolean).join(' | ')

  try {
    const result = await callClaude([{
      role: 'user',
      content: `You are a basketball contract expert with deep knowledge of European and NBA market values.

Player: ${player.first_name} ${player.last_name}
Position: ${player.position} | Age: ${player.age} | League: ${player.league} | Team: ${player.team}
Stats: ${statsLines}
Scout grade: ${player.scout_grade}/10
Ceiling: ${player.ceiling || 'Unknown'}

Estimate the realistic annual market value for this player based on:
1. Current performance and efficiency
2. Age and development trajectory  
3. League level (adjust for competition level)
4. Position scarcity and market demand
5. Recent comparable transfers in Europe

Return ONLY a JSON object:
{
  "market_value": "X€ — Y€ / an",
  "reasoning": "2 sentences max explaining the estimate",
  "comparable_contracts": "1-2 similar player contracts as reference"
}`
    }], { webSearch: true, maxTokens: 400 })

    const json = JSON.parse(result.replace(/```json|```/g, '').trim())
    await db.from('players').update({ market_value: json.market_value }).eq('id', req.params.id)
    res.json(json)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})


// ============================================================
//  VEILLE HEBDOMADAIRE — Agent IA avec web search
// ============================================================

const VEILLE_LEAGUES = ['BBL (GER)', 'Pro A (GER)', 'Pro B', 'Liga ACB (ESP)', 'Lega A (ITA)', 'BSL (TUR)', 'NCAA']

app.get('/veille', requireAuth, async (req, res) => {
  const { from, to, leagues: leagueFilter } = req.query

  const today = new Date()
  const dayOfWeek = today.getDay()
  const lastSat = new Date(today)
  lastSat.setDate(today.getDate() - (dayOfWeek === 0 ? 1 : dayOfWeek === 6 ? 0 : dayOfWeek + 1))
  const lastSun = new Date(lastSat)
  lastSun.setDate(lastSat.getDate() + 1)

  const dateFrom = from || lastSat.toISOString().split('T')[0]
  const dateTo   = to   || lastSun.toISOString().split('T')[0]
  const targetLeagues = leagueFilter ? leagueFilter.split(',').map(l => l.trim()) : VEILLE_LEAGUES

  console.log('[Veille] IA — Période:', dateFrom, '→', dateTo, '| Ligues:', targetLeagues.join(', '))

  try {
    const analysis = await callClaude([{
      role: 'user',
      content: 'Tu es scout basketball professionnel. Cherche sur le web les meilleures performances individuelles du ' + dateFrom + ' au ' + dateTo + ' dans ces ligues : ' + targetLeagues.join(', ') + '.\n\n' +
        'INSTRUCTIONS :\n' +
        '- Cherche les box scores et résultats de matchs sur cette période\n' +
        '- Identifie les 8-10 meilleures performances (PTS, REB, AST, évaluation)\n' +
        '- Concentre-toi sur des joueurs sous les radars, pas les stars connues\n' +
        '- Pour chaque joueur : nom, équipe, ligue, stats du match, profil scout, intérêt\n\n' +
        'FORMAT de réponse :\n' +
        'Pour chaque joueur utilise ce format JSON dans un tableau :\n' +
        '[{"player_name":"...","team":"...","league":"...","match":"...","date":"...","pts":0,"reb":0,"ast":0,"eval":0,"scout_note":"..."}]\n\n' +
        'Puis après le JSON, ajoute une analyse scout en français (10-15 lignes) avec les 3 priorités absolues à surveiller et pourquoi.'
    }], { webSearch: true, maxTokens: 2000, model: 'claude-sonnet-4-20250514' })

    // Parser le JSON des perfs
    let perfs = []
    try {
      const jsonMatch = analysis.match(/\[\s*\{[\s\S]*?\}\s*\]/)
      if (jsonMatch) perfs = JSON.parse(jsonMatch[0])
    } catch (e) {
      console.warn('[Veille] JSON parse:', e.message)
    }

    // Texte d'analyse (après le JSON)
    const analysisText = analysis.replace(/\[\s*\{[\s\S]*?\}\s*\]/g, '').trim()

    res.json({ ok: true, perfs, analysis: analysisText, dateFrom, dateTo, total: perfs.length })

  } catch (e) {
    console.error('[Veille]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// Route pour tester l'API-Sports
app.get('/veille/test', requireAuth, async (req, res) => {
  try {
    if (!process.env.API_SPORTS_KEY) return res.json({ ok: false, error: 'API_SPORTS_KEY manquante' })
    const url = new URL('https://v1.basketball.api-sports.io/status')
    const resp = await fetch(url.toString(), {
      headers: { 'x-apisports-key': process.env.API_SPORTS_KEY }
    })
    const data = await resp.json()
    res.json({ ok: true, status: data.response })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// Autocomplete joueurs via API-Sports
app.get('/players/search', requireAuth, async (req, res) => {
  const { q } = req.query
  if (!q || q.length < 3) return res.json([])
  try {
    const url = new URL('https://v1.basketball.api-sports.io/players')
    url.searchParams.set('search', q)
    const resp = await fetch(url.toString(), {
      headers: { 'x-apisports-key': process.env.API_SPORTS_KEY || '' }
    })
    const data = await resp.json()
    const results = (data.response || []).slice(0, 8).map(p => ({
      id: p.id, name: p.name, firstname: p.firstname, lastname: p.lastname,
      position: p.position, country: p.country, age: p.age,
      height: p.height, weight: p.weight,
    }))
    res.json(results)
  } catch (e) {
    res.status(500).json([])
  }
})
// ============================================================
//  BARTTORVIK — Stats NCAA avancées
// ============================================================
app.post('/players/:id/sync-barttorvik', requireAuth, async (req, res) => {
  const { id } = req.params
  const { data: player } = await db.from('players').select('first_name, last_name, team, barttorvik_url').eq('id', id).single()
  if (!player) return res.status(404).json({ error: 'Joueur introuvable' })

  // Extraire params depuis l'URL ou utiliser nom/équipe
  let year = new Date().getFullYear()
  let playerName = `${player.first_name} ${player.last_name}`
  let teamName = player.team || ''

  if (player.barttorvik_url) {
    const url = new URL(player.barttorvik_url)
    year      = url.searchParams.get('year') || year
    playerName = url.searchParams.get('p')   || playerName
    teamName   = url.searchParams.get('t')   || teamName
  }

  try {
    const apiUrl = `https://barttorvik.com/getplayer.php?year=${year}&player=${encodeURIComponent(playerName)}&team=${encodeURIComponent(teamName)}`
    const resp = await fetch(apiUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    })

    if (!resp.ok) throw new Error(`Barttorvik HTTP ${resp.status}`)
    const data = await resp.json()

    if (!data || !data.length) {
      // Fallback scraping HTML
      const htmlUrl = `https://barttorvik.com/playerstat.php?year=${year}&p=${encodeURIComponent(playerName)}&t=${encodeURIComponent(teamName)}`
      const htmlResp = await fetch(htmlUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      })
      const html = await htmlResp.text()

      const getVal = (label) => {
        const regex = new RegExp(`${label}[^\\d-]*([\\d.-]+)`, 'i')
        const m = html.match(regex)
        return m ? parseFloat(m[1]) : null
      }

      const updates = {
        pts:     getVal('PTS'),
        reb:     getVal('REB'),
        ast:     getVal('AST'),
        stl:     getVal('STL'),
        blk:     getVal('BLK'),
        fg_pct:  getVal('FG%') || getVal('eFG'),
        fg3_pct: getVal('3P%'),
        ft_pct:  getVal('FT%'),
        usg_pct: getVal('Usg'),
        bpm:     getVal('BPM') || getVal('OBPM'),
        porpag:  getVal('PORPAG'),
        adjoe:   getVal('AdjOE'),
        season:  `${year-1}-${String(year).slice(2)}`,
        last_synced_at: new Date().toISOString(),
      }

      const filtered = Object.fromEntries(Object.entries(updates).filter(([,v]) => v !== null))
      if (Object.keys(filtered).length < 3) throw new Error('Stats insuffisantes trouvées sur Barttorvik')

      await db.from('players').update(filtered).eq('id', id)
      await logSync('barttorvik', id, 'success', 1)
      return res.json({ ok: true, stats: filtered, source: 'html' })
    }

    // Parser la réponse JSON Barttorvik
    const p = Array.isArray(data[0]) ? data[0] : data
    const updates = {
      pts:     parseFloat(p[4])  || null,
      reb:     parseFloat(p[7])  || null,
      ast:     parseFloat(p[8])  || null,
      stl:     parseFloat(p[10]) || null,
      blk:     parseFloat(p[11]) || null,
      fg_pct:  parseFloat(p[14]) || null,
      fg3_pct: parseFloat(p[15]) || null,
      ft_pct:  parseFloat(p[16]) || null,
      usg_pct: parseFloat(p[17]) || null,
      bpm:     parseFloat(p[19]) || null,
      porpag:  parseFloat(p[22]) || null,
      adjoe:   parseFloat(p[20]) || null,
      season:  `${year-1}-${String(year).slice(2)}`,
      last_synced_at: new Date().toISOString(),
    }

    const filtered = Object.fromEntries(Object.entries(updates).filter(([,v]) => v !== null))
    await db.from('players').update(filtered).eq('id', id)
    await logSync('barttorvik', id, 'success', 1)
    res.json({ ok: true, stats: filtered, source: 'api' })

  } catch (e) {
    console.error('[Barttorvik]', e.message)
    await logSync('barttorvik', id, 'error', 0, e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ============================================================
//  KENPOM — Contexte équipe NCAA
// ============================================================
app.post('/players/:id/sync-kenpom', requireAuth, async (req, res) => {
  const { id } = req.params
  const { team, kenpom_user, kenpom_pass } = req.body
  if (!team) return res.status(400).json({ error: 'Nom d\'équipe requis' })

  try {
    // Login KenPom
    const loginResp = await fetch('https://kenpom.com/handlers/login_handler.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://kenpom.com/index.php',
      },
      body: new URLSearchParams({
        email:    kenpom_user || process.env.KENPOM_EMAIL,
        password: kenpom_pass || process.env.KENPOM_PASSWORD,
        submit:   'Login',
      }),
      redirect: 'manual',
    })

    const cookies = loginResp.headers.get('set-cookie') || ''
    if (!cookies.includes('PHPSESSID')) throw new Error('Login KenPom échoué — vérifie tes identifiants')

    // Récupérer la page équipe
    const teamUrl = `https://kenpom.com/team.php?team=${encodeURIComponent(team)}`
    const teamResp = await fetch(teamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': cookies,
      }
    })

    if (!teamResp.ok) throw new Error(`KenPom team HTTP ${teamResp.status}`)
    const html = await teamResp.text()

    const getVal = (label) => {
      const regex = new RegExp(`${label}[^\\d-]*([\\d.]+)`, 'i')
      const m = html.match(regex)
      return m ? parseFloat(m[1]) : null
    }

    const teamStats = {
      kenpom_adjoe:  getVal('AdjO') || getVal('Adj\\. O'),
      kenpom_adjde:  getVal('AdjD') || getVal('Adj\\. D'),
      kenpom_tempo:  getVal('AdjT') || getVal('Adj\\. T'),
      kenpom_luck:   getVal('Luck'),
      kenpom_rank:   getVal('Rk') || getVal('Rank'),
    }

    const filtered = Object.fromEntries(Object.entries(teamStats).filter(([,v]) => v !== null))

    if (Object.keys(filtered).length === 0) throw new Error('Aucune donnée KenPom trouvée')

    // Sauvegarder les stats équipe dans la fiche joueur
    await db.from('players').update(filtered).eq('id', id)
    res.json({ ok: true, teamStats: filtered })

  } catch (e) {
    console.error('[KenPom]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ============================================================
//  RECHERCHE BARTTORVIK par nom (sans URL)
// ============================================================
app.get('/barttorvik/search', requireAuth, async (req, res) => {
  const { name, team, year } = req.query
  if (!name) return res.status(400).json({ error: 'Nom requis' })

  try {
    const y = year || new Date().getFullYear()
    const url = `https://barttorvik.com/getplayer.php?year=${y}&player=${encodeURIComponent(name)}${team ? `&team=${encodeURIComponent(team)}` : ''}`
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    res.json({ ok: true, data })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})


// ============================================================
//  PLAYER SEASONS — Stats multi-ligues
// ============================================================

// GET toutes les saisons d'un joueur
app.get('/players/:id/seasons', requireAuth, async (req, res) => {
  const { data, error } = await db
    .from('player_seasons')
    .select('*')
    .eq('player_id', req.params.id)
    .order('season', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST — ajouter une ligne de stats
app.post('/players/:id/seasons', requireAuth, async (req, res) => {
  const payload = { ...req.body, player_id: req.params.id, updated_at: new Date().toISOString() }
  const { data, error } = await db.from('player_seasons').upsert(payload, {
    onConflict: 'player_id,season,league'
  }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// PATCH — modifier une stat inline
app.patch('/seasons/:seasonId', requireAuth, async (req, res) => {
  const { data, error } = await db
    .from('player_seasons')
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq('id', req.params.seasonId)
    .select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// DELETE — supprimer une ligne de stats
app.delete('/seasons/:seasonId', requireAuth, async (req, res) => {
  const { error } = await db.from('player_seasons').delete().eq('id', req.params.seasonId)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

// ============================================================
//  VALEUR MARCHANDE — Estimée par IA
// ============================================================
app.post('/players/:id/market-value', requireAuth, async (req, res) => {
  const { data: player } = await db.from('players').select('*').eq('id', req.params.id).single()
  if (!player) return res.status(404).json({ error: 'Joueur introuvable' })

  const statsLines = [
    player.pts     != null && `PTS: ${player.pts}`,
    player.ast     != null && `AST: ${player.ast}`,
    player.reb     != null && `REB: ${player.reb}`,
    player.ts_pct  != null && `TS%: ${player.ts_pct}`,
    player.usg_pct != null && `USG%: ${player.usg_pct}`,
    player.bpm     != null && `BPM: ${player.bpm}`,
    player.net_rtg != null && `Net: ${player.net_rtg}`,
  ].filter(Boolean).join(' | ')

  try {
    const result = await callClaude([{
      role: 'user',
      content: `You are a basketball contract expert with deep knowledge of European and NBA market values.

Player: ${player.first_name} ${player.last_name}
Position: ${player.position} | Age: ${player.age} | League: ${player.league} | Team: ${player.team}
Stats: ${statsLines}
Scout grade: ${player.scout_grade}/10
Ceiling: ${player.ceiling || 'Unknown'}

Estimate the realistic annual market value for this player based on:
1. Current performance and efficiency
2. Age and development trajectory  
3. League level (adjust for competition level)
4. Position scarcity and market demand
5. Recent comparable transfers in Europe

Return ONLY a JSON object:
{
  "market_value": "X€ — Y€ / an",
  "reasoning": "2 sentences max explaining the estimate",
  "comparable_contracts": "1-2 similar player contracts as reference"
}`
    }], { webSearch: true, maxTokens: 400 })

    const json = JSON.parse(result.replace(/```json|```/g, '').trim())
    await db.from('players').update({ market_value: json.market_value }).eq('id', req.params.id)
    res.json(json)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})


// ============================================================
//  API-SPORTS — Agent Veille Hebdomadaire
// ============================================================

const API_SPORTS_KEY = process.env.API_SPORTS_KEY
const API_SPORTS_URL = 'https://v1.basketball.api-sports.io'

// IDs des ligues suivies
const LEAGUES = {
  'BBL (GER)':      { id: 117, season: '2025-2026' },
  'Pro A (GER)':    { id: 118, season: '2025-2026' },
  'Pro B':          { id: 140, season: '2025-2026' },
  'Liga ACB (ESP)': { id: 119, season: '2025-2026' },
  'Lega A (ITA)':   { id: 131, season: '2025-2026' },
  'BSL (TUR)':      { id: 120, season: '2025-2026' },
  'NCAA':           { id: 116, season: '2025-2026' },
}

async function apiSports(endpoint, params = {}) {
  if (!API_SPORTS_KEY) throw new Error('API_SPORTS_KEY manquante dans les variables Railway')
  const url = new URL(API_SPORTS_URL + endpoint)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const resp = await fetch(url.toString(), {
    headers: {
      'x-apisports-key': API_SPORTS_KEY,
      'x-apisports-host': 'v1.basketball.api-sports.io'
    }
  })
  if (!resp.ok) throw new Error('API-Sports HTTP ' + resp.status)
  const data = await resp.json()
  if (data.errors && Object.keys(data.errors).length > 0) throw new Error(JSON.stringify(data.errors))
  return data.response
}

// Récupérer les matchs d'une période
async function getGames(leagueId, season, dateFrom, dateTo) {
  try {
    const games = await apiSports('/games', {
      league: leagueId,
      season,
      date: dateFrom, // API-Sports prend une date unique ou range
    })
    return games || []
  } catch (e) {
    console.error('[API-Sports] getGames:', e.message)
    return []
  }
}

// Récupérer les stats joueurs d'une équipe sur la saison
async function getTeamStats(leagueId, season, teamId) {
  try {
    const stats = await apiSports('/statistics', { league: leagueId, season, team: teamId })
    return stats || []
  } catch (e) {
    console.error('[API-Sports] getTeamStats:', e.message)
    return []
  }
}

// Récupérer les équipes d'une ligue
async function getTeams(leagueId, season) {
  try {
    const teams = await apiSports('/teams', { league: leagueId, season })
    return teams || []
  } catch (e) {
    console.error('[API-Sports] getTeams:', e.message)
    return []
  }
}

// Route veille hebdomadaire — analyse les meilleures perfs du week-end
app.get('/veille', requireAuth, async (req, res) => {
  const { from, to, leagues: leagueFilter } = req.query

  // Dates par défaut : dernier week-end
  const today = new Date()
  const dayOfWeek = today.getDay()
  const lastSunday = new Date(today)
  lastSunday.setDate(today.getDate() - (dayOfWeek === 0 ? 0 : dayOfWeek))
  const lastSaturday = new Date(lastSunday)
  lastSaturday.setDate(lastSunday.getDate() - 1)

  const dateFrom = from || lastSaturday.toISOString().split('T')[0]
  const dateTo   = to   || lastSunday.toISOString().split('T')[0]

  const targetLeagues = leagueFilter
    ? leagueFilter.split(',').map(l => l.trim())
    : Object.keys(LEAGUES)

  console.log('[Veille] Période:', dateFrom, '→', dateTo)
  console.log('[Veille] Ligues:', targetLeagues.join(', '))

  try {
    const allPerfs = []

    for (const leagueName of targetLeagues) {
      const league = LEAGUES[leagueName]
      if (!league) continue

      // Récupérer les équipes de la ligue
      const teams = await getTeams(league.id, league.season)
      console.log('[Veille]', leagueName, ': ', teams.length, 'équipes')

      for (const team of teams.slice(0, 20)) {
        const teamId = team.id
        const rawStats = await getTeamStats(league.id, league.season, teamId)
        await new Promise(r => setTimeout(r, 250))

        // /statistics peut retourner un objet ou un tableau
        const playerStats = Array.isArray(rawStats) ? rawStats : (rawStats?.players || rawStats?.response || [])
        console.log('[Veille]', team.name, ':', playerStats.length, 'joueurs | sample:', JSON.stringify(playerStats[0])?.slice(0,100))

        for (const item of playerStats) {
          if (!item.player) continue

          const pts = parseFloat(item.points) || 0
          const reb = parseFloat(item.rebounds?.total || 0) || 0
          const ast = parseFloat(item.assists) || 0
          const stl = parseFloat(item.steals) || 0
          const blk = parseFloat(item.blocks) || 0
          const tov = parseFloat(item.turnovers || 0) || 0
          const eval_ = pts + reb * 1.2 + ast * 1.5 + stl * 2 + blk * 2 - tov

          if (pts >= 15 || (pts >= 12 && reb >= 7) || (pts >= 10 && ast >= 6) || eval_ >= 20) {
            allPerfs.push({
              player_name: item.player.name,
              team: team.name || '',
              league: leagueName,
              match: 'Saison ' + league.season,
              score: '',
              date: dateFrom,
              pts: Math.round(pts * 10) / 10,
              reb: Math.round(reb * 10) / 10,
              ast: Math.round(ast * 10) / 10,
              stl: Math.round(stl * 10) / 10,
              blk: Math.round(blk * 10) / 10,
              fg_pct: item.field_goals?.percentage ? parseFloat(item.field_goals.percentage) : null,
              eval: Math.round(eval_ * 10) / 10,
            })
          }
        }
      }
    }

    // Trier par évaluation
    allPerfs.sort((a, b) => b.eval - a.eval)
    const top = allPerfs.slice(0, 20)

    if (top.length === 0) {
      return res.json({ ok: true, perfs: [], analysis: 'Aucune performance notable trouvée sur la période.', dateFrom, dateTo })
    }

    // Demander à Claude d'analyser comme un scout pro
    const perfSummary = top.map((p, i) =>
      (i + 1) + '. ' + p.player_name + ' (' + p.team + ', ' + p.league + ') — ' +
      p.pts + 'pts ' + p.reb + 'reb ' + p.ast + 'ast | Eval: ' + p.eval + ' | ' + p.match
    ).join('\n')

    const analysis = await callClaude([{
      role: 'user',
      content: 'Tu es scout basketball professionnel. Voici les meilleures performances du week-end du ' + dateFrom + ' au ' + dateTo + ' en Europe et NCAA :\n\n' + perfSummary + '\n\nFais une shortlist scout commentée (style rapport pro) :\n1. Classe les 5-7 joueurs les plus intéressants à suivre\n2. Pour chacun : profil de jeu, pourquoi cette perf est significative, niveau de marché estimé\n3. Signale les sleepers (peu connus mais performance exceptionnelle)\n4. Conclus avec les 2-3 noms à ajouter en priorité dans une watchlist scout\n\nSois précis, factuel, utilise les chiffres.'
    }], { maxTokens: 1200 })

    res.json({ ok: true, perfs: top, analysis, dateFrom, dateTo, total: allPerfs.length })

  } catch (e) {
    console.error('[Veille]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// Autocomplete joueurs via API-Sports
app.get('/players/search', requireAuth, async (req, res) => {
  const { q } = req.query
  if (!q || q.length < 3) return res.json([])
  try {
    const players = await apiSports('/players', { search: q })
    const results = (players || []).slice(0, 8).map(p => ({
      id:       p.id,
      name:     p.name,
      firstname: p.firstname,
      lastname:  p.lastname,
      position: p.position,
      country:  p.country,
      age:      p.age,
      height:   p.height,
      weight:   p.weight,
      number:   p.number,
    }))
    res.json(results)
  } catch (e) {
    res.status(500).json([])
  }
})

// Route pour tester l'API-Sports
app.get('/veille/test', requireAuth, async (req, res) => {
  try {
    const status = await apiSports('/status')
    res.json({ ok: true, status })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// Route de diagnostic — teste tous les endpoints stats
app.get('/veille/debug-game', requireAuth, async (req, res) => {
  const gameId = req.query.id || '253261' // BBL game ID exemple
  const results = {}
  
  const endpoints = [
    '/games/statistics',
    '/games/statistics/',  
    '/statistics/games',
    '/players/statistics',
    '/games/players/statistics',
  ]
  
  for (const ep of endpoints) {
    try {
      const data = await apiSports(ep, { id: gameId })
      results[ep] = { ok: true, count: data?.length, sample: JSON.stringify(data?.[0])?.slice(0, 100) }
    } catch (e) {
      results[ep] = { ok: false, error: e.message }
    }
    await new Promise(r => setTimeout(r, 200))
  }
  
  res.json({ gameId, results })
})

// Route pour voir toutes les ligues disponibles
app.get('/veille/leagues', requireAuth, async (req, res) => {
  try {
    const { search, country } = req.query
    const params = {}
    if (search)  params.search  = search
    if (country) params.country = country
    const leagues = await apiSports('/leagues', params)
    res.json({ ok: true, total: leagues.length, leagues })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})


// ============================================================
//  SYNERGY BASKETBALL API — Sportradar
// ============================================================

const SYNERGY_BASE = 'https://api.sportradar.com/synergy/basketball'
const SYNERGY_KEY  = process.env.SYNERGY_API_KEY

// Slugs ligues Synergy
const SYNERGY_LEAGUES = {
  'BBL (GER)':      'ger.1',
  'Pro A (GER)':    'ger.2',
  'Betclic Elite':  'fra.1',
  'Pro B':          'fra.pro.b',
  'Liga ACB (ESP)': 'esp.1',
  'Lega A (ITA)':   'ita.1',
  'BSL (TUR)':      'tur.1',
  'EuroLeague':     'euro.league',
  'BCL':            'bcl',
  'NCAA':           'ncaa',
}

async function synergy(path, params = {}) {
  if (!SYNERGY_KEY) throw new Error('SYNERGY_API_KEY manquante')
  const url = new URL(SYNERGY_BASE + path)
  // Sportradar utilise 'apikey' comme paramètre
  url.searchParams.set('apikey', SYNERGY_KEY)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const resp = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'x-api-key': SYNERGY_KEY
    }
  })
  if (!resp.ok) throw new Error('Synergy HTTP ' + resp.status + ' — ' + (await resp.text()).slice(0, 200))
  return resp.json()
}

// Récupérer les matchs d'une ligue sur une période
async function getSynergyGames(leagueSlug, dateFrom, dateTo) {
  try {
    const data = await synergy('/' + leagueSlug + '/games', {
      startDate: dateFrom,
      endDate:   dateTo,
    })
    return data?.data || data?.response || (Array.isArray(data) ? data : [])
  } catch (e) {
    console.error('[Synergy] getGames', leagueSlug, e.message)
    return []
  }
}

// Récupérer les box scores d'un match
async function getSynergyBoxScores(leagueSlug, gameId) {
  try {
    const data = await synergy('/' + leagueSlug + '/games/' + gameId + '/players')
    return data?.data || data?.response || (Array.isArray(data) ? data : [])
  } catch (e) {
    console.error('[Synergy] boxscores', gameId, e.message)
    return []
  }
}

// Tester les ligues disponibles avec la clé
app.get('/synergy/test', requireAuth, async (req, res) => {
  const results = {}
  for (const [name, slug] of Object.entries(SYNERGY_LEAGUES)) {
    try {
      const data = await synergy('/' + slug + '/competitiondefinitions')
      results[name] = { ok: true, slug }
    } catch (e) {
      results[name] = { ok: false, slug, error: e.message.slice(0, 80) }
    }
    await new Promise(r => setTimeout(r, 400))
  }
  res.json(results)
})

// Veille avec vraies données Synergy
app.get('/synergy/veille', requireAuth, async (req, res) => {
  const { from, to, leagues: leagueFilter } = req.query

  const today = new Date()
  const dayOfWeek = today.getDay()
  const lastSat = new Date(today)
  lastSat.setDate(today.getDate() - (dayOfWeek === 0 ? 1 : dayOfWeek === 6 ? 0 : dayOfWeek + 1))
  const lastSun = new Date(lastSat)
  lastSun.setDate(lastSat.getDate() + 1)

  const dateFrom = from || lastSat.toISOString().split('T')[0]
  const dateTo   = to   || lastSun.toISOString().split('T')[0]

  const targetLeagues = leagueFilter
    ? leagueFilter.split(',').map(l => l.trim()).filter(l => SYNERGY_LEAGUES[l])
    : Object.keys(SYNERGY_LEAGUES)

  console.log('[Synergy Veille]', dateFrom, '→', dateTo, '|', targetLeagues.join(', '))

  try {
    const allPerfs = []

    for (const leagueName of targetLeagues) {
      const slug = SYNERGY_LEAGUES[leagueName]
      const games = await getSynergyGames(slug, dateFrom, dateTo)
      console.log('[Synergy]', leagueName, ':', games.length, 'matchs')

      for (const gameWrapper of games.slice(0, 8)) {
        const game = gameWrapper.data || gameWrapper
        const gameId = game.id
        if (!gameId) continue

        const matchLabel = (game.awayTeam?.name || '') + ' @ ' + (game.homeTeam?.name || '')
        const score = (game.awayScore || 0) + '-' + (game.homeScore || 0)

        const boxScores = await getSynergyBoxScores(slug, gameId)
        await new Promise(r => setTimeout(r, 300))

        for (const bsWrapper of boxScores) {
          const bs = bsWrapper.data || bsWrapper
          if (!bs?.player) continue

          const pts = parseInt(bs.points || bs.pts || 0) || 0
          const reb = parseInt(bs.rebounds || bs.reb || bs.totReb || 0) || 0
          const ast = parseInt(bs.assists || bs.ast || 0) || 0
          const stl = parseInt(bs.steals || bs.stl || 0) || 0
          const blk = parseInt(bs.blocks || bs.blk || 0) || 0
          const tov = parseInt(bs.turnovers || bs.tov || 0) || 0
          const eval_ = pts + reb * 1.2 + ast * 1.5 + stl * 2 + blk * 2 - tov

          if (pts > 0) console.log('[Synergy]', bs.player?.name || bs.player, pts, 'pts', reb, 'reb', ast, 'ast')

          if (pts >= 20 || (pts >= 15 && reb >= 8) || (pts >= 12 && ast >= 7) || eval_ >= 25) {
            allPerfs.push({
              player_name: bs.player?.name || bs.player || 'Inconnu',
              team: bs.team?.name || bs.teamName || '',
              league: leagueName,
              match: matchLabel,
              score,
              date: game.date?.split('T')[0] || dateFrom,
              pts, reb, ast, stl, blk, tov,
              eval: Math.round(eval_ * 10) / 10,
            })
          }
        }
      }
    }

    allPerfs.sort((a, b) => b.eval - a.eval)
    const top = allPerfs.slice(0, 20)

    if (top.length === 0) {
      return res.json({ ok: true, perfs: [], analysis: 'Aucune performance notable trouvée — vérifie les slugs de ligues avec /synergy/test', dateFrom, dateTo })
    }

    const perfSummary = top.map((p, i) =>
      (i+1) + '. ' + p.player_name + ' (' + p.team + ', ' + p.league + ') — ' +
      p.pts + 'pts ' + p.reb + 'reb ' + p.ast + 'ast | Eval: ' + p.eval + ' | ' + p.match
    ).join('\n')

    const analysis = await callClaude([{
      role: 'user',
      content: 'Tu es scout basketball professionnel. Voici les meilleures performances du ' + dateFrom + ' au ' + dateTo + ' :\n\n' + perfSummary + '\n\nFais une shortlist scout commentée : classe les 5-7 joueurs les plus intéressants, profil de jeu, niveau de marché, sleepers à surveiller. Conclus avec les 2-3 priorités absolues.'
    }], { maxTokens: 1200 })

    res.json({ ok: true, perfs: top, analysis, dateFrom, dateTo, total: allPerfs.length })

  } catch (e) {
    console.error('[Synergy Veille]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// Carrière d'un joueur
app.get('/synergy/player/:playerId/career', requireAuth, async (req, res) => {
  const { playerId } = req.params
  const { league = 'ger.1' } = req.query
  try {
    const data = await synergy('/' + league + '/players/' + playerId + '/playercareers')
    res.json({ ok: true, data })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// Stats play types (PnR, ISO, Cuts...) — REMPLACE INSTAT
app.get('/synergy/player/:playerId/playtypes', requireAuth, async (req, res) => {
  const { playerId } = req.params
  const { league = 'ger.1', seasonId } = req.query
  if (!seasonId) return res.status(400).json({ ok: false, error: 'seasonId requis' })
  try {
    // Stats du joueur spécifique
    const data = await synergy('/' + league + '/seasons/' + seasonId + '/events/reports/playerplaytypestats', {
      playerId
    })
    res.json({ ok: true, data })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// Stats play types saison complète (pour comparaison)
app.get('/synergy/season/:seasonId/playtypes', requireAuth, async (req, res) => {
  const { seasonId } = req.params
  const { league = 'ger.1' } = req.query
  try {
    const data = await synergy('/' + league + '/seasons/' + seasonId + '/events/reports/playerplaytypestats')
    res.json({ ok: true, data })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// Impact stats avancées (niveau NBA Analytics)
app.get('/synergy/advanced/impact', requireAuth, async (req, res) => {
  const { league = 'ger.1', seasonId } = req.query
  try {
    const data = await synergy('/advanced/basketball/' + league + '/playerimpactstats', seasonId ? { seasonId } : {})
    res.json({ ok: true, data })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// Événements d'un joueur sur la saison (chaque possession)
app.get('/synergy/advanced/player/:playerId/events', requireAuth, async (req, res) => {
  const { playerId } = req.params
  const { league = 'ger.1', seasonId } = req.query
  if (!seasonId) return res.status(400).json({ ok: false, error: 'seasonId requis' })
  try {
    const data = await synergy('/advanced/basketball/' + league + '/seasons/' + seasonId + '/players/' + playerId + '/events')
    res.json({ ok: true, data })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// Roster d'une équipe
app.get('/synergy/team/:teamId/players', requireAuth, async (req, res) => {
  const { teamId } = req.params
  const { league = 'ger.1' } = req.query
  try {
    const data = await synergy('/' + league + '/teams/' + teamId + '/players')
    res.json({ ok: true, data })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// Découvrir toutes les ligues disponibles avec la clé
app.get('/synergy/discover', requireAuth, async (req, res) => {
  // Tous les slugs possibles Sportradar Synergy
  const slugs = [
    'international', 'i',
    'ger.1', 'ger.2', 'ger',
    'fra.1', 'fra.2', 'fra',
    'esp.1', 'esp',
    'ita.1', 'ita',
    'tur.1', 'tur',
    'euro.league', 'euroleague',
    'bcl', 'fiba.bcl',
    'ncaa', 'ncaam',
    'nba', 'nba.1',
    'adria', 'adriatic',
    'lnb', 'acb', 'lba',
    'bbl', 'beko.bbl',
    'basketball.champions.league',
    'global', 'intl',
  ]

  const results = {}
  for (const slug of slugs) {
    try {
      const data = await synergy('/' + slug + '/competitiondefinitions')
      results[slug] = { ok: true, sample: JSON.stringify(data)?.slice(0, 150) }
    } catch (e) {
      results[slug] = { ok: false, error: e.message.slice(0, 60) }
    }
    await new Promise(r => setTimeout(r, 200))
  }

  const working = Object.entries(results).filter(([, v]) => v.ok).map(([k]) => k)
  res.json({ working, total_tested: slugs.length, results })
})

// Découvrir les saisons d'une ligue spécifique
app.get('/synergy/leagues', requireAuth, async (req, res) => {
  const { league = 'international' } = req.query
  try {
    const data = await synergy('/' + league + '/competitiondefinitions')
    res.json({ ok: true, data })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})
