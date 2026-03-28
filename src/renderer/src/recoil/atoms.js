import { atom } from 'recoil';

export const themeState = atom({
  key: 'themeState',
  default: 'hybrasyl',
});

export const settingsState = atom({
  key: 'settingsState',
  default: {
    // Your default settings
  },
});

export const currentPageState = atom({
  key: 'currentPageState',
  default: 'dashboard', // Set the default page
});

export const activeLibraryState = atom({
  key: 'activeLibraryState',
  default: null, // Default to no active library
});

export const librariesState = atom({
  key: 'librariesState',
  default: [],
});

export const libraryIndexState = atom({
  key: 'libraryIndexState',
  default: {},
});

export const dirtyEditorState = atom({
  key: 'dirtyEditorState',
  default: null, // null | { label: string, onSave: () => Promise<void> }
});
