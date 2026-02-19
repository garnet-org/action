// This script installs garnetctl and jibril, configures them, creates the
// agent, fetches network policy, and sets up Jibril as a systemd service.

const core = require("@actions/core");
const exec = require("@actions/exec");
const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");
const http = require("http");
const tar = require("tar");

const INSTPATH = "/usr/local/bin";

let _tmpDirForCleanup = null;

// This function is the main entry point for the script.
async function run() {
  // Get the variables from the environment.
  const TOKEN = getEnv("GARNET_API_TOKEN");
  const API = getEnv("GARNET_API_URL", "https://api.garnet.ai");
  let GARNETVER = getEnv("GARNETCTL_VERSION", "latest");
  let JIBRILVER = getEnv("JIBRIL_VERSION", "latest");
  const DEBUG = getEnv("DEBUG", "false");

  if (TOKEN === "") {
    fail(1, "API token is required");
  }

  const platform = os.platform();
  const arch = os.arch();

  // Sanitize the OS and architecture.
  let GARNET_OS;
  if (platform === "linux") {
    GARNET_OS = "linux";
  } else if (platform === "darwin") {
    GARNET_OS = "darwin";
  } else {
    fail(1, `Unsupported OS: ${platform}`);
  }

  // Sanitize the architecture.
  let ALTARCH;
  const archStr = String(arch);
  if (archStr === "x64" || archStr === "x86_64") {
    ALTARCH = "x86_64";
  } else if (archStr === "arm64" || archStr === "aarch64") {
    ALTARCH = "arm64";
  } else {
    fail(1, `Unsupported architecture: ${arch}`);
  }

  if (GARNETVER !== "latest" && !GARNETVER.startsWith("v")) {
    GARNETVER = `v${GARNETVER}`;
  }
  if (JIBRILVER !== "latest" && !JIBRILVER.startsWith("v")) {
    JIBRILVER = `v${JIBRILVER}`;
  }

  core.info(`API server: ${API}`);
  core.info(`Garnet Control Version: ${GARNETVER}`);
  core.info(`Jibril Version: ${JIBRILVER}`);

  // Create a temporary directory for the script to use.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "garnet-"));
  _tmpDirForCleanup = tmpDir;

  // Download garnetctl.
  try {
    const garnetPrefix = "https://github.com/garnet-org/garnetctl-releases/releases";
    let garnetUrl =
      GARNETVER === "latest"
        ? `${garnetPrefix}/latest/download/garnetctl_${GARNET_OS}_${ALTARCH}.tar.gz`
        : `${garnetPrefix}/download/${GARNETVER}/garnetctl_${GARNET_OS}_${ALTARCH}.tar.gz`;

    core.info(`Downloading garnetctl: ${garnetUrl}`);

    const garnetTarball = path.join(tmpDir, "garnetctl.tar.gz");
    await downloadFile(garnetUrl, garnetTarball);
    await extractTarGz(garnetTarball, tmpDir);

    const garnetctlSrc = path.join(tmpDir, "garnetctl");
    if (!fs.existsSync(garnetctlSrc)) {
      fail(1, "Failed to download garnetctl binary");
    }

    await execSudo(["mv", garnetctlSrc, `${INSTPATH}/garnetctl`]);
    await execSudo(["chmod", "+x", `${INSTPATH}/garnetctl`]);

    // Download jibril
    const jibrilPrefix = "https://github.com/garnet-org/jibril-releases/releases";
    let jibrilUrl =
      JIBRILVER === "latest"
        ? `${jibrilPrefix}/latest/download/jibril`
        : `${jibrilPrefix}/download/${JIBRILVER}/jibril`;

    core.info(`Downloading jibril: ${jibrilUrl}`);

    const jibrilDest = path.join(tmpDir, "jibril");
    await downloadFile(jibrilUrl, jibrilDest);
    await execSudo(["mv", jibrilDest, `${INSTPATH}/jibril`]);
    await execSudo(["chmod", "+x", `${INSTPATH}/jibril`]);

    // Configure garnetctl
    core.info("Configuring garnetctl");
    if (DEBUG === "true") core.debug(`$ ${INSTPATH}/garnetctl config set-baseurl ${API}`);
    await exec.exec(`${INSTPATH}/garnetctl`, ["config", "set-baseurl", API]);
    if (DEBUG === "true") core.debug(`$ ${INSTPATH}/garnetctl config set-token ***`);
    await exec.exec(`${INSTPATH}/garnetctl`, ["config", "set-token", TOKEN]);

    // Create github context
    core.info("Creating github context");

    if (DEBUG === "true") core.debug(`$ ${INSTPATH}/garnetctl version`);
    const versionOutput = await execCapture(`${INSTPATH}/garnetctl`, ["version"]);
    // Extract the version from the output.
    const versionMatch = versionOutput.match(/Version:\s*([^,]+)/);
    const VERSION = versionMatch ? versionMatch[1].trim() : "";

    const RUNNER_IP = getFirstIpv4() || "127.0.0.1";

    // Get the system machine ID.
    let SYSTEM_MACHINE_ID = os.hostname();
    const machineIdPaths = ["/etc/machine-id", "/var/lib/dbus/machine-id"];
    for (const p of machineIdPaths) {
      if (fs.existsSync(p)) {
        SYSTEM_MACHINE_ID = fs.readFileSync(p, "utf8").trim();
        break;
      }
    }

    const MACHINE_ID = SYSTEM_MACHINE_ID;
    const HOSTNAME = `${os.hostname()}-${getEnv("GITHUB_RUN_ID")}-${getEnv("GITHUB_JOB")}`;

    // Create the github context.
    const githubContext = {
      job: getEnv("GITHUB_JOB"),
      run_id: getEnv("GITHUB_RUN_ID"),
      workflow: getEnv("GITHUB_WORKFLOW"),
      repository: getEnv("GITHUB_REPOSITORY"),
      repository_id: getEnv("GITHUB_REPOSITORY_ID"),
      repository_owner: getEnv("GITHUB_REPOSITORY_OWNER"),
      repository_owner_id: getEnv("GITHUB_REPOSITORY_OWNER_ID"),
      event_name: getEnv("GITHUB_EVENT_NAME"),
      ref: getEnv("GITHUB_REF"),
      sha: getEnv("GITHUB_SHA"),
      actor: getEnv("GITHUB_ACTOR"),
      runner_os: getEnv("RUNNER_OS"),
      runner_arch: getEnv("RUNNER_ARCH"),
    };
    const githubContextPath = path.join(tmpDir, "github-context.json");
    fs.writeFileSync(githubContextPath, JSON.stringify(githubContext, null, 2));

    // Create agent
    core.info("Creating github agent");

    // Create the agent.
    let agentOutput;
    try {
      if (DEBUG === "true") core.debug(`$ ${INSTPATH}/garnetctl create agent ...`);
      agentOutput = await execCapture(`${INSTPATH}/garnetctl`, [
        "create",
        "agent",
        "--version",
        VERSION,
        "--ip",
        RUNNER_IP,
        "--hostname",
        HOSTNAME,
        "--machine-id",
        MACHINE_ID,
        "--kind",
        "github",
        "--context-file",
        githubContextPath,
      ]);
    } catch (err) {
      fail(err.exitCode ?? 1, "Failed to create agent");
    }

    // Parse the agent output.
    let AGENT_ID, AGENT_TOKEN;
    try {
      const agentInfo = JSON.parse(agentOutput);
      AGENT_ID = agentInfo.id;
      AGENT_TOKEN = agentInfo.agent_token;
    } catch (_) {
      fail(1, "Failed to parse agent output");
    }

    core.info(`Created agent with ID: ${AGENT_ID}`);

    // Get network policy
    core.info("Getting network policy");

    const REPO_ID = getEnv("GITHUB_REPOSITORY");
    const WORKFLOW = getEnv("GITHUB_WORKFLOW");

    // Create the network policy path.
    const NETPOLICY_PATH = path.join(tmpDir, "netpolicy.yaml");

    core.info(`Fetching network policy for ${REPO_ID}/${WORKFLOW}...`);

    // Fetch the network policy.
    try {
      if (DEBUG === "true") core.debug(`$ ${INSTPATH}/garnetctl get network-policy merged ...`);
      await exec.exec(`${INSTPATH}/garnetctl`, [
        "get",
        "network-policy",
        "merged",
        "--repository-id",
        REPO_ID,
        "--workflow-name",
        WORKFLOW,
        "--format",
        "yaml",
        "--output",
        NETPOLICY_PATH,
      ]);
    } catch (err) {
      fail(err.exitCode ?? 1, "Failed to fetch network policy");
    }

    if (!fs.existsSync(NETPOLICY_PATH)) {
      fail(1, "Network policy file was not created");
    }

    // Save the network policy to the file system.
    core.info(`Network policy saved to ${NETPOLICY_PATH}`);
    if (DEBUG === "true") {
      const content = fs.readFileSync(NETPOLICY_PATH, "utf8");
      core.info(content.split("\n").slice(0, 20).join("\n"));
    }

    core.info("Installing obtained network policy to /etc/jibril/netpolicy.yaml");

    // Set the environment variables for Jibril.
    process.env.GARNET_API_URL = API;
    process.env.GARNET_API_TOKEN = TOKEN;
    process.env.GARNET_AGENT_TOKEN = AGENT_TOKEN;

    // Create Jibril default environment file
    core.info("Creating Jibril default environment file");

    const jibrilDefault = `# Garnet API configuration
GARNET_API_URL=${process.env.GARNET_API_URL}
GARNET_API_TOKEN=${process.env.GARNET_API_TOKEN}
GARNET_AGENT_TOKEN=${process.env.GARNET_AGENT_TOKEN}
GARNET_SAR=${getEnv("GARNET_SAR", "true")}
# AI configuration
AI_ENABLED=${getEnv("AI_ENABLED", "false")}
AI_MODE=${getEnv("AI_MODE", "reason")}
AI_TOKEN=${getEnv("AI_TOKEN")}
AI_MODEL=${getEnv("AI_MODEL", "gpt-4o")}
AI_TEMPERATURE=${getEnv("AI_TEMPERATURE", "0.3")}
# Runner information
RUNNER_ARCH=${getEnv("RUNNER_ARCH")}
RUNNER_OS=${getEnv("RUNNER_OS")}
# Jibril writes profile markdown to this file
JIBRIL_PROFILER_FILE=${getEnv("GITHUB_STEP_SUMMARY")}
# GitHub context
GITHUB_ACTION=${getEnv("GITHUB_ACTION", "__run")}
GITHUB_ACTOR_ID=${getEnv("GITHUB_ACTOR_ID")}
GITHUB_ACTOR=${getEnv("GITHUB_ACTOR")}
GITHUB_EVENT_NAME=${getEnv("GITHUB_EVENT_NAME")}
GITHUB_JOB=${getEnv("GITHUB_JOB")}
GITHUB_REF_NAME=${getEnv("GITHUB_REF_NAME")}
GITHUB_REF_PROTECTED=${getEnv("GITHUB_REF_PROTECTED")}
GITHUB_REF_TYPE=${getEnv("GITHUB_REF_TYPE")}
GITHUB_REF=${getEnv("GITHUB_REF")}
GITHUB_REPOSITORY_ID=${getEnv("GITHUB_REPOSITORY_ID")}
GITHUB_REPOSITORY_OWNER_ID=${getEnv("GITHUB_REPOSITORY_OWNER_ID")}
GITHUB_REPOSITORY_OWNER=${getEnv("GITHUB_REPOSITORY_OWNER")}
GITHUB_REPOSITORY=${getEnv("GITHUB_REPOSITORY")}
GITHUB_RUN_ATTEMPT=${getEnv("GITHUB_RUN_ATTEMPT")}
GITHUB_RUN_ID=${getEnv("GITHUB_RUN_ID")}
GITHUB_RUN_NUMBER=${getEnv("GITHUB_RUN_NUMBER")}
GITHUB_SERVER_URL=${getEnv("GITHUB_SERVER_URL")}
GITHUB_SHA=${getEnv("GITHUB_SHA")}
GITHUB_STEP_SUMMARY=${getEnv("GITHUB_STEP_SUMMARY")}
GITHUB_TOKEN=${getEnv("GITHUB_TOKEN")}
GITHUB_TRIGGERING_ACTOR=${getEnv("GITHUB_TRIGGERING_ACTOR")}
GITHUB_WORKFLOW_REF=${getEnv("GITHUB_WORKFLOW_REF")}
GITHUB_WORKFLOW_SHA=${getEnv("GITHUB_WORKFLOW_SHA")}
GITHUB_WORKFLOW=${getEnv("GITHUB_WORKFLOW")}
GITHUB_WORKSPACE=${getEnv("GITHUB_WORKSPACE")}
`;

    const jibrilDefaultPath = path.join(tmpDir, "jibril.default");
    fs.writeFileSync(jibrilDefaultPath, jibrilDefault);

    core.info("Installing default environment file to /etc/default/jibril");
    await execSudo(["install", "-D", "-o", "root", "-m", "644", jibrilDefaultPath, "/etc/default/jibril"]);

    // Verify default environment file.
    if (DEBUG === "true") {
      try {
        const defaultContent = readFileSafe("/etc/default/jibril");
        core.info("Default environment file:");
        core.info(defaultContent || "No default environment file found");
      } catch (_) {}
    }

    core.info("Installing Jibril as a systemd service");
    await execSudo([`${INSTPATH}/jibril`, "--systemd", "install"]);

    // Configure logging using a systemd drop-in override
    core.info("Configuring Jibril logging");
    await execSudo(["mkdir", "-p", "/etc/systemd/system/jibril.service.d"]);
    const loggingConf = `[Service]
StandardError=append:/var/log/jibril.err
StandardOutput=append:/var/log/jibril.log
`;

    // Configure logging using a systemd drop-in override.
    const loggingConfPath = path.join(tmpDir, "logging.conf");
    fs.writeFileSync(loggingConfPath, loggingConf);
    await execSudo(["cp", loggingConfPath, "/etc/systemd/system/jibril.service.d/logging.conf"]);

    // Verify installed files.
    if (DEBUG === "true") {
      try {
        const entries = readdirRecursiveSafe("/etc/jibril");
        core.info("Jibril installed files:");
        core.info(entries.length > 0 ? entries.join("\n") : "No files found in /etc/jibril/");
      } catch (_) {}
      try {
        const configOutput = readFileSafe("/etc/jibril/config.yaml");
        core.info("Jibril configuration:");
        core.info(configOutput || "No configuration file found");
      } catch (_) {}
      try {
        const policyContent = readFileSafe("/etc/jibril/netpolicy.yaml");
        core.info("Jibril default network policy:");
        core.info(policyContent ? policyContent.split("\n").slice(0, 20).join("\n") : "No network policy file found");
      } catch (_) {}
    }

    // Replace network policy with fetched one.
    await execSudo(["cp", "-v", NETPOLICY_PATH, "/etc/jibril/netpolicy.yaml"]);

    // Verify replaced network policy.
    if (DEBUG === "true") {
      try {
        const replacedContent = readFileSafe("/etc/jibril/netpolicy.yaml");
        core.info("Replaced Jibril network policy:");
        core.info(
          replacedContent ? replacedContent.split("\n").slice(0, 20).join("\n") : "No network policy file found",
        );
      } catch (_) {}
    }

    if (DEBUG === "true") {
      core.info("Reloading systemd and enabling Jibril service...");
    }

    // Reload systemd and enable Jibril service.
    await execSudo(["systemctl", "daemon-reload"]);
    await execSudo(["systemctl", "enable", "jibril.service"], {
      ignoreReturnCode: true,
    });

    if (DEBUG === "true") {
      core.info("Starting Jibril service...");
    }

    // Start Jibril service.
    let returnCode = 0;
    try {
      await execSudo(["systemctl", "start", "jibril.service"]);
    } catch (err) {
      returnCode = err.exitCode ?? 1;
    }

    // Check if Jibril service started successfully.
    if (returnCode !== 0) {
      if (DEBUG === "true") {
        await execSudo(["journalctl", "-xeu", "jibril.service"], {
          ignoreReturnCode: true,
        });
      }
      fail(1, "Failed to start Jibril service");
    }

    // Wait for Jibril to initialize
    await new Promise((r) => setTimeout(r, 5000));

    // Check Jibril service status.
    if (DEBUG === "true") {
      core.info("Checking Jibril service status...");
      await execSudo(["systemctl", "status", "jibril.service", "--no-pager"], {
        ignoreReturnCode: true,
      });
    }

    core.info("Jibril service started successfully");
  } finally {
    // Clean up the temporary directory.
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// This function fails the script with a given error code and message.
function fail(code, message) {
  if (_tmpDirForCleanup && fs.existsSync(_tmpDirForCleanup)) {
    try {
      fs.rmSync(_tmpDirForCleanup, { recursive: true, force: true });
    } catch (_) {}
  }
  core.error(message || "Error");
  process.exit(code ?? 1);
}

// This function gets an environment variable with a default value.
function getEnv(name, def = "") {
  return process.env[name] ?? def;
}

// This function executes a command and returns the output.
async function execCapture(command, args, options = {}) {
  let output = "";
  await exec.exec(command, args, {
    ...options,
    listeners: {
      stdout: (data) => {
        output += data.toString();
      },
      stderr: (data) => {
        options.listeners?.stderr?.(data);
      },
    },
  });
  return output.trim();
}

// This function executes a command with sudo.
async function execSudo(args, options = {}) {
  if (getEnv("DEBUG") === "true") {
    core.debug(`$ sudo -E ${args.join(" ")}`);
  }
  return exec.exec("sudo", ["-E", ...args], options);
}

// This function downloads a file from a URL to a destination path.
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(destPath);
    protocol
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(destPath);
          const redirectUrl = res.headers.location.startsWith("http")
            ? res.headers.location
            : new URL(res.headers.location, url).href;
          downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(destPath);
          reject(new Error(`Failed to download ${url}: HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
  });
}

// This function extracts a tarball to a destination directory.
async function extractTarGz(tarballPath, destDir) {
  await tar.extract({ file: tarballPath, cwd: destDir });
}

// Returns the first non-internal IPv4 address from network interfaces.
function getFirstIpv4() {
  const ifaces = os.networkInterfaces();
  for (const addrs of Object.values(ifaces)) {
    for (const addr of addrs) {
      if (addr.family === "IPv4" && !addr.internal) {
        return addr.address;
      }
    }
  }
  return null;
}

// Reads a file, returns null on permission error or missing file.
function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8").trim();
  } catch (_) {
    return null;
  }
}

// Recursively lists files under a directory. Returns [] on error.
function readdirRecursiveSafe(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, { recursive: true });
    return Array.isArray(entries) ? entries : [];
  } catch (_) {
    return [];
  }
}

module.exports = { run };
