# Task 11: Wiki — Monster & Hunter Encyclopedia

> **For Claude:** Use superpowers:executing-plans to implement task-by-task.

**Goal:** Build the companion wiki — browsable monster/hunter encyclopedia, status effect reference, type chart. Served locally at /wiki.

**Architecture:** React pages reading from SQLite via Tauri invoke. Grid + detail page pattern. Filter by type and search by name.

**Tech Stack:** React, React Router, Tauri invoke, Tailwind

---

### Step 1: Wiki layout + nav
```tsx
// src/pages/wiki/WikiLayout.tsx
const links = [
  { to: '/wiki/monsters',       label: '🐉 Monsters' },
  { to: '/wiki/hunters',        label: '⚔️ Hunters' },
  { to: '/wiki/status-effects', label: '💥 Status Effects' },
  { to: '/wiki/types',          label: '🗺️ Type Chart' },
]
```

---

### Step 2: Monster grid with filter
```tsx
// src/pages/wiki/WikiMonsters.tsx
// Filter: search input + 6 type toggle buttons + "All" button
// Grid: 4 columns of MonsterCard
// Each card: sprite, name, TypeBadge, HP/MP line
// Click → navigate to /wiki/monsters/:id
```

---

### Step 3: Monster detail page
```tsx
// src/pages/wiki/WikiMonsterDetail.tsx
// Route: /wiki/monsters/:id
// Loads via invoke('get_monster_detail', { id })
// Sections:
//   Header: 128px sprite, name, TypeBadge, lore (italic)
//   StatBars: STR/AGI/DEX/INT/LUCK as visual bars (max 25)
//   Active Abilities table: name, MP cost, power, type, effect, status inflicted
//   Passive Abilities table: name, effect
//   LLM badge if generated_by_llm == true
```

---

### Step 4: Stat bars component
```tsx
// src/pages/wiki/StatBars.tsx
const STATS = ['str_stat','agi','dex','int_stat','luck']
const MAX_STAT = 25
// Each stat: label | ████░░░ bar | number
// Bar color: blue (#3b82f6)
```

---

### Step 5: Hunter wiki pages
```tsx
// /wiki/hunters → same grid as monsters
// /wiki/hunters/:id → same detail page pattern
// Extra section: Hunter class, ultimate skill description
```

---

### Step 6: Status effects reference
```tsx
// src/pages/wiki/WikiStatusEffects.tsx
// Table: icon | name (colored badge) | effect description | duration
// Rows for all 9 effects using seed data colors
```

---

### Step 7: Type chart page
```tsx
// src/pages/wiki/WikiTypeChart.tsx
// Route: /wiki/types
// 6x6 grid — attacker type (row) vs defender type (col)
// Cell: 1.5x (green), 1.0x (white/neutral), 0.5x (red)
const TYPES = ['Fire','Water','Earth','Wind','Dark','Light']
```

---

### Step 8: Add wiki links to router
```tsx
// src/main.tsx — add routes:
// /wiki → WikiLayout (Outlet)
// /wiki/monsters → WikiMonsters
// /wiki/monsters/:id → WikiMonsterDetail
// /wiki/hunters → WikiHunters
// /wiki/hunters/:id → WikiHunterDetail
// /wiki/status-effects → WikiStatusEffects
// /wiki/types → WikiTypeChart
```

---

### Step 9: Commit
```bash
git add .
git commit -m "feat: wiki — monster/hunter encyclopedia, status effects, type chart"
```
