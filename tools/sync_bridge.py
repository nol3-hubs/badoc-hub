#!/usr/bin/env python3
"""Sync the dashboard with the Chrome extension in /extension.

  * writes js/bridge-files.js  (base64 map of every extension file, lazy-loaded by the Bridge Installer)
  * keeps REQUIRED_CHROME_VERSION and the Settings-page "Chrome x.y.z" label equal to extension/manifest.json
  * makes sure the KPI Hub-Compliance patches are present in the app core (idempotent)

Replaces the two copies of this logic that used to live inside .github/workflows/package-chrome-extension.yml
and patch index.html; since index.html no longer holds any code, targets are found across js/*.js.
"""
import base64, json, re, sys
from pathlib import Path

root = Path("extension")
js_dir = Path("js")
BRIDGE = js_dir / "bridge-files.js"

files = {p.relative_to(root).as_posix(): base64.b64encode(p.read_bytes()).decode("ascii")
         for p in sorted(root.rglob("*")) if p.is_file()}
BRIDGE.write_text("window.BADOC_BRIDGE_FILES=" + json.dumps(files, separators=(",", ":")) + ";\n", encoding="utf-8")

chrome_version = json.loads((root / "manifest.json").read_text(encoding="utf-8"))["version"]
sources = {p: p.read_text(encoding="utf-8") for p in sorted(js_dir.glob("*.js"))
           if p.name != "bridge-files.js" and "payload" not in p.name}

def patch_exactly_once(pattern, repl, what):
    hits = [p for p, t in sources.items() if pattern.search(t)]
    total = sum(len(pattern.findall(sources[p])) for p in hits)
    if total != 1:
        sys.exit(f"Expected exactly one {what} in js/*.js; found {total}.")
    p = hits[0]
    sources[p] = pattern.sub(repl, sources[p], count=1)

patch_exactly_once(
    re.compile(r'(const\s+REQUIRED_CHROME_VERSION\s*=\s*["\'])[^"\']+(["\'];)'),
    lambda m: m.group(1) + chrome_version + m.group(2), "REQUIRED_CHROME_VERSION declaration")
patch_exactly_once(
    re.compile(r'(const\s+required\s*=\s*firefox\s*\?\s*["\']Firefox\s+[^"\']+["\']\s*:\s*["\']Chrome\s+)[^"\']+(["\'];)'),
    lambda m: m.group(1) + chrome_version + m.group(2), "Settings-page Chrome version label")

# ---- KPI Hub-Compliance patches (already applied; kept so a pristine checkout is repaired the same way as before)
core_path = next((p for p, t in sources.items() if "getMetricValue(rows,block.data,block.metricHeader,name)" in t), None)
if core_path is None:
    sys.exit("Could not find the KPI rendering code in js/*.js.")
t = sources[core_path]
if "v.actual=v.weight;" not in t:
    marker = "        const v=getMetricValue(rows,block.data,block.metricHeader,name);"
    if t.count(marker) != 1:
        sys.exit(f"Expected one KPI card value-rendering point; found {t.count(marker)}.")
    t = t.replace(marker, "\n".join([
        marker, "        // BADOC_HUB_COMPLIANCE_SCORE_WEIGHT_FALLBACK_V1",
        '        if(name==="Hub Compliance Score"){',
        '          const actualText=String(v.actual??"").trim();',
        '          const weightText=String(v.weight??"").trim();',
        '          if((!actualText || actualText==="—") && weightText){',
        "            v.actual=v.weight;", '            v.weight="";', "          }", "        }"]), 1)
threshold = "\n".join([
    '        const zeroGoodThresholdMetrics=["Hub Compliance Score","Feeder Fraud","Linehaul Arrival Points"];',
    "        if(actualNum!==null && zeroGoodThresholdMetrics.includes(name)){",
    '          if(actualNum===0) card.classList.add("kpi-status-a");',
    '          else if(actualNum>=0.1) card.classList.add("kpi-status-below-b");',
    "        }else if(actualNum!==null){"])
threshold_new = threshold.replace('else if(actualNum>=0.1) card', 'else if(actualNum>=0.1 || actualNum<0) card')
if threshold not in t and threshold_new not in t:   # either the original or the already-upgraded form counts as present
    cm = "        const meets=(actual,target)=>lowerIsBetter?actual<=target:actual>=target;\n        if(actualNum!==null){"
    if t.count(cm) != 1:
        sys.exit(f"Expected one KPI threshold-coloring block; found {t.count(cm)}.")
    t = t.replace(cm, "        const meets=(actual,target)=>lowerIsBetter?actual<=target:actual>=target;\n" + threshold, 1)
old_red = 'else if(actualNum>=0.1) card.classList.add("kpi-status-below-b");'
new_red = 'else if(actualNum>=0.1 || actualNum<0) card.classList.add("kpi-status-below-b");'
if old_red in t: t = t.replace(old_red, new_red)
elif new_red not in t: sys.exit("Could not find the zero-good KPI red threshold rule.")
sources[core_path] = t

idx = Path("index.html"); html = idx.read_text(encoding="utf-8")
html2 = re.sub(r"(data-required-extension-version>)[^<]*(<)", lambda m: m.group(1) + chrome_version + m.group(2), html)
if html2 != html: idx.write_text(html2, encoding="utf-8")

for p, text in sources.items():
    if text != p.read_text(encoding="utf-8"):
        p.write_text(text, encoding="utf-8")
print(f"Embedded {len(files)} Chrome extension files into {BRIDGE} and synchronized required version {chrome_version}.")
