
(() => {
  if (window.__POOD_CHECKER_BRIDGE_INSTALLED_V19__) return;

  const SOURCE = "POOD_CHECKER_PAGE_BRIDGE_V19";
  const COMMAND_SOURCE = "POOD_CHECKER_EXTENSION_V19";
  const captures = [];
  let targetOids = [];
  let nextId = 1;
  const MAX_CAPTURE = 80;
  const HEADER_DROP = /^(cookie|authorization|proxy-authorization|content-length|host|origin|referer|connection)$/i;

  function cleanHeaders(input) {
    const out = {};
    try {
      const h = new Headers(input || {});
      h.forEach((v, k) => {
        if (!HEADER_DROP.test(k) && (!/token|secret|api.?key/i.test(k) || /csrf|xsrf/i.test(k))) out[k] = v;
      });
    } catch (_) {}
    return out;
  }

  function bodyText(body) {
    if (body == null) return "";
    if (typeof body === "string") return body;
    try {
      if (body instanceof URLSearchParams) return body.toString();
      if (body instanceof FormData) return "[FormData omitted]";
      if (body instanceof Blob) return "[Blob omitted]";
    } catch (_) {}
    try { return JSON.stringify(body); } catch (_) { return ""; }
  }

  function matchesTarget(url, body) {
    const joined = String(url || "") + "\n" + String(body || "");
    const hits = targetOids.filter(oid => oid && joined.includes(oid));
    return hits;
  }

  function parseJSON(text) {
    if (typeof text !== "string") return null;
    try { return JSON.parse(text); } catch (_) { return null; }
  }

  function textOf(x, limit=1000000) {
    if (typeof x === "string") return x.slice(0, limit);
    try { return JSON.stringify(x).slice(0, limit); } catch (_) { return ""; }
  }


  function normalizeFieldKey(key) {
    return String(key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function readDeepField(object, aliases, maxDepth=10) {
    const wanted = new Set(aliases.map(normalizeFieldKey));
    const seen = new Set();
    const visit = (node, depth) => {
      if (!node || typeof node !== "object" || depth > maxDepth || seen.has(node)) return undefined;
      seen.add(node);
      if (Array.isArray(node)) {
        for (const item of node) { const found = visit(item, depth + 1); if (found !== undefined && found !== null) return found; }
        return undefined;
      }
      for (const [key, value] of Object.entries(node)) {
        if (wanted.has(normalizeFieldKey(key)) && value !== undefined && value !== null && value !== "") return value;
      }
      for (const value of Object.values(node)) {
        const found = visit(value, depth + 1);
        if (found !== undefined && found !== null && found !== "") return found;
      }
      return undefined;
    };
    return visit(object, 0);
  }

  function normalizeEvidenceValue(value, maxDepth=5) {
    if (value === undefined || value === null || maxDepth < 0) return undefined;
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") return value === 1 ? "Yes" : value === 0 ? "No" : String(value);
    if (typeof value === "string") {
      const text = value.trim();
      if (!text) return undefined;
      if (/^(yes|true|1|pass|passed)$/i.test(text)) return "Yes";
      if (/^(no|false|0|fail|failed)$/i.test(text)) return "No";
      return text;
    }
    if (Array.isArray(value)) {
      for (const item of value) { const found = normalizeEvidenceValue(item, maxDepth - 1); if (found !== undefined) return found; }
      return undefined;
    }
    if (typeof value === "object") {
      const priority = ["value", "result", "status", "tag", "label", "name", "desc"];
      for (const key of priority) {
        const candidate = readDeepField(value, [key], 2);
        const found = normalizeEvidenceValue(candidate, maxDepth - 1);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  }

  function readRecordTag(record, aliases) {
    return normalizeEvidenceValue(readDeepField(record, aliases));
  }

  // Proof of Contact is sometimes a scalar tag and sometimes a nested detail
  // object. Resolve the explicit tag first, then inspect known contact evidence
  // fields instead of stopping at an unrecognized object.
  const PROOF_CONTACT_ALIASES = [
    "proof_of_contact", "proof_of_contact_tag", "proof_of_contact_result",
    "proof_of_contact_status", "proof_of_contact_value", "proof_contact",
    "proof_contact_tag", "contact_proof", "contact_proof_tag", "contact_proof_result",
    // recipient_info variants: the SPX payload shown in FMS uses
    // pod_score.proof_of_contract for the UI's Proof of Contact value.
    "proof_of_contract", "proof_of_contract_tag", "proof_of_contract_result",
    "proof_of_contract_status", "proof_of_contract_value", "contract_proof",
    "contract_proof_tag", "proofContract", "proofContractTag",
    "proofContact", "proofContactTag", "poc", "poc_tag", "poc_status"
  ];
  const CONTACT_DETAIL_KEYS = /^(inappcall|telcocall|callscreenshotrecord|callscreenshot|othercallmethods|inappchat|messagescreenshot|smsscreenshot|smsacknowledg(e)?ment|callrecord|callrecording|contactmethod|contactmethods|proofmessage|chatmessage|phonecall|recipientcontact|contactattempt)$/i;
  const CONTACT_VALUE_KEYS = new Set(["value", "result", "status", "tag", "label", "name", "desc", "isvalid", "valid", "ispassed", "passed", "success", "verified"]);

  function contactScalar(value) {
    if (value === undefined || value === null) return undefined;
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") return value === 1 ? "Yes" : value === 0 ? "No" : undefined;
    if (typeof value !== "string") return undefined;
    const text = value.trim();
    if (!text) return undefined;
    if (/^(yes|true|1|pass|passed|sent|recorded|received|connected|available|verified|success|successful)$/i.test(text)) return "Yes";
    if (/^(no|false|0|fail|failed|not sent|no send|not recorded|not received|not connected|unavailable|not available|missing|none|n\/a)$/i.test(text)) return "No";
    return undefined;
  }

  function normalizeProofContactValue(value, depth=0) {
    if (depth > 9 || value == null) return undefined;
    const scalar = contactScalar(value);
    if (scalar) return scalar;
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = normalizeProofContactValue(item, depth + 1);
        if (found) return found;
      }
      return undefined;
    }
    if (typeof value !== "object") return undefined;

    // Explicit result/status fields take precedence over detailed contact
    // methods. This covers nested shapes such as {proof_of_contact:{status:"Yes"}}.
    for (const [key, child] of Object.entries(value)) {
      if (CONTACT_VALUE_KEYS.has(normalizeFieldKey(key))) {
        const found = normalizeProofContactValue(child, depth + 1);
        if (found) return found;
      }
    }

    let sawExplicitContactValue = false;
    let sawPositive = false;
    let sawNegative = false;
    for (const [key, child] of Object.entries(value)) {
      const normalizedKey = normalizeFieldKey(key);
      if (CONTACT_DETAIL_KEYS.test(normalizedKey)) {
        const direct = contactScalar(child);
        if (direct) {
          sawExplicitContactValue = true;
          if (direct === "Yes") sawPositive = true; else sawNegative = true;
        } else if (child && typeof child === "object") {
          const nested = normalizeProofContactValue(child, depth + 1);
          if (nested) {
            sawExplicitContactValue = true;
            if (nested === "Yes") sawPositive = true; else sawNegative = true;
          }
        }
      } else if (child && typeof child === "object") {
        const nested = normalizeProofContactValue(child, depth + 1);
        if (nested) {
          sawExplicitContactValue = true;
          if (nested === "Yes") sawPositive = true; else sawNegative = true;
        }
      }
    }
    if (sawPositive) return "Yes";
    if (sawExplicitContactValue && sawNegative) return "No";
    return undefined;
  }

  function findProofOfContact(source) {
    const wanted = new Set(PROOF_CONTACT_ALIASES.map(normalizeFieldKey));
    const seen = new Set();
    const visit = (node, depth=0) => {
      if (!node || typeof node !== "object" || depth > 14 || seen.has(node)) return undefined;
      seen.add(node);
      if (Array.isArray(node)) {
        for (const item of node) {
          const found = visit(item, depth + 1);
          if (found) return found;
        }
        return undefined;
      }
      // Check matching keys first. An unresolved object value does not stop
      // the search; a later alias or nested scalar may contain the real tag.
      for (const [key, value] of Object.entries(node)) {
        if (wanted.has(normalizeFieldKey(key))) {
          const normalized = normalizeProofContactValue(value);
          if (normalized) return normalized;
        }
      }
      for (const value of Object.values(node)) {
        const found = visit(value, depth + 1);
        if (found) return found;
      }
      return undefined;
    };
    return visit(source);
  }

  function evaluateValidationExpression(expression, record) {
    // SPX expression identifiers from the Proof of On Hold response:
    // 1 = Location, 2 = AWB, 3 = Distance, 4 = Proof of Contact.
    const asBoolean = value => {
      if (typeof value === "boolean") return value;
      if (typeof value === "number") return value === 1 ? true : value === 0 ? false : null;
      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["yes", "true", "1", "pass", "passed"].includes(normalized)) return true;
        if (["no", "false", "0", "fail", "failed"].includes(normalized)) return false;
      }
      return null;
    };
    const values = {
      "1": asBoolean(readRecordTag(record, ["location_tag", "location"])),
      "2": asBoolean(readRecordTag(record, ["awb_tag", "awb"])),
      "3": asBoolean(readRecordTag(record, ["distance_tag", "distance"])),
      "4": asBoolean(readRecordTag(record, ["proof_of_contact_tag", "proof_of_contact", "proof_of_contract", "proof_of_contract_tag", "proof_contact", "contact_proof", "proofContact"]))
    };
    const tokens = String(expression || "").match(/\d+|AND|OR|\(|\)/gi) || [];
    const residue = String(expression || "").replace(/\d+|AND|OR|\(|\)/gi, "").replace(/\s+/g, "");
    if (!tokens.length || residue) return null;
    let pos = 0;
    function primary() {
      const token = tokens[pos++];
      if (token === "(") {
        const value = parseOr();
        if (tokens[pos++] !== ")") throw new Error("Unbalanced validation expression");
        return value;
      }
      if (!Object.prototype.hasOwnProperty.call(values, token)) throw new Error("Unknown validation item");
      const raw = values[token];
      if (typeof raw !== "boolean") throw new Error("Missing validation tag");
      return raw;
    }
    function parseAnd() {
      let value = primary();
      while (String(tokens[pos] || "").toUpperCase() === "AND") {
        pos++;
        const right = primary();
        value = value && right;
      }
      return value;
    }
    function parseOr() {
      let value = parseAnd();
      while (String(tokens[pos] || "").toUpperCase() === "OR") {
        pos++;
        const right = parseAnd();
        value = value || right;
      }
      return value;
    }
    try {
      const result = parseOr();
      return pos === tokens.length ? result : null;
    } catch (_) { return null; }
  }

  function findOnHoldReasonDesc(json) {
    const seen = new Set();
    const visit = value => {
      if (!value || typeof value !== "object" || seen.has(value)) return "";
      seen.add(value);
      if (Array.isArray(value)) {
        for (const item of value) { const found = visit(item); if (found) return found; }
        return "";
      }
      const direct = value.on_hold_reason__desc;
      if (typeof direct === "string" && direct.trim()) return direct.trim();
      for (const child of Object.values(value)) { const found = visit(child); if (found) return found; }
      return "";
    };
    return visit(json);
  }

  function findDriverName(json) {
    // The recipient_info endpoint's actual field is driver_name. Prioritize
    // this exact field anywhere in the JSON before considering aliases.
    const seen = new Set();
    const findExact = value => {
      if (!value || typeof value !== "object" || seen.has(value)) return "";
      seen.add(value);
      if (Array.isArray(value)) {
        for (const item of value) { const found = findExact(item); if (found) return found; }
        return "";
      }
      for (const [key, val] of Object.entries(value)) {
        if ( key.toLowerCase() === "driver_name" && typeof val === "string" && val.trim()) return val.trim();
      }
      for (const child of Object.values(value)) { const found = findExact(child); if (found) return found; }
      return "";
    };
    const exact = findExact(json);
    if (exact) return exact;

    const seenAlias = new Set();
    const aliases = /^(driver_name__desc|drivername|delivery_driver_name|courier_name|rider_name)$/i;
    const visit = value => {
      if (!value || typeof value !== "object" || seenAlias.has(value)) return "";
      seenAlias.add(value);
      if (Array.isArray(value)) { for (const item of value) { const found = visit(item); if (found) return found; } return ""; }
      for (const [key, val] of Object.entries(value)) if (aliases.test(key) && typeof val === "string" && val.trim()) return val.trim();
      for (const [key, val] of Object.entries(value)) {
        if (/driver|courier|rider/i.test(key) && val && typeof val === "object") {
          const name = val.name || val.driver_name || val.full_name || val.username;
          if (typeof name === "string" && name.trim()) return name.trim();
        }
      }
      for (const child of Object.values(value)) { const found = visit(child); if (found) return found; }
      return "";
    };
    return visit(json);
  }

  function extractExplicitTier(json) {
    // The authoritative delivered-parcel tier comes from recipient_info:
    // data.epod_score.epod_tier (not validation_result's rule evaluation).
    const seen = new Set();
    const visit = value => {
      if (!value || typeof value !== "object" || seen.has(value)) return "";
      seen.add(value);
      if (Array.isArray(value)) {
        for (const item of value) { const found = visit(item); if (found) return found; }
        return "";
      }
      for (const [key, val] of Object.entries(value)) {
        if (key.toLowerCase() === "epod_score" && val && typeof val === "object") {
          const tier = val.epod_tier;
          if (tier !== undefined && tier !== null && String(tier).trim() !== "") {
            const n = Number(tier);
            if (Number.isInteger(n) && n >= 1 && n <= 5) return `TIER ${n}`;
          }
        }
      }
      for (const child of Object.values(value)) { const found = visit(child); if (found) return found; }
      return "";
    };
    return visit(json);
  }

  function getOnHoldValidation(json) {
    const data = json && json.data;
    if (!data || !Array.isArray(data.on_hold_list) || !Array.isArray(data.return_on_hold_list)) return null;
    const records = [
      ...data.on_hold_list.map(record => ({...record, __listName:"On-hold"})),
      ...data.return_on_hold_list.map(record => ({...record, __listName:"Return on-hold"}))
    ];
    if (!records.length) {
      return {
        checkResult:"UNVERIFIED",
        checkReason:"SPX returned successfully, but both on_hold_list and return_on_hold_list were empty.",
        deliveryStatus:"No on-hold validation records",
        podResult:"No validation record returned",
        podFields:[]
      };
    }
    const evaluated = records.map(record => {
      const expr = record.automated_validation_expr;
      const calculated = record.epooh_not_calculated !== true;
      const value = calculated ? evaluateValidationExpression(expr, record) : null;
      const result = value === true ? "PASS" : value === false ? "FAIL" : "UNVERIFIED";
      const tag = (name, raw) => `${name}: ${normalizeEvidenceValue(raw) ?? "Unknown"}`;
      const details = [
        tag("Proof of Contact", readDeepField(record, ["proof_of_contact_tag", "proof_of_contact", "proof_contact", "contact_proof", "proofContact"])),
        tag("AWB", readDeepField(record, ["awb_tag", "awb"])),
        tag("Location", readDeepField(record, ["location_tag", "location"])),
        tag("Distance", readDeepField(record, ["distance_tag", "distance"]))
      ].join("; ");
      return { result, line: details };
    });
    const failed = evaluated.filter(x=>x.result === "FAIL").length;
    const passed = evaluated.filter(x=>x.result === "PASS").length;
    const unknown = evaluated.filter(x=>x.result === "UNVERIFIED").length;
    // Conservative aggregate: every returned validation record must pass.
    const checkResult = failed ? "FAIL" : unknown ? "UNVERIFIED" : "PASS";
    const reason = checkResult === "PASS"
      ? `All ${evaluated.length} SPX on-hold validation record(s) passed their automated validation expression.`
      : checkResult === "FAIL"
        ? `${failed} of ${evaluated.length} SPX validation record(s) failed the automated validation expression.`
        : `${unknown} of ${evaluated.length} SPX validation record(s) could not be evaluated from the returned tags.`;
    const holdReasons = [...new Set(records.map(record => {
      const value = record.on_hold_reason__desc ?? record.on_hold_reason ?? record.onHoldReason ?? record.on_hold_reason_name ?? record.reason;
      if (value == null) return "";
      if (typeof value === "object") return value.name || value.reason || value.label || value.on_hold_reason__desc || "";
      return String(value).trim();
    }).filter(Boolean))];
    const reasonFromResponse = findOnHoldReasonDesc(json);
    if (reasonFromResponse && !holdReasons.includes(reasonFromResponse)) holdReasons.unshift(reasonFromResponse);
    // Display only the latest validation record's evidence. SPX sequence is
    // the strongest ordering signal; if unavailable, use the last returned record.
    const sequenced = evaluated.map((item, index) => ({ item, sequence: Number(records[index]?.sequence) }))
      .filter(x => Number.isFinite(x.sequence));
    const latest = sequenced.length
      ? sequenced.reduce((a, b) => b.sequence > a.sequence ? b : a).item
      : evaluated[evaluated.length - 1];
    return {
      checkResult,
      checkReason:reason,
      deliveryStatus:holdReasons.join(" | ") || "On Hold Reason not provided",
      podResult:`SPX validation: ${passed} PASS, ${failed} FAIL, ${unknown} UNVERIFIED`,
      podFields:latest ? [latest.line] : []
    };
  }

  function classifyPod(json, responseText, httpStatus, deliveryStatus, podFields) {
    const status = Number(httpStatus || 0);
    if (status === 401 || status === 403) {
      return {checkResult:"UNVERIFIED",checkReason:"Portal access denied; confirm login and permissions."};
    }
    if (status < 200 || status >= 300) {
      return {checkResult:"UNVERIFIED",checkReason:`Portal returned HTTP ${status || "unknown"}.`};
    }

    const onHoldValidation = getOnHoldValidation(json);
    if (onHoldValidation) return {checkResult:onHoldValidation.checkResult, checkReason:onHoldValidation.checkReason};

    const delivery = String(deliveryStatus || "").toLowerCase();
    const delivered = /\b(delivered|successfully delivered|received by|completed|signed)\b/.test(delivery)
      && !/\b(not delivered|undelivered|failed|cancelled|canceled|returned|return to sender|rts)\b/.test(delivery);

    let explicitNoPod = false;
    let explicitPositivePod = false;
    const positiveKeys = /(pod|proof.?of.?delivery|delivery.?proof|delivery.?photo|photo.?delivery|signature|recipient.?signature|delivery.?evidence|geotag|geo.?tag)/i;
    const falseValues = v => v === false || v === 0 || v === "" || v == null || (typeof v === "string" && /^(false|no|none|null|undefined|not available|n\/a|missing)$/i.test(v.trim()));
    const truthyValues = v => {
      if (v === true) return true;
      if (typeof v === "number") return v > 0;
      if (typeof v === "string") {
        const z = v.trim();
        if (!z || /^(false|no|none|null|undefined|not available|n\/a|missing)$/i.test(z)) return false;
        return true;
      }
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === "object" && v) return Object.keys(v).length > 0;
      return false;
    };
    function walk(node, depth=0) {
      if (depth > 8 || node == null || typeof node !== "object") return;
      if (Array.isArray(node)) { node.slice(0,100).forEach(v=>walk(v,depth+1)); return; }
      for (const [k,v] of Object.entries(node)) {
        if (positiveKeys.test(k)) {
          if (falseValues(v)) explicitNoPod = true;
          else if (truthyValues(v)) explicitPositivePod = true;
        }
        if (v && typeof v === "object") walk(v,depth+1);
      }
    }
    walk(json);
    if (explicitPositivePod && delivered) {
      return {checkResult:"PASS",checkReason:"Delivered status and a POD-related field were both found."};
    }
    if (explicitNoPod) {
      return {checkResult:"FAIL",checkReason:"The response explicitly shows a POD-related field as empty/false."};
    }
    if (delivery && /\b(not delivered|undelivered|delivery failed|failed delivery|cancelled|canceled|returned|return to sender|rts)\b/.test(delivery)) {
      return {checkResult:"FAIL",checkReason:"The portal response indicates the shipment is not successfully delivered."};
    }
    if (delivered && !podFields.length) {
      return {checkResult:"UNVERIFIED",checkReason:"Delivery appears complete, but the response schema did not expose a recognizable POD field."};
    }
    if (!json) {
      return {checkResult:"UNVERIFIED",checkReason:"Portal returned non-JSON or an unrecognized response."};
    }
    return {checkResult:"UNVERIFIED",checkReason:"Response did not clearly establish both delivery status and POD evidence."};
  }

  function pickSummary(json, responseText, statusCode) {
    const foundStatus = [];
    const podFields = [];
    const seenStatus = new Set();
    const seenPod = new Set();
    const isTruthyEvidence = v => {
      if (v == null || v === false || v === 0 || v === "") return false;
      if (typeof v === "string" && /^(false|null|undefined|none|n\/a|no)$/i.test(v.trim())) return false;
      return true;
    };
    function walk(node, path="", depth=0, inPodContext=false) {
      if (depth > 9 || node == null) return;
      if (Array.isArray(node)) {
        node.slice(0, 100).forEach((v,i) => walk(v, `${path}[${i}]`, depth+1, inPodContext));
        return;
      }
      if (typeof node !== "object") return;
      for (const [key, value] of Object.entries(node)) {
        const p = path ? `${path}.${key}` : key;
        const contextHere = inPodContext || /(pod|proof.?of.?delivery|delivery.?proof|delivery.?photo|photo.?delivery|signature|evidence|geotag|geo.?tag)/i.test(key);
        if (/^(status|delivery_status|deliveryStatus|shipment_status|shipmentStatus|order_status|orderStatus|state|logistics_status|logisticsStatus|tracking_status|trackingStatus|deliver_status|deliverStatus)$/i.test(key) && (typeof value === "string" || typeof value === "number")) {
          const val = String(value);
          const item = `${key}: ${val}`;
          if (!seenStatus.has(item)) { seenStatus.add(item); foundStatus.push(item); }
        }
        const podSpecificKey = /(pod|proof.?of.?delivery|delivery.?proof|delivery.?photo|photo.?delivery|signature|delivery.?evidence|recipient.?evidence|geotag|geo.?tag)/i.test(key);
        const photoKeyInPODContext = contextHere && /(image|photo|url|file|media|attachment|path|picture)/i.test(key);
        if ((podSpecificKey || photoKeyInPODContext) && isTruthyEvidence(value)) {
          let val = "";
          if (typeof value === "string") val = value;
          else if (typeof value === "object") {
            val = value.url || value.image_url || value.photo_url || value.path || value.file_url || value.media_url || textOf(value, 350);
          } else val = String(value);
          if (val && !seenPod.has(p)) {
            seenPod.add(p);
            podFields.push(`${p}: ${String(val).slice(0, 300)}`);
          }
        }
        if (value && typeof value === "object") walk(value, p, depth+1, contextHere);
      }
    }
    walk(json);
    const onHoldValidation = getOnHoldValidation(json);
    if (onHoldValidation) {
      const ct = responseText || "";
      return {
        httpStatus:Number(statusCode),
        deliveryStatus:onHoldValidation.deliveryStatus,
        podResult:onHoldValidation.podResult,
        podFields:onHoldValidation.podFields,
        responseType:json ? "JSON" : "Text/other",
        responsePreview:textOf(json || ct, 12000).slice(0, 700),
        checkResult:onHoldValidation.checkResult,
        checkReason:onHoldValidation.checkReason,
        hasOnHoldValidation:true
      };
    }
    const ct = responseText || "";
    const jsonText = textOf(json || ct, 12000);
    const status = Number(statusCode);
    const isJSON = !!json;
    let deliveryStatus = foundStatus.slice(0, 6).join(" | ") || "Not identified";
    const deliveredRegex = /\b(delivered|received|completed|signed|proof.?of.?delivery)\b/i;
    if (deliveryStatus === "Not identified" && deliveredRegex.test(jsonText)) {
      const m = jsonText.match(/.{0,30}\b(delivered|received|completed|signed)\b.{0,40}/i);
      if (m) deliveryStatus = m[0].replace(/\s+/g, " ").trim();
    }
    let podResult = "POD fields not detected";
    if (podFields.length) podResult = "Potential POD evidence found";
    if (status === 401 || status === 403) podResult = "Portal denied request / session may need login";
    if (!isJSON && status >= 200 && status < 300) podResult = "Response received; POD format not recognized";
    return {
      httpStatus: status,
      deliveryStatus,
      podResult,
      podFields: podFields.slice(0, 8),
      responseType: isJSON ? "JSON" : "Text/other",
      responsePreview: isJSON ? jsonText.slice(0, 700) : ct.slice(0, 700),
      hasOnHoldValidation:false
    };
  }

  function isRelevantUrl(url) {
    try {
      const u = new URL(url, location.href);
      return u.origin === location.origin && /api|rpc|graphql|order|shipment|deliver|proof|pod|search|detail|tracking|waybill|on.?hold|epooh|fms/i.test(u.pathname + u.search);
    } catch (_) { return false; }
  }

  function extractResponseOids(json) {
    const data = json && json.data;
    if (!data) return [];
    const rows = [
      ...(Array.isArray(data.on_hold_list) ? data.on_hold_list : []),
      ...(Array.isArray(data.return_on_hold_list) ? data.return_on_hold_list : [])
    ];
    return [...new Set(rows.map(row => String(row && row.order_id || "").trim()).filter(Boolean))].slice(0, 100);
  }

  function addCapture(meta, responseSummary, responseJson) {
    const requestOids = matchesTarget(meta.url, meta.body);
    const responseOids = extractResponseOids(responseJson);
    const hasOnHoldValidation = !!(responseJson && responseJson.data
      && Array.isArray(responseJson.data.on_hold_list)
      && Array.isArray(responseJson.data.return_on_hold_list));
    // Capture a response that has the exact Proof of On Hold schema even when
    // the OID is encoded in a non-text request body or only appears in response.
    if ((!requestOids.length && !hasOnHoldValidation) || (!isRelevantUrl(meta.url) && !hasOnHoldValidation)) return;
    const id = `req-${Date.now()}-${nextId++}`;
    const u = new URL(meta.url, location.href);
    const targetMatchOids = [...new Set([...requestOids, ...responseOids].filter(oid => targetOids.includes(oid)))];
    const capture = {
      id, time: new Date().toISOString(), method: meta.method || "GET",
      url: u.href, path: u.pathname + u.search, body: meta.body || "",
      headers: meta.headers || {}, credentials: "include",
      sourceOids: requestOids, responseOids, targetMatchOids,
      hasOnHoldValidation, responseSummary: responseSummary || null,
      sameOrigin: u.origin === location.origin
    };
    captures.unshift(capture);
    if (captures.length > MAX_CAPTURE) captures.length = MAX_CAPTURE;
  }

  function requestSummary(c) {
    const canReplay = isReadOnlyLike(c) && (c.sourceOids || []).some(oid => c.url.includes(oid) || c.body.includes(oid));
    return {
      id: c.id, time: c.time, method: c.method, path: c.path,
      sourceOids: c.sourceOids, responseOids:c.responseOids,
      targetMatchOids:c.targetMatchOids, hasOnHoldValidation:c.hasOnHoldValidation,
      responseSummary: c.responseSummary,
      replayable: canReplay, sameOrigin: c.sameOrigin,
      replayBlockReason: !c.hasOnHoldValidation ? "Response was not the Proof of On Hold data." : !canReplay ? "The OID was not found in the request URL/body, so it cannot be safely substituted." : ""
    };
  }

  function isReadOnlyLike(c) {
    const method = String(c.method || "GET").toUpperCase();
    const path = String(c.path || "").toLowerCase();
    if (method === "GET" || method === "HEAD") return true;
    if (method !== "POST") return false;
    if (/(^|[\/_-])(assign|deliver|cancel|delete|update|create|save|upload|submit|confirm|approve|reassign|modify|edit|write|remove)([\/_-]|$)/i.test(path)) return false;
    return /(search|query|list|get|detail|track|order|shipment|pod|proof|delivery|waybill|on.?hold|epooh)/i.test(path);
  }

  function replaceAllLiteral(text, oldValue, newValue) {
    if (!text || !oldValue) return text;
    return String(text).split(oldValue).join(newValue);
  }

  async function replay(captureId, targetOid) {
    const c = captures.find(x => x.id === captureId);
    if (!c) throw new Error("Captured request expired. Capture a fresh sample by searching an OID in SPX.");
    if (!c.sameOrigin || !isReadOnlyLike(c)) throw new Error("The captured endpoint is not recognized as read-only, so replay was blocked.");
    const sourceOid = (c.sourceOids || []).find(oid => String(c.url).includes(oid) || String(c.body).includes(oid));
    if (!sourceOid) throw new Error("The captured Proof of On Hold response does not expose its OID in the request. It can be inspected, but cannot be reused for other OIDs safely.");
    let url = c.url;
    let body = c.body;
    url = replaceAllLiteral(url, sourceOid, targetOid);
    url = replaceAllLiteral(url, encodeURIComponent(sourceOid), encodeURIComponent(targetOid));
    if (body && body !== "[FormData omitted]" && !body.startsWith("[Blob")) {
      body = replaceAllLiteral(body, sourceOid, targetOid);
      body = replaceAllLiteral(body, encodeURIComponent(sourceOid), encodeURIComponent(targetOid));
    } else if (body === "[FormData omitted]" || body.startsWith("[Blob")) {
      throw new Error("This captured request uses FormData/blob content and cannot be safely replayed.");
    }
    const headers = { ...(c.headers || {}) };
    delete headers["content-length"]; delete headers["Content-Length"];
    const options = { method: c.method, headers, credentials: "include", cache: "no-store" };
    if (!["GET","HEAD"].includes(String(c.method).toUpperCase()) && body) options.body = body;
    const response = await fetch(url, options);
    const text = await response.clone().text();
    const json = parseJSON(text);
    const summary = pickSummary(json, text, response.status);
    const decision = summary.checkResult
      ? {checkResult:summary.checkResult, checkReason:summary.checkReason}
      : classifyPod(json, text, response.status, summary.deliveryStatus, summary.podFields);
    return {
      oid: targetOid, httpStatus: response.status, deliveryStatus: summary.deliveryStatus,
      podResult: summary.podResult, podFields: summary.podFields,
      checkResult: decision.checkResult, checkReason: decision.checkReason,
      endpoint: new URL(url).pathname, responseType: summary.responseType,
      note: (response.status === 401 || response.status === 403)
        ? "SPX rejected the request; confirm you are logged in and have access."
        : (!response.ok ? `HTTP ${response.status}` : ""),
      responsePreview: summary.responsePreview
    };
  }

  const EPOOH_VALIDATION_PATH = "/spx_delivery/admin/order_settings/epooh/validation_result";

  async function directCheck(targetOid) {
    targetOid = String(targetOid || "").trim();
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(targetOid)) {
      throw new Error("OID format is not valid. Check the pasted tracking/order ID.");
    }

    // Read tracking status and recipient_info first. recipient_info is the
    // authoritative source for delivered ePOD score/tier.
    let trackingStatus = "Not identified";
    const normalizeStatus = value => String(value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
    const isDeliveredStatus = value => ["delivered", "deliverycompleted", "completeddelivery", "successfullydelivered"].includes(normalizeStatus(value));
    // Extract explicit status values from known status fields; do not assume
    // the first key of data.recipient is itself a shipment status.
    const findDeliveredStatus = (node, depth=0) => {
      if (!node || typeof node !== "object" || depth > 12) return false;
      // SPX commonly returns data.recipient as a status-keyed object:
      // { "Delivered": { order_id: ... } }. Treat the key as authoritative.
      for (const [key, value] of Object.entries(node)) {
        // SPX APIs use several wrappers/key names. Treat an exact Delivered
        // token anywhere in a status-like field OR a status-keyed object as
        // authoritative; don't depend solely on tracking_info's schema.
        if (isDeliveredStatus(key)) return true;
        if (typeof value === "string" && isDeliveredStatus(value) &&
            /status|state|deliver|shipment|logistic|tracking|recipient/i.test(key)) return true;
        if (/^(status|delivery_status|deliveryStatus|shipment_status|shipmentStatus|order_status|orderStatus|state|logistics_status|logisticsStatus|tracking_status|trackingStatus|deliver_status|deliverStatus)$/i.test(key) && isDeliveredStatus(value)) return true;
        if (findDeliveredStatus(value, depth+1)) return true;
      }
      return false;
    };
    try {
      const trackingUrl = new URL("/api/fleet_order/order/detail/tracking_info", location.origin);
      trackingUrl.searchParams.set("shipment_id", targetOid);
      trackingUrl.searchParams.set("station_type", "12");
      const trackingResponse = await originalFetch(trackingUrl.href, {
        method: "GET", headers: { "Accept": "application/json, text/plain, */*" },
        credentials: "include", cache: "no-store", redirect: "follow"
      });
      const trackingJson = parseJSON((await trackingResponse.text()).slice(0, 1000000));
      if (findDeliveredStatus(trackingJson)) trackingStatus = "Delivered";
    } catch (_) {}

    let recipientJson = null, onHoldReason = "Not identified", driverName = "Not identified", epodTier = "";
    let epodScore = null;
    try {
      const recipientUrl = new URL("/api/fleet_order/order/detail/recipient_info", location.origin);
      recipientUrl.searchParams.set("shipment_id", targetOid);
      recipientUrl.searchParams.set("station_type", "12");
      const recipientResponse = await originalFetch(recipientUrl.href, {
        method: "GET", headers: { "Accept": "application/json, text/plain, */*" },
        credentials: "include", cache: "no-store", redirect: "follow"
      });
      recipientJson = parseJSON((await recipientResponse.text()).slice(0, 1000000));
      if (recipientResponse.ok && recipientJson) {
        const reason = findOnHoldReasonDesc(recipientJson);
        const driver = findDriverName(recipientJson);
        if (reason) onHoldReason = String(reason).trim();
        if (driver) driverName = driver;
        // recipient_info itself may contain the authoritative Delivered
        // status even when tracking_info uses an unfamiliar response shape.
        if (findDeliveredStatus(recipientJson)) trackingStatus = "Delivered";
        epodTier = extractExplicitTier(recipientJson);
        // Select the richest ePOD score object. Some SPX response wrappers
        // contain a partial/empty epod_score alongside the complete score.
        const scoreCandidates = [];
        const seenScoreNodes = new Set();
        const collectScores = value => {
          if (!value || typeof value !== "object" || seenScoreNodes.has(value)) return;
          seenScoreNodes.add(value);
          for (const [key, child] of Object.entries(value)) {
            if (["epodscore", "podscore"].includes(normalizeFieldKey(key)) && child && typeof child === "object") scoreCandidates.push(child);
            collectScores(child);
          }
        };
        collectScores(recipientJson);
        const scoreFields = ["epod_tier", "quality", "parcel", "awb", "location", "distance", "proof_of_recipient"];
        const scoreWeight = score => scoreFields.filter(k => readDeepField(score, [k]) != null).length * 10
          + (findProofOfContact(score) ? 100 : 0);
        scoreCandidates.sort((a, b) => scoreWeight(b) - scoreWeight(a));
        epodScore = scoreCandidates[0] || null;
      }
    } catch (_) {}

    // Tier present is itself definitive proof this shipment is Delivered,
    // even if tracking_info uses a different wrapper/status representation.
    const isDelivered = trackingStatus === "Delivered" || Boolean(epodTier) || Boolean(epodScore);
    if (isDelivered) {
      const tier = epodTier || "PENDING VALIDATION";
      const scoreValue = (obj, keys) => {
        if (!obj || typeof obj !== "object") return undefined;
        const wanted = new Set(keys.map(k => k.toLowerCase()));
        for (const [k,v] of Object.entries(obj)) if (wanted.has(k.toLowerCase()) && v != null) {
          if (typeof v === "object") return v.value ?? v.result ?? v.status ?? v.tag ?? v.name ?? JSON.stringify(v);
          return v;
        }
        return undefined;
      };
      let proofContact = findProofOfContact(epodScore) || findProofOfContact(recipientJson);
      // Some FMS builds expose the contact tag on validation_result rather
      // than recipient_info. Use that endpoint only as a read-only fallback;
      // tier and the other ePOD fields remain sourced from recipient_info.
      if (!proofContact) {
        try {
          const validationUrl = new URL(EPOOH_VALIDATION_PATH, location.origin);
          validationUrl.searchParams.set("order_id", targetOid);
          const validationResponse = await originalFetch(validationUrl.href, {
            method: "GET", headers: { "Accept": "application/json, text/plain, */*" },
            credentials: "include", cache: "no-store", redirect: "follow"
          });
          const validationJson = parseJSON((await validationResponse.text()).slice(0, 1000000));
          if (validationResponse.ok && validationJson) proofContact = findProofOfContact(validationJson);
        } catch (_) {}
      }
      const fields = epodScore ? [
        `Quality: ${normalizeEvidenceValue(readDeepField(epodScore, ["quality"])) ?? "Unknown"}`,
        `Parcel: ${normalizeEvidenceValue(readDeepField(epodScore, ["parcel"])) ?? "Unknown"}`,
        `AWB: ${normalizeEvidenceValue(readDeepField(epodScore, ["awb"])) ?? "Unknown"}`,
        `Location: ${normalizeEvidenceValue(readDeepField(epodScore, ["location"])) ?? "Unknown"}`,
        `Distance: ${normalizeEvidenceValue(readDeepField(epodScore, ["distance"])) ?? "Unknown"}`,
        `Proof of Recipient: ${normalizeEvidenceValue(readDeepField(epodScore, ["proof_of_recipient", "proof_of_recipient_tag"])) ?? "Unknown"}`,
        `Proof of Contact: ${proofContact ?? "Unknown"}`
      ] : [];
      return {
        oid: targetOid, httpStatus: 200, deliveryStatus: "Delivered", driverName,
        podResult: epodScore ? "SPX ePOD Score" : "Tier pending from SPX",
        podFields: fields,
        checkResult: tier,
        checkReason: epodTier ? `SPX recipient_info returned epod_tier ${epodScore?.epod_tier}.` :
          "Delivered status confirmed; SPX has not returned epod_score.epod_tier yet.",
        endpoint: "/api/fleet_order/order/detail/recipient_info",
        responseType: "JSON", note: epodTier ? "Tier read directly from recipient_info.data.epod_score.epod_tier." : "Pending validation."
      };
    }

    // Non-delivered parcels: do not run ePOD validation; show actual reason.
    if (trackingStatus !== "Not identified") {
      return {
        oid: targetOid, httpStatus: 200, deliveryStatus: onHoldReason,
        driverName, podResult: "Skipped — not Delivered", podFields: [],
        checkResult: "SKIPPED", checkReason: `POD validation skipped because SPX status is ${trackingStatus}.`,
        endpoint: "/api/fleet_order/order/detail/tracking_info", note: "POD validation was not requested."
      };
    }

    // Non-delivered orders (including Recipient reschedule) are validated by
    // SPX's Proof of On Hold endpoint. Evaluate its returned expression/tags.
    try {
      const validationUrl = new URL(EPOOH_VALIDATION_PATH, location.origin);
      validationUrl.searchParams.set("order_id", targetOid);
      const validationResponse = await originalFetch(validationUrl.href, {
        method: "GET", headers: { "Accept": "application/json, text/plain, */*" },
        credentials: "include", cache: "no-store", redirect: "follow"
      });
      const validationJson = parseJSON((await validationResponse.text()).slice(0, 1000000));
      if (validationResponse.ok && validationJson) {
        // Normalize missing arrays for responses that only include one list.
        if (validationJson.data && typeof validationJson.data === "object") {
          if (!Array.isArray(validationJson.data.on_hold_list)) validationJson.data.on_hold_list = [];
          if (!Array.isArray(validationJson.data.return_on_hold_list)) validationJson.data.return_on_hold_list = [];
        }
        const validation = getOnHoldValidation(validationJson);
        if (validation && validation.checkResult && validation.checkResult !== "UNVERIFIED") {
          return {
            oid: targetOid, httpStatus: validationResponse.status,
            deliveryStatus: onHoldReason !== "Not identified" ? onHoldReason : (validation.deliveryStatus || "Not identified"),
            driverName, podResult: validation.podResult || "SPX automated validation",
            podFields: validation.podFields || [],
            checkResult: validation.checkResult, checkReason: validation.checkReason,
            endpoint: EPOOH_VALIDATION_PATH, responseType: "JSON",
            note: "Result evaluated from SPX automated_validation_expr and returned validation tags."
          };
        }
        if (validation) {
          return {
            oid: targetOid, httpStatus: validationResponse.status,
            deliveryStatus: onHoldReason !== "Not identified" ? onHoldReason : (validation.deliveryStatus || "Not identified"),
            driverName, podResult: validation.podResult || "SPX automated validation",
            podFields: validation.podFields || [],
            checkResult: "UNVERIFIED", checkReason: validation.checkReason || "SPX has not calculated a validation result yet.",
            endpoint: EPOOH_VALIDATION_PATH, responseType: "JSON",
            note: "Validation response received, but its formula/tags were not sufficient to determine a result."
          };
        }
      }
    } catch (_) {}

    // If status and validation cannot be identified, keep a safe state.
    return {
      oid: targetOid, httpStatus: 200, deliveryStatus: onHoldReason, driverName,
      podResult: "Could not identify SPX delivery status or validation", podFields: [],
      checkResult: "UNVERIFIED", checkReason: "SPX status could not be identified and its validation response was unavailable.",
      endpoint: EPOOH_VALIDATION_PATH, note: "Status/validation unavailable from SPX."
    };
  }

  async function captureFetch(input, init) {
    let url = "", method = "GET", body = "", headers = {};
    try {
      if (input instanceof Request) {
        url = input.url;
        method = (init && init.method) || input.method || "GET";
        headers = cleanHeaders((init && init.headers) || input.headers);
        if (init && init.body != null) body = bodyText(init.body);
        else try { body = await input.clone().text(); } catch (_) {}
      } else {
        url = String(input);
        method = (init && init.method) || "GET";
        headers = cleanHeaders(init && init.headers);
        body = bodyText(init && init.body);
      }
    } catch (_) {}
    return {url, method, body, headers};
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = function(input, init) {
    let metaPromise = captureFetch(input, init);
    const promise = originalFetch(input, init);
    promise.then(async response => {
      try {
        const meta = await metaPromise;
        const clone = response.clone();
        const text = (await clone.text()).slice(0, 1000000);
        const json = parseJSON(text);
        const summary = pickSummary(json, text, response.status);
        addCapture(meta, {
          httpStatus: summary.httpStatus, podResult: summary.podResult,
          deliveryStatus: summary.deliveryStatus, responseType: summary.responseType,
          hasOnHoldValidation:summary.hasOnHoldValidation === true
        }, json);
      } catch (_) {}
    }).catch(() => {});
    return promise;
  };

  const XHR = window.XMLHttpRequest;
  const originalOpen = XHR.prototype.open;
  const originalSend = XHR.prototype.send;
  const originalSetHeader = XHR.prototype.setRequestHeader;
  XHR.prototype.open = function(method, url) {
    this.__poodMeta = {method: method || "GET", url: String(url), body: "", headers: {}};
    return originalOpen.apply(this, arguments);
  };
  XHR.prototype.setRequestHeader = function(name, value) {
    try {
      if (this.__poodMeta && !HEADER_DROP.test(name) && !/token|secret|api.?key/i.test(name)) this.__poodMeta.headers[name] = value;
    } catch (_) {}
    return originalSetHeader.apply(this, arguments);
  };
  XHR.prototype.send = function(body) {
    try { this.__poodMeta.body = bodyText(body); } catch (_) {}
    this.addEventListener("load", () => {
      try {
        const meta = this.__poodMeta;
        if (!meta) return;
        let text = "";
        try {
          if (typeof this.response === "string") text = this.response;
          else if (this.response && typeof this.response === "object") text = JSON.stringify(this.response);
          else if (!this.responseType || this.responseType === "text") text = String(this.responseText || "");
        } catch (_) {}
        text = text.slice(0,1000000);
        const json = parseJSON(text) || (this.response && typeof this.response === "object" ? this.response : null);
        const summary = pickSummary(json, text, this.status);
        addCapture(meta, {
          httpStatus: summary.httpStatus, podResult: summary.podResult,
          deliveryStatus: summary.deliveryStatus, responseType: summary.responseType,
          hasOnHoldValidation:summary.hasOnHoldValidation === true
        }, json);
      } catch (_) {}
    }, {once:true});
    return originalSend.apply(this, arguments);
  };

  window.addEventListener("message", async event => {
    const msg = event.data;
    if (event.source !== window || !msg || msg.source !== COMMAND_SOURCE || !msg.requestId) return;
    let payload;
    try {
      if (msg.command === "PING") {
        payload = {
          ok: true,
          bridgeVersion: "19",
          route: String(location.hash || ""),
          title: String(document.title || ""),
          bodyLength: String(document.body?.innerText || "").trim().length
        };
      } else if (msg.command === "ARM") {
        targetOids = Array.isArray(msg.data.oids) ? msg.data.oids.map(x=>String(x).trim()).filter(Boolean).slice(0,2000) : [];
        payload = {ok:true, message:`Capture armed for ${targetOids.length} OID(s). Open one of these exact OIDs in SPX, then open its Proof of On Hold tab and wait for the validation details to load.`};
      } else if (msg.command === "WAIT_FMS_READY") {
        // SPX is a single-page app. Do not depend on a completely quiet DOM:
        // menus, clocks, and background widgets can keep mutating indefinitely.
        // Instead require the target route, meaningful page text, and stable
        // visible text for a short period. The wait is deliberately bounded.
        const started = Date.now();
        const minWaitMs = 3500;
        const stableMs = 1800;
        const maxWaitMs = 25000;
        let previousText = "";
        let textStableSince = Date.now();
        while (Date.now() - started < maxWaitMs) {
          const routeReady = location.hash.includes("PROOF_OF_ONHOLD") || location.href.includes("PROOF_OF_ONHOLD");
          const bodyText = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
          const contentReady = bodyText.length > 120;
          const now = Date.now();
          if (bodyText !== previousText) {
            previousText = bodyText;
            textStableSince = now;
          }
          const elapsed = now - started;
          if (routeReady && contentReady && elapsed >= minWaitMs && now - textStableSince >= stableMs) {
            payload = {ok:true, ready:true, waitedMs:elapsed, message:"SPX Proof of On Hold page is ready."};
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 400));
        }
        if (!payload) {
          const routeReady = location.hash.includes("PROOF_OF_ONHOLD") || location.href.includes("PROOF_OF_ONHOLD");
          const bodyLength = String(document.body?.innerText || "").trim().length;
          if (!routeReady) throw new Error("SPX did not reach the Proof of On Hold page. Check your SPX session and try again.");
          if (bodyLength <= 120) throw new Error("SPX opened, but the Proof of On Hold page has not loaded its content. Check your SPX sign-in and try again.");
          throw new Error("SPX is still updating the Proof of On Hold page. Wait a moment and click Check OIDs again.");
        }
      } else if (msg.command === "LIST") {
        payload = {ok:true, captures: captures.slice(0,60).map(requestSummary)};
      } else if (msg.command === "REPLAY") {
        payload = {ok:true, result: await replay(msg.data.captureId, String(msg.data.oid || ""))};
      } else if (msg.command === "DIRECT_CHECK") {
        payload = {ok:true, result: await directCheck(String(msg.data.oid || ""))};
      } else if (msg.command === "CLEAR") {
        captures.length = 0;
        payload = {ok:true, message:"Captured requests cleared."};
      } else {
        throw new Error("Unknown command.");
      }
    } catch (e) {
      payload = {ok:false, error: String(e && e.message || e)};
    }
    window.postMessage({source:SOURCE, requestId:msg.requestId, payload}, location.origin);
  });

  window.__POOD_CHECKER_BRIDGE_INSTALLED_V19__ = true;
  window.postMessage({source:SOURCE, type:"READY", payload:{ok:true, bridgeVersion:"19"}}, location.origin);
})();
