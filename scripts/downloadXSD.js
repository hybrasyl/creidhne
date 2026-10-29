const fs = require('fs')
const path = require('path')
const { Readable } = require('stream')
const unzipper = require('unzipper')
const { XSD_REF, REF_FILE } = require('./xsdRef.cjs')

// Download the hybrasyl/xml commit that scripts/xsdRef.cjs pins, and extract
// it into xsd/ (HTOO-615). The ref goes into xsd/ last, so a download that
// fails part way leaves no ref and the XSD tests say to fetch again.
const downloadAndExtractXSD = async () => {
  const outputDir = path.join(__dirname, '..', 'xsd')
  const tempZipPath = path.join(outputDir, 'xml.zip')
  const zipUrl = `https://api.github.com/repos/hybrasyl/xml/zipball/${XSD_REF}`

  // Ensure the xsd directory exists, then empty it
  fs.mkdirSync(outputDir, { recursive: true })
  for (const file of fs.readdirSync(outputDir)) {
    fs.rmSync(path.join(outputDir, file), { recursive: true, force: true })
  }

  console.log('Downloading hybrasyl/xml at', XSD_REF)
  const response = await fetch(zipUrl)
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${zipUrl}`)

  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(tempZipPath)
    Readable.fromWeb(response.body).pipe(writer)
    writer.on('finish', resolve)
    writer.on('error', reject)
  })

  console.log('Downloaded. Extracting...')

  // The parser closes when it has read the last entry, which can be before
  // the last file is on disk, so wait for each file's own stream too.
  const written = []
  await new Promise((resolve, reject) => {
    fs.createReadStream(tempZipPath)
      .pipe(unzipper.Parse())
      .on('entry', (entry) => {
        // Drop the archive's top folder (hybrasyl-xml-<sha>/).
        const fileName = entry.path.split('/').slice(1).join('/')
        const filePath = path.join(outputDir, fileName)

        if (entry.type === 'Directory') {
          fs.mkdirSync(filePath, { recursive: true })
          entry.autodrain()
        } else {
          fs.mkdirSync(path.dirname(filePath), { recursive: true })
          const out = fs.createWriteStream(filePath)
          written.push(
            new Promise((res, rej) => {
              out.on('finish', res)
              out.on('error', rej)
            })
          )
          entry.pipe(out)
        }
      })
      .on('close', resolve)
      .on('error', reject)
  })
  await Promise.all(written)
  fs.unlinkSync(tempZipPath)

  fs.writeFileSync(path.join(outputDir, REF_FILE), `${XSD_REF}\n`)
  console.log(`XSD files extracted. ${REF_FILE} is ${XSD_REF}.`)
}

// A failure must fail the step. The script used to log the error and exit 0,
// so a release job went on to test and package without the XSDs.
downloadAndExtractXSD().catch((error) => {
  console.error('Error downloading or extracting the XSD files:', error)
  process.exitCode = 1
})
