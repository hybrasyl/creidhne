import { describe, it, expect } from 'vitest'
import { parseServerConfigXml, serializeServerConfigXml } from '../serverConfigXml.js'
import xml2js from 'xml2js'

// ---------------------------------------------------------------------------
// Design notes
// ---------------------------------------------------------------------------
// - No XML comment annotation (no extractComment/injectComment).
// - boards: null = <Boards> element absent; boards: [] = <Boards/> empty element present.
// - Schema-ahead fields preserved but not in XSD: Sentry, ExternalAddress on Grpc, WorldDataDir.
// - DataStore hasCredentials flag: true when Username/Password elements were explicitly present
//   (even empty), ensuring they round-trip even when blank.
// - Constants/Formulas: only keys with a value are written; partial configs round-trip cleanly.
// - Network nodes (Lobby/Login/World/Grpc) are omitted from output when port is empty.
// - Logging is omitted from output when logs array is empty.

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FULL_XML = `<?xml version="1.0"?>
<ServerConfig xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02"
  Name="TestServer" Locale="en-US" Environment="qa" ElementTable="elements">
  <Motd>Welcome to the test server!</Motd>
  <WorldDataDir>/srv/world</WorldDataDir>
  <Logging SingleStreamEnabled="true" JsonOutputEnabled="false" MinimumLevel="Debug">
    <Log Type="Console" Destination="stdout" Level="Info" />
  </Logging>
  <DataStore Type="redis" Host="localhost" Port="6379" Database="0">
    <Username>admin</Username>
    <Password>secret</Password>
  </DataStore>
  <Network>
    <Lobby BindAddress="0.0.0.0" Port="2610" />
    <Login BindAddress="0.0.0.0" Port="2611" />
    <World BindAddress="0.0.0.0" Port="2612" />
    <Grpc BindAddress="0.0.0.0" Port="8443">
      <ChainCertificateFile>/etc/ssl/chain.pem</ChainCertificateFile>
    </Grpc>
  </Network>
  <ApiEndpoints>
    <EncryptionEndpoint Url="https://enc.example.com" />
    <ValidationEndpoint Url="https://val.example.com" />
    <TelemetryEndpoint Url="https://tel.example.com" />
    <MetricsEndpoint Url="https://met.example.com" ApiKey="abc123" />
  </ApiEndpoints>
  <Access>
    <Privileged>admin moderator</Privileged>
    <Reserved>admin</Reserved>
  </Access>
  <Boards>
    <Board Name="General" DisplayName="General Discussion">
      <AccessList>
        <Read>everyone</Read>
        <Write>members</Write>
        <Moderate>moderator</Moderate>
      </AccessList>
    </Board>
  </Boards>
  <Time>
    <Ages>
      <Age Name="Danaan" StartDate="1970-01-01" StartYear="1" />
    </Ages>
    <ServerStart DefaultAge="Danaan" DefaultYear="1">2024-01-01T00:00:00Z</ServerStart>
  </Time>
  <Handlers>
    <Death Active="true" Perishable="true" GroupNotify="false">
      <Map X="5" Y="10">Mileth Village</Map>
      <Coma Timeout="60" Effect="24">sick</Coma>
      <Penalty Xp="0.10" Hp="0.05" />
      <LegendMark Prefix="deaths" Increment="true">Died in battle</LegendMark>
    </Death>
    <Chat CommandsEnabled="true" CommandPrefix="/" />
    <NewPlayer>
      <StartMaps>
        <StartMap X="5" Y="10">Mileth Village</StartMap>
      </StartMaps>
    </NewPlayer>
  </Handlers>
  <Plugins>
    <Message>
      <Plugin Type="discord" Passthrough="false" Name="DiscordBot">
        <Configuration>
          <Config Key="channel" Value="#general" />
        </Configuration>
        <Targets>
          <Target>shout</Target>
        </Targets>
      </Plugin>
    </Message>
  </Plugins>
  <ClientSettings>
    <Setting Number="1" Key="AutoSort" Default="true">Sort inventory automatically</Setting>
  </ClientSettings>
  <Constants>
    <PlayerMaxLevel>99</PlayerMaxLevel>
    <ClassName0>Peasant</ClassName0>
  </Constants>
  <Formulas>
    <XpToNextLevel>level * 1000</XpToNextLevel>
  </Formulas>
</ServerConfig>`

const MINIMAL_XML = `<?xml version="1.0"?>
<ServerConfig xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02" Name="MinimalConfig">
  <DataStore Host="localhost" />
</ServerConfig>`

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function parseRaw(xmlString) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xmlString, { trim: true }, (err, result) => {
      if (err) reject(err)
      else resolve(result)
    })
  })
}

// ---------------------------------------------------------------------------
// Test 1: Parse round-trip
// ---------------------------------------------------------------------------

describe('Parse round-trip', () => {
  it('serializing a parsed server config and re-parsing yields the same object', async () => {
    const first = await parseServerConfigXml(FULL_XML)
    const xml = serializeServerConfigXml(first)
    const second = await parseServerConfigXml(xml)
    expect(second).toEqual(first)
  })
})

// ---------------------------------------------------------------------------
// Test 2: Field coverage — all fields
// ---------------------------------------------------------------------------

describe('Field coverage — all fields', () => {
  it('parses root attributes', async () => {
    const c = await parseServerConfigXml(FULL_XML)
    expect(c.name).toBe('TestServer')
    expect(c.locale).toBe('en-US')
    expect(c.environment).toBe('qa')
    expect(c.elementTable).toBe('elements')
  })

  it('parses motd text content', async () => {
    const c = await parseServerConfigXml(FULL_XML)
    expect(c.motd).toBe('Welcome to the test server!')
  })

  it('parses worldDataDir (schema-ahead field)', async () => {
    const c = await parseServerConfigXml(FULL_XML)
    expect(c.worldDataDir).toBe('/srv/world')
  })

  it('parses logging flags and minimumLevel', async () => {
    const c = await parseServerConfigXml(FULL_XML)
    expect(c.logging.singleStreamEnabled).toBe(true)
    expect(c.logging.jsonOutputEnabled).toBe(false)
    expect(c.logging.minimumLevel).toBe('Debug')
  })

  it('parses logging entries', async () => {
    const c = await parseServerConfigXml(FULL_XML)
    expect(c.logging.logs).toHaveLength(1)
    expect(c.logging.logs[0]).toEqual({ type: 'Console', destination: 'stdout', level: 'Info' })
  })

  it('parses dataStore attributes', async () => {
    const c = await parseServerConfigXml(FULL_XML)
    expect(c.dataStore.type).toBe('redis')
    expect(c.dataStore.host).toBe('localhost')
    expect(c.dataStore.port).toBe('6379')
    expect(c.dataStore.database).toBe('0')
  })

  it('parses dataStore credentials and sets hasCredentials', async () => {
    const c = await parseServerConfigXml(FULL_XML)
    expect(c.dataStore.username).toBe('admin')
    expect(c.dataStore.password).toBe('secret')
    expect(c.dataStore.hasCredentials).toBe(true)
  })

  it('parses network lobby', async () => {
    const c = await parseServerConfigXml(FULL_XML)
    expect(c.network.lobby).toEqual({ bindAddress: '0.0.0.0', externalAddress: '', port: '2610' })
  })

  it('parses network login and world', async () => {
    const c = await parseServerConfigXml(FULL_XML)
    expect(c.network.login?.port).toBe('2611')
    expect(c.network.world?.port).toBe('2612')
  })

  it('parses network grpc with cert file', async () => {
    const c = await parseServerConfigXml(FULL_XML)
    expect(c.network.grpc?.port).toBe('8443')
    expect(c.network.grpc?.chainCertFile).toBe('/etc/ssl/chain.pem')
  })

  it('parses apiEndpoints urls', async () => {
    const c = await parseServerConfigXml(FULL_XML)
    expect(c.apiEndpoints.encryptionEndpoint).toBe('https://enc.example.com')
    expect(c.apiEndpoints.validationEndpoint).toBe('https://val.example.com')
    expect(c.apiEndpoints.telemetryEndpoint).toBe('https://tel.example.com')
  })

  it('parses metricsEndpoint url and apiKey', async () => {
    const c = await parseServerConfigXml(FULL_XML)
    expect(c.apiEndpoints.metricsEndpoint).toEqual({ url: 'https://met.example.com', apiKey: 'abc123' })
  })

  it('parses access privileged and reserved', async () => {
    const c = await parseServerConfigXml(FULL_XML)
    expect(c.access.privileged).toBe('admin moderator')
    expect(c.access.reserved).toBe('admin')
  })

  it('parses boards with name and displayName', async () => {
    const c = await parseServerConfigXml(FULL_XML)
    expect(c.boards).toHaveLength(1)
    expect(c.boards[0].name).toBe('General')
    expect(c.boards[0].displayName).toBe('General Discussion')
  })

  it('parses board accessList', async () => {
    const c = await parseServerConfigXml(FULL_XML)
    const al = c.boards[0].accessList
    expect(al.read).toEqual(['everyone'])
    expect(al.write).toEqual(['members'])
    expect(al.moderate).toEqual(['moderator'])
  })

  it('parses time age', async () => {
    const c = await parseServerConfigXml(FULL_XML)
    expect(c.time.ages).toHaveLength(1)
    expect(c.time.ages[0]).toEqual({ name: 'Danaan', startDate: '1970-01-01', endDate: '', startYear: '1' })
  })

  it('parses serverStart value and attributes', async () => {
    const c = await parseServerConfigXml(FULL_XML)
    expect(c.time.serverStart.value).toBe('2024-01-01T00:00:00Z')
    expect(c.time.serverStart.defaultAge).toBe('Danaan')
    expect(c.time.serverStart.defaultYear).toBe('1')
  })

  it('parses death handler flags and sub-elements', async () => {
    const c = await parseServerConfigXml(FULL_XML)
    const d = c.handlers.death
    expect(d.active).toBe(true)
    expect(d.groupNotify).toBe(false)
    expect(d.map).toEqual({ x: '5', y: '10', value: 'Mileth Village' })
    expect(d.coma).toEqual({ timeout: '60', effect: '24', value: 'sick' })
    expect(d.penalty).toEqual({ xp: '0.10', hp: '0.05' })
    expect(d.legendMark).toEqual({ prefix: 'deaths', increment: true, value: 'Died in battle' })
  })

  it('parses chat handler', async () => {
    const c = await parseServerConfigXml(FULL_XML)
    expect(c.handlers.chat).toEqual({ commandsEnabled: true, commandPrefix: '/' })
  })

  it('parses newPlayer startMaps', async () => {
    const c = await parseServerConfigXml(FULL_XML)
    expect(c.handlers.newPlayer?.startMaps).toHaveLength(1)
    expect(c.handlers.newPlayer.startMaps[0]).toEqual({ x: '5', y: '10', value: 'Mileth Village' })
  })

  it('parses message plugin', async () => {
    const c = await parseServerConfigXml(FULL_XML)
    const p = c.plugins.message[0]
    expect(p.type).toBe('discord')
    expect(p.passthrough).toBe(false)
    expect(p.name).toBe('DiscordBot')
    expect(p.configuration).toEqual([{ key: 'channel', value: '#general' }])
    expect(p.targets).toEqual(['shout'])
  })

  it('parses client settings', async () => {
    const c = await parseServerConfigXml(FULL_XML)
    expect(c.clientSettings).toHaveLength(1)
    expect(c.clientSettings[0]).toEqual({ number: '1', key: 'AutoSort', default: true, value: 'Sort inventory automatically' })
  })

  it('parses constants by key', async () => {
    const c = await parseServerConfigXml(FULL_XML)
    expect(c.constants.PlayerMaxLevel).toBe('99')
    expect(c.constants.ClassName0).toBe('Peasant')
  })

  it('parses formulas by key', async () => {
    const c = await parseServerConfigXml(FULL_XML)
    expect(c.formulas.XpToNextLevel).toBe('level * 1000')
  })
})

// ---------------------------------------------------------------------------
// Test 3: Field coverage — minimal
// ---------------------------------------------------------------------------

describe('Field coverage — minimal', () => {
  it('parses name', async () => {
    const c = await parseServerConfigXml(MINIMAL_XML)
    expect(c.name).toBe('MinimalConfig')
  })

  it('defaults locale, environment, elementTable to empty string', async () => {
    const c = await parseServerConfigXml(MINIMAL_XML)
    expect(c.locale).toBe('')
    expect(c.environment).toBe('')
    expect(c.elementTable).toBe('')
  })

  it('defaults motd and worldDataDir to empty string', async () => {
    const c = await parseServerConfigXml(MINIMAL_XML)
    expect(c.motd).toBe('')
    expect(c.worldDataDir).toBe('')
  })

  it('defaults logging to empty logs and Info level', async () => {
    const c = await parseServerConfigXml(MINIMAL_XML)
    expect(c.logging.singleStreamEnabled).toBe(false)
    expect(c.logging.jsonOutputEnabled).toBe(false)
    expect(c.logging.minimumLevel).toBe('Info')
    expect(c.logging.logs).toEqual([])
  })

  it('defaults dataStore host to localhost and hasCredentials to false', async () => {
    const c = await parseServerConfigXml(MINIMAL_XML)
    expect(c.dataStore.host).toBe('localhost')
    expect(c.dataStore.hasCredentials).toBe(false)
  })

  it('defaults network nodes to null', async () => {
    const c = await parseServerConfigXml(MINIMAL_XML)
    expect(c.network.lobby).toBeNull()
    expect(c.network.login).toBeNull()
    expect(c.network.world).toBeNull()
    expect(c.network.grpc).toBeNull()
  })

  it('defaults apiEndpoints sentry and endpoints to empty string', async () => {
    const c = await parseServerConfigXml(MINIMAL_XML)
    expect(c.apiEndpoints.sentry).toBe('')
    expect(c.apiEndpoints.encryptionEndpoint).toBe('')
    expect(c.apiEndpoints.metricsEndpoint).toBeNull()
  })

  it('absent Boards element parses as null', async () => {
    // null distinguishes "element absent" from [] which means <Boards/> present but empty
    const c = await parseServerConfigXml(MINIMAL_XML)
    expect(c.boards).toBeNull()
  })

  it('defaults time to empty ages and blank serverStart', async () => {
    const c = await parseServerConfigXml(MINIMAL_XML)
    expect(c.time.ages).toEqual([])
    expect(c.time.serverStart).toEqual({ value: '', defaultAge: '', defaultYear: '' })
  })

  it('defaults handlers to null sub-nodes', async () => {
    const c = await parseServerConfigXml(MINIMAL_XML)
    expect(c.handlers.death).toBeNull()
    expect(c.handlers.chat).toBeNull()
    expect(c.handlers.newPlayer).toBeNull()
  })

  it('defaults plugins message to empty array', async () => {
    const c = await parseServerConfigXml(MINIMAL_XML)
    expect(c.plugins.message).toEqual([])
  })

  it('defaults clientSettings to empty array', async () => {
    const c = await parseServerConfigXml(MINIMAL_XML)
    expect(c.clientSettings).toEqual([])
  })

  it('defaults constants to empty object', async () => {
    const c = await parseServerConfigXml(MINIMAL_XML)
    expect(c.constants).toEqual({})
  })

  it('defaults formulas to empty object', async () => {
    const c = await parseServerConfigXml(MINIMAL_XML)
    expect(c.formulas).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// Test 4: Output structure
// Serialize a server config and re-parse it with xml2js to assert the output
// XML has the expected elements, attributes, and nesting. These are structural
// assertions written by hand from the code — they do NOT perform real XSD
// validation and will not catch divergences between creidhne and the XSD.
// ---------------------------------------------------------------------------

describe('Output structure', () => {
  const cfg = {
    name: 'OutServer',
    locale: 'en-US',
    environment: 'dev',
    elementTable: '',
    motd: 'Hello!',
    worldDataDir: '',
    logging: {
      singleStreamEnabled: true,
      jsonOutputEnabled: false,
      minimumLevel: 'Warn',
      logs: [{ type: 'File', destination: '/var/log/server.log', level: 'Warn' }],
    },
    dataStore: { type: 'redis', host: '127.0.0.1', port: '6379', database: '', username: '', password: '', hasCredentials: true },
    network: {
      lobby: { bindAddress: '', externalAddress: '', port: '2610' },
      login: null,
      world: null,
      grpc: null,
    },
    apiEndpoints: { sentry: '', encryptionEndpoint: 'https://enc.test', validationEndpoint: '', telemetryEndpoint: '', metricsEndpoint: null },
    access: { privileged: 'admin', reserved: '' },
    boards: [],
    time: { ages: [], serverStart: { value: '', defaultAge: '', defaultYear: '' } },
    handlers: { death: null, chat: { commandsEnabled: true, commandPrefix: '/' }, newPlayer: null },
    plugins: { message: [] },
    clientSettings: [],
    constants: { PlayerMaxLevel: '99', ClassName0: '' },
    formulas: { XpToNextLevel: 'level * 500' },
  }

  it('root element is ServerConfig', async () => {
    const parsed = await parseRaw(serializeServerConfigXml(cfg))
    expect(parsed).toHaveProperty('ServerConfig')
  })

  it('Name, Locale, Environment attributes are present', async () => {
    const parsed = await parseRaw(serializeServerConfigXml(cfg))
    const root = parsed.ServerConfig
    expect(root.$?.Name).toBe('OutServer')
    expect(root.$?.Locale).toBe('en-US')
    expect(root.$?.Environment).toBe('dev')
  })

  it('Motd element is present', async () => {
    const parsed = await parseRaw(serializeServerConfigXml(cfg))
    expect(parsed.ServerConfig.Motd?.[0]).toBe('Hello!')
  })

  it('Logging element is present when logs are non-empty', async () => {
    const parsed = await parseRaw(serializeServerConfigXml(cfg))
    expect(parsed.ServerConfig.Logging).toBeDefined()
    expect(parsed.ServerConfig.Logging?.[0]?.Log).toHaveLength(1)
  })

  it('Logging element is omitted when logs are empty', async () => {
    const noLogs = { ...cfg, logging: { ...cfg.logging, logs: [] } }
    const parsed = await parseRaw(serializeServerConfigXml(noLogs))
    expect(parsed.ServerConfig.Logging).toBeUndefined()
  })

  it('DataStore element is always present', async () => {
    const parsed = await parseRaw(serializeServerConfigXml(cfg))
    expect(parsed.ServerConfig.DataStore).toBeDefined()
  })

  it('DataStore Username and Password present when hasCredentials is true', async () => {
    const parsed = await parseRaw(serializeServerConfigXml(cfg))
    const ds = parsed.ServerConfig.DataStore?.[0]
    expect(ds?.Username).toBeDefined()
    expect(ds?.Password).toBeDefined()
  })

  it('Network/Lobby is present when port is set', async () => {
    const parsed = await parseRaw(serializeServerConfigXml(cfg))
    expect(parsed.ServerConfig.Network?.[0]?.Lobby?.[0].$?.Port).toBe('2610')
  })

  it('Network/Login is absent when null', async () => {
    const parsed = await parseRaw(serializeServerConfigXml(cfg))
    expect(parsed.ServerConfig.Network?.[0]?.Login).toBeUndefined()
  })

  it('ApiEndpoints/EncryptionEndpoint has Url attribute', async () => {
    const parsed = await parseRaw(serializeServerConfigXml(cfg))
    expect(parsed.ServerConfig.ApiEndpoints?.[0]?.EncryptionEndpoint?.[0]?.$?.Url).toBe('https://enc.test')
  })

  it('empty Boards element is present when boards is []', async () => {
    // boards: [] → <Boards/> present but empty; boards: null → element absent
    const parsed = await parseRaw(serializeServerConfigXml(cfg))
    expect(parsed.ServerConfig.Boards).toBeDefined()
  })

  it('Boards element is absent when boards is null', async () => {
    const noBoards = { ...cfg, boards: null }
    const parsed = await parseRaw(serializeServerConfigXml(noBoards))
    expect(parsed.ServerConfig.Boards).toBeUndefined()
  })

  it('Chat element omits CommandPrefix when it is the default "/"', async () => {
    const parsed = await parseRaw(serializeServerConfigXml(cfg))
    const chat = parsed.ServerConfig.Handlers?.[0]?.Chat?.[0]
    expect(chat?.$?.CommandPrefix).toBeUndefined()
  })

  it('Constants only writes keys with a value', async () => {
    const parsed = await parseRaw(serializeServerConfigXml(cfg))
    const consts = parsed.ServerConfig.Constants?.[0]
    expect(consts?.PlayerMaxLevel?.[0]).toBe('99')
    // ClassName0 was empty — should be absent
    expect(consts?.ClassName0).toBeUndefined()
  })

  it('Formulas/XpToNextLevel element is present', async () => {
    const parsed = await parseRaw(serializeServerConfigXml(cfg))
    expect(parsed.ServerConfig.Formulas?.[0]?.XpToNextLevel?.[0]).toBe('level * 500')
  })
})
