// Missions: 18 jobs in 4 acts. Every stage point is a road intersection,
// so it is always on a road and never inside a building or landmark.
// A job unlocks when the previous one is done. Timed stages fail the job
// (retryable); the finale pays $8,000 and ends the game in victory.
import { CROWN_REWARD } from './config.js';
import { dist, fmtCash, fmtTime } from './util.js';
import { roadPoint } from './world.js';
import { spawnEnemy } from './combat.js';

const RP = roadPoint;
export const JOBS = [
  { id: 'j1', act: 1, title: 'First Wheels', reward: 150, briefing: 'You are new in Halcyon Bay. Get a car — any car — and bring it to the Sunset Diner.', stages: [
    { type: 'steal', text: 'Steal a car (walk up and press E)' },
    { type: 'drive', point: RP(4, 3), text: 'Drive to the Sunset Diner' } ] },
  { id: 'j2', act: 1, title: 'Sunset Courier', reward: 250, briefing: 'Three parcels, three corners of the bay. Do not ask what is inside.', stages: [
    { type: 'goto', point: RP(6, 0), text: 'Deliver to Northgate Airfield gate' },
    { type: 'goto', point: RP(1, 5), text: 'Deliver to the south docks' },
    { type: 'goto', point: RP(7, 3), text: 'Deliver to East Bay' } ] },
  { id: 'j3', act: 1, title: 'Getaway Driver', reward: 400, briefing: 'A client at City Hall needs a fast, quiet ride to the Ferry Terminal. 75 seconds.', stages: [
    { type: 'goto', point: RP(1, 1), text: 'Pick up the client at City Hall' },
    { type: 'drive', point: RP(3, 4), timer: 75, text: 'Drive the client to the Ferry Terminal' } ] },
  { id: 'j4', act: 1, title: 'Harbor Pickup', reward: 350, briefing: 'A crate is waiting on Sunset Pier. Bring it to Chrome Works, no questions.', stages: [
    { type: 'goto', point: RP(0, 4), text: 'Collect the crate at Sunset Pier' },
    { type: 'goto', point: RP(1, 4), text: 'Deliver the crate to Chrome Works' } ] },
  { id: 'j5', act: 2, title: 'The Informant', reward: 500, briefing: 'Meet the informant at City Hall on foot, then drive him to the safehouse in South Park.', stages: [
    { type: 'onfoot', point: RP(1, 1), text: 'Meet the informant at City Hall (on foot)' },
    { type: 'drive', point: RP(6, 5), text: 'Drive to the South Park safehouse' } ] },
  { id: 'j6', act: 2, title: 'Hot Pursuit', reward: 600, briefing: 'The PD is on you. Survive 60 seconds at two stars, then vanish at the Northgate hideout.', stages: [
    { type: 'survive', timer: 60, text: 'Survive the pursuit — 60 seconds' },
    { type: 'goto', point: RP(0, 0), text: 'Lose them at the Northgate hideout' } ] },
  { id: 'j7', act: 2, title: 'Arms Deal', reward: 700, briefing: 'Buy an SMG at Iron & Oak, then clear the rivals hanging around the Halcyon Bowl.', stages: [
    { type: 'buy', item: 'smg', text: 'Buy an SMG at Iron & Oak' },
    { type: 'eliminate', count: 4, point: RP(3, 1), text: 'Clear 4 rivals at the Halcyon Bowl' } ] },
  { id: 'j8', act: 2, title: 'Night Shift', reward: 450, briefing: 'Two fares before the clock runs out. The stand on Grand Avenue is waiting.', stages: [
    { type: 'fares', count: 2, timer: 240, text: 'Complete 2 taxi fares (T at a stand)' } ] },
  { id: 'j9', act: 3, title: 'Grand Theft', reward: 800, briefing: 'A yellow Comet coupe sits in the airfield hangar lot. Take it to Chrome Works.', stages: [
    { type: 'goto', point: RP(7, 1), text: 'Get to Northgate Airfield' },
    { type: 'steal', special: 'comet', text: 'Steal the Comet coupe' },
    { type: 'drive', point: RP(1, 4), text: 'Deliver the Comet to Chrome Works' } ] },
  { id: 'j10', act: 3, title: 'Dockside Deal', reward: 900, briefing: 'A deal at the docks, and an ambush waiting for it. Clear the shooters, then get out.', stages: [
    { type: 'goto', point: RP(0, 4), text: 'Get to the docks' },
    { type: 'eliminate', count: 3, point: RP(0, 4), text: 'Clear 3 ambush shooters' },
    { type: 'goto', point: RP(5, 5), text: 'Get clear — South Park' } ] },
  { id: 'j11', act: 3, title: 'Airfield Run', reward: 1000, briefing: 'Five checkpoints around the airfield, 90 seconds. The runway is not a road. The roads are.', stages: [
    { type: 'race', timer: 90, points: [RP(7, 0), RP(7, 2), RP(5, 2), RP(5, 0), RP(7, 0)], text: 'Checkpoint race around the airfield' } ] },
  { id: 'j12', act: 3, title: 'The Long Night', reward: 750, briefing: 'Four sunset tokens are still out there. Collect them, then check in at the diner.', stages: [
    { type: 'collect', count: 4, text: 'Collect 4 sunset tokens' },
    { type: 'goto', point: RP(4, 3), text: 'Check in at the Sunset Diner' } ] },
  { id: 'j13', act: 4, title: 'Fare Game', reward: 600, briefing: 'Three fares, five minutes, no excuses. The city tips the fast.', stages: [
    { type: 'fares', count: 3, timer: 300, text: 'Complete 3 taxi fares (T at a stand)' } ] },
  { id: 'j14', act: 4, title: 'Courier Rush', reward: 900, briefing: 'Five drops, 45 seconds each. The parcels do not wait.', stages: [
    { type: 'drive', point: RP(0, 5), timer: 45, text: 'Drop 1 — Bayfront' },
    { type: 'drive', point: RP(7, 0), timer: 45, text: 'Drop 2 — Airfield gate' },
    { type: 'drive', point: RP(3, 5), timer: 45, text: 'Drop 3 — South Marina' },
    { type: 'drive', point: RP(6, 3), timer: 45, text: 'Drop 4 — East Bay' },
    { type: 'drive', point: RP(2, 2), timer: 45, text: 'Drop 5 — Grand Avenue' } ] },
  { id: 'j15', act: 4, title: 'Grand Avenue GP', reward: 1200, briefing: 'Eight checkpoints down Grand Avenue and back, 120 seconds. Fastest in the bay wins.', stages: [
    { type: 'race', timer: 120, points: [RP(0, 2), RP(2, 2), RP(4, 2), RP(6, 2), RP(7, 2), RP(7, 3), RP(5, 3), RP(2, 3)], text: 'Grand Avenue GP — checkpoints' } ] },
  { id: 'j16', act: 4, title: 'Harbor Lights', reward: 1100, briefing: 'Dusk run along the harbor with two stars on you. Four lit markers, no stopping.', stages: [
    { type: 'goto', point: RP(3, 4), text: 'Marker 1 — Ferry Terminal', wanted: 2 },
    { type: 'goto', point: RP(0, 4), text: 'Marker 2 — Sunset Pier', wanted: 2 },
    { type: 'goto', point: RP(4, 5), text: 'Marker 3 — South Marina', wanted: 2 },
    { type: 'goto', point: RP(1, 5), text: 'Marker 4 — the south docks', wanted: 2 } ] },
  { id: 'j17', act: 4, title: 'The Long Con', reward: 1500, briefing: 'Meet the mark at Palm Court, drive him to the casino, deal with his friends, and disappear.', stages: [
    { type: 'onfoot', point: RP(5, 2), text: 'Meet the mark at Palm Court (on foot)' },
    { type: 'drive', point: RP(6, 2), text: 'Drive the mark to the Crown Casino' },
    { type: 'eliminate', count: 3, point: RP(6, 2), text: 'Deal with his 3 friends at the casino' },
    { type: 'goto', point: RP(3, 4), text: 'Disappear at the Ferry Terminal' } ] },
  { id: 'j18', act: 4, title: 'Crown Heist', reward: CROWN_REWARD, briefing: 'The Crown sits in the casino vault. Walk in, take it, and run the whole bay to the ferry with four stars on you.', stages: [
    { type: 'onfoot', point: RP(6, 2), text: 'Walk into the Crown Casino' },
    { type: 'grab', point: RP(6, 2), text: 'Grab the Crown — then RUN', wanted: 4 },
    { type: 'drive', point: RP(3, 4), text: 'Escape to the Ferry Terminal with the Crown' } ] },
];
export const ACT_NAMES = { 1: 'Act I — Sunset Streets', 2: 'Act II — Rising Heat', 3: 'Act III — Bay Kings', 4: 'Act IV — Crown' };

export function jobById(id) { return JOBS.find((j) => j.id === id); }
export function isUnlocked(S, job) {
  const idx = JOBS.indexOf(job);
  if (idx === 0) return true;
  return S.jobsDone.has(JOBS[idx - 1].id);
}

export function startJob(S, id) {
  const job = jobById(id);
  if (!job) return false;
  if (S.mission) { S.toast('Finish the current job first', '#ff5a4e'); return false; }
  if (!isUnlocked(S, job)) { S.toast('Finish the previous job to unlock this one', '#ff5a4e'); return false; }
  S.mission = { job, stageIdx: 0, timer: 0, data: {}, lockWanted: false, startedAt: S.time };
  enterStage(S);
  S.toast(ACT_NAMES[job.act] + ' — ' + job.title, '#ffc53d');
  S.audio.sting();
  return true;
}

function stage(S) { return S.mission.job.stages[S.mission.stageIdx]; }

function enterStage(S) {
  const m = S.mission, st = stage(S);
  m.timer = st.timer || 0;
  m.data = { cp: 0, killsAtStart: S.stats.kills, tokensAtStart: S.stats.tokens, faresAtStart: S.stats.fares, spawned: false };
  if (st.wanted) { S.wanted.heat = st.wanted * 20; S.wanted.stars = st.wanted; m.lockWanted = true; }
  if (st.type === 'survive') { S.wanted.heat = 40; S.wanted.stars = 2; m.lockWanted = true; }
  if (st.type === 'eliminate') {
    for (let i = 0; i < st.count; i++) {
      const a = (i / st.count) * Math.PI * 2;
      spawnEnemy(S, st.point.x + Math.cos(a) * 130, st.point.y + Math.sin(a) * 130, 60);
    }
    m.data.spawned = true;
  }
  if (st.type === 'race') { m.data.cp = 0; }
  if (st.type === 'grab') { S.toast('The vault is open. Take the Crown!', '#ffc53d'); }
}

function advanceStage(S) {
  const m = S.mission;
  m.stageIdx++;
  m.lockWanted = false;
  if (m.stageIdx >= m.job.stages.length) { completeJob(S); return; }
  enterStage(S);
  S.audio.pickup();
}

function completeJob(S) {
  const m = S.mission, job = m.job;
  S.cash += job.reward;
  S.jobsDone.add(job.id);
  const took = S.time - m.startedAt;
  S.audio.sting();
  S.audio.cash();
  S.toast('Job done: ' + job.title + ' +' + fmtCash(job.reward) + ' (' + fmtTime(took) + ')', '#7ee081');
  S.floats.push({ x: S.player.x, y: S.player.y - 40, text: '+' + fmtCash(job.reward), color: '#7ee081', life: 1.6 });
  if (job.id === 'j15') S.stats.bestGp = S.stats.bestGp ? Math.min(S.stats.bestGp, took) : took;
  S.mission = null;
  S.saveGame();
  if (job.id === 'j18') {
    S.mode = 'victory';
    S.audio.sting();
  } else {
    const next = JOBS[JOBS.indexOf(job) + 1];
    if (next) S.toast('Next job unlocked: ' + next.title + ' (press M)', '#ffd166');
  }
}

function failJob(S, why) {
  S.toast('Job failed — ' + why + '. Press M to retry.', '#ff5a4e');
  S.audio.fail();
  S.mission = null;
}

export function abortMission(S) { if (S.mission) { S.mission = null; S.toast('Job abandoned'); } }

export function currentObjective(S) {
  if (!S.mission) return null;
  const st = stage(S);
  let text = st.text;
  if (st.type === 'race') text += '  ' + (S.mission.data.cp + 1) + '/' + st.points.length;
  if (st.type === 'eliminate') text += '  ' + Math.min(st.count, S.stats.kills - S.mission.data.killsAtStart) + '/' + st.count;
  if (st.type === 'collect') text += '  ' + Math.min(st.count, S.stats.tokens - S.mission.data.tokensAtStart) + '/' + st.count;
  if (st.type === 'fares') text += '  ' + Math.min(st.count, S.stats.fares - S.mission.data.faresAtStart) + '/' + st.count;
  if (S.mission.timer > 0) text += '  ⏱ ' + fmtTime(S.mission.timer);
  return { job: S.mission.job, text };
}

export function missionMarker(S) {
  if (!S.mission) return null;
  const st = stage(S);
  if (st.type === 'race') return st.points[Math.min(S.mission.data.cp, st.points.length - 1)];
  if (st.type === 'steal' && !S.player.car) {
    if (st.special === 'comet') return { x: 3050, y: 420 };
    return null;
  }
  if (st.type === 'buy') return { x: 1240, y: 688 };
  if (st.type === 'survive' || st.type === 'fares' || st.type === 'collect') return st.point || null;
  return st.point || null;
}

export function updateMission(S, dt) {
  const m = S.mission;
  if (!m) return;
  const st = stage(S);
  const p = S.player;
  const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      // Survive inverts the timer: running it out is the win.
      if (st.type === 'survive') { m.lockWanted = false; advanceStage(S); return; }
      failJob(S, 'out of time'); return;
    }
  }
  if (m.lockWanted && S.wanted.heat < 40) S.wanted.heat = 40;
  const near = (pt, r) => pt && dist(px, py, pt.x, pt.y) < (r || 70);
  switch (st.type) {
    case 'goto':
      if (near(st.point)) advanceStage(S);
      break;
    case 'drive':
      if (p.car && near(st.point)) advanceStage(S);
      break;
    case 'onfoot':
      if (!p.car && near(st.point)) advanceStage(S);
      break;
    case 'steal': {
      if (st.special === 'comet') {
        if (p.car && p.car.model === 'coupe' && p.car.comet) advanceStage(S);
      } else if (p.car) advanceStage(S);
      break;
    }
    case 'pickup':
      if (near(st.point)) advanceStage(S);
      break;
    case 'buy':
      if (p.owned.has(st.item)) advanceStage(S);
      break;
    case 'eliminate':
      if (S.stats.kills - m.data.killsAtStart >= st.count) advanceStage(S);
      break;
    case 'collect':
      if (S.stats.tokens - m.data.tokensAtStart >= st.count) advanceStage(S);
      break;
    case 'fares':
      if (S.stats.fares - m.data.faresAtStart >= st.count) advanceStage(S);
      break;
    case 'survive':
      if (m.timer <= 0) { /* timer expiry is handled above; survive ends on timer */ }
      break;
    case 'race': {
      const cp = st.points[m.data.cp];
      if (near(cp, 80)) {
        m.data.cp++;
        S.audio.pickup();
        S.floats.push({ x: cp.x, y: cp.y, text: 'Checkpoint ' + m.data.cp + '/' + st.points.length, color: '#7ee0ff', life: 1.0 });
        if (m.data.cp >= st.points.length) advanceStage(S);
      }
      break;
    }
    case 'grab':
      if (!p.car && near(st.point, 60)) {
        S.wanted.heat = 80; S.wanted.stars = 4; m.lockWanted = true;
        S.toast('THE CROWN IS YOURS — four stars, run!', '#ff5a4e');
        S.audio.sting();
        advanceStage(S);
      }
      break;
  }
}
