const fs = require('fs-extra');
const path = require('path');
const xml2js = require('xml2js');

// Define paths
const xsdPath = path.join(__dirname, '..', 'xsd', 'src', 'xsd');
const outputJsonPath = path.join(__dirname, '..', 'src', 'renderer', 'src', 'assets', 'json', 'simpleTypes.json');

// Files to ignore
const ignoreFiles = ['maps.xsd', 'hybrasyl.xsd', 'serverconfig.xsd', 'hybrasyl.designer.cs'];

// Function to extract and log simple types
const extractSimpleTypes = async () => {
  try {
    const files = await fs.readdir(xsdPath);
    const simpleTypes = {};

    for (const file of files) {
      if (file.endsWith('.xsd') && !ignoreFiles.includes(file)) {
        const filePath = path.join(xsdPath, file);
        const data = await fs.readFile(filePath, 'utf-8');
        const parsedData = await xml2js.parseStringPromise(data);

        // Extract all xs:simpleType elements
        const simpleTypeElements = parsedData['xs:schema']['xs:simpleType'];

        if (simpleTypeElements) {
          simpleTypeElements.forEach(simpleType => {
            const typeName = simpleType.$?.name;

            if (!typeName) return;  // Skip if there's no type name

            console.log(`Found simpleType: ${typeName}`);
            simpleTypes[typeName] = { type: 'unknown' };
          });
        } else {
          console.error(`No simpleType elements found in ${file}`);
        }
      }
    }

    // Write the simple types to a JSON file (for logging purposes)
    await fs.writeJson(outputJsonPath, simpleTypes, { spaces: 2 });
    console.log(`Simple types extracted and saved to ${outputJsonPath}`);
  } catch (error) {
    console.error('Error extracting simple types:', error);
  }
};

// Run the extraction
extractSimpleTypes();
