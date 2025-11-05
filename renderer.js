// This file handles fetching remote files from Vercel
const VERCEL_BASE_URL = 'https://online-fix-store.vercel.app';

// Steam app list cache (appID -> name mapping)
let steamAppListCache = {};
let steamAppListLoaded = false;

// Function to load Steam app list cache
async function loadSteamAppList() {
  if (steamAppListLoaded) {
    return steamAppListCache;
  }

  try {
    console.log('Loading Steam app list...');
    const result = await window.electronAPI.getSteamAppList();

    if (result.success) {
      steamAppListCache = result.apps;
      steamAppListLoaded = true;
      console.log(`Steam app list loaded successfully! ${result.totalApps} apps available.`);
      console.log(`Using ${result.cached ? 'cached' : 'fresh'} data`);
      return steamAppListCache;
    } else {
      console.error('Failed to load Steam app list:', result.error);
      return {};
    }
  } catch (error) {
    console.error('Error loading Steam app list:', error);
    return {};
  }
}

// Function to get game name from appID (instant lookup)
function getGameNameFromAppID(appID) {
  if (steamAppListCache[appID]) {
    return steamAppListCache[appID];
  }
  return `Game ${appID}`; // Fallback
}

// Function to fetch Home.txt from Vercel
async function fetchHomeData() {
  try {
    const data = await window.electronAPI.fetchRemoteFile(`${VERCEL_BASE_URL}/Home.txt`);
    return data;
  } catch (error) {
    console.error('Error fetching Home.txt:', error);
    return null;
  }
}

// Function to fetch appIDs.txt from Vercel
async function fetchAppIDs() {
  try {
    const data = await window.electronAPI.fetchRemoteFile(`${VERCEL_BASE_URL}/appIDs.txt`);
    return data;
  } catch (error) {
    console.error('Error fetching appIDs.txt:', error);
    return null;
  }
}

// Make functions available globally
window.fetchHomeData = fetchHomeData;
window.fetchAppIDs = fetchAppIDs;
window.loadSteamAppList = loadSteamAppList;
window.getGameNameFromAppID = getGameNameFromAppID;

// Auto-load data when page loads
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Loading remote data...');

  // Load Steam app list cache first for instant name lookups
  await loadSteamAppList();

  // You can call these functions in your existing code
  // const homeData = await fetchHomeData();
  // const appIDs = await fetchAppIDs();

  console.log('Remote data loaded successfully');
});