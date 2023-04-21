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

async function fetchPluginCode(): Promise<string> {
  const response = await fetch("plugin.js");
  return response.text();
}

const fakeDeps = {
  lodash: {},
};

interface PluginCode {
  main: () => void;
}

async function main() {
  const blueWindow = window;
  const redWindow = await createIframeContext();
  const pluginCode = await fetchPluginCode();

  const distortionMap = new Map<string, unknown>();
  blueWindow["testValue"] = "Set in blue window";
  redWindow["testValue"] = "Set in red window";

  const endowments = {
    define: (dependencies: string[], code: (deps: unknown[]) => PluginCode) => {
      const resolvedDeps = dependencies.map((dep) => {
        if (fakeDeps[dep]) {
          return fakeDeps[dep];
        }
        throw new Error(`Dependency ${dep} not found`);
      });
      // prints "Set in red window"
      const plugin = code(resolvedDeps);
      plugin.main();
    },
  };

  logHeader("Evaluating plugin code in red window");

  function distortionCallback(value: unknown) {
    console.log("distortionCallback", value);
    return value;
  }

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
