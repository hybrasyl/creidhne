import React from 'react'
import { Box, Typography, Chip, Stack } from '@mui/material'
import IconCanvas from '../shared/IconCanvas'
import { typeFromBook } from '../../data/iconData'

function Row({ label, children }) {
  if (children == null || children === '' || (Array.isArray(children) && children.length === 0))
    return null
  return (
    <Box sx={{ display: 'flex', gap: 1, py: 0.25 }}>
      <Typography
        variant="caption"
        sx={{
          minWidth: 100,
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          pt: 0.25
        }}
      >
        {label}
      </Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {typeof children === 'string' || typeof children === 'number' ? (
          <Typography variant="body2">{String(children)}</Typography>
        ) : (
          children
        )}
      </Box>
    </Box>
  )
}

function ChipList({ items }) {
  if (!items || items.length === 0) return null
  return (
    <Stack direction="row" spacing={0.5} useFlexGap sx={{
      flexWrap: "wrap"
    }}>
      {items.map((v) => (
        <Chip key={v} label={v} size="small" variant="outlined" />
      ))}
    </Stack>
  );
}

function SectionHeading({ children }) {
  return (
    <Typography
      variant="overline"
      sx={{ display: 'block', mt: 2, mb: 0.5, color: 'text.button', fontWeight: 'bold' }}
    >
      {children}
    </Typography>
  )
}

// ─── Castable ────────────────────────────────────────────────────────────────

export function CastableReferenceView({ data }) {
  if (!data) return null
  const classes = (data.class || '').split(' ').filter(Boolean)
  const categories = Array.isArray(data.categories) ? data.categories : []
  const descriptions = Array.isArray(data.descriptions) ? data.descriptions : []
  const iconType = typeFromBook(data.book)

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 1.5 }}>
        {data.icon ? <IconCanvas type={iconType} id={data.icon} size={48} /> : null}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" noWrap>
            {data.name}
          </Typography>
          <Typography variant="caption" sx={{
            color: "text.secondary"
          }}>
            {data.book || 'Unknown book'}
          </Typography>
        </Box>
      </Box>
      <Row label="Classes">
        <ChipList items={classes} />
      </Row>
      <Row label="Element">{data.elements}</Row>
      <Row label="Lines">{data.lines}</Row>
      <Row label="Cooldown">{data.cooldown ? `${data.cooldown} ms` : null}</Row>
      <Row label="Icon">{data.icon}</Row>
      {data.isAssail ? <Row label="Assail">Yes</Row> : null}
      {data.reflectable ? <Row label="Reflectable">Yes</Row> : null}
      <Row label="Categories">
        <ChipList items={categories} />
      </Row>
      {descriptions.length > 0 && (
        <>
          <SectionHeading>Descriptions</SectionHeading>
          {descriptions.map((d, i) => (
            <Box key={i} sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{
                color: "text.secondary"
              }}>
                {d.class || 'All'}
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {d.text}
              </Typography>
            </Box>
          ))}
        </>
      )}
      {data.script ? (
        <>
          <SectionHeading>Script</SectionHeading>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {data.script}
          </Typography>
        </>
      ) : null}
    </Box>
  );
}

// ─── Status ──────────────────────────────────────────────────────────────────

export function StatusReferenceView({ data }) {
  if (!data) return null
  const categories = Array.isArray(data.categories) ? data.categories : []
  const flags = []
  if (data.noOverwrite) flags.push('NoOverwrite')
  if (data.stackable) flags.push('Stackable')
  if (data.uniqueEffect) flags.push('UniqueEffect')

  return (
    <Box>
      <Typography variant="h6" gutterBottom noWrap>
        {data.name}
      </Typography>

      <Row label="Icon">{data.icon}</Row>
      <Row label="Duration">{data.duration ? `${data.duration} s` : null}</Row>
      <Row label="Tick">{data.tick ? `${data.tick} s` : null}</Row>
      <Row label="Categories">
        <ChipList items={categories} />
      </Row>
      <Row label="Flags">
        <ChipList items={flags} />
      </Row>

      {data.script ? (
        <>
          <SectionHeading>Script</SectionHeading>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {data.script}
          </Typography>
        </>
      ) : null}
    </Box>
  )
}

// ─── Item ────────────────────────────────────────────────────────────────────

export function ItemReferenceView({ data }) {
  if (!data) return null
  const props = data.properties || {}
  const appearance = props.appearance || {}
  const equipment = props.equipment || {}
  const vendor = props.vendor || {}
  const categories = props.categories || []
  const flags = props.flags || []

  return (
    <Box>
      <Typography variant="h6" gutterBottom noWrap>
        {data.name}
      </Typography>
      {data.unidentifiedName && data.unidentifiedName !== data.name && (
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            display: 'block',
            mb: 1
          }}>
          Unidentified: {data.unidentifiedName}
        </Typography>
      )}
      <SectionHeading>Appearance</SectionHeading>
      <Row label="Sprite">{appearance.sprite}</Row>
      <Row label="Display">{appearance.displaySprite}</Row>
      <Row label="Color">{appearance.color}</Row>
      <Row label="Body">{appearance.bodyStyle}</Row>
      {(equipment.slot || equipment.weaponType) && (
        <>
          <SectionHeading>Equipment</SectionHeading>
          <Row label="Slot">{equipment.slot}</Row>
          <Row label="Weapon">{equipment.weaponType}</Row>
        </>
      )}
      {vendor.shopTab && (
        <>
          <SectionHeading>Vendor</SectionHeading>
          <Row label="Shop tab">{vendor.shopTab}</Row>
        </>
      )}
      <SectionHeading>Tags</SectionHeading>
      <Row label="Categories">
        <ChipList items={categories} />
      </Row>
      <Row label="Flags">
        <ChipList items={flags} />
      </Row>
    </Box>
  );
}

// ─── Creature ────────────────────────────────────────────────────────────────

export function CreatureReferenceView({ data }) {
  if (!data) return null
  const loot = Array.isArray(data.loot) ? data.loot : []

  return (
    <Box>
      <Typography variant="h6" gutterBottom noWrap>
        {data.name}
      </Typography>
      <Row label="Sprite">{data.sprite}</Row>
      <Row label="Min dmg">{data.minDmg}</Row>
      <Row label="Max dmg">{data.maxDmg}</Row>
      <Row label="Behaviors">{data.behaviorSet}</Row>
      {data.description ? (
        <>
          <SectionHeading>Description</SectionHeading>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {data.description}
          </Typography>
        </>
      ) : null}
      {loot.length > 0 && (
        <>
          <SectionHeading>Loot</SectionHeading>
          {loot.map((entry, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, py: 0.25 }}>
              <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                {entry.name}
              </Typography>
              <Typography variant="caption" sx={{
                color: "text.secondary"
              }}>
                {entry.rolls} × {entry.chance}
              </Typography>
            </Box>
          ))}
        </>
      )}
    </Box>
  );
}

// ─── Raw XML ─────────────────────────────────────────────────────────────────

export function RawXmlView({ raw }) {
  return (
    <Box
      component="pre"
      sx={{
        fontFamily: 'monospace',
        fontSize: 11,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        m: 0,
        color: 'text.secondary'
      }}
    >
      {raw || ''}
    </Box>
  )
}

export function ReferenceViewDispatcher({ type, parsed, raw, showXml }) {
  if (showXml) return <RawXmlView raw={raw} />
  switch (type) {
    case 'castables':
      return <CastableReferenceView data={parsed} />
    case 'statuses':
      return <StatusReferenceView data={parsed} />
    case 'items':
      return <ItemReferenceView data={parsed} />
    case 'creatures':
      return <CreatureReferenceView data={parsed} />
    default:
      return <RawXmlView raw={raw} />
  }
}
