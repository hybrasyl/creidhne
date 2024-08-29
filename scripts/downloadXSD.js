const axios = require('axios');
const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');

const downloadAndExtractLatestXSD = async () => {
  const repoOwner = 'hybrasyl'; // Replace with the repository owner
  const repoName = 'xml'; // Replace with the repository name
  const outputDir = path.join(__dirname, '..', 'xsd'); // Directory to place the XSD files
  const tempZipPath = path.join(outputDir, 'latest_xsd.zip');

  try {
    // Step 1: Get the latest release info from GitHub API
    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest`;
    console.log('Fetching the latest release info from:', apiUrl);

    const releaseResponse = await axios.get(apiUrl);
    const latestRelease = releaseResponse.data;
    const zipUrl = latestRelease.zipball_url; // This is the URL for the zip file

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
    const response = await axios({
      url: zipUrl,
      method: 'GET',
      responseType: 'stream',
    });

    // Save the zip file temporarily
    const writer = fs.createWriteStream(tempZipPath);
    response.data.pipe(writer);

    writer.on('finish', async () => {
      console.log('XSD zip file downloaded successfully. Extracting...');

      // Step 3: Extract the zip file to the xsd directory
      fs.createReadStream(tempZipPath)
        .pipe(unzipper.Parse())
        .on('entry', (entry) => {
          const fileName = entry.path.split('/').slice(1).join('/'); // Remove the first directory
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

          // Optionally, clean up the temporary zip file
          fs.unlinkSync(tempZipPath);
        });
    });

    writer.on('error', (error) => {
      console.error('Error writing the XSD file:', error);
    });
  } catch (error) {
    console.error('Error downloading or extracting the XSD file:', error);
  }
};

// Run the download and extract function
downloadAndExtractLatestXSD();
