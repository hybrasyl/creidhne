import xml2js from 'xml2js'

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02'

const first = (arr, def = undefined) => (Array.isArray(arr) && arr.length ? arr[0] : def)
const a = (node, key, def = '') => node?.$?.[key] ?? def
const omitEmpty = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  )
// Read text content from a mixed-content node (e.g. <Map X="1" Y="2">Name</Map>)
const textOf = (nodeArr, def = '') => {
  const n = first(nodeArr)
  if (n === undefined || n === null) return def
  return typeof n === 'string' ? n : (n._ ?? def)
}

// Schema-ordered element names for Constants and Formulas.
// Only elements present in the data object will be written on save,
// so partial configs (e.g. only ClassName0-5) round-trip cleanly.
const CONSTANT_KEYS = [
  'MerchantBuybackPercentage',
  'PlayerMaxLevel',
  'ViewportSize',
  'PlayerMaxBookSize',
  'PlayerMaxDropDistance',
  'PlayerPickupDistance',
  'PlayerExchangeDistance',
  'PlayerMaxCastDistance',
  'PlayerMaxGold',
  'ItemVariantIdStart',
  'LogDefaultLevels',
  'PlayerGroupSharingDistance',
  'PlayerAsyncDialogDistance',
  'LagMap',
  'NationalSpawnTimeout',
  'DeathpileGroupTimeout',
  'DeathpileOtherTimeout',
  'MonsterLootDropTimeout',
  'MonsterTaggingTimeout',
  'ByteHeartbeatInterval',
  'TickHeartbeatInterval',
  'HeartbeatReaperInterval',
  'CheckpointInterval',
  'RegenInterval',
  'SnoreInterval',
  'IdleDetectionInterval',
  'MailboxCleanupInterval',
  'MerchantInventoryRefreshInterval',
  'PlayerIdleCheck',
  'DialogSequenceShared',
  'DialogSequencePursuits',
  'DialogSequenceAsync',
  'DialogSequenceHardcoded',
  'BoardMessageResponseSize',
  'BoardMessageCooldown',
  'MailMessageCooldown',
  'PlayerMinStat',
  'PlayerMaxStat',
  'PlayerMinBaseHpMp',
  'PlayerMaxBaseHpMp',
  'PlayerMinDmg',
  'PlayerMaxDmg',
  'PlayerMinHit',
  'PlayerMaxHit',
  'PlayerMinMr',
  'PlayerMaxMr',
  'PlayerMinAc',
  'PlayerMaxAc',
  'PlayerMinRegen',
  'PlayerMaxRegen',
  'ClassName0',
  'ClassName1',
  'ClassName2',
  'ClassName3',
  'ClassName4',
  'ClassName5',
  'LevelCircle1',
  'LevelCircle2',
  'LevelCircle3',
  'LevelCircle4'
]

const FORMULA_KEYS = [
  'XpToNextLevel',
  'HpGainPerLevel',
  'MpGainPerLevel',
  'AllowedCarryWeight',
  'AllowedEquipmentWeight',
  'MpRegenPerTick',
  'HpRegenPerTick',
  'AcDamageMitigation',
  'AcMagicDamageMitigation',
  'MonsterHpGainPerLevel',
  'MonsterMpGainPerLevel'
]

// =============================================================================
// PARSER
// =============================================================================

export function parseServerConfigXml(xmlString) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xmlString, { trim: true }, (err, result) => {
      if (err) return reject(err)
      try {
        resolve(mapXmlToServerConfig(result))
      } catch (e) {
        reject(e)
      }
    })
  })
}

function mapLogging(loggingArr) {
  const n = first(loggingArr)
  if (!n)
    return { singleStreamEnabled: false, jsonOutputEnabled: false, minimumLevel: 'Info', logs: [] }
  return {
    singleStreamEnabled: a(n, 'SingleStreamEnabled', 'false') === 'true',
    jsonOutputEnabled: a(n, 'JsonOutputEnabled', 'false') === 'true',
    minimumLevel: a(n, 'MinimumLevel', 'Info'),
    logs: (n.Log || []).map((l) => ({
      type: a(l, 'Type', ''),
      destination: a(l, 'Destination', ''),
      level: a(l, 'Level', '')
    }))
  }
}

function mapDataStore(dsArr) {
  const n = first(dsArr)
  if (!n)
    return {
      type: 'redis',
      host: 'localhost',
      port: '',
      database: '',
      username: '',
      password: '',
      hasCredentials: false
    }
  return {
    type: a(n, 'Type', 'redis'),
    host: a(n, 'Host', 'localhost'),
    port: a(n, 'Port', ''),
    database: a(n, 'Database', ''),
    username: textOf(n.Username),
    password: textOf(n.Password),
    // Track whether credential elements were explicitly present (even empty) so we round-trip them
    hasCredentials: n.Username !== undefined || n.Password !== undefined
  }
}

function mapNetworkInfo(nodeArr) {
  const n = first(nodeArr)
  if (!n) return null
  return {
    bindAddress: a(n, 'BindAddress', ''),
    externalAddress: a(n, 'ExternalAddress', ''),
    port: a(n, 'Port', '')
  }
}

function mapGrpc(nodeArr) {
  const n = first(nodeArr)
  if (!n) return null
  return {
    bindAddress: a(n, 'BindAddress', ''),
    // ExternalAddress appears on Grpc in staging.xml but is not in the schema — preserve it
    externalAddress: a(n, 'ExternalAddress', ''),
    port: a(n, 'Port', ''),
    chainCertFile: textOf(n.ChainCertificateFile),
    serverCertFile: textOf(n.ServerCertificateFile),
    serverKeyFile: textOf(n.ServerKeyFile)
  }
}

function mapApiEndpoints(epArr) {
  const n = first(epArr)
  if (!n)
    return {
      sentry: '',
      encryptionEndpoint: '',
      validationEndpoint: '',
      telemetryEndpoint: '',
      metricsEndpoint: null
    }
  const metrics = first(n.MetricsEndpoint)
  // Sentry is not in the schema but appears in qa.xml and staging.xml
  const sentry = first(n.Sentry)
  return {
    sentry: sentry ? a(sentry, 'Url', '') : '',
    encryptionEndpoint: a(first(n.EncryptionEndpoint), 'Url', ''),
    validationEndpoint: a(first(n.ValidationEndpoint), 'Url', ''),
    telemetryEndpoint: a(first(n.TelemetryEndpoint), 'Url', ''),
    metricsEndpoint: metrics
      ? { url: a(metrics, 'Url', ''), apiKey: a(metrics, 'ApiKey', '') }
      : null
  }
}

function mapAccess(accessArr) {
  const n = first(accessArr)
  if (!n) return { privileged: '', reserved: '' }
  return {
    privileged: textOf(n.Privileged),
    reserved: textOf(n.Reserved)
  }
}

function mapBoards(boardsArr) {
  const n = first(boardsArr)
  // Empty element <Boards/> parses as n = '' (falsy) — return [] to distinguish from absent (null)
  if (!n || !n.Board) return []
  return (n.Board || []).map((b) => {
    const al = first(b.AccessList)
    return {
      name: a(b, 'Name', ''),
      displayName: a(b, 'DisplayName', ''),
      accessList: {
        read: (al?.Read || []).map((r) => (typeof r === 'string' ? r : (r._ ?? ''))),
        write: (al?.Write || []).map((w) => (typeof w === 'string' ? w : (w._ ?? ''))),
        moderate: (al?.Moderate || []).map((m) => (typeof m === 'string' ? m : (m._ ?? '')))
      }
    }
  })
}

function mapTime(timeArr) {
  const n = first(timeArr)
  if (!n) return { ages: [], serverStart: { value: '', defaultAge: '', defaultYear: '' } }

  const agesNode = first(n.Ages)
  const ages = (agesNode?.Age || []).map((age) => ({
    name: a(age, 'Name', ''),
    startDate: a(age, 'StartDate', ''),
    endDate: a(age, 'EndDate', ''),
    startYear: a(age, 'StartYear', '')
  }))

  // ServerStart is a simpleContent dateTime — in practice always bare text, attributes rarely used
  const ssRaw = first(n.ServerStart)
  const serverStart = ssRaw
    ? {
        value: typeof ssRaw === 'string' ? ssRaw : (ssRaw._ ?? ''),
        defaultAge: typeof ssRaw === 'object' ? a(ssRaw, 'DefaultAge', '') : '',
        defaultYear: typeof ssRaw === 'object' ? a(ssRaw, 'DefaultYear', '') : ''
      }
    : { value: '', defaultAge: '', defaultYear: '' }

  return { ages, serverStart }
}

function mapDeath(deathArr) {
  const n = first(deathArr)
  if (!n) return null
  const mapNode = first(n.Map)
  const comaNode = first(n.Coma)
  const penaltyNode = first(n.Penalty)
  const legendNode = first(n.LegendMark)
  return {
    active: a(n, 'Active', 'true') === 'true',
    perishable: a(n, 'Perishable', 'true') === 'true',
    groupNotify: a(n, 'GroupNotify', 'true') === 'true',
    map: mapNode
      ? {
          x: a(mapNode, 'X', ''),
          y: a(mapNode, 'Y', ''),
          value: typeof mapNode === 'string' ? mapNode : (mapNode._ ?? '')
        }
      : { x: '', y: '', value: '' },
    coma: comaNode
      ? {
          timeout: a(comaNode, 'Timeout', '30'),
          effect: a(comaNode, 'Effect', '24'),
          value: typeof comaNode === 'string' ? comaNode : (comaNode._ ?? '')
        }
      : { timeout: '30', effect: '24', value: '' },
    penalty: penaltyNode
      ? { xp: a(penaltyNode, 'Xp', '0.05'), hp: a(penaltyNode, 'Hp', '0.05') }
      : { xp: '0.05', hp: '0.05' },
    legendMark: legendNode
      ? {
          prefix: a(legendNode, 'Prefix', 'deaths'),
          increment: a(legendNode, 'Increment', 'true') === 'true',
          value: typeof legendNode === 'string' ? legendNode : (legendNode._ ?? '')
        }
      : { prefix: 'deaths', increment: true, value: '' }
  }
}

function mapHandlers(handlersArr) {
  const n = first(handlersArr)
  if (!n) return { death: null, chat: null, newPlayer: null }

  const chatNode = first(n.Chat)
  const newPlayerNode = first(n.NewPlayer)
  const startMapsNode = newPlayerNode ? first(newPlayerNode.StartMaps) : null

  return {
    death: mapDeath(n.Death),
    chat:
      n.Chat !== undefined
        ? {
            commandsEnabled: a(chatNode, 'CommandsEnabled', 'true') === 'true',
            commandPrefix: a(chatNode, 'CommandPrefix', '/')
          }
        : null,
    newPlayer: newPlayerNode
      ? {
          startMaps: (startMapsNode?.StartMap || []).map((sm) => ({
            x: a(sm, 'X', ''),
            y: a(sm, 'Y', ''),
            value: typeof sm === 'string' ? sm : (sm._ ?? '')
          }))
        }
      : null
  }
}

function mapPlugins(pluginsArr) {
  const n = first(pluginsArr)
  if (!n) return { message: [] }
  const msgNode = first(n.Message)
  return {
    message: (msgNode?.Plugin || []).map((p) => {
      const cfgNode = first(p.Configuration)
      const tgtsNode = first(p.Targets)
      return {
        type: a(p, 'Type', ''),
        passthrough: a(p, 'Passthrough', 'false') === 'true',
        name: a(p, 'Name', ''),
        configuration: (cfgNode?.Config || []).map((c) => ({
          key: a(c, 'Key', ''),
          value: a(c, 'Value', '')
        })),
        targets: (tgtsNode?.Target || []).map((t) => (typeof t === 'string' ? t : (t._ ?? '')))
      }
    })
  }
}

function mapClientSettings(csArr) {
  const n = first(csArr)
  if (!n) return []
  return (n.Setting || []).map((s) => ({
    number: a(s, 'Number', ''),
    key: a(s, 'Key', ''),
    default: a(s, 'Default', 'false') === 'true',
    value: typeof s === 'string' ? s : (s._ ?? '')
  }))
}

function mapConstants(constsArr) {
  const n = first(constsArr)
  const result = {}
  if (!n) return result
  for (const key of CONSTANT_KEYS) {
    result[key] = textOf(n[key])
  }
  return result
}

function mapFormulas(formulasArr) {
  const n = first(formulasArr)
  const result = {}
  if (!n) return result
  for (const key of FORMULA_KEYS) {
    result[key] = textOf(n[key])
  }
  return result
}

function mapXmlToServerConfig(result) {
  const root = result.ServerConfig
  const networkNode = first(root.Network)

  return {
    name: a(root, 'Name', ''),
    locale: a(root, 'Locale', ''),
    environment: a(root, 'Environment', ''),
    elementTable: a(root, 'ElementTable', ''),
    motd: textOf(root.Motd),
    // WorldDataDir is not in the schema but present in several real configs — preserve it
    worldDataDir: textOf(root.WorldDataDir),
    logging: mapLogging(root.Logging),
    dataStore: mapDataStore(root.DataStore),
    network: {
      lobby: mapNetworkInfo(networkNode?.Lobby),
      login: mapNetworkInfo(networkNode?.Login),
      world: mapNetworkInfo(networkNode?.World),
      grpc: mapGrpc(networkNode?.Grpc)
    },
    apiEndpoints: mapApiEndpoints(root.ApiEndpoints),
    access: mapAccess(root.Access),
    // null = element absent; [] = <Boards/> present but empty
    boards: root.Boards !== undefined ? mapBoards(root.Boards) : null,
    time: mapTime(root.Time),
    handlers: mapHandlers(root.Handlers),
    plugins: mapPlugins(root.Plugins),
    clientSettings: mapClientSettings(root.ClientSettings),
    constants: mapConstants(root.Constants),
    formulas: mapFormulas(root.Formulas)
  }
}

// =============================================================================
// SERIALIZER
// =============================================================================

export function serializeServerConfigXml(cfg) {
  const builder = new xml2js.Builder({
    xmldec: { version: '1.0' },
    renderOpts: { pretty: true, indent: '  ', newline: '\n' }
  })
  return builder.buildObject(buildXmlObject(cfg)) + '\n'
}

function buildNetworkInfo(net) {
  if (!net || !net.port) return undefined
  return [
    {
      $: omitEmpty({
        BindAddress: net.bindAddress,
        ExternalAddress: net.externalAddress,
        Port: net.port
      })
    }
  ]
}

function buildGrpc(grpc) {
  if (!grpc || !grpc.port) return undefined
  const node = {
    $: omitEmpty({
      BindAddress: grpc.bindAddress,
      ExternalAddress: grpc.externalAddress,
      Port: grpc.port
    })
  }
  if (grpc.chainCertFile) node.ChainCertificateFile = [grpc.chainCertFile]
  if (grpc.serverCertFile) node.ServerCertificateFile = [grpc.serverCertFile]
  if (grpc.serverKeyFile) node.ServerKeyFile = [grpc.serverKeyFile]
  return [node]
}

function buildXmlObject(cfg) {
  const root = {
    $: omitEmpty({
      xmlns: XMLNS,
      Name: cfg.name,
      Locale: cfg.locale,
      Environment: cfg.environment,
      ElementTable: cfg.elementTable
    })
  }

  // Element order below follows the XSD's <xs:sequence> for ServerConfig:
  // Logging → [WorldDataDir, creidhne-ahead-of-XSD] → DataStore → Network →
  // ApiEndpoints → Access → Boards → Time → Handlers → Motd → Plugins →
  // ClientSettings → Constants → Formulas. xml2js's Builder writes keys in
  // insertion order, so the assignment order below IS the output order.

  // Logging
  if (cfg.logging?.logs?.length) {
    const loggingAttrs = omitEmpty({
      SingleStreamEnabled: cfg.logging.singleStreamEnabled ? 'true' : undefined,
      JsonOutputEnabled: cfg.logging.jsonOutputEnabled ? 'true' : undefined,
      MinimumLevel: cfg.logging.minimumLevel !== 'Info' ? cfg.logging.minimumLevel : undefined
    })
    const loggingNode = {
      Log: cfg.logging.logs.map((l) => ({
        $: { Type: l.type, Destination: l.destination, Level: l.level }
      }))
    }
    if (Object.keys(loggingAttrs).length) loggingNode.$ = loggingAttrs
    root.Logging = [loggingNode]
  }

  // WorldDataDir (creidhne-ahead-of-XSD; real fixtures place it between
  // Logging and DataStore — see test README "creidhne is ahead of the XSD").
  if (cfg.worldDataDir) root.WorldDataDir = [cfg.worldDataDir]

  // DataStore
  const ds = cfg.dataStore
  const dsAttrs = omitEmpty({
    Type: ds.type && ds.type !== 'redis' ? ds.type : undefined,
    Host: ds.host,
    Port: ds.port,
    Database: ds.database
  })
  const dsNode = { $: dsAttrs }
  if (ds.hasCredentials || ds.username || ds.password) {
    dsNode.Username = [ds.username || '']
    dsNode.Password = [ds.password || '']
  }
  root.DataStore = [dsNode]

  // Network
  const netNode = {}
  const lobby = buildNetworkInfo(cfg.network?.lobby)
  const login = buildNetworkInfo(cfg.network?.login)
  const world = buildNetworkInfo(cfg.network?.world)
  const grpc = buildGrpc(cfg.network?.grpc)
  if (lobby) netNode.Lobby = lobby
  if (login) netNode.Login = login
  if (world) netNode.World = world
  if (grpc) netNode.Grpc = grpc
  if (Object.keys(netNode).length) root.Network = [netNode]

  // ApiEndpoints — Sentry first to match existing file order
  const ep = cfg.apiEndpoints
  if (ep) {
    const epNode = {}
    if (ep.sentry) epNode.Sentry = [{ $: { Url: ep.sentry } }]
    if (ep.encryptionEndpoint) epNode.EncryptionEndpoint = [{ $: { Url: ep.encryptionEndpoint } }]
    if (ep.validationEndpoint) epNode.ValidationEndpoint = [{ $: { Url: ep.validationEndpoint } }]
    if (ep.telemetryEndpoint) epNode.TelemetryEndpoint = [{ $: { Url: ep.telemetryEndpoint } }]
    if (ep.metricsEndpoint)
      epNode.MetricsEndpoint = [
        { $: { Url: ep.metricsEndpoint.url, ApiKey: ep.metricsEndpoint.apiKey } }
      ]
    if (Object.keys(epNode).length) root.ApiEndpoints = [epNode]
  }

  // Access
  const acc = cfg.access
  if (acc?.privileged || acc?.reserved) {
    const accNode = {}
    if (acc.privileged) accNode.Privileged = [acc.privileged]
    if (acc.reserved) accNode.Reserved = [acc.reserved]
    root.Access = [accNode]
  }

  // Boards — null means element was absent; [] means <Boards/> (empty element present)
  if (cfg.boards !== null && cfg.boards !== undefined) {
    if (!cfg.boards.length) {
      root.Boards = [{}]
    } else {
      root.Boards = [
        {
          Board: cfg.boards.map((b) => {
            const boardNode = { $: { Name: b.name, DisplayName: b.displayName } }
            const al = b.accessList
            if (al && (al.read?.length || al.write?.length || al.moderate?.length)) {
              const alNode = {}
              if (al.read?.length) alNode.Read = al.read
              if (al.write?.length) alNode.Write = al.write
              if (al.moderate?.length) alNode.Moderate = al.moderate
              boardNode.AccessList = [alNode]
            }
            return boardNode
          })
        }
      ]
    }
  }

  // Time
  const time = cfg.time
  if (time) {
    const timeNode = {}
    if (time.ages?.length) {
      timeNode.Ages = [
        {
          Age: time.ages.map((age) => ({
            $: omitEmpty({
              Name: age.name,
              StartDate: age.startDate,
              EndDate: age.endDate,
              StartYear: age.startYear
            })
          }))
        }
      ]
    }
    if (time.serverStart?.value) {
      const ss = time.serverStart
      const ssAttrs = omitEmpty({ DefaultAge: ss.defaultAge, DefaultYear: ss.defaultYear })
      timeNode.ServerStart = Object.keys(ssAttrs).length
        ? [{ _: ss.value, $: ssAttrs }]
        : [ss.value]
    }
    if (Object.keys(timeNode).length) root.Time = [timeNode]
  }

  // Handlers
  const handlers = cfg.handlers
  if (handlers) {
    const hNode = {}
    if (handlers.death) {
      const d = handlers.death
      const dNode = {
        $: omitEmpty({
          Active: d.active === false ? 'false' : undefined,
          Perishable: d.perishable === false ? 'false' : undefined,
          GroupNotify: d.groupNotify === false ? 'false' : undefined
        })
      }
      if (d.map?.value) dNode.Map = [{ _: d.map.value, $: omitEmpty({ X: d.map.x, Y: d.map.y }) }]
      if (d.coma?.value)
        dNode.Coma = [
          { _: d.coma.value, $: omitEmpty({ Timeout: d.coma.timeout, Effect: d.coma.effect }) }
        ]
      dNode.Penalty = [{ $: omitEmpty({ Xp: d.penalty.xp, Hp: d.penalty.hp }) }]
      if (d.legendMark?.value) {
        dNode.LegendMark = [
          {
            _: d.legendMark.value,
            $: omitEmpty({
              Prefix: d.legendMark.prefix !== 'deaths' ? d.legendMark.prefix : undefined,
              Increment: d.legendMark.increment === false ? 'false' : 'true'
            })
          }
        ]
      }
      hNode.Death = [dNode]
    }
    if (handlers.chat) {
      hNode.Chat = [
        {
          $: omitEmpty({
            CommandsEnabled: handlers.chat.commandsEnabled === false ? 'false' : undefined,
            CommandPrefix:
              handlers.chat.commandPrefix !== '/' ? handlers.chat.commandPrefix : undefined
          })
        }
      ]
    }
    if (handlers.newPlayer) {
      hNode.NewPlayer = [
        {
          StartMaps: [
            {
              StartMap: handlers.newPlayer.startMaps.map((sm) => ({
                _: sm.value,
                $: omitEmpty({ X: sm.x, Y: sm.y })
              }))
            }
          ]
        }
      ]
    }
    if (Object.keys(hNode).length) root.Handlers = [hNode]
  }

  // Motd (per XSD sequence, sits between Handlers and Plugins)
  if (cfg.motd) root.Motd = [cfg.motd]

  // Plugins
  if (cfg.plugins?.message?.length) {
    root.Plugins = [
      {
        Message: [
          {
            Plugin: cfg.plugins.message.map((p) => {
              const pNode = {
                $: { Type: p.type, Passthrough: p.passthrough ? 'true' : 'false', Name: p.name }
              }
              if (p.configuration?.length) {
                pNode.Configuration = [
                  { Config: p.configuration.map((c) => ({ $: { Key: c.key, Value: c.value } })) }
                ]
              }
              if (p.targets?.length) {
                pNode.Targets = [{ Target: p.targets }]
              }
              return pNode
            })
          }
        ]
      }
    ]
  }

  // ClientSettings
  if (cfg.clientSettings?.length) {
    root.ClientSettings = [
      {
        Setting: cfg.clientSettings.map((s) => ({
          _: s.value,
          $: omitEmpty({ Number: s.number, Key: s.key, Default: s.default ? 'true' : undefined })
        }))
      }
    ]
  }

  // Constants — only write keys that have a value (preserves partial configs)
  const constants = cfg.constants
  if (constants && Object.values(constants).some(Boolean)) {
    const constsNode = {}
    for (const key of CONSTANT_KEYS) {
      if (constants[key]) constsNode[key] = [constants[key]]
    }
    root.Constants = [constsNode]
  }

  // Formulas — only write keys that have a value
  const formulas = cfg.formulas
  if (formulas && Object.values(formulas).some(Boolean)) {
    const formulasNode = {}
    for (const key of FORMULA_KEYS) {
      if (formulas[key]) formulasNode[key] = [formulas[key]]
    }
    root.Formulas = [formulasNode]
  }

  return { ServerConfig: root }
}
