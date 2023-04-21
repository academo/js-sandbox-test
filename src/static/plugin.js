function mainPlugin() {
  console.log("Main from plugin started");
  const body = document.querySelector("body");
  const div = document.createElement("div");
  div.innerHTML = "This content was injected by the plugin";
  body.appendChild(div);
  console.log(body.innerHTML);
  console.log("mainPlugin finished");
}

define(["lodash"], function (lodash) {
  console.log("Got lodash", lodash);
  console.log("Got testValue", window.testValue);
  return {
    main: mainPlugin,
  };
});
