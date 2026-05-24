import { getOrCreatePlayer, getPlayerByDiscord, getInventory, getStatus } from './player.js';
import { getCharacterSheet, formatItemEffects } from './stats.js';
import { getDb } from './db.js';
import { train } from './train.js';
import { listGyms, setGym as setGymAction } from './gym.js';
import { trainWorker as trainWorkerAction } from './worker.js';
import { equipItem, unequipSlot, getEquippedSummary } from './equip.js';
import { listCompanies, joinCompany as joinCompanyAction, companyWork } from './company.js';
import { listDrugs, useDrug as useDrugAction } from './drugs.js';
import {
  exploreStatus,
  exploreTravel,
  exploreMove,
  exploreMine,
  talkNpc,
  listNpcsInRoom
} from './explore.js';
import { exploreHunt as exploreHuntAction, pveAttack as pveAttackAction, pveFlee as pveFleeAction } from './explore-pve.js';
import { listPvpTargets } from './pvp-targets.js';
import { chooseClass, listClassOptions } from './classes.js';
import {
  escapeHospital,
  escapeJail,
  getConfinementStatus,
  waitOutStatus
} from './escape.js';
import { loungeAction } from './lounge.js';
import { listCrimes, commitCrime } from './crime.js';
import {
  bank as bankAction,
  collectInvestment as collectInvestmentAction,
  shopList,
  shopBuy as shopBuyAction,
  shopListArmory,
  shopBuyAndEquip as shopBuyAndEquipAction,
  work as workAction,
  setJob as setJobAction,
  useItem as useItemAction,
  listJobs as listJobsAction
} from './economy.js';
import { attack as attackAction, mug as mugAction, rob as robAction, bustOut } from './pvp.js';
import { spinWheel } from './wheel.js';
import {
  listEducation,
  enrollEducation,
  listClans,
  joinClan as joinClanAction,
  clanDeposit as clanDepositAction,
  listEstates,
  buyEstate as buyEstateAction,
  marketList as createMarketListing,
  marketBrowse as browseMarket,
  marketBuy as buyMarketListing,
  goldList as createGoldListing,
  goldBrowse as browseGoldMarket,
  goldBuy as buyGoldListing,
  forge as forgeAction,
  listCommodities,
  tradeCommodity
} from './phase2.js';
import {
  delve as delveAction,
  endDelve as endDelveAction,
  buyGrabBags as buyGrabBagsAction,
  openGrabBag as openGrabBagAction,
  leaderboard as fetchLeaderboard,
  setWorld as setWorldAction,
  adminAction
} from './phase3.js';
import { listRecipes, forgeRecipe as forgeRecipeAction } from './recipes.js';
import { getDailyQuests, claimDailyQuest as claimDailyQuestAction } from './daily-quests.js';
import { listFactions, joinFaction } from './faction.js';
import {
  createGuild,
  joinGuild,
  leaveGuild,
  guildDeposit,
  listGuilds,
  listGuildMembers,
  getPlayerGuild
} from './guild.js';
import {
  listTerritoriesWithControl,
  getTerritoryDetail,
  realmSummary,
  declareWar,
  contributeSiege,
  warStatus,
  mapBootstrap,
  realmMapLegend,
  realmMapPngPath
} from './territory.js';
import { startTickScheduler } from './tick.js';

export class GameService {
  static startScheduler() {
    return startTickScheduler(60000);
  }

  static dailyQuests(discordId, username) {
    return getDailyQuests(discordId, username);
  }

  static claimDailyQuest(discordId, username, questId) {
    return claimDailyQuestAction(discordId, username, questId);
  }

  static profile(discordId, username) {
    const p = getOrCreatePlayer(discordId, username);
    return { player: p, status: getStatus(p), inventory: getInventory(p.id) };
  }

  static status(discordId, username) {
    const p = getOrCreatePlayer(discordId, username);
    return getStatus(p);
  }

  static train(discordId, username, sets, stat = 'strength') {
    return train(discordId, username, sets, stat);
  }
  static lounge(discordId, username, action) {
    return loungeAction(discordId, username, action);
  }
  static crimes(discordId, username) {
    return listCrimes(discordId, username);
  }
  static confinement(discordId, username) {
    return getConfinementStatus(getOrCreatePlayer(discordId, username));
  }
  static escape(discordId, username, place, method) {
    if (place === 'hospital' || place === 'infirmary') return escapeHospital(discordId, username, method);
    if (place === 'jail' || place === 'prison') return escapeJail(discordId, username, method);
    return waitOutStatus(discordId, username);
  }
  static crime(discordId, username, id) {
    return commitCrime(discordId, username, id);
  }
  static bank(discordId, username, action, amount) {
    return bankAction(discordId, username, action, amount);
  }
  static collectInvestment(discordId, username) {
    return collectInvestmentAction(discordId, username);
  }
  static shop() {
    return shopList();
  }
  static shopArmory() {
    return shopListArmory();
  }
  static shopGear() {
    return shopList('gear');
  }
  static shopBuy(discordId, username, itemId, qty) {
    return shopBuyAction(discordId, username, itemId, qty);
  }
  static shopBuyEquip(discordId, username, itemId) {
    return shopBuyAndEquipAction(discordId, username, itemId);
  }
  static shopArmoryForPlayer(discordId, username) {
    const player = getOrCreatePlayer(discordId, username);
    const items = shopListArmory().map((item) => ({
      ...item,
      effectLabel: formatItemEffects(item.effects_json),
      locked: player.level < (item.min_level ?? 1)
    }));
    return {
      weapons: items.filter((i) => i.item_type === 'weapon'),
      armor: items.filter((i) => i.item_type === 'armor')
    };
  }
  static characterSheet(discordId, username) {
    const player = getOrCreatePlayer(discordId, username);
    return { ok: true, player, sheet: getCharacterSheet(player, getDb()) };
  }
  static classProgress(discordId, username) {
    return listClassOptions(discordId, username);
  }
  static chooseClass(discordId, username, classId) {
    return chooseClass(discordId, username, classId);
  }
  static work(discordId, username) {
    return workAction(discordId, username);
  }
  static setJob(discordId, username, jobId) {
    return setJobAction(discordId, username, jobId);
  }
  static listJobs() {
    return listJobsAction();
  }
  static useItem(discordId, username, itemId) {
    return useItemAction(discordId, username, itemId);
  }
  static attack(discordId, username, targetId) {
    return attackAction(discordId, username, targetId);
  }
  static mug(discordId, username, targetId) {
    return mugAction(discordId, username, targetId);
  }
  static rob(discordId, username, targetId) {
    return robAction(discordId, username, targetId);
  }
  static bust(discordId, username, targetId) {
    return bustOut(discordId, username, targetId);
  }
  static wheel(discordId, username) {
    return spinWheel(discordId, username);
  }

  static educationList() {
    return listEducation();
  }
  static educationEnroll(discordId, username, courseId) {
    return enrollEducation(discordId, username, courseId);
  }
  static clans() {
    return listClans();
  }
  static joinClan(discordId, username, clanId) {
    return joinClanAction(discordId, username, clanId);
  }
  static clanDeposit(discordId, username, amount) {
    return clanDepositAction(discordId, username, amount);
  }
  static estates() {
    return listEstates();
  }
  static buyEstate(discordId, username, tier) {
    return buyEstateAction(discordId, username, tier);
  }
  static marketBrowse() {
    return browseMarket();
  }
  static marketList(discordId, username, itemId, qty, price) {
    return createMarketListing(discordId, username, itemId, qty, price);
  }
  static marketBuy(discordId, username, listingId) {
    return buyMarketListing(discordId, username, listingId);
  }
  static goldBrowse() {
    return browseGoldMarket();
  }
  static goldList(discordId, username, amount, price) {
    return createGoldListing(discordId, username, amount, price);
  }
  static goldBuy(discordId, username, listingId) {
    return buyGoldListing(discordId, username, listingId);
  }
  static forge(discordId, username, recipeId) {
    return forgeAction(discordId, username, recipeId);
  }
  static gyms() {
    return listGyms();
  }
  static setGym(discordId, username, gymId) {
    return setGymAction(discordId, username, gymId);
  }
  static trainWorker(discordId, username, stat, sets) {
    return trainWorkerAction(discordId, username, stat, sets);
  }
  static equip(discordId, username, itemId) {
    return equipItem(discordId, username, itemId);
  }
  static unequip(discordId, username, slot) {
    return unequipSlot(discordId, username, slot);
  }
  static equipped(playerId) {
    return getEquippedSummary(playerId);
  }
  static companies() {
    return listCompanies();
  }
  static joinCompany(discordId, username, companyId) {
    return joinCompanyAction(discordId, username, companyId);
  }
  static drugs() {
    return listDrugs();
  }
  static useDrug(discordId, username, drugId) {
    return useDrugAction(discordId, username, drugId);
  }
  static explore(discordId, username) {
    return exploreStatus(discordId, username);
  }
  static exploreTravel(discordId, username, areaId) {
    return exploreTravel(discordId, username, areaId);
  }
  static exploreMove(discordId, username, dir) {
    return exploreMove(discordId, username, dir);
  }
  static exploreMine(discordId, username) {
    return exploreMine(discordId, username);
  }
  static exploreHunt(discordId, username) {
    return exploreHuntAction(discordId, username);
  }
  static pveAttack(discordId, username) {
    return pveAttackAction(discordId, username);
  }
  static pveFlee(discordId, username) {
    return pveFleeAction(discordId, username);
  }
  static talkNpc(discordId, username, npcId) {
    return talkNpc(discordId, username, npcId);
  }
  static recipes() {
    return listRecipes();
  }
  static forgeRecipe(discordId, username, recipeId) {
    return forgeRecipeAction(discordId, username, recipeId);
  }
  static commodities() {
    return listCommodities();
  }
  static commodityTrade(discordId, username, id, qty, action) {
    return tradeCommodity(discordId, username, id, qty, action);
  }

  static delve(discordId, username) {
    return delveAction(discordId, username);
  }
  static endDelve(discordId, username) {
    return endDelveAction(discordId, username);
  }
  static buyGrabBags(discordId, username, count) {
    return buyGrabBagsAction(discordId, username, count);
  }
  static openGrabBag(discordId, username) {
    return openGrabBagAction(discordId, username, true);
  }
  static leaderboard(kind) {
    return fetchLeaderboard(kind);
  }
  static setWorld(discordId, username, worldId) {
    return setWorldAction(discordId, username, worldId);
  }
  static admin(adminId, action, targetId, value) {
    return adminAction(adminId, action, targetId, value);
  }

  static listPlayers(limit = 20) {
    return getDb()
      .prepare(
        'SELECT id, discord_id, username, level, coins FROM players WHERE banned = 0 ORDER BY level DESC LIMIT ?'
      )
      .all(limit);
  }

  static listPvpTargets(excludeDiscordId, guildMembers = null, opts = {}) {
    return listPvpTargets(excludeDiscordId, guildMembers, opts);
  }

  static getPlayerByDiscord(discordId) {
    return getPlayerByDiscord(discordId);
  }

  static factions() {
    return listFactions();
  }
  static joinHouse(discordId, username, factionId) {
    return joinFaction(discordId, username, factionId);
  }
  static guilds(limit) {
    return listGuilds(limit);
  }
  static createGuild(discordId, username, name, tag) {
    return createGuild(discordId, username, name, tag);
  }
  static joinGuild(discordId, username, guildId) {
    return joinGuild(discordId, username, guildId);
  }
  static leaveGuild(discordId, username) {
    return leaveGuild(discordId, username);
  }
  static guildDeposit(discordId, username, amount) {
    return guildDeposit(discordId, username, amount);
  }
  static guildMembers(guildId) {
    return listGuildMembers(guildId);
  }
  static playerGuild(player) {
    return getPlayerGuild(player);
  }
  static territories() {
    return listTerritoriesWithControl();
  }
  static territory(id, discordId, username) {
    return getTerritoryDetail(id, discordId, username);
  }
  static realm(baseUrl) {
    return realmSummary(baseUrl);
  }
  static realmMapLegend() {
    return realmMapLegend();
  }
  static realmMapPngPath() {
    return realmMapPngPath();
  }
  static declareWar(discordId, username, territoryId) {
    return declareWar(discordId, username, territoryId);
  }
  static contributeSiege(discordId, username) {
    return contributeSiege(discordId, username);
  }
  static warStatus(discordId, username) {
    return warStatus(discordId, username);
  }
  static mapBootstrap(discordId, username) {
    return mapBootstrap(discordId, username);
  }
}

export { getOrCreatePlayer, getPlayerByDiscord, getInventory, getStatus };
