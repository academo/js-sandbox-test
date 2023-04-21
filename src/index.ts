// Creates an iframe with a "red" context and returns its Window object
async function createIframeContext(): Promise<Window> {
  const iframe = document.createElement("iframe");
  iframe.srcdoc = "<html><head></head><body>red body</body></html>";
  iframe.style.display = "none";
  document.body.appendChild(iframe);
  return new Promise((resolve) => {
    iframe.onload = () => {
      resolve(iframe.contentWindow);
    };
  });
}

// Fetches plugin code from "plugin.js" and returns it as a string
async function fetchPluginCode(): Promise<string> {
  const response = await fetch("plugin.js");
  return response.text();
}

// Fake dependencies for the plugin code
const fakeDeps = {
  lodash: {},
};

interface PluginCode {
  main: () => void;
}

async function main() {
  // Blue window (main window) and red window (iframe context)
  const blueWindow = window;
  const redWindow = await createIframeContext();
  const pluginCode = await fetchPluginCode();

  const distortionMap = new Map<string, unknown>();
  blueWindow["testValue"] = "Set in blue window";
  redWindow["testValue"] = "Set in red window";

  // Define a custom functions and objects to be passed as an endowment
  const endowments = {
    define: (dependencies: string[], code: (deps: unknown[]) => PluginCode) => {
      const resolvedDeps = dependencies.map((dep) => {
        if (fakeDeps[dep]) {
          return fakeDeps[dep];
        }
        throw new Error(`Dependency ${dep} not found`);
      });
      const plugin = code(resolvedDeps);
      plugin.main();
    },
  };

  logHeader("Evaluating plugin code in red window");

  function distortionCallback(value: unknown) {
    // console.log("distortionCallback", value);
    return value;
  }

  // Evaluate the fetched plugin code in the red window context
  evaluateInChildWindow({
    code: pluginCode,
    childWindow: redWindow,
    distortionCallback,
    endowments,
  });
}

function evaluateInChildWindow({
  code,
  childWindow,
  distortionCallback,
  endowments,
}: {
  code: string;
  childWindow: Window;
  distortionCallback: (value: unknown) => unknown;
  endowments: Record<string, unknown>;
}) {
  const proxyHandler: ProxyHandler<Window> = {
    get(target, property, receiver) {
      let value: unknown;
      try {
        value = Reflect.get(target, property, receiver);
      } catch (error) {
        // Fallback to target[property] for properties causing "Illegal invocation"
        value = target[property];
      }

      // sometimes there's no need to distort
      if (value === null) {
        return null;
      }
      return distortionCallback(value);
    },
  };
  const childWindowProxy = new Proxy(childWindow, proxyHandler);

  //@ts-ignore typescript doesn't with
  with ({
    ...childWindowProxy,
    ...endowments,
  })
    //eval the code
    eval(code);
}

function logHeader(message: string) {
  console.log(`------------------ ${message} ------------------`);
}
main();
