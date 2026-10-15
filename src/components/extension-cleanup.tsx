"use client";

import { useEffect } from "react";

// In browser environments, suppress false-positive hydration warnings caused by browser extensions
// like Bitwarden (bis_skin_checked, bis_register, etc.) before hydration occurs.
if (typeof window !== "undefined") {
  const origError = console.error;
  console.error = function (...args: unknown[]) {
    for (let i = 0; i < args.length; i++) {
      const str = String(args[i]);
      if (
        str.includes("bis_skin_checked") ||
        str.includes("bis_register") ||
        str.includes("bis_frame_id") ||
        str.includes("bis_size")
      ) {
        return;
      }
    }
    origError.apply(console, args);
  };

  const origWarn = console.warn;
  console.warn = function (...args: unknown[]) {
    for (let i = 0; i < args.length; i++) {
      const str = String(args[i]);
      if (
        str.includes("bis_skin_checked") ||
        str.includes("bis_register") ||
        str.includes("bis_frame_id") ||
        str.includes("bis_size")
      ) {
        return;
      }
    }
    origWarn.apply(console, args);
  };

  window.addEventListener(
    "error",
    (event) => {
      if (event && event.message && event.message.includes("bis_skin_checked")) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    },
    true
  );
}

export function ExtensionCleanup() {
  useEffect(() => {
    function cleanExtensionAttrs(node: Node) {
      if (!node || node.nodeType !== 1) return;
      const el = node as HTMLElement;
      if (el.hasAttribute("bis_skin_checked")) el.removeAttribute("bis_skin_checked");
      if (el.hasAttribute("bis_register")) el.removeAttribute("bis_register");
      const children = el.querySelectorAll
        ? el.querySelectorAll("[bis_skin_checked], [bis_register]")
        : [];
      for (let i = 0; i < children.length; i++) {
        children[i].removeAttribute("bis_skin_checked");
        children[i].removeAttribute("bis_register");
      }
    }

    const observer = new MutationObserver((mutations) => {
      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];
        if (m.type === "attributes") {
          if (m.attributeName === "bis_skin_checked" || m.attributeName === "bis_register") {
            (m.target as HTMLElement).removeAttribute(m.attributeName);
          }
        } else if (m.type === "childList") {
          for (let j = 0; j < m.addedNodes.length; j++) {
            cleanExtensionAttrs(m.addedNodes[j]);
          }
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["bis_skin_checked", "bis_register"],
    });

    cleanExtensionAttrs(document.documentElement);

    return () => {
      observer.disconnect();
    };
  }, []);

  return null;
}
