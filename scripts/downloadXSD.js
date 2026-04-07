const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const unzipper = require('unzipper');

const downloadAndExtractLatestXSD = async () => {
  const repoOwner = 'hybrasyl';
  const repoName = 'xml';
  const outputDir = path.join(__dirname, '..', 'xsd');
  const tempZipPath = path.join(outputDir, 'latest_xsd.zip');

  try {
    // Step 1: Get the latest release info from GitHub API
    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest`;
    console.log('Fetching the latest release info from:', apiUrl);

    const releaseResponse = await fetch(apiUrl);
    const latestRelease = await releaseResponse.json();
    const zipUrl = latestRelease.zipball_url;

    console.log('Latest release zip URL:', zipUrl);

    // Ensure the xsd directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Clean up the output directory before extracting new files
    fs.readdirSync(outputDir).forEach((file) => {
      const filePath = path.join(outputDir, file);
      if (fs.lstatSync(filePath).isDirectory()) {
        fs.rmdirSync(filePath, { recursive: true });
      } else {
        fs.unlinkSync(filePath);
      }
    });

    // Step 2: Download the latest release zip file
    console.log('Downloading the latest XSD zip file...');
    const response = await fetch(zipUrl);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);

    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(tempZipPath);
      Readable.fromWeb(response.body).pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    console.log('XSD zip file downloaded successfully. Extracting...');

    // Step 3: Extract the zip file to the xsd directory
    await new Promise((resolve, reject) => {
      fs.createReadStream(tempZipPath)
        .pipe(unzipper.Parse())
        .on('entry', (entry) => {
          const fileName = entry.path.split('/').slice(1).join('/');
          const filePath = path.join(outputDir, fileName);

          if (entry.type === 'Directory') {
            if (!fs.existsSync(filePath)) {
              fs.mkdirSync(filePath, { recursive: true });
            }
            entry.autodrain();
          } else {
            entry.pipe(fs.createWriteStream(filePath));
          }
        })
        .on('close', () => {
          console.log('XSD files extracted successfully.');
          fs.unlinkSync(tempZipPath);
          resolve();
        })
        .on('error', reject);
    });
  } catch (error) {
    console.error('Error downloading or extracting the XSD file:', error);
  }
};

downloadAndExtractLatestXSD();
