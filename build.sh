npx tsc
# put `else` statements on the same line as preceding `}` - just to match prior coffeescript formatting to reduce diff noise - can remove after coffee->typescript migration is complete
node -e '
var fs=require("fs");
const content = fs.readFileSync("src/omelette.js", "utf8");
const updated = content.replaceAll(/}\n +else /g, "} else ");
fs.writeFileSync("src/omelette.js", updated);
'
