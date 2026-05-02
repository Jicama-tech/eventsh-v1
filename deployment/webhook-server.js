/**
 * GitHub Webhook Listener for Auto-Deploy (Eventsh)
 *
 * Setup on server:
 *   1. cd /home/eventshadmin/eventsh/eventsh-v1/deployment
 *   2. WEBHOOK_SECRET=your_secret pm2 start webhook-server.js --name eventsh-webhook
 *   3. Add GitHub webhook: https://eventsh.com/api/deploy-webhook (or /webhook on port 9001)
 *      - Content type: application/json
 *      - Secret: (must match WEBHOOK_SECRET env var)
 *      - Events: Just "push"
 *
 * Or run directly: WEBHOOK_SECRET=your_secret node webhook-server.js
 */

const http = require("http");
const crypto = require("crypto");
const { execFile } = require("child_process");
const path = require("path");

const PORT = 9001;
const SECRET = process.env.WEBHOOK_SECRET || "eventsh-deploy-secret";
const DEPLOY_SCRIPT = path.resolve(__dirname, "autodeploy.sh");

let deploying = false;

function verifySignature(payload, signature) {
  if (!signature) return false;
  const hmac = crypto.createHmac("sha256", SECRET);
  const digest = "sha256=" + hmac.update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

const server = http.createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/webhook") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    // Verify GitHub signature
    const sig = req.headers["x-hub-signature-256"];
    if (!verifySignature(body, sig)) {
      console.log("[webhook] Invalid signature, rejecting");
      res.writeHead(403);
      res.end("Invalid signature");
      return;
    }

    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      res.writeHead(400);
      res.end("Invalid JSON");
      return;
    }

    // Only deploy on push to main
    if (payload.ref !== "refs/heads/main") {
      console.log(`[webhook] Ignoring push to ${payload.ref}`);
      res.writeHead(200);
      res.end("Ignored - not main branch");
      return;
    }

    if (deploying) {
      console.log("[webhook] Deploy already in progress, skipping");
      res.writeHead(200);
      res.end("Deploy already in progress");
      return;
    }

    // Determine what changed
    const commits = payload.commits || [];
    const changedFiles = new Set();
    commits.forEach((c) => {
      [...(c.added || []), ...(c.modified || []), ...(c.removed || [])].forEach(
        (f) => changedFiles.add(f)
      );
    });

    const hasFrontend = [...changedFiles].some((f) => f.startsWith("frontend/"));
    const hasBackend = [...changedFiles].some((f) => f.startsWith("backend/"));

    let deployTarget = "both";
    if (hasFrontend && !hasBackend) deployTarget = "frontend";
    else if (hasBackend && !hasFrontend) deployTarget = "backend";

    console.log(
      `[webhook] Push to main by ${payload.pusher?.name}. Changed: ${changedFiles.size} files. Deploying: ${deployTarget}`
    );

    deploying = true;
    res.writeHead(200);
    res.end(`Deploying: ${deployTarget}`);

    // Run deploy script
    execFile("bash", [DEPLOY_SCRIPT, deployTarget], (err, stdout, stderr) => {
      deploying = false;
      if (err) {
        console.error("[webhook] Deploy failed:", err.message);
        console.error(stderr);
      } else {
        console.log("[webhook] Deploy succeeded");
        console.log(stdout);
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`[webhook] Listening on port ${PORT}`);
});
