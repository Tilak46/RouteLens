import fs from "node:fs";
import { getLanguageParser, resolveGoExpressionString } from "../src/main/lib/scanner/omniroute/treeSitterEngine";

async function run() {
  const { parser } = await getLanguageParser("go");

  interface ChainInfo {
    methods: string[];
    path: string | null;
    querySubresource: string | null;
    rootReceiver: string;
    calls: any[];
  }

  function unwrapChain(rootCall: any): ChainInfo {
    const methods: string[] = [];
    let path: string | null = null;
    let querySubresource: string | null = null;
    let curr: any = rootCall;
    const calls: any[] = [];
    let rootReceiver = "";

    while (curr && curr.type === "call_expression") {
      calls.push(curr);
      const fn = curr.childForFieldName("function");
      if (!fn || fn.type !== "selector_expression") break;
      const field = fn.childForFieldName("field");
      const operand = fn.childForFieldName("operand");
      const fieldName = field?.text;

      const args = curr.childForFieldName("arguments")?.namedChildren || [];

      if (fieldName === "Path" || fieldName === "Combo") {
        if (args.length >= 1 && !path) {
          path = resolveGoExpressionString(args[0]);
        }
      } else if (fieldName === "Methods") {
        for (const arg of args) {
          const m = resolveGoExpressionString(arg);
          if (m) methods.push(m.toUpperCase());
        }
      } else if (fieldName === "Queries") {
        if (args.length >= 1 && !querySubresource) {
          const q = resolveGoExpressionString(args[0]);
          if (q) querySubresource = q;
        }
      } else if (fieldName === "Handle" || fieldName === "HandleFunc") {
        if (args.length >= 2 && !path) {
          path = resolveGoExpressionString(args[0]);
        }
      } else if (fieldName && ["Get", "Post", "Put", "Delete", "Patch", "Head", "Options"].includes(fieldName)) {
        methods.push(fieldName.toUpperCase());
      }

      if (operand && operand.type === "call_expression") {
        curr = operand;
      } else {
        if (operand) rootReceiver = operand.text;
        break;
      }
    }

    const hasHandler = calls.some(c => {
      const f = c.childForFieldName("function")?.childForFieldName("field")?.text;
      return f === "HandlerFunc" || f === "Handler";
    });
    if (methods.length > 0 && hasHandler && !path) {
      path = "/";
    }

    return { methods, path, querySubresource, rootReceiver, calls };
  }

  const adminCode = fs.readFileSync(".temp-benchmarks/go-native-eval-2/minio/cmd/admin-router.go", "utf-8");
  const adminTree = parser.parse(adminCode);
  const uniqueKeys = new Set<string>();
  const handledIds = new Set<number>();
  function walkAdmin(n: any) {
    if (n.type === "call_expression" && !handledIds.has(n.id)) {
      const chain = unwrapChain(n);
      if (chain.path && chain.methods.length > 0) {
        for (const call of chain.calls) {
          handledIds.add(call.id);
        }
        for (const m of chain.methods) {
          const fullPath = chain.querySubresource ? `${chain.path}?${chain.querySubresource}` : chain.path;
          uniqueKeys.add(`${m}:${fullPath}`);
        }
      }
    }
    for (let i = 0; i < n.childCount; i++) walkAdmin(n.child(i));
  }
  walkAdmin(adminTree.rootNode);
  console.log("Total MinIO unique routes with queries in admin-router.go:", uniqueKeys.size);
  console.log("Admin sample:", Array.from(uniqueKeys).slice(0, 10));
}

run();
