# OmniRoute Universal Engine (OUE) — Architecture Specification
**Next-Generation Multi-Language, Multi-Framework Route & API Intelligence Platform**

---

## 1. Executive Summary & Vision

RouteLens exists to eliminate the manual, friction-filled developer experience of building, updating, and synchronizing API clients, Swagger/OpenAPI documentation, and Postman collections. Developers should be able to open **any repository in any language** and have RouteLens discover 100% of its API routes, HTTP methods, route parameters, and request payload schemas instantly—with zero manual configuration.

### The Strategic Goal
Build a universal, scalable, and uncopyable code-intelligence engine that:
1. Operates on **raw, uninstalled source code** (zero dependency installation, zero Docker, zero databases required).
2. Scales across **every major programming language** (JavaScript, TypeScript, Python, Go, Java, Rust, PHP, C#).
3. Replaces fragile 3,000-line AST visitor scripts with a **Declarative Framework DSL** where adding support for a new framework takes 15 minutes instead of 2 months.
4. Resolves dynamic routing patterns (string concatenation, loops, array registrations) through **Symbolic Abstract Interpretation**.
5. Bridges the remaining dynamic edge cases via an **in-process runtime probe** and an optional **on-device neural model**.

---

## 2. The Glass Ceiling of Traditional AST Scanners

Current static analysis tools (including RouteLens's previous Babel-based scanner) rely on **Runtime Simulation via AST Visitors**:
- They attempt to trace imperative execution: *"Did variable `x` originate from `express()`? Was it passed into `function y`? Was `router` mounted in `app.use`? Was it exported via `module.exports`?"*

### Why the Simulation Approach Breaks Down:
1. **Dynamic Code Constructs**: Developers frequently write routes inside loops (`routes.forEach(r => app[r.method](...))`), use dynamic directory loaders (`fs.readdirSync`), or create route factory functions (`makeCrudRouter(Model)`). When code deviates from rigid standard templates, the static dependency chain snaps, causing routes to vanish.
2. **Language Fragmentation**: Babel only understands JavaScript and TypeScript. Supporting Python (FastAPI/Django), Go (Gin/Fiber), or Java (Spring Boot) would require writing and maintaining completely independent, massive AST parsers for each language.
3. **Maintenance Overhead**: Each edge case requires another nested `if/else` block inside a monolithic parser file, leading to high regression risks and unsustainable technical debt.

---

## 3. The 5-Layer OmniRoute Architecture

```mermaid
flowchart TD
    subgraph Layer 1 [Universal Ingestion]
        A[Source Files in Any Language: JS/TS, Python, Go, Java, Rust, PHP, C#] --> B[Tree-sitter WASM Multi-Language CST Engine]
    end

    subgraph Layer 2 [Symbolic Abstract Interpretation]
        B --> C[Symbolic Constant Propagation & Math]
        B --> D[Loop & Array Unrolling Engine]
        B --> E[Type & Schema Harvester]
    end

    subgraph Layer 3 [Declarative Framework DSL]
        F[Framework Signatures: Express, FastAPI, Gin, Spring, Rails, etc.] --> G[Pattern Matcher & Binder]
        C --> G
        D --> G
        E --> G
    end

    subgraph Layer 4 [Convention Linker]
        G --> H[Namespace & URL Tree Linker]
        H --> I[Unified Route Manifest]
    end

    subgraph Layer 5 [Hybrid Safety Nets]
        I --> J{Unresolved Dynamic / Ambiguous Routes?}
        J -- Dynamic Loops / DB-driven --> K[Zero-Config Runtime Probe (app._router.stack)]
        J -- Bespoke In-House Syntax --> L[On-Device Local Neural Model (0 Cloud Tokens)]
        K --> M[100% Ground Truth Route Table & Payloads]
        L --> M
        J -- Clean Static --> M
    end
```

---

### Layer 1: Universal Tree-sitter Concrete Syntax Tree (CST)
- **Technology**: Tree-sitter compiled to WebAssembly (`web-tree-sitter`) running in Electron's Node environment.
- **Performance**: Parses files in **1 to 3 milliseconds** per file with an ultra-compact memory footprint (~5 MB per grammar).
- **Fault-Tolerant by Design**: Tree-sitter never throws fatal exceptions on syntax errors, partial code, or template tags (unlike Babel which threw syntax errors on EJS `<% if ... %>` files).
- **Universal Grammar Coverage**:
  - JavaScript / TypeScript (Express, NestJS, Next.js, Fastify, Hono, Koa)
  - Python (FastAPI, Flask, Django, Tornado)
  - Go (Gin, Fiber, Echo, Chi, standard `net/http`)
  - Java / Kotlin (Spring Boot, Micronaut, Quarkus)
  - Rust (Actix-web, Axum, Rocket)
  - PHP (Laravel, Symfony)
  - C# / .NET (ASP.NET Core Web API)
  - Ruby (Ruby on Rails, Sinatra)

---

### Layer 2: Bounded Symbolic Abstract Interpretation
Instead of running arbitrary code (which would trigger crashes from missing databases or environment variables), OmniRoute executes an **Abstract Symbolic Virtual Machine**:

1. **Constant Propagation & String Concatenation**:
   Traces constant values across scopes without running the code:
   ```javascript
   const API_PREFIX = "/api/v1";
   const USERS_URL = API_PREFIX + "/users";
   router.get(USERS_URL + "/:id", ...);
   ```
   *Symbolic Result*: Mathematically folds the string tree into **`"/api/v1/users/:id"`**.

2. **Loop & Array Unrolling**:
   Detects programmatic route declaration arrays and unrolls them symbolically:
   ```javascript
   const methods = ["get", "post", "delete"];
   methods.forEach(m => app[m]("/items", handler));
   ```
   *Symbolic Result*: Evaluates each element to emit `GET /items`, `POST /items`, and `DELETE /items`.

3. **Schema & DTO Field Extractor**:
   Traverses type nodes and validation libraries directly:
   - TypeScript `interfaces` and `classes`
   - Zod (`z.object({...})`), Joi, Celebrate, and `express-validator`
   - Python Pydantic models (`class UserCreate(BaseModel): ...`)
   - Go struct tags (`type User struct { Name string `json:"name"` }`)
   - Java Spring DTOs (`@RequestBody CreateUserDto dto`)

---

### Layer 3: Declarative Framework Signature DSL
Every web framework in the world reduces to three core primitives:
1. **Route Declaration**: What function call, method, or decorator defines an endpoint?
2. **Mount / Grouping**: How are sub-routers or controllers attached to URL prefixes?
3. **Payload / Parameter Binding**: Where do request body, query parameters, and path variables enter the handler?

Frameworks are defined as clean, declarative YAML/JSON configuration files:

#### Express Definition (`express.yaml`):
```yaml
framework: express
languages: [javascript, typescript]
route_declarations:
  - pattern: "$router.$method($path, ...handlers)"
    where:
      $method: [get, post, put, delete, patch, all]
  - pattern: "$router.route($path).$method(...handlers)"
mount_declarations:
  - pattern: "$app.use($mountPath, $router)"
  - pattern: "$app.use($router)" # defaults to root "/"
payload_bindings:
  - pattern: "const { $fields } = req.body"
  - pattern: "req.body.$field"
  - pattern: "validate($schema)"
```

#### FastAPI Definition (`fastapi.yaml`):
```yaml
framework: fastapi
languages: [python]
route_declarations:
  - pattern: "@$router.$method($path)"
    function: "def $handler(..., $body: $DtoSchema, ...)"
    where:
      $method: [get, post, put, delete, patch]
mount_declarations:
  - pattern: "$app.include_router($router, prefix=$mountPath)"
payload_bindings:
  - pydantic_model: "$DtoSchema"
```

#### Go Gin Definition (`gin.yaml`):
```yaml
framework: gin
languages: [go]
route_declarations:
  - pattern: "$r.$METHOD($path, $handler)"
    where:
      $METHOD: [GET, POST, PUT, DELETE, PATCH]
mount_declarations:
  - pattern: "$group := $r.Group($mountPath)"
payload_bindings:
  - struct_bind: "c.ShouldBindJSON(&$structVar)"
```

---

### Layer 4: Convention Linker & Resource Namespace Resolver
When files are parsed independently, the **Linker** stitches the resulting file manifests together:
1. **Explicit Mount Association**: Matches `mount_declarations` with sub-router manifests.
2. **Resource Name Inherence (Unmounted Fallback)**: If a router file (e.g. `routes/users.js`) is unmounted or loaded dynamically via `fs.readdirSync`, the Linker automatically prefixes the route paths with `/users`.
3. **Zero Collision Guarantee**: Manifests retain file isolation, preventing identical sub-paths (like `GET /` in `users.js` and `cities.js`) from overwriting each other in the deduplication pipeline.

---

### Layer 5: Hybrid Safety Nets (100% Ground Truth)

#### Safety Net A: Zero-Config Runtime Probe (`app._router.stack`)
For complex architectures (such as dynamic routes loaded from a configuration database):
- When the developer runs their backend via DevDash / RouteLens (or with an optional preload flag `node -r @routelens/probe server.js`):
- A lightweight hook reads the framework's in-memory route table directly:
  - **Express**: Reads `app._router.stack`
  - **Fastify**: Reads `fastify.printRoutes()`
  - **Hono**: Reads `app.routes`
  - **NestJS**: Reads `app.getHttpServer()._events.request._router`
- Provides **1000% exact ground truth** for any dynamic codebase.

#### Safety Net B: On-Device Local Neural Engine (Optional Modular Add-on)
For proprietary, highly obscure in-house routing wrappers that do not match standard patterns:
- An optional, downloadable **local quantized ONNX model** (e.g. Qwen2.5-Coder-0.5B running on local CPU/GPU via ONNX Runtime).
- **Zero Cloud API Tokens**: Runs 100% offline, privately, and locally.
- Classifies non-standard route blocks and extracts parameter schemas within 15 milliseconds.
- **Architectural Separation**: Kept as an optional download so the base RouteLens app remains ultra-lightweight (~85 MB).

---

## 4. Honest Engineering Limitations & Boundaries

Every technological design has hard boundaries. Acknowledging them upfront ensures realistic engineering decisions:

| Boundary | Root Cause | Impact | Mitigation in RouteLens |
|---|---|---|---|
| **Database-Driven Routes** | Routes stored in a remote database or CMS (not in code). | Static analysis cannot see what is not on disk. | Handled automatically by the **Layer 5 Runtime Probe** when the backend starts. |
| **Path Explosion in Symbolic Execution** | Exponential branching ($2^N$) from deeply nested boolean flags. | Excessive CPU time per file if unconstrained. | **Bounded Execution**: Hard cap of 5 hops of indirection and a 50ms timeout per file. |
| **Deep Conditional TypeScript Types** | Turing-complete generic type computations (`infer R ? A : B`). | Running full `ts.createProgram` takes 15–45s and 1.5 GB RAM. | **Syntactic Extraction**: Extracts fields directly from target classes, interfaces, and schemas in ~200ms. |
| **Application Package Size** | Embedding an ONNX local LLM in the installer adds ~400 MB. | Increases app installer from 85 MB to 500 MB. | **Modular Add-On**: Keep core app at 85 MB; offer local neural engine as an optional one-click download. |

---

## 5. Phased Implementation Roadmap

### Phase 1: Express Symbolic Engine & Linker (Immediate)
- Migrate `expressParser` from fragile variable lifetime tracking to the **Universal Pattern Harvester**.
- Implement **Bounded Symbolic Constant Propagation** to resolve string concatenations and template literals.
- Integrate the **Convention Linker** to guarantee zero route deduplication loss on dynamic loaders.
- Verify 99.5%+ detection across our 50-repository benchmark suite.

### Phase 2: Declarative Framework Signature DSL
- Abstract framework detection into declarative pattern definitions (`express.yaml`, `nest.yaml`, `next.yaml`).
- Add native support for **Fastify**, **Hono**, and **Koa** with zero core parser refactoring.

### Phase 3: Tree-sitter Multi-Language Expansion
- Integrate `web-tree-sitter` (WASM) into RouteLens.
- Launch support for:
  - **Python**: FastAPI, Flask, Django REST Framework
  - **Go**: Gin, Fiber, Echo
  - **Java**: Spring Boot Web

### Phase 4: Runtime Probe Integration & Local Model Plugin
- Package the zero-config `@routelens/probe` for live route extraction inside the built-in terminal/stack automation runner.
- Introduce the optional modular on-device ONNX engine for bespoke enterprise frameworks.
