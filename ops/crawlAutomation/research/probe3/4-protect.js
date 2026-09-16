// assets/protected.js
// Declare a global variable
window.myProtectVar = "Protect My Page";
(function ($) {
  function isFormElement(el) {
    return (
      el &&
      (el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable)
    );
  }

  // Check if we're in local environment
  function isLocalEnvironment() {
    if (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname.includes("local") ||
      window.location.hostname.includes(".local") ||
      window.location.hostname.includes("dev") ||
      window.location.hostname.includes("staging")
    ) {
      return true;
    }
    return false;
  }

  // simple helper to send logs (use credentials if needed)
  function sendLog(action, snippet) {
    // Skip logging in local environment
    if (isLocalEnvironment()) {
      return;
    }

    console.log("Logging action:", action, "Snippet:", snippet);
    try {
      navigator.sendBeacon(
        "log_action.php",
        JSON.stringify({
          action: action,
          page: window.location.href,
          snippet: snippet || "",
          token: (window.PROTECTED && window.PROTECTED.token) || "",
        }),
      );
    } catch (e) {
      // fallback using jQuery
      $.ajax({
        url: "log_action.php",
        type: "POST",
        contentType: "application/json",
        data: JSON.stringify({
          action: action,
          page: window.location.href,
          snippet: snippet || "",
        }),
      });
    }
  }

  // throttle selection logging to avoid floods
  var lastSelection = "";
  var selTimeout = null;
  $(document).on("selectionchange", function () {
    const activeEl = document.activeElement;
    if (isFormElement(activeEl)) return; // skip form fields
    clearTimeout(selTimeout);
    selTimeout = setTimeout(function () {
      var s =
        (window.getSelection &&
          window.getSelection().toString &&
          window.getSelection().toString()) ||
        "";
      if (s && s.length > 6 && s !== lastSelection) {
        lastSelection = s;
        sendLog("selection", s);
      }
    }, 250);
  });

  // Detect copy (keyboard + context menu) - skip in local environment
  document.addEventListener("copy", function (e) {
    if (isLocalEnvironment()) return; // allow copy in local environment
    if (isFormElement(e.target)) return; // skip form fields
    const selected = window.getSelection().toString();
    sendLog("copy", selected);
  });

  // Detect cut - skip in local environment
  document.addEventListener("cut", function (e) {
    if (isLocalEnvironment()) return; // allow cut in local environment
    if (isFormElement(e.target)) return; // skip form fields
    const selected = window.getSelection().toString();
    sendLog("cut", selected);
  });

  // detect context menu (right click)
  $(document).on("contextmenu", function (e) {
    sendLog("contextmenu", "");
    // optionally block: e.preventDefault();
  });

  // detect print attempt (Ctrl+P / Cmd+P)
  $(window).on("keydown", function (e) {
    var isPrint = (e.ctrlKey && e.key === "p") || (e.metaKey && e.key === "p");
    if (isPrint) {
      sendLog("print_attempt", "");
      // e.preventDefault();
    }
  });
  console.log("Protected content scripts loaded.");
})(jQuery);
