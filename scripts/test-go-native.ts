import { getLanguageParser, extractGoRoutes } from "../src/main/lib/scanner/omniroute/treeSitterEngine";

async function runGoNativeTestSuite() {
  console.log("================================================================================");
  console.log("  RouteLens Native Go (net/http & Go 1.22+) Verification Suite");
  console.log("================================================================================\n");

  const { parser } = await getLanguageParser("go");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}${detail ? ` (${detail})` : ""}`);
      failed++;
    }
  }

  // TEST 1: Go 1.22+ Method-Prefixed ServeMux Routes
  console.log("--- TEST SECTION 1: Go 1.22+ Enhanced Routing Spec ---");
  const go122Code = `
    package main
    import "net/http"
    func main() {
      mux := http.NewServeMux()
      mux.HandleFunc("GET /api/users", listUsers)
      mux.HandleFunc("POST /api/users", createUser)
      mux.HandleFunc("GET /api/users/{id}", getUser)
      mux.HandleFunc("PUT /api/users/{id}", updateUser)
      mux.HandleFunc("DELETE /api/users/{id}", deleteUser)
      http.HandleFunc("POST /api/login", handleLogin)
    }
  `;
  const tree1 = parser.parse(go122Code);
  const routes1 = extractGoRoutes(tree1, "/test/main.go");

  assert(routes1.length === 6, "Extract all 6 Go 1.22 routes", `got ${routes1.length}`);
  assert(routes1.some(r => r.method === "GET" && r.path === "/api/users"), "Detect GET /api/users");
  assert(routes1.some(r => r.method === "POST" && r.path === "/api/users"), "Detect POST /api/users");
  assert(routes1.some(r => r.method === "GET" && r.path === "/api/users/{id}"), "Detect GET /api/users/{id}");
  assert(routes1.some(r => r.method === "PUT" && r.path === "/api/users/{id}"), "Detect PUT /api/users/{id}");
  assert(routes1.some(r => r.method === "DELETE" && r.path === "/api/users/{id}"), "Detect DELETE /api/users/{id}");
  assert(routes1.some(r => r.method === "POST" && r.path === "/api/login"), "Detect http.HandleFunc POST /api/login");
  assert(routes1.every(r => r.framework === "go-http"), "Framework is tagged as 'go-http'");

  // TEST 2: Host-based routing (Go 1.22 spec)
  console.log("\n--- TEST SECTION 2: Host-based Routing Spec ---");
  const hostCode = `
    package main
    import "net/http"
    func main() {
      mux := http.NewServeMux()
      mux.HandleFunc("GET api.example.com/v1/health", healthCheck)
      mux.HandleFunc("POST app.internal/webhook", webhookHandler)
    }
  `;
  const tree2 = parser.parse(hostCode);
  const routes2 = extractGoRoutes(tree2, "/test/host.go");
  assert(routes2.some(r => r.method === "GET" && r.path === "/v1/health"), "Strip host prefix: /v1/health");
  assert(routes2.some(r => r.method === "POST" && r.path === "/webhook"), "Strip host prefix: /webhook");

  // TEST 3: Symbolic Constant & Concatenation Folding
  console.log("\n--- TEST SECTION 3: Symbolic Constant & Concatenation Folding ---");
  const constCode = `
    package main
    import "net/http"
    const (
      BaseAPI = "/api/v2"
      OrdersSub = "/orders"
    )
    func setupRoutes(mux *http.ServeMux) {
      mux.HandleFunc("GET " + BaseAPI + "/users", getUsers)
      mux.HandleFunc("POST " + BaseAPI + OrdersSub, createOrder)
    }
  `;
  const tree3 = parser.parse(constCode);
  const routes3 = extractGoRoutes(tree3, "/test/const.go");
  assert(routes3.some(r => r.method === "GET" && r.path === "/api/v2/users"), "Evaluate binary concatenation 'GET ' + BaseAPI + '/users'");
  assert(routes3.some(r => r.method === "POST" && r.path === "/api/v2/orders"), "Evaluate multi-constant concatenation '/api/v2/orders'");

  // TEST 4: Classic Go Pre-1.22 with Intra-Handler Method Inspection
  console.log("\n--- TEST SECTION 4: Classic Go Method Switching ---");
  const classicCode = `
    package main
    import "net/http"
    func itemsHandler(w http.ResponseWriter, r *http.Request) {
      if r.Method == http.MethodPost {
        createItem(w, r)
      } else if r.Method == "DELETE" {
        deleteItem(w, r)
      }
    }
    func main() {
      mux := http.NewServeMux()
      mux.HandleFunc("/api/items", itemsHandler)
      mux.HandleFunc("/api/switch", func(w http.ResponseWriter, r *http.Request) {
        switch r.Method {
        case "GET":
          getSwitch(w, r)
        case "PUT":
          putSwitch(w, r)
        }
      })
      mux.HandleFunc("/api/simple", simpleHandler)
    }
  `;
  const tree4 = parser.parse(classicCode);
  const routes4 = extractGoRoutes(tree4, "/test/classic.go");
  assert(routes4.some(r => r.method === "POST" && r.path === "/api/items"), "Extract POST from r.Method == http.MethodPost");
  assert(routes4.some(r => r.method === "DELETE" && r.path === "/api/items"), "Extract DELETE from r.Method == 'DELETE'");
  assert(routes4.some(r => r.method === "GET" && r.path === "/api/switch"), "Extract GET from switch r.Method");
  assert(routes4.some(r => r.method === "PUT" && r.path === "/api/switch"), "Extract PUT from switch r.Method");
  assert(routes4.some(r => r.method === "GET" && r.path === "/api/simple"), "Default uninspected handler to GET");

  // TEST 5: Sub-Mux Mounting (http.StripPrefix)
  console.log("\n--- TEST SECTION 5: Sub-Mux Mounting (http.StripPrefix) ---");
  const subMuxCode = `
    package main
    import "net/http"
    func main() {
      apiMux := http.NewServeMux()
      apiMux.HandleFunc("GET /products", getProducts)
      apiMux.HandleFunc("POST /products", createProduct)

      rootMux := http.NewServeMux()
      rootMux.Handle("/api/v1/", http.StripPrefix("/api/v1", apiMux))
    }
  `;
  const tree5 = parser.parse(subMuxCode);
  const routes5 = extractGoRoutes(tree5, "/test/submux.go");
  assert(routes5.some(r => r.method === "GET" && r.path === "/api/v1/products"), "Sub-mux mount links GET /api/v1/products");
  assert(routes5.some(r => r.method === "POST" && r.path === "/api/v1/products"), "Sub-mux mount links POST /api/v1/products");

  // TEST 6: Zero Regression on Framework Go (Gin)
  console.log("\n--- TEST SECTION 6: Zero Regression on Framework Go (Gin) ---");
  const ginCode = `
    package main
    import "github.com/gin-gonic/gin"
    func main() {
      r := gin.Default()
      v1 := r.Group("/v1")
      v1.GET("/users", listUsers)
      v1.POST("/users", createUser)
    }
  `;
  const tree6 = parser.parse(ginCode);
  const routes6 = extractGoRoutes(tree6, "/test/gin.go");
  assert(routes6.length === 2, "Gin framework routes still extracted correctly", `got ${routes6.length}`);
  assert(routes6.some(r => r.framework === "gin" && r.method === "GET" && r.path === "/v1/users"), "Gin GET /v1/users preserved");
  assert(routes6.some(r => r.framework === "gin" && r.method === "POST" && r.path === "/v1/users"), "Gin POST /v1/users preserved");

  console.log("\n================================================================================");
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runGoNativeTestSuite().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
