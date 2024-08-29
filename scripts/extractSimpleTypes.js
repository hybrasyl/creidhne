const fs = require('fs-extra');
const path = require('path');
const xml2js = require('xml2js');

// Define paths
const xsdPath = path.join(__dirname, '..', 'xsd', 'src', 'xsd');
const outputJsonPath = path.join(__dirname, '..', 'src', 'renderer', 'src', 'assets', 'json', 'simpleTypes.json');

// Files to ignore
const ignoreFiles = ['Map.xsd', 'Hybrasyl.xsd', 'ServerConfig.xsd', 'Hybrasyl.Designer.cs'];

const specialHandling = {
  "BoardType": {
    "Type": "comboBox",
    "Options": ["Messageboard", "Sign"]
  },
  "VariantInteger": {
    "Type": "textField",
    "Notes": "0-255 only"
  },
  "VariantProperty": {
    "Type": "textField",
    "Pattern": "-{0,1}[0-9]*%{0,1}"
  }
};

const ignoredTypes = [
  "CharacterName",
  "CharacterNameList",
  "String5",
  "String8",
  "String16",
  "OddByte",
  "IpAddress",
  "MessageType"
];

// Helper function to recursively find enumerations
const findEnumerations = (node) => {
  let enumerations = [];
  if (node['xs:enumeration']) {
    enumerations = node['xs:enumeration'].map(enumVal => enumVal.$.value);
  }
  // Check if there is a nested simpleType
  if (node['xs:simpleType']) {
    node['xs:simpleType'].forEach(childNode => {
      enumerations = enumerations.concat(findEnumerations(childNode));
    });
  }
  return enumerations;
};

// Updated function to process deeply nested enumerations
const findDeepEnumerations = (node) => {
  if (node['xs:restriction'] && node['xs:restriction'][0].$?.base === 'xs:token') {
    return node['xs:restriction'][0]['xs:enumeration']?.map(enumVal => enumVal.$.value) || [];
  }

  // Traverse through xs:simpleType -> xs:list -> xs:simpleType -> xs:restriction
  if (node['xs:simpleType']) {
    for (const childNode of node['xs:simpleType']) {
      if (childNode['xs:list']) {
        const listChildNode = childNode['xs:list'][0];
        if (listChildNode['xs:simpleType']) {
          const innerSimpleType = listChildNode['xs:simpleType'][0];
          if (innerSimpleType['xs:restriction']) {
            return findDeepEnumerations(innerSimpleType);
          }
        }
      }
    }
  }

  return [];
};

// Function to process XSD and generate JSON
const processXSD = async () => {
  try {
    const files = await fs.readdir(xsdPath);
    const simpleTypes = {};
    const skippedImport = [];
    const ignoredImports = [];

    // Adding the ignored types to IgnoredImports directly
    ignoredImports.push(...ignoredTypes);

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

            if (!typeName || ignoredTypes.includes(typeName)) return;  // Skip if no name or is ignored

            console.log(`Processing simpleType: ${typeName}`);

            if (specialHandling[typeName]) {
              simpleTypes[typeName] = specialHandling[typeName];
              return;
            }

            const restriction = simpleType['xs:restriction']?.[0];
            const listElement = restriction?.['xs:simpleType']?.[0]?.['xs:list']?.[0];
            const simpleTypeListElement = simpleType['xs:list']?.[0];

            // 2) Handle xs:restriction base="xs:token"
            if (restriction && restriction.$?.base === 'xs:token') {
              const enumerationValues = findEnumerations(restriction);
              if (enumerationValues.length > 0) {
                simpleTypes[typeName] = {
                  "Type": "comboBox",
                  "Options": enumerationValues
                };
              }
            }
            // 3) Handle restriction without base and embedded simpleType with list
            else if (restriction && listElement) {
              const enumerations = findDeepEnumerations(restriction);
              const maxLength = restriction['xs:maxLength']?.[0]?.$.value ? parseInt(restriction['xs:maxLength'][0].$.value, 10) : undefined;
              simpleTypes[typeName] = {
                "Type": "ltdMultiSelect",
                "Options": enumerations
              };
              if (maxLength) {
                simpleTypes[typeName].maxItems = maxLength;
              }
            }
            // 4) Handle list without restriction
            else if (simpleTypeListElement) {
              const itemType = simpleTypeListElement.$?.itemType?.split(':')[1]; // Remove "hyb:" from itemType
              simpleTypes[typeName] = {
                "Type": "unrMultiSelect",
                "Options": itemType
              };
            }
            // 5) Handle restriction with base="xs:string"
            else if (restriction && restriction.$?.base === 'xs:string') {
              const maxLength = restriction['xs:maxLength']?.[0]?.$.value ? parseInt(restriction['xs:maxLength'][0].$.value, 10) : undefined;
              simpleTypes[typeName] = {
                "Type": "textField"
              };
              if (maxLength) {
                simpleTypes[typeName].maxItems = maxLength;
              }
            }
            // If nothing matched, add to skippedImport
            else {
              skippedImport.push(typeName);
            }
          });
        } else {
          console.error(`No simpleType elements found in ${file}`);
        }
      }
    }

    // Add SkippedImport and IgnoredImports to the final JSON
    simpleTypes.SkippedImport = { "Types": skippedImport };
    simpleTypes.IgnoredImports = { "Types": ignoredImports };

    // Write the simple types to a JSON file
    await fs.writeJson(outputJsonPath, simpleTypes, { spaces: 2 });
    console.log(`Simple types processed and saved to ${outputJsonPath}`);
  } catch (error) {
    console.error('Error processing XSD:', error);
  }
};

// Run the processing function
processXSD();
