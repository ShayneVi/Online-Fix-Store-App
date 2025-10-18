// This file handles fetching remote files from Vercel
const VERCEL_BASE_URL = 'https://online-fix-store.vercel.app';

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

// Auto-load data when page loads
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Loading remote data...');
  
  // You can call these functions in your existing code
  // const homeData = await fetchHomeData();
  // const appIDs = await fetchAppIDs();
  
  console.log('Remote data loaded successfully');
});