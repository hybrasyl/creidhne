import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFs = {
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
};

vi.mock('fs', () => ({ promises: mockFs }));
vi.mock('crypto', () => ({ randomUUID: () => 'test-uuid-1234' }));

const { loadFormulas, saveFormulas, importFormulas } = await import('../formulasJson.js');

beforeEach(() => {
  vi.clearAllMocks();
  mockFs.mkdir.mockResolvedValue(undefined);
  mockFs.writeFile.mockResolvedValue(undefined);
});

// ── loadFormulas ─────────────────────────────────────────────────────────────

describe('loadFormulas', () => {
  it('returns default structure when file does not exist', async () => {
    mockFs.readFile.mockRejectedValue(new Error('ENOENT'));
    const result = await loadFormulas('/world/xml');
    expect(result).toEqual({
      settings: expect.objectContaining({
        budgetModifier: expect.any(Object),
        customVariables: expect.any(Object),
        coefficients: expect.any(Object),
      }),
      patterns: [],
      formulas: [],
    });
  });

  it('loads and returns existing data', async () => {
    const stored = {
      settings: { budgetModifier: { mode: 'linearStep' }, customVariables: { LevelUpper: 110 }, coefficients: {} },
      patterns: [],
      formulas: [{ id: '1', name: 'test', formula: 'x + 1' }],
    };
    mockFs.readFile.mockResolvedValue(JSON.stringify(stored));
    const result = await loadFormulas('/world/xml');
    expect(result.formulas).toHaveLength(1);
    expect(result.formulas[0].name).toBe('test');
    expect(result.settings.customVariables.LevelUpper).toBe(110);
  });

  it('migrates legacy globals to settings.customVariables', async () => {
    const legacy = {
      globals: { LevelUpper: 110, LevelDiv: 10 },
      templates: [{ id: 't1' }],
      formulas: [{ id: '1', name: 'test', formula: 'x' }],
    };
    mockFs.readFile.mockResolvedValue(JSON.stringify(legacy));
    const result = await loadFormulas('/world/xml');
    // globals migrated to customVariables
    expect(result.settings.customVariables.LevelUpper).toBe(110);
    expect(result.settings.customVariables.LevelDiv).toBe(10);
    // templates migrated to patterns
    expect(result.patterns).toEqual([{ id: 't1' }]);
    // no globals or templates keys
    expect(result.globals).toBeUndefined();
    expect(result.templates).toBeUndefined();
  });

  it('preserves settings if already migrated', async () => {
    const data = {
      settings: { budgetModifier: { mode: 'none' }, customVariables: { Divisor: 1500 }, coefficients: { DMG_ST: { spell: 1, skill: 0.8 } } },
      patterns: [],
      formulas: [],
    };
    mockFs.readFile.mockResolvedValue(JSON.stringify(data));
    const result = await loadFormulas('/world/xml');
    expect(result.settings.coefficients.DMG_ST).toEqual({ spell: 1, skill: 0.8 });
  });

  it('includes default custom variables when loading fresh', async () => {
    mockFs.readFile.mockRejectedValue(new Error('ENOENT'));
    const result = await loadFormulas('/world/xml');
    expect(result.settings.customVariables.LevelUpper).toBe(110);
    expect(result.settings.customVariables.LevelDiv).toBe(10);
    expect(result.settings.customVariables.Divisor).toBe(1500);
  });
});

// ── importFormulas ──────────────────────────────────────────────────────────

describe('importFormulas', () => {
  it('parses Lua format: name = "formula"', async () => {
    const lua = 'test_formula = "SOURCESTR * 3 + SOURCELEVEL"\n';
    mockFs.readFile.mockResolvedValue(lua);
    const result = await importFormulas('/test.lua', { formulas: [] });
    expect(result.added).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.data.formulas).toHaveLength(1);
    expect(result.data.formulas[0].name).toBe('test_formula');
    expect(result.data.formulas[0].formula).toBe('SOURCESTR * 3 + SOURCELEVEL');
  });

  it('skips comment lines', async () => {
    const lua = '-- this is a comment\ntest = "formula"\n';
    mockFs.readFile.mockResolvedValue(lua);
    const result = await importFormulas('/test.lua', { formulas: [] });
    expect(result.added).toBe(1);
  });

  it('skips blank lines', async () => {
    const lua = '\n\ntest = "formula"\n\n';
    mockFs.readFile.mockResolvedValue(lua);
    const result = await importFormulas('/test.lua', { formulas: [] });
    expect(result.added).toBe(1);
  });

  it('updates existing formula by name', async () => {
    const lua = 'existing = "new_formula"';
    mockFs.readFile.mockResolvedValue(lua);
    const existing = {
      formulas: [{ id: 'abc', name: 'existing', formula: 'old_formula', description: 'keep me' }],
    };
    const result = await importFormulas('/test.lua', existing);
    expect(result.updated).toBe(1);
    expect(result.added).toBe(0);
    expect(result.data.formulas[0].formula).toBe('new_formula');
    expect(result.data.formulas[0].description).toBe('keep me');
  });

  it('detects duplicate formula strings', async () => {
    const lua = 'new_name = "same_formula"';
    mockFs.readFile.mockResolvedValue(lua);
    const existing = {
      formulas: [{ id: 'abc', name: 'old_name', formula: 'same_formula' }],
    };
    const result = await importFormulas('/test.lua', existing);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0].name).toBe('new_name');
    expect(result.duplicates[0].existingName).toBe('old_name');
    // Still added despite being a duplicate
    expect(result.added).toBe(1);
  });

  it('parses multiple lines', async () => {
    const lua = [
      '-- Formula export',
      'alpha = "A + B"',
      'beta = "C * D"',
      'gamma = "E / F"',
    ].join('\n');
    mockFs.readFile.mockResolvedValue(lua);
    const result = await importFormulas('/test.lua', { formulas: [] });
    expect(result.added).toBe(3);
    expect(result.data.formulas).toHaveLength(3);
  });

  it('assigns default category of damage', async () => {
    const lua = 'test = "formula"';
    mockFs.readFile.mockResolvedValue(lua);
    const result = await importFormulas('/test.lua', { formulas: [] });
    expect(result.data.formulas[0].category).toBe('damage');
  });

  it('assigns uuid to new formulas', async () => {
    const lua = 'test = "formula"';
    mockFs.readFile.mockResolvedValue(lua);
    const result = await importFormulas('/test.lua', { formulas: [] });
    expect(result.data.formulas[0].id).toBe('test-uuid-1234');
  });
});
