const { app, BrowserWindow, ipcMain, Notification, shell } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, 'icon.png')
  });

  mainWindow.loadFile('index.html');

  // Open DevTools in development (optional)
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Handle fetch requests from renderer
ipcMain.handle('fetch-remote-file', async (event, url) => {
  try {
    const https = require('https');
    const iconv = require('iconv-lite');

    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        const chunks = [];

        res.on('data', (chunk) => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          // Concatenate all chunks into a single Buffer
          const buffer = Buffer.concat(chunks);

          // Try to detect encoding from Content-Type header
          const contentType = res.headers['content-type'] || '';
          let encoding = 'utf8';

          // Check if charset is specified in Content-Type
          const charsetMatch = contentType.match(/charset=([^;]+)/i);
          if (charsetMatch) {
            encoding = charsetMatch[1].trim().toLowerCase();
          }

          // online-fix.me typically uses windows-1251 for Russian content
          if (url.includes('online-fix.me') && encoding === 'utf8') {
            encoding = 'windows-1251';
          }

          // Decode with proper encoding
          let data;
          try {
            data = iconv.decode(buffer, encoding);
          } catch (e) {
            // Fallback to UTF-8 if decoding fails
            console.log('Failed to decode with', encoding, ', falling back to UTF-8');
            data = buffer.toString('utf8');
          }

          resolve(data);
        });
      }).on('error', (err) => {
        reject(err);
      });
    });
  } catch (error) {
    throw error;
  }
});

// Handle desktop notifications
ipcMain.handle('show-notification', async (event, { title, body }) => {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: title,
      body: body,
      icon: path.join(__dirname, 'icon.png')
    });
    notification.show();
    return true;
  }
  return false;
});

// Handle opening external URLs
ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return true;
  } catch (error) {
    console.error('Error opening external URL:', error);
    return false;
  }
});

// Handle window mode changes
ipcMain.on('set-window-mode', (event, mode) => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return;

  console.log('Setting window mode to:', mode);

  if (mode === 'fullscreen') {
    win.setFullScreen(true);
  } else if (mode === 'borderless') {
    win.setFullScreen(false);
    win.setMenuBarVisibility(false);
    win.setAutoHideMenuBar(true);
  } else { // window
    win.setFullScreen(false);
    win.setMenuBarVisibility(true);
    win.setAutoHideMenuBar(false);
  }
});

// Handle fullscreen toggle
ipcMain.on('set-fullscreen', (event, isFullscreen) => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    console.log('Setting fullscreen to:', isFullscreen);
    win.setFullScreen(isFullscreen);
  }
});

// Handle app restart
ipcMain.on('restart-app', () => {
  console.log('Restarting app...');
  app.relaunch();
  app.exit(0);
});

// Handle folder selection
ipcMain.handle('select-folder', async (event) => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select folder to extract fix'
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0];
});

// Handle download and extract fix
ipcMain.handle('download-extract-fix', async (event, url, targetFolder, appID, fileName) => {
  const fs = require('fs');
  const https = require('https');
  const extract = require('extract-zip');
  const { execFile } = require('child_process');
  const { promisify } = require('util');
  const execFileAsync = promisify(execFile);
  const os = require('os');

  try {
    console.log('Starting download and extract process...');
    console.log('URL:', url);
    console.log('Target folder:', targetFolder);
    console.log('AppID:', appID);

    // Create temp directory for download
    const tempDir = path.join(os.tmpdir(), `online-fix-${Date.now()}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempZipPath = path.join(tempDir, fileName);
    console.log('Temp zip path:', tempZipPath);

    // Download the file
    await new Promise((resolve, reject) => {
      const file = fs.createWriteStream(tempZipPath);

      https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          console.log('Download complete');
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(tempZipPath, () => {});
        reject(err);
      });
    });

    // Extract the zip - try multiple methods
    console.log('Extracting zip...');
    const extractTempPath = path.join(tempDir, 'extracted');
    if (!fs.existsSync(extractTempPath)) {
      fs.mkdirSync(extractTempPath, { recursive: true });
    }

    let extractionSuccess = false;
    let lastError = null;

    // Method 1: Try extract-zip (Node.js library)
    try {
      console.log('Trying extract-zip...');
      await extract(tempZipPath, { dir: extractTempPath });
      console.log('✓ extract-zip succeeded');
      extractionSuccess = true;
    } catch (error) {
      console.log('✗ extract-zip failed:', error.message);
      lastError = error;
    }

    // Method 2: Try 7-Zip if extract-zip failed
    if (!extractionSuccess) {
      const sevenZipPaths = [
        'C:\\Program Files\\7-Zip\\7z.exe',
        'C:\\Program Files (x86)\\7-Zip\\7z.exe',
        path.join(process.env.ProgramFiles || 'C:\\Program Files', '7-Zip', '7z.exe'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', '7-Zip', '7z.exe')
      ];

      for (const sevenZipPath of sevenZipPaths) {
        if (fs.existsSync(sevenZipPath)) {
          try {
            console.log('Trying 7-Zip at:', sevenZipPath);
            await execFileAsync(sevenZipPath, ['x', tempZipPath, `-o${extractTempPath}`, '-y']);
            console.log('✓ 7-Zip succeeded');
            extractionSuccess = true;
            break;
          } catch (error) {
            console.log('✗ 7-Zip failed:', error.message);
            lastError = error;
          }
        }
      }
    }

    // Method 3: Try WinRAR if both previous methods failed
    if (!extractionSuccess) {
      const winrarPaths = [
        'C:\\Program Files\\WinRAR\\WinRAR.exe',
        'C:\\Program Files (x86)\\WinRAR\\WinRAR.exe',
        path.join(process.env.ProgramFiles || 'C:\\Program Files', 'WinRAR', 'WinRAR.exe'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'WinRAR', 'WinRAR.exe')
      ];

      for (const winrarPath of winrarPaths) {
        if (fs.existsSync(winrarPath)) {
          try {
            console.log('Trying WinRAR at:', winrarPath);
            await execFileAsync(winrarPath, ['x', '-y', tempZipPath, extractTempPath]);
            console.log('✓ WinRAR succeeded');
            extractionSuccess = true;
            break;
          } catch (error) {
            console.log('✗ WinRAR failed:', error.message);
            lastError = error;
          }
        }
      }
    }

    if (!extractionSuccess) {
      throw new Error(`All extraction methods failed. Last error: ${lastError?.message || 'Unknown error'}. Please install 7-Zip or WinRAR.`);
    }

    console.log('Extraction complete to:', extractTempPath);

    // Find the appID folder
    const appIDFolder = path.join(extractTempPath, appID);
    let sourceFolder = extractTempPath;

    if (fs.existsSync(appIDFolder) && fs.statSync(appIDFolder).isDirectory()) {
      console.log('Found appID folder:', appIDFolder);
      sourceFolder = appIDFolder;
    } else {
      // Look for any folder that might be the appID folder
      const contents = fs.readdirSync(extractTempPath);
      const possibleFolder = contents.find(item => {
        const itemPath = path.join(extractTempPath, item);
        return fs.statSync(itemPath).isDirectory() && item.includes(appID);
      });

      if (possibleFolder) {
        console.log('Found possible appID folder:', possibleFolder);
        sourceFolder = path.join(extractTempPath, possibleFolder);
      } else {
        console.log('No appID folder found, using root of extraction');
      }
    }

    // Copy all contents from sourceFolder to targetFolder
    console.log('Copying files from', sourceFolder, 'to', targetFolder);
    const copyRecursive = (src, dest) => {
      const entries = fs.readdirSync(src, { withFileTypes: true });

      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
          if (!fs.existsSync(destPath)) {
            fs.mkdirSync(destPath, { recursive: true });
          }
          copyRecursive(srcPath, destPath);
        } else {
          // Copy file, replacing if exists
          fs.copyFileSync(srcPath, destPath);
        }
      }
    };

    copyRecursive(sourceFolder, targetFolder);
    console.log('Files copied successfully');

    // Clean up temp files
    console.log('Cleaning up temp files...');
    const deleteFolderRecursive = (folderPath) => {
      if (fs.existsSync(folderPath)) {
        fs.readdirSync(folderPath).forEach((file) => {
          const curPath = path.join(folderPath, file);
          if (fs.lstatSync(curPath).isDirectory()) {
            deleteFolderRecursive(curPath);
          } else {
            fs.unlinkSync(curPath);
          }
        });
        fs.rmdirSync(folderPath);
      }
    };

    deleteFolderRecursive(tempDir);
    console.log('Cleanup complete');

    return { success: true, message: 'Fix extracted successfully!' };
  } catch (error) {
    console.error('Error in download-extract-fix:', error);
    return { success: false, error: error.message };
  }
});

// Handle reading local README.md file
ipcMain.handle('read-readme', async () => {
  const fs = require('fs');
  try {
    const readmePath = path.join(__dirname, 'README.md');
    const content = fs.readFileSync(readmePath, 'utf8');
    return content;
  } catch (error) {
    console.error('Error reading README.md:', error);
    // Fallback content
    return `# Welcome to OnlineFix Store

Your one-stop destination for game fixes and updates.

**All credits go to [online-fix.me](https://online-fix.me) and their team!**`;
  }
});

// Handle bypass downloads
ipcMain.handle('download-bypass', async (event, url, fileName) => {
  const fs = require('fs');
  const https = require('https');
  const { dialog } = require('electron');

  try {
    console.log('Downloading bypass from:', url);

    // Ask user where to save
    const result = await dialog.showSaveDialog({
      title: 'Save Bypass',
      defaultPath: fileName,
      filters: [{ name: 'ZIP Files', extensions: ['zip'] }]
    });

    if (result.canceled) {
      return { success: false, message: 'Download cancelled' };
    }

    const savePath = result.filePath;
    console.log('Saving to:', savePath);

    // Download the file
    await new Promise((resolve, reject) => {
      const file = fs.createWriteStream(savePath);

      https.get(url, (response) => {
        // Follow redirects
        if (response.statusCode === 302 || response.statusCode === 301) {
          const redirectUrl = response.headers.location;
          console.log('Following redirect to:', redirectUrl);
          https.get(redirectUrl, (redirectResponse) => {
            redirectResponse.pipe(file);
            file.on('finish', () => {
              file.close();
              console.log('Download complete');
              resolve();
            });
          }).on('error', (err) => {
            fs.unlink(savePath, () => {});
            reject(err);
          });
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log('Download complete');
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(savePath, () => {});
        reject(err);
      });
    });

    // Show notification
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: 'Download Complete',
        body: `${fileName} has been downloaded successfully!`,
        icon: path.join(__dirname, 'icon.png')
      });
      notification.show();
    }

    return { success: true, message: 'Bypass downloaded successfully!', path: savePath };
  } catch (error) {
    console.error('Error downloading bypass:', error);
    return { success: false, error: error.message };
  }
});