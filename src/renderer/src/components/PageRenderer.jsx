import { lazy, Suspense } from 'react'
import { Box, CircularProgress } from '@mui/material'
import { useStoreValue, currentPageState } from '../store/appStore'
import DashboardPage from '../pages/DashboardPage'

// Dashboard is the default landing page, so it stays in the initial chunk and
// paints without a Suspense flash. The other 21 pages — including the large
// editors (ConstantsPage, ServerConfigEditor, StatusEditor, FormulaEditor…) —
// are code-split so startup no longer parses/evaluates code for pages the user
// hasn't opened. Rollup emits one chunk per page, loaded on first navigation.
const CastablesPage = lazy(() => import('../pages/CastablesPage'))
const VariantsPage = lazy(() => import('../pages/VariantsPage'))
const StringsPage = lazy(() => import('../pages/StringsPage'))
const StatusesPage = lazy(() => import('../pages/StatusesPage'))
const SpawngroupsPage = lazy(() => import('../pages/SpawngroupsPage'))
const SettingsPage = lazy(() => import('../pages/SettingsPage'))
const RecipesPage = lazy(() => import('../pages/RecipesPage'))
const NPCsPage = lazy(() => import('../pages/NPCsPage'))
const NationsPage = lazy(() => import('../pages/NationsPage'))
const LootPage = lazy(() => import('../pages/LootPage'))
const ItemsPage = lazy(() => import('../pages/ItemsPage'))
const HelpersPage = lazy(() => import('../pages/HelpersPage'))
const FormulasPage = lazy(() => import('../pages/FormulasPage'))
const ElementsPage = lazy(() => import('../pages/ElementsPage'))
const CreaturesPage = lazy(() => import('../pages/CreaturesPage'))
const BehaviorsPage = lazy(() => import('../pages/BehaviorsPage'))
const SpellbooksPage = lazy(() => import('../pages/SpellbooksPage'))
const ConstantsPage = lazy(() => import('../pages/ConstantsPage'))
const ServerConfigPage = lazy(() => import('../pages/ServerConfigPage'))
const ExportsPage = lazy(() => import('../pages/ExportsPage'))
const DamageCalculatorPage = lazy(() => import('../pages/DamageCalculatorPage'))

const pageFallback = (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
    <CircularProgress size={48} thickness={4} color="info" disableShrink />
  </Box>
)

const PageRenderer = ({ libraries, onAddLibrary, onRemoveLibrary }) => {
  const currentPage = useStoreValue(currentPageState)

  let page
  switch (currentPage) {
    case 'dashboard':
      page = <DashboardPage />
      break
    case 'castables':
      page = <CastablesPage />
      break
    case 'variants':
      page = <VariantsPage />
      break
    case 'strings':
      page = <StringsPage />
      break
    case 'statuses':
      page = <StatusesPage />
      break
    case 'spawngroups':
      page = <SpawngroupsPage />
      break
    case 'settings':
      page = (
        <SettingsPage
          libraries={libraries}
          onAddLibrary={onAddLibrary}
          onRemoveLibrary={onRemoveLibrary}
        />
      )
      break
    case 'recipes':
      page = <RecipesPage />
      break
    case 'npcs':
      page = <NPCsPage />
      break
    case 'nations':
      page = <NationsPage />
      break
    case 'loot':
      page = <LootPage />
      break
    case 'items':
      page = <ItemsPage />
      break
    case 'helpers':
      page = <HelpersPage />
      break
    case 'formulas':
      page = <FormulasPage />
      break
    case 'elements':
      page = <ElementsPage />
      break
    case 'creatures':
      page = <CreaturesPage />
      break
    case 'behaviors':
      page = <BehaviorsPage />
      break
    case 'spellbooks':
      page = <SpellbooksPage />
      break
    case 'constants':
      page = <ConstantsPage />
      break
    case 'serverconfig':
      page = <ServerConfigPage />
      break
    case 'exports':
      page = <ExportsPage />
      break
    case 'damage-calculator':
      page = <DamageCalculatorPage />
      break
    default:
      page = <DashboardPage />
  }

  return <Suspense fallback={pageFallback}>{page}</Suspense>
}

export default PageRenderer
