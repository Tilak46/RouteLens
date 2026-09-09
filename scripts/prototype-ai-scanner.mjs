import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { getLlama, LlamaChatSession } from "node-llama-cpp";
import { ensureModel } from "./download-model.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Strict JSON Schema enforced on model token generation via GBNF
export const RouteScanSchema = {
  type: "object",
  properties: {
    framework: {
      type: "string",
      description: "Detected framework: express, fastapi, gin, or custom",
    },
    routes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
          },
          path: {
            type: "string",
            description: "HTTP route endpoint path",
          },
          summary: {
            type: "string",
            description: "Brief endpoint summary",
          },
          params: {
            type: "array",
            items: { type: "string" },
            description: "Path parameter names like id, token",
          },
          body: {
            type: "array",
            items: { type: "string" },
            description: "Request body fields like email, password, price",
          },
        },
        required: ["method", "path"],
      },
    },
  },
  required: ["framework", "routes"],
};

// Realistic Multi-Language Fixtures
export const TEST_FIXTURES = [
  {
    name: "Express.js — Router Endpoints",
    language: "javascript",
    code: `
const express = require('express');
const router = express.Router();

router.get('/products', (req, res) => res.json([]));
router.post('/products', (req, res) => {
  const { title, price, sku } = req.body;
  res.status(201).json({ created: true });
});
router.delete('/products/:id', (req, res) => {
  res.json({ deleted: req.params.id });
});

module.exports = router;
`,
  },
  {
    name: "Python FastAPI — Pydantic DTO & Path Params",
    language: "python",
    code: `
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/users")

class UserCreateDto(BaseModel):
    username: str
    email: str
    password: str

@router.get("/{user_id}")
async def get_user(user_id: int):
    return {"id": user_id}

@router.post("/")
async def create_user(dto: UserCreateDto):
    return {"created": dto.username}

@router.delete("/{user_id}")
async def delete_user(user_id: int):
    return {"deleted": user_id}
`,
  },
  {
    name: "Go Gin — JSON Binding & Routes",
    language: "go",
    code: `
package auth

import "github.com/gin-gonic/gin"

type RegisterInput struct {
	Email    string \`json:"email"\`
	Password string \`json:"password"\`
}

func RegisterRoutes(r *gin.Engine) {
	v1 := r.Group("/auth")
	{
		v1.POST("/register", func(c *gin.Context) {
			var input RegisterInput
			c.ShouldBindJSON(&input)
			c.JSON(201, gin.H{"ok": true})
		})

		v1.GET("/verify/:token", func(c *gin.Context) {
			c.JSON(200, gin.H{"token": c.Param("token")})
		})

		v1.DELETE("/sessions", func(c *gin.Context) {
			c.JSON(200, gin.H{"logout": true})
		})
	}
}
`,
  },
  {
    name: "Custom Framework / In-House Route Wrapper",
    language: "typescript",
    code: `
// Proprietary internal wrapper that breaks standard AST visitors
import { registerApi } from './core';

export const OrdersApi = registerApi('/orders', [
  { method: 'GET', path: '/list', action: 'List active orders' },
  { method: 'POST', path: '/create', payload: ['customerId', 'totalAmount'], action: 'Create order' },
  { method: 'DELETE', path: '/:orderId/cancel', params: ['orderId'], action: 'Cancel order' }
]);
`,
  },
  {
    name: "Real Repo: node-express-postgresql-sequelize (user.routes.js)",
    language: "javascript",
    code: `
const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const { validateUser } = require("../middlewares/user.validation");
const validate = require("../middlewares/validate");

// Base route: /api/users
router.post("/", validateUser, validate, userController.create);
router.put("/:id", validateUser, validate, userController.update);
router.get("/", userController.findAll);
router.get("/:id", userController.findOne);
router.delete("/:id", userController.delete);

module.exports = router;
`,
  },
  {
    name: "Real Repo: api-design-node-v3 (item.router.js — chained .route())",
    language: "javascript",
    code: `
import { Router } from 'express'
import controllers from './item.controllers'

const router = Router()

// /api/item
router
  .route('/')
  .get(controllers.getOne)
  .post(controllers.createOne)

// /api/item/:id
router
  .route('/:id')
  .get(controllers.getOne)
  .put(controllers.updateOne)
  .delete(controllers.removeOne)

export default router
`,
  },
];

export async function runScannerPrototype(options = {}) {
  const modelKey = options.model || "0.5b";
  console.log("================================================================================");
  console.log(`  OmniRoute Local Neural Engine Prototype — Qwen2.5-Coder (${modelKey.toUpperCase()})`);
  console.log("================================================================================\n");

  const modelPath = await ensureModel(modelKey);

  console.log("\n[Llama] Initializing on-device llama.cpp engine...");
  const initStart = performance.now();
  const llama = await getLlama();
  const model = await llama.loadModel({ modelPath });
  const context = await model.createContext({ threads: 6, contextSize: 2048 });
  const initDuration = ((performance.now() - initStart) / 1000).toFixed(2);
  console.log(`[Llama] Engine ready in ${initDuration}s!`);

  console.log("[Llama] Compiling strict GBNF JSON Schema grammar...");
  const grammarStart = performance.now();
  const grammar = await llama.createGrammarForJsonSchema(RouteScanSchema);
  console.log(`[Llama] Grammar compiled in ${(performance.now() - grammarStart).toFixed(1)}ms`);

  console.log("\n--------------------------------------------------------------------------------");
  console.log(`  Executing Multi-Language Test Battery (${TEST_FIXTURES.length} test fixtures)`);
  console.log("--------------------------------------------------------------------------------\n");

  const session = new LlamaChatSession({
    contextSequence: context.getSequence(),
    systemPrompt: "You are a backend API scanner. Extract all HTTP endpoints, route paths, HTTP methods, route parameters, and request body fields from the given source code. Output strictly valid JSON complying with the schema.",
  });

  const results = [];

  for (let i = 0; i < TEST_FIXTURES.length; i++) {
    const fixture = TEST_FIXTURES[i];
    console.log(`\n▶ [${i + 1}/${TEST_FIXTURES.length}] Testing: ${fixture.name} (${fixture.language})`);

    // Reset session chat history between test fixtures
    session.resetChatHistory();

    const promptText = `Extract all routes from this ${fixture.language} code:\n\`\`\`${fixture.language}\n${fixture.code.trim()}\n\`\`\``;

    const runStart = performance.now();
    let tokenCount = 0;

    let rawResponse = "";
    try {
      rawResponse = await session.prompt(promptText, {
        grammar,
        temperature: 0.1,
        maxTokens: 512,
        onToken: () => {
          tokenCount++;
        },
      });
    } catch (err) {
      console.error(`  Error during generation: ${err.message}`);
      continue;
    }

    const elapsedMs = Math.round(performance.now() - runStart);
    const tokensPerSec = tokenCount > 0 ? ((tokenCount / elapsedMs) * 1000).toFixed(1) : "0";

    let parsed = null;
    let isValidJson = false;
    try {
      parsed = JSON.parse(rawResponse);
      isValidJson = true;
    } catch (err) {
      isValidJson = false;
    }

    const memUsage = (process.memoryUsage().rss / (1024 * 1024)).toFixed(1);

    results.push({
      fixtureName: fixture.name,
      language: fixture.language,
      isValidJson,
      routeCount: parsed?.routes?.length || 0,
      detectedFramework: parsed?.framework || "unknown",
      elapsedMs,
      tokenCount,
      tokensPerSec,
      memMB: memUsage,
      routes: parsed?.routes || [],
    });

    console.log(`  ✓ JSON Valid: ${isValidJson ? "YES (100%)" : "NO"}`);
    console.log(`  ✓ Framework: ${parsed?.framework} | Routes Discovered: ${parsed?.routes?.length || 0}`);
    console.log(`  ✓ Performance: ${elapsedMs}ms | ${tokensPerSec} tokens/sec | RAM: ${memUsage} MB`);

    if (parsed?.routes) {
      for (const r of parsed.routes) {
        const bodyStr = r.body?.length ? ` [Body: ${r.body.join(", ")}]` : "";
        const paramStr = r.params?.length ? ` [Params: ${r.params.join(", ")}]` : "";
        console.log(`     • ${r.method.padEnd(6)} ${r.path.padEnd(28)} ${r.summary || ""}${paramStr}${bodyStr}`);
      }
    }
  }

  console.log("\n================================================================================");
  console.log("  Benchmark Summary & Evaluation Metrics");
  console.log("================================================================================");
  console.table(
    results.map((r) => ({
      Test: r.fixtureName.split("—")[0].trim(),
      Lang: r.language,
      "Valid JSON": r.isValidJson ? "100%" : "FAIL",
      Routes: r.routeCount,
      Latency: `${r.elapsedMs}ms`,
      Speed: `${r.tokensPerSec} t/s`,
      RAM: `${r.memMB} MB`,
    }))
  );

  return results;
}

const isMain = process.argv[1] && (
  process.argv[1].endsWith("prototype-ai-scanner.mjs") ||
  process.argv[1].endsWith("prototype-ai-scanner.js")
);

if (isMain) {
  const modelArg = process.argv[2] || "0.5b";
  runScannerPrototype({ model: modelArg })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Prototype failed:", err);
      process.exit(1);
    });
}
