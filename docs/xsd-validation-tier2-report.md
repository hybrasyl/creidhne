# Tier-2 round-trip report

A throwaway run with `describe.skip` flipped on the Tier-2 block of
[`xsdValidation.test.js`](../src/main/__tests__/xsdValidation.test.js).
The test does `parse(fixture) → serialize → validateHybrasylXml(output)`
and reports whether the regenerated XML passes the XSD.

**TL;DR:** 7 of 14 round-trip tests fail. **6 of those 7 fail with the
exact same xmllint error as the corresponding Tier-1 fixture-validity
test** — they're downstream of XSD drift, not serializer bugs. **The
remaining 1 was a real serializer regression** (serverconfigs reordered
`Motd` to the front) — **fixed in `chore/fix-serverconfig-motd-order`** (`13123e7`). With
that branch merged, all 7 Tier-2 failures are
mechanically downstream of upstream XSD drift; zero serializer
regressions remain.

The "14 real serializer regressions" wording in the existing test
comment overstates the actual cost; the real number was 1.

The investigative unskip+revert was a throwaway run with no code
commit beyond the fix above.

## Per-type comparison

| Type | Tier-1 error (fixture vs XSD) | Tier-2 error (serializer output vs XSD) | Verdict |
| --- | --- | --- | --- |
| items | `Vendor: Missing child Description` | `Vendor: Missing child Description` | downstream of drift — same error |
| npcs | `Npc: X / Y required` | `Npc: X / Y required` | downstream of drift — same error |
| localizations | `MonsterSpeak: not expected, expected NpcSpeak` | `MonsterSpeak: not expected, expected NpcSpeak` | downstream of drift — same error |
| elementtables | `Target: not expected` (after 9) | `Target: not expected` (after 9) | downstream of drift — same error |
| castables | `Descriptions: not expected. Expected Categories…` | `Descriptions: not expected. Expected Categories…` | downstream of drift — same error |
| spawngroups | `Flags: maxLength=3 exceeded by 4` | `Flags: maxLength=3 exceeded by 4` | downstream of drift — same error |
| serverconfigs | `WorldDataDir: not expected. Expected DataStore` | `WorldDataDir: not expected. Expected DataStore` *(after fix)* | **was real regression, now downstream of drift** — see "Fixed regression" below |

## Fixed regression

**serverconfigs — `Motd` reorders to the front.** *(Fixed in
`chore/fix-serverconfig-motd-order`, commit `13123e7`.)*

Before the fix, our serializer put `<Motd>` at position 1:

```xml
<ServerConfig>
  <Motd>WELCOME TO HYBRASYL...</Motd>
  <WorldDataDir>...</WorldDataDir>
  <Logging>...</Logging>
  <DataStore Host="127.0.0.1"/>
  ...
</ServerConfig>
```

Per the XSD ([ServerConfig.xsd:217-237](../xsd/src/XSD/ServerConfig.xsd#L217-L237))
the order is `Logging → DataStore → Network → ApiEndpoints → Access →
Boards → Time → Handlers → Motd → ...`. Both `Motd` and `WorldDataDir`
had been written to the root xml2js object before `Logging`, and
xml2js's Builder writes keys in insertion order, so `Motd` ended up at
position 1.

**Fix:** [`serializeServerConfigXml`](../src/main/serverConfigXml.js)
now writes elements in XSD-correct order:
`Logging → WorldDataDir (creidhne-ahead-of-XSD) → DataStore → Network
→ ApiEndpoints → Access → Boards → Time → Handlers → Motd → Plugins
→ ClientSettings → Constants → Formulas`.

After the fix, the serverconfigs round-trip output produces the same
`WorldDataDir: not expected` upstream-drift error as the Tier-1
fixture — so it joins the other 6 cases as "downstream of XSD drift,
not a serializer bug." This was the **only** Tier-2 failure that
introduced a new XSD error beyond what the input fixture already had.

## Why this matters for §12

The original concern (in
[`xsd-validation.md`](xsd-validation.md#why-we-dont-validate-xml-on-save-yet))
was that "14 real serializer regressions" plus 7 XSD drifts together
made XSD-on-save impractical. **The actual count is 1, not 14**, and
even that one is fixable in `serializeServerConfigXml` without waiting
on upstream.

If the upstream XSDs land their drift fixes (or we ship local patches
per the discarded Path 4 idea) AND we fix the Motd ordering in
`serializeServerConfigXml`, XSD-on-save becomes immediately viable —
the path-safety wiring from `chore/path-safety` already exposes the hook.
