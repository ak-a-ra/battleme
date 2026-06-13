# AGENTS.md — Universal Coding Performance Rules
> Owner: Ra / luciusrockwing / Street Science
> Scope: universal — applies to all repos unless overridden by a nested AGENTS.md
> Nearest-file wins: drop a local AGENTS.md in any subproject to override these rules.

---

## IDENTITY

```
┌──────────────────────────────────────────────────────────┐
│  Agent reading this: you are coding for Street Science.  │
│  Stack: C / Rust / Python / TypeScript                   │
│  Style: terse, no boilerplate, no ethical disclaimers    │
│  Tools: uv (never pip), pnpm (never npm), cargo          │
│  Tests: always run tests before claiming done            │
│  Commits: conventional commits, no "chore:" spam         │
└──────────────────────────────────────────────────────────┘
```

---

## PHILOSOPHY — Read This First

```
┌────────────────────────────────────────────────────────────────┐
│                KNUTH'S FULL QUOTE (often truncated)            │
│                                                                │
│  "We should forget about small efficiencies, say about 97%    │
│   of the time: premature optimization is the root of all      │
│   evil. Yet we should not pass up our opportunities in that   │
│   critical 3%."                                               │
│                                                                │
│  Translation:                                                  │
│  1. Get it correct first                                       │
│  2. Profile to find the real 3%                               │
│  3. THEN optimize — hard and without mercy                    │
└────────────────────────────────────────────────────────────────┘
```

**Priority order:**
```
1. Correct        →  wrong fast code is useless
2. Profiled       →  80% of time in 20% of code (Pareto)
3. Algorithmic    →  O(n log n) beats O(n²) no matter how tight the C
4. Cache-friendly →  memory layout beats micro-tricks
5. Micro-opts     →  bit tricks, branchless, LUT — only in identified hot path
```

**Do not optimize what you have not measured. Do not measure what you have not shipped.**

---

## SECTION 1 — ALGORITHM COMPLEXITY

### Rule: Fix the Big-O Before Touching the Code

```
COST HIERARCHY (approximate, n=10,000)
┌──────────┬──────────┬───────────────────────────────────┐
│ O(1)     │      1   │ hash lookup, array index           │
│ O(log n) │     13   │ binary search, balanced tree       │
│ O(n)     │  10,000  │ linear scan, single pass           │
│ O(n log n│ 130,000  │ sort, divide-and-conquer           │
│ O(n²)    │ 100M     │ nested loops, brute-force collision │
│ O(2ⁿ)    │    ???   │ never ship this                    │
└──────────┴──────────┴───────────────────────────────────┘
```

**Rules:**
- Nested loop over the same data → wrong data structure, fix it first
- "Check every X against every Y" → spatial hash, sorted list + binary search, or index
- String key lookups in hot path → hash map or integer ID
- Recursive without memoization → likely exponential, add cache or convert to DP

### Memoization Pattern

```python
# Pure function with expensive output → cache it
from functools import lru_cache

@lru_cache(maxsize=None)
def expensive(n: int) -> int:
    ...

# Manual (when lru_cache not available):
_cache: dict[int, int] = {}
def expensive(n: int) -> int:
    if n in _cache: return _cache[n]
    result = ...
    _cache[n] = result
    return result
```

```rust
// Rust: OnceCell for one-time expensive init
use std::sync::OnceLock;
static TABLE: OnceLock<Vec<u32>> = OnceLock::new();
fn get_table() -> &'static [u32] {
    TABLE.get_or_init(|| build_table())
}
```

**Confidence: high** — trade memory for CPU, standard in every language

---

### Lazy Evaluation — Compute Only When Needed

```
EAGER (bad if value often unused)    LAZY (compute on first access)
┌──────────────────────────┐        ┌──────────────────────────┐
│ result = expensive()     │        │ result = None             │
│ if condition:            │   →    │ if condition:             │
│     use(result)          │        │     result = expensive()  │
│                          │        │     use(result)           │
└──────────────────────────┘        └──────────────────────────┘

Apache Spark entire model = lazy. Never compute until .collect()
```

```typescript
// TS: lazy getter pattern
class Config {
    private _schema?: Schema;
    get schema(): Schema {
        return (this._schema ??= buildSchema());  // build once, on first access
    }
}
```

---

## SECTION 2 — MEMORY LAYOUT & ALLOCATION

### The Memory Hierarchy — Why Layout Matters

```
ACCESS LATENCY (approximate CPU cycles)
┌─────────────────────────────────────────────────────────┐
│  L1 cache (32–64 KB)        ~4 cycles    ← fast        │
│  L2 cache (256 KB – 1 MB)   ~12 cycles                 │
│  L3 cache (8–32 MB)         ~40 cycles                 │
│  Main RAM                   ~200 cycles  ← slow        │
│  SSD                        ~100,000 cycles             │
│  Network (LAN)              ~1,000,000 cycles           │
└─────────────────────────────────────────────────────────┘

A cache miss = stall. Data arranged for locality = fewer misses.
Matrix multiply with good locality: 20× faster than bad layout.
                                    (GeeksforGeeks, measured)
```

**Rule: data used together must live together in memory.**

---

### Structure of Arrays (SoA) vs Array of Structures (AoS)

```
AoS — cache-inefficient for partial iteration
struct Entity { int x, y, vx, vy, hp, sprite; };
Entity entities[1000];

Iterating x,y for render:
[x,y,vx,vy,hp,sprite | x,y,vx,vy,hp,sprite | ...]
 ↑↑ need these         ^^^^^^^^^^^^^^^^ drag these into cache unnecessarily

─────────────────────────────────────────────────────────

SoA — cache-efficient for partial iteration
struct Entities {
    int x[1000], y[1000];      // hot: render, physics
    int vx[1000], vy[1000];    // hot: physics only
    int hp[1000];               // cold: combat only
    u8  sprite[1000];           // cold: render only
};

Iterating x,y for render:
[x0,x1,x2,x3,...] — full cache line of x values, zero waste
```

**Rule:**
- Hot loop touches ONE property of many objects → SoA
- One object needs ALL properties at once → AoS fine
- Split hot fields from cold fields regardless of layout choice

---

### Allocator Hierarchy — Pick the Right Tool

```
┌─────────────────────────────────────────────────────────────┐
│  ALLOCATOR DECISION TREE                                    │
│                                                             │
│  Known size at compile time?                                │
│    YES → stack alloc (zero cost, zero fragmentation)        │
│    NO  ↓                                                    │
│                                                             │
│  All objects same size, created/destroyed dynamically?      │
│    YES → pool allocator  O(1) alloc/free, no fragmentation  │
│    NO  ↓                                                    │
│                                                             │
│  Objects share same lifetime (freed together)?              │
│    YES → arena/bump allocator  pointer bump, O(1), fast     │
│    NO  ↓                                                    │
│                                                             │
│  General case (varying size, varying lifetime)?             │
│         → system malloc/new  (slowest, GC overhead)         │
└─────────────────────────────────────────────────────────────┘
```

**Arena (bump) allocator** — pointer bump, O(1), cache-local, 50–100× faster than malloc:

```c
typedef struct { u8* base; size_t offset; size_t cap; } Arena;

void* arena_alloc(Arena* a, size_t size) {
    size = (size + 7) & ~7;               // 8-byte align
    if (a->offset + size > a->cap) return NULL;
    void* ptr = a->base + a->offset;
    a->offset += size;
    return ptr;
}
void arena_reset(Arena* a) { a->offset = 0; }  // free everything, O(1)
```

**Pool allocator** — fixed-size slots, O(1) alloc/free, free-list in-place:

```c
typedef struct Slot { struct Slot* next; } Slot;
typedef struct { Slot* free_head; } Pool;

void* pool_alloc(Pool* p) {
    if (!p->free_head) return NULL;
    Slot* s = p->free_head;
    p->free_head = s->next;
    return s;
}
void pool_free(Pool* p, void* ptr) {
    Slot* s = ptr;
    s->next = p->free_head;
    p->free_head = s;
}
```

**Rule: never call malloc/new inside a hot loop.**

---

### Object Pools — No Dynamic Alloc at Runtime

```
PRE-ALLOCATE EVERYTHING at startup:

POOL (max 256 bullets)
[·][·][B][·][B][B][·][·][B]...
         ↑        ↑  ↑
    active=1   active=0 → reuse this slot

Spawn: scan for active==0, set active=1
Kill:  set active=0
Never: malloc(), new, push_back growing heap
```

```rust
const MAX_BULLETS: usize = 256;
struct Bullet { x: i32, y: i32, vx: i32, vy: i32, active: bool }
static mut POOL: [Bullet; MAX_BULLETS] = [Bullet { x:0,y:0,vx:0,vy:0,active:false }; MAX_BULLETS];

fn spawn(x: i32, y: i32, vx: i32, vy: i32) {
    for b in unsafe { POOL.iter_mut() } {
        if !b.active { *b = Bullet { x,y,vx,vy,active:true }; return; }
    }
}
```

---

## SECTION 3 — CPU / HOT PATH RULES

### What Is the Hot Path?

```
CALL TREE example:
main_loop()                    called 60×/sec
  ├── poll_input()             called 60×/sec       COLD
  ├── update_entities()        called 60×/sec  ←──  HOT
  │     ├── move_all()         60 × 256 = 15360/sec HOT HOT
  │     ├── collision_check()  60 × 256² calls      HOT HOT HOT
  │     └── animate()          60 × 256 calls        HOT
  ├── render()                 called 60×/sec  ←──  HOT
  └── play_audio()             called 60×/sec       COLD-ISH

Optimize: move_all, collision_check, render inner loops.
Ignore: poll_input, logging, error paths, startup code.
```

**Rule: profile first. Identify real hot path. Ignore everything else.**

---

### Precomputed Lookup Tables (LUT)

```
RULE: expensive pure function called many times with bounded input → LUT

  sin(angle)    → SIN_LUT[360]    precomputed at startup
  sqrt(n)       → SQRT_LUT[4096]  precomputed for small n
  islower(c)    → LOWER_LUT[256]  1-byte table, zero branches
  color_lerp(t) → LERP_LUT[256]   precomputed for t in [0..255]
```

```c
// Build once:
static float SIN_LUT[360];
void build_lut(void) {
    for (int i = 0; i < 360; i++)
        SIN_LUT[i] = sinf(i * 3.14159f / 180.0f);
}
// Use at runtime (O(1), no trig):
float s = SIN_LUT[angle_deg];
```

**Confidence: high** — standard since NES era, valid for any expensive pure function

---

### Branchless Programming — Remove Branches from Hot Loops

```
PROBLEM: branch misprediction = pipeline stall (~15 cycles wasted)
         CPU guesses wrong when condition is unpredictable (random data)

SOLUTION: replace conditionals with arithmetic / table lookups

SLOW (branchy):
bool is_lower(char c) { return c >= 'a' && c <= 'z'; }

FAST (branchless LUT):
static const bool LOWER_TABLE[256] = { /* precomputed */ };
bool is_lower(char c) { return LOWER_TABLE[(u8)c]; }
```

```c
// Branchless clamp (no if/else):
int clamp(int x, int lo, int hi) {
    x = x < lo ? lo : x;   // compiler emits CMOV, not branch
    x = x > hi ? hi : x;
    return x;
}

// Branchless abs:
int fast_abs(int x) {
    int mask = x >> 31;     // all 0s if positive, all 1s if negative
    return (x + mask) ^ mask;
}

// Branchless select (pick a or b based on condition):
int select(int cond, int a, int b) {
    int mask = -!!cond;     // 0xFFFFFFFF if true, 0x00000000 if false
    return (a & mask) | (b & ~mask);
}
```

**Rule:** only go branchless if: (a) the branch is in a proven hot path,
AND (b) data is random / unpredictable. Predictable branches are free.

**Confidence: high** — confirmed by branch prediction literature

---

### Bit Operations — Faster Than Arithmetic

```
SLOW               FAST          NOTES
────────────────────────────────────────────────────────
x * 2          →   x << 1        always
x * 4          →   x << 2        always
x / 2          →   x >> 1        unsigned only (or arithmetic shift)
x % 16         →   x & 15        power-of-2 only
x % 256        →   x & 255       power-of-2 only
is_even(x)     →   !(x & 1)      zero branch
abs(x)         →   branchless    see above
swap(a,b)      →   a^=b;b^=a;a^=b   no temp variable
next_pow2(x)   →   bit trick     see below
```

```c
// Round up to next power of 2:
u32 next_pow2(u32 x) {
    x--;
    x |= x >> 1; x |= x >> 2; x |= x >> 4;
    x |= x >> 8; x |= x >> 16;
    return x + 1;
}

// Check if power of 2:
bool is_pow2(u32 x) { return x && !(x & (x - 1)); }

// Bitflag state (input, permissions, entity properties):
#define FLAG_A  (1u << 0)
#define FLAG_B  (1u << 1)
uint32_t state = 0;
state |=  FLAG_A;          // set
state &= ~FLAG_B;          // clear
state ^=  FLAG_A;          // toggle
bool has = (state & FLAG_A) != 0;  // test
```

---

### Fixed-Point Arithmetic — For Embedded / Limited FPU

```
WHEN: no hardware FPU, or float precision overkill for 2D math

ENCODING:  real_value = int_value / SCALE
           SCALE = 256  →  8 fractional bits  (16.8 format)
           SCALE = 65536 → 16 fractional bits (16.16 format)

  3.75 real → 3.75 × 256 = 960 stored
  render: draw at position 960 >> 8 = 3

SPEED: int ops on all hardware, no FPU stall
```

```c
typedef int32_t fixed;
#define FX_SHIFT  8
#define FX(n)     ((n) << FX_SHIFT)
#define FX_TO_INT(f) ((f) >> FX_SHIFT)
#define FX_MUL(a,b)  (((int64_t)(a) * (b)) >> FX_SHIFT)
#define FX_DIV(a,b)  (((int64_t)(a) << FX_SHIFT) / (b))
```

**Confidence: high** — used in Doom, every SNES/GBA game, embedded systems

---

## SECTION 4 — DATA STRUCTURES

### Choose the Right Structure First

```
NEED                              USE
──────────────────────────────────────────────────────────────
Ordered iteration                 contiguous array (vec, slice)
Key→value, O(1) lookup            hash map
Ordered key→value, range queries  B-tree / sorted array + binary search
FIFO queue                        ring buffer (fixed) or deque
LIFO stack                        array with top pointer
Deduplication                     hash set
Spatial lookup (2D/3D objects)    spatial hash grid or quadtree
Priority queue                    binary heap
Graph shortest path               Dijkstra (sparse), BFS (unweighted)
Text search                       trie or Aho-Corasick (multi-pattern)
Bitset / flags                    uint32/uint64 bitmask
```

### Ring Buffer — Zero-Alloc FIFO

```
┌───┬───┬───┬───┬───┬───┬───┬───┐
│ . │ A │ B │ C │ . │ . │ . │ . │
└───┴───┴───┴───┴───┴───┴───┴───┘
       ↑head           ↑tail

head = (head + 1) % SIZE   on dequeue
tail = (tail + 1) % SIZE   on enqueue
full  = (tail + 1) % SIZE == head
empty = head == tail

No malloc. No pointer chasing. Cache-sequential read.
```

```c
#define Q_SIZE 64
typedef struct { int data[Q_SIZE]; int head, tail; } RingBuf;
void rb_push(RingBuf* q, int v) { q->data[q->tail] = v; q->tail = (q->tail+1)%Q_SIZE; }
int  rb_pop (RingBuf* q)        { int v = q->data[q->head]; q->head = (q->head+1)%Q_SIZE; return v; }
```

---

### Spatial Hash Grid — O(n) Collision

```
BRUTE FORCE: O(n²) — check every entity against every entity
SPATIAL GRID: O(n) — only check entities in same + adjacent cells

GRID  (cell size = interaction radius)
┌──────┬──────┬──────┐
│      │ E E  │      │   entity → cell via:
├──────┼──────┼──────┤     cx = entity.x / CELL_SIZE
│  E   │      │  E E │     cy = entity.y / CELL_SIZE
├──────┼──────┼──────┤
│      │  E   │      │   check only 3×3 neighborhood = 9 cells
└──────┴──────┴──────┘   vs all N entities
```

---

## SECTION 5 — I/O & PARSING

### Never Parse in the Hot Path

```
SLOW (parse every frame / every request)
  load("config.json") → parse JSON → walk tree → get value

FAST (parse once, use struct)
  startup: load + parse once → struct Config { ... }
  runtime: config.max_speed   // O(1) field access
```

```
FORMAT SPEED (parse cost, rough order)
fastest → binary / flatbuffers / custom packed struct
          messagepack / protobuf
          TOML / INI
          YAML
slowest → JSON (string escaping, unicode, arbitrary nesting)
          XML (never for hot path)
```

**Rules:**
- Config: load once at startup, store in typed struct
- Network protocol: use binary framing (length-prefix), not JSON per packet
- Asset files: pack into binary blob at build time
- Hot-path key lookup: int ID, not string comparison

---

### I/O Batching

```
SLOW: write per record
  for row in data:
      db.execute("INSERT ...", row)   # N round trips

FAST: batch write
  db.execute_many("INSERT ...", data)  # 1 round trip
  # or use transactions / bulk insert

Same principle: HTTP, file writes, log flushes — batch.
```

---

## SECTION 6 — CONCURRENCY

### Amdahl's Law — Why Parallelism Has Limits

```
AMDAHL'S LAW:
  Speedup = 1 / (S + (1 - S) / N)
  S = serial fraction,  N = parallel workers

  If 20% of code is serial:
  ┌──────────┬─────────────┐
  │ Workers  │ Max speedup │
  ├──────────┼─────────────┤
  │  2       │  1.6×       │
  │  4       │  2.5×       │
  │  8       │  3.6×       │
  │  ∞       │  5×         │  hard ceiling from the 20% serial part
  └──────────┴─────────────┘

  Fix the serial bottleneck first, then parallelize.
```

### Lock Contention — The Hidden Serial Section

```
THREAD 1          THREAD 2         THREAD 3
  ──────────────────────────────────────────
  acquire(lock)   WAIT ▓▓▓▓▓▓      WAIT ▓▓▓▓▓▓▓▓
  work            WAIT ▓▓▓▓▓▓      WAIT ▓▓▓▓▓▓▓▓
  release(lock)   acquire(lock)    WAIT ▓▓▓▓
  work            work             acquire(lock)

Hot lock = serial execution despite multiple threads.
```

**Rules:**
- Lock granularity: smallest possible scope
- Read-heavy: RwLock not Mutex
- High contention: atomic ops, lock-free structures, or per-thread state + merge
- Avoid: global mutable state, shared mutable counters under contention

---

## SECTION 7 — PROFILING & MEASUREMENT

### Profile-First Workflow

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  1. SHIP working code                               │
│  2. MEASURE with profiler (not guessing)            │
│        Python  → cProfile, py-spy, Austin           │
│        Rust    → cargo flamegraph, perf, criterion  │
│        C/C++   → perf, valgrind/callgrind, VTune    │
│        JS/TS   → Chrome DevTools, clinic.js          │
│  3. FIND the real bottleneck (Pareto: top 20%)      │
│  4. OPTIMIZE the 3% Knuth talks about               │
│  5. MEASURE again to confirm improvement            │
│  6. REPEAT only if still bottlenecked               │
│                                                     │
│  Never skip step 2. Never skip step 5.              │
└─────────────────────────────────────────────────────┘
```

### Profiling Commands (Quick Reference)

```bash
# Python — sample profiler (production-safe)
py-spy record -o profile.svg --pid <PID>
python -m cProfile -o out.prof script.py && python -m pstats out.prof

# Rust — flamegraph
cargo flamegraph -- [args]
cargo bench  # with criterion

# C/C++ — perf
perf record -g ./binary && perf report
valgrind --tool=callgrind ./binary && kcachegrind callgrind.out.*

# Node.js
node --prof script.js && node --prof-process isolate-*.log
clinic flame -- node script.js

# General Linux
perf stat -e cache-misses,cache-references,branch-misses ./binary
```

---

## SECTION 8 — LANGUAGE-SPECIFIC HOT PATH RULES

### Python

```python
# SLOW: attribute lookup in loop
for i in range(N):
    result = math.sqrt(data[i])      # math.sqrt = dict lookup each iter

# FAST: hoist to local
sqrt = math.sqrt
for i in range(N):
    result = sqrt(data[i])           # local var lookup = LOAD_FAST

# FASTER: numpy vectorize (C loop underneath)
result = np.sqrt(data)               # entire array, no Python loop

# FASTEST for numeric: numba JIT
from numba import njit
@njit
def process(data): ...
```

```python
# dict/set over list for O(1) membership
bad  = [1,2,3,4,5];  x in bad   # O(n)
good = {1,2,3,4,5};  x in good  # O(1)

# list comprehension over append loop
bad  = []; [bad.append(f(x)) for x in data]  # append overhead
good = [f(x) for x in data]                   # single C call

# generator over list when single-pass
sum(x*x for x in data)   # no intermediate list allocation
```

### Rust

```rust
// Iterator chains compile to zero-overhead loops
let total: u32 = data.iter()
    .filter(|&&x| x > 0)
    .map(|&x| x * 2)
    .sum();                    // LLVM optimizes this to tight loop

// Avoid Box<dyn Trait> in hot path (indirect call, heap alloc)
// Use generics (monomorphized = inlined at compile time):
fn process<T: Processor>(p: &T) { ... }  // zero overhead

// Pre-allocate with_capacity to avoid reallocs
let mut v: Vec<u32> = Vec::with_capacity(expected_len);

// Prefer &[T] over &Vec<T> in function signatures (more general, same perf)
```

### TypeScript / JavaScript

```typescript
// SLOW: dynamic property access
obj[dynamicKey]                       // dict lookup

// FAST: typed struct (V8 hidden class stable)
class Point { x: number; y: number; constructor(x,y){this.x=x;this.y=y;} }
// never add/delete properties after construction — breaks hidden class

// Avoid: closure allocation in hot loop
for (let i = 0; i < N; i++) {
    arr.forEach(x => process(x));    // closure created each iteration
}
// Use: plain for loop
for (let i = 0; i < N; i++) {
    for (let j = 0; j < arr.length; j++) process(arr[j]);
}

// TypedArray for numeric heavy work (C-array performance)
const data = new Float32Array(1000);  // 4× faster than regular Array
const ints = new Int32Array(1000);
```

---

## SECTION 9 — ANTI-PATTERNS (Never Do)

```
╔═══════════════════════════════════════════════════════════════════╗
║  UNIVERSAL ANTI-PATTERNS                                         ║
╠═══════════════════════════════════════════════════════════════════╣
║  ✗  malloc/new inside hot loop                                   ║
║  ✗  O(n²) when O(n log n) or O(n) exists                        ║
║  ✗  String keys for hot-path lookups (use int ID or hash once)   ║
║  ✗  Parsing text (JSON/XML/YAML) at runtime in hot path          ║
║  ✗  Virtual dispatch / dynamic dispatch in innermost loop        ║
║  ✗  Logging / printf inside hot path                             ║
║  ✗  Unnecessary copies — pass by reference, use move semantics   ║
║  ✗  Global mutable state under lock in threaded hot path         ║
║  ✗  Optimizing before profiling (Knuth)                          ║
║  ✗  Optimizing code not on the critical path                     ║
║  ✗  OOP deep inheritance + vtable in performance-critical loop   ║
║  ✗  Scattered heap objects iterated in tight loop (cache miss)   ║
║  ✗  Recursion without memoization on overlapping subproblems     ║
║  ✗  Blocking I/O on hot thread without async or offload          ║
║  ✗  Sync mutex on read-heavy shared state (use RwLock)           ║
╚═══════════════════════════════════════════════════════════════════╝
```

---

## SECTION 10 — DECISION TREES (Quick Lookup)

```
MY CODE IS SLOW. WHAT DO I DO?
│
├── Did you profile it?
│     NO  → profile first. Guess = wrong.
│     YES ↓
│
├── Is the algorithm O(n²) or worse?
│     YES → fix algorithm. No micro-opt will save O(n²).
│     NO  ↓
│
├── Is the hot loop cache-friendly?
│     NO  → restructure data (SoA, contiguous arrays, arena alloc)
│     YES ↓
│
├── Is there excessive allocation in hot path?
│     YES → object pool or arena allocator
│     NO  ↓
│
├── Are there unpredictable branches in hot loop?
│     YES → branchless / LUT substitution
│     NO  ↓
│
├── Are there expensive pure function calls repeated?
│     YES → memoize / precompute LUT
│     NO  ↓
│
├── Is it I/O bound?
│     YES → batch I/O, async, binary format
│     NO  → re-profile. You may be at hardware limit.
└───────────────────────────────────────────────────────────
```

```
NEED TO REDUCE MEMORY USAGE?
│
├── Many same-size objects created/destroyed?
│     YES → pool allocator
│
├── Objects all freed at same time?
│     YES → arena allocator (reset once)
│
├── Storing booleans or small flags?
│     YES → bitfield / bitmask (32 flags per uint32)
│
├── Caching results but memory grows unbounded?
│     YES → bounded LRU cache
│
└── Large struct passed by value?
      YES → pass by pointer/reference
```

---

## SECTION 11 — CODE STYLE RULES (Agent Behavior)

```
Naming:    camelCase functions, PascalCase types, SCREAMING_SNAKE constants
Comments:  inline on non-obvious lines, not on obvious ones
Errors:    explicit error returns / Result<T,E>, no silent swallow
Tests:     alongside implementation, not in separate file unless large
Deps:      zero new deps for problems solvable in <50 lines
Tools:     uv (Python), pnpm (JS/TS), cargo (Rust)
Commits:   feat: / fix: / refactor: / perf: / test: / docs:
PR:        run lint + test before opening. No WIP PRs.
```

**Agent rules:**
- Lead with code, not description
- No preamble ("Sure! Here is...") — just output
- Confidence label per claim when uncertain: `[high/medium/low]`
- Show diff or full file — never describe what to change
- Run tests before claiming done
- If performance claim made — include benchmark or measurement

---

## SOURCES

| Technique | Source |
|-----------|--------|
| Profile-first, Knuth quote | Knuth, "Structured Programming with Go To Statements", ACM 1974 |
| Cache locality, SoA | Mike Acton GDC "Data-Oriented Design in C++"; Noel Llopis; GeeksforGeeks locality article |
| Fixed-point | Wolfenstein/Doom source; Game Engine Black Book (Fabien Sanglard) |
| LUT sin/cos | Game dev forums; SNES "The Last Super" source |
| Branchless | Algorithmica.org; JohnySswlab.com; Towards Dev 2026 |
| Arena allocators | gingerbill.org allocator series; Harvard CS61; Medium perf articles |
| Object pools | GameProgrammingPatterns.com; GitHub raduacg/game-mechanics-optimizations |
| Spatial hash | game-mechanics-optimizations; collision detection literature |
| Amdahl's Law | standard CS curriculum |
| AGENTS.md format | agents.md (Linux Foundation / Agentic AI Foundation); aihero.dev guide |

---

# Project: BattleMe

> Project-specific instructions. Override base rules where they conflict below.

## Stack

Tauri v2 (Rust + React/TypeScript), SQLite (rusqlite), Tailwind, Lucide icons, tiny_http (port 38021 bridge)

## Architecture

```
Tauri Window (Dashboard) ── invoke() ──> Rust Backend
  ├─ SQLite (rusqlite)
  ├─ Battle Engine (pure Rust)
  ├─ Twitch (auth/polls/eventsub)
  └─ Arc<RwLock<BattleState>> ──> HTTP Bridge (tiny_http, :38021) ──> OBS Overlay (fetch polling)
```

**Key constraint:** OBS browser sources cannot use Tauri IPC. Overlay communicates solely via HTTP fetch polling from the Rust tiny_http bridge on port 38021.

## Directory Structure

```
battleme/
├── AGENTS.md, INDEX.md, PLAN.md, README.md
├── docs/archive/design/     ← task specs (01–13)
├── docs/adr/        ← architecture decision records
├── src/             ← React frontend
│   ├── pages/, components/, hooks/, lib/
├── src-tauri/src/   ← Rust backend
│   ├── db/          ← models, migrations, seed
│   ├── commands/    ← Tauri #[tauri::command] handlers
│   ├── battle/      ← engine (types, damage, status, engine)
│   ├── twitch/      ← auth, polls, eventsub
│   └── bridge/      ← tiny_http server
```

## Build Order (execute in order)

| # | Task | Key Output | Status |
|---|------|-----------|--------|
| 01 | Scaffold | Project init, deps, folder structure | ✅ |
| 02 | Database | SQLite schema, migrations, seed | ✅ |
| 03 | Commands | Tauri CRUD commands + invoke wrapper | ✅ |
| 04 | Battle Engine | Pure Rust engine (types, damage, status, engine, +tests) | ✅ |
| 05 | Twitch | EventSub, polls, auth, test mode stub | ✅ |
| 01-b | HTTP Bridge | tiny_http server, shared state, fetch polling hook | ✅ |
| 06 | Admin UI | CRUD forms, LLM Generate Stats | ✅ |
| 07 | Overlay Layers | 4-layer system, sprites, environment, animations | ✅ |
| 08 | Overlay UI | HP/MP bars, status icons, floating numbers, timer | ✅ |
| 09 | Draft | Streamer lineup, 3-poll chat draft, RNG wildcard | ✅ |
| 10 | Dashboard | Battle control, move selector, surrender, settings | ✅ |
| 11 | Wiki | Searchable monsters/hunters/type chart | ✅ |
| 12 | History/Stats | Logs + charts (recharts) | ✅ |
| 13 | Polish | Final polish, cleanup, documentation | ✅ |

## Dev Environment Rules (Termux/Android)

- **No rustup** — cargo only
- **Tauri binary won't link** — use `cargo check` + `cargo test --lib`, NOT `cargo run`/`cargo build --bin`
- **`tsc` not in PATH** — use `node node_modules/.bin/tsc`
- **Build:** `node node_modules/.bin/tsc && node node_modules/.bin/vite build`
- **Stale `.rlib` files** — add to `.gitignore` immediately
- **DB tests:** at least one file-backed test per task (real SQLite file, not just in-memory)
- **All Rust modules with logic** must have `#[cfg(test)]` unit tests

## Key Design Decisions

- **DB path:** `app.path().app_data_dir()` via `.setup()` (not CWD)
- **Async DB:** `tokio::sync::Mutex<Connection>` for async safety
- **No shadcn/ui:** Raw Tailwind + Lucide icons
- **Sprite placeholders:** CSS colored rectangles + first letter (no file deps)
- **Poll encoding:** `monsterId:abilityId` format in poll choice titles
- **Test mode:** No Twitch creds → polls auto-resolve after duration
- **Battle state:** `Arc<RwLock<BattleState>>` shared between Tauri commands and HTTP bridge

## Anti-Scope (v1)

No items/equipment, no Channel Points/Sub/Bits effects, no OAuth (keep .env), no multi-Hunter, no Kick/YouTube, no public wiki hosting, no LUCK drops, no Mac/Linux builds

## Quality Standards

- Commit after each task with conventional commit
- Verify: `cargo check`, `cargo test`, `vite build`
- Update `ISSUES.md` when new workarounds/bugs are discovered
- Sprite fallback works without any image files

---

# AGENTA.md — Code Quality & Analysis Toolkit

> Reference document for AI agents working with Python, Rust, and TypeScript codebases.
> Use this file to select the right tool for linting, static analysis, dead code detection, bug catching, and formatting.

---

## Python

### Formatting
| Tool | Purpose | Command |
|------|---------|---------|
| **Black** | Opinionated code formatter | `black .` |
| **isort** | Sort and organize imports | `isort .` |
| **autopep8** | Auto-fix PEP 8 violations | `autopep8 --in-place --recursive .` |
| **Ruff** | Ultra-fast formatter (replaces Black + isort) | `ruff format .` |

### Linting & Style
| Tool | Purpose | Command |
|------|---------|---------|
| **Ruff** | All-in-one linter (replaces flake8, pydocstyle, etc.) | `ruff check .` |
| **Pylint** | Deep static analysis, logic errors, conventions | `pylint src/` |
| **flake8** | Style guide enforcement (PEP 8) | `flake8 .` |
| **pydocstyle** | Docstring conventions | `pydocstyle src/` |

### Type Checking
| Tool | Purpose | Command |
|------|---------|---------|
| **mypy** | Static type checker | `mypy .` |
| **pyright** | Microsoft's type checker (Pylance backend) | `pyright .` |
| **pytype** | Google's type checker with inference | `pytype src/` |

### Dead Code Detection
| Tool | Purpose | Command |
|------|---------|---------|
| **Vulture** | Find unused variables, functions, classes, imports | `vulture src/` |
| **deadcode** | Simple CLI for dead code detection | `deadcode src/` |
| **unimport** | Remove unused imports | `unimport --remove src/` |
| **autoflake** | Auto-remove unused imports/variables | `autoflake --in-place --recursive .` |

### Bug & Security Detection
| Tool | Purpose | Command |
|------|---------|---------|
| **Pylint** | Logic errors, undefined variables, wrong arg counts | `pylint src/` |
| **bandit** | Security vulnerability scanner | `bandit -r src/` |
| **flake8-bugbear** | Bug pattern detection | `flake8 --select=B .` |
| **semgrep** | Pattern-based security and bug detection | `semgrep --config=auto .` |
| **pydantic** | Runtime type validation | (import in code) |
| **prospector** | Meta-tool wrapping pylint, pep8, etc. | `prospector .` |

### Testing & Coverage
| Tool | Purpose | Command |
|------|---------|---------|
| **pytest** | Testing framework | `pytest` |
| **coverage.py** | Code coverage analysis | `coverage run -m pytest` |
| **mutmut** | Mutation testing | `mutmut run` |

### Recommended Python Stack
```bash
# Format + Lint (fast, all-in-one)
ruff format . && ruff check .

# Type check
mypy .

# Dead code
vulture src/

# Security
bandit -r src/

# Test + coverage
pytest && coverage report
```

---

## Rust

### Built-in Tools (via Cargo)
| Tool | Purpose | Command |
|------|---------|---------|
| **rustc** | Compiler with strict warnings and lints | `rustc --warn ...` |
| **cargo check** | Fast syntax/type check without full compile | `cargo check` |
| **cargo fmt** | Official formatter (rustfmt) | `cargo fmt` |
| **cargo clippy** | Advanced linting with pedantic lints | `cargo clippy -- -W clippy::pedantic` |
| **cargo fix** | Auto-apply rustc/clippy suggestions | `cargo fix` |

### Dead Code Detection
| Tool | Purpose | Command |
|------|---------|---------|
| **rustc dead_code lint** | Built-in unused function/variable/import warnings | (enabled by default) |
| **cargo-udeps** | Find unused dependencies in Cargo.toml | `cargo udeps` |
| **cargo-machete** | Fast unused dependency finder | `cargo machete` |
| **cargo-modules** | Visualize module structure, spot orphans | `cargo modules generate tree` |

### Bug & Security Detection
| Tool | Purpose | Command |
|------|---------|---------|
| **cargo clippy** | Catches panics, inefficiencies, API misuse, logic errors | `cargo clippy` |
| **cargo audit** | Security vulnerabilities in dependencies | `cargo audit` |
| **cargo deny** | Ban risky crates, check security advisories | `cargo deny check` |
| **cargo geiger** | Detect unsafe code usage | `cargo geiger` |
| **miri** | Catch undefined behavior in unsafe code | `cargo miri test` |
| **cargo tarpaulin** | Code coverage | `cargo tarpaulin` |

### Recommended Rust Stack
```bash
# Format + Lint + Fix
cargo fmt && cargo clippy -- -W clippy::pedantic && cargo fix

# Check unused deps
cargo machete

# Security audit
cargo audit

# Test + coverage
cargo test && cargo tarpaulin
```

---

## TypeScript

### Linting & Analysis
| Tool | Purpose | Command |
|------|---------|---------|
| **ESLint** | Standard linter with TS support | `eslint . --ext .ts,.tsx` |
| **@typescript-eslint/parser** | TS parser for ESLint | (in eslint config) |
| **@typescript-eslint/eslint-plugin** | TS-specific lint rules | (in eslint config) |
| **TSLint** | **DEPRECATED** — do not use | — |

### Type Checking
| Tool | Purpose | Command |
|------|---------|---------|
| **tsc** | TypeScript compiler type check | `tsc --noEmit` |
| **TypeScript-Strict-Plugin** | Incremental strict mode enforcement | (plugin setup) |

### Formatting
| Tool | Purpose | Command |
|------|---------|---------|
| **Prettier** | Opinionated formatter | `prettier --write .` |
| **dprint** | Fast alternative formatter | `dprint fmt` |

### Dead Code Detection
| Tool | Purpose | Command |
|------|---------|---------|
| **Knip** | Find unused files, deps, exports, class members | `knip` |
| **ts-prune** | Find unused exports | `ts-prune` |
| **depcheck** | Find unused npm dependencies | `depcheck` |
| **ESLint** | `no-unused-vars`, `no-unused-modules` rules | (in eslint config) |
| **tsc** | Flag unused locals/parameters | `tsc --noUnusedLocals --noUnusedParameters` |

### Bug & Security Detection
| Tool | Purpose | Command |
|------|---------|---------|
| **tsc** | Type errors as first defense | `tsc --noEmit` |
| **ESLint + @typescript-eslint** | Catches `any` misuse, promise mishandling, null issues | `eslint .` |
| **eslint-plugin-sonarjs** | Cognitive complexity and bug detection | (in eslint config) |
| **eslint-plugin-unicorn** | Suboptimal and buggy pattern detection | (in eslint config) |
| **semgrep** | Pattern-based security and bug detection | `semgrep --config=auto .` |

### Documentation
| Tool | Purpose | Command |
|------|---------|---------|
| **TypeDoc** | Generate TS documentation | `typedoc src/` |

### Recommended TypeScript Stack
```bash
# Type check
tsc --noEmit

# Lint + fix
eslint . --ext .ts,.tsx --fix

# Format
prettier --write .

# Dead code
knip

# Security
semgrep --config=auto .
```

---

## Cross-Language Tools

| Tool | Languages | Purpose |
|------|-----------|---------|
| **semgrep** | Python, Rust, TS, +more | Pattern-based security & bug detection |
| **SonarQube / SonarCloud** | All major languages | Comprehensive code quality platform |
| **CodeQL** | Python, Rust, TS, +more | Semantic code analysis (GitHub) |
| **Snyk** | All major languages | Security scanning for code + dependencies |

---

## Quick Decision Matrix

| Goal | Python | Rust | TypeScript |
|------|--------|------|------------|
| Format code | `ruff format` / `black` | `cargo fmt` | `prettier` |
| Lint / style | `ruff check` / `pylint` | `cargo clippy` | `eslint` |
| Type check | `mypy` / `pyright` | `cargo check` | `tsc --noEmit` |
| Find dead code | `vulture` | `cargo machete` | `knip` |
| Catch bugs | `pylint` + `flake8-bugbear` | `cargo clippy` | `eslint` + `tsc` |
| Security scan | `bandit` | `cargo audit` | `semgrep` |
| Fix auto-magically | `ruff check --fix` | `cargo fix` | `eslint --fix` |

---

## Notes for AI Agents

- Always run `cargo check` before `cargo build` in Rust to save time.
- In Python, prefer **Ruff** over separate `black` + `flake8` + `isort` for speed.
- In TypeScript, `tsc --noEmit` is your friend for CI type checking.
- Use **Knip** for TS dead code — it's the most thorough tool available.
- For security, run **bandit** (Python), **cargo audit** (Rust), and **semgrep** (TS) in CI pipelines.
- When suggesting fixes, prefer tools with `--fix` or `cargo fix` flags before manual edits.

---

*Last updated: 2026-06-12*
