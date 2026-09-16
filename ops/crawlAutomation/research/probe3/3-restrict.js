/**
 * Content Restriction Script
 * Disables right-click, copy/paste, and inspect element in production
 * Allows all functionality in local development environment
 */
window.myRestrictVar = "Restrict My Page";

// Check if we're in local environment by looking for local indicators
function isLocalEnvironment() {
  // Check for localhost or 127.0.0.1
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.includes("local") ||
    window.location.hostname.includes(".local")
  ) {
    return true;
  }
  // Check for common development domains
  if (
    window.location.hostname.includes("dev") ||
    window.location.hostname.includes("staging")
  ) {
    return true;
  }
  return false;
}

// Skip all restrictions in local environment
if (isLocalEnvironment()) {
  console.log("Local environment detected - all restrictions disabled");

  // Enable text selection via CSS in local environment
  document.addEventListener("DOMContentLoaded", function () {
    // Override user-select: none with inline styles to enable selection
    const style = document.createElement("style");
    style.textContent = `
      body, body * {
        -webkit-user-select: auto !important;
        -moz-user-select: auto !important;
        -ms-user-select: auto !important;
        user-select: auto !important;
      }
    `;
    document.head.appendChild(style);
  });

  // Handle selectstart to enable selection
  document.addEventListener(
    "selectstart",
    function (e) {
      e.stopPropagation();
    },
    true,
  );
} else {
  // Production: Disable right-click (context menu)
  document.addEventListener("contextmenu", function (event) {
    // iOS Safari delivers its long-press contact sheet (Call / Video /
    // Message / Copy Phone) as a contextmenu event, so blanket-blocking it
    // also kills the phone-number action on the mobile property cards. Let
    // tel: links through; everything else stays restricted.
    if (event.target.closest && event.target.closest('a[href^="tel:"]')) {
      return;
    }
    event.preventDefault();
  });

  // Production: Disable F12, Ctrl+Shift+I, Ctrl+Shift+U, Ctrl+S (Inspect Element and related shortcuts)
  document.addEventListener("keydown", function (event) {
    if (
      event.keyCode === 123 || // F12
      (event.ctrlKey && event.shiftKey && event.keyCode === 73) || // Ctrl+Shift+I
      (event.ctrlKey && event.shiftKey && event.keyCode === 85) || // Ctrl+Shift+U
      (event.ctrlKey && event.keyCode === 83)
    ) {
      // Ctrl+S
      event.preventDefault();
    }
  });

  // Production: Disable Ctrl+C, Ctrl+X, Ctrl+V (Copy, Cut, Paste)
  document.onkeydown = function (event) {
    if (
      event.ctrlKey &&
      (event.keyCode === 67 || event.keyCode === 88 || event.keyCode === 86)
    ) {
      event.preventDefault();
    }
  };

  // Production: Disable drag and drop
  document.addEventListener("dragstart", function (event) {
    event.preventDefault();
  });
}
