import fs from "fs";
import path from "path";
import { getLanguageParser, resolveGoExpressionString } from "../src/main/lib/scanner/omniroute/treeSitterEngine";

async function testConsts() {
  const filePath = path.resolve(".temp-benchmarks/go-holdout/oauth2-proxy/oauthproxy.go");
  const code = fs.readFileSync(filePath, "utf8");
  const { parser } = await getLanguageParser("go");
  const tree = parser.parse(code);

  const fileScopeConstants = new Map<string, string>();
  function collectConstants(node: any) {
    if (node.type === "const_spec" || node.type === "var_spec") {
      const idNodes = node.children.filter((c: any) => c.type === "identifier");
      const exprList = node.children.find((c: any) => c.type === "expression_list");
      if (exprList && idNodes.length > 0) {
        const valNodes = exprList.namedChildren.length > 0 ? exprList.namedChildren : exprList.children.filter((c: any) => c.type !== ",");
        for (let i = 0; i < idNodes.length && i < valNodes.length; i++) {
          const strVal = resolveGoExpressionString(valNodes[i], fileScopeConstants);
          if (strVal !== null) {
            fileScopeConstants.set(idNodes[i].text.trim(), strVal);
          }
        }
      } else {
        const nameNode = node.childForFieldName("name") || node.child(0);
        const valNode = node.childForFieldName("value") || node.children[node.children.length - 1];
        if (nameNode && valNode && nameNode !== valNode) {
          const strVal = resolveGoExpressionString(valNode, fileScopeConstants);
          if (strVal !== null) {
            fileScopeConstants.set(nameNode.text.trim(), strVal);
          }
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      const c = node.child(i);
      if (c && c.type !== "func_literal" && c.type !== "function_declaration") {
        collectConstants(c);
      }
    }
  }
  collectConstants(tree.rootNode);

  console.log("Found constants count:", fileScopeConstants.size);
  console.log("signInPath constant:", fileScopeConstants.get("signInPath"));
  console.log("robotsPath constant:", fileScopeConstants.get("robotsPath"));
}

testConsts();
