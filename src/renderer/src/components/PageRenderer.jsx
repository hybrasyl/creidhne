import React from 'react'
import { useRecoilValue } from 'recoil'
import { currentPageState } from '../recoil/atoms'
import DashboardPage from '../pages/DashboardPage'
import CastablesPage from '../pages/CastablesPage'
import VariantsPage from '../pages/VariantsPage'
import StringsPage from '../pages/StringsPage'
import StatusesPage from '../pages/StatusesPage'
import SpawngroupsPage from '../pages/SpawngroupsPage'
import SettingsPage from '../pages/SettingsPage'
import RecipesPage from '../pages/RecipesPage'
import NPCsPage from '../pages/NPCsPage'
import NationsPage from '../pages/NationsPage'
import LootPage from '../pages/LootPage'
import ItemsPage from '../pages/ItemsPage'
import HelpersPage from '../pages/HelpersPage'
import FormulasPage from '../pages/FormulasPage'
import ElementsPage from '../pages/ElementsPage'
import CreaturesPage from '../pages/CreaturesPage'
import BehaviorsPage from '../pages/BehaviorsPage'
import ConstantsPage from '../pages/ConstantsPage'
import ServerConfigPage from '../pages/ServerConfigPage'
import ExportsPage from '../pages/ExportsPage'
import DamageCalculatorPage from '../pages/DamageCalculatorPage'

const PageRenderer = ({ libraries, onAddLibrary, onRemoveLibrary }) => {
  const currentPage = useRecoilValue(currentPageState)

  switch (currentPage) {
    case 'dashboard':
      return <DashboardPage />
    case 'castables':
      return <CastablesPage />
    case 'variants':
      return <VariantsPage />
    case 'strings':
      return <StringsPage />
    case 'statuses':
      return <StatusesPage />
    case 'spawngroups':
      return <SpawngroupsPage />
    case 'settings':
      return (
        <SettingsPage
          libraries={libraries}
          onAddLibrary={onAddLibrary}
          onRemoveLibrary={onRemoveLibrary}
        />
      )
    case 'recipes':
      return <RecipesPage />
    case 'npcs':
      return <NPCsPage />
    case 'nations':
      return <NationsPage />
    case 'loot':
      return <LootPage />
    case 'items':
      return <ItemsPage />
    case 'helpers':
      return <HelpersPage />
    case 'formulas':
      return <FormulasPage />
    case 'elements':
      return <ElementsPage />
    case 'creatures':
      return <CreaturesPage />
    case 'behaviors':
      return <BehaviorsPage />
    case 'constants':
      return <ConstantsPage />
    case 'serverconfig':
      return <ServerConfigPage />
    case 'exports':
      return <ExportsPage />
    case 'damage-calculator':
      return <DamageCalculatorPage />
    default:
      return <DashboardPage />
  }
}

export default PageRenderer
